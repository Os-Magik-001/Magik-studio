-- Notes the editor leaves during draft check are studio-internal: once the
-- version goes to the client, the client must not see them.

alter table public.comments add column internal boolean not null default false;

drop policy "comments: read" on public.comments;
create policy "comments: read" on public.comments
  for select to authenticated using (
    exists (select 1 from public.versions v where v.id = version_id)
    and (not internal or (select private.my_role()) <> 'client')
  );

drop policy "comments: add as yourself" on public.comments;
create policy "comments: add as yourself" on public.comments
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.versions v where v.id = version_id)
    and (not internal or (select private.my_role()) <> 'client')
  );
