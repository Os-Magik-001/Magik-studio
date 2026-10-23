# Magik OS

The workspace that runs Magik Studio: sellers onboard clients, videographers bring in the footage, Claude edits it, editors check it, and clients approve it, all in one place.

## The desktop

Magik OS looks and works like a Mac in black and gold (dark Liquid Glass): a lock screen to sign in, a menu bar (the focused app on the left; search ⌘K, Mission Control, Help, the notification center, the clock and the person's menu on the right), and a Dock of big 3D app icons. Home is the desktop under the windows: a greeting, today's schedule (events, shoots, deadlines, posting dates) and panels for the role; each panel is a widget whose red light hides it, yellow folds it and green opens its app.

Every app opens in its own window, and many stay open at once: drag a window by its title bar, resize it from any edge, double-click the bar to fill the screen, drag it to an edge to fill half of it. Yellow puts it in the Dock (minimized windows wait on the Dock's right), red closes it, ⌘-click opens a link in a new window. A video, a client folder or a client's onboarding opens in a window of its own. Mission Control (the grid button, F3 or Ctrl ↑) spreads every window out; a right-click on a Dock icon lists the app's windows. Windows reopen minimized after a reload. On phones apps open full screen.

How the windows work (`src/components/desktop/`): the router renders one page at a time into a hidden slot; every app page wraps its content in `<WindowPage>`, which hands it to the window showing that address (`content.ts`), so windows keep their pages alive while the router moves on. The router's page is always the focused window's: clicking a window brings its page back, so its forms, refreshes and server actions act on it. Pages lay out with container queries (`@min-[…]` classes), so they follow their window's width, not the screen's. Nothing drawn by a layout under `(screens)` would show: put shared chrome in the page.

- `src/app/(app)/layout.tsx`: the desktop (`desktop/desktop.tsx`), with Home (`components/home/dashboard.tsx`, data in `src/lib/home.ts`) under the windows.
- `src/app/(app)/(screens)/`: every app; `not-found.tsx` and `error.tsx` show in the window too.
- `src/lib/apps.ts`: which apps each role gets, which app and which window a path opens in. Icons are drawn as SVG in `src/components/shell/app-icon.tsx` (Apple style: a gradient tile, one white symbol); the Calendar icon shows today's date.
- Settings (`/account`) has a sidebar: General, Appearance (wallpaper, dimming, Dock size and names, glass or solid windows, saved to the person's account), Notifications (what to be told about), Calendar (week start, the Google/Apple link), Password & security (sign out everywhere), Documents (clients' invoices and contract), Referrals & credits, Studio (admin), About.

## Who sees what

| Role | Apps | What they can do |
|---|---|---|
| Studio manager (`admin`) | Pipeline, Clients, Onboarding, Sales, Calendar, Agents, Library, Sound, Motion, Shoots, Team, Referrals | Everything: onboards clients, sets packs and invoice details, creates videos, adds, pauses and deletes people, assigns editors and videographers, answers Help, follows referrals up and gives credits |
| Seller (`seller`) | Onboarding, Sales, Calendar, Referrals | Sets new clients up (details, pack, invoice, contract) and sends them their link; follows referrals up. Doesn't see production. |
| Editor | Pipeline, Clients, Calendar, Agents, Library, Sound, Motion, Referrals | Their clients' videos: brief → script (Claude drafts) → shoot → launch the edit → draft check → send to client; posting dates |
| Videographer | Shoots, Calendar, Referrals | Their shoot calendar, the approved script and shot list, footage drop |
| Client | Pipeline, Your videos, Calendar, Your brand, Website, Referrals | Only their own videos, only once the editor sends them: where each one is (Pipeline), the gallery of cuts to watch and download (Your videos), approve the script, review cuts Frame.io-style, approve or request changes; posting dates and shoots in their calendar; their website made with Magik; their brand; invoices and contract in Settings |

Everyone also has Settings, Help (menu bar) and the notification center (the bell). A client uses Magik OS once their onboarding is finished; before that they see the setup assistant, or, with no onboarding yet, a "being prepared" page (the studio manager opens their setup or marks them onboarded in their client folder). A paused account can't sign in (`/paused`).

**Calendar** (`/calendar`, `src/lib/calendar-data.ts`): everyone's own events (invite teammates, share with a client), plus shoots, posting dates (`videos.post_at`), deadlines and invoices due, for whoever they concern. Day, week, month and list views; events move by dragging. Each person can subscribe from Google or Apple Calendar with a private link (`/api/calendar/<token>.ics`, an HMAC of their id and a nonce; Settings › Calendar makes a new one).

**Referrals** (`/referrals`): each person's link (`/r/<code>`, public) lets the businesses they refer leave their details; sales mark a referral signed, which gives the referrer the credits set in Settings › Studio (`credit_ledger`).

## Client onboarding

Onboarding starts with the seller, then one link hands over to the client (`src/lib/onboarding.ts` has the 10 steps):

1. **Seller** (Onboarding app): client infos → pack → invoice (generated from the pack and the studio's invoice details, with TPS/TVQ; Claude words it in the client's language when connected) → contract (a PDF; signed in the app by the client, or marked signed by the studio) → link.
2. **Client**: the link (`/join/<token>`, single use, 7/14/30 days, only its hash is stored; a new link revokes the old one) → their account → the setup assistant (`/setup`): contract signature, the brand questions one at a time, reference videos (from the studio's Library and their own links), then their brand: upload their logo, or create one from templates.

Packs and invoice details are set by the studio manager in the Onboarding app; invoices print or save as PDF from `/invoices/<id>`.

## How a video moves

`Script → Shoot → Footage in → Editing → Editor check → Client review → Approved → Delivered`

- The client approves the script before the shoot.
- Every edit request (the first edit, the editor's fixes and the client's changes) becomes an `edit_jobs` row for Claude, with timecoded comments attached.
- New versions always land in **editor check**. Clients never see a draft the editor hasn't sent (enforced in the database, not only in the UI).
- Notes staff leave during draft check are internal and hidden from clients.
- Change requests beyond the client's included revision rounds are flagged as billable.

## The agents

Each client has a **Brand & strategy** page (`/clients/<id>/brand`); clients fill in their side under **Your brand**.

1. **Brand strategist** (`src/lib/agents.ts`, runs in the app): turns the brand questionnaire into the niche, search hashtags and reference accounts, the charte graphique (palette, fonts, caption and motion style, tone, do's and don'ts), and the business, audience and needs. It also fills the brand kit, so every edit follows it.
2. **Trend researcher** (`engine/src/research.ts`, runs on the edit engine): finds reels for the niche's hashtags and accounts through Apify (`APIFY_TOKEN`), watches the top 10 by reach (contact sheets, transcript, cut rate), and has Claude write the key points: hooks, structures, editing, text, sound, scripting notes and video ideas. About $0.10 to $0.50 of Apify credit per run.
3. **Scriptwriter** (`src/lib/agents.ts`, the "Write with the scriptwriter" button on a video): strategy + latest research + brief become the script for the client, a scene-by-scene shoot plan for the videographer (framing, action, lines, B-roll, props) and the edit prompt. Under the script, **Ask the scriptwriter for changes** revises only what you ask; every version stays in the video's thread (`script_revisions`) and can come back. It also adapts the studio's **Motion prompts** (saved by the team from Prompt Motion, credited to their creators) into the edit prompt, on the engine's ten motion templates.
4. **Sound designer** (`engine/src/sound.ts`, runs on the edit engine after the editor locks the cut): searches every music library (the studio's picks, FreePD, Mixkit, Incompetech and the studio's Google Drive folders added on the **Sound** page), measures its shortlist (`engine/src/analysis.ts`: tempo, bars, sections, drops, ending), lines a drop or the ending up with the cut, places built-in or recorded sound effects, and recommends the trending sound the researcher found to add in Instagram when posting. Its choice, with any credit line the post needs, is on the video page.

5. **Motion director** (`src/lib/agents.ts`, with the script): from the script and the design templates chosen on the video (the studio's 16 in `src/lib/design-templates.ts`, plus the team's saved motion prompts), it writes a design prompt for every scene. When the video's graphics are designed (the client's brand kit, or templates chosen), the engine renders the cut without graphics and its motion designer (`engine/src/design.ts`) codes every graphic from that brief, timed to the music's bars; if that fails, the engine's own templates go out.

Every agent remembers the client's other videos: their scripts, edit prompts, what was asked to change, and the music they used (`src/lib/memory.ts`, `engine/src/memory.ts`).

**References** ("make it like this"): studio managers and editors paste links to reels or videos, on a video (step 1, for that video or all the client's) or on the client page (for every video), with what to take from each (hook, pacing, captions, graphics, music…) and a note. The engine (`engine/src/references.ts`) fetches each one (Apify for Instagram and TikTok, the service account for a Google Drive file, or a direct video link), watches it like the researcher does (contact sheets, transcript, cut rate, tempo) and has Claude break it down. The scriptwriter and the motion director read the breakdowns (`src/lib/references.ts`); the editor, the sound designer and the motion designer read them in the edit, with the contact sheets. YouTube and Vimeo don't allow downloads, so for those the agents get the title and the note. A reference costs about a cent of Apify credit and a few cents of Claude.

## The pipeline

The **Pipeline** page shows every video in four phases (Plan, Shoot, Edit, Review, then Delivered), each with its next step and who it waits on: the studio, the client, the videographer, or Claude. The counts at the top filter the board; there is a list view, a client filter and "My videos". A video's page follows the same seven steps (brief & references, script, motion design, shoot & footage, edit, sound, review & delivery), with the next step at the top (`src/lib/pipeline.ts`).

When the videographer presses **All footage is in: start the edit** on their shoot page, the engine starts editing with that edit prompt; the editor can still change the prompt on the video page before then.

## Stack

- **Next.js 16** (App Router, Cache Components, server actions) on **Vercel**
- **Supabase**: Postgres with row-level security, email + password sign-in (invite-only), Storage with resumable (TUS) uploads
- **Claude** (`claude-opus-5-5` via `@anthropic-ai/sdk`): drafts the script and shot list from the brief and brand kit

## The Claude editing engine (`engine/`)

A separate Node worker that turns raw footage into an edited draft. It runs anywhere with Node 24 and FFmpeg, not on Vercel.

1. **Claims** the oldest queued `edit_jobs` row (one job per video at a time) and reports progress the editor sees live.
2. **Gathers** the approved script and shot list, the brand kit and logo, and the raw footage.
   - Small uploads come from Storage.
   - Camera files come from Google Drive: ffmpeg reads them straight from Drive into a 4K working copy, so a 17 GB original never lands on disk. Working copies are cached under `ENGINE_CACHE_GB` (default 20) so revisions don't fetch again.
3. **Watches** the footage: contact sheets of frames sampled across every clip. With whisper.cpp set up, it also transcribes speech into timed phrases.
4. **Plans** the cut with Claude (`claude-opus-5-5`, adaptive thinking), producing an edit decision list:
   - shots, with transitions, speed changes, punch-ins and pushes, focus-point reframing and per-shot color fixes
   - an overall look
   - captions, titles and an end card

   Claude follows the studio's editing skills in [`engine/skills/`](engine/skills/README.md), Markdown files matched to the video's format. Revisions start from the previous cut's plan, with each comment pinned to the shot it falls on.
5. **Validates** the plan against the real footage, snapping cut points to word edges, then **renders** it in two passes:
   - **Picture:** shots cropped to 9:16, 1:1 or 16:9 around each focus point, transitions, speed, punch-ins, looks, B-roll cutaways over the voice, and floating cards.
   - **Finishing:** a graphics layer drawn frame by frame (word-timed captions in six styles, English subtitles translated from other languages, animated titles, hero words and dripping series logos, comment and follow buttons, progress bars, counters, emojis), text behind the person (a person cut-out made with Apple Vision on macOS), the sound designer's music bed ducked under speech (`engine/music/*.json`, built by `engine/scripts/sound-catalog.ts`), built-in and recorded sound effects (`engine/sfx/*.json`), and -14 LUFS loudness.
6. **Hands off** the result as a new version in **editor check**, and notifies the editor. Failures show up on the video page with a plain reason and a Retry button.

Footage from Google Drive needs a Google Cloud service account with the Drive API turned on.

- **The app** (on Vercel) reads it from `GOOGLE_SERVICE_ACCOUNT_KEY`, the key JSON base64-encoded. Locally it can use `GOOGLE_SERVICE_ACCOUNT_FILE`, a path to the key file.
- **The engine** reads either one.
- **Sharing:** footage folders are shared with the service account's email as Viewer. They never need to be public.

To set up transcription on a Mac:

```bash
brew install whisper-cpp
M="$HOME/Library/Application Support/Magik Edit Engine/models"; mkdir -p "$M"
curl -L -o "$M/ggml-large-v3-turbo-q5_0.bin" https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
curl -L -o "$M/ggml-silero-v5.1.2.bin" https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin
# then set WHISPER_CPP_MODEL and WHISPER_VAD_MODEL in .env.local to those two paths
```

To try an edit on this machine without touching the database (on a real video, or on any local files or Drive links):

```bash
cd engine
node --env-file=../.env.local scripts/try-edit.ts --video <video id> --fix "more cards, more dynamic" --out cut.mp4
node --env-file=../.env.local scripts/try-edit.ts --clips a.mp4 https://drive.google.com/drive/folders/… --brief "…" --notes "creator reel, recipe 1" --out cut.mp4
```

```bash
cd engine
pnpm install --ignore-workspace
pnpm once        # process one queued job and exit
pnpm start       # keep polling for jobs
pnpm test        # render + plan unit tests (ENGINE_INTEGRATION=1 also runs live jobs with a stand-in planner)
```

It reads `../.env.local` (or `engine/.env`): `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) and `ANTHROPIC_API_KEY`. Optional: `WHISPER_CPP_MODEL` (path to a ggml model) to add transcripts, with `WHISPER_VAD_MODEL` (Silero VAD, so silence and music don't produce invented words) and `WHISPER_LANGUAGE` (default `auto`); `ENGINE_SKILLS_DIR` to load skills from another folder; `ENGINE_MAX_FRAMES` (default 216) to cap how much footage Claude sees per job, and `ENGINE_MODEL`.

**On a Mac**, run it as a background service that starts at login and restarts itself:

```bash
engine/scripts/mac-service.sh install   # also use after engine code or key changes
engine/scripts/mac-service.sh status
engine/scripts/mac-service.sh logs
engine/scripts/mac-service.sh stop
```

It runs from `~/Library/Application Support/Magik Edit Engine` with a private copy of only the keys it needs, because macOS blocks background services from reading the Desktop. Edits only run while the Mac is awake.

To run it on a server, `engine/Dockerfile` builds an image with FFmpeg and fonts.

Not there yet: the Phase 1 blind test, where editors compare Claude's cut with a pro edit of the same footage.

## Local development

```bash
pnpm install
vercel env pull .env.local      # Supabase URL + publishable key
# add to .env.local (server-only, never NEXT_PUBLIC_):
#   SUPABASE_SECRET_KEY=sb_secret_...   (supabase projects api-keys --reveal)
#   ANTHROPIC_API_KEY=sk-ant-...        (for Claude script drafting)
pnpm dev
```

The first studio manager has to be created directly (sign-up is invite-only). After that, the studio manager adds people from the Team page with a temporary password, and can reset anyone's password there; new clients open their own account from their onboarding link. Everyone can change their own password in Settings.

To try everything without touching production, run Supabase locally (`supabase start`, needs Docker or Colima) and start the app with the local URL and keys exported: values already in the environment win over `.env.local`.

## Database

Migrations live in `supabase/migrations/`. Regenerate types after a schema change:

```bash
supabase gen types typescript --linked --schema public > src/lib/database.types.ts
```

Run `supabase db advisors --linked` after schema changes.

## Limits to know

- **Upload size**: Supabase Free caps each file at 50 MB. Real footage needs the Pro plan (files up to 500 GB).
- **Forgotten passwords**: there's no self-service reset email; the studio manager resets passwords on the Team page.
