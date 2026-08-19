-- Domain grouping for company leaderboards (equality + index, not LIKE).

alter table public.snake_scores
  add column email_domain text generated always as (
    lower(split_part(teammate_email, '@', 2))
  ) stored;

alter table public.snake_scores
  alter column email_domain set not null;

create index snake_scores_domain_best_idx
  on public.snake_scores (email_domain, best_score desc, updated_at asc);
