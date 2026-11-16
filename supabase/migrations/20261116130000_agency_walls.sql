-- White label, step 2: every row belongs to an agency, and nothing crosses from one agency to
-- another. Each table carries agency_id. A trigger fills it from the row's parent (a video's
-- client, a comment's version...) and refuses a row that points into another agency. One
-- restrictive policy per table adds the agency wall under every existing rule, so the rules by
-- role and by client keep working unchanged inside an agency. The server's own queries are
-- scoped in the app (src/lib/supabase/agency.ts). Magik is agency number one and takes every
-- existing row.

alter table public.profiles add column platform_admin boolean not null default false;

alter table public.agent_runs add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.brand_kits add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.brand_questionnaires add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.brand_strategies add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.calendar_attendees add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.calendar_events add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.calendar_feeds add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.client_invites add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.client_team add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.clients add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.comments add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.contracts add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.credit_ledger add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.edit_jobs add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.footage add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.help_requests add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.invoices add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.motion_prompts add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.notifications add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.onboardings add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.packs add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.profiles add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.reference_library add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.reference_videos add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.referrals add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.script_revisions add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.scripts add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.shoots add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.sound_files add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.sound_libraries add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.studio_settings add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.trend_reports add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.versions add column agency_id uuid references public.agencies (id) on delete restrict;
alter table public.videos add column agency_id uuid references public.agencies (id) on delete restrict;

-- Everything that exists is Magik's.
update public.agent_runs set agency_id = (select id from public.agencies where slug = 'magik');
update public.brand_kits set agency_id = (select id from public.agencies where slug = 'magik');
update public.brand_questionnaires set agency_id = (select id from public.agencies where slug = 'magik');
update public.brand_strategies set agency_id = (select id from public.agencies where slug = 'magik');
update public.calendar_attendees set agency_id = (select id from public.agencies where slug = 'magik');
update public.calendar_events set agency_id = (select id from public.agencies where slug = 'magik');
update public.calendar_feeds set agency_id = (select id from public.agencies where slug = 'magik');
update public.client_invites set agency_id = (select id from public.agencies where slug = 'magik');
update public.client_team set agency_id = (select id from public.agencies where slug = 'magik');
update public.clients set agency_id = (select id from public.agencies where slug = 'magik');
update public.comments set agency_id = (select id from public.agencies where slug = 'magik');
update public.contracts set agency_id = (select id from public.agencies where slug = 'magik');
update public.credit_ledger set agency_id = (select id from public.agencies where slug = 'magik');
update public.edit_jobs set agency_id = (select id from public.agencies where slug = 'magik');
update public.footage set agency_id = (select id from public.agencies where slug = 'magik');
update public.help_requests set agency_id = (select id from public.agencies where slug = 'magik');
update public.invoices set agency_id = (select id from public.agencies where slug = 'magik');
update public.motion_prompts set agency_id = (select id from public.agencies where slug = 'magik');
update public.notifications set agency_id = (select id from public.agencies where slug = 'magik');
update public.onboardings set agency_id = (select id from public.agencies where slug = 'magik');
update public.packs set agency_id = (select id from public.agencies where slug = 'magik');
update public.profiles set agency_id = (select id from public.agencies where slug = 'magik');
update public.reference_library set agency_id = (select id from public.agencies where slug = 'magik');
update public.reference_videos set agency_id = (select id from public.agencies where slug = 'magik');
update public.referrals set agency_id = (select id from public.agencies where slug = 'magik');
update public.script_revisions set agency_id = (select id from public.agencies where slug = 'magik');
update public.scripts set agency_id = (select id from public.agencies where slug = 'magik');
update public.shoots set agency_id = (select id from public.agencies where slug = 'magik');
update public.sound_files set agency_id = (select id from public.agencies where slug = 'magik');
update public.sound_libraries set agency_id = (select id from public.agencies where slug = 'magik');
update public.studio_settings set agency_id = (select id from public.agencies where slug = 'magik');
update public.trend_reports set agency_id = (select id from public.agencies where slug = 'magik');
update public.versions set agency_id = (select id from public.agencies where slug = 'magik');
update public.videos set agency_id = (select id from public.agencies where slug = 'magik');

