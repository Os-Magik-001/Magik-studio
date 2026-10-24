# @theboyz_journey: what The Boyz teaches the edit engine

**Covered:** all 19 reels up to 150 s posted 2026-09-28 to 2026-10-21 (13.1 min; one 152.6 s episode is over the limit). 17 of them are collab posts that also appear on @j.k.hamington; they are counted here only. All 19 were watched frame by frame (hook at 4 fps, the whole reel at 2 fps, 8 frames around every cut). They are 14 dialogue episodes (Ep 01-15; Ep 03 was posted twice, the same edit), a filler episode (music only), the Eru new-member special (music only), a 12 s Tesla meme and an app waitlist ad. Plays 519-1,807.

**Method.** Cuts from frame differences with a feature-matching check (new shot, jump cut, punch-in), dips, flashes and freezes; speech edges from a voice detector and a 10 ms speech-band energy map; transcripts from whisper.cpp (French, so names are misheard: "Racine" is Rassim/Ghost, "Mérou" is Eru); on-screen text from Apple Vision at 2 fps. The measured numbers are below; the techniques come from watching.

## Measured numbers

**All reels** (19 reels, 13.1 min, plays median 732 (middle half 624-978, n=19))

- Length: median 43.8 s (middle half 30.1-51.1 s, n=19).
- Cuts per 10 s: median 2.67 (middle half 2.16-3.45, n=19). Shot length, all shots pooled: median 2.17 s (middle half 0.98-4.45 s, n=247); per-reel median shot: median 2.53 s (middle half 1.93-3.36 s, n=19).
- Shot lengths: under 0.5 s 6%, 0.5-1 s 19%, 1-2 s 19%, 2-4 s 25%, 4-8 s 24%, 8 s and more 7%.
- Pacing shape (cut rate in each tenth of the reel, 1.0 = the reel's own average): 2.72, 1.25, 0.60, 1.00, 0.74, 0.86, 0.85, 0.74, 0.94, 0.31. First 10 s against the rest: median 2.60x (middle half 1.40-3.54x, n=18).
- What the cuts are: new shot 66%, jump cut in the same framing 32%, punch-in 1%, punch-out n/a. Punch-in size median 1.16x (middle half 1.15-1.17x, n=2); punch-out n/a.
- Transitions: hard cut 94%, blur/whip 2%, flash 3%; dissolves per reel 0.16.
- Cuts made while something moves (frame change just before or after the cut well above the reel's typical motion): 25%.
- Moves inside shots: slow push-in on 10% of shots long enough to measure (median 1.07x (middle half 1.06-1.10x, n=15)), pull-out on 0%.
- Freeze frames: in 63% of reels; length median 1.07 s (middle half 0.43-2.80 s, n=21).
- Speech: share of runtime median 0.46 (middle half 0.28-0.50, n=19); words per minute of runtime median 123 (middle half 94-136, n=16), while speaking median 258 (middle half 242-277, n=16); first speech at median 5.60 s (middle half 5.47-6.93 s, n=16).
- Cuts against speech (12 reels with speech on at least 35% of the runtime, 150 cuts): in silence 91%, on the first sound of a phrase 1%, on the last sound 2%, sound leading the picture (J) 3%, sound running over the new picture (L) 3%, inside continuous speech 1% (of which at a word boundary with no pause: 1% of all cuts). Picture changing in the middle of a sound (no energy dip at the cut): 5%.
  - Cuts in silence: air after the last word before the cut median 0.28 s (middle half 0.15-0.40 s, n=80); air before the first word after the cut median 0.37 s (middle half 0.17-0.70 s, n=99).
  - J: the new phrase starts median 0.38 s (middle half 0.29-0.52 s, n=4) before the picture cut. L: the phrase ends median 0.25 s (middle half 0.19-0.35 s, n=4) after it.
  - Pauses between phrases inside a shot median 0.41 s (middle half 0.21-0.68 s, n=215); pauses that contain a cut median 0.64 s (middle half 0.44-1.16 s, n=78).
  - By kind of cut: new (105): silence 92%, J 3%, L 2%, mid 0%; jump (41): silence 93%, J 0%, L 5%, mid 0%; punch_in (2): silence 0%, J 50%, L 0%, mid 50%.
- Shots with no speech inside talking reels (reactions, inserts, beats): 6.46 per minute; length median 1.00 s (middle half 0.73-2.02 s, n=62); the cut to them comes median 0.13 s (middle half 0.05-0.36 s, n=10) after the line before; the next line starts median 0.20 s (middle half 0.15-0.49 s, n=16) after they end.
- Ending: the reel runs median 0.54 s (middle half 0.27-1.05 s, n=12) after the last word; the pause before the last line is median 0.20 s (middle half 0.07-0.55 s, n=11).
- Text on screen: frames with any text median 0.73 (middle half 0.59-0.79, n=19); spoken words shown as captions median 0.13 (middle half 0.06-0.18, n=16); title-size text median 0.05 (middle half 0.04-0.26, n=19); words per caption median 2.5 (middle half 2.0-3.1, n=12); text changes per 10 s median 10.3 (middle half 9.0-12.7, n=19); text on the very first frame in 21% of reels. Position of text (share of text boxes): top median 0.14 (middle half 0.07-0.47, n=19), middle median 0.09 (middle half 0.04-0.39, n=19), bottom median 0.48 (middle half 0.22-0.82, n=19).
- Hook: first cut at median 1.10 s (middle half 1.10-1.13 s, n=18); cuts in the first 3 s median 3.0 (middle half 2.0-3.0, n=19); first speech at median 5.60 s (middle half 5.47-6.93 s, n=16); motion in the first 3 s against the rest median 1.25x (middle half 0.72-1.70x, n=18).
- Music: licensed song (Instagram's metadata) on 5% of reels; seconds with music heard between the words median 0.43 (middle half 0.12-0.77, n=19); under talk median 0.17 (middle half 0.05-0.27, n=12); bed level against the voice median -6.8 dB (middle half -7.8--4.2 dB, n=10).
- Music-driven reels (5, little speech): 33% of 72 cuts land within 50 ms of a detected beat (chance about 21%); tempo median 126 BPM (middle half 105-128 BPM, n=5).
- Loudness as served: median -14.2 LUFS (middle half -14.3--14.1 LUFS, n=19), range median 8.2 LU (middle half 6.5-10.6 LU, n=19), true peak median -0.8 dBTP (middle half -1.2--0.1 dBTP, n=19) (Instagram normalises, so this mostly reflects the platform).

| rank | reel | plays | s | cuts/10 s | median shot | kinds | speech | cut states (sil/J/L/mid) | text | music |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | DepRkClRUco | 1807 | 12.0 | 0.0 | 12.042 |  | 0.0 | 0/0/0/0 | 1.0 | bed |
| 2 | Dd1k4cGx8jn | 1738 | 49.4 | 2.23 | 3.65 | jump 4, new 7 | 0.498 | 11/0/0/0 | 0.283 | - |
| 3 | DeHmgbaR-Xv | 1674 | 39.2 | 6.37 | 0.784 | jump 20, new 5 | 0.286 | 22/0/1/0 | 0.744 | bed |
| 4 | Dd9SqW5RnPn | 1046 | 30.0 | 2.67 | 3.7 | freeze_out 2, jump 5, new 3 | 0.0 | 0/0/0/0 | 1.0 | bed |
| 5 | DeMu9e3RQKn | 993 | 28.8 | 4.17 | 2.0 | jump 4, new 8 | 0.276 | 11/0/0/0 | 0.5 | bed |
| 6 | DeKKPi9RWpW | 964 | 28.5 | 3.15 | 1.85 | jump 4, new 5 | 0.433 | 9/0/0/0 | 0.614 | The Gentlemen Titles |
| 7 | Dd4HhcNRwvB | 924 | 47.8 | 2.3 | 2.683 | jump 5, new 6 | 0.565 | 11/0/0/0 | 0.729 | - |
| 8 | Dero3ptRogE | 849 | 56.8 | 3.52 | 2.267 | new 19, punch_in 1 | 0.456 | 17/1/1/1 | 0.728 | bed |
| 9 | DeAOrU5sgsB | 834 | 58.3 | 1.54 | 2.9 | jump 4, new 5 | 0.619 | 9/0/0/0 | 0.761 | - |
| 10 | DeR4qAhRdHf | 732 | 24.9 | 2.81 | 1.567 | jump 4, new 3 | 0.243 | 7/0/0/0 | 0.82 | bed |
| 11 | DekfCCrRwSz | 728 | 60.0 | 2.5 | 2.484 | jump 5, new 10 | 0.476 | 14/0/0/0 | 0.717 | - |
| 12 | DePVhHwRwaR | 694 | 30.2 | 3.31 | 2.867 | jump 4, new 6 | 0.556 | 10/0/0/0 | 0.683 | bed |
| 13 | DevG7qfsMU_ | 655 | 38.5 | 3.38 | 2.4 | jump 1, new 12 | 0.285 | 13/0/0/0 | 0.727 | bed |
| 14 | Dd6tW3oRIpy | 645 | 52.5 | 2.09 | 4.233 | jump 4, new 7 | 0.496 | 11/0/0/0 | 0.571 | - |
| 15 | Dd62c75xxha | 604 | 52.5 | 2.09 | 4.233 | jump 4, new 7 | 0.496 | 11/0/0/0 | 0.571 | - |
| 16 | DecMbqgxmEH | 567 | 46.5 | 2.58 | 2.534 | new 12 | 0.47 | 12/0/0/0 | 0.677 | - |
| 17 | Dee6eTvx0I2 | 548 | 43.8 | 2.06 | 3.067 | freeze_in 1, freeze_out 1, new 9 | 0.418 | 11/0/0/0 | 0.886 | - |
| 18 | DexW0GMRZvh | 528 | 49.7 | 4.02 | 1.666 | jump 7, new 12, punch_in 1 | 0.58 | 11/3/3/0 | 0.828 | bed |
| 19 | DeaGiPbs4aW | 519 | 36.8 | 4.9 | 1.2 | new 18 | 0.0 | 0/0/0/0 | 0.527 | bed |

Measured automatically on every reel (see corpus.json for each reel). Cut states: *silence* = no speech at the cut; *J* = the phrase started before the picture cut; *L* = the phrase ends after it; *inside continuous speech* = no pause at the cut. These are acoustic facts; whether a J/L is a real split edit between two speakers is judged by eye in the techniques below. The detector's limits are listed under Measurement notes.


## How the episodes are cut

### Cuts: the show's own cut points are already tight
- **Dialogue cuts sit in the gap between lines.** Of the cuts in the dialogue episodes, about 97% are measured in silence and, by eye, every speaker-change cut is a straight cut in the gap (0 split edits in about 85 story cuts). Examples: DeKKPi9RWpW @ 9.70 and @ 17.13, Dd4HhcNRwvB @ 14.83, Dero3ptRogE @ 33.70, DekfCCrRwSz @ 27.50.
- **Air at the cut:** the cut comes 0.20-0.28 s after the last word (medians of the two halves; middle half 0.11-0.32 s) and the next line starts 0.22-0.30 s after it (middle half 0.14-0.47 s). At a change of speaker the combined silence is a median 0.52 s (middle half 0.32-0.70 s, 26 cuts in Ep 03-15) and 0.59 s in Ep 01-14. That is the engine's own padding (0.12 s before, 0.2 s after), so padding is not what made the engine's Boyz cuts feel "not in the right time".
- **Snaps:** 6 of 26 speaker changes are 0.13-0.26 s: DekfCCrRwSz @ 53.53 cuts on the last syllable of "tu peux le faire ?" into a confessional that answers 0.13 s later; DePVhHwRwaR @ 18.30 (a phone answer); Dee6eTvx0I2 @ 20.50.
- **Cuts land when a movement completes** (6 of 8 in the first half): Dd1k4cGx8jn @ 10.40 after MI6's head turn; DeKKPi9RWpW @ 15.43 after a 1.2 s look to camera; DeMu9e3RQKn ends 0.3-0.8 s after the hidden card shows. Cut on action: DePVhHwRwaR @ 11.70 (the hand closing on the dumbbell), DevG7qfsMU_ @ 16.40 (mid-rise, jacket swinging).
- **A freeze starts on the last syllable** (DeHmgbaR-Xv @ 11.13), and with a continuing voice the picture changes on a word boundary (DeHmgbaR-Xv @ 6.80 and 7.67; Dero3ptRogE's inserts land on the role being named).

### Where the dead frames are (what "a lot of frames that need to be cut" means)
None of it is air at dialogue cuts. It is silent stretches inside scene shots, and the title:
- walk-ins and approaches: DekfCCrRwSz @ 9.34-13.92 (4.6 s; a body crosses the lens at 13.5, a free cut point nobody used);
- staring after the line: DekfCCrRwSz @ 15.71-19.00 (3.3 s);
- empty lead-ins: Dee6eTvx0I2 @ 5.30-7.90 (2.6 s), Dd6tW3oRIpy @ 5.30-12.30 (a 7 s silent pan, first word at 12.83 s);
- pauses of 1-2.9 s inside long takes in 6 of 8 episodes (Dd4HhcNRwvB @ 10.43 2.0 s and @ 22.62 2.9 s of near-black walking; DeR4qAhRdHf @ 10.27 2.4 s);
- reactions left running 3.4-4.3 s after a gag (DeR4qAhRdHf @ 17.5, Dd1k4cGx8jn @ 33.0); freeze name cards of 4.1-5.1 s (DeHmgbaR-Xv);
- tails after the button: DeHmgbaR-Xv fades for 3.9 s, Dero3ptRogE holds an empty frame for 1.2 s, DecMbqgxmEH has 7.4 s of silent wide before its last line;
- the title: 5.13-5.30 s of the same reused clip before the first word in every episode.
A pro would remove a median of about 10% of each episode beyond the title (4-25%), plus about 3 s of title.

### Shot lengths, sizes and coverage
- **51 story shots in Ep 03-15:** median 4.0 s (middle half 2.6-5.7). Confessionals (20): median 3.0 s, all under 5 s. Scene shots (31): median 4.9 s; 9 of them run 7-12.3 s and hold 37% of the story time. In Ep 01-14, 16 confessionals run 1.7-9.7 s (median 4.8 s).
- **One camera per scene:** locked wides (DeAOrU5sgsB has a 25.4 s wide with 4 speakers) or handheld that pans between speakers instead of cutting (DeHmgbaR-Xv @ 16.5-17.0). Only Ep 14 (Dero3ptRogE) has real two-angle coverage, and it is the best-cut episode (median shot 2.27 s). 4 of 8 early episodes and 6 of the later shots run past 9 s with no cut or size change.
- **Jump cuts only in the title** (the members re-posing every 0.67-1.13 s on the 83 BPM title music); 2 story jump cuts in all (DekfCCrRwSz @ 42.77, Dee6eTvx0I2 @ 25.60), each hiding about 0.6 s between speakers.
- **Punch-ins:** one (Dero3ptRogE @ 48.07, x1.18, mid-line) and one snap zoom (DeKKPi9RWpW @ 22.4, x2.43 onto Ghost, the music coming back on it). No slow pushes in the episodes; the Eru special pushes 1.06-1.21 on 6 of 9 shots.

### Inserts
- Triggered by a claim to contradict (DePVhHwRwaR @ 8.17 "choses sérieuses" → the gym), the object of the line (DevG7qfsMU_ @ 9.87, the email), an arrival (DecMbqgxmEH @ 15.33, the door), a pronoun ("lui" → the treadmill, Dd6tW3oRIpy @ 33.40), a name or role (Dd1k4cGx8jn @ 16.43 and 36.40; Dero3ptRogE @ 26.83 and 37.70).
- They start 0-0.75 s before the named word and hold up to 0.8 s past the phrase; readable length 1.5-2.0 s, 2.5-4 s for a card with text.

### Reactions and comedy timing
- **Claim → confessional, hard cut** in 12 of 14 episodes: the confessional contradicts or mocks the scene (DeMu9e3RQKn @ 25.10 cuts on the last syllable of a shout into "we never leave decisions to chance", then he shows a hidden card; DeKKPi9RWpW @ 24.43; DekfCCrRwSz @ 34.87; Dee6eTvx0I2 @ 17.60).
- **The reaction lives at the head of the confessional:** 1.2-1.9 s of silent stare, shrug or agreement before the line (DekfCCrRwSz @ 21.33, 1.23 s; Dee6eTvx0I2 @ 30.47, 1.27 s; DecMbqgxmEH @ 26.50, 1.92 s). The show never cuts to a separate listener face for a laugh.
- **Performed pauses run 0.67-1.8 s** and are the comedy: "a guy who [1.1 s] knows a guy" (Dero3ptRogE @ 32.35), the 1.8 s smug pose before "MI6 approuve" (DeR4qAhRdHf @ 21.77), barked orders (Dee6eTvx0I2 @ 26.53), a slow "Finally..." (DevG7qfsMU_ @ 6.14). The trim pass's 0.45 s before a punchline and its 0.75 s pause cut would crush them.
- **Confessional relays:** 2-3 characters answering each other from the chair (DekfCCrRwSz @ 19.00-27.50, Dee6eTvx0I2 @ 30.47-35.80). Deadpan holds of 0.4-0.67 s at the end of a confessional (Dee6eTvx0I2 @ 20.07, 24.93).
- **Endings:** 5 of 8 early episodes end 0.3-0.8 s after the punchline; the later ones 0.16-0.6 s. None uses a call to action, a next-episode label or a lower third. The 60 s limit ate DekfCCrRwSz's final hold (0.19 s).

### Transitions and interrupts
- Hard cuts on 70 of 72 cuts in Ep 03-15 and in all of Ep 01-14; one in-camera whip (DevG7qfsMU_ @ 17.73), a missed whip pan (Dd1k4cGx8jn @ 32.5), fades only at the end.
- Designed interrupts in 3 of 14: freeze-frame name cards (DeHmgbaR-Xv @ 11.13, 18.57, 25.77: dim, dusty, a serif typewriter card), the snap zoom, a close-up montage with a 3-face split screen (DeMu9e3RQKn @ 10.60-18.77).
- The Eru special glitches on 14 of 18 cuts and cuts every two beats (1.2 s at 100 BPM, 9 of 18 on the beat), with about 2 s of silence before the door opens; the ad uses 7 light-burst flashes after a hand thrust at the lens.

### Captions and titles
- English subtitles of the French lines in 13 of 14 episodes: white, no box, sentence case. Placement and chunking change between episodes: small semibold at about 72% of the height built word by word with 3-8 words (Oct 13-16); mid-frame at 45-60% in 2-5 word chunks (DePVhHwRwaR, DevG7qfsMU_); 75% or 83% in others. The newest (Dero3ptRogE) uses 3-4 words at about 68%.
- Swears starred in only 2 of 5 episodes that swear; shouted lines in capitals; dialogue dashes when two speakers share a caption; one enlarged emphasis word (DecMbqgxmEH @ 35.0).
- The red drip logo in every episode; "EPISODE N" on it in 1. No name lower thirds: the cast is named only by freeze cards (DeHmgbaR-Xv) and parody credits ("FEATURING ... AKA «JOYBOY»", DevG7qfsMU_ @ 36.0).

### Sound
- Music under the title in every episode. After it, 7 of 14 episodes are dry; the others bring a low bed in on a silent comic beat and run it under the closing confessional (DeKKPi9RWpW @ 22, DeMu9e3RQKn @ 11, DeR4qAhRdHf @ 11: about 7-8 dB under the voice), or under a gym or montage scene (DePVhHwRwaR -6.8 dB, DevG7qfsMU_ -1.6 dB). Ep 14 carries a mock-epic heist bed all through, too loud at -3.9 dB.
- Dialogue cuts ignore the beat; the music-only filler cuts every 8 beats (8 of 10 cuts on a beat) and the card montage on a 2.0 s grid.

### Structure and hook
- 13 of 14 episodes open on the 5.3 s title clip (sofa or rooftop); the first word comes at a median 5.5 s (12.83 s at worst). Only DekfCCrRwSz has a cold open: 2.6 s copied from its own confessional @ 34.87. The insta-series skill's hook example ("on va le détruire") sits at Dee6eTvx0I2 @ 12.70.
- Episodes run 25-60 s (median about 44 s); with the dead air cut they would run about 23-52 s.
- Shape: title, setup (scene or confessional), escalation, confessional contrast, button (a confessional line in 8 of 14).
- The two most-played posts are the 12 s static meme (DepRkClRUco: a chat card for the whole reel) and Ep 01 (the cast intro).

## Rules for the engine (The Boyz)
1. **Cold open:** the first segment is the episode's funniest or boldest line, copied from later in the episode, 2-3 s, `beat: punchline`, first word by 0.9 s; cut 0.3 s after its last word into the title, and keep the line in its place too.
2. **Title:** the last 2.0-2.3 s of the title clip (from the shot where the drip logo appears), with a music `section` under it only; the story's first line 0.15-0.25 s after it.
3. **Word timing:** keep `say` padding (0.12 s / 0.2 s). Target 0.35-0.75 s of combined air at a speaker change; snaps (0.13-0.3 s combined) for a jab confessional, an answer or a phone reply.
4. **Straight cuts:** the show never splits sound and picture at a speaker change, so the engine's automatic L/J offsets are not its style (see "can't do yet"). Use `cutaway` overlays only for an insert or an off-screen voice.
5. **Silent action caps:** entrance or exit at most 1.5 s, sitting or standing at most 1.0 s, empty air before a scene's first line at most 0.5 s, a silent insert at most 2.0 s (2.5-4 s for a card to read), the button plus 0.4-0.8 s. Cut on the key frame of the action: the door, a body crossing the lens, the hand on the object.
6. **Movement beats the fixed tail:** if the speaker is still turning or looking at the out point, extend `end` to the end of the movement (at most 0.8 s past the last word).
7. **Long wides:** any dialogue shot over 6 s gets a change at the next speaker change or on the claim: a static punch-in (`zoom` 1.25-1.35, start = end, `focus` on the speaker) or a jump cut in a gap of 0.6 s or more. Never a static wide over 7 s. Once per episode, a static snap to 1.6-1.8 on the stunned listener.
8. **Confessionals:** 1.8-4.8 s (median 3.0), static and centred, cut in right after the scene's claim; relays of 2-3 confessionals at 2-4 s each work well.
9. **Performed pauses:** a silent reaction at the head of a confessional is `beat: reaction` (kept 0.6-1.3 s); a gap that holds a gesture inside a line is kept at 0.6-1.0 s (write "beat" in the purpose); only empty gaps over 0.75 s are cut. Reactions after a gag are capped at 1.5 s.
10. **Deadpan tail:** after a confessional punchline keep 0.4-0.6 s of the held pose.
11. **Ending:** the button plus 0.4-0.8 s; plan the episode at 58 s or less.
12. **Subtitles:** `translate` into English, small white semibold, sentence case, no box, at about 70% of the height, 3-6 words built word by word; every swear starred; a dialogue dash when two speakers share a line.
13. **Music:** dry under scene dialogue. A bed (`medium` with duck `light`, about 8-10 dB under the voice) may enter on a silent comic beat, a montage or a workout and carry the closing confessional.
14. **Reveal special** (a new character): music only, a cut every two beats with a 2-3 frame `glitch` on each, slow pushes of 1.06-1.2, about 2 s of silence before the reveal, the name `hero` within 1.5 s of the person being framed, an end card of 3.5 s at most.
15. **App ad or teaser:** first word by 0.3 s, a caption from frame 0, a cut every 1.0-1.5 s on the beat, jump cuts within 0.03 s of the phrase edges, an end card of 1.0-1.5 s.

## Against the current skills
- **insta-series "Dynamic first"** (a change every 1-2 s, a slow push on every shot over 2 s): 0 of 14 episodes do it; median story shot 4-5 s, locked-off mockumentary look. Keep static punch-ins and jump cuts inside long wides instead; keep pushes for the specials and montages.
- **insta-series "remove pauses over 0.3 s"**: wrong for this show (it keeps 0.25-0.45 s and performs pauses of 0.67-1.9 s). office-comedy-reels' and clean-comedy-edit's "keep 0.25-0.45 s, remove gaps over about 0.9 s" is right, with the performed-pause exception.
- **insta-series comic freezes with a hit and a title_3d, and endings with "EPISODE N+1 TOMORROW" plus a follow pill**: 0 of 14. office-comedy-reels is right: the show ends on the laugh.
- **insta-series "never spend 5 s on the intro" and "hook before the title"**: right, and the biggest single fix available (5.3 s with no words in a 30-60 s reel).
- **office-comedy-reels length (60-100 s) and confessionals of 3-8 s**: The Boyz runs 25-60 s with confessionals of 1.8-4.8 s; insta-series' 25-45 s and 2-5 s are right.
- **office-comedy-reels and clean-comedy-edit "split edits are automatic"**: 0 split edits in about 85 story cuts here.
- **office-comedy-reels "no music under confessionals"**: 7 of 14 bring a low bed in under the closing confessional on a comic beat; allow it.
- **Caption specs disagree between the three skills**; the newest episodes support sentence case, 3-6 words, about 70% of the height.
- **The engine's trim pass** ("never trims a reaction", 0.45 s before a punchline, pauses over 0.75 s cut): needs a 1.5 s cap on reactions and protection for performed pauses (rules 9-10).

## What the engine can't do yet
- **Turn the automatic split edits off** for a show that never uses them (no plan field; the only workaround is labelling the outgoing line `punchline`).
- **Per-segment padding** for snaps (fixed 0.12 s / 0.2 s; two shots always keep at least 0.32 s between them).
- **Tell a performed pause from dead air** without the planner labelling it.
- **Find cut points in the picture:** a body crossing the lens, the key frame of an action, the end of a head turn (the planner sees contact sheets, not motion).
- **Pans between speakers and whip pans** (`focus` is static per segment), a true x2.4 snap zoom in 0.4 s, the dim dusty freeze card with a typewriter serif card, the 3-face split screen, the scrambled-letter "decode" typewriter.

## Measurement notes
- Cut times are exact (the duplicate Ep 03 repeats all 11 cuts to the hundredth); about 2 cuts missed in 19 reels (a whip pan, an eye close-up in the ad) and 12 false cuts in DeHmgbaR-Xv's dusty freeze cards (its raw numbers read 6.4 cuts per 10 s for about 3.3).
- Labels: about 25 title jump cuts read as "new", 5 changes of character in the same confessional chair read as "jump"; the size ratio on "new" cuts is noise. The glitches and light-burst flashes of the specials have no class of their own.
- Freezes: most "freezes" in the episodes are actors holding still; the corrected measure keeps only pixel-identical frames.
- Whisper invented "We'll see you next time" over singing (DevG7qfsMU_), and the text reader counts book spines on the confessional shelf as on-screen text, inflating the text numbers.
- The "spoken words shown as captions" number is low here only because the subtitles are English translations of French speech: the measure matches on-screen words to the spoken (French) words. By eye, 13 of 14 episodes are subtitled.
