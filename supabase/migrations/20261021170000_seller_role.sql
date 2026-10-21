-- Sellers (vendeurs) set new clients up: their details, the pack, the invoice, the contract and
-- the link that lets the client open their account. They don't see production: videos,
-- scripts and footage stay behind private.can_access_client, which gives sellers nothing.
-- On its own so the new value is committed before any policy compares against it.
alter type public.user_role add value if not exists 'seller';
