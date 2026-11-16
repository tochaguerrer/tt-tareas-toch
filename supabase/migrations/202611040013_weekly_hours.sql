begin;
alter table public.app_accounts add column time_zone text not null default 'America/Argentina/Buenos_Aires';
alter table public.tasks add column is_generic boolean not null default false;
alter table public.time_entries add column submitted_at timestamptz,
  add column approved_at timestamptz, add column approved_by uuid references public.app_accounts(id);
-- Local days with a daylight-saving rollback can exceed 24 hours.
alter table public.time_entries drop constraint time_entries_seconds_check,
  add constraint time_entries_seconds_check check (seconds > 0);

create table public.timer_sessions (
  id uuid primary key,
  account_id uuid not null references public.app_accounts(id),
  task_id uuid not null references public.tasks(id),
  time_zone text not null,
  finished_at timestamptz,
  consolidated_at timestamptz
);
create unique index timer_one_unfinished on public.timer_sessions(account_id) where finished_at is null;
create index timer_task on public.timer_sessions(task_id);
create table public.timer_segments (
  session_id uuid not null references public.timer_sessions(id),
  started_at timestamptz not null,
  ended_at timestamptz check (ended_at >= started_at),
  primary key(session_id,started_at)
);
create unique index timer_one_segment on public.timer_segments(session_id) where ended_at is null;
alter table public.time_entries add column timer_session_id uuid references public.timer_sessions(id),
  add unique(timer_session_id, work_date);
alter table public.timer_sessions enable row level security;
alter table public.timer_segments enable row level security;
revoke all on public.timer_sessions,public.timer_segments from public,anon,authenticated;

create function app_private.can_work_task(t public.tasks) returns boolean
language sql stable set search_path='' as $$
  select app_private.is_admin() or exists (
    select 1 from public.access_grants g where g.account_id=app_private.current_account_id() and (
      (g.role='account_manager' and g.client_id=t.client_id)
      or (g.role='collaborator' and g.project_id=t.project_id)));
$$;
create function app_private.can_review_task(t public.tasks) returns boolean
language sql stable set search_path='' as $$
  select app_private.is_admin() or exists (
    select 1 from public.access_grants g where g.account_id=app_private.current_account_id()
    and g.role='account_manager' and g.client_id=t.client_id);
$$;

create policy time_entries_review on public.time_entries for select to authenticated
  using (submitted_at is not null and exists (
    select 1 from public.tasks t where t.id=task_id and app_private.can_review_task(t)));

create function public.set_hours_preferences(p_zone text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_zone) then
    raise exception 'Invalid time zone';
  end if;
  update public.app_accounts set time_zone=p_zone where id=app_private.current_account_id();
  if not found then raise exception 'Access denied'; end if;
end $$;