-- The shared catalogue (sounds, motion prompts, reference videos) may hold rows with no agency:
-- every agency reads those. Everything else always has one.
alter table public.agent_runs alter column agency_id set not null;
alter table public.brand_kits alter column agency_id set not null;
alter table public.brand_questionnaires alter column agency_id set not null;
alter table public.brand_strategies alter column agency_id set not null;
alter table public.calendar_attendees alter column agency_id set not null;
alter table public.calendar_events alter column agency_id set not null;
alter table public.calendar_feeds alter column agency_id set not null;
alter table public.client_invites alter column agency_id set not null;
alter table public.client_team alter column agency_id set not null;
alter table public.clients alter column agency_id set not null;
alter table public.comments alter column agency_id set not null;
alter table public.contracts alter column agency_id set not null;
alter table public.credit_ledger alter column agency_id set not null;
alter table public.edit_jobs alter column agency_id set not null;
alter table public.footage alter column agency_id set not null;
alter table public.help_requests alter column agency_id set not null;
alter table public.invoices alter column agency_id set not null;
alter table public.notifications alter column agency_id set not null;
alter table public.onboardings alter column agency_id set not null;
alter table public.packs alter column agency_id set not null;
alter table public.profiles alter column agency_id set not null;
alter table public.reference_videos alter column agency_id set not null;
alter table public.referrals alter column agency_id set not null;
alter table public.script_revisions alter column agency_id set not null;
alter table public.scripts alter column agency_id set not null;
alter table public.shoots alter column agency_id set not null;
alter table public.studio_settings alter column agency_id set not null;
alter table public.trend_reports alter column agency_id set not null;
alter table public.versions alter column agency_id set not null;
alter table public.videos alter column agency_id set not null;
create index agent_runs_agency_id_idx on public.agent_runs (agency_id);
create index brand_kits_agency_id_idx on public.brand_kits (agency_id);
create index brand_questionnaires_agency_id_idx on public.brand_questionnaires (agency_id);
create index brand_strategies_agency_id_idx on public.brand_strategies (agency_id);
create index calendar_attendees_agency_id_idx on public.calendar_attendees (agency_id);
create index calendar_events_agency_id_idx on public.calendar_events (agency_id);
create index calendar_feeds_agency_id_idx on public.calendar_feeds (agency_id);
create index client_invites_agency_id_idx on public.client_invites (agency_id);
create index client_team_agency_id_idx on public.client_team (agency_id);
create index clients_agency_id_idx on public.clients (agency_id);
create index comments_agency_id_idx on public.comments (agency_id);
create index contracts_agency_id_idx on public.contracts (agency_id);
create index credit_ledger_agency_id_idx on public.credit_ledger (agency_id);
create index edit_jobs_agency_id_idx on public.edit_jobs (agency_id);
create index footage_agency_id_idx on public.footage (agency_id);
create index help_requests_agency_id_idx on public.help_requests (agency_id);
create index invoices_agency_id_idx on public.invoices (agency_id);
create index motion_prompts_agency_id_idx on public.motion_prompts (agency_id);
create index notifications_agency_id_idx on public.notifications (agency_id);
create index onboardings_agency_id_idx on public.onboardings (agency_id);
create index packs_agency_id_idx on public.packs (agency_id);
create index profiles_agency_id_idx on public.profiles (agency_id);
create index reference_library_agency_id_idx on public.reference_library (agency_id);
create index reference_videos_agency_id_idx on public.reference_videos (agency_id);
create index referrals_agency_id_idx on public.referrals (agency_id);
create index script_revisions_agency_id_idx on public.script_revisions (agency_id);
create index scripts_agency_id_idx on public.scripts (agency_id);
create index shoots_agency_id_idx on public.shoots (agency_id);
create index sound_files_agency_id_idx on public.sound_files (agency_id);
create index sound_libraries_agency_id_idx on public.sound_libraries (agency_id);
create index trend_reports_agency_id_idx on public.trend_reports (agency_id);
create index versions_agency_id_idx on public.versions (agency_id);
create index videos_agency_id_idx on public.videos (agency_id);

