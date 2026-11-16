-- Rich descriptions and private request attachments. No public bucket or real data seeds.
begin;
alter table public.incoming_requests add column description_document jsonb;

create table public.request_attachments (
  id uuid primary key,
  request_id uuid not null,
  client_id uuid not null references public.clients(id),
  uploader_id uuid not null references auth.users(id),
  filename text not null check(length(filename) between 1 and 200),
  mime_type text not null,
  byte_size integer not null check(byte_size between 1 and 10485760),
  storage_path text not null unique,
  submitted boolean not null default false,
  created_at timestamptz not null default now()
);
create index request_attachments_request_idx on public.request_attachments(request_id);
alter table public.request_attachments enable row level security;
revoke all on public.request_attachments from anon,authenticated;
grant select on public.request_attachments to authenticated;

create function app_private.can_read_request_attachment(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.request_attachments a where a.id=p_id and (
    (not a.submitted and a.uploader_id=auth.uid() and a.client_id=app_private.requester_client_id())
    or (a.submitted and (app_private.is_admin() or exists(
      select 1 from public.access_grants g where g.account_id=app_private.current_account_id()
        and g.role in ('account_manager','client_contract_admin') and g.client_id=a.client_id)))
  ));
$$;
create function app_private.can_upload_request_attachment(p_path text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
begin
  -- Serialize insertion/deletion of draft objects with request submission.
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  return exists(select 1 from public.request_attachments a
    where a.storage_path=p_path and not a.submitted and a.uploader_id=auth.uid()
      and a.client_id=app_private.requester_client_id()
      and not exists(select 1 from public.incoming_requests r where r.id=a.request_id));
end;
$$;
revoke all on function app_private.can_read_request_attachment(uuid),app_private.can_upload_request_attachment(text) from public,anon,authenticated;
grant execute on function app_private.can_read_request_attachment(uuid),app_private.can_upload_request_attachment(text) to authenticated;
create policy request_attachment_read on public.request_attachments for select to authenticated
  using(app_private.can_read_request_attachment(id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('request-attachments','request-attachments',false,10485760,array[
    'image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation','application/zip']);
create policy request_files_insert on storage.objects for insert to authenticated
  with check(bucket_id='request-attachments' and app_private.can_upload_request_attachment(name));
create policy request_files_read on storage.objects for select to authenticated
  using(bucket_id='request-attachments' and exists(select 1 from public.request_attachments a
    where a.storage_path=storage.objects.name and app_private.can_read_request_attachment(a.id)));
create policy request_files_discard_draft on storage.objects for delete to authenticated
  using(bucket_id='request-attachments' and app_private.can_upload_request_attachment(name));
-- No overwrite policy; deletion only permits the owner's unsubmitted drafts.

create function public.discard_request_attachment(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_asset public.request_attachments;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  select * into v_asset from public.request_attachments where id=p_id for update;
  if not found or v_asset.uploader_id<>auth.uid() or v_asset.submitted
    or v_asset.client_id is distinct from app_private.requester_client_id()
    or exists(select 1 from public.incoming_requests where id=v_asset.request_id) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if exists(select 1 from storage.objects where bucket_id='request-attachments' and name=v_asset.storage_path) then
    raise exception 'Delete draft object first' using errcode='22023';
  end if;
  delete from public.request_attachments where id=p_id;
end;
$$;

create function public.reserve_request_attachment(p_id uuid,p_request_id uuid,p_filename text,p_mime text,p_bytes integer)
returns text language plpgsql security definer set search_path='' as $$
declare v_client uuid;v_path text;v_existing public.request_attachments;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  v_client:=app_private.requester_client_id();
  if v_client is null then raise exception 'Access denied' using errcode='42501';end if;
  if p_id is null or p_request_id is null or p_bytes is null or p_bytes not between 1 and 10485760
    or p_filename is null or length(p_filename) not between 1 and 200
    or position('/' in p_filename)>0 or position(chr(92) in p_filename)>0
    or p_mime is null or p_mime<>(case lower(substring(p_filename from '[^.]+$'))
      when 'png' then 'image/png' when 'jpg' then 'image/jpeg' when 'jpeg' then 'image/jpeg'
      when 'webp' then 'image/webp' when 'gif' then 'image/gif' when 'pdf' then 'application/pdf'
      when 'txt' then 'text/plain' when 'csv' then 'text/csv' when 'zip' then 'application/zip'
      when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      when 'xlsx' then 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      when 'pptx' then 'application/vnd.openxmlformats-officedocument.presentationml.presentation' else '' end) then
    raise exception 'Invalid attachment' using errcode='22023';
  end if;
  if exists(select 1 from public.incoming_requests where id=p_request_id) then raise exception 'Request already submitted' using errcode='22023';end if;
  select * into v_existing from public.request_attachments where id=p_id;
  if found then
    if v_existing.uploader_id=auth.uid() and v_existing.request_id=p_request_id and v_existing.client_id=v_client
      and v_existing.filename=p_filename and v_existing.mime_type=p_mime and v_existing.byte_size=p_bytes then return v_existing.storage_path;end if;
    raise exception 'Attachment conflict' using errcode='22023';
  end if;
  if (select count(*) from public.request_attachments where request_id=p_request_id)>=10
    or (select coalesce(sum(byte_size),0) from public.request_attachments where request_id=p_request_id)+p_bytes>20971520 then
    raise exception 'Attachment limit' using errcode='22023';
  end if;
  v_path:=auth.uid()::text||'/'||p_request_id::text||'/'||p_id::text;
  insert into public.request_attachments(id,request_id,client_id,uploader_id,filename,mime_type,byte_size,storage_path)
    values(p_id,p_request_id,v_client,auth.uid(),p_filename,p_mime,p_bytes,v_path);
  return v_path;
end;
$$;

create function app_private.valid_request_node(p_node jsonb,p_depth integer default 0) returns boolean
language plpgsql immutable set search_path='' as $$
declare v_type text;v_mark jsonb;v_child jsonb;v_attrs jsonb;
begin
  if p_node is null or jsonb_typeof(p_node)<>'object' or p_depth>20 or length(p_node::text)>200000 then return false;end if;
  v_type:=p_node->>'type';v_attrs:=coalesce(p_node->'attrs','{}'::jsonb);
  if v_type is null or v_type not in ('doc','paragraph','heading','text','hardBreak','bulletList','orderedList','listItem','blockquote','codeBlock','horizontalRule','image')
    or (p_node-array['type','text','attrs','marks','content'])<>'{}'::jsonb or jsonb_typeof(v_attrs)<>'object' then return false;end if;
  if v_type='text' and (jsonb_typeof(p_node->'text') is distinct from 'string') then return false;end if;
  if v_type='image' then
    if (v_attrs-array['attachmentId','src','alt'])<>'{}'::jsonb
      or coalesce(v_attrs->>'attachmentId','')!~'^[0-9a-f-]{36}$'
      or (v_attrs->>'src') is distinct from ('attachment:'||(v_attrs->>'attachmentId')) then return false;end if;
  elsif v_type='heading' then
    if (v_attrs-'level')<>'{}'::jsonb or coalesce(v_attrs->>'level','') not in ('1','2','3') then return false;end if;
  elsif v_type='orderedList' then
    if (v_attrs-'start')<>'{}'::jsonb or coalesce(v_attrs->>'start','')!~'^[0-9]{1,5}$' then return false;end if;
  elsif v_attrs<>'{}'::jsonb then return false;
  end if;
  if p_node ? 'marks' then
    if jsonb_typeof(p_node->'marks')<>'array' then return false;end if;
    for v_mark in select value from jsonb_array_elements(p_node->'marks') loop
      if jsonb_typeof(v_mark)<>'object' or (v_mark-array['type','attrs'])<>'{}'::jsonb then return false;end if;
      if v_mark->>'type'='textStyle' then
        if jsonb_typeof(v_mark->'attrs') is distinct from 'object' or ((v_mark->'attrs')-array['color','fontFamily'])<>'{}'::jsonb
          or (v_mark->'attrs' ? 'color' and coalesce(v_mark->'attrs'->>'color','')!~'^#[0-9a-fA-F]{6}$')
          or (v_mark->'attrs' ? 'fontFamily' and coalesce(v_mark->'attrs'->>'fontFamily','') not in ('Arial','Georgia','Verdana','Courier New')) then return false;end if;
      elsif v_mark->>'type'='link' then
        if jsonb_typeof(v_mark->'attrs') is distinct from 'object' or ((v_mark->'attrs')-'href')<>'{}'::jsonb
          or coalesce(v_mark->'attrs'->>'href','')!~'^https?://' then return false;end if;
      elsif coalesce(v_mark->>'type','') not in ('bold','italic','underline','strike','code') or v_mark ? 'attrs' then return false;
      end if;
    end loop;
  end if;
  if p_node ? 'content' then
    if jsonb_typeof(p_node->'content')<>'array' then return false;end if;
    for v_child in select value from jsonb_array_elements(p_node->'content') loop
      if not app_private.valid_request_node(v_child,p_depth+1) then return false;end if;
    end loop;
  end if;
  return true;
end;
$$;
create function app_private.request_document_text(p_node jsonb) returns text
language plpgsql immutable set search_path='' as $$
declare v_result text:=coalesce(p_node->>'text','');v_child jsonb;
begin
  for v_child in select value from jsonb_array_elements(coalesce(p_node->'content','[]'::jsonb)) loop
    v_result:=v_result||app_private.request_document_text(v_child);
  end loop;
  if p_node->>'type' in ('paragraph','heading','codeBlock','hardBreak') then v_result:=v_result||chr(10);end if;
  return v_result;
end;
$$;
revoke all on function app_private.valid_request_node(jsonb,integer),app_private.request_document_text(jsonb) from public,anon,authenticated;

create function public.submit_external_request_rich(p_id uuid,p_title text,p_document jsonb,p_attachment_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_client uuid;v_text text;v_image jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  v_client:=app_private.requester_client_id();
  if v_client is null then raise exception 'Access denied' using errcode='42501';end if;
  if p_id is null or p_title is null or length(btrim(p_title)) not between 1 and 200
    or p_document->>'type' is distinct from 'doc' or not app_private.valid_request_node(p_document)
    or p_attachment_ids is null or cardinality(p_attachment_ids)>10 then raise exception 'Invalid request' using errcode='22023';end if;
  v_text:=btrim(app_private.request_document_text(p_document),chr(10)||' ');
  if length(v_text)>10000 then raise exception 'Invalid request' using errcode='22023';end if;
  -- Existing submissions are immutable: return the original receipt on retry.
  if exists(select 1 from public.incoming_requests where id=p_id and requester_user_id=auth.uid()) then return p_id;end if;
  if exists(select 1 from unnest(p_attachment_ids) chosen(id) where not exists(
    select 1 from public.request_attachments a join storage.objects o on o.bucket_id='request-attachments' and o.name=a.storage_path
    where a.id=chosen.id and a.request_id=p_id and a.client_id=v_client and a.uploader_id=auth.uid() and not a.submitted
      and o.metadata->>'mimetype'=a.mime_type and (o.metadata->>'size')::bigint=a.byte_size)) then
    raise exception 'Attachment not uploaded' using errcode='22023';
  end if;
  for v_image in select value from jsonb_path_query(p_document,'$.** ? (@.type == "image")') as images(value) loop
    if not exists(select 1 from public.request_attachments a where a.id=(v_image->'attrs'->>'attachmentId')::uuid
      and a.id=any(p_attachment_ids) and a.mime_type like 'image/%') then raise exception 'Invalid image' using errcode='22023';end if;
  end loop;
  if v_text='' then
    if not exists(select 1 from jsonb_path_query(p_document,'$.** ? (@.type == "image")')) then raise exception 'Empty description' using errcode='22023';end if;
    v_text:='[Imagen adjunta]';
  end if;
  insert into public.incoming_requests(id,client_id,requester_user_id,requester_email,title,description,description_document)
    values(p_id,v_client,auth.uid(),app_private.google_email(),btrim(p_title),v_text,p_document);
  update public.request_attachments set submitted=true where id=any(p_attachment_ids);
  return p_id;
end;
$$;
revoke all on function public.reserve_request_attachment(uuid,uuid,text,text,integer),public.submit_external_request_rich(uuid,text,jsonb,uuid[]),public.discard_request_attachment(uuid) from public,anon,authenticated;
grant execute on function public.reserve_request_attachment(uuid,uuid,text,text,integer),public.submit_external_request_rich(uuid,text,jsonb,uuid[]),public.discard_request_attachment(uuid) to authenticated;
commit;

