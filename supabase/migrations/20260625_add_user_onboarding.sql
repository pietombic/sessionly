create table if not exists public.user_preferences (
  user_id                 uuid        primary key references auth.users on delete cascade,
  onboarding_completed    boolean     not null default false,
  onboarding_completed_at timestamptz,
  updated_at              timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "Preferenze utente: accesso owner" on public.user_preferences;
create policy "Preferenze utente: accesso owner"
  on public.user_preferences for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
