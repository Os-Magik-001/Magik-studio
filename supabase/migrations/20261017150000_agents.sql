-- The three agents before the edit:
--   1. brand strategist: client questionnaire -> niche, charte graphique, business and needs
--   2. trend researcher (runs on the edit engine): viral reels in the niche -> key points
--   3. scriptwriter: strategy + trends + brief -> shoot plan, script and the edit prompt

create type public.agent_status as enum ('queued', 'running', 'done', 'failed');

-- What the client told us about their brand, filled in by the client or the studio.
create table public.brand_questionnaires (
  client_id uuid primary key references public.clients (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index brand_questionnaires_submitted_by_idx on public.brand_questionnaires (submitted_by);
create trigger brand_questionnaires_touch before update on public.brand_questionnaires
  for each row execute function private.touch_updated_at();

-- Agent 1's output for a client.
create table public.brand_strategies (
  client_id uuid primary key references public.clients (id) on delete cascade,
  status public.agent_status not null default 'done',
  niche text,
  keywords text[] not null default '{}',
  reference_accounts text[] not null default '{}',
  business text,
  audience text,
  needs text[] not null default '{}',
  pillars jsonb not null default '[]'::jsonb,
  charte jsonb not null default '{}'::jsonb,
  error text,
  updated_at timestamptz not null default now()
);
create trigger brand_strategies_touch before update on public.brand_strategies
  for each row execute function private.touch_updated_at();

-- Agent 2's research runs; the edit engine claims queued ones.
create table public.trend_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  status public.agent_status not null default 'queued',
  hashtags text[] not null default '{}',
  accounts text[] not null default '{}',
  reels jsonb not null default '[]'::jsonb,
  findings jsonb,
  progress text,
  error text,
  attempts integer not null default 0,
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index trend_reports_client_id_idx on public.trend_reports (client_id, created_at desc);
create index trend_reports_requested_by_idx on public.trend_reports (requested_by);
create index trend_reports_queue_idx on public.trend_reports (created_at) where status = 'queued';

-- Agent 3's output lives with the script.
alter table public.scripts
  add column shoot_plan jsonb,
  add column edit_prompt text,
  add column trend_report_id uuid references public.trend_reports (id) on delete set null;
create index scripts_trend_report_id_idx on public.scripts (trend_report_id);

-- When the videographer says all the footage is in (the edit starts then).
alter table public.videos add column footage_complete_at timestamptz;

alter table public.brand_questionnaires enable row level security;
alter table public.brand_strategies enable row level security;
alter table public.trend_reports enable row level security;

-- Questionnaire: the client fills in their own; the studio reads and edits it.
create policy "brand_questionnaires: read" on public.brand_questionnaires
  for select to authenticated using (
    (select private.my_role()) in ('admin', 'editor', 'client') and private.can_access_client(client_id)
  );
create policy "brand_questionnaires: insert" on public.brand_questionnaires
  for insert to authenticated with check (
    (select private.my_role()) in ('admin', 'editor', 'client') and private.can_access_client(client_id)
  );
create policy "brand_questionnaires: update" on public.brand_questionnaires
  for update to authenticated
  using ((select private.my_role()) in ('admin', 'editor', 'client') and private.can_access_client(client_id))
  with check ((select private.my_role()) in ('admin', 'editor', 'client') and private.can_access_client(client_id));

-- Strategy and research: the studio reads them; only the server writes them.
create policy "brand_strategies: staff read" on public.brand_strategies
  for select to authenticated using (
    (select private.my_role()) in ('admin', 'editor', 'videographer') and private.can_access_client(client_id)
  );
create policy "trend_reports: staff read" on public.trend_reports
  for select to authenticated using (
    (select private.my_role()) in ('admin', 'editor') and private.can_access_client(client_id)
  );
