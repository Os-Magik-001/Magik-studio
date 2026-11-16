-- Agencies: the studios that use the app, each under its own name, logo and colours (white
-- label, step 1). An agency's brand is read by the server from the address a person comes in by
-- (domains); see src/lib/brand.ts for what `brand` may hold. Magik is the first agency and keeps
-- its own brand from the code. Rows don't belong to an agency yet: that is the next step.

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(trim(name)) between 1 and 60),
  -- The addresses this agency's people use, lower case, without a port: {studio.example.com}.
  domains text[] not null default '{}',
  brand jsonb not null default '{}' check (jsonb_typeof(brand) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agencies_domains_idx on public.agencies using gin (domains);
create trigger agencies_touch_updated_at before update on public.agencies
  for each row execute function private.touch_updated_at();

-- Read and written by the server only (the brand shows before anyone signs in).
alter table public.agencies enable row level security;
revoke all on public.agencies from anon, authenticated;

insert into public.agencies (slug, name) values ('magik', 'Magik Studio');
