-- Development access foundation. Review before applying to a remote project.
begin;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and position('@' in email) > 1),
  auth_user_id uuid unique references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id),
  role text not null check (role in ('toch_admin', 'account_manager', 'collaborator', 'client_contract_admin')),
  -- Scope UUIDs reserved for the next modules. Add FKs when clients/projects exist.
  -- No business data endpoints are implemented by this migration.
  client_id uuid,
  project_id uuid,
  constraint role_scope check (
    (role = 'toch_admin' and client_id is null and project_id is null) or
    (role in ('account_manager', 'client_contract_admin') and client_id is not null and project_id is null) or
    (role = 'collaborator' and client_id is null and project_id is not null)
  ),
  unique nulls not distinct (account_id, role, client_id, project_id)
);
create unique index contract_admin_one_client on public.access_grants(account_id) where role = 'client_contract_admin';

create table public.access_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  account_id uuid not null references public.app_accounts(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.app_accounts enable row level security;
alter table public.access_grants enable row level security;
alter table public.access_audit enable row level security;
revoke all on public.app_accounts, public.access_grants, public.access_audit from anon, authenticated;
grant select on public.app_accounts, public.access_grants, public.access_audit to authenticated;
revoke all on sequence public.access_audit_id_seq from anon, authenticated;

-- Trusted Auth data only: user metadata supplied by the browser is never used.
create function app_private.google_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
    and (auth.jwt()->'app_metadata'->>'provider') = 'google'
    and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google'
      and lower(i.identity_data->>'email') = lower(u.email)
      and i.identity_data->>'email_verified' = 'true');
$$;

create function app_private.current_account_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select a.id from public.app_accounts a
  where a.auth_user_id = auth.uid() and a.is_active
    and a.email = app_private.google_email();
$$;

create function app_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.access_grants g
    where g.account_id = app_private.current_account_id() and g.role = 'toch_admin');
$$;

revoke all on function app_private.google_email(), app_private.current_account_id(), app_private.is_admin() from public, anon, authenticated;
grant execute on function app_private.current_account_id(), app_private.is_admin() to authenticated;

create policy accounts_read on public.app_accounts for select to authenticated
  using (id = (select app_private.current_account_id()) or (select app_private.is_admin()));
create policy grants_read on public.access_grants for select to authenticated
  using (account_id = (select app_private.current_account_id()) or (select app_private.is_admin()));
create policy audit_admin_read on public.access_audit for select to authenticated
  using ((select app_private.is_admin()));

create function public.bind_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare v_email text; v_id uuid;
begin
  v_email := app_private.google_email();
  if v_email is null then raise exception 'Access denied' using errcode = '42501'; end if;
  update public.app_accounts a set auth_user_id = auth.uid(), updated_at = now()
    where a.email = v_email and a.is_active and a.auth_user_id is null
      and exists(select 1 from public.access_grants g where g.account_id = a.id)
    returning a.id into v_id;
  if v_id is not null then
    insert into public.access_audit(actor_id, account_id, action) values(auth.uid(), v_id, 'identity_bound');
  end if;
end;
$$;

create function public.get_my_access() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email', a.email, 'grants',
    (select jsonb_agg(jsonb_build_object('role', g.role, 'client_id', g.client_id, 'project_id', g.project_id)
      order by g.role, g.id) from public.access_grants g where g.account_id = a.id))
  from public.app_accounts a where a.id = app_private.current_account_id()
    and exists(select 1 from public.access_grants g where g.account_id = a.id);
$$;

-- Only TOCH Admin may preauthorize, disable or change role assignments.
-- Keep this RPC behind a server permission check when an administration UI is added.
create function public.admin_set_account(p_email text, p_active boolean, p_grants jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_before jsonb; v_roles text[];
begin
  if not app_private.is_admin() then raise exception 'Access denied' using errcode = '42501'; end if;
  if p_active is null or p_grants is null or jsonb_typeof(p_grants) <> 'array' then
    raise exception 'Invalid account configuration' using errcode = '22023';
  end if;
  if p_active and jsonb_array_length(p_grants) = 0 then
    raise exception 'Active account requires a role' using errcode = '22023';
  end if;
  select array_agg(distinct x->>'role') into v_roles from jsonb_array_elements(p_grants) x;
  if (v_roles @> array['client_contract_admin'] and cardinality(v_roles) <> 1)
    or (v_roles @> array['toch_admin'] and cardinality(v_roles) <> 1) then
    raise exception 'Role combination not approved' using errcode = '22023';
  end if;
  -- Serialize concurrent changes to the same normalized email.
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)), 0));
  select jsonb_build_object('active', a.is_active, 'grants',
    (select jsonb_agg(to_jsonb(g)) from public.access_grants g where g.account_id = a.id))
    into v_before from public.app_accounts a where a.email = lower(btrim(p_email));
  insert into public.app_accounts(email, is_active) values(lower(btrim(p_email)), p_active)
    on conflict (email) do update set is_active = excluded.is_active, updated_at = now()
    returning id into v_id;
  delete from public.access_grants where account_id = v_id;
  insert into public.access_grants(account_id, role, client_id, project_id)
    select v_id, x->>'role', (x->>'client_id')::uuid, (x->>'project_id')::uuid
      from jsonb_array_elements(p_grants) x;
  insert into public.access_audit(actor_id, account_id, action, details)
    values(auth.uid(), v_id, 'authorization_changed',
      jsonb_build_object('before', v_before, 'active', p_active, 'grants', p_grants));
  return v_id;
end;
$$;

revoke all on function public.bind_my_account(), public.get_my_access(), public.admin_set_account(text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.bind_my_account(), public.get_my_access(), public.admin_set_account(text, boolean, jsonb) to authenticated;

commit;
