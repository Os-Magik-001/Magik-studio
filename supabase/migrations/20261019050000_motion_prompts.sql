-- The studio's library of motion prompts: prompts that made great motion videos with Claude,
-- saved by the team (mostly from Prompt Motion, credited to their creators). The scriptwriter
-- adapts the ones that fit a video into its edit prompt for the engine.

create table public.motion_prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prompt text not null,
  -- prompt: a prompt as written; skill: a longer set of instructions.
  kind text not null default 'prompt' check (kind in ('prompt', 'skill')),
  tags text[] not null default '{}',
  source_url text,
  creator text,
  -- What the studio uses it for.
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index motion_prompts_created_by_idx on public.motion_prompts (created_by);

alter table public.motion_prompts enable row level security;

-- The studio reads them; only the server writes them.
create policy "motion_prompts: staff read" on public.motion_prompts
  for select to authenticated using ((select private.my_role()) in ('admin', 'editor'));
