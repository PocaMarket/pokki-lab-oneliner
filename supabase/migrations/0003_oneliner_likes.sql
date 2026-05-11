create table oneliner_likes (
  entry_id uuid not null references oneliner_entries(id) on delete cascade,
  user_id text not null,
  created_at timestamptz default now(),
  primary key (entry_id, user_id)
);

create index oneliner_likes_entry_idx on oneliner_likes (entry_id);

alter table oneliner_likes enable row level security;

create policy "oneliner_likes_select_all"
  on oneliner_likes for select
  using (true);

-- INSERT/DELETE 정책은 만들지 않는다. service_role 우회.
