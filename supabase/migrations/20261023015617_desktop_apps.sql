-- Magik OS, the apps round (2026-10-22): windows, a real Calendar, the client's pipeline and
-- website, referrals with credits, help, and team accounts that can be paused or deleted.
--   profiles.paused_at: a paused person can't use Magik OS until an admin resumes them (the
--     server also bans the auth user, so they can't sign in).
--   profiles.preferences: per-person settings (wallpaper, muted notifications, calendar), so
--     they follow the person from one computer to another.
--   profiles.referral_code: the code in the person's referral link (/r/<code>).
--   comments.author_id: a deleted person's comments stay on the video, without an author.
--   videos.post_at / post_platforms: when and where a finished video goes out; clients see it
--     in their calendar.
--   clients.site_*: the website Magik made for the client, shown in their Website app.
--   calendar_events (+ attendees, feeds): everyone's own calendar, events shared with
--     teammates or with a client's people, and a private link to subscribe from Google or
--     Apple Calendar.
--   referrals, credit_ledger: people the user referred, and the credits they earned.
--   help_requests: questions sent from the Help app to the studio.
-- Writes go through server actions with the secret key after a permission check, as elsewhere;
-- RLS decides who reads what.

-- ---------------------------------------------------------------- people

alter table public.profiles
  add column paused_at timestamptz,
  add column preferences jsonb not null default '{}'::jsonb,
  add column referral_code text unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8);
update public.profiles set referral_code = substr(md5(random()::text || id::text), 1, 8) where referral_code is null;
alter table public.profiles alter column referral_code set not null;

alter table public.comments alter column author_id drop not null;
alter table public.comments drop constraint comments_author_id_fkey;
alter table public.comments
  add constraint comments_author_id_fkey foreign key (author_id) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------- videos and clients

alter table public.videos
  add column post_at timestamptz,
  add column post_platforms text[] not null default '{}';
create index videos_post_at_idx on public.videos (post_at) where post_at is not null;

alter table public.clients
  add column site_url text,
  add column site_admin_url text,
  add column site_status text not null default 'none' check (site_status in ('none', 'building', 'live'));

alter table public.studio_settings
  add column referral_reward integer not null default 100 check (referral_reward between 0 and 100000);

-- ---------------------------------------------------------------- calendar

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (description is null or length(description) <= 4000),
  location text check (location is null or length(location) <= 300),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  color text not null default 'gold' check (color in ('gold', 'blue', 'green', 'red', 'purple', 'orange', 'pink', 'graphite')),
  -- Shared with a client's people (and the studio people working with that client).
  client_id uuid references public.clients (id) on delete cascade,
  video_id uuid references public.videos (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_ends_after_start check (ends_at >= starts_at)
);
create index calendar_events_owner_idx on public.calendar_events (owner_id, starts_at);
create index calendar_events_client_idx on public.calendar_events (client_id, starts_at) where client_id is not null;
create index calendar_events_video_idx on public.calendar_events (video_id) where video_id is not null;
create trigger calendar_events_touch before update on public.calendar_events
  for each row execute function private.touch_updated_at();

create table public.calendar_attendees (
  event_id uuid not null references public.calendar_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (event_id, user_id)
);
create index calendar_attendees_user_idx on public.calendar_attendees (user_id);

-- A private link per person: Google or Apple Calendar fetch it without a session. The link
-- carries the person's id, this nonce and an HMAC of both made with the server's key; a new
-- nonce makes the old link stop working.
create table public.calendar_feeds (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  nonce text not null,
  created_at timestamptz not null default now()
);

create function private.is_event_attendee(eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.calendar_attendees a where a.event_id = eid and a.user_id = (select auth.uid())
  );
$$;
revoke execute on function private.is_event_attendee(uuid) from public, anon;
grant execute on function private.is_event_attendee(uuid) to authenticated;

-- ---------------------------------------------------------------- referrals and credits

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.profiles (id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 120),
  company text check (company is null or length(company) <= 160),
  email text check (email is null or length(email) <= 200),
  phone text check (phone is null or length(phone) <= 40),
  message text check (message is null or length(message) <= 2000),
  status text not null default 'new' check (status in ('new', 'contacted', 'signed', 'declined')),
  client_id uuid references public.clients (id) on delete set null,
  -- Credits given to the referrer for this referral (0 until it signs).
  credits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index referrals_referrer_idx on public.referrals (referrer_id, created_at desc);
create index referrals_client_idx on public.referrals (client_id) where client_id is not null;
create trigger referrals_touch before update on public.referrals
  for each row execute function private.touch_updated_at();

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null check (length(btrim(reason)) between 1 and 200),
  referral_id uuid references public.referrals (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);
create index credit_ledger_referral_idx on public.credit_ledger (referral_id) where referral_id is not null;
create index credit_ledger_created_by_idx on public.credit_ledger (created_by) where created_by is not null;

-- ---------------------------------------------------------------- help

create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  topic text not null default 'question' check (topic in ('question', 'problem', 'idea', 'billing')),
  body text not null check (length(btrim(body)) between 1 and 4000),
  page text check (page is null or length(page) <= 300),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now()
);
create index help_requests_user_idx on public.help_requests (user_id, created_at desc);

-- ---------------------------------------------------------------- access

alter table public.calendar_events enable row level security;
alter table public.calendar_attendees enable row level security;
alter table public.calendar_feeds enable row level security;
alter table public.referrals enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.help_requests enable row level security;

revoke all on public.calendar_events, public.calendar_attendees, public.calendar_feeds,
  public.referrals, public.credit_ledger, public.help_requests from anon;

-- Events: your own, the ones you're invited to, and the ones shared with a client you work
-- with (or your own company, for a client's people).
create policy "calendar_events: read" on public.calendar_events
  for select to authenticated using (
    owner_id = (select auth.uid())
    or private.is_event_attendee(id)
    or (client_id is not null and private.can_access_client(client_id))
  );
create policy "calendar_events: add your own" on public.calendar_events
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and (client_id is null or private.can_access_client(client_id))
  );
create policy "calendar_events: owners and admins edit" on public.calendar_events
  for update to authenticated
  using (owner_id = (select auth.uid()) or (select private.my_role()) = 'admin')
  with check (client_id is null or private.can_access_client(client_id));
create policy "calendar_events: owners and admins delete" on public.calendar_events
  for delete to authenticated using (owner_id = (select auth.uid()) or (select private.my_role()) = 'admin');

create policy "calendar_attendees: read" on public.calendar_attendees
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.calendar_events e where e.id = event_id)
  );

-- calendar_feeds: no policy, only the server reads the nonces.

create policy "referrals: yours, and sales" on public.referrals
  for select to authenticated using (referrer_id = (select auth.uid()) or (select private.is_sales()));

create policy "credit_ledger: yours, and admins" on public.credit_ledger
  for select to authenticated using (user_id = (select auth.uid()) or (select private.my_role()) = 'admin');

create policy "help_requests: yours, and admins" on public.help_requests
  for select to authenticated using (user_id = (select auth.uid()) or (select private.my_role()) = 'admin');
