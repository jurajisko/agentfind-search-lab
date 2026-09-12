-- Widens telemetry from "known crawlers only" to "every request, classified".
-- Existing rows keep their event_type and simply have null in the new columns.

alter table public.search_lab_events
  drop constraint if exists search_lab_events_event_type_check;

alter table public.search_lab_events
  add constraint search_lab_events_event_type_check
  check (event_type in ('browser_pageview', 'claimed_crawler_request', 'observed_request'));

-- How the agent was classified when no known crawler name matched.
alter table public.search_lab_events
  add column if not exists agent_class text
  check (agent_class is null or agent_class in (
    'known_crawler', 'likely_automation', 'browser_like', 'no_user_agent', 'unknown'
  ));

-- What kind of resource was requested. Assets matter: an agent that never
-- asks for the stylesheet did not render the page.
alter table public.search_lab_events
  add column if not exists resource_kind text;

create index if not exists search_lab_events_agent_class_idx
  on public.search_lab_events (agent_class, occurred_at desc);
create index if not exists search_lab_events_resource_kind_idx
  on public.search_lab_events (resource_kind, occurred_at desc);
create index if not exists search_lab_events_user_agent_idx
  on public.search_lab_events (user_agent, occurred_at desc);
