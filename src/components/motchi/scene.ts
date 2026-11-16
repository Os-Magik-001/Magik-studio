import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Motchi in 3D (WebGL), on the studio's character sheet: a pear of golden fur with two cat ears,
// two stubby feet and big googly eyes; no mouth, no arms. The fur is drawn as shells: copies of the
// body pushed out along its normals, each keeping only the strands tall enough to reach it. His
// eyes follow the pointer with a googly lag; the Dock's Motchi (./motchi.tsx) asks him to hop, look
// around, wiggle his ears or think. Framework-free, so the page loads three.js only when he appears.

export type MotchiMove = "hop" | "look" | "wiggle" | "happy";
export type MotchiScene = {
  play: (move: MotchiMove) => void;
  think: (on: boolean) => void;
  // A point on the screen to look at, or null to follow the pointer.
  gaze: (point: { x: number; y: number } | null) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
};

// The character sheet's palette: primary yellow at the tips, its shadow yellows toward the roots.
const COLORS = { root: "#bd8a0c", mid: "#eab220", tip: "#fbd04e", sheen: "#fff0b8", eyeWhite: "#f2f2ea", eyeBlack: "#0c0c0d" };
const SHELLS = 52;
const FUR = 0.1;
const EYE_R = 0.235;
// How far the white of an eye rises out of the coat: a shallow dome, as on the sheet, not a ball.
const EYE_DOME = 0.58;
// Where he stands: the soles of his feet.
const GROUND = -1.06;

// Small rounded ears set close on the crown, two stubby feet under the front, eyes at mid height.
const EARS = [-1, 1].map((side) => ({ side, dir: new THREE.Vector3(side * 0.43, 0.9, 0.04).normalize() }));
const FEET = [-1, 1].map((side) => new THREE.Vector3(side * 0.4, -0.86, 0.32).normalize());
const EYES = [-1, 1].map((side) => new THREE.Vector3(side * 0.35, 0.03, 0.935).normalize());

const angle = (a: THREE.Vector3, b: THREE.Vector3) => Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
// A bump that is round on top and melts into the body at its edge.
const bump = (d: number, radius: number, power: number) => (d >= radius ? 0 : Math.cos((d / radius) * (Math.PI / 2)) ** power);

// The body's surface in a direction: a plush pear, widest below the middle with a narrower
// dome, the ears and the feet pulled out of it. Also says how much of an ear the point is, for
// the twitch.
function surface(dir: THREE.Vector3, out: THREE.Vector3) {
  const up = Math.max(0, dir.y);
  const down = Math.max(0, -dir.y);
  const wide = 1 + 0.1 * down - 0.13 * up * up;
  out.set(dir.x * wide, dir.y * 1.1, dir.z * 0.92 * wide);
  let ear = 0;
  let side = 0;
  for (const e of EARS) {
    const k = bump(angle(dir, e.dir), 0.37, 1.7);
    if (!k) continue;
    out.addScaledVector(e.dir, k * 0.4);
    if (k > ear) [ear, side] = [k, e.side];
  }
  for (const f of FEET) {
    const k = bump(angle(dir, f), 0.4, 1.4);
    if (!k) continue;
    out.x += f.x * k * 0.07;
    out.y -= k * 0.24;
    out.z += k * 0.22;
  }
  // Flat soles to stand on.
  if (out.y < GROUND + 0.04) out.y = GROUND + 0.04 + (out.y - GROUND - 0.04) * 0.15;
  return { ear, side };
}

