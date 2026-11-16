begin;

create function public.export_user_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(report) order by email, role, client, project), '[]'::jsonb)
    from (
      select coalesce(a.email, lower(u.email)) as email,
        coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name') as name,
        a.is_active as active, g.role,
        c.name as client, p.name as project, dc.name as domain_client,
        a.created_at, a.updated_at, u.last_sign_in_at
      from public.app_accounts a
      full join auth.users u on lower(u.email) = a.email
      left join public.access_grants g on g.account_id = a.id
      left join public.projects p on p.id = g.project_id
      left join public.clients c on c.id = coalesce(g.client_id, p.client_id)
      left join public.client_domains d on d.is_active
        and d.domain = split_part(coalesce(a.email, lower(u.email)), '@', 2)
      left join public.clients dc on dc.id = d.client_id and dc.is_active
      where coalesce(a.email, u.email) is not null
    ) report
  );
end;
$$;

revoke all on function public.export_user_access() from public, anon, authenticated;
grant execute on function public.export_user_access() to authenticated;

commit;
