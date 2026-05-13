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
