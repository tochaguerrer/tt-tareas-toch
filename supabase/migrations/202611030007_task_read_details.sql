begin;

create function public.read_task_content(p_task_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'description', r.description,
    'description_document', r.description_document,
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'filename', a.filename) order by a.filename)
      from public.request_attachments a
      where a.request_id = r.id and a.client_id = t.client_id and a.submitted
    ), '[]'::jsonb)
  )
  from public.tasks t
  join public.incoming_requests r on r.id = t.source_request_id and r.client_id = t.client_id
  where t.id = p_task_id and app_private.can_read_project(t.project_id, t.client_id);
$$;
revoke all on function public.read_task_content(uuid) from public, anon, authenticated;
grant execute on function public.read_task_content(uuid) to authenticated;

create or replace function app_private.can_read_request_attachment(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.request_attachments a where a.id = p_id and (
      (not a.submitted and a.uploader_id = auth.uid() and a.client_id = app_private.requester_client_id())
      or (a.submitted and (
        app_private.is_admin()
        or exists (
          select 1 from public.access_grants g
          where g.account_id = app_private.current_account_id()
            and g.role in ('account_manager', 'client_contract_admin') and g.client_id = a.client_id
        )
        or exists (
          select 1 from public.tasks t
          where t.source_request_id = a.request_id and t.client_id = a.client_id
            and app_private.can_read_project(t.project_id, t.client_id)
        )
      ))
    )
  );
$$;

commit;
