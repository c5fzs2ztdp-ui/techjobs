-- Daily new-jobs alert. Run once in Supabase before enabling ALERTS_ENABLED.
create table if not exists alert_subscriptions (
  id uuid primary key,
  email text not null unique,
  active boolean not null default true,
  unsubscribe_token text not null unique,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- Single-row key/value store for the feed snapshot used by the daily diff.
create table if not exists alert_state (
  key text primary key,
  value jsonb not null
);
