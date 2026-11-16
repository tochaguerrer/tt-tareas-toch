begin;

create or replace function public.task_management(p_task_id uuid,p_project_id uuid,p_action text default null,
  p_value text default null,p_expected text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks%rowtype;
  account uuid := app_private.current_account_id();
  manager boolean;
  contract_manager boolean;
  administrator boolean := app_private.is_admin();
  responsible boolean;
  collaborator boolean;
  can_take boolean;
  candidate uuid;
  choices jsonb := '[]'::jsonb;
  states text[] := array[]::text[];
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
  collaborator := administrator or exists(select 1 from public.access_grants g where g.account_id=account
    and g.role='collaborator' and g.project_id=t.project_id);
  responsible := collaborator and t.responsible_id is not distinct from account;
  can_take := collaborator and t.status='pending' and t.responsible_id is null;
  if not (manager or administrator or collaborator or contract_manager) then
    raise exception 'Task management denied';
  end if;

  if (manager or administrator or responsible) and t.responsible_id is not null then
    case t.status
      when 'development' then states := array['test','client_query'];
      when 'test', 'client_query' then states := array['development'];
      when 'closed' then
        if manager or administrator then states := array['development']; end if;
      else null;
    end case;
  elsif (manager or administrator) and t.status='closed' then
    states := array['pending'];
  end if;

  if (contract_manager or administrator) and t.status not in ('closed','cancelled') then
    states := array_append(states,'closed');
  end if;

  if p_action='status' then
    if p_expected is distinct from t.status then raise exception 'Task changed'; end if;
    if p_value is null or not (p_value=any(states)) or p_value=t.status then
      raise exception 'Task management denied';
    end if;
    update public.tasks set status=p_value where id=t.id;
    return '{}'::jsonb;
  elsif p_action='take' then
    if not can_take then raise exception 'Task management denied'; end if;
    update public.tasks set responsible_id=account,status='development' where id=t.id;
    return '{}'::jsonb;
  elsif p_action='assign' then
    if not (administrator or manager) or t.status in ('closed','cancelled') then
      raise exception 'Task management denied';
    end if;
    if p_expected is distinct from coalesce(t.responsible_id::text,'') then raise exception 'Task changed'; end if;
    candidate := p_value::uuid;
    if not exists(select 1 from public.app_accounts a where a.id=candidate and a.is_active and exists (
      select 1 from public.access_grants g where g.account_id=a.id
        and ((g.role='collaborator' and g.project_id=t.project_id) or (administrator and g.role='toch_admin'))
    ))
    then raise exception 'Invalid responsible'; end if;
    update public.tasks set responsible_id=candidate,
      status=case when t.status='pending' then 'development' else t.status end where id=t.id;
    return '{}'::jsonb;
  elsif p_action is not null then
    raise exception 'Task management denied';
  end if;

  if (administrator or manager) and t.status not in ('closed','cancelled') then
    select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'email',a.email) order by a.email),'[]'::jsonb)
    into choices from public.app_accounts a
    where a.is_active and exists (
      select 1 from public.access_grants g where g.account_id=a.id
        and ((g.role='collaborator' and g.project_id=t.project_id) or (administrator and g.role='toch_admin'))
    );
  end if;
  return jsonb_build_object('choices',choices,'states',array_remove(states,t.status),
    'responsible',t.responsible_id,'canTake',can_take,'canAssign',(administrator or manager) and t.status not in ('closed','cancelled'));
end $$;

commit;
