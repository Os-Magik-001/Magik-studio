-- The scriptwriter's thread on each video: every version of the script (script, shot list,
-- shoot plan, edit prompt) with what was asked for and what the scriptwriter answered.
-- The studio asks for changes there and can go back to any version; the agents read it to
-- remember what was asked on a client's earlier videos.

create type public.script_revision_kind as enum (
  'written',  -- the scriptwriter drafted it
  'revised',  -- the scriptwriter changed it on request
  'edited',   -- someone saved it by hand
  'pasted',   -- the studio's own script, through the fast track
  'restored', -- an earlier version came back
  'client'    -- the client asked for changes (no new version)
);

create table public.script_revisions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  kind public.script_revision_kind not null,
  request text,
  reply text,
  -- The version itself; empty on 'client' entries.
  body text,
  shot_list jsonb,
  shoot_plan jsonb,
  edit_prompt text,
  restored_from uuid references public.script_revisions (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index script_revisions_video_id_idx on public.script_revisions (video_id, created_at);
create index script_revisions_restored_from_idx on public.script_revisions (restored_from);
create index script_revisions_created_by_idx on public.script_revisions (created_by);

alter table public.script_revisions enable row level security;

-- The studio reads the thread (it holds internal notes and edit prompts); only the server writes it.
create policy "script_revisions: staff read" on public.script_revisions
  for select to authenticated using (
    (select private.my_role()) in ('admin', 'editor') and private.can_access_video(video_id)
  );
