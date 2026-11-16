-- Domain-based requester access. Apply after migration 002; no real domains or clients seeded.
begin;
create table public.client_domains (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  domain text not null check (domain=lower(btrim(domain)) and length(domain)<=253
    and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$'),
  is_active boolean not null default true,
  updated_at timestamptz not null default clock_timestamp(),
  unique(client_id,domain)
);
create unique index active_domain_one_client on public.client_domains(domain) where is_active;
alter table public.client_domains enable row level security;
revoke all on public.client_domains from anon, authenticated;
grant select on public.client_domains to authenticated;
create policy domains_admin_read on public.client_domains for select to authenticated using(app_private.is_admin());

-- Explicit deactivation blocks domain access too, even without a bound account.
create function app_private.requester_client_id() returns uuid
language sql stable security definer set search_path='' as $$
  select d.client_id from public.client_domains d join public.clients c on c.id=d.client_id
  where d.is_active and c.is_active
    and d.domain=split_part(app_private.google_email(),'@',2)
    and not exists(select 1 from public.app_accounts a where a.email=app_private.google_email() and not a.is_active);
$$;
revoke all on function app_private.requester_client_id() from public,anon,authenticated;

create or replace function public.get_my_access() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('email',app_private.google_email(),
    'grants',coalesce((select jsonb_agg(jsonb_build_object('role',g.role,'client_id',g.client_id,'project_id',g.project_id) order by g.role,g.id)
      from public.access_grants g where g.account_id=app_private.current_account_id()),'[]'::jsonb),
    'requester_client',(select jsonb_build_object('id',c.id,'name',c.name) from public.clients c where c.id=app_private.requester_client_id()))
  where app_private.current_account_id() is not null or app_private.requester_client_id() is not null;
$$;

create function public.admin_create_client(p_name text,p_type text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  if not app_private.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  insert into public.clients(name,client_type) values(btrim(p_name),p_type) returning id into v_id;
  insert into public.access_audit(actor_id,account_id,action,details)
    values(auth.uid(),app_private.current_account_id(),'client_created',jsonb_build_object('client_id',v_id));
  return v_id;
end;
$$;

create function public.admin_save_domain(p_id uuid,p_client_id uuid,p_domain text,p_active boolean,p_expected timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old public.client_domains;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  if not app_private.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_active is null then raise exception 'Invalid domain' using errcode='22023'; end if;
  if not exists(select 1 from public.clients where id=p_client_id and (not p_active or is_active)) then
    raise exception 'Unavailable client' using errcode='23503';
  end if;
  if p_id is null then
    insert into public.client_domains(client_id,domain,is_active) values(p_client_id,lower(btrim(p_domain)),p_active) returning id into v_id;
  else
    select * into v_old from public.client_domains where id=p_id for update;
    if not found or p_expected is null or v_old.updated_at is distinct from p_expected then
      raise exception 'Domain changed' using errcode='40001';
    end if;
    if v_old.client_id<>p_client_id or v_old.domain<>lower(btrim(p_domain)) then
      raise exception 'Domain identity cannot change' using errcode='22023';
    end if;
    update public.client_domains set is_active=p_active,updated_at=clock_timestamp() where id=p_id returning id into v_id;
  end if;
  insert into public.access_audit(actor_id,account_id,action,details)
    values(auth.uid(),app_private.current_account_id(),'domain_changed',
      jsonb_build_object('domain_id',v_id,'client_id',p_client_id,'domain',lower(btrim(p_domain)),'active',p_active,'previous_active',v_old.is_active));
  return v_id;
end;
$$;

create table public.incoming_requests (
  id uuid primary key,
  client_id uuid not null references public.clients(id),
  requester_user_id uuid not null references auth.users(id),
  requester_email text not null,
  title text not null check(length(btrim(title)) between 1 and 200),
  description text not null check(length(btrim(description)) between 1 and 10000),
  created_at timestamptz not null default clock_timestamp()
);
create index incoming_requests_client_idx on public.incoming_requests(client_id,created_at);
alter table public.incoming_requests enable row level security;
revoke all on public.incoming_requests from anon,authenticated;
grant select on public.incoming_requests to authenticated;
create policy requests_management_read on public.incoming_requests for select to authenticated using(
  app_private.is_admin() or exists(select 1 from public.access_grants g
    where g.account_id=app_private.current_account_id() and g.client_id=incoming_requests.client_id
      and g.role in ('account_manager','client_contract_admin'))
);

-- No client, sender or status is accepted from the browser.
create function public.submit_external_request(p_id uuid,p_title text,p_description text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_client uuid; v_email text;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  v_email:=app_private.google_email();
  v_client:=app_private.requester_client_id();
  if v_email is null or v_client is null then raise exception 'Access denied' using errcode='42501'; end if;
  if p_id is null or p_title is null or p_description is null or length(btrim(p_title)) not between 1 and 200
    or length(btrim(p_description)) not between 1 and 10000 then
    raise exception 'Invalid request' using errcode='22023';
  end if;
  if exists(select 1 from public.incoming_requests where id=p_id and requester_user_id=auth.uid()) then return p_id; end if;
  insert into public.incoming_requests(id,client_id,requester_user_id,requester_email,title,description)
    values(p_id,v_client,auth.uid(),v_email,btrim(p_title),btrim(p_description));
  return p_id;
end;
$$;
revoke all on function public.admin_create_client(text,text),public.admin_save_domain(uuid,uuid,text,boolean,timestamptz),
  public.submit_external_request(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_create_client(text,text),public.admin_save_domain(uuid,uuid,text,boolean,timestamptz),
  public.submit_external_request(uuid,text,text) to authenticated;
commit;

