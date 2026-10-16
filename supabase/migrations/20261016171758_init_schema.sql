-- Magik OS v1 schema.
-- Roles: admin (studio manager), editor, videographer, client.
-- Reads are guarded by RLS. Workflow transitions (send to client, approve,
-- new versions, notifications) run in server actions with the secret key
-- after an explicit permission check, so most tables have no write policies
-- for end users.

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'editor', 'videographer', 'client');

create type public.video_status as enum (
  'script', 'shoot', 'footage_in', 'editing', 'editor_check',
  'client_review', 'approved', 'delivered'
);

create type public.video_format as enum ('social_short', 'ad', 'podcast_clip');

create type public.script_status as enum ('draft', 'client_review', 'changes_requested', 'approved');

create type public.version_status as enum (
  'draft', 'fixes_requested', 'client_review', 'changes_requested', 'approved'
);

create type public.edit_job_source as enum ('launch', 'editor_fix', 'client_changes');
create type public.edit_job_status as enum ('queued', 'running', 'done', 'failed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  revision_limit integer not null default 2 check (revision_limit >= 0),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null,
  client_id uuid references public.clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint client_users_belong_to_a_client check ((role = 'client') = (client_id is not null))
);
create index profiles_client_id_idx on public.profiles (client_id);

-- Editors assigned to a client.
create table public.client_team (
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (client_id, user_id)
);
create index client_team_user_id_idx on public.client_team (user_id);

