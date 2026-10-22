# Skills

The studio's playbook for every agent: the edit engine's editor, sound designer and trend researcher, and the app's brand strategist, content planner, scriptwriter and motion director. Each one is a folder holding a `SKILL.md`, in the same layout as Claude's Agent Skills:

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
- **`agents`** says who reads the skill, one or several, comma-separated:
  - on the edit engine: `editor` (the default, the agent that plans the cut), `sound` (the sound designer, who scores the cut afterwards) and `researcher` (the trend researcher, who studies a niche's top reels);
  - in the app: `strategist` (the brand strategist), `planner` (the month's content plan), `scriptwriter` and `motion` (the motion director).

  The app reads this same folder, so a skill for an app agent applies after the next deploy; the Agents app lists every agent's skills. Opt-in skills (with `when:`) are for the edit engine only.

Skills are read fresh for every job, so a new or edited skill applies to the next edit with no restart. The Mac background service runs from its own copy of the engine, so after changing skills here, run `engine/scripts/mac-service.sh update`. Alternatively, point `ENGINE_SKILLS_DIR` at a folder of your choice.

A skill with broken front matter is skipped, and the engine log says why. The log line `skills: …` lists which skills each job used.

## Writing a good skill

- **Write only what the engine can do.**
  - **Picture:** cut, add transitions (crossfade, dip to black or white, slide, wipe, zoom, circle, glitch), change speed, punch in or push in, reframe on a focus point, fix white balance, exposure and color per shot, apply an overall look.
  - **Text:**
    - word-timed automatic captions in six styles, including TV-series subtitles
    - English subtitles translated from speech in another language, built up word by word
    - animated titles, hero words, serif accents, stacked or boxed headlines, and dripping series logos, optionally behind the person
  - **Graphics:** comment bubbles, follow buttons, progress bars, counters, emojis, drawn circles.
  - **Overlays:** B-roll cutaways over the voice, floating clip or screenshot cards.
  - **Motion (3D):** freeze frames with character intros, cast lineups, kinetic 3D titles, 3D stat cards and 3D name plates (see motion-graphics).
  - **Sound:** the sound designer picks music from the studio's picks, FreePD, Mixkit, Incompetech and the studio's Google Drive libraries, lines a drop or the ending up with the cut, ducks it under speech (light, normal or deep), and adds built-in or recorded sound effects. It recommends the trending sound to add when posting, from the researcher's findings.
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
