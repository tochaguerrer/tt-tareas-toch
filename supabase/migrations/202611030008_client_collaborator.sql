begin;

alter table public.access_grants drop constraint access_grants_role_check, drop constraint role_scope;
alter table public.access_grants
  add check (role in ('toch_admin','account_manager','collaborator','client_contract_admin','client_collaborator')),
  add constraint role_scope check (
    (role = 'toch_admin' and client_id is null and project_id is null)
    or (role in ('account_manager','client_contract_admin','client_collaborator') and client_id is not null and project_id is null)
    or (role = 'collaborator' and project_id is not null and client_id is null)
  );
create unique index client_collaborator_one_client on public.access_grants(account_id) where role='client_collaborator';

create function app_private.validate_client_collaborator() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.role='client_collaborator' and not exists (
    select 1 from public.clients c join public.app_accounts a on a.id=new.account_id
    where c.id=new.client_id and c.client_type='external' and (c.is_active or not a.is_active)
  ) then raise exception 'Unavailable scope' using errcode='23503'; end if;
  if exists (select 1 from public.access_grants g
    where g.account_id=new.account_id and g.id is distinct from new.id
      and g.role<>new.role and 'client_collaborator' in (g.role,new.role))
  then raise exception 'Invalid role combination' using errcode='22023'; end if;
  return new;
end;
$$;
create trigger validate_client_collaborator before insert or update on public.access_grants
for each row execute function app_private.validate_client_collaborator();

create function app_private.client_collaborator_client() returns uuid
language sql stable security definer set search_path='' as $$
  select g.client_id from public.access_grants g join public.clients c on c.id=g.client_id
  where g.account_id=app_private.current_account_id() and g.role='client_collaborator' and c.is_active;
$$;

create or replace function app_private.requester_client_id() returns uuid
language sql stable security definer set search_path='' as $$
  select case when exists (
    select 1 from public.access_grants
    where account_id=app_private.current_account_id() and role='client_collaborator'
  ) then app_private.client_collaborator_client() else (
    select d.client_id from public.client_domains d join public.clients c on c.id=d.client_id
    where d.is_active and c.is_active
      and d.domain=split_part(app_private.google_email(),'@',2)
      and not exists(select 1 from public.app_accounts a where a.email=app_private.google_email() and not a.is_active)
  ) end;
$$;

create function app_private.can_read_own_request(p_request_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.incoming_requests r where r.id=p_request_id
    and r.requester_user_id=auth.uid() and r.client_id=app_private.client_collaborator_client());
$$;
revoke all on function app_private.client_collaborator_client(), app_private.can_read_own_request(uuid) from public,anon,authenticated;
grant execute on function app_private.can_read_own_request(uuid) to authenticated;
create policy requests_own_client_collaborator on public.incoming_requests for select to authenticated
  using(app_private.can_read_own_request(id));
create policy tasks_own_client_collaborator on public.tasks for select to authenticated
  using(app_private.can_read_own_request(source_request_id));
create policy own_submitted_attachments on public.request_attachments for select to authenticated
  using(submitted and app_private.can_read_own_request(request_id));
create policy own_submitted_request_files on storage.objects for select to authenticated
  using(bucket_id='request-attachments' and exists(
    select 1 from public.request_attachments a where a.storage_path=storage.objects.name
      and a.submitted and app_private.can_read_own_request(a.request_id)));

create table public.task_replies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  author_email text not null,
  body text not null check(length(body)<=5000),
  filename text check(length(filename) between 1 and 200),
  attachment bytea check(octet_length(attachment) between 1 and 524288),
  created_at timestamptz not null default clock_timestamp(),
  check ((filename is null) = (attachment is null)),
  check (length(btrim(body)) > 0 or attachment is not null)
);
create index task_replies_task_date on public.task_replies(task_id,created_at,id);
alter table public.task_replies enable row level security;
revoke all on public.task_replies from public,anon,authenticated;
grant select on public.task_replies to authenticated;
create policy task_replies_read on public.task_replies for select to authenticated
  using(exists(select 1 from public.tasks t where t.id=task_id));

create function public.reply_to_task(p_task_id uuid,p_body text,p_filename text,p_attachment bytea)
returns void language plpgsql security definer set search_path='' as $$
declare v_task public.tasks;
begin
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found or not (
    app_private.can_read_own_request(v_task.source_request_id) or app_private.is_admin() or exists (
      select 1 from public.access_grants g where g.account_id=app_private.current_account_id() and (
        (g.role='account_manager' and g.client_id=v_task.client_id)
        or (g.role='collaborator' and g.project_id=v_task.project_id)
      )
    )
  ) then raise exception 'Access denied' using errcode='42501'; end if;
  if v_task.status='closed' then raise exception 'Task closed' using errcode='22023'; end if;
  insert into public.task_replies(task_id,author_email,body,filename,attachment)
  values(p_task_id,app_private.google_email(),btrim(p_body),p_filename,p_attachment);
end;
$$;
revoke all on function public.reply_to_task(uuid,text,text,bytea) from public,anon,authenticated;
grant execute on function public.reply_to_task(uuid,text,text,bytea) to authenticated;
commit;
