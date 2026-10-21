-- Client onboarding (Magik OS — Client Onboarding Process, 2026-10-21).
-- The seller sets the client up, then one link hands over to the client:
--   seller lane: client details -> pack -> invoice -> contract -> link
--   client lane: account -> contract signature -> questions -> references -> brand
-- Workflow writes go through server actions with the secret key, as everywhere else in the
-- app; RLS here decides who reads what.

create function private.is_sales() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.my_role()::text in ('admin', 'seller');
$$;
revoke execute on function private.is_sales() from public, anon;
grant execute on function private.is_sales() to authenticated;

-- ---------------------------------------------------------------- packs: the offers sold

create table public.packs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  description text,
  price_cents integer not null check (price_cents >= 0),
  billing text not null default 'monthly' check (billing in ('one_time', 'monthly')),
  videos_per_month integer check (videos_per_month >= 0),
  -- Becomes the client's revision_limit when the pack is chosen.
  revision_rounds integer not null default 2 check (revision_rounds between 0 and 20),
  features text[] not null default '{}',
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger packs_touch_updated_at before update on public.packs
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- the client's file

alter table public.clients
  add column contact_name text,
  add column email text,
  add column phone text,
  add column address text,
  add column website text,
  add column instagram text,
  -- The language of their documents (invoice) and of the videos by default.
  add column language text not null default 'fr' check (language in ('fr', 'en')),
  add column notes text,
  add column seller_id uuid references public.profiles (id) on delete set null,
  add column pack_id uuid references public.packs (id) on delete set null;
create index clients_seller_id_idx on public.clients (seller_id);
create index clients_pack_id_idx on public.clients (pack_id);

-- ---------------------------------------------------------------- studio details (invoices)

create table public.studio_settings (
  id boolean primary key default true check (id),
  business_name text not null default 'Magik Studio',
  address text,
  email text,
  phone text,
  website text,
  currency text not null default 'CAD',
  -- Québec by default: GST (TPS) 5% and QST (TVQ) 9.975%, each with its registration number.
  taxes jsonb not null default '[{"name": "TPS", "rate": 5, "number": ""}, {"name": "TVQ", "rate": 9.975, "number": ""}]',
  payment_terms_days integer not null default 14 check (payment_terms_days between 0 and 120),
  payment_instructions text,
  invoice_prefix text not null default 'MGK',
  next_invoice_number integer not null default 1 check (next_invoice_number > 0),
  updated_at timestamptz not null default now()
);
create trigger studio_settings_touch_updated_at before update on public.studio_settings
  for each row execute function private.touch_updated_at();
insert into public.studio_settings default values;

-- Hands out invoice numbers one at a time: MGK-2026-0001, MGK-2026-0002…
create function public.take_invoice_number() returns text
language sql volatile security definer set search_path = '' as $$
  update public.studio_settings
     set next_invoice_number = next_invoice_number + 1
   where id
  returning invoice_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad((next_invoice_number - 1)::text, 4, '0');
$$;
revoke execute on function public.take_invoice_number() from public, anon, authenticated;
grant execute on function public.take_invoice_number() to service_role;

-- ---------------------------------------------------------------- invoices

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  number text not null unique,
  pack_id uuid references public.packs (id) on delete set null,
  status text not null default 'issued' check (status in ('issued', 'sent', 'paid', 'void')),
  issued_on date not null default current_date,
  due_on date,
  currency text not null default 'CAD',
  -- [{ description, detail, quantity, unit_cents }]
  lines jsonb not null default '[]',
  -- [{ name, rate, number, amount_cents }]
  taxes jsonb not null default '[]',
  subtotal_cents integer not null default 0,
  total_cents integer not null default 0,
  notes text,
  language text not null default 'fr' check (language in ('fr', 'en')),
  -- Snapshots at issue time, so a later change of address doesn't rewrite an issued invoice.
  bill_to jsonb not null default '{}',
  issuer jsonb not null default '{}',
  written_by_claude boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz
);
create index invoices_client_id_idx on public.invoices (client_id, created_at desc);
create index invoices_pack_id_idx on public.invoices (pack_id);
create index invoices_created_by_idx on public.invoices (created_by);

