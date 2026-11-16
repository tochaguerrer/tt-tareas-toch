begin;

alter table public.projects add column budget_hours numeric
  check (budget_hours >= 0 and budget_hours < 'Infinity'::numeric);

create table public.project_hourly_rates (
  project_id uuid primary key references public.projects(id),
  hourly_rate numeric not null check (hourly_rate >= 0 and hourly_rate < 'Infinity'::numeric)
);

alter table public.project_hourly_rates enable row level security;
revoke all on public.project_hourly_rates from public, anon, authenticated;
grant select on public.project_hourly_rates to authenticated;
create policy project_hourly_rates_admin_read on public.project_hourly_rates
  for select to authenticated using (app_private.is_admin());

create function public.admin_create_project(
  p_client_id uuid, p_name text, p_budget_hours numeric, p_hourly_rate numeric
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_project_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('tete.account_administration', 0));
  if not app_private.is_admin() then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  perform 1 from public.clients where id = p_client_id and is_active for share;
  if not found then raise exception 'Cliente no disponible' using errcode = '22023'; end if;

  insert into public.projects (client_id, name, budget_hours)
  values (p_client_id, btrim(p_name), p_budget_hours)
  returning id into v_project_id;

  if p_hourly_rate is not null then
    insert into public.project_hourly_rates (project_id, hourly_rate)
    values (v_project_id, p_hourly_rate);
  end if;

  return v_project_id;
end;
$$;

revoke all on function public.admin_create_project(uuid,text,numeric,numeric) from public, anon, authenticated;
grant execute on function public.admin_create_project(uuid,text,numeric,numeric) to authenticated;

commit;
