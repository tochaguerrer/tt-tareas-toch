begin;

create sequence app_private.request_reference_seq minvalue 1 maxvalue 999999 no cycle;

alter table public.incoming_requests
  add column reference_number integer not null
    default nextval('app_private.request_reference_seq'::regclass),
  add constraint incoming_requests_reference_unique unique (reference_number);

create function public.submit_external_request_with_reference(
  p_id uuid, p_title text, p_document jsonb, p_attachment_ids uuid[]
) returns text
language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;
begin
  v_id := public.submit_external_request_rich(p_id,p_title,p_document,p_attachment_ids);
  return (
    select lpad(reference_number::text,6,'0')
    from public.incoming_requests
    where id=v_id and requester_user_id=auth.uid()
  );
end;
$$;

revoke all on function public.submit_external_request_with_reference(uuid,text,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.submit_external_request_with_reference(uuid,text,jsonb,uuid[]) to authenticated;

commit;
