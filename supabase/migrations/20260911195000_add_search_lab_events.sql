create table if not exists public.search_lab_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('browser_pageview', 'claimed_crawler_request')),
  path text not null check (char_length(path) <= 500),
  referrer_origin text,
  crawler_name text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists search_lab_events_occurred_at_idx on public.search_lab_events (occurred_at desc);
create index if not exists search_lab_events_type_crawler_idx on public.search_lab_events (event_type, crawler_name, occurred_at desc);
create index if not exists search_lab_events_path_idx on public.search_lab_events (path, occurred_at desc);

alter table public.search_lab_events enable row level security;

revoke all on table public.search_lab_events from anon, authenticated;
grant all on table public.search_lab_events to service_role;
grant usage, select on sequence public.search_lab_events_id_seq to service_role;