-- ---------------------------------------------------------------- whose agency

create function private.my_agency_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select agency_id from public.profiles where id = (select auth.uid());
$$;

-- Fills agency_id on a new row and keeps a row inside its agency. Its arguments are the row's
-- references, 'table:column', in order of authority: the first one that leads to an agency
-- decides, and every other one must lead to the same agency. A '!' after a reference means its
-- answer stands even when it is "no agency" (a file of a shared sound library is shared too).
-- With no reference to go by, the row keeps the agency it was given, or takes the signed-in
-- person's. A row never changes agency afterwards.
create function private.set_agency() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  fresh jsonb := to_jsonb(new);
  before jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  ref text;
  tbl text;
  col text;
  val text;
  found uuid;
  hit boolean;
  decided boolean := false;
begin
  if tg_op = 'UPDATE' then
    new.agency_id := old.agency_id;
  end if;
  foreach ref in array tg_argv loop
    tbl := split_part(rtrim(ref, '!'), ':', 1);
    col := split_part(rtrim(ref, '!'), ':', 2);
    val := fresh ->> col;
    continue when val is null;
    continue when tg_op = 'UPDATE' and val is not distinct from (before ->> col);
    execute format('select agency_id, true from public.%I where id = $1', tbl) into found, hit using val::uuid;
    continue when hit is not true;
    if tg_op = 'INSERT' and not decided and new.agency_id is null and (found is not null or ref like '%!') then
      new.agency_id := found;
      decided := true;
    elsif found is not null and new.agency_id is distinct from found then
      raise exception 'This % row points to a % of another agency.', tg_table_name, tbl using errcode = '42501';
    elsif found is not null then
      decided := true;
    elsif ref like '%!' and tg_op = 'INSERT' and not decided then
      new.agency_id := null;
      decided := true;
    end if;
  end loop;
  if tg_op = 'INSERT' and not decided and new.agency_id is null then
    new.agency_id := private.my_agency_id();
  end if;
  return new;
end;
$$;

create trigger agent_runs_set_agency before insert or update on public.agent_runs
  for each row execute function private.set_agency('clients:client_id', 'videos:video_id', 'profiles:requested_by');
create trigger brand_kits_set_agency before insert or update on public.brand_kits
  for each row execute function private.set_agency('clients:client_id');
create trigger brand_questionnaires_set_agency before insert or update on public.brand_questionnaires
  for each row execute function private.set_agency('clients:client_id', 'profiles:submitted_by');
create trigger brand_strategies_set_agency before insert or update on public.brand_strategies
  for each row execute function private.set_agency('clients:client_id');
create trigger calendar_attendees_set_agency before insert or update on public.calendar_attendees
  for each row execute function private.set_agency('calendar_events:event_id', 'profiles:user_id');
create trigger calendar_events_set_agency before insert or update on public.calendar_events
  for each row execute function private.set_agency('profiles:owner_id', 'clients:client_id', 'videos:video_id');
create trigger calendar_feeds_set_agency before insert or update on public.calendar_feeds
  for each row execute function private.set_agency('profiles:user_id');
create trigger client_invites_set_agency before insert or update on public.client_invites
  for each row execute function private.set_agency('clients:client_id', 'profiles:created_by', 'profiles:used_by');
create trigger client_team_set_agency before insert or update on public.client_team
  for each row execute function private.set_agency('clients:client_id', 'profiles:user_id');
create trigger clients_set_agency before insert or update on public.clients
  for each row execute function private.set_agency('profiles:seller_id', 'packs:pack_id');
create trigger comments_set_agency before insert or update on public.comments
  for each row execute function private.set_agency('versions:version_id', 'profiles:author_id', 'comments:parent_id');
create trigger contracts_set_agency before insert or update on public.contracts
  for each row execute function private.set_agency('clients:client_id', 'profiles:signed_by', 'profiles:created_by');
