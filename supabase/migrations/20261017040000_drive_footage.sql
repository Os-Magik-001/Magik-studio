-- Footage can live in Google Drive instead of Storage: camera files are often far
-- bigger than a Storage upload allows. The engine reads Drive files with a service
-- account the folder is shared with.

create type public.footage_source as enum ('upload', 'drive');

alter table public.footage
  add column source public.footage_source not null default 'upload',
  add column drive_file_id text,
  add column drive_url text,
  alter column storage_path drop not null,
  add constraint footage_source_location check (
    (source = 'upload' and storage_path is not null)
    or (source = 'drive' and drive_file_id is not null)
  );

-- The same Drive file can't be added to a video twice.
create unique index footage_video_drive_file_idx on public.footage (video_id, drive_file_id)
  where drive_file_id is not null;