// The body, with normals taken from the shape itself, so the sphere's seam never shows in the fur.
function bodyGeometry() {
  const g = new THREE.SphereGeometry(1, 120, 88);
  const pos = g.attributes.position;
  const normals = new Float32Array(pos.count * 3);
  const ears = new Float32Array(pos.count);
  const sides = new Float32Array(pos.count);
  // How long the coat is at each point: short around the eyes, so it frames them instead of
  // covering them, and under the feet.
  const trims = new Float32Array(pos.count);
  const v = new THREE.Vector3();
  const p = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const t1 = new THREE.Vector3();
  const t2 = new THREE.Vector3();
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const e = surface(v, p);
    t1.crossVectors(v, Math.abs(v.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    t2.crossVectors(v, t1);
    surface(a.copy(v).addScaledVector(t1, 0.01).normalize(), pa);
    surface(b.copy(v).addScaledVector(t2, 0.01).normalize(), pb);
    const n = new THREE.Vector3().crossVectors(pa.sub(p), pb.sub(p)).normalize();
    if (n.dot(p) < 0) n.negate();
    pos.setXYZ(i, p.x, p.y, p.z);
    normals.set([n.x, n.y, n.z], i * 3);
    ears[i] = e.ear;
    sides[i] = e.side;
    const eye = Math.min(...EYES.map((d) => angle(v, d)));
    const nearEye = Math.min(1, Math.max(0, (eye - 0.17) / 0.2));
    const sole = Math.min(1, Math.max(0, (p.y - GROUND) / 0.16));
    trims[i] = (0.22 + 0.78 * nearEye * nearEye) * (0.35 + 0.65 * sole);
  }
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  g.setAttribute("ear", new THREE.BufferAttribute(ears, 1));
  g.setAttribute("side", new THREE.BufferAttribute(sides, 1));
  g.setAttribute("trim", new THREE.BufferAttribute(trims, 1));
  return g;
}

// Each shell is the body pushed out along its normals. The strands lean a little, each tuft its
// own way, and hang slightly under their weight, so the coat looks brushed rather than spiky.
const FUR_VERTEX = /* glsl */ `
attribute float ear;
attribute float side;
attribute float trim;
uniform float uShell;
uniform float uLength;
uniform float uTwitch;
uniform vec3 uSag;
varying vec3 vBase;
varying vec3 vObjNormal;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 p = position;
  vBase = position;
  if (ear > 0.0) {
    float a = uTwitch * side * ear;
    p.x += sin(a) * max(p.y - 0.75, 0.0) * 1.6;
    p.y -= (1.0 - cos(a)) * 0.3 * ear;
  }
  vec3 n = normalize(normal);
  vObjNormal = n;
  vec3 lean = vec3(sin(position.y * 7.0 + position.z * 5.0), -0.35, cos(position.x * 6.0 - position.y * 4.0));
  lean -= n * dot(lean, n);
  p += (n * uLength * uShell + (uSag + lean * 0.02) * uShell * uShell) * trim;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  vNormal = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * mv;
}`;

// The strands live in small cells of space, not of the sphere's own grid, so they are as dense
// on the ears and the crown as on the belly. Each one is a column that thins toward its tip.
const FUR_FRAGMENT = /* glsl */ `
uniform float uShell;
uniform vec3 uRoot;
uniform vec3 uMid;
uniform vec3 uTip;
uniform vec3 uSheen;
uniform vec3 uLight;
varying vec3 vBase;
varying vec3 vObjNormal;
varying vec3 vNormal;
varying vec3 vView;
float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
void main() {
  vec3 q = vBase * 84.0;
  vec3 cell = floor(q);
  float h = 0.5 + 0.5 * hash(cell);
  float alpha = 1.0;
  if (uShell > 0.0) {
    if (uShell > h) discard;
    vec3 jitter = (vec3(hash(cell + 1.7), hash(cell + 5.3), hash(cell + 9.1)) - 0.5) * 0.5;
    vec3 d = fract(q) - 0.5 - jitter;
    vec3 n = normalize(vObjNormal);
    d -= n * dot(d, n);
    float r = 0.56 * (1.0 - 0.78 * uShell / h);
    alpha = 1.0 - smoothstep(r * 0.5, r, length(d));
    if (alpha < 0.04) discard;
  }
  vec3 base = mix(uRoot, uMid, smoothstep(0.0, 0.45, uShell));
  base = mix(base, uTip, smoothstep(0.4, 1.0, uShell));
  base *= 0.9 + 0.2 * hash(cell + 17.0);
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vView);
  float ndl = dot(N, uLight);
  // Soft light that wraps around him, darker deep in the coat and near the floor.
  float wrap = clamp((ndl + 0.65) / 1.65, 0.0, 1.0);
  float floorShade = mix(0.7, 1.0, smoothstep(-1.1, -0.25, vBase.y));
  float depth = mix(0.66, 1.0, uShell);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.2);
  vec3 col = base * (0.54 + 0.72 * wrap) * depth * floorShade;
  col += uSheen * (rim * 0.34 + pow(max(ndl, 0.0), 5.0) * 0.1) * uShell;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

// A soft round shadow on the ground under him.
function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(0,0,0,0.55)");
  r.addColorStop(0.55, "rgba(0,0,0,0.22)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const smooth = (x: number) => x * x * (3 - 2 * x);

export function createMotchi(canvas: HTMLCanvasElement, { reducedMotion = false } = {}): MotchiScene {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.add(new THREE.HemisphereLight(0xfff4dd, 0x3a2a10, 0.6));

  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
  camera.position.set(0, 0.25, 8.2);
  camera.lookAt(0, 0.12, 0);
  camera.updateMatrixWorld();

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  scene.add(root);

  // Fur.
  const body = bodyGeometry();
  const light = new THREE.Vector3(-0.45, 0.75, 0.5).normalize();
  const shared = {
    uLength: { value: FUR },
    uTwitch: { value: 0 },
    uSag: { value: new THREE.Vector3(0, -0.04, 0) },
    uRoot: { value: new THREE.Color(COLORS.root) },
    uMid: { value: new THREE.Color(COLORS.mid) },
    uTip: { value: new THREE.Color(COLORS.tip) },
    uSheen: { value: new THREE.Color(COLORS.sheen) },
    uLight: { value: light.clone().transformDirection(camera.matrixWorldInverse) },
  };
  const shellMaterials: THREE.ShaderMaterial[] = [];
  for (let i = 0; i < SHELLS; i++) {
    // The strands' soft edges are resolved by the antialiasing samples (alpha to coverage).
    const material = new THREE.ShaderMaterial({ vertexShader: FUR_VERTEX, fragmentShader: FUR_FRAGMENT, alphaToCoverage: i > 0, uniforms: { ...shared, uShell: { value: i / (SHELLS - 1) } } });
    shellMaterials.push(material);
    const shell = new THREE.Mesh(body, material);
    shell.renderOrder = i;
    rig.add(shell);
  }

  // The strands' soft edges leave the picture a little see-through where they overlap the body.
  // One last pass over the body's own outline makes it solid again (it writes no colour), so
  // only the fringe of the coat stays soft against whatever is behind him.
  const solid = new THREE.Mesh(
    body,
    new THREE.MeshBasicMaterial({
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.ZeroFactor,
    }),
  );
  solid.renderOrder = SHELLS + 10;
  rig.add(solid);

  // Googly eyes: a glossy white bowl each, a big black lens free to roll inside it.
  const whiteMaterial = new THREE.MeshPhysicalMaterial({ color: COLORS.eyeWhite, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.08 });
  const blackMaterial = new THREE.MeshPhysicalMaterial({ color: COLORS.eyeBlack, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0.1 });
  const eyeGeometry = new THREE.SphereGeometry(1, 40, 28);
  const p = new THREE.Vector3();
  const glints: THREE.Mesh[] = [];
  const eyes = EYES.map((dir, i) => {
    surface(dir, p);
    const eye = new THREE.Group();
    // Set into the coat, so the fur closes around each eye.
    eye.position.copy(p).multiplyScalar(0.965);
    eye.lookAt(eye.position.clone().add(dir));
    const white = new THREE.Mesh(eyeGeometry, whiteMaterial);
    white.scale.set(EYE_R, EYE_R, EYE_R * EYE_DOME);
    // A big glossy lens, as on the sheet, with two points of light on it.
    const pupil = new THREE.Mesh(eyeGeometry, blackMaterial);
    pupil.scale.set(EYE_R * 0.7, EYE_R * 0.7, EYE_R * 0.22);
    for (const [x, y, size, opacity] of [[-0.34, 0.4, 0.17, 0.95], [0.3, -0.28, 0.07, 0.6]] as const) {
      const glint = new THREE.Mesh(eyeGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity }));
      glint.position.set(x, y, Math.sqrt(1 - x * x - y * y) * 0.98);
      glint.scale.set(size, size, size * 0.4);
      glints.push(glint);
      pupil.add(glint);
    }
    eye.add(white, pupil);
    rig.add(eye);
    return { pupil, at: new THREE.Vector2(), speed: new THREE.Vector2(), stiffness: i ? 70 : 82 };
  });

  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = GROUND;
  scene.add(shadow);

  // ------------------------------------------------------------ behaviour

  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const onPointer = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  let gazePoint: { x: number; y: number } | null = null;
  let thinking = false;
  const moves: MotchiMove[] = [];
  let hopAt = -10;
  let wiggleAt = -10;
  let lookAt = -10;
  let nextTwitch = 3 + Math.random() * 4;
  const turn = new THREE.Vector2();

  const target = new THREE.Vector2();
  function gazeTarget(t: number) {
    if (t - lookAt < 2.2) {
      const k = t - lookAt;
      return target.set(k < 0.7 ? -0.85 : k < 1.5 ? 0.85 : 0, 0.12);
    }
    if (thinking) return target.set(0.32 * Math.cos(t * 1.6), 0.5 + 0.12 * Math.sin(t * 1.6));
    const rect = canvas.getBoundingClientRect();
    const to = gazePoint ?? pointer;
    const dx = (to.x - (rect.left + rect.width / 2)) / 420;
    const dy = (to.y - (rect.top + rect.height * 0.45)) / 320;
    return target.set(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, -dy)));
  }

  const timer = new THREE.Timer();
  let frame = 0;
  let last = 0;
  let hidden = document.visibilityState === "hidden";
  const onVisibility = () => {
    hidden = document.visibilityState === "hidden";
  };
  document.addEventListener("visibilitychange", onVisibility);

  const forward = new THREE.Vector3();
  const front = new THREE.Vector3(0, 0, 1);
  const want = new THREE.Vector2();
  function tick() {
    frame = requestAnimationFrame(tick);
    if (hidden) return;
    timer.update();
    const t = timer.getElapsed();
    const busy = t - hopAt < 1.6 || t - wiggleAt < 1.2 || t - lookAt < 2.2 || thinking;
    if (t - last < (busy ? 1 / 60 : 1 / 30) - 0.002) return;
    const dt = Math.min(0.05, t - last);
    last = t;

    for (const move of moves.splice(0)) {
      if (move === "hop") hopAt = t;
      if (move === "wiggle") wiggleAt = t;
      if (move === "look") lookAt = t;
      if (move === "happy") [hopAt, wiggleAt] = [t, t + 0.35];
    }
    if (t > nextTwitch) {
      wiggleAt = t;
      nextTwitch = t + 4 + Math.random() * 6;
    }

    // Hop: crouch, spring up stretched, land squashed, settle.
    let y = 0;
    let sy = 1 + (reducedMotion ? 0 : 0.012 * Math.sin(t * 2.2));
    const h = (t - hopAt) / 0.8;
    if (!reducedMotion && h >= 0 && h < 1) {
      if (h < 0.16) sy -= 0.14 * smooth(h / 0.16);
      else if (h < 0.8) {
        const k = (h - 0.16) / 0.64;
        y = 0.24 * Math.sin(Math.PI * k);
        sy += 0.1 * (1 - k) - 0.06 * k;
      } else sy -= 0.1 * Math.sin(Math.PI * ((h - 0.8) / 0.2));
    }
    root.position.y = y;
    rig.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    rig.position.y = GROUND * (1 - sy);
    shadow.scale.setScalar(1 - y * 0.9);
    shadowMaterial.opacity = 1 - y * 1.6;

    // Ears twitch, fur tips drag behind the motion.
    const w = t - wiggleAt;
    shared.uTwitch.value = w >= 0 && w < 1.2 ? 0.32 * Math.sin(w * 26) * Math.exp(-w * 5) : 0;
    shared.uSag.value.set(-turn.x * 0.02, -0.04 - (h >= 0 && h < 1 ? 0.03 * Math.cos(Math.PI * h) : 0), 0);

    // Eyes: each lens springs toward where he looks, rolls to the rim and bounces off it.
    const goal = gazeTarget(t);
    turn.lerp(goal, 1 - Math.exp(-dt * 3));
    rig.rotation.y = turn.x * 0.32;
    rig.rotation.x = -turn.y * 0.1;
    rig.rotation.z = reducedMotion ? 0 : 0.025 * Math.sin(t * 0.8);
    for (const eye of eyes) {
      want.set(goal.x * 0.34, goal.y * 0.3).sub(eye.at);
      eye.speed.addScaledVector(want, eye.stiffness * dt);
      if (h >= 0 && h < 1) eye.speed.y -= Math.cos(Math.PI * h) * 2.2 * dt;
      eye.speed.multiplyScalar(Math.exp(-dt * 7));
      eye.at.addScaledVector(eye.speed, dt);
      const r = eye.at.length();
      // The lens rolls to the edge of the white and no further.
      if (r > 0.33) {
        eye.at.multiplyScalar(0.33 / r);
        eye.speed.multiplyScalar(-0.4);
      }
      const { x, y: v } = eye.at;
      const z = Math.sqrt(Math.max(0, 1 - x * x - v * v));
      // The lens rides the dome of the white and faces out of it.
      eye.pupil.position.set(x * EYE_R * 0.96, v * EYE_R * 0.96, z * EYE_R * EYE_DOME * 0.94);
      forward.set(x, v, z / EYE_DOME).normalize();
      eye.pupil.quaternion.setFromUnitVectors(front, forward);
    }
    renderer.render(scene, camera);
  }

  function resize(width: number, height: number) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize(canvas.clientWidth || 140, canvas.clientHeight || 160);
  frame = requestAnimationFrame(tick);

  return {
    play: (move) => {
      moves.push(move);
    },
    think: (on) => {
      thinking = on;
    },
    gaze: (point) => {
      gazePoint = point;
    },
    resize,
    dispose: () => {
      cancelAnimationFrame(frame);
      timer.dispose();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      body.dispose();
      eyeGeometry.dispose();
      shadow.geometry.dispose();
      shadowMaterial.map?.dispose();
      shadowMaterial.dispose();
      for (const m of [...shellMaterials, solid.material, whiteMaterial, blackMaterial, ...glints.map((g) => g.material as THREE.Material)]) m.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
