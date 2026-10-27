---
name: screen-zoom-entry
description: Zooming through a screen in the footage (a monitor, a laptop, a phone) into the website or app it shows, and back out, as one continuous camera move
formats: social_short, ad
style: dynamic
agents: editor, motion
when: website, site web, screen, écran, portfolio, monitor
---

First made for the Magik Management portfolio demo (October 2026). The camera pushes into the monitor until the website fills the frame, the room falls away to black, the site's own elements come alive in 3D, then the camera pulls back out into another shot of the room.

**Tracking the screen**
- Capture the live page at the same viewport as the screen in the footage (1920 x 1080 was right) and match it to each frame with SIFT features on the page content: about 1,100 matches a frame give the screen's homography directly. The fixed nav bar tells the footage's own scroll position.
- Only track a stretch where the page is still (no scroll, no hover): matches collapse when cards dim or the page moves. A slow, stretched stretch of footage (0.56x) is fine under a push.
- Fit each corner to a smooth curve over the window (the camera drifts; raw tracking jitters 5-15 px).

**The move**
- One homography for the whole frame, its four corners blended from the normal framing to a face-on view of the page, at an even rate of scale (blend weight w = (r^e - 1) / (r - 1) with r the scale ratio); ease half sine, half cubic so the move starts at once and lands softly.
- From halfway, swap the filmed screen for a crisp capture of the same page (2x) and let the page extend past the bezel while the room darkens: at the end the site floats in black, full width.
- Land on a music hit, then hand over to a 3D camera placed to match the face-on view exactly (distance = 960 / (k · tan 15°) for a 30° field of view, k = output pixels per page pixel), so the switch is invisible.
- Coming out: the same in reverse into another take, with the screen's nav bar faded back in.

**Inside the site**: the page's cards can lift off as real 3D phones playing their own videos (the page dims and blurs behind them, soft shadows under each), the camera glides to one, which fills the frame for 1-2 s, then everything settles back flush before the zoom out.

**Sound**: a riser into the push, a deep impact on the landing, a whoosh on the way out. Motion blur on every frame of the move (6-8 subframes).
