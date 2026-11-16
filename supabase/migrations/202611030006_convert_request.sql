begin;

alter table public.incoming_requests add unique (id, client_id);
alter table public.projects add unique (id, client_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_number bigint generated always as identity unique,
  source_request_id uuid not null unique,
  client_id uuid not null,
  project_id uuid not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','waiting','resolved','closed','cancelled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (source_request_id, client_id) references public.incoming_requests(id, client_id),
  foreign key (project_id, client_id) references public.projects(id, client_id)
);

alter table public.tasks enable row level security;
revoke all on public.tasks from public, anon, authenticated;
grant select on public.tasks to authenticated;
create policy tasks_read_scope on public.tasks for select to authenticated
  using (app_private.can_read_project(project_id, client_id));

create function public.convert_request_to_task(
  p_request_id uuid, p_project_id uuid, p_new_project_name text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.incoming_requests;
  v_project_id uuid;
  v_number bigint;
begin
  select * into v_request from public.incoming_requests where id = p_request_id for update;
  if not found or not (app_private.is_admin() or exists (
    select 1 from public.access_grants
    where account_id = app_private.current_account_id()
      and role = 'account_manager' and client_id = v_request.client_id
  )) then
    raise exception 'Solicitud no disponible' using errcode = '42501';
  end if;

  select task_number into v_number from public.tasks where source_request_id = p_request_id;
  if found then return v_number; end if;

  perform 1 from public.clients where id = v_request.client_id and is_active for share;
  if not found then raise exception 'Cliente inactivo' using errcode = '22023'; end if;

  if p_project_id is not null and p_new_project_name is null then
    select id into v_project_id from public.projects
    where id = p_project_id and client_id = v_request.client_id and is_active for share;
    if not found then raise exception 'Proyecto no disponible' using errcode = '22023'; end if;
  elsif p_project_id is null and length(btrim(p_new_project_name)) between 1 and 200 then
    insert into public.projects (client_id, name)
    values (v_request.client_id, btrim(p_new_project_name)) returning id into v_project_id;
  else
    raise exception 'Seleccioná o creá un proyecto' using errcode = '22023';
  end if;

  insert into public.tasks (source_request_id, client_id, project_id, title, created_by)
  values (v_request.id, v_request.client_id, v_project_id, v_request.title, auth.uid())
  returning task_number into v_number;
  return v_number;
end;
$$;

revoke all on function public.convert_request_to_task(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.convert_request_to_task(uuid,uuid,text) to authenticated;

commit;
