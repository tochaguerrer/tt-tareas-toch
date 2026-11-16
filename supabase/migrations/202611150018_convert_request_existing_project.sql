begin;

create or replace function public.convert_request_to_task(
  p_request_id uuid, p_project_id uuid, p_new_project_name text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.incoming_requests;
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

  if p_project_id is null or p_new_project_name is not null then
    raise exception 'Seleccioná un proyecto existente' using errcode = '22023';
  end if;

  perform 1 from public.projects
  where id = p_project_id and client_id = v_request.client_id and is_active for share;
  if not found then raise exception 'Proyecto no disponible' using errcode = '22023'; end if;

  insert into public.tasks (source_request_id, client_id, project_id, title, created_by)
  values (v_request.id, v_request.client_id, p_project_id, v_request.title, auth.uid())
  returning task_number into v_number;
  return v_number;
end;
$$;

commit;