-- ---------------------------------------------------------------- contracts

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- In the contracts bucket: "<client_id>/<file>".
  storage_path text not null unique,
  file_name text not null,
  status text not null default 'awaiting_signature' check (status in ('awaiting_signature', 'signed')),
  -- The client signs in the app with their typed name…
  signed_name text,
  signed_at timestamptz,
  signed_by uuid references public.profiles (id) on delete set null,
  signed_ip text,
  -- …or the studio marks it signed (on paper, or before the link was sent).
  signed_outside boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index contracts_client_id_idx on public.contracts (client_id, created_at desc);
create index contracts_signed_by_idx on public.contracts (signed_by);
create index contracts_created_by_idx on public.contracts (created_by);

insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- the link to the client

create table public.client_invites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- sha256 of the token in the link; the token itself is never stored.
  token_hash text not null unique,
  email text,
  expires_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_via text check (sent_via in ('copy', 'email', 'sms', 'share')),
  opened_at timestamptz,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  -- A new link revokes the one before.
  revoked_at timestamptz
);
create index client_invites_client_id_idx on public.client_invites (client_id, created_at desc);
create index client_invites_created_by_idx on public.client_invites (created_by);
create index client_invites_used_by_idx on public.client_invites (used_by);

-- ---------------------------------------------------------------- onboarding progress

-- Only clients set up through onboarding have a row; older clients skip the setup assistant.
create table public.onboardings (
  client_id uuid primary key references public.clients (id) on delete cascade,
  has_brand boolean,
  questions_done_at timestamptz,
  references_done_at timestamptz,
  brand_done_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger onboardings_touch_updated_at before update on public.onboardings
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------- the studio's reference library

-- Videos the studio curates for clients to pick from ("videos to match").
create table public.reference_library (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'vimeo', 'drive', 'file', 'other')),
  title text not null check (btrim(title) <> ''),
  note text,
  tags text[] not null default '{}',
  -- In the references bucket: "library/<id>.<ext>".
  cover_path text,
  active boolean not null default true,
  sort integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index reference_library_created_by_idx on public.reference_library (created_by);

-- A client's pick from the library keeps a pointer to it.
alter table public.reference_videos
  add column library_id uuid references public.reference_library (id) on delete set null;
create index reference_videos_library_id_idx on public.reference_videos (library_id);

-- ---------------------------------------------------------------- brand

alter table public.brand_kits
  add column logo_source text check (logo_source in ('uploaded', 'created')),
  -- The created logo's design (template, text, colors, font), to edit it later.
  add column logo_spec jsonb;

-- ---------------------------------------------------------------- access

alter table public.packs enable row level security;
alter table public.studio_settings enable row level security;
alter table public.invoices enable row level security;
alter table public.contracts enable row level security;
alter table public.client_invites enable row level security;
alter table public.onboardings enable row level security;
alter table public.reference_library enable row level security;

revoke all on public.packs, public.studio_settings, public.invoices, public.contracts,
  public.client_invites, public.onboardings, public.reference_library from anon;

-- Everyone signed in reads the packs (a client sees what they bought), the studio details
-- printed on invoices, and the library clients pick references from.
create policy "packs: read" on public.packs
  for select to authenticated using (true);
create policy "studio_settings: read" on public.studio_settings
  for select to authenticated using (true);
create policy "reference_library: read" on public.reference_library
  for select to authenticated using (true);

-- Invoices and contracts: sales, and the client they belong to.
create policy "invoices: sales and the client" on public.invoices
  for select to authenticated using ((select private.is_sales()) or client_id = (select private.my_client_id()));
create policy "contracts: sales and the client" on public.contracts
  for select to authenticated using ((select private.is_sales()) or client_id = (select private.my_client_id()));

-- Links: sales only.
create policy "client_invites: sales" on public.client_invites
  for select to authenticated using ((select private.is_sales()));

-- Progress: sales, the studio people working with the client, and the client.
create policy "onboardings: read" on public.onboardings
  for select to authenticated using ((select private.is_sales()) or private.can_access_client(client_id));

-- Sellers read every client's file to onboard them (production stays behind can_access_client).
create policy "clients: sellers read" on public.clients
  for select to authenticated using ((select private.my_role())::text = 'seller');

-- A client reads their own brand kit (the "Your brand" app shows it).
create policy "brand_kits: the client reads theirs" on public.brand_kits
  for select to authenticated using (client_id = (select private.my_client_id()));
