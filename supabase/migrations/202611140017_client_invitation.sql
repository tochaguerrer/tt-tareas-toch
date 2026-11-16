begin;

alter table app_private.client_password_signups
  add column invitation_id uuid,
  add column invitation_digest text unique;

-- Issuing an invitation never changes an existing Auth password or grants access.
create function public.reserve_client_invitation(p_email text, p_invitation uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  client uuid;
  previous app_private.client_password_signups;
  candidate auth.users;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration', 0));
  client := app_private.active_external_domain(p_email);
  if client is null or p_email is distinct from lower(btrim(p_email)) then return false; end if;

  select * into previous from app_private.client_password_signups where email = p_email;
  if previous.completed_at is not null or
    (previous.client_id is not null and previous.client_id <> client) or
    (previous.invitation_id is not null and previous.requested_at > now() - interval '30 seconds')
  then return false; end if;

  select * into candidate from auth.users where lower(email) = p_email;
  if found and (
    exists (select 1 from auth.identities i where i.user_id = candidate.id and i.provider <> 'email')
    or (coalesce(candidate.encrypted_password, '') <> ''
      and candidate.raw_app_meta_data->>'tete_password_signup' is distinct from 'true'
      and (previous.invitation_id is null or previous.user_id is distinct from candidate.id))
  ) then return false; end if;

  if exists (
    select 1 from public.app_accounts a where a.email = p_email or a.auth_user_id = candidate.id
  ) and not exists (
    select 1 from public.app_accounts a
    where a.email = p_email and a.auth_user_id = candidate.id and a.is_active
      and previous.user_id = candidate.id
      and exists (select 1 from public.access_grants g where g.account_id = a.id
        and g.role = 'client_collaborator' and g.client_id = client)
      and not exists (select 1 from public.access_grants g where g.account_id = a.id
        and (g.role not in ('client_collaborator', 'client_contract_admin') or g.client_id is distinct from client))
  ) then return false; end if;

  insert into app_private.client_password_signups(email, client_id, requested_at, invitation_id)
  values (p_email, client, clock_timestamp(), p_invitation)
  on conflict (email) do update set requested_at = excluded.requested_at,
    invitation_id = excluded.invitation_id, invitation_digest = null, temporary_password_hash = null;
  return true;
end;
$$;

create function public.publish_client_invitation(p_email text, p_invitation uuid, p_user uuid, p_digest text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update app_private.client_password_signups s set user_id = p_user, invitation_digest = p_digest
  from auth.users u where u.id = p_user and lower(u.email) = s.email and s.email = p_email
    and s.invitation_id = p_invitation and s.completed_at is null and s.invitation_digest is null
    and s.requested_at > now() - interval '30 seconds'
    and s.client_id = app_private.active_external_domain(s.email);
  return found;
end;
$$;

create function public.client_invitation_user(p_digest text)
returns uuid
language sql stable security definer set search_path = '' as $$
  select s.user_id from app_private.client_password_signups s join auth.users u on u.id = s.user_id
  where s.invitation_digest = p_digest and s.completed_at is null
    and s.requested_at > now() - interval '24 hours'
    and lower(u.email) = s.email and s.client_id = app_private.active_external_domain(s.email)
    and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider <> 'email')
    and not exists (
      select 1 from public.app_accounts a where (a.email = s.email or a.auth_user_id = u.id)
        and (not a.is_active or a.email <> s.email or a.auth_user_id is distinct from u.id
          or not exists (select 1 from public.access_grants g where g.account_id = a.id
            and g.role = 'client_collaborator' and g.client_id = s.client_id)
          or exists (select 1 from public.access_grants g where g.account_id = a.id
            and (g.role not in ('client_collaborator', 'client_contract_admin')
              or g.client_id is distinct from s.client_id)))
    );
$$;

create function public.complete_client_invitation(p_digest text, p_user uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  signup app_private.client_password_signups;
  account uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration', 0));
  if p_user is null or public.client_invitation_user(p_digest) is distinct from p_user then return false; end if;
  if not exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null
    and coalesce(u.encrypted_password, '') <> '') then return false; end if;

  select * into signup from app_private.client_password_signups where invitation_digest = p_digest;
  select id into account from public.app_accounts where email = signup.email;
  if not found then
    insert into public.app_accounts(email, auth_user_id) values (signup.email, p_user) returning id into account;
    insert into public.access_grants(account_id, role, client_id) values (account, 'client_collaborator', signup.client_id);
  end if;

  insert into public.access_audit(actor_id, account_id, action, details)
    values (p_user, account, 'client_invitation_accepted', jsonb_build_object('client_id', signup.client_id));
  update app_private.client_password_signups
    set completed_at = clock_timestamp(), invitation_digest = null
    where email = signup.email;
  return true;
end;
$$;

revoke all on function public.reserve_client_invitation(text, uuid),
  public.publish_client_invitation(text, uuid, uuid, text), public.client_invitation_user(text),
  public.complete_client_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_client_invitation(text, uuid),
  public.publish_client_invitation(text, uuid, uuid, text), public.client_invitation_user(text),
  public.complete_client_invitation(text, uuid) to service_role;

revoke execute on function public.reserve_client_password(text), public.prepare_client_password(uuid) from service_role;

commit;

