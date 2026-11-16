begin;

create table app_private.client_password_signups (
  email text primary key,
  client_id uuid not null references public.clients(id),
  user_id uuid unique references auth.users(id) on delete cascade,
  requested_at timestamptz not null,
  temporary_password_hash text,
  completed_at timestamptz
);
alter table app_private.client_password_signups enable row level security;
revoke all on app_private.client_password_signups from public, anon, authenticated;

create function app_private.password_session_after(p_time timestamptz) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]')) method
    where method->>'method' = 'password'
      and (method->>'timestamp')::numeric >= floor(extract(epoch from p_time)));
$$;

create function public.reserve_client_password(p_email text)
returns table (existing_user uuid)
language plpgsql security definer set search_path = '' as $$
declare
  client uuid;
  previous app_private.client_password_signups;
  candidate auth.users;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  client := app_private.active_external_domain(p_email);
  if client is null or p_email is distinct from lower(btrim(p_email))
  then return; end if;

  select * into previous from app_private.client_password_signups where email = p_email;
  if found and (previous.completed_at is not null or previous.client_id <> client
    or previous.requested_at > clock_timestamp() - interval '2 minutes') then return; end if;

  select * into candidate from auth.users where lower(email) = p_email;
  if found and (
    exists (select 1 from auth.identities i where i.user_id = candidate.id and i.provider <> 'email')
    or (coalesce(candidate.encrypted_password,'') <> ''
      and candidate.raw_app_meta_data->>'tete_password_signup' is distinct from 'true')
  ) then return; end if;
  if exists (
    select 1 from public.app_accounts a where (a.email = p_email or a.auth_user_id = candidate.id)
      and (not a.is_active or a.email <> p_email or a.auth_user_id is distinct from candidate.id
        or not exists (select 1 from public.access_grants g where g.account_id = a.id
          and g.role = 'client_collaborator' and g.client_id = client)
        or exists (select 1 from public.access_grants g where g.account_id = a.id
          and (g.role not in ('client_collaborator','client_contract_admin') or g.client_id is distinct from client)))
  ) then return; end if;

  insert into app_private.client_password_signups(email, client_id, requested_at)
    values (p_email, client, clock_timestamp())
    on conflict (email) do update set requested_at = excluded.requested_at, temporary_password_hash = null;
  return query select candidate.id;
end;
$$;

create function public.client_password_pending() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app_private.client_password_signups s join auth.users u on lower(u.email) = s.email
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and u.raw_app_meta_data->>'tete_password_signup' = 'true'
      and s.temporary_password_hash is not null and s.completed_at is null and s.requested_at > now() - interval '24 hours'
      and s.client_id = app_private.active_external_domain(s.email)
      and app_private.password_session_after(s.requested_at)
      and not exists (select 1 from public.app_accounts a
        where (a.email = s.email or a.auth_user_id = u.id)
          and (not a.is_active or a.email <> s.email or a.auth_user_id is distinct from u.id
            or not exists (select 1 from public.access_grants g where g.account_id = a.id
              and g.role = 'client_collaborator' and g.client_id = s.client_id)
            or exists (select 1 from public.access_grants g where g.account_id = a.id
              and (g.role not in ('client_collaborator','client_contract_admin')
                or g.client_id is distinct from s.client_id))))
  );
$$;

