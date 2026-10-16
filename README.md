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
- **Supabase**: Postgres with row-level security, email + password sign-in (invite-only), Storage with resumable (TUS) uploads
- **Claude** (`claude-opus-5-5` via `@anthropic-ai/sdk`): drafts the script and shot list from the brief and brand kit

## The Claude editing engine (`engine/`)

A separate Node worker that turns raw footage into an edited draft. It runs anywhere with Node 24 and FFmpeg, not on Vercel.

1. **Claims** the oldest queued `edit_jobs` row (one job per video at a time) and reports progress the editor sees live.
2. **Gathers** the approved script and shot list, the brand kit and logo, and downloads the raw footage.
3. **Watches** the footage: contact sheets of frames sampled across every clip. With whisper.cpp installed it also transcribes speech.
4. **Plans** the cut with Claude (`claude-opus-5-5`, adaptive thinking): an edit decision list of shots, captions, titles and an end card. Revisions start from the previous cut's plan, with each comment pinned to the shot it falls on.
5. **Validates** the plan against the real footage, then **renders** it with FFmpeg: crop to 9:16, 1:1 or 16:9, 30 fps, loudness-normalized audio, branded end card.
6. **Hands off** the result as a new version in **editor check**, and notifies the editor. Failures show up on the video page with a plain reason and a Retry button.

```bash
cd engine
pnpm install --ignore-workspace
pnpm once        # process one queued job and exit
pnpm start       # keep polling for jobs
pnpm test        # render + plan unit tests (ENGINE_INTEGRATION=1 also runs live jobs with a stand-in planner)
```

It reads `../.env.local` (or `engine/.env`): `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) and `ANTHROPIC_API_KEY`. Optional: `WHISPER_CPP_MODEL` (path to a ggml model) to add transcripts, `ENGINE_MAX_FRAMES` (default 216) to cap how much footage Claude sees per job, and `ENGINE_MODEL`.

To run it on a server, `engine/Dockerfile` builds an image with FFmpeg and fonts.

Not there yet: music (the mood is in the brand kit, but there's no track library), and the Phase 1 blind test, where editors compare Claude's cut with a pro edit of the same footage.

## Local development

```bash
pnpm install
vercel env pull .env.local      # Supabase URL + publishable key
# add to .env.local (server-only, never NEXT_PUBLIC_):
#   SUPABASE_SECRET_KEY=sb_secret_...   (supabase projects api-keys --reveal)
#   ANTHROPIC_API_KEY=sk-ant-...        (for Claude script drafting)
pnpm dev
```

The first studio manager has to be created directly (sign-up is invite-only). After that, the studio manager adds people from the Team page with a temporary password, and can reset anyone's password there. Everyone can change their own password on the Account page.

## Database

Migrations live in `supabase/migrations/`. Regenerate types after a schema change:

```bash
supabase gen types typescript --linked --schema public > src/lib/database.types.ts
```

Run `supabase db advisors --linked` after schema changes.

## Limits to know

- **Upload size**: Supabase Free caps each file at 50 MB. Real footage needs the Pro plan (files up to 500 GB).
- **Forgotten passwords**: there's no self-service reset email; the studio manager resets passwords on the Team page.
