-- White label: an agency's own logo files. Public, because the logo shows on the sign-in page
-- before anyone has signed in; only the server writes (after checking the studio manager).
-- Paths: <agency id>/<kind>-<random>.<ext>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agency', 'agency', true, 1048576, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;
