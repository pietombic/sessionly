alter table public.event_tasks
  add column if not exists scheduled_time time;
