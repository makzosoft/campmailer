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


-- ===== v6: tracking, unsubscribe, newsletters =====
create table if not exists track_events (
  id bigint generated always as identity primary key,
  campaign text not null,
  email text not null,
  kind text not null,
  url text,
  at timestamptz not null default now()
);
create index if not exists track_events_campaign_idx on track_events (campaign);

create table if not exists unsubscribes (
  owner text not null,
  email text not null,
  campaign text,
  at timestamptz not null default now(),
  primary key (owner, email)
);

create table if not exists newsletters (
  id text primary key,
  owner text not null,
  name text not null,
  at timestamptz not null default now()
);
create index if not exists newsletters_owner_idx on newsletters (owner);

create table if not exists subscribers (
  list_id text not null,
  email text not null,
  name text,
  at timestamptz not null default now(),
  primary key (list_id, email)
);

alter table track_events enable row level security;
alter table unsubscribes enable row level security;
alter table newsletters enable row level security;
alter table subscribers enable row level security;

-- ===== v7: push notifications =====
create table if not exists push_subs (
  endpoint text primary key,
  owner text not null,
  p256dh text not null,
  auth text not null,
  prefs jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists push_subs_owner_idx on push_subs (owner);
alter table push_subs enable row level security;