create trigger credit_ledger_set_agency before insert or update on public.credit_ledger
  for each row execute function private.set_agency('profiles:user_id', 'referrals:referral_id', 'profiles:created_by');
create trigger edit_jobs_set_agency before insert or update on public.edit_jobs
  for each row execute function private.set_agency('videos:video_id', 'versions:base_version_id', 'versions:result_version_id', 'profiles:requested_by');
create trigger footage_set_agency before insert or update on public.footage
  for each row execute function private.set_agency('videos:video_id', 'profiles:uploaded_by');
create trigger help_requests_set_agency before insert or update on public.help_requests
  for each row execute function private.set_agency('profiles:user_id');
create trigger invoices_set_agency before insert or update on public.invoices
  for each row execute function private.set_agency('clients:client_id', 'packs:pack_id', 'profiles:created_by');
create trigger motion_prompts_set_agency before insert or update on public.motion_prompts
  for each row execute function private.set_agency('profiles:created_by');
create trigger notifications_set_agency before insert or update on public.notifications
  for each row execute function private.set_agency('profiles:user_id', 'videos:video_id', 'clients:client_id');
create trigger onboardings_set_agency before insert or update on public.onboardings
  for each row execute function private.set_agency('clients:client_id');
create trigger packs_set_agency before insert or update on public.packs
  for each row execute function private.set_agency();
create trigger profiles_set_agency before insert or update on public.profiles
  for each row execute function private.set_agency('clients:client_id');
create trigger reference_library_set_agency before insert or update on public.reference_library
  for each row execute function private.set_agency('profiles:created_by');
create trigger reference_videos_set_agency before insert or update on public.reference_videos
  for each row execute function private.set_agency('clients:client_id', 'videos:video_id', 'profiles:created_by', 'reference_library:library_id');
create trigger referrals_set_agency before insert or update on public.referrals
  for each row execute function private.set_agency('profiles:referrer_id', 'clients:client_id');
create trigger script_revisions_set_agency before insert or update on public.script_revisions
  for each row execute function private.set_agency('videos:video_id', 'profiles:created_by');
create trigger scripts_set_agency before insert or update on public.scripts
  for each row execute function private.set_agency('videos:video_id', 'profiles:approved_by', 'trend_reports:trend_report_id');
create trigger shoots_set_agency before insert or update on public.shoots
  for each row execute function private.set_agency('videos:video_id');
create trigger sound_files_set_agency before insert or update on public.sound_files
  for each row execute function private.set_agency('sound_libraries:library_id!');
create trigger sound_libraries_set_agency before insert or update on public.sound_libraries
  for each row execute function private.set_agency('profiles:created_by');
create trigger trend_reports_set_agency before insert or update on public.trend_reports
  for each row execute function private.set_agency('clients:client_id', 'profiles:requested_by');
create trigger versions_set_agency before insert or update on public.versions
  for each row execute function private.set_agency('videos:video_id', 'profiles:created_by');
create trigger videos_set_agency before insert or update on public.videos
  for each row execute function private.set_agency('clients:client_id', 'profiles:editor_id', 'profiles:videographer_id', 'profiles:created_by');

-- ---------------------------------------------------------------- the wall

