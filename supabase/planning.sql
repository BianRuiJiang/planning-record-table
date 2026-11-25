-- 规划记录表：只新增独立表，不修改或删除时间追踪已有表。
create table if not exists public.planning_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  weather text,
  mood text,
  reflection text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint planning_days_user_day_unique unique (user_id, day)
);

create table if not exists public.planning_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_id uuid not null references public.planning_days(id) on delete cascade,
  lane text not null,
  title text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  constraint planning_tasks_lane_valid check (lane in ('main', 'flex')),
  constraint planning_tasks_title_valid check (length(btrim(title)) between 1 and 120)
);

create table if not exists public.planning_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_id uuid not null references public.planning_days(id) on delete cascade,
  kind text not null,
  title text not null,
  start_time time,
  end_time time,
  duration_min integer,
  sort_order integer not null default 0,
  source text not null default 'manual',
  source_activity_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint planning_entries_kind_valid check (kind in ('plan', 'actual')),
  constraint planning_entries_source_valid check (source in ('manual', 'imported')),
  constraint planning_entries_title_valid check (length(btrim(title)) between 1 and 120),
  constraint planning_entries_duration_valid check (duration_min is null or duration_min >= 0)
);

create index if not exists planning_tasks_day_lane_sort_idx
  on public.planning_tasks (day_id, lane, sort_order, created_at);

create index if not exists planning_entries_day_kind_sort_idx
  on public.planning_entries (day_id, kind, sort_order, created_at);

create index if not exists planning_entries_day_source_activity_idx
  on public.planning_entries (day_id, source_activity_id);

alter table public.planning_days enable row level security;
alter table public.planning_tasks enable row level security;
alter table public.planning_entries enable row level security;

create policy planning_days_select_own on public.planning_days
  for select to authenticated
  using (auth.uid() = user_id);

create policy planning_days_insert_own on public.planning_days
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy planning_days_update_own on public.planning_days
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy planning_days_delete_own on public.planning_days
  for delete to authenticated
  using (auth.uid() = user_id);

create policy planning_tasks_select_own on public.planning_tasks
  for select to authenticated
  using (auth.uid() = user_id);

create policy planning_tasks_insert_own on public.planning_tasks
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy planning_tasks_update_own on public.planning_tasks
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy planning_tasks_delete_own on public.planning_tasks
  for delete to authenticated
  using (auth.uid() = user_id);

create policy planning_entries_select_own on public.planning_entries
  for select to authenticated
  using (auth.uid() = user_id);

create policy planning_entries_insert_own on public.planning_entries
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy planning_entries_update_own on public.planning_entries
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy planning_entries_delete_own on public.planning_entries
  for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.planning_days from anon, authenticated;
revoke all on public.planning_tasks from anon, authenticated;
revoke all on public.planning_entries from anon, authenticated;

grant select, insert, update, delete on public.planning_days to authenticated;
grant select, insert, update, delete on public.planning_tasks to authenticated;
grant select, insert, update, delete on public.planning_entries to authenticated;