create function public.prepare_client_password(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update app_private.client_password_signups s set temporary_password_hash = u.encrypted_password
    from auth.users u where u.id = p_user and lower(u.email) = s.email
      and u.raw_app_meta_data->>'tete_password_signup' = 'true'
      and coalesce(u.encrypted_password, '') <> ''
      and s.completed_at is null and s.requested_at > now() - interval '2 minutes';
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
end;
$$;

create function public.register_client_with_temporary_password() returns void
language plpgsql security definer set search_path = '' as $$
declare
  p_user uuid := auth.uid();
  signup app_private.client_password_signups;
  account uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  if not public.client_password_pending() then
    raise exception 'Access denied' using errcode='42501';
  end if;
  select s.* into signup from app_private.client_password_signups s
    join auth.users u on lower(u.email) = s.email
    where u.id = p_user;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  select id into account from public.app_accounts where email = signup.email;
  if not found then
    insert into public.app_accounts(email, auth_user_id) values(signup.email, p_user) returning id into account;
    insert into public.access_grants(account_id, role, client_id)
      values(account,'client_collaborator',signup.client_id);
    insert into public.access_audit(actor_id,account_id,action,details)
      values(p_user,account,'client_self_registered',jsonb_build_object('client_id',signup.client_id));
  elsif not exists (
    select 1 from public.app_accounts a join public.access_grants g on g.account_id = a.id
    where a.id = account and a.is_active and a.auth_user_id = p_user
      and g.role = 'client_collaborator' and g.client_id = signup.client_id
      and not exists (select 1 from public.access_grants x where x.account_id = a.id
        and (x.role not in ('client_collaborator','client_contract_admin') or x.client_id is distinct from signup.client_id))
  ) then raise exception 'Access denied' using errcode='42501';
  end if;
  update app_private.client_password_signups set user_id = p_user where email = signup.email;
end;
$$;

create function public.complete_client_password(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration',0));
  update app_private.client_password_signups s
    set completed_at = clock_timestamp() + interval '1 second', temporary_password_hash = null
    from auth.users u
    where s.user_id = p_user and u.id = p_user and lower(u.email) = s.email
      and u.encrypted_password <> s.temporary_password_hash
      and s.completed_at is null and s.requested_at > now() - interval '24 hours'
      and s.client_id = app_private.active_external_domain(s.email)
      and exists (
        select 1 from public.app_accounts a join public.access_grants g on g.account_id = a.id
        where a.auth_user_id = p_user and a.email = s.email and a.is_active
          and g.role = 'client_collaborator' and g.client_id = s.client_id
      );
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
end;
$$;

revoke all on function app_private.password_session_after(timestamptz),
  public.reserve_client_password(text), public.prepare_client_password(uuid), public.complete_client_password(uuid),
  public.client_password_pending(), public.register_client_with_temporary_password() from public, anon, authenticated;
grant execute on function public.reserve_client_password(text), public.prepare_client_password(uuid),
  public.complete_client_password(uuid) to service_role;
grant execute on function public.client_password_pending(), public.register_client_with_temporary_password() to authenticated;

revoke execute on function public.activate_client_code_account(), public.can_request_client_code(text) from authenticated, anon;

create function public.read_temporary_client_requests(p_offset integer default 0)
returns table (reference_number bigint, title text, description text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.reference_number::bigint, r.title, r.description, r.created_at
  from public.incoming_requests r
  join app_private.client_password_signups s on s.client_id = r.client_id
  join auth.users u on lower(u.email) = s.email and u.id = auth.uid()
  where r.requester_user_id = u.id and s.user_id = u.id and public.client_password_pending()
  order by r.reference_number desc
  limit 26 offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.read_temporary_client_requests(integer) from public, anon, authenticated;
grant execute on function public.read_temporary_client_requests(integer) to authenticated;

create or replace function app_private.google_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
        and (
      ((auth.jwt()->'app_metadata'->>'provider') = 'google'
        and (auth.jwt()->'amr' is null or auth.jwt()->'amr' @> '[{"method":"oauth"}]')
        and not exists (select 1 from app_private.client_password_signups s
          where s.email = lower(u.email) and s.completed_at is null and s.temporary_password_hash is not null)
        and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google'
          and lower(i.identity_data->>'email') = lower(u.email)
          and i.identity_data->>'email_verified' = 'true'))
      or exists (
        select 1 from app_private.client_password_signups s
        join public.app_accounts a on a.auth_user_id = u.id and a.email = s.email and a.is_active
        join public.access_grants g on g.account_id = a.id
        where s.user_id = u.id and s.email = lower(u.email) and s.completed_at is not null
          and g.role = 'client_collaborator' and g.client_id = s.client_id
          and s.client_id = app_private.active_external_domain(s.email)
          and not exists (select 1 from public.access_grants x where x.account_id = a.id
            and (x.role not in ('client_collaborator','client_contract_admin') or x.client_id is distinct from s.client_id))
          and app_private.password_session_after(s.completed_at)
      )
    );
$$;
create or replace function app_private.validate_client_collaborator() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.role='client_collaborator' and not exists (
    select 1 from public.clients c join public.app_accounts a on a.id=new.account_id
    where c.id=new.client_id and c.client_type='external' and (c.is_active or not a.is_active)
  ) then raise exception 'Unavailable scope' using errcode='23503'; end if;
  if exists (select 1 from public.access_grants g
    where g.account_id=new.account_id and g.id is distinct from new.id
      and g.role<>new.role and 'client_collaborator' in (g.role,new.role)
      and not ('client_contract_admin' in (g.role,new.role) and g.client_id = new.client_id))
  then raise exception 'Invalid role combination' using errcode='22023'; end if;
  return new;
end;
$$;
create or replace function public.admin_set_account_legacy(p_email text, p_active boolean, p_grants jsonb) returns uuid
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
  if v_roles = array['client_contract_admin'] and not exists (
    select 1 from public.app_accounts a join public.access_grants g on g.account_id = a.id
    where a.email = lower(btrim(p_email)) and g.role = 'client_contract_admin'
      and not exists (select 1 from public.access_grants x where x.account_id = a.id and x.role = 'client_collaborator')
      and g.client_id = (p_grants->0->>'client_id')::uuid
  ) then raise exception 'Role combination not approved' using errcode='22023'; end if;
  if (v_roles @> array['client_contract_admin'] and cardinality(v_roles) <> 1 and not (v_roles <@ array['client_contract_admin','client_collaborator']))
    or (v_roles @> array['toch_admin'] and cardinality(v_roles) <> 1) then
    raise exception 'Role combination not approved' using errcode = '22023';
  end if;
  if v_roles @> array['client_contract_admin','client_collaborator'] and not exists (
    select 1 from public.app_accounts a join public.access_grants g on g.account_id = a.id
    where a.email = lower(btrim(p_email)) and a.auth_user_id is not null
      and g.role = 'client_collaborator'
      and not exists (select 1 from jsonb_array_elements(p_grants) x
        where (x->>'client_id')::uuid is distinct from g.client_id)
  ) then raise exception 'Role combination not approved' using errcode='22023'; end if;
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
commit;
