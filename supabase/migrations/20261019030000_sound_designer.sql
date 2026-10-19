-- Agent 4, the sound designer: the trending sounds the researcher finds, the sound of each
-- version, and the music and sound-effect libraries it searches (the ones built into the
-- engine, listed by the engine itself, and the studio's own folders in Google Drive).

-- The sounds the top reels in the niche use, counted across everything the search found.
alter table public.trend_reports add column audio jsonb not null default '[]'::jsonb;

-- What the sound designer chose for a version: track, alignment, effects, the trend to post
-- with and the credit line the post must carry.
alter table public.versions add column sound jsonb;

create type public.sound_library_kind as enum ('music', 'sfx');

create table public.sound_libraries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.sound_library_kind not null,
  -- builtin: shipped with the engine, which keeps the row up to date. drive: a folder the
  -- studio added; the engine lists and measures its files.
  source text not null default 'drive' check (source in ('builtin', 'drive')),
  drive_folder_id text,
  license text not null default '',
  status public.agent_status not null default 'queued',
  progress text,
  error text,
  file_count integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  check (source = 'builtin' or drive_folder_id is not null)
);
create unique index sound_libraries_name_idx on public.sound_libraries (kind, lower(name));
create index sound_libraries_created_by_idx on public.sound_libraries (created_by);
create index sound_libraries_queue_idx on public.sound_libraries (created_at) where status = 'queued';

-- The files of a Drive library, measured once when it syncs (tempo, sections and drops for
-- music, the peak for an effect).
create table public.sound_files (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.sound_libraries (id) on delete cascade,
  drive_file_id text not null,
  name text not null,
  folder text not null default '',
  duration real not null default 0,
  mood text,
  tags text[] not null default '{}',
  analysis jsonb,
  created_at timestamptz not null default now(),
  unique (library_id, drive_file_id)
);

alter table public.sound_libraries enable row level security;
alter table public.sound_files enable row level security;

-- The studio reads them; only the server writes them.
create policy "sound_libraries: staff read" on public.sound_libraries
  for select to authenticated using ((select private.my_role()) in ('admin', 'editor'));
create policy "sound_files: staff read" on public.sound_files
  for select to authenticated using ((select private.my_role()) in ('admin', 'editor'));
