// The motion page: the engine calls setup(spec) once per graphic, then renderAt(t)
// for every frame and takes a screenshot. Nothing animates on its own (no CSS
// transitions, no requestAnimationFrame), so every frame is exactly reproducible.

const templates = {
  character_intro: () => import("./templates/character-intro.js"),
  cast_lineup: () => import("./templates/cast-lineup.js"),
  title_3d: () => import("./templates/title-3d.js"),
  stat_card: () => import("./templates/stat-card.js"),
  lower_third_3d: () => import("./templates/lower-third-3d.js"),
};

let current = null;

window.setup = async (spec) => {
  const root = document.getElementById("root");
  root.innerHTML = "";
  root.style.width = `${spec.W}px`;
  root.style.height = `${spec.H}px`;
  // One transparent pixel column keeps every screenshot RGBA: Chrome drops the alpha channel
  // of fully opaque frames, and a format switch mid-sequence breaks ffmpeg's compositing.
  root.style.clipPath = "inset(0 0 0 1px)";
  // Fonts first: templates measure text to fit it.
  await Promise.all([...document.fonts].map((f) => f.load().catch(() => {})));
  const mod = await templates[spec.template]();
  current = await mod.default(root, spec);
  await document.fonts.ready;
  await Promise.all([...root.querySelectorAll("img")].map((img) => img.decode().catch(() => {})));
  return true;
};

window.renderAt = (t) => current.frame(t);
window.ready = true;
