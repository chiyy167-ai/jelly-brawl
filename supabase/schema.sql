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

-- 账号资料：游戏昵称 + 等级（等级仍在本机结算，登录后上传）
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null default '果冻玩家'
    check (char_length(nickname) >= 1 and char_length(nickname) <= 10),
  level int not null default 1 check (level >= 1),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 新用户自动建空资料行
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, nickname)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(new.raw_user_meta_data->>'name'), ''),
        split_part(coalesce(new.email, '果冻玩家'), '@', 1),
        '果冻玩家'
      ),
      10
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
