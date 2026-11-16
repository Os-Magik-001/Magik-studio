-- White label, step 3: the edit engine works for several agencies. Each agency has a limit on
-- the edits it runs at once (the engine takes turns between agencies) and the built-in sound
-- sets it may use; and what an agency uses is counted (AI tokens, edits, research runs), for
-- its plan and its bill.

alter table public.agencies
  add column max_running_edits integer not null default 1 check (max_running_edits between 1 and 8),
  -- The engine's built-in sound sets this agency may use (studio, freepd, mixkit, incompetech).
  -- A new agency starts with the two whose licences allow anyone to use them.
  add column sound_sets text[] not null default '{freepd,incompetech}';
update public.agencies set sound_sets = '{studio,freepd,mixkit,incompetech}', max_running_edits = 2 where slug = 'magik';

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete restrict,
  -- ai_tokens: quantity = tokens in + out (detail has the split). edits: one finished edit
  -- (detail: its length and how long the engine worked). scrape_runs: one run of a scraper.
  kind text not null check (kind in ('ai_tokens', 'edits', 'scrape_runs')),
  quantity numeric not null check (quantity >= 0),
  source text not null check (source in ('engine', 'app')),
  -- Which agent or step: "edit plan", "sound", "scriptwriter"...
  what text,
  model text,
  detail jsonb not null default '{}',
  client_id uuid references public.clients (id) on delete set null,
  video_id uuid references public.videos (id) on delete set null,
  created_at timestamptz not null default now()
);
create index usage_events_agency_created_idx on public.usage_events (agency_id, created_at);
create index usage_events_client_id_idx on public.usage_events (client_id);
create index usage_events_video_id_idx on public.usage_events (video_id);
create trigger usage_events_set_agency before insert or update on public.usage_events
  for each row execute function private.set_agency('videos:video_id', 'clients:client_id');

alter table public.usage_events enable row level security;
create policy "usage_events: own agency" on public.usage_events as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
-- Written by the server and the engine; the studio manager reads their own agency's.
create policy "usage_events: studio managers read" on public.usage_events for select to authenticated
  using ((select private.my_role()) = 'admin');
