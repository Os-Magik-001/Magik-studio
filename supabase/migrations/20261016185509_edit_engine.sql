-- Claude editing engine: job bookkeeping and the edit plan behind each version.

alter table public.edit_jobs
  add column started_at timestamptz,
  add column attempts integer not null default 0,
  add column error text,
  add column progress text;

-- The engine's edit decision list for versions it rendered, so a revision can
-- start from the previous cut instead of from scratch.
alter table public.versions add column edit_plan jsonb;

-- Workers claim the oldest queued job; one job per video at a time.
create index edit_jobs_queue_idx on public.edit_jobs (created_at) where status = 'queued';
