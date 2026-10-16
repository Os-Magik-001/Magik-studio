# Magik OS

The workspace that runs Magik Studio: videographers bring in the footage, Claude edits it, editors check it, and clients approve it, all in one place.

## Who sees what

| Role | Space | What they can do |
|---|---|---|
| Studio manager (`admin`) | Pipeline, Clients, Shoots, Team | Everything: creates clients and videos, invites people, assigns editors and videographers, sets revision limits |
| Editor | Pipeline, Clients | Their clients' videos: brief → script (Claude drafts) → shoot → launch the edit → draft check → send to client |
| Videographer | Shoots | Their shoot calendar, the approved script and shot list, footage drop |
| Client | Your videos | Only their own videos, only once the editor sends them: approve the script, review cuts Frame.io-style, approve or request changes |

## How a video moves

`Script → Shoot → Footage in → Editing → Editor check → Client review → Approved → Delivered`

- The client approves the script before the shoot.
- Every edit request (the first edit, the editor's fixes and the client's changes) becomes an `edit_jobs` row for Claude, with timecoded comments attached.
- New versions always land in **editor check**. Clients never see a draft the editor hasn't sent (enforced in the database, not only in the UI).
- Notes staff leave during draft check are internal and hidden from clients.
- Change requests beyond the client's included revision rounds are flagged as billable.

## Stack

- **Next.js 16** (App Router, Cache Components, server actions) on **Vercel**
- **Supabase**: Postgres with row-level security, passwordless email auth, Storage with resumable (TUS) uploads
- **Claude** (`claude-opus-5-5` via `@anthropic-ai/sdk`): drafts the script and shot list from the brief and brand kit

## The Claude editing engine

The video editing engine is Phase 1 of the plan (prove Claude edits like a pro in a blind test before building on it). The workspace is ready for it:

1. The engine claims rows in `edit_jobs` with `status = 'queued'` (each has `instructions`, `video_id` and an optional `base_version_id`).
2. It reads the approved script (`scripts`), raw footage (`footage`, bucket `footage`) and the client's `brand_kits`.
3. It renders the cut, uploads it to the `versions` bucket at `<video_id>/<file>` and records it the same way `registerDraftVersion` in `src/app/actions/workflow.ts` does. That closes the open jobs and moves the video to editor check.

Until then, the editor uploads the draft render on the video page.

## Local development

```bash
pnpm install
vercel env pull .env.local      # Supabase URL + publishable key
# add to .env.local (server-only, never NEXT_PUBLIC_):
#   SUPABASE_SECRET_KEY=sb_secret_...   (supabase projects api-keys --reveal)
#   ANTHROPIC_API_KEY=sk-ant-...        (for Claude script drafting)
pnpm dev
```

The first studio manager has to be created directly (sign-up is invite-only). After that, people are added from the Team page.

## Database

Migrations live in `supabase/migrations/`. Regenerate types after a schema change:

```bash
supabase gen types typescript --linked --schema public > src/lib/database.types.ts
```

Run `supabase db advisors --linked` after schema changes.

## Limits to know

- **Upload size**: Supabase Free caps each file at 50 MB. Real footage needs the Pro plan (files up to 500 GB).
- **Sign-in emails**: Supabase's built-in email only reaches your Supabase team's own addresses and is rate-limited. Set up custom SMTP (e.g. Resend) before inviting clients by email. Until then, use the **one-click sign-in link** on the Team or Client page.
