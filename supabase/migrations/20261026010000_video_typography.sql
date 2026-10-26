-- Fonts and colors for an edit (2026-10-26): the editor picks them before launching the edit,
-- the way a brand guide sets them, and the edit engine sets every caption, title, card and the
-- end card in them.
--   videos.typography: { fonts: { title, accent, text }, colors: { title, accent, text,
--     highlight, background } } with the font ids of src/lib/typography.ts; null lets the
--     engine style the edit itself. Written by the launch action after a permission check.

alter table public.videos add column typography jsonb;
