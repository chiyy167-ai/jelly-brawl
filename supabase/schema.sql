-- 在 Supabase 控制台 → SQL Editor 里整段执行一次
-- 邮箱注册用 Auth；战绩表用 Row Level Security，每人只能读写自己的

create table if not exists public.match_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  played_at timestamptz not null default now(),
  mode text not null check (mode in ('match', 'practice', 'online')),
  rank int not null check (rank >= 1),
  total int not null check (total >= 1),
  score int not null default 0,
  kos int not null default 0
);

create index if not exists match_history_user_played_idx
  on public.match_history (user_id, played_at desc);

alter table public.match_history enable row level security;

drop policy if exists "match_history_select_own" on public.match_history;
create policy "match_history_select_own"
  on public.match_history for select
  using (auth.uid() = user_id);

drop policy if exists "match_history_insert_own" on public.match_history;
create policy "match_history_insert_own"
  on public.match_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "match_history_delete_own" on public.match_history;
create policy "match_history_delete_own"
  on public.match_history for delete
  using (auth.uid() = user_id);
