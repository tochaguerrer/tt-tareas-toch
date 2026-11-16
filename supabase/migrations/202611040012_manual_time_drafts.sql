begin;

create table public.time_entries (
  id uuid primary key,
  task_id uuid not null references public.tasks(id),
  account_id uuid not null references public.app_accounts(id),
  work_date date not null check (isfinite(work_date)),
  seconds integer not null check (seconds between 1 and 86400),
  detail text not null check (length(btrim(detail)) between 1 and 5000),
  billable boolean not null,
  created_at timestamptz not null default clock_timestamp()
);
create index time_entries_account_date on public.time_entries(account_id, work_date);
alter table public.time_entries enable row level security;
revoke all on public.time_entries from public, anon, authenticated;
grant select on public.time_entries to authenticated;
create policy time_entries_read_own on public.time_entries for select to authenticated
  using (account_id = (select app_private.current_account_id())
    and exists (select 1 from public.tasks t where t.id = task_id));

create function public.save_manual_time_draft(
  p_id uuid, p_task_id uuid, p_work_date date, p_seconds integer,
  p_detail text, p_billable boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  account uuid := app_private.current_account_id();
  task public.tasks%rowtype;
begin
  select * into task from public.tasks where id = p_task_id for update;
  if account is null or task.id is null or not (
    app_private.is_admin() or exists (
      select 1 from public.access_grants g where g.account_id = account and (
        (g.role = 'account_manager' and g.client_id = task.client_id)
        or (g.role = 'collaborator' and g.project_id = task.project_id)
      )
    )
  ) then
    raise exception 'Time entry denied' using errcode = '42501';
  end if;

  -- An identical retry acknowledges the original save, even after closure.
  if exists (
    select 1 from public.time_entries e
    where e.id = p_id and e.account_id = account and e.task_id = task.id
      and e.work_date = p_work_date and e.seconds = p_seconds
      and e.detail = btrim(p_detail) and e.billable = p_billable
  ) then
    return p_id;
  end if;

  if task.status in ('closed', 'cancelled') then
    raise exception 'Task closed';
  end if;

  insert into public.time_entries (id, task_id, account_id, work_date, seconds, detail, billable)
  values (p_id, task.id, account, p_work_date, p_seconds, btrim(p_detail), p_billable);
  return p_id;
end;
$$;

revoke all on function public.save_manual_time_draft(uuid,uuid,date,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.save_manual_time_draft(uuid,uuid,date,integer,text,boolean) to authenticated;

commit;
