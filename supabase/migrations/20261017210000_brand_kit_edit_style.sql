-- How the engine edits a client's videos: 'dynamic' (motion graphics, freeze-frame intros,
-- effects) or 'clean' (cuts, reframing and subtitles only, like Cluely's skits).
alter table public.brand_kits
  add column edit_style text not null default 'dynamic' check (edit_style in ('dynamic', 'clean'));
