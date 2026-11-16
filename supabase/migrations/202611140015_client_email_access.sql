begin;

create function app_private.active_external_domain(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select d.client_id from public.client_domains d
  join public.clients c on c.id = d.client_id
  where d.domain = split_part(p_email, '@', 2)
    and p_email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
    and d.is_active and c.is_active and c.client_type = 'external';
$$;

create function public.can_request_client_code(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.active_external_domain(lower(btrim(p_email))) is not null;
$$;

create function app_private.client_code_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
    and auth.jwt()->'amr' @> '[{"method":"otp"}]'::jsonb
    and not exists (
      select 1 from auth.identities i where i.user_id = u.id and i.provider = 'phone'
    )
    and exists (
      select 1 from auth.identities i where i.user_id = u.id
        and i.provider in ('email', 'google')
        and lower(i.identity_data->>'email') = lower(u.email)
    );
$$;

create function public.activate_client_code_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  verified_email text := app_private.client_code_email();
  client uuid;
  account public.app_accounts;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration', 0));
  client := app_private.active_external_domain(verified_email);
  if client is null then raise exception 'Access denied' using errcode = '42501'; end if;

  select * into account from public.app_accounts where email = verified_email for update;
  if not found then
    insert into public.app_accounts(email, auth_user_id)
      values (verified_email, auth.uid()) returning * into account;
    insert into public.access_grants(account_id, role, client_id)
      values (account.id, 'client_collaborator', client);
    insert into public.access_audit(actor_id, account_id, action, details)
      values (auth.uid(), account.id, 'client_self_registered', jsonb_build_object('client_id', client));
  else
    if not account.is_active
      or (account.auth_user_id is not null and account.auth_user_id <> auth.uid())
      or not exists (
        select 1 from public.access_grants g where g.account_id = account.id
          and g.client_id = client and g.role in ('client_collaborator', 'client_contract_admin')
      )
      or exists (
        select 1 from public.access_grants g where g.account_id = account.id
          and g.role not in ('client_collaborator', 'client_contract_admin')
      )
    then raise exception 'Access denied' using errcode = '42501'; end if;

    if account.auth_user_id is null then
      update public.app_accounts set auth_user_id = auth.uid(), updated_at = now() where id = account.id;
      insert into public.access_audit(actor_id, account_id, action)
        values (auth.uid(), account.id, 'identity_bound');
    end if;
  end if;
end;
$$;

-- Existing RPCs use this function for both authorization and sender attribution.
-- Keep Google verification for OAuth and restrict code sessions to bound client roles.
create or replace function app_private.google_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null and (
    (
      (auth.jwt()->'app_metadata'->>'provider') = 'google'
      and (auth.jwt()->'amr' is null or auth.jwt()->'amr' @> '[{"method":"oauth"}]'::jsonb)
      and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google'
        and lower(i.identity_data->>'email') = lower(u.email) and i.identity_data->>'email_verified' = 'true')
    )
    or (
      lower(u.email) = app_private.client_code_email()
      and exists (
        select 1 from public.app_accounts a join public.access_grants g on g.account_id = a.id
        where a.auth_user_id = u.id and a.email = lower(u.email) and a.is_active
          and g.role in ('client_collaborator', 'client_contract_admin')
          and g.client_id = app_private.active_external_domain(a.email)
          and not exists (select 1 from public.access_grants other where other.account_id = a.id
            and other.role not in ('client_collaborator', 'client_contract_admin'))
      )
    )
  );
$$;

revoke all on function app_private.active_external_domain(text), app_private.client_code_email(),
  public.can_request_client_code(text), public.activate_client_code_account() from public, anon, authenticated;
grant execute on function public.can_request_client_code(text) to anon, authenticated;
grant execute on function public.activate_client_code_account() to authenticated;

commit;
