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

// The character sheet's yellows, a little deeper at the roots so the fur has depth.
const COLORS = { root: "#c98e08", mid: "#f2b41a", tip: "#ffd23f", sheen: "#fff1b8", eyeWhite: "#f2f2ea", eyeBlack: "#111111" };
const SHELLS = 40;
const FUR = 0.075;
const EYE_R = 0.27;

const EARS = [-1, 1].map((side) => ({ side, dir: new THREE.Vector3(side * 0.5, 0.86, 0.1).normalize() }));
const FEET = [-1, 1].map((side) => new THREE.Vector3(side * 0.42, -0.8, 0.46).normalize());
const EYES = [-1, 1].map((side) => new THREE.Vector3(side * 0.36, -0.08, 0.93).normalize());

const angle = (a: THREE.Vector3, b: THREE.Vector3) => Math.acos(Math.min(1, Math.max(-1, a.dot(b))));

// The body's surface in a direction: an egg, wider low down, with the ears and the feet pulled out
// of it and a flat bottom to sit on. Also says how much of an ear the point is, for the twitch.
function surface(dir: THREE.Vector3, out: THREE.Vector3) {
  const wide = 1 + 0.12 * Math.max(0, -dir.y) - 0.05 * Math.max(0, dir.y);
  out.set(dir.x * wide, dir.y * 1.08, dir.z * 0.88 * wide);
  // A rounded crown between the ears, not a peak.
  if (out.y > 0.78) out.y = 0.78 + (out.y - 0.78) * 0.55;
  let ear = 0;
  let side = 0;
  for (const e of EARS) {
    const d = angle(dir, e.dir);
    if (d >= 0.46) continue;
    const k = (1 - d / 0.46) ** 1.45;
    out.x += dir.x * k * 0.46;
    out.y += dir.y * k * 0.66;
    out.z += dir.z * k * 0.16;
    if (k > ear) [ear, side] = [k, e.side];
  }
  for (const f of FEET) {
    const d = angle(dir, f);
    if (d < 0.4) out.addScaledVector(f, (1 - d / 0.4) ** 2 * 0.2);
  }
  if (out.y < -0.9) out.y = -0.9 + (out.y + 0.9) * 0.25;
  return { ear, side };
}

// The body, with normals taken from the shape itself, so the sphere's seam never shows in the fur.
function bodyGeometry() {
  const g = new THREE.SphereGeometry(1, 72, 56);
  const pos = g.attributes.position;
  const normals = new Float32Array(pos.count * 3);
  const ears = new Float32Array(pos.count);
  const sides = new Float32Array(pos.count);
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
  }
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  g.setAttribute("ear", new THREE.BufferAttribute(ears, 1));
  g.setAttribute("side", new THREE.BufferAttribute(sides, 1));
  return g;
}

const FUR_VERTEX = /* glsl */ `
attribute float ear;
attribute float side;
uniform float uShell;
uniform float uLength;
uniform float uTwitch;
uniform vec3 uSag;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 p = position;
  if (ear > 0.0) {
    float a = uTwitch * side * ear;
    p.x += sin(a) * max(p.y - 0.55, 0.0) * 1.6;
    p.y -= (1.0 - cos(a)) * 0.4 * ear;
  }
  vec3 n = normalize(normal);
  p += n * uLength * uShell + uSag * uShell * uShell;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  vNormal = normalize(normalMatrix * n);
  vUv = uv;
  gl_Position = projectionMatrix * mv;
}`;

const FUR_FRAGMENT = /* glsl */ `
uniform float uShell;
uniform vec3 uRoot;
uniform vec3 uMid;
uniform vec3 uTip;
uniform vec3 uSheen;
uniform vec3 uLight;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vView;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
void main() {
  vec2 st = vUv * vec2(420.0, 210.0);
  vec2 cell = floor(st);
  float h = 0.55 + 0.45 * hash(cell);
  if (uShell > 0.0) {
    if (uShell > h) discard;
    vec2 c = fract(st) - 0.5 - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.35;
    float r = 0.62 * (1.0 - uShell / h);
    if (dot(c, c) > r * r) discard;
  }
  vec3 base = mix(uRoot, uMid, smoothstep(0.0, 0.4, uShell));
  base = mix(base, uTip, smoothstep(0.35, 0.95, uShell));
  base *= 0.88 + 0.24 * hash(cell + 17.0);
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vView);
  float diffuse = 0.74 + 0.5 * max(dot(N, uLight), 0.0);
  float ao = mix(0.62, 1.0, uShell);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.4);
  vec3 col = base * diffuse * ao + uSheen * rim * (0.25 + 0.75 * uShell);
  gl_FragColor = vec4(col, 1.0);
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
    const material = new THREE.ShaderMaterial({ vertexShader: FUR_VERTEX, fragmentShader: FUR_FRAGMENT, uniforms: { ...shared, uShell: { value: i / (SHELLS - 1) } } });
    shellMaterials.push(material);
    const shell = new THREE.Mesh(body, material);
    shell.renderOrder = i;
    rig.add(shell);
  }

  // Googly eyes: a glossy white bowl each, a big black lens free to roll inside it.
  const whiteMaterial = new THREE.MeshPhysicalMaterial({ color: COLORS.eyeWhite, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.04 });
  const blackMaterial = new THREE.MeshPhysicalMaterial({ color: COLORS.eyeBlack, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0.1 });
  const eyeGeometry = new THREE.SphereGeometry(1, 40, 28);
  const p = new THREE.Vector3();
  const eyes = EYES.map((dir, i) => {
    surface(dir, p);
    const eye = new THREE.Group();
    eye.position.copy(p).multiplyScalar(0.97);
    eye.lookAt(eye.position.clone().add(dir));
    const white = new THREE.Mesh(eyeGeometry, whiteMaterial);
    white.scale.set(EYE_R, EYE_R, EYE_R * 0.86);
    const pupil = new THREE.Mesh(eyeGeometry, blackMaterial);
    pupil.scale.set(EYE_R * 0.6, EYE_R * 0.6, EYE_R * 0.26);
    eye.add(white, pupil);
    rig.add(eye);
    return { pupil, at: new THREE.Vector2(), speed: new THREE.Vector2(), stiffness: i ? 70 : 82 };
  });

  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.93;
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

  const clock = new THREE.Clock();
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
    const t = clock.getElapsedTime();
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
    rig.position.y = -0.93 * (1 - sy);
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
      want.set(goal.x * 0.55, goal.y * 0.5).sub(eye.at);
      eye.speed.addScaledVector(want, eye.stiffness * dt);
      if (h >= 0 && h < 1) eye.speed.y -= Math.cos(Math.PI * h) * 2.2 * dt;
      eye.speed.multiplyScalar(Math.exp(-dt * 7));
      eye.at.addScaledVector(eye.speed, dt);
      const r = eye.at.length();
      if (r > 0.58) {
        eye.at.multiplyScalar(0.58 / r);
        eye.speed.multiplyScalar(-0.4);
      }
      const { x, y: v } = eye.at;
      const z = Math.sqrt(Math.max(0, 1 - x * x - v * v));
      forward.set(x, v, z);
      eye.pupil.position.copy(forward).multiplyScalar(EYE_R * 0.8);
      eye.pupil.position.z *= 0.86;
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
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      body.dispose();
      eyeGeometry.dispose();
      shadow.geometry.dispose();
      shadowMaterial.map?.dispose();
      shadowMaterial.dispose();
      for (const m of [...shellMaterials, whiteMaterial, blackMaterial]) m.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
