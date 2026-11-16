begin;

alter table public.time_entries
  drop constraint time_entries_detail_check,
  add constraint time_entries_detail_check check (
    length(btrim(detail)) <= 5000
    and (timer_session_id is null or length(btrim(detail)) > 0)
  );

commit;