-- Restrictive: it narrows every other policy of the table to the person's own agency.
create policy "agent_runs: own agency" on public.agent_runs as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "brand_kits: own agency" on public.brand_kits as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "brand_questionnaires: own agency" on public.brand_questionnaires as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "brand_strategies: own agency" on public.brand_strategies as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "calendar_attendees: own agency" on public.calendar_attendees as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "calendar_events: own agency" on public.calendar_events as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "calendar_feeds: own agency" on public.calendar_feeds as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "client_invites: own agency" on public.client_invites as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "client_team: own agency" on public.client_team as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "clients: own agency" on public.clients as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "comments: own agency" on public.comments as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "contracts: own agency" on public.contracts as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "credit_ledger: own agency" on public.credit_ledger as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "edit_jobs: own agency" on public.edit_jobs as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "footage: own agency" on public.footage as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "help_requests: own agency" on public.help_requests as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "invoices: own agency" on public.invoices as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "motion_prompts: own agency" on public.motion_prompts as restrictive for all to authenticated
  using (agency_id is null or agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "notifications: own agency" on public.notifications as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "onboardings: own agency" on public.onboardings as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "packs: own agency" on public.packs as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "profiles: own agency" on public.profiles as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "reference_library: own agency" on public.reference_library as restrictive for all to authenticated
  using (agency_id is null or agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "reference_videos: own agency" on public.reference_videos as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "referrals: own agency" on public.referrals as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "script_revisions: own agency" on public.script_revisions as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "scripts: own agency" on public.scripts as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "shoots: own agency" on public.shoots as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "sound_files: own agency" on public.sound_files as restrictive for all to authenticated
  using (agency_id is null or agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "sound_libraries: own agency" on public.sound_libraries as restrictive for all to authenticated
  using (agency_id is null or agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "studio_settings: own agency" on public.studio_settings as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "trend_reports: own agency" on public.trend_reports as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "versions: own agency" on public.versions as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));
create policy "videos: own agency" on public.videos as restrictive for all to authenticated
  using (agency_id = (select private.my_agency_id()))
  with check (agency_id = (select private.my_agency_id()));

-- The helpers behind the policies by client and by video run with the definer's rights, so they
-- check the agency themselves (they also guard the storage buckets).
create or replace function private.can_access_client(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clients c where c.id = cid and c.agency_id = private.my_agency_id()
  ) and case private.my_role()
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

create or replace function private.can_access_video(vid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.videos v
    where v.id = vid
      and v.agency_id = private.my_agency_id()
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

create or replace function private.is_event_attendee(eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.calendar_attendees a
    where a.event_id = eid and a.user_id = (select auth.uid()) and a.agency_id = private.my_agency_id()
  );
$$;

-- ---------------------------------------------------------------- one of each, per agency

-- The studio's details: one row per agency instead of one row in all.
alter table public.studio_settings drop constraint studio_settings_pkey;
alter table public.studio_settings drop column id;
alter table public.studio_settings add primary key (agency_id);

-- A new agency starts with its own details, under its own name.
create function private.agency_starts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.studio_settings (agency_id, business_name, invoice_prefix)
  values (new.id, new.name, coalesce(nullif(upper(left(regexp_replace(new.slug, '[^a-z0-9]', '', 'g'), 3)), ''), 'INV'));
  return new;
end;
$$;
create trigger agencies_start after insert on public.agencies
  for each row execute function private.agency_starts();

-- Invoice numbers count per agency, and only have to be unique inside it.
alter table public.invoices drop constraint invoices_number_key;
alter table public.invoices add constraint invoices_agency_number_key unique (agency_id, number);

drop function public.take_invoice_number();
create function public.take_invoice_number(agency uuid) returns text
language sql volatile security definer set search_path = '' as $$
  update public.studio_settings
     set next_invoice_number = next_invoice_number + 1
   where agency_id = agency
  returning invoice_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad((next_invoice_number - 1)::text, 4, '0');
$$;
revoke all on function public.take_invoice_number(uuid) from public, anon, authenticated;
grant execute on function public.take_invoice_number(uuid) to service_role;

-- The same reference video may sit in two agencies' libraries.
alter table public.reference_library drop constraint reference_library_url_key;
alter table public.reference_library add constraint reference_library_agency_url_key unique nulls not distinct (agency_id, url);

-- The agents' worker takes the next run of the agency it is working for.
drop function public.claim_agent_run(uuid);
create function public.claim_agent_run(run uuid default null, agency uuid default null) returns setof public.agent_runs
language sql security definer set search_path = '' as $$
  update public.agent_runs r
     set status = 'running', started_at = now(), attempts = r.attempts + 1, progress = null, error = null
   where r.id = (
     select q.id from public.agent_runs q
      where q.status = 'queued' and (run is null or q.id = run) and (agency is null or q.agency_id = agency)
      order by q.created_at
      limit 1
      for update skip locked
   )
  returning r.*;
$$;
revoke all on function public.claim_agent_run(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_agent_run(uuid, uuid) to service_role;
