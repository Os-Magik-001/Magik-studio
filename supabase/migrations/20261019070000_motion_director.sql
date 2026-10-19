-- Agent 5, the motion director: the design templates chosen for each video, its design brief
-- (a design prompt for every scene), the client's choice of graphics, and the composition the
-- engine's motion designer coded for each version (so a revision changes it instead of
-- designing again).

alter table public.scripts
  add column design_templates text[] not null default '{}',
  add column design_brief jsonb;

-- templates: the engine's built-in motion templates. designed: the motion director writes a
-- design brief and the engine's motion designer codes every graphic of the video.
alter table public.brand_kits
  add column graphics text not null default 'templates' check (graphics in ('templates', 'designed'));

alter table public.versions add column design jsonb;
