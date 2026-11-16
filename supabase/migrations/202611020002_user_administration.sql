-- Minimal scope references for account administration; no operational modules or data seeds.
begin;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  client_type text not null check (client_type in ('internal', 'external')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  name text not null check (length(btrim(name)) between 1 and 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index projects_client_id_idx on public.projects(client_id);
alter table public.access_grants add constraint grants_client_fk foreign key(client_id) references public.clients(id);
alter table public.access_grants add constraint grants_project_fk foreign key(project_id) references public.projects(id);
alter table public.clients enable row level security;
alter table public.projects enable row level security;
revoke all on public.clients, public.projects from anon, authenticated;
grant select on public.clients, public.projects to authenticated;

create function app_private.can_read_client(p_client_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.is_admin() or exists (
    select 1 from public.access_grants g where g.account_id = app_private.current_account_id()
      and ((g.role in ('account_manager','client_contract_admin') and g.client_id=p_client_id)
        or (g.role='collaborator' and exists(select 1 from public.projects p where p.id=g.project_id and p.client_id=p_client_id)))
  );
$$;
create function app_private.can_read_project(p_project_id uuid, p_client_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.is_admin() or exists (
    select 1 from public.access_grants g where g.account_id = app_private.current_account_id()
      and ((g.role in ('account_manager','client_contract_admin') and g.client_id=p_client_id)
        or (g.role='collaborator' and g.project_id=p_project_id))
  );
$$;
revoke all on function app_private.can_read_client(uuid), app_private.can_read_project(uuid,uuid) from public, anon, authenticated;
grant execute on function app_private.can_read_client(uuid), app_private.can_read_project(uuid,uuid) to authenticated;
create policy clients_read_scope on public.clients for select to authenticated
  using (app_private.can_read_client(id));
create policy projects_read_scope on public.projects for select to authenticated
  using (app_private.can_read_project(id,client_id));

-- Retire the initial unversioned endpoint so direct API calls cannot bypass checks.
alter function public.admin_set_account(text, boolean, jsonb) rename to admin_set_account_legacy;
revoke all on function public.admin_set_account_legacy(text, boolean, jsonb) from public, anon, authenticated;

create function public.admin_save_account(
  p_account_id uuid, p_email text, p_active boolean, p_grants jsonb, p_expected_updated_at timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_existing public.app_accounts; v_id uuid;
begin
  -- Serialize administration changes; re-check actor after waiting for the lock.
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  if not app_private.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_email is null or length(p_email)>254 or lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email' using errcode='22023';
  end if;
  if p_grants is null or jsonb_typeof(p_grants)<>'array' or jsonb_array_length(p_grants)>400 then
    raise exception 'Invalid grants' using errcode='22023';
  end if;
  if p_account_id is null then
    if exists(select 1 from public.app_accounts where email=lower(btrim(p_email))) then
      raise exception 'Account already exists' using errcode='23505';
    end if;
  else
    select * into v_existing from public.app_accounts where id=p_account_id for update;
    if not found or p_expected_updated_at is null or v_existing.updated_at is distinct from p_expected_updated_at then
      raise exception 'Account changed' using errcode='40001';
    end if;
    if v_existing.email<>lower(btrim(p_email)) then raise exception 'Email cannot be reassigned' using errcode='22023'; end if;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_grants) g
    where (g->>'role' in ('account_manager','client_contract_admin') and not exists (
      select 1 from public.clients c where c.id=(g->>'client_id')::uuid and (not p_active or c.is_active)))
      or (g->>'role'='collaborator' and not exists (
        select 1 from public.projects p join public.clients c on c.id=p.client_id
          where p.id=(g->>'project_id')::uuid and (not p_active or (p.is_active and c.is_active))))
  ) then raise exception 'Unavailable scope' using errcode='23503'; end if;
  if p_account_id is not null and v_existing.is_active
    and exists(select 1 from public.access_grants where account_id=p_account_id and role='toch_admin')
    and (p_active is distinct from true or not exists(select 1 from jsonb_array_elements(p_grants) g where g->>'role'='toch_admin'))
    and not exists(select 1 from public.app_accounts a join public.access_grants g on g.account_id=a.id
      where a.id<>p_account_id and a.is_active and g.role='toch_admin') then
    raise exception 'Last active administrator must be retained' using errcode='P0001';
  end if;
  v_id := public.admin_set_account_legacy(p_email,p_active,p_grants);
  update public.app_accounts set updated_at=clock_timestamp() where id=v_id;
  return v_id;
end;
$$;

create function public.admin_transfer_administration(p_target_id uuid, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_target public.app_accounts; v_actor public.app_accounts;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  if not app_private.is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
  select * into v_actor from public.app_accounts where id=app_private.current_account_id() for update;
  select * into v_target from public.app_accounts where id=p_target_id for update;
  if not found or v_target.updated_at is distinct from p_expected_updated_at then
    raise exception 'Account changed' using errcode='40001';
  end if;
  if v_target.id=v_actor.id or not v_target.is_active or v_target.auth_user_id is null then
    raise exception 'Recipient must be another active signed-in account' using errcode='22023';
  end if;
  if not exists(select 1 from auth.users u join auth.identities i on i.user_id=u.id
    where u.id=v_target.auth_user_id and lower(u.email)=v_target.email and u.email_confirmed_at is not null
      and i.provider='google' and i.identity_data->>'email_verified'='true') then
    raise exception 'Recipient identity not verified' using errcode='22023';
  end if;
  perform public.admin_set_account_legacy(v_target.email,true,'[{"role":"toch_admin"}]'::jsonb);
  update public.app_accounts set updated_at=clock_timestamp() where id=v_target.id;
  -- No confirmed combination with Admin exists; the source is explicitly deactivated.
  perform public.admin_set_account_legacy(v_actor.email,false,'[]'::jsonb);
  update public.app_accounts set updated_at=clock_timestamp() where id=v_actor.id;
  insert into public.access_audit(actor_id,account_id,action,details)
    values(auth.uid(),v_target.id,'administration_transferred',jsonb_build_object('previous_account_id',v_actor.id));
end;
$$;
revoke all on function public.admin_save_account(uuid,text,boolean,jsonb,timestamptz), public.admin_transfer_administration(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.admin_save_account(uuid,text,boolean,jsonb,timestamptz), public.admin_transfer_administration(uuid,timestamptz) to authenticated;

commit;
