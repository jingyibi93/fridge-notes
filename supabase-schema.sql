-- 冰箱便签协同 MVP
-- 用法：在 Supabase 项目的 SQL Editor 里运行。
-- 注意：这是内测原型权限，方便拿链接测试；正式上线前需要改成基于登录用户和家庭成员的 RLS。

create table if not exists public.fridge_states (
  family_code text primary key,
  fridge_name text not null default '小家的冰箱',
  payload jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.fridge_states enable row level security;

drop policy if exists "fridge_states_select_for_test" on public.fridge_states;
drop policy if exists "fridge_states_insert_for_test" on public.fridge_states;
drop policy if exists "fridge_states_update_for_test" on public.fridge_states;

create policy "fridge_states_select_for_test"
on public.fridge_states
for select
to anon
using (true);

create policy "fridge_states_insert_for_test"
on public.fridge_states
for insert
to anon
with check (true);

create policy "fridge_states_update_for_test"
on public.fridge_states
for update
to anon
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fridge_states'
  ) then
    alter publication supabase_realtime add table public.fridge_states;
  end if;
end
$$;
