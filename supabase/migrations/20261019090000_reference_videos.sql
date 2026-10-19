-- Reference videos: reels and videos the studio points the agents at ("make it like this").
-- The edit engine watches each one (contact sheets, transcript, cut rate, tempo) and Claude
-- breaks it down; the scriptwriter, the motion director, the editor and the sound designer work
-- from the breakdown. A reference belongs to one video, or to every video of a client.

create table public.reference_videos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- null: a reference for all the client's videos.
  video_id uuid references public.videos (id) on delete cascade,
  url text not null,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'vimeo', 'drive', 'file', 'other')),
  -- What the studio wants from it (hook, pacing, captions…) and why, in its own words.
  focus text[] not null default '{}',
  note text,
  status public.agent_status not null default 'queued',
  progress text,
  error text,
  attempts integer not null default 0,
  -- Whether the engine could watch the video itself (YouTube and Vimeo only give their title).
  watched boolean not null default false,
  title text,
  owner text,
  duration real,
  -- Measured: cut rate, shot lengths, speaking rate, tempo, plays.
  stats jsonb,
  -- Claude's breakdown: hook, structure, pacing, captions, graphics, sound, what to borrow.
  analysis jsonb,
  -- Its contact sheets in the references bucket, for the editor and the motion designer to look at.
  sheets text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index reference_videos_client_id_idx on public.reference_videos (client_id, created_at desc);
create index reference_videos_video_id_idx on public.reference_videos (video_id);
create index reference_videos_created_by_idx on public.reference_videos (created_by);
create index reference_videos_queue_idx on public.reference_videos (created_at) where status = 'queued';
-- The same link once per video, and once for the whole client.
create unique index reference_videos_unique_idx on public.reference_videos (client_id, coalesce(video_id, client_id), url);

alter table public.reference_videos enable row level security;

-- The studio reads them; only the server writes them.
create policy "reference_videos: staff read" on public.reference_videos
  for select to authenticated using (
    (select private.my_role()) in ('admin', 'editor') and private.can_access_client(client_id)
  );

-- Contact sheets ("<client_id>/<reference_id>/sheet-1.jpg"): the engine writes them, the app
-- shows them through signed URLs after its own access check.
insert into storage.buckets (id, name, public)
values ('references', 'references', false)
on conflict (id) do nothing;
