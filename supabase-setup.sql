-- Run once in Supabase: SQL Editor > New query > paste > Run

create table if not exists kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists kv_sets (
  set_key text not null,
  member text not null,
  primary key (set_key, member)
);

-- Lock these tables so only the server (service role key) can touch them.
-- With RLS on and no policies, the public anon key gets zero access.
alter table kv enable row level security;
alter table kv_sets enable row level security;