create function public.set_generic_task(p_task uuid,p_generic boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.tasks t set is_generic=p_generic where id=p_task and app_private.can_review_task(t);
  if not found then raise exception 'Access denied'; end if;
end $$;

create function public.review_hours(p_week date default null,p_entry uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare
  account uuid := app_private.current_account_id();
begin
  if account is null then raise exception 'Access denied'; end if;
  if p_entry is null then
    if p_week is null or extract(isodow from p_week)<>1 then raise exception 'Invalid week'; end if;
    update public.time_entries e set submitted_at=clock_timestamp()
    from public.tasks t where t.id=e.task_id and e.account_id=account
      and e.work_date>=p_week and e.work_date<p_week+7 and e.submitted_at is null
      and app_private.can_work_task(t);
  else
    update public.time_entries e set approved_at=clock_timestamp(), approved_by=account
    from public.tasks t where e.id=p_entry and t.id=e.task_id and e.submitted_at is not null
      and e.approved_at is null and app_private.can_review_task(t);
    if not found then raise exception 'Entry unavailable'; end if;
  end if;
end $$;

create function app_private.stop_task_timers() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  stopped timestamptz := date_trunc('second',clock_timestamp());
begin
  if new.status in ('closed','cancelled') and old.status is distinct from new.status then
    with finished as (
      update public.timer_sessions set finished_at=stopped
      where task_id=new.id and finished_at is null returning id
    )
    update public.timer_segments set ended_at=stopped
    where ended_at is null and session_id in (select id from finished);
  end if;
  return new;
end $$;
create trigger stop_task_timers after update of status on public.tasks
for each row execute function app_private.stop_task_timers();

create function public.manage_timer(p_action text,p_session uuid,p_task uuid default null,
  p_detail text default null,p_billable boolean default null) returns void
language plpgsql security definer set search_path='' as $$
declare
  account uuid := app_private.current_account_id();
  task public.tasks%rowtype;
  session public.timer_sessions%rowtype;
  tick timestamptz;
begin
  if account is null then raise exception 'Access denied'; end if;
  if p_action='start' then
    select * into task from public.tasks where id=p_task for update;
  else
    select t.* into task from public.tasks t join public.timer_sessions s on s.task_id=t.id
      where s.id=p_session for update of t;
    select * into session from public.timer_sessions where id=p_session for update;
  end if;
  if task.id is null then raise exception 'Task unavailable'; end if;
  tick := date_trunc('second',clock_timestamp());

  if p_action='start' then
    if not app_private.can_work_task(task) or task.status in ('closed','cancelled') then
      raise exception 'Task unavailable';
    end if;
    if exists(select 1 from public.timer_sessions where id=p_session and account_id=account and task_id=task.id)
      then return; end if;
    insert into public.timer_sessions(id,account_id,task_id,time_zone)
    select p_session,account,task.id,time_zone from public.app_accounts where id=account;
    insert into public.timer_segments values(p_session,tick,null);
    return;
  end if;

  if p_action='classify' then
    if not app_private.can_review_task(task) or session.finished_at is null then raise exception 'Access denied'; end if;
  elsif session.account_id is distinct from account or not app_private.can_work_task(task) then
    raise exception 'Access denied';
  end if;
  if p_action='resume' then
    if session.finished_at is not null or task.status in ('closed','cancelled') then raise exception 'Task unavailable'; end if;
    if not exists(select 1 from public.timer_segments where session_id=p_session and ended_at is null) then
      insert into public.timer_segments values(p_session,tick,null)
      on conflict(session_id,started_at) do update set ended_at=null;
    end if;
    return;
  end if;
  if p_action='pause' and session.finished_at is null then
    update public.timer_segments set ended_at=tick where session_id=p_session and ended_at is null;
    return;
  end if;
  if p_action not in ('finish','classify') then raise exception 'Invalid action'; end if;
  if session.consolidated_at is not null then return; end if;
  if p_action='finish' and session.finished_at is not null then raise exception 'Requires manager classification'; end if;
  if p_billable is null or coalesce(length(btrim(p_detail)),0) not between 1 and 5000 then
    raise exception 'Invalid classification';
  end if;

  update public.timer_segments set ended_at=tick where session_id=p_session and ended_at is null;
  insert into public.time_entries(id,task_id,account_id,work_date,seconds,detail,billable,timer_session_id)
  select gen_random_uuid(),task.id,session.account_id,d.day::date,sum(
    extract(epoch from least(s.ended_at,(d.day+interval '1 day') at time zone session.time_zone)
      - greatest(s.started_at,d.day at time zone session.time_zone))
  )::integer,btrim(p_detail),p_billable,p_session
  from public.timer_segments s
  cross join lateral generate_series(
    date_trunc('day',s.started_at at time zone session.time_zone),
    date_trunc('day',s.ended_at at time zone session.time_zone),interval '1 day'
  ) as d(day)
  where s.session_id=p_session
    and least(s.ended_at,(d.day+interval '1 day') at time zone session.time_zone)
      > greatest(s.started_at,d.day at time zone session.time_zone)
  group by d.day;
  update public.timer_sessions set finished_at=coalesce(finished_at,tick),consolidated_at=tick where id=p_session;
end $$;

create function public.hours_timers() returns table(
  id uuid, title text, finished boolean, running_since timestamptz, elapsed_seconds integer, mine boolean
)
language sql stable security definer set search_path='' as $$
  select s.id,t.title,s.finished_at is not null,
    max(g.started_at) filter(where g.ended_at is null),
    coalesce(sum(extract(epoch from g.ended_at-g.started_at)),0)::integer,
    s.account_id=app_private.current_account_id()
  from public.timer_sessions s join public.tasks t on t.id=s.task_id
  left join public.timer_segments g on g.session_id=s.id
  where s.consolidated_at is null and (
    (s.account_id=app_private.current_account_id() and app_private.can_work_task(t))
    or (s.finished_at is not null and app_private.can_review_task(t)))
  group by s.id,t.title;
$$;

revoke all on function app_private.can_work_task(public.tasks),app_private.can_review_task(public.tasks),
  app_private.stop_task_timers() from public,anon,authenticated;
grant execute on function app_private.can_review_task(public.tasks) to authenticated;
revoke all on function public.set_hours_preferences(text),public.set_generic_task(uuid,boolean),
  public.review_hours(date,uuid),public.manage_timer(text,uuid,uuid,text,boolean),public.hours_timers()
  from public,anon,authenticated;
grant execute on function public.set_hours_preferences(text),public.set_generic_task(uuid,boolean),
  public.review_hours(date,uuid),public.manage_timer(text,uuid,uuid,text,boolean),public.hours_timers() to authenticated;
commit;
