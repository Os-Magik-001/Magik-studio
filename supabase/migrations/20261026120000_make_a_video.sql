-- Make a video (2026-10-26): the team edits a video with the engine without the client steps
-- (no brief, script approval, shoot or client review). Footage in, finished video out.
--   videos.internal: made in the Make a video app. Only the team sees it, never a client, even
--     when it's for one of theirs.
--   videos.client_id: optional now; a video with no client is the studio's own.

alter table public.videos alter column client_id drop not null;
alter table public.videos add column internal boolean not null default false;

create or replace function private.can_access_video(vid uuid) returns boolean
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
        when 'client' then v.client_id = private.my_client_id() and not v.internal
        else false
      end
  );
$$;

drop policy "videos: read" on public.videos;

create policy "videos: read" on public.videos
  for select to authenticated using (
    case (select private.my_role())
      when 'admin' then true
      when 'editor' then editor_id = (select auth.uid()) or exists (
        select 1 from public.client_team t
        where t.client_id = videos.client_id and t.user_id = (select auth.uid())
      )
      when 'videographer' then videographer_id = (select auth.uid())
      when 'client' then client_id = (select private.my_client_id()) and not internal
      else false
    end
  );
