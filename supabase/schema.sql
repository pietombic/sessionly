-- ============================================================
-- organizza·esami — schema Supabase
-- Esegui questo script nell'SQL editor del dashboard Supabase
-- ============================================================

-- Tabella esami (dati completi in JSONB per semplicità)
create table if not exists public.exams (
  id          text        primary key,
  user_id     uuid        not null references auth.users on delete cascade,
  data        jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tabella finestre di studio generate dall'AI
create table if not exists public.study_windows (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  exam_id     text,
  start_date  date        not null,
  end_date    date        not null,
  label       text        not null default '',
  created_at  timestamptz not null default now()
);

-- ── Indici ───────────────────────────────────────────────────────────────────
create index if not exists exams_user_id_idx         on public.exams(user_id);
create index if not exists study_windows_user_id_idx  on public.study_windows(user_id);
create index if not exists study_windows_exam_id_idx  on public.study_windows(exam_id);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.exams          enable row level security;
alter table public.study_windows  enable row level security;

-- Ogni utente vede e modifica solo i propri dati
create policy "Esami: accesso owner"
  on public.exams for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Finestre studio: accesso owner"
  on public.study_windows for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Trigger updated_at ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists exams_updated_at on public.exams;
create trigger exams_updated_at
  before update on public.exams
  for each row execute function public.set_updated_at();

-- ── Piano AI: date scelte dall'AI per ogni componente di ogni esame ──────────

create table if not exists public.exam_date_picks (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users on delete cascade,
  exam_id        text        not null,
  component_name text        not null,
  pick_date      date        not null,
  created_at     timestamptz not null default now()
);

create index if not exists exam_date_picks_user_id_idx on public.exam_date_picks(user_id);
create index if not exists exam_date_picks_exam_id_idx on public.exam_date_picks(exam_id);

alter table public.exam_date_picks enable row level security;

create policy "Date picks: accesso owner"
  on public.exam_date_picks for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Aggiunge completed a study_windows (per marcare blocchi di studio) ───────
alter table public.study_windows add column if not exists completed boolean not null default false;

-- ── Rate limiting per utente ─────────────────────────────────────────────────

create table if not exists public.api_rate_limits (
  user_id     uuid  primary key references auth.users on delete cascade,
  calls_today integer not null default 0,
  reset_date  date    not null default current_date
);

alter table public.api_rate_limits enable row level security;

-- Gli utenti possono leggere solo il proprio contatore (utile per mostrarlo in UI)
create policy "Rate limits: lettura owner"
  on public.api_rate_limits for select
  using (auth.uid() = user_id);

-- Scrittura consentita solo alla funzione SECURITY DEFINER (non al client diretto)

-- ── Preferenze utente / onboarding ──────────────────────────────────────────

create table if not exists public.user_preferences (
  user_id                 uuid        primary key references auth.users on delete cascade,
  onboarding_completed    boolean     not null default false,
  onboarding_completed_at timestamptz,
  updated_at              timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Preferenze utente: accesso owner"
  on public.user_preferences for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists user_preferences_updated_at on public.user_preferences;
create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- Funzione atomica: resetta il contatore se il giorno è cambiato,
-- poi controlla il limite e incrementa solo se consentito.
create or replace function public.check_and_increment_rate_limit(
  p_user_id uuid,
  p_limit   integer default 30
)
returns table(allowed boolean, calls_used integer)
language plpgsql security definer as $$
declare
  v_calls integer;
begin
  -- Assicura che la riga esista
  insert into public.api_rate_limits (user_id, calls_today, reset_date)
  values (p_user_id, 0, current_date)
  on conflict (user_id) do nothing;

  -- Resetta se il giorno è cambiato, recupera il contatore attuale
  update public.api_rate_limits
  set
    calls_today = case when reset_date < current_date then 0 else calls_today end,
    reset_date  = current_date
  where user_id = p_user_id
  returning calls_today into v_calls;

  -- Limite raggiunto: non incrementare
  if v_calls >= p_limit then
    return query select false, v_calls;
    return;
  end if;

  -- Incrementa
  update public.api_rate_limits
  set calls_today = calls_today + 1
  where user_id = p_user_id
  returning calls_today into v_calls;

  return query select true, v_calls;
end;
$$;

-- ── Tabella eventi (sessioni di studio, pause, ripasso) ──────────────────────
-- exam_id è text per corrispondere a exams.id (text, non uuid)
-- duration_min è colonna generata: non includerla nelle INSERT

create table if not exists public.events (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users on delete cascade,
  exam_id      text        references public.exams(id) on delete cascade, -- null per le pause
  type         text        not null check (type in ('study', 'break', 'review')),
  title        text,
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  duration_min integer     generated always as
               ((extract(epoch from (end_time - start_time)) / 60)::integer) stored,
  status       text        not null default 'planned'
               check (status in ('planned', 'completed', 'skipped')),
  origin       text        not null default 'manual'
               check (origin in ('manual', 'ai')),
  notes        text,
  created_at   timestamptz not null default now(),
  constraint events_valid_interval check (end_time > start_time)
);

alter table public.events
  add column if not exists origin text not null default 'manual';

alter table public.events
  drop constraint if exists events_origin_check;

alter table public.events
  add constraint events_origin_check check (origin in ('manual', 'ai'));

create index if not exists events_user_date_idx   on public.events (user_id, start_time);
create index if not exists events_exam_id_idx     on public.events (exam_id) where exam_id is not null;
create index if not exists events_user_status_idx on public.events (user_id, status, type);
create index if not exists events_user_origin_idx on public.events (user_id, origin, status);

alter table public.events enable row level security;

create policy "Events: accesso owner"
  on public.events for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Event tasks (todo list per eventi e blocchi studio) ──────────────────────
-- ref_key: "sw:{study_window_uuid}" oppure "exam:{examId}:{componentName}:{YYYY-MM-DD}"

CREATE TABLE IF NOT EXISTS public.event_tasks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  ref_key     text        NOT NULL,
  text        text        NOT NULL,
  completed   boolean     NOT NULL DEFAULT false,
  position    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_tasks_user_ref_idx ON public.event_tasks(user_id, ref_key);
ALTER TABLE public.event_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event tasks: accesso owner"
  ON public.event_tasks FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Aggiunge colonna notes a study_windows (per descrizione editabile)
ALTER TABLE public.study_windows ADD COLUMN IF NOT EXISTS notes text;

-- ── Migrazione: task per singola sessione ────────────────────────────────────
-- Le sessioni di studio sono ora righe indipendenti in `events`. I task si
-- legano alla singola sessione tramite `event_id` (non più al ref_key
-- condiviso "sw:{window}"), così non si propagano fra giorni dello stesso esame.
ALTER TABLE public.event_tasks
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;

-- Orario opzionale del singolo task all'interno della sessione/evento.
ALTER TABLE public.event_tasks
  ADD COLUMN IF NOT EXISTS scheduled_time time;

CREATE INDEX IF NOT EXISTS event_tasks_event_idx ON public.event_tasks(event_id);

-- ref_key resta solo per i task legati alle date d'esame ("exam:..."), quindi
-- non è più obbligatorio (i task di sessione usano event_id).
ALTER TABLE public.event_tasks ALTER COLUMN ref_key DROP NOT NULL;

-- ── Sostituzione atomica del Piano AI ───────────────────────────────────────

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
  if v_user is null then raise exception 'Non autenticato'; end if;

  delete from public.exam_date_picks where user_id = v_user;
  delete from public.study_windows where user_id = v_user;
  delete from public.events
    where user_id = v_user and origin = 'ai' and status = 'planned';

  insert into public.exam_date_picks (user_id, exam_id, component_name, pick_date)
  select v_user, item->>'examId', item->>'componentName', (item->>'date')::date
  from jsonb_array_elements(coalesce(p_picks, '[]'::jsonb)) item;

  insert into public.study_windows (user_id, exam_id, start_date, end_date, label, completed)
  select v_user, item->>'examId', (item->>'start')::date, (item->>'end')::date,
         coalesce(item->>'label', ''), false
  from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb)) item;

  insert into public.events (
    user_id, exam_id, type, title, start_time, end_time, status, notes, origin
  )
  select v_user, nullif(item->>'exam_id', ''), coalesce(item->>'type', 'study'),
         nullif(item->>'title', ''), (item->>'start_time')::timestamptz,
         (item->>'end_time')::timestamptz, coalesce(item->>'status', 'planned'),
         nullif(item->>'notes', ''), 'ai'
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
  if v_user is null then raise exception 'Non autenticato'; end if;
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
  if v_user is null then raise exception 'Non autenticato'; end if;
  delete from public.event_tasks
    where user_id = v_user
      and (
        starts_with(coalesce(ref_key, ''), 'exam:' || p_exam_id || ':')
        or event_id in (
          select id from public.events
          where user_id = v_user and exam_id = p_exam_id
        )
      );
  delete from public.events where user_id = v_user and exam_id = p_exam_id;
  delete from public.exam_date_picks where user_id = v_user and exam_id = p_exam_id;
  delete from public.study_windows where user_id = v_user and exam_id = p_exam_id;
  delete from public.exams where user_id = v_user and id = p_exam_id;
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
  if v_user is null then raise exception 'Non autenticato'; end if;
  insert into public.exams (id, user_id, data, updated_at)
  values (p_exam_id, v_user, p_exam_data, now())
  on conflict (id) do update
    set data = excluded.data, updated_at = now()
    where public.exams.user_id = v_user;
  if not found then raise exception 'Esame non accessibile'; end if;
  for item in
    select value from jsonb_array_elements(coalesce(p_task_moves, '[]'::jsonb))
  loop
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
