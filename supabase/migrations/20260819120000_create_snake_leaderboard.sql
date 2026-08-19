-- Reconstruct: supabase db push / apply this migration on a new project.

create table public.snake_sessions (
  id uuid primary key default gen_random_uuid(),
  teammate_email text not null,
  seed bigint not null,
  started_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index snake_sessions_email_started_idx
  on public.snake_sessions (teammate_email, started_at desc);

create table public.snake_scores (
  teammate_email text primary key,
  display_name text not null,
  best_score integer not null check (best_score >= 0),
  updated_at timestamptz not null default now()
);

alter table public.snake_sessions enable row level security;
alter table public.snake_scores enable row level security;

create policy snake_scores_select_public
  on public.snake_scores
  for select
  to anon, authenticated
  using (true);
