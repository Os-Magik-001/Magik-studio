---
name: aslaniedits-style
description: The @aslaniedits look (Milad Aslani, motion designer): the key line of a talking shot as a glowing stack (black brush word on a yellow pill, white line with one bold italic word, a huge glowing yellow word), pixel blocks and swooshes, marks around the head, white flash zooms; for interviews and talking promos, music that stops under the words
formats: social_short, ad
style: dynamic
when: aslaniedits, aslani, dcs61-6mu81
agents: editor, sound, motion
---

# The @aslaniedits look

## When to use
Use this when the brief names @aslaniedits or his reel (instagram.com/reel/Dcs61-6Mu81), or asks for "the energy bomb" style: talking-to-camera or interview footage where one line per answer should explode on screen. It suits promos for food, fitness, events and small businesses. It does not suit calm or luxury brands, or dialogue comedy.

## What the reference does (measured frame by frame, Oct 2026)
- **A 7.8 s before/after demo.**
  - **Hook:** the raw take plays for 2.3 s under a white Instagram-style comment card at the top ("After Effects isn't for video editing!!!" with a grey reply line, "Oh, really?"), a grey avatar circle and no username.
  - **Payoff:** at 2.30 s one frame burns to white. The next shot lands from about 20% closer with a radial zoom blur, already graded. It is settled by 2.50 s.
- **Grade of the "after":** deep cinematic contrast, warm amber key and rim light, crushed but not black shadows, a strong vignette.
- **The stack, the core of the style.** One spoken line, "Looking for an energy BOMB", is built over the chest in three tiers, each appearing as it is said:
  1. **Pill:** a black brush-script word ("Looking") written left to right on a glowing yellow rounded pill (pill #F4CF2C to #FFE65C, a yellow and amber glow). The script overflows the pill.
  2. **Line:** a white geometric sans line, Poppins Medium ("for an"), with one Bold Italic word ("energy"). The words come out of a blur one by one.
  3. **Big word:** a huge Poppins Black word ("BOMB"), yellow with a hot top (#FFF7B0 to #FFE95E to #FFCF1F) and an amber bloom. Its letters land one by one from about 1.5x scale and blurred, about 55 ms apart.
- **Around the stack:**
  - yellow pixel blocks (35-80 px squares, some darker) flickering on held frames for 0.15-0.35 s as the pill and the big word appear
  - a white swoosh stroke drawing under the line and flying off
  - a small flick after the big word
  - a faint glowing ring behind
- **Marks around the head:** two chunky glowing yellow punctuation marks ("?" in the reference) pop in after the big word, one in front left and one right, tucked behind the hair (the person is cut out over it). They bob gently.
- **Music:** about 90 BPM hip-hop. The drop lands on the flash into the "after".

## For an interview or talking promo (studio recipe, Oct 2026 Loadedfordays v2)
- **Structure:** alternate the answers (voice only, no music under any word) with music sections of whole bars cut on the beat over the B-roll.
  - The music starts on its bar right after the last word, at full level, and stops on the bar where the next person speaks: a 45 ms release, no fade tail.
  - Each section may jump to another strong bar of the track. End on the track's own final hit, landing on the logo.
- **Transitions:**
  - **Where the music comes in:** the white flash zoom, 1 washed frame then 1 white frame, then the next shot lands from 20% closer with a radial blur over 0.34 s, plus a soft `whoosh`. More white frames than that look cheap.
  - **Inside the B-roll:** walk-through pushes in the camera's own direction (a `slide_left` feel, about 0.2 s out and 0.27 s in, motion-blurred) on shots of 2 beats or more. True hard cuts on 1-beat shots.
  - **Where the music stops:** a short settle, 7% closer to 1.0 over 0.4 s.
  - **Inside one answer:** a tighter jump cut, about 1.12x.
- **Text:**
  - One stack per answer on its key phrase, written from the speaker's own words (pill = the lead-in, line + bold = the middle, big = the payoff word). Six in 60 s is the most; leave 5 s or more between two.
  - When the next few words are said while the stack holds, put them as a fourth small white line under the big word instead of a subtitle.
  - The other phrases are plain subtitles in the same white Poppins with one Bold Italic word, revealed word by word as said.
  - A stack never runs over a cut. It ends with its shot.
- **Marks:** only on a shot where the head is fairly still and the person is cut out. Offsets are measured in face widths: the front mark about 0.5 to the left, the behind mark about 0.6 to the right, or the head hides it.
- **Hook:** the comment card from frame 0 with a question the first answer replies to, and a grey reply line.
- **End card:** the brand logo out of a blur on the dimmed last shot, the handle in black on the yellow pill.

## Engine mapping
When the comp pipeline isn't available:
- **The stack:** `stacked` headline (pill word as a boxed yellow word with the brush script, then the line, then `hero` for the big word, accent colour yellow).
- **The flash zoom:** `dip_to_white` 0.1 s plus a `zoom_in`.
- **The marks:** `behind_subject` for the right mark.
- **The card:** `comment_bubble`.
- **The music:** sound `align: start` for each music section, with music sitting out of the speech sections.

## Avoid
- emoji or emoji-like icons (use typography marks)
- cartoon sound effects
- more than 3 effects per stack
- music under the words
- slides that change direction inside one section
- a stack or mark over a face
