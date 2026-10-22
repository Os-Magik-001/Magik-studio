-- Production: once a client is onboarded, the studio's agents run in the background.
--   agent_runs: one queue for the agents that live in the app (the brand strategist, the content
--   planner, the scriptwriter, the motion director). A worker claims a run, does it and records
--   what it made; the pages read the queue to show who is working on what. The edit engine keeps
--   its own queues (edit_jobs, trend_reports, reference_videos).
--   scripts.beats: the script as numbered beats (time, what we see, what's said, words on
--   screen), so everyone reads it the same way and it prints as a clean PDF.

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  video_id uuid references public.videos (id) on delete cascade,
  agent text not null check (agent in ('strategist', 'planner', 'scriptwriter', 'motion')),
  status public.agent_status not null default 'queued',
  -- What the run was asked (e.g. how many videos to plan, notes for the scriptwriter).
  input jsonb not null default '{}'::jsonb,
  -- What it made, when it isn't saved elsewhere (the content plan's ideas).
  output jsonb,
  progress text,
  error text,
  attempts integer not null default 0,
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index agent_runs_client_id_idx on public.agent_runs (client_id, created_at desc);
create index agent_runs_video_id_idx on public.agent_runs (video_id);
create index agent_runs_requested_by_idx on public.agent_runs (requested_by);
create index agent_runs_queue_idx on public.agent_runs (created_at) where status = 'queued';

alter table public.agent_runs enable row level security;
revoke all on public.agent_runs from anon;

-- The studio reads its clients' runs; only the server writes them.
create policy "agent_runs: staff read" on public.agent_runs
  for select to authenticated using (
    (select private.my_role()) in ('admin', 'editor') and private.can_access_client(client_id)
  );

-- A worker claims the oldest queued run (or one given run): one worker per run.
create function public.claim_agent_run(run uuid default null) returns setof public.agent_runs
language sql security definer set search_path = '' as $$
  update public.agent_runs r
     set status = 'running', started_at = now(), attempts = r.attempts + 1, progress = null, error = null
   where r.id = (
     select q.id from public.agent_runs q
      where q.status = 'queued' and (run is null or q.id = run)
      order by q.created_at
      limit 1
      for update skip locked
   )
  returning r.*;
$$;
revoke all on function public.claim_agent_run(uuid) from public, anon, authenticated;
grant execute on function public.claim_agent_run(uuid) to service_role;

alter table public.scripts add column beats jsonb;
alter table public.script_revisions add column beats jsonb;

-- Production news about a client (the strategy is ready, the month is planned) links to the
-- client's page.
alter table public.notifications add column client_id uuid references public.clients (id) on delete cascade;
create index notifications_client_id_idx on public.notifications (client_id);

-- The videographer reads the script from the day it goes to the client, like the client, so a
-- shoot day can be planned before every script is approved (it used to open on approval).
drop policy "scripts: read" on public.scripts;
create policy "scripts: read" on public.scripts
  for select to authenticated using (
    private.can_access_video(video_id) and case (select private.my_role())
      when 'client' then status in ('client_review', 'changes_requested', 'approved')
      when 'videographer' then status in ('client_review', 'changes_requested', 'approved')
      else true
    end
  );
