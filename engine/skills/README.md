# Editing skills

These are the house techniques the edit engine gives Claude on every edit. Each one is a folder holding a `SKILL.md`, in the same layout as Claude's Agent Skills:

```markdown
---
name: punch-ins-and-reframing
description: When to punch in, push in and reframe a shot
formats: all
---

The technique, written the way you would brief a human editor.
```

- **`name`** is the skill's name. It defaults to the folder name.
- **`description`** is one line saying what the skill covers. It's required.
- **`formats`** says which videos the skill applies to: `all` (the default), or a comma-separated list of `social_short`, `ad` and `podcast_clip`.
- **`enabled`** can be set to `false` to switch a skill off without deleting it.

Skills are read fresh for every job, so a new or edited skill applies to the next edit with no restart. The Mac background service runs from its own copy of the engine, so after changing skills here, run `engine/scripts/mac-service.sh update`. Alternatively, point `ENGINE_SKILLS_DIR` at a folder of your choice.

A skill with broken front matter is skipped, and the engine log says why. The log line `skills: …` lists which skills each job used.

## Writing a good skill

- **Write only what the engine can do.**
  - **Picture:** cut, add transitions (crossfade, dip to black or white, slide, wipe, zoom, circle, glitch), change speed, punch in or push in, reframe on a focus point, fix exposure and color per shot, apply an overall look.
  - **Text:**
    - word-timed automatic captions in six styles, including TV-series subtitles
    - English subtitles translated from speech in another language, built up word by word
    - animated titles, hero words, serif accents, stacked or boxed headlines, and dripping series logos, optionally behind the person
  - **Graphics:** comment bubbles, follow buttons, progress bars, counters, emojis, drawn circles.
  - **Overlays:** B-roll cutaways over the voice, floating clip or screenshot cards.
  - **Motion (3D):** freeze frames with character intros, cast lineups, kinetic 3D titles, 3D stat cards and 3D name plates (see motion-graphics).
  - **Sound:** a music bed from the library that dips under speech, synthesized sound effects.
  - **Ending:** a branded end card.
  - **Not possible yet:** fully animated scenes such as 3D product renders or app mock-ups.
- **Use concrete numbers.** "Hold the product 1.5s after it lands" works; "let it breathe" doesn't.
- **Expect to be overridden.** The brand kit, the script and the editor's notes always beat a skill.
- **Keep each skill short and on one topic.** All matching skills go into every edit's instructions, so long skills cost tokens on every job.

The starting set was distilled, not copied, from these sources:

- **The editing plugins installed in Claude Code:** video-shotcraft, video-cleanup, adobe-edit-quick-cut, video-processing-editing and ffmpeg-llm.
- **[tenfoldmarc/video-edit-skill](https://github.com/tenfoldmarc/video-edit-skill):** picking takes, talking-head framing, Reels safe zones and looks.
- **[juliandickie/creators-studio](https://github.com/juliandickie/creators-studio)** (MIT): platform limits, ad structures and content-type defaults.
- **About 35 more open-source editing skill repos.** They cover talking-head editors (cut-video, ghost-editor, naive-video-skill, JJKoubo, jtxvideo-skill), short-form and ad editors (favstash, video-editor-agent, tiktok-video-skills, remotion-ads, qingyun-cine-skill), vlog and clipping tools (ai-video-editing-skill, newcut, smart-video-editor, easyedit) and full editors (OpenMontage, OpenChatCut, vex, cartcut). Where they disagreed, the rule kept is the one that most of them, or the measured examples, supported.

Several of those repos are non-commercial or copyleft (CC BY-NC, PolyForm Noncommercial, AGPL, GPL). Only general editing practice was taken from them, rewritten in our own words, and none of their text or code is included here.
