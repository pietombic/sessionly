-- Distingue le sessioni create manualmente da quelle generate dal Piano AI.
-- Gli eventi esistenti vengono considerati manuali per evitare cancellazioni
-- accidentali durante la prima applicazione della migrazione.
alter table public.events
  add column if not exists origin text not null default 'manual';

alter table public.event_tasks
  add column if not exists event_id uuid references public.events(id) on delete cascade;

alter table public.event_tasks
  add column if not exists scheduled_time time;

alter table public.event_tasks
  alter column ref_key drop not null;

alter table public.events
  drop constraint if exists events_origin_check;

alter table public.events
  add constraint events_origin_check check (origin in ('manual', 'ai'));

create index if not exists events_user_origin_idx
  on public.events (user_id, origin, status);

create or replace function public.replace_ai_plan(
  p_picks jsonb,
  p_windows jsonb,
  p_events jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Non autenticato';
  end if;

  delete from public.exam_date_picks where user_id = v_user;
  delete from public.study_windows where user_id = v_user;
  delete from public.events
    where user_id = v_user and origin = 'ai' and status = 'planned';

  insert into public.exam_date_picks (user_id, exam_id, component_name, pick_date)
  select
    v_user,
    item->>'examId',
    item->>'componentName',
    (item->>'date')::date
  from jsonb_array_elements(coalesce(p_picks, '[]'::jsonb)) item;

  insert into public.study_windows (
    user_id, exam_id, start_date, end_date, label, completed
  )
  select
    v_user,
    item->>'examId',
    (item->>'start')::date,
    (item->>'end')::date,
    coalesce(item->>'label', ''),
    false
  from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb)) item;

  insert into public.events (
    user_id, exam_id, type, title, start_time, end_time, status, notes, origin
  )
  select
    v_user,
    nullif(item->>'exam_id', ''),
    coalesce(item->>'type', 'study'),
    nullif(item->>'title', ''),
    (item->>'start_time')::timestamptz,
    (item->>'end_time')::timestamptz,
    coalesce(item->>'status', 'planned'),
    nullif(item->>'notes', ''),
    'ai'
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) item;
end;
$$;

create or replace function public.clear_ai_plan()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Non autenticato';
  end if;

  delete from public.exam_date_picks where user_id = v_user;
  delete from public.study_windows where user_id = v_user;
  delete from public.events
    where user_id = v_user and origin = 'ai' and status = 'planned';
end;
$$;

create or replace function public.delete_exam_data(p_exam_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Non autenticato';
  end if;

  delete from public.event_tasks
    where user_id = v_user
      and (
        starts_with(coalesce(ref_key, ''), 'exam:' || p_exam_id || ':')
        or event_id in (
          select id from public.events
          where user_id = v_user and exam_id = p_exam_id
        )
      );
  delete from public.events
    where user_id = v_user and exam_id = p_exam_id;
  delete from public.exam_date_picks
    where user_id = v_user and exam_id = p_exam_id;
  delete from public.study_windows
    where user_id = v_user and exam_id = p_exam_id;
  delete from public.exams
    where user_id = v_user and id = p_exam_id;
end;
$$;

create or replace function public.save_exam(
  p_exam_id text,
  p_exam_data jsonb,
  p_task_moves jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  item jsonb;
begin
  if v_user is null then
    raise exception 'Non autenticato';
  end if;

  insert into public.exams (id, user_id, data, updated_at)
  values (p_exam_id, v_user, p_exam_data, now())
  on conflict (id) do update
    set data = excluded.data, updated_at = now()
    where public.exams.user_id = v_user;
  if not found then
    raise exception 'Esame non accessibile';
  end if;

  for item in
    select value from jsonb_array_elements(coalesce(p_task_moves, '[]'::jsonb))
  loop
    if item ? 'deleteComponent' then
      delete from public.exam_date_picks
        where user_id = v_user
          and exam_id = p_exam_id
          and component_name = item->>'deleteComponent';
      delete from public.event_tasks
        where user_id = v_user
          and starts_with(
            coalesce(ref_key, ''),
            'exam:' || p_exam_id || ':' || (item->>'deleteComponent') || ':'
          );
    elsif item ? 'deactivateComponent' then
      delete from public.exam_date_picks
        where user_id = v_user
          and exam_id = p_exam_id
          and component_name = item->>'deactivateComponent';
    end if;
    if item ? 'deleteRef' then
      delete from public.event_tasks
        where user_id = v_user and ref_key = item->>'deleteRef';
      delete from public.exam_date_picks
        where user_id = v_user
          and exam_id = p_exam_id
          and component_name = item->>'oldComponent'
          and pick_date = (item->>'oldDate')::date;
    end if;
    if item->>'oldRef' is distinct from item->>'newRef' then
      update public.event_tasks
        set ref_key = item->>'newRef'
        where user_id = v_user and ref_key = item->>'oldRef';
    end if;
    if item ? 'oldComponent' and item ? 'oldDate' and item ? 'newDate' then
      update public.exam_date_picks
        set
          component_name = coalesce(item->>'newComponent', item->>'oldComponent'),
          pick_date = (item->>'newDate')::date
        where user_id = v_user
          and exam_id = p_exam_id
          and component_name = item->>'oldComponent'
          and pick_date = (item->>'oldDate')::date;
    end if;
  end loop;
end;
$$;

grant execute on function public.replace_ai_plan(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.clear_ai_plan() to authenticated;
grant execute on function public.delete_exam_data(text) to authenticated;
grant execute on function public.save_exam(text, jsonb, jsonb) to authenticated;
