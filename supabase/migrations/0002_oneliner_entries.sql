create table oneliner_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  text text not null check (length(trim(text)) between 1 and 200),
  created_at timestamptz default now()
);

create index oneliner_entries_feed_idx on oneliner_entries (created_at desc, id desc);

alter table oneliner_entries enable row level security;

create policy "oneliner_entries_select_all"
  on oneliner_entries for select
  using (true);

-- INSERT/UPDATE/DELETE 정책은 만들지 않는다.
-- 모든 쓰기는 service_role 키로 RLS를 우회하는 API route에서만 처리한다.
