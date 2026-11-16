begin;
alter table public.tasks add column responsible_id uuid references public.app_accounts(id);

create table public.task_status_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id),
  previous_status text,
  status text not null,
  actor_email text,
  created_at timestamptz not null default now()
);
create index task_status_events_task on public.task_status_events(task_id,id);
alter table public.task_status_events enable row level security;
revoke all on public.task_status_events from anon, authenticated;
grant select on public.task_status_events to authenticated;
create policy task_status_events_read on public.task_status_events for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

insert into public.task_status_events(task_id,status,created_at)
select id,status,created_at from public.tasks;

create function app_private.record_task_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.task_status_events(task_id,previous_status,status,actor_email)
    values(new.id,case when tg_op = 'UPDATE' then old.status end,new.status,app_private.google_email());
  end if;
  return new;
end $$;
revoke all on function app_private.record_task_status() from public, anon, authenticated;
create trigger record_task_status after insert or update of status on public.tasks
for each row execute function app_private.record_task_status();

create function public.task_management(p_task_id uuid,p_project_id uuid,p_action text default null,
  p_value text default null,p_expected text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks%rowtype;
  account uuid := app_private.current_account_id();
  manager boolean;
  contract_manager boolean;
  administrator boolean := app_private.is_admin();
  responsible boolean;
  candidate uuid;
  choices jsonb := '[]'::jsonb;
  states text[] := array['pending','in_progress','waiting','resolved'];
begin
  if p_action is null then
    select * into t from public.tasks where id=p_task_id and project_id=p_project_id;
  else
    select * into t from public.tasks where id=p_task_id and project_id=p_project_id for update;
  end if;
  if t.id is null or account is null then raise exception 'Task management denied'; end if;
  select exists(select 1 from public.access_grants g where g.account_id=account
    and g.role='account_manager' and g.client_id=t.client_id) into manager;
  select exists(select 1 from public.access_grants g where g.account_id=account
    and g.role='client_contract_admin' and g.client_id=t.client_id) into contract_manager;
  responsible := t.responsible_id is not distinct from account and exists(
    select 1 from public.access_grants g where g.account_id=account
      and g.role='collaborator' and g.project_id=t.project_id);
  if not (manager or administrator or responsible or contract_manager) then raise exception 'Task management denied'; end if;

  if t.status='cancelled' or (t.status='closed' and not (manager or administrator)) then
    states := array[]::text[];
  elsif not (manager or administrator or responsible) then
    states := array[]::text[];
  end if;

  if contract_manager and t.status not in ('closed','cancelled') then
    states := array_append(states,'closed');
  end if;

  if p_action='status' then
    if p_expected is distinct from t.status then raise exception 'Task changed'; end if;
    if p_value is null or not (p_value=any(states)) or p_value=t.status then
      raise exception 'Task management denied';
    end if;
    update public.tasks set status=p_value where id=t.id;
    return '{}'::jsonb;
  elsif p_action='assign' then
    if not (administrator or manager) or t.status in ('closed','cancelled') then
      raise exception 'Task management denied';
    end if;
    if p_expected is distinct from coalesce(t.responsible_id::text,'') then raise exception 'Task changed'; end if;
    candidate := p_value::uuid;
    if not exists(select 1 from public.access_grants g join public.app_accounts a on a.id=g.account_id
      where a.id=candidate and a.is_active and g.role='collaborator' and g.project_id=t.project_id)
    then raise exception 'Invalid responsible'; end if;
    update public.tasks set responsible_id=candidate where id=t.id;
    return '{}'::jsonb;
  elsif p_action is not null then
    raise exception 'Task management denied';
  end if;

  if (administrator or manager) and t.status not in ('closed','cancelled') then
    select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'email',a.email) order by a.email),'[]'::jsonb)
    into choices from public.access_grants g join public.app_accounts a on a.id=g.account_id
    where a.is_active and g.role='collaborator' and g.project_id=t.project_id;
  end if;
  return jsonb_build_object('choices',choices,'states',array_remove(states,t.status),
    'responsible',t.responsible_id,'canAssign',(administrator or manager) and t.status not in ('closed','cancelled'));
end $$;
revoke all on function public.task_management(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.task_management(uuid,uuid,text,text,text) to authenticated;
commit;
