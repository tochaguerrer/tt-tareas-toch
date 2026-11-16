-- Run ONCE as database owner in the DEVELOPMENT project after the migration.
-- Change this email here before first execution if the initial admin changes.
-- Later transfers use admin_set_account; no email is hard-coded in authorization.
begin;
do $$
declare initial_email text := 'ariel.guerrero@toch-la.com'; v_id uuid;
begin
  if exists(select 1 from public.access_grants g join public.app_accounts a on a.id = g.account_id
    where g.role = 'toch_admin' and a.is_active) then
    raise exception 'An active administrator already exists; use the authorized administration flow';
  end if;
  insert into public.app_accounts(email) values(lower(btrim(initial_email))) returning id into v_id;
  insert into public.access_grants(account_id, role) values(v_id, 'toch_admin');
  insert into public.access_audit(account_id, action) values(v_id, 'initial_admin_authorized');
end;
$$;
commit;
