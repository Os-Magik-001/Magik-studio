-- The videos read policy looked the row up again by id (private.can_access_video),
-- which can't see a row inserted by the same statement, so INSERT ... RETURNING
-- failed. Check the row's own columns instead; same access rules.

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
      when 'client' then client_id = (select private.my_client_id())
      else false
    end
  );