create table public.brand_kits (
  client_id uuid primary key references public.clients (id) on delete cascade,
  logo_path text,
  colors text[] not null default '{}',
  fonts text[] not null default '{}',
  music_mood text,
  style_rules text,
  updated_at timestamptz not null default now()
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  format public.video_format not null default 'social_short',
  aspect text not null default '9:16' check (aspect in ('9:16', '1:1', '16:9')),
  status public.video_status not null default 'script',
  brief text,
  editor_id uuid references public.profiles (id) on delete set null,
  videographer_id uuid references public.profiles (id) on delete set null,
  due_on date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index videos_client_id_idx on public.videos (client_id);
create index videos_editor_id_idx on public.videos (editor_id);
create index videos_videographer_id_idx on public.videos (videographer_id);
create index videos_created_by_idx on public.videos (created_by);
create index videos_status_idx on public.videos (status);

-- One script per video; the shot list is an ordered list of {text, done}.
create table public.scripts (
  video_id uuid primary key references public.videos (id) on delete cascade,
  body text not null default '',
  shot_list jsonb not null default '[]'::jsonb,
  status public.script_status not null default 'draft',
  client_note text,
  drafted_by_claude boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index scripts_approved_by_idx on public.scripts (approved_by);

create table public.shoots (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  needs text,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index shoots_video_id_idx on public.shoots (video_id);
create index shoots_starts_at_idx on public.shoots (starts_at);

create table public.footage (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  size_bytes bigint,
  content_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index footage_video_id_idx on public.footage (video_id);
create index footage_uploaded_by_idx on public.footage (uploaded_by);

create table public.versions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  number integer not null check (number > 0),
  storage_path text not null unique,
  file_name text not null,
  status public.version_status not null default 'draft',
  made_by text not null default 'claude' check (made_by in ('claude', 'editor')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  decided_at timestamptz,
  unique (video_id, number)
);
create index versions_created_by_idx on public.versions (created_by);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.versions (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  timecode_ms integer check (timecode_ms >= 0),
  body text not null check (length(trim(body)) > 0),
  drawing jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_version_id_idx on public.comments (version_id);
create index comments_author_id_idx on public.comments (author_id);
create index comments_parent_id_idx on public.comments (parent_id);

-- Work for the Claude editing engine. Until the engine ships (spec Phase 1),
-- the editor completes a job by uploading the draft.
create table public.edit_jobs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  base_version_id uuid references public.versions (id) on delete set null,
  result_version_id uuid references public.versions (id) on delete set null,
  source public.edit_job_source not null,
  instructions text,
  status public.edit_job_status not null default 'queued',
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index edit_jobs_video_id_idx on public.edit_jobs (video_id);
create index edit_jobs_base_version_id_idx on public.edit_jobs (base_version_id);
create index edit_jobs_result_version_id_idx on public.edit_jobs (result_version_id);
create index edit_jobs_requested_by_idx on public.edit_jobs (requested_by);
create index edit_jobs_open_idx on public.edit_jobs (status) where status in ('queued', 'running');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid references public.videos (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_video_id_idx on public.notifications (video_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger videos_touch before update on public.videos
  for each row execute function private.touch_updated_at();
create trigger scripts_touch before update on public.scripts
  for each row execute function private.touch_updated_at();
create trigger brand_kits_touch before update on public.brand_kits
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers (security definer, unexposed schema, always keyed on auth.uid())
-- ---------------------------------------------------------------------------

create function private.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create function private.my_client_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select client_id from public.profiles where id = (select auth.uid());
$$;

create function private.can_access_client(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case private.my_role()
    when 'admin' then true
    when 'editor' then exists (
      select 1 from public.client_team t where t.client_id = cid and t.user_id = (select auth.uid())
    ) or exists (
      select 1 from public.videos v where v.client_id = cid and v.editor_id = (select auth.uid())
    )
    when 'videographer' then exists (
      select 1 from public.videos v where v.client_id = cid and v.videographer_id = (select auth.uid())
    )
    when 'client' then private.my_client_id() = cid
    else false
  end;
$$;

create function private.can_access_video(vid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.videos v
    where v.id = vid
      and case private.my_role()
        when 'admin' then true
        when 'editor' then v.editor_id = (select auth.uid()) or exists (
          select 1 from public.client_team t where t.client_id = v.client_id and t.user_id = (select auth.uid())
        )
        when 'videographer' then v.videographer_id = (select auth.uid())
        when 'client' then v.client_id = private.my_client_id()
        else false
      end
  );
$$;

-- Storage paths are "<video_id>/<file>" (footage, versions) or "<client_id>/<file>" (brand).
create function private.path_uuid(object_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.client_team enable row level security;
alter table public.brand_kits enable row level security;
alter table public.videos enable row level security;
alter table public.scripts enable row level security;
alter table public.shoots enable row level security;
alter table public.footage enable row level security;
alter table public.versions enable row level security;
alter table public.comments enable row level security;
alter table public.edit_jobs enable row level security;
alter table public.notifications enable row level security;

-- clients
create policy "clients: visible to people working with them" on public.clients
  for select to authenticated using (private.can_access_client(id));
create policy "clients: admins manage (insert)" on public.clients
  for insert to authenticated with check ((select private.my_role()) = 'admin');
create policy "clients: admins manage (update)" on public.clients
  for update to authenticated
  using ((select private.my_role()) = 'admin')
  with check ((select private.my_role()) = 'admin');
create policy "clients: admins manage (delete)" on public.clients
  for delete to authenticated using ((select private.my_role()) = 'admin');

-- profiles: staff see everyone; clients see staff and their own company.
create policy "profiles: read" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or (select private.my_role()) <> 'client'
    or role <> 'client'
    or client_id = (select private.my_client_id())
  );
create policy "profiles: admins manage (insert)" on public.profiles
  for insert to authenticated with check ((select private.my_role()) = 'admin');
create policy "profiles: admins manage (update)" on public.profiles
  for update to authenticated
  using ((select private.my_role()) = 'admin')
  with check ((select private.my_role()) = 'admin');
create policy "profiles: admins manage (delete)" on public.profiles
  for delete to authenticated using ((select private.my_role()) = 'admin');

-- client_team
create policy "client_team: read own or admin" on public.client_team
  for select to authenticated using (
    user_id = (select auth.uid()) or (select private.my_role()) = 'admin'
  );
create policy "client_team: admins manage (insert)" on public.client_team
  for insert to authenticated with check ((select private.my_role()) = 'admin');
create policy "client_team: admins manage (update)" on public.client_team
  for update to authenticated
  using ((select private.my_role()) = 'admin')
  with check ((select private.my_role()) = 'admin');
create policy "client_team: admins manage (delete)" on public.client_team
  for delete to authenticated using ((select private.my_role()) = 'admin');

-- brand_kits: staff with access read; admins and editors edit.
create policy "brand_kits: staff read" on public.brand_kits
  for select to authenticated using (
    (select private.my_role()) <> 'client' and private.can_access_client(client_id)
  );
create policy "brand_kits: editors and admins insert" on public.brand_kits
  for insert to authenticated with check (
    (select private.my_role()) in ('admin', 'editor') and private.can_access_client(client_id)
  );
create policy "brand_kits: editors and admins update" on public.brand_kits
  for update to authenticated
  using ((select private.my_role()) in ('admin', 'editor') and private.can_access_client(client_id))
  with check ((select private.my_role()) in ('admin', 'editor') and private.can_access_client(client_id));

-- videos: visible per role; created/assigned by admins, edited by admins/editors.
create policy "videos: read" on public.videos
  for select to authenticated using (private.can_access_video(id));
create policy "videos: admins insert" on public.videos
  for insert to authenticated with check ((select private.my_role()) = 'admin');
create policy "videos: admins and editors update" on public.videos
  for update to authenticated
  using ((select private.my_role()) in ('admin', 'editor') and private.can_access_video(id))
  with check ((select private.my_role()) in ('admin', 'editor') and private.can_access_video(id));
create policy "videos: admins delete" on public.videos
  for delete to authenticated using ((select private.my_role()) = 'admin');

-- scripts: clients only see scripts sent to them; videographers only approved ones.
create policy "scripts: read" on public.scripts
  for select to authenticated using (
    private.can_access_video(video_id) and case (select private.my_role())
      when 'client' then status in ('client_review', 'changes_requested', 'approved')
      when 'videographer' then status = 'approved'
      else true
    end
  );
create policy "scripts: editors and admins insert" on public.scripts
  for insert to authenticated with check (
    (select private.my_role()) in ('admin', 'editor') and private.can_access_video(video_id)
  );
create policy "scripts: editors and admins update" on public.scripts
  for update to authenticated
  using ((select private.my_role()) in ('admin', 'editor') and private.can_access_video(video_id))
  with check ((select private.my_role()) in ('admin', 'editor') and private.can_access_video(video_id));

-- shoots
create policy "shoots: read" on public.shoots
  for select to authenticated using (private.can_access_video(video_id));
create policy "shoots: editors and admins manage (insert)" on public.shoots
  for insert to authenticated with check ((select private.my_role()) in ('admin', 'editor') and private.can_access_video(video_id));
create policy "shoots: editors and admins manage (update)" on public.shoots
  for update to authenticated
  using ((select private.my_role()) in ('admin', 'editor') and private.can_access_video(video_id))
  with check ((select private.my_role()) in ('admin', 'editor') and private.can_access_video(video_id));
create policy "shoots: editors and admins manage (delete)" on public.shoots
  for delete to authenticated using ((select private.my_role()) in ('admin', 'editor') and private.can_access_video(video_id));

-- footage: staff only.
create policy "footage: staff read" on public.footage
  for select to authenticated using (
    (select private.my_role()) <> 'client' and private.can_access_video(video_id)
  );

-- versions: the quality gate. Clients never see a draft the editor hasn't sent.
create policy "versions: read" on public.versions
  for select to authenticated using (
    private.can_access_video(video_id) and (
      (select private.my_role()) <> 'client'
      or status in ('client_review', 'changes_requested', 'approved')
    )
  );

-- comments: anyone who can see the version can read and add comments.
create policy "comments: read" on public.comments
  for select to authenticated using (
    exists (select 1 from public.versions v where v.id = version_id)
  );
create policy "comments: add as yourself" on public.comments
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.versions v where v.id = version_id)
  );
create policy "comments: authors edit own" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "comments: authors delete own" on public.comments
  for delete to authenticated using (author_id = (select auth.uid()));

-- edit_jobs: staff read.
create policy "edit_jobs: staff read" on public.edit_jobs
  for select to authenticated using (
    (select private.my_role()) <> 'client' and private.can_access_video(video_id)
  );

-- notifications: your own.
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: mark own read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('footage', 'footage', false), ('versions', 'versions', false), ('brand', 'brand', false)
on conflict (id) do nothing;

-- Browsers upload straight to Storage (resumable); reads go through signed URLs
-- the server creates after its own access check.
create policy "footage: staff upload to their videos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'footage'
    and (select private.my_role()) in ('admin', 'editor', 'videographer')
    and private.can_access_video(private.path_uuid(name))
  );
create policy "versions: editors upload to their videos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'versions'
    and (select private.my_role()) in ('admin', 'editor')
    and private.can_access_video(private.path_uuid(name))
  );
create policy "brand: editors upload for their clients" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'brand'
    and (select private.my_role()) in ('admin', 'editor')
    and private.can_access_client(private.path_uuid(name))
  );
