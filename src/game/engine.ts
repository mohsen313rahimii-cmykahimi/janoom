import * as THREE from "three";
import { GameAudio } from "./audio";

export type Phase = "menu" | "playing" | "paused" | "won" | "lost";
export type LostReason = "time" | "hearts" | null;
export type CharId = "fox" | "wolf" | "bear";
export type EnemyKind = "wisp" | "chaser" | "hornet" | "bat" | "boss";

export interface CharacterDef {
  id: CharId;
  name: string;
  title: string;
  desc: string;
  speed: number;
  jump: number;
  hearts: number;
  dashCd: number;
  color: number;
  accent: string;
}

export interface LevelDef {
  id: number;
  title: string;
  region: string;
  desc: string;
  crystals: number;
  time: number;
  killsRequired: number;
  fogFar: number;
  enemies: { kind: EnemyKind; count: number }[];
  hasBoss: boolean;
}

export interface HudData {
  phase: Phase;
  crystals: number;
  total: number;
  hearts: number;
  maxHearts: number;
  time: number;
  score: number;
  portalOpen: boolean;
  lostReason: LostReason;
  timeBonus: number;
  heartsBonus: number;
  kills: number;
  killsRequired: number;
  levelId: number;
  levelName: string;
  charName: string;
  bossHp: number;
  bossMax: number;
}

export interface EngineHooks {
  onHud: (d: HudData) => void;
  onToast: (text: string, tone: "info" | "good" | "bad") => void;
  onMuteToggle: () => void;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: "fox",
    name: "فندق",
    title: "روباه آسمانی",
    desc: "نگهبان تعادل‌یافتهٔ جزیره با شال ستاره‌ای",
    speed: 8.6,
    jump: 10.6,
    hearts: 3,
    dashCd: 1.1,
    color: 0xf4843c,
    accent: "#f4843c",
  },
  {
    id: "wolf",
    name: "تندر",
    title: "گرگ آذرخش",
    desc: "سریع‌ترین دوندهٔ جزیره؛ اما فقط دو جان دارد",
    speed: 10.2,
    jump: 11.8,
    hearts: 2,
    dashCd: 0.85,
    color: 0x5a7bd8,
    accent: "#5a7bd8",
  },
  {
    id: "bear",
    name: "برف",
    title: "خرس سپید",
    desc: "کند اما سرسخت؛ با پنج جان کامل",
    speed: 7.2,
    jump: 9.8,
    hearts: 5,
    dashCd: 1.35,
    color: 0xe8eef7,
    accent: "#e8eef7",
  },
];

export const LEVELS: LevelDef[] = [
  {
    id: 0,
    title: "بیداری بلورها",
    region: "دشت ستاره‌باران",
    desc: "بلورهای ستاره‌ای در دشت پخش شده‌اند. سایه‌وارها هنوز تنبل‌اند.",
    crystals: 8,
    time: 210,
    killsRequired: 0,
    fogFar: 320,
    enemies: [{ kind: "wisp", count: 7 }],
    hasBoss: false,
  },
  {
    id: 1,
    title: "خشم سایه‌ها",
    region: "جنگل شب‌مِه",
    desc: "مه غلیغی جنگل را گرفته؛ شکارچیان سایه بیدار شده‌اند و راه را بسته‌اند.",
    crystals: 12,
    time: 300,
    killsRequired: 8,
    fogFar: 150,
    enemies: [
      { kind: "wisp", count: 6 },
      { kind: "chaser", count: 4 },
      { kind: "hornet", count: 2 },
      { kind: "bat", count: 2 },
    ],
    hasBoss: false,
  },
  {
    id: 2,
    title: "قلعهٔ سایه‌شاه",
    region: "قلمرو تاریکی",
    desc: "سایه‌شاه از دل تاریکی برخاسته. پیش از گشودن دروازه باید او را سرنگون کنی.",
    crystals: 10,
    time: 330,
    killsRequired: 6,
    fogFar: 180,
    enemies: [
      { kind: "wisp", count: 4 },
      { kind: "chaser", count: 4 },
      { kind: "hornet", count: 2 },
      { kind: "bat", count: 3 },
    ],
    hasBoss: true,
  },
];

export const fa = (n: number) => n.toLocaleString("fa-IR");

const ISLAND_R = 92;
const SPAWN = new THREE.Vector3(0, 0, 64);
const PORTAL = new THREE.Vector3(0, 0, -66);
/** Fixed chase-cam offset: camera sits behind (+Z) and above the player. */
const CAM_OFF = new THREE.Vector3(0, 9.8, 14.6);
/** Nose points -Z at spawn: back to camera, facing into the island (toward the portal). */
const START_FACING = Math.PI;

interface Enemy {
  kind: EnemyKind;
  group: THREE.Group;
  legs: THREE.Mesh[];
  wings: THREE.Mesh[];
  center: THREE.Vector3;
  radius: number;
  angle: number;
  speed: number;
  bobPhase: number;
  alive: boolean;
  contactR: number;
  // hornet / boss state machine
  state: "idle" | "tell" | "charge" | "recover" | "tired";
  stateT: number;
  chargeDir: THREE.Vector3;
  hp: number;
  maxHp: number;
  hitFlash: number;
}

interface Crystal {
  group: THREE.Group;
  ring: THREE.Mesh;
  taken: boolean;
  bobPhase: number;
  baseY: number;
}

interface Burst {
  obj: THREE.Object3D;
  mat: THREE.Material;
  vel: THREE.Vector3;
  life: number;
  max: number;
  grav: number;
  grow: number;
}

const lerpAngle = (a: number, b: number, t: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
};

export class GameEngine {
  private container: HTMLElement;
  private hooks: EngineHooks;
  readonly audio = new GameAudio();

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;

  private phase: Phase = "menu";
  private lostReason: LostReason = null;
  private keys = new Set<string>();
  private dashHeldPrev = false;
  private jumpHeldPrev = false;

  // selection
  private charId: CharId = "fox";
  private charDef: CharacterDef = CHARACTERS[0];
  private level: LevelDef = LEVELS[0];

  // player
  private player!: THREE.Group;
  private bodyInner!: THREE.Group;
  private head!: THREE.Group;
  private tail!: THREE.Group;
  private legs: THREE.Mesh[] = [];
  private scarf: THREE.Mesh[] = [];
  private guideArrow!: THREE.Group;
  private guideMat!: THREE.MeshBasicMaterial;
  private vel = new THREE.Vector3();
  private grounded = true;
  private coyote = 0;
  private dashCd = 0;
  private invuln = 0;
  private facing = START_FACING;
  private shake = 0;
  private camLook = new THREE.Vector3(0, 1.6, 0);
  private camSnap = true;
  private squashTarget = new THREE.Vector3(1, 1, 1);
  private walkPhase = 0;

  // world refs
  private sun!: THREE.DirectionalLight;
  private portalGroup!: THREE.Group;
  private portalMat!: THREE.MeshStandardMaterial;
  private portalMatInner!: THREE.MeshStandardMaterial;
  private portalSwirl!: THREE.Points;
  private portalBeam!: THREE.Mesh;
  private portalLight!: THREE.PointLight;
  private portalOpenT = 0;
  private dust!: THREE.Points;
  private clouds: { g: THREE.Group; speed: number }[] = [];
  private shrooms: THREE.MeshStandardMaterial[] = [];

  // dynamics
  private crystals: Crystal[] = [];
  private enemies: Enemy[] = [];
  private bursts: Burst[] = [];
  private burstGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
  private glowTex: THREE.Texture;

  // stats
  private collected = 0;
  private hearts = 3;
  private score = 0;
  private kills = 0;
  private timeLeft = 210;
  private timeAcc = 0;
  private levelElapsed = 0;
  private warned30 = false;
  private portalOpen = false;
  private timeBonus = 0;
  private heartsBonus = 0;

  private elapsed = 0;
  private lastHudKey = "";
  private minimap: CanvasRenderingContext2D | null = null;
  private fxLayer: HTMLDivElement;

  constructor(container: HTMLElement, hooks: EngineHooks) {
    this.container = container;
    this.hooks = hooks;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";

    this.camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      1600
    );

    this.fxLayer = document.createElement("div");
    this.fxLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:20;";
    container.appendChild(this.fxLayer);

    this.glowTex = this.makeGlowTexture();
    this.scene.fog = new THREE.Fog(0x5a4a78, 70, this.level.fogFar);

    this.buildSky();
    this.buildLights();
    this.buildIsland();
    this.buildDecor();
    this.buildPortal();
    this.buildCharacter(this.charId);
    this.buildAmbient();
    this.resetDynamic();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);

    this.loop();
  }

  /* ================= world building ================= */

  private makeGlowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private groundHeight(x: number, z: number) {
    const h =
      4.6 * Math.sin(x * 0.05 + 1.7) * Math.cos(z * 0.045 - 0.6) +
      2.2 * Math.sin(x * 0.11 - 0.8) * Math.sin(z * 0.1 + 2.1) +
      1.1 * Math.sin(x * 0.23 + z * 0.19);
    const d = Math.hypot(x, z);
    const edge = THREE.MathUtils.smoothstep(d, ISLAND_R - 26, ISLAND_R);
    let amp = 1 - edge * 0.92;
    const ds = Math.hypot(x - SPAWN.x, z - SPAWN.z);
    const dp = Math.hypot(x - PORTAL.x, z - PORTAL.z);
    amp *= 1 - (1 - THREE.MathUtils.smoothstep(ds, 2, 10)) * 0.92;
    amp *= 1 - (1 - THREE.MathUtils.smoothstep(dp, 2, 10)) * 0.92;
    let y = h * amp;
    if (d > ISLAND_R) y -= (d - ISLAND_R) * 1.7;
    return y;
  }

  private buildSky() {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 512;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#070b22");
    grad.addColorStop(0.38, "#1b2a5e");
    grad.addColorStop(0.62, "#45407e");
    grad.addColorStop(0.78, "#8a5a83");
    grad.addColorStop(0.9, "#d97f62");
    grad.addColorStop(1, "#f2a35f");
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(760, 24, 18),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    dome.renderOrder = -10;
    this.scene.add(dome);

    const starPos: number[] = [];
    for (let i = 0; i < 620; i++) {
      const v = new THREE.Vector3().randomDirection();
      if (v.y < 0.12) continue;
      v.multiplyScalar(620 + Math.random() * 80);
      starPos.push(v.x, v.y, v.z);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    this.scene.add(
      new THREE.Points(
        sg,
        new THREE.PointsMaterial({
          color: 0xd9e6ff,
          size: 3.4,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.85,
          fog: false,
        })
      )
    );

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(26, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xffe9c4, fog: false })
    );
    moon.position.set(330, 240, -480);
    this.scene.add(moon);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0xffdca8,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    halo.scale.setScalar(190);
    halo.position.copy(moon.position);
    this.scene.add(halo);
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x9db4ff, 0x4a3b5e, 0.55));
    this.sun = new THREE.DirectionalLight(0xffc089, 1.25);
    this.sun.position.set(30, 42, 86);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -42;
    this.sun.shadow.camera.right = 42;
    this.sun.shadow.camera.top = 42;
    this.sun.shadow.camera.bottom = -42;
    this.sun.shadow.camera.near = 4;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    const rim = new THREE.DirectionalLight(0x6f86ff, 0.4);
    rim.position.set(-60, 40, -80);
    this.scene.add(rim);
  }

  private buildIsland() {
    const S = ISLAND_R * 2.35;
    const geo = new THREE.PlaneGeometry(S, S, 118, 118);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const grass = new THREE.Color(0x2f9a73);
    const grassDark = new THREE.Color(0x23735a);
    const rock = new THREE.Color(0x6b5a82);
    const rockDark = new THREE.Color(0x4c4066);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.groundHeight(x, z);
      pos.setY(i, y);
      const d = Math.hypot(x, z);
      const n = (Math.sin(x * 0.6) * Math.cos(z * 0.5) + 1) * 0.5;
      if (d > ISLAND_R - 4 || y < -1.2) {
        tmp.copy(rock).lerp(rockDark, n);
      } else {
        tmp.copy(grass).lerp(grassDark, n * 0.8 + Math.random() * 0.12);
        if (d > ISLAND_R - 22) tmp.lerp(rock, (d - (ISLAND_R - 22)) / 22);
      }
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })
    );
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(ISLAND_R * 1.03, ISLAND_R * 0.55, 26, 30, 3, true),
      new THREE.MeshStandardMaterial({ color: 0x463a63, flatShading: true, roughness: 1 })
    );
    skirt.position.y = -13.5;
    const sp = skirt.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i);
      const z = sp.getZ(i);
      const j = 1 + Math.sin(x * 0.5 + z * 0.35) * 0.05;
      sp.setX(i, x * j);
      sp.setZ(i, z * j);
    }
    skirt.geometry.computeVertexNormals();
    this.scene.add(skirt);

    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(ISLAND_R * 0.56, 20, 30),
      new THREE.MeshStandardMaterial({ color: 0x39304f, flatShading: true, roughness: 1 })
    );
    tip.rotation.x = Math.PI;
    tip.position.y = -36;
    this.scene.add(tip);

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const shard = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.2 + Math.random() * 2.2),
        new THREE.MeshStandardMaterial({ color: 0x4c4066, flatShading: true, roughness: 1 })
      );
      shard.position.set(
        Math.cos(a) * (ISLAND_R + 10 + Math.random() * 16),
        -22 - Math.random() * 16,
        Math.sin(a) * (ISLAND_R + 10 + Math.random() * 16)
      );
      shard.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.scene.add(shard);
    }
  }

  private buildDecor() {
    // instanced trees
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 1.6, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a3a, flatShading: true, roughness: 1 });
    const leafGeo = new THREE.ConeGeometry(1.05, 2.4, 7);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 });
    const leafCols = [0x2e8f6e, 0x37a57d, 0xd98a3d, 0xc96f4a];
    const TREE_N = 110;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_N);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, TREE_N);
    trunks.castShadow = true;
    leaves.castShadow = true;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    let placed = 0;
    let guard = 0;
    while (placed < TREE_N && guard++ < 2500) {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * (ISLAND_R - 16);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 9) continue;
      if (Math.hypot(x - PORTAL.x, z - PORTAL.z) < 11) continue;
      const y = this.groundHeight(x, z);
      if (y < -1) continue;
      const s = 0.8 + Math.random() * 1.1;
      dummy.position.set(x, y + 0.8 * s, z);
      dummy.scale.setScalar(s);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);
      dummy.position.set(x, y + (1.6 + 1.0) * s, z);
      dummy.updateMatrix();
      leaves.setMatrixAt(placed, dummy.matrix);
      leaves.setColorAt(placed, col.setHex(leafCols[placed % leafCols.length]));
      placed++;
    }
    trunks.count = placed;
    leaves.count = placed;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    this.scene.add(trunks, leaves);

    // instanced rocks
    const rockGeo = new THREE.DodecahedronGeometry(0.55);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a6280, flatShading: true, roughness: 1 });
    const ROCK_N = 55;
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCK_N);
    rocks.castShadow = true;
    for (let i = 0; i < ROCK_N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * (ISLAND_R - 10);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      dummy.position.set(x, this.groundHeight(x, z) + 0.2, z);
      dummy.scale.setScalar(0.6 + Math.random() * 1.4);
      dummy.rotation.set(Math.random(), Math.random() * 3, Math.random());
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(rocks);

    // stone arches as landmarks
    const archMat = new THREE.MeshStandardMaterial({ color: 0x57497a, flatShading: true, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.5;
      const r = 40 + (i % 2) * 18;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const arch = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.55, 8, 18, Math.PI), archMat);
      arch.position.set(x, this.groundHeight(x, z), z);
      arch.rotation.y = a + Math.PI / 2;
      arch.castShadow = true;
      this.scene.add(arch);
    }

    // glowing mushrooms
    const capGeo = new THREE.SphereGeometry(0.26, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const stemGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.3, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xe8d9c0, roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * (ISLAND_R - 12);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xff5d73,
        emissive: 0xff2e55,
        emissiveIntensity: 0.9,
        roughness: 0.6,
      });
      this.shrooms.push(mat);
      const cap = new THREE.Mesh(capGeo, mat);
      cap.position.y = 0.28;
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.14;
      g.add(stem, cap);
      g.position.set(x, this.groundHeight(x, z), z);
      g.scale.setScalar(0.9 + Math.random() * 1.1);
      this.scene.add(g);
    }
  }

  private buildPortal() {
    this.portalGroup = new THREE.Group();
    const gy = this.groundHeight(PORTAL.x, PORTAL.z);
    this.portalGroup.position.set(PORTAL.x, gy, PORTAL.z);

    const padMats = new THREE.MeshStandardMaterial({ color: 0x5a5480, flatShading: true, roughness: 1 });
    [2.7, 2.15, 1.6].forEach((r, i) => {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.2, 0.24, 18), padMats);
      pad.position.y = 0.12 + i * 0.24;
      pad.receiveShadow = true;
      this.portalGroup.add(pad);
    });

    this.portalMat = new THREE.MeshStandardMaterial({
      color: 0x4a4f7a,
      emissive: 0x262a4e,
      emissiveIntensity: 0.6,
      roughness: 0.4,
      metalness: 0.3,
    });
    this.portalMatInner = new THREE.MeshStandardMaterial({
      color: 0x3a3f66,
      emissive: 0x1d2140,
      emissiveIntensity: 0.5,
      roughness: 0.4,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.16, 12, 44), this.portalMat);
    ring.position.y = 2.5;
    const inner = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.09, 10, 36), this.portalMatInner);
    inner.position.y = 2.5;
    this.portalGroup.add(ring, inner);
    this.portalGroup.scale.setScalar(1.15);

    const n = 70;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 1.2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = 2.5 + (Math.random() - 0.5) * 2.2;
      arr[i * 3 + 2] = Math.sin(a) * r * 0.4;
    }
    const swGeo = new THREE.BufferGeometry();
    swGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    this.portalSwirl = new THREE.Points(
      swGeo,
      new THREE.PointsMaterial({
        color: 0xffb43a,
        size: 0.16,
        map: this.glowTex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.portalGroup.add(this.portalSwirl);

    this.portalBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 2.2, 60, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffc65e,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.portalBeam.position.y = 30;
    this.portalBeam.visible = false;
    this.portalGroup.add(this.portalBeam);

    this.portalLight = new THREE.PointLight(0xffb43a, 0, 30);
    this.portalLight.position.y = 3;
    this.portalGroup.add(this.portalLight);

    this.scene.add(this.portalGroup);
  }

  /* ================= character ================= */

  private buildCharacter(id: CharId) {
    this.charId = id;
    this.charDef = CHARACTERS.find((c) => c.id === id)!;
    if (this.player) this.scene.remove(this.player);
    this.legs = [];
    this.scarf = [];

    this.player = new THREE.Group();
    this.bodyInner = new THREE.Group();
    this.player.add(this.bodyInner);

    const palettes: Record<CharId, { body: number; dark: number; belly: number; scarf: number; eye: number }> = {
      fox: { body: 0xf4843c, dark: 0xd96f2e, belly: 0xffe8c9, scarf: 0x35e0c2, eye: 0x35e0c2 },
      wolf: { body: 0x5a7bd8, dark: 0x4762b0, belly: 0xdfe8ff, scarf: 0xffb43a, eye: 0xffd76a },
      bear: { body: 0xe8eef7, dark: 0xc3d2e8, belly: 0xffffff, scarf: 0xff5d73, eye: 0x35e0c2 },
    };
    const pal = palettes[id];
    const bodyMat = new THREE.MeshStandardMaterial({ color: pal.body, flatShading: true, roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: pal.dark, flatShading: true, roughness: 0.9 });
    const cream = new THREE.MeshStandardMaterial({ color: pal.belly, flatShading: true, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b1c2e, roughness: 0.8 });
    const eyeGlow = new THREE.MeshStandardMaterial({
      color: pal.eye,
      emissive: pal.eye,
      emissiveIntensity: 1.6,
      roughness: 0.4,
    });
    const scarfMat = new THREE.MeshStandardMaterial({
      color: pal.scarf,
      emissive: pal.scarf,
      emissiveIntensity: 0.35,
      flatShading: true,
      roughness: 0.8,
    });

    const chunky = id === "bear";
    const slender = id === "wolf";

    // legs
    const legGeo = new THREE.BoxGeometry(chunky ? 0.26 : 0.2, 0.4, chunky ? 0.3 : 0.24);
    legGeo.translate(0, -0.2, 0);
    const legPos: [number, number][] = [
      [0.24, 0.26],
      [-0.24, 0.26],
      [0.24, -0.26],
      [-0.24, -0.26],
    ];
    for (const [lx, lz] of legPos) {
      const leg = new THREE.Mesh(legGeo, darkMat);
      leg.position.set(lx, 0.4, lz);
      leg.castShadow = true;
      this.legs.push(leg);
      this.bodyInner.add(leg);
    }

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(chunky ? 0.5 : 0.4, chunky ? 0.4 : 0.42, 4, 10),
      bodyMat
    );
    body.position.y = 0.82;
    body.scale.z = slender ? 1.3 : 1.12;
    body.castShadow = true;
    this.bodyInner.add(body);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), cream);
    belly.position.set(0, 0.76, 0.27);
    belly.scale.set(0.75, 0.85, 0.5);
    this.bodyInner.add(belly);

    // head (nose points +Z local)
    this.head = new THREE.Group();
    this.head.position.y = 1.42;
    const skull = new THREE.Mesh(
      new THREE.BoxGeometry(chunky ? 0.66 : slender ? 0.54 : 0.58, chunky ? 0.56 : 0.5, chunky ? 0.6 : slender ? 0.62 : 0.54),
      bodyMat
    );
    skull.castShadow = true;
    this.head.add(skull);
    const muzzle = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.2, slender ? 0.34 : 0.22),
      cream
    );
    muzzle.position.set(0, -0.1, slender ? 0.42 : 0.34);
    this.head.add(muzzle);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.07), dark);
    nose.position.set(0, -0.04, slender ? 0.6 : 0.46);
    this.head.add(nose);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), eyeGlow);
      eye.position.set(0.15 * s, 0.07, slender ? 0.3 : 0.27);
      this.head.add(eye);
      if (id === "bear") {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), bodyMat);
        ear.position.set(0.24 * s, 0.32, 0);
        ear.castShadow = true;
        this.head.add(ear);
      } else {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, slender ? 0.42 : 0.32, 4), bodyMat);
        ear.position.set(0.2 * s, 0.38, -0.02);
        ear.rotation.z = -0.18 * s;
        ear.castShadow = true;
        this.head.add(ear);
        const earIn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), cream);
        earIn.position.set(0.2 * s, 0.35, 0.03);
        earIn.rotation.z = -0.18 * s;
        this.head.add(earIn);
      }
    }
    this.bodyInner.add(this.head);

    // scarf
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 14), scarfMat);
    collar.position.y = 1.14;
    collar.rotation.x = Math.PI / 2;
    this.bodyInner.add(collar);
    const segGeo = new THREE.BoxGeometry(0.17, 0.06, 0.24);
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(segGeo, scarfMat);
      seg.position.set(0, 1.08 - i * 0.04, -0.32 - i * 0.2);
      this.scarf.push(seg);
      this.bodyInner.add(seg);
    }

    // tail
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.85, -0.42);
    this.tail.rotation.x = -0.9;
    const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.22, slender ? 1.15 : 0.95, 7), bodyMat);
    tailCone.position.y = 0.45;
    tailCone.castShadow = true;
    this.tail.add(tailCone);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), cream);
    tailTip.position.y = slender ? 1.05 : 0.9;
    this.tail.add(tailTip);
    this.bodyInner.add(this.tail);

    const aura = new THREE.PointLight(pal.eye, 0.9, 10);
    aura.position.y = 1.4;
    this.player.add(aura);

    if (chunky) this.player.scale.setScalar(1.1);

    // guide arrow (points +Z local; colored toward the current objective)
    this.guideArrow = new THREE.Group();
    this.guideMat = new THREE.MeshBasicMaterial({
      color: 0x35e0c2,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), this.guideMat);
    cone.rotation.x = Math.PI / 2; // tip toward +Z
    cone.position.z = 0.55;
    const tailBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.7), this.guideMat);
    tailBox.position.z = -0.15;
    this.guideArrow.add(cone, tailBox);
    this.guideArrow.rotation.x = 0;
    this.guideArrow.visible = false;
    this.player.add(this.guideArrow);

    this.player.position.copy(SPAWN);
    this.player.position.y = this.groundHeight(SPAWN.x, SPAWN.z);
    this.player.rotation.y = START_FACING;
    this.scene.add(this.player);
  }

  setCharacter(id: CharId) {
    if (id === this.charId) return;
    this.audio.click();
    const keepPos = this.player.position.clone();
    this.buildCharacter(id);
    this.player.position.copy(keepPos);
    this.player.position.y = this.groundHeight(keepPos.x, keepPos.z);
    this.player.rotation.y = this.facing;
  }

  private buildAmbient() {
    const n = 320;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * ISLAND_R;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = Math.random() * 12;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    this.dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({
        color: 0x9fe8ff,
        size: 0.36,
        map: this.glowTex,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.dust);

    const cloudMat = new THREE.MeshStandardMaterial({ color: 0x5a5f96, flatShading: true, roughness: 1 });
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(3.2 + Math.random() * 2.4, 8, 6), cloudMat);
        s.position.set(j * 3.4 - 3.4, Math.random() * 0.8, Math.random() * 1.8);
        s.scale.y = 0.38;
        g.add(s);
      }
      g.position.set(-180 + Math.random() * 360, 20 + Math.random() * 14, -120 + Math.random() * 240);
      this.clouds.push({ g, speed: 0.6 + Math.random() * 1 });
      this.scene.add(g);
    }
  }

  /* ================= dynamics ================= */

  private clearGroup(arr: { group: THREE.Group }[]) {
    for (const e of arr) this.scene.remove(e.group);
  }

  private resetDynamic() {
    this.clearGroup(this.crystals);
    this.clearGroup(this.enemies);
    for (const b of this.bursts) this.scene.remove(b.obj);
    this.bursts = [];

    this.collected = 0;
    this.hearts = this.charDef.hearts;
    this.score = 0;
    this.kills = 0;
    this.timeLeft = this.level.time;
    this.timeAcc = 0;
    this.levelElapsed = 0;
    this.warned30 = false;
    this.portalOpen = false;
    this.portalOpenT = 0;
    this.timeBonus = 0;
    this.heartsBonus = 0;
    this.lostReason = null;
    this.invuln = 1;
    this.vel.set(0, 0, 0);
    this.facing = START_FACING;
    this.shake = 0;
    this.camLook.set(SPAWN.x, 1.6, SPAWN.z);
    this.camSnap = true;
    this.player.position.set(SPAWN.x, this.groundHeight(SPAWN.x, SPAWN.z), SPAWN.z);
    this.player.rotation.y = START_FACING;
    this.bodyInner.visible = true;

    // crystals
    this.crystals = [];
    const placed: THREE.Vector2[] = [];
    let guard = 0;
    while (this.crystals.length < this.level.crystals && guard++ < 3000) {
      const a = Math.random() * Math.PI * 2;
      const r = 14 + Math.random() * 66;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const p = new THREE.Vector2(x, z);
      if (p.distanceTo(new THREE.Vector2(SPAWN.x, SPAWN.z)) < 12) continue;
      if (p.distanceTo(new THREE.Vector2(PORTAL.x, PORTAL.z)) < 12) continue;
      if (placed.some((q) => q.distanceTo(p) < 14)) continue;
      placed.push(p);
      this.crystals.push(this.makeCrystal(x, z, this.crystals.length));
    }

    // enemies
    this.enemies = [];
    for (const spec of this.level.enemies) {
      for (let i = 0; i < spec.count; i++) {
        let x = 0;
        let z = 0;
        let tries = 0;
        do {
          const a = Math.random() * Math.PI * 2;
          const r = 12 + Math.random() * 66;
          x = Math.cos(a) * r;
          z = Math.sin(a) * r;
          tries++;
        } while (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 18 && tries < 50);
        this.enemies.push(this.makeEnemy(spec.kind, x, z, this.enemies.length));
      }
    }
    if (this.level.hasBoss) {
      this.enemies.push(this.makeEnemy("boss", 0, -18, this.enemies.length));
    }

    this.pushHud(true);
  }

  private makeCrystal(x: number, z: number, idx: number): Crystal {
    const group = new THREE.Group();
    const baseY = this.groundHeight(x, z) + 1.35;
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5),
      new THREE.MeshStandardMaterial({
        color: 0x35e0c2,
        emissive: 0x17b396,
        emissiveIntensity: 1.25,
        metalness: 0.25,
        roughness: 0.2,
        flatShading: true,
      })
    );
    gem.scale.set(1, 1.35, 1);
    gem.castShadow = true;
    group.add(gem);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.025, 8, 30),
      new THREE.MeshBasicMaterial({
        color: 0x35e0c2,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ring.rotation.x = Math.PI / 2.4;
    group.add(ring);
    // light pillar so crystals are visible across the big island
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.5, 16, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x35e0c2,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    pillar.position.y = 8;
    group.add(pillar);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0x35e0c2,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.scale.setScalar(3);
    group.add(glow);
    group.position.set(x, baseY, z);
    group.rotation.y = idx;
    this.scene.add(group);
    return { group, ring, taken: false, bobPhase: idx * 1.7, baseY };
  }

  private makeEnemy(kind: EnemyKind, x: number, z: number, idx: number): Enemy {
    const group = new THREE.Group();
    const legs: THREE.Mesh[] = [];
    const wings: THREE.Mesh[] = [];
    let contactR = 0.55;
    const base: Omit<Enemy, "kind"> = {
      group,
      legs,
      wings,
      center: new THREE.Vector3(x, 0, z),
      radius: 3.5 + Math.random() * 3,
      angle: Math.random() * Math.PI * 2,
      speed: (0.8 + Math.random() * 0.45) * (idx % 2 === 0 ? 1 : -1),
      bobPhase: idx * 2.1,
      alive: true,
      contactR,
      state: "idle",
      stateT: Math.random() * 1.5,
      chargeDir: new THREE.Vector3(0, 0, 1),
      hp: 1,
      maxHp: 1,
      hitFlash: 0,
    };

    const mkAura = (color: number, size: number) => {
      const aura = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      aura.scale.setScalar(size);
      group.add(aura);
    };
    const mkEyes = (color: number, r: number, hz: number) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2.2,
        roughness: 0.3,
      });
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
        eye.position.set(0.16 * s * (hz / 0.4), 0.1, hz);
        group.add(eye);
      }
    };

    if (kind === "wisp") {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x241640, flatShading: true, roughness: 1 })
      );
      body.castShadow = true;
      group.add(body);
      mkEyes(0xff5d73, 0.09, 0.4);
      const wisp = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.6, 8),
        new THREE.MeshBasicMaterial({ color: 0x241640, transparent: true, opacity: 0.55 })
      );
      wisp.rotation.x = Math.PI;
      wisp.position.y = -0.55;
      group.add(wisp);
      mkAura(0x7a3cff, 2);
      group.position.set(x, this.groundHeight(x, z) + 0.9, z);
    } else if (kind === "chaser") {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.44, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a1230, flatShading: true, roughness: 1 })
      );
      body.castShadow = true;
      group.add(body);
      mkEyes(0xffc65e, 0.08, 0.38);
      const legGeo = new THREE.BoxGeometry(0.1, 0.5, 0.12);
      legGeo.translate(0, -0.25, 0);
      const lm = new THREE.MeshStandardMaterial({ color: 0x1c0d24, flatShading: true, roughness: 1 });
      for (const [lx, lz] of [[0.22, 0.2], [-0.22, 0.2], [0.22, -0.2], [-0.22, -0.2]] as [number, number][]) {
        const leg = new THREE.Mesh(legGeo, lm);
        leg.position.set(lx, -0.15, lz);
        legs.push(leg);
        group.add(leg);
      }
      mkAura(0xff5d73, 1.8);
      contactR = 0.5;
      group.position.set(x, this.groundHeight(x, z) + 0.75, z);
    } else if (kind === "hornet") {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a2547, flatShading: true, roughness: 1 })
      );
      body.castShadow = true;
      group.add(body);
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 1.15, 6),
        new THREE.MeshStandardMaterial({
          color: 0xe8d9c0,
          emissive: 0x8a5a3d,
          emissiveIntensity: 0.5,
          flatShading: true,
          roughness: 0.7,
        })
      );
      horn.rotation.x = Math.PI / 2;
      horn.position.z = 0.95;
      group.add(horn);
      mkEyes(0xff5d73, 0.09, 0.42);
      mkAura(0xd98a1f, 2);
      contactR = 0.62;
      group.position.set(x, this.groundHeight(x, z) + 0.85, z);
    } else if (kind === "bat") {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x1d1030, flatShading: true, roughness: 1 })
      );
      body.castShadow = true;
      group.add(body);
      mkEyes(0xffd76a, 0.06, 0.26);
      const wingGeo = new THREE.PlaneGeometry(0.9, 0.5);
      const wingMat = new THREE.MeshStandardMaterial({
        color: 0x33204d,
        flatShading: true,
        roughness: 1,
        side: THREE.DoubleSide,
      });
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(wingGeo, wingMat);
        w.position.set(0.55 * s, 0.08, 0);
        w.rotation.y = 0.2 * s;
        wings.push(w);
        group.add(w);
      }
      mkAura(0xb44cff, 1.6);
      contactR = 0.45;
      group.position.set(x, this.groundHeight(x, z) + 3.4, z);
    } else {
      // boss: سایه‌شاه
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x170d2b, flatShading: true, roughness: 1 })
      );
      body.castShadow = true;
      group.add(body);
      const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xff2e55,
        emissive: 0xff2e55,
        emissiveIntensity: 3,
        roughness: 0.3,
      });
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), eyeMat);
        eye.position.set(0.26 * s, 0.16, 0.56);
        group.add(eye);
      }
      const crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.06, 8, 20),
        new THREE.MeshStandardMaterial({
          color: 0xffb43a,
          emissive: 0xd98a1f,
          emissiveIntensity: 0.8,
          metalness: 0.5,
          roughness: 0.3,
        })
      );
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 0.62;
      group.add(crown);
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xe8d9c0, flatShading: true, roughness: 0.8 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 5), hornMat);
        horn.position.set(Math.cos(a) * 0.42, 0.85, Math.sin(a) * 0.42);
        horn.rotation.z = -Math.cos(a) * 0.35;
        horn.rotation.x = Math.sin(a) * 0.35;
        group.add(horn);
      }
      const wisp = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 1, 10),
        new THREE.MeshBasicMaterial({ color: 0x170d2b, transparent: true, opacity: 0.55 })
      );
      wisp.rotation.x = Math.PI;
      wisp.position.y = -1;
      group.add(wisp);
      mkAura(0xff2e55, 4.5);
      group.scale.setScalar(2.1);
      contactR = 1.25;
      base.hp = 6;
      base.maxHp = 6;
      base.state = "idle";
      base.stateT = 1.5;
      group.position.set(x, this.groundHeight(x, z) + 1.9, z);
    }

    base.contactR = contactR;
    this.scene.add(group);
    return { kind, ...base };
  }

  /* ================= particles / fx ================= */

  private burst(pos: THREE.Vector3, color: number, count: number, speed = 6, grav = 13, life = 0.7) {
    if (this.bursts.length > 260) return;
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.burstGeo, mat);
      m.position.copy(pos);
      const v = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      v.y = Math.abs(v.y) * 0.9 + speed * 0.25;
      this.scene.add(m);
      this.bursts.push({ obj: m, mat, vel: v, life, max: life, grav, grow: 0 });
    }
  }

  private ringPulse(pos: THREE.Vector3, color: number) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 8, 32), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    m.position.y += 0.15;
    this.scene.add(m);
    this.bursts.push({ obj: m, mat, vel: new THREE.Vector3(), life: 0.5, max: 0.5, grav: 0, grow: 9 });
  }

  private flash(kind: "hit" | "good" | "gold") {
    const el = document.createElement("div");
    el.className = `fx-flash ${kind}`;
    this.fxLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 700);
  }

  private updateBursts(dt: number) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.obj);
        b.mat.dispose();
        if ((b.obj as THREE.Mesh).geometry && (b.obj as THREE.Mesh).geometry !== this.burstGeo) {
          (b.obj as THREE.Mesh).geometry.dispose();
        }
        this.bursts.splice(i, 1);
        continue;
      }
      const t = b.life / b.max;
      b.vel.y -= b.grav * dt;
      b.obj.position.addScaledVector(b.vel, dt);
      if (b.grow > 0) {
        const s = 1 + (1 - t) * b.grow;
        b.obj.scale.setScalar(s);
        (b.mat as THREE.MeshBasicMaterial).opacity = t;
      } else {
        b.obj.scale.setScalar(Math.max(0.01, t));
        b.obj.rotation.x += dt * 7;
        b.obj.rotation.z += dt * 5;
      }
    }
  }

  /* ================= game flow ================= */

  start(charId: CharId, levelId: number) {
    this.audio.unlock();
    this.audio.click();
    if (charId !== this.charId) this.buildCharacter(charId);
    this.level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelId))];
    (this.scene.fog as THREE.Fog).far = this.level.fogFar;
    this.resetDynamic();
    this.phase = "playing";
    this.hooks.onToast(
      `مأموریت «${this.level.title}» شروع شد — ${fa(this.level.crystals)} بلور را پیدا کن!`,
      "info"
    );
    this.pushHud(true);
  }

  restart() {
    this.start(this.charId, this.level.id);
  }

  pause() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.pushHud(true);
  }

  resume() {
    if (this.phase !== "paused") return;
    this.audio.unlock();
    this.phase = "playing";
    this.clock.getDelta();
    this.pushHud(true);
  }

  togglePause() {
    if (this.phase === "playing") this.pause();
    else if (this.phase === "paused") this.resume();
  }

  setMuted(m: boolean) {
    this.audio.setMuted(m);
  }

  toMenu() {
    this.phase = "menu";
    this.resetDynamic();
    this.pushHud(true);
  }

  attachMinimap(canvas: HTMLCanvasElement | null) {
    this.minimap = canvas ? canvas.getContext("2d") : null;
  }

  private winGame() {
    if (this.phase !== "playing") return;
    this.timeBonus = this.timeLeft * 10;
    this.heartsBonus = this.hearts * 200;
    this.score += this.timeBonus + this.heartsBonus;
    this.phase = "won";
    this.audio.win();
    this.flash("gold");
    const p = this.player.position.clone().add(new THREE.Vector3(0, 1, 0));
    this.burst(p, 0xffb43a, 26, 8, 9, 1.1);
    this.burst(p, 0x35e0c2, 22, 9, 8, 1.2);
    this.burst(p, 0xff5d73, 18, 7, 9, 1);
    this.ringPulse(this.player.position.clone(), 0xffb43a);
    this.pushHud(true);
  }

  private loseGame(reason: Exclude<LostReason, null>) {
    if (this.phase !== "playing") return;
    this.lostReason = reason;
    this.phase = "lost";
    this.audio.lose();
    this.flash("hit");
    this.pushHud(true);
  }

  private damage(from: THREE.Vector3 | null, dmg = 1) {
    if (this.invuln > 0 || this.phase !== "playing") return;
    this.hearts = Math.max(0, this.hearts - dmg);
    this.invuln = 1.8;
    this.shake = 0.3;
    this.audio.hit();
    this.flash("hit");
    if (from) {
      const dir = this.player.position.clone().sub(from);
      dir.y = 0;
      dir.normalize();
      this.vel.x = dir.x * 13;
      this.vel.z = dir.z * 13;
      this.vel.y = 6.5;
    }
    if (this.hearts <= 0) {
      this.loseGame("hearts");
      return;
    }
    this.pushHud();
  }

  private respawn() {
    this.player.position.set(SPAWN.x, this.groundHeight(SPAWN.x, SPAWN.z) + 2.5, SPAWN.z);
    this.vel.set(0, 0, 0);
    this.facing = START_FACING;
    this.player.rotation.y = START_FACING;
    this.invuln = 2.2;
  }

  private collectCrystal(c: Crystal) {
    c.taken = true;
    c.group.visible = false;
    this.collected++;
    this.score += 100;
    this.audio.pickup();
    this.flash("good");
    this.burst(c.group.position.clone(), 0x35e0c2, 18, 7, 10, 0.8);
    this.ringPulse(c.group.position.clone(), 0x35e0c2);
    if (!this.portalOpen) {
      if (this.collected >= this.level.crystals) {
        this.hooks.onToast("همهٔ بلورها پیدا شد!", "good");
      } else {
        this.hooks.onToast(`بلورِ ${fa(this.collected)} از ${fa(this.level.crystals)} پیدا شد`, "good");
      }
    }
    this.maybeOpenPortal();
    this.pushHud();
  }

  private maybeOpenPortal() {
    if (this.portalOpen) return;
    if (this.collected >= this.level.crystals && this.kills >= this.level.killsRequired) {
      this.openPortal();
    }
  }

  private openPortal() {
    this.portalOpen = true;
    this.audio.portal();
    this.flash("gold");
    this.hooks.onToast("دروازهٔ نور باز شد! فلش طلاییِ بالای سرت را دنبال کن", "good");
    const p = this.portalGroup.position.clone().add(new THREE.Vector3(0, 2.5, 0));
    this.burst(p, 0xffb43a, 26, 8, 6, 1);
    this.ringPulse(this.portalGroup.position.clone(), 0xffb43a);
    this.pushHud();
  }

  private stompEnemy(e: Enemy) {
    if (e.kind === "boss") {
      this.hitBoss(e);
      return;
    }
    e.alive = false;
    e.group.visible = false;
    this.kills++;
    const pts = e.kind === "wisp" ? 100 : e.kind === "chaser" ? 150 : e.kind === "hornet" ? 200 : 150;
    this.score += pts;
    this.vel.y = 11.5;
    this.audio.stomp();
    this.burst(e.group.position.clone(), 0x7a3cff, 16, 6, 9, 0.7);
    this.burst(e.group.position.clone(), 0xff5d73, 8, 5, 9, 0.6);
    this.ringPulse(e.group.position.clone(), 0xff5d73);
    this.hooks.onToast(`شکار شد — ${fa(pts)} امتیاز`, "good");
    this.maybeOpenPortal();
    this.pushHud();
  }

  private hitBoss(e: Enemy) {
    e.hp--;
    e.hitFlash = 0.4;
    e.state = "tired";
    e.stateT = 0;
    this.vel.y = 12.5;
    this.audio.stomp();
    this.audio.roar();
    this.shake = 0.32;
    this.burst(e.group.position.clone(), 0xff2e55, 22, 7, 9, 0.8);
    this.ringPulse(e.group.position.clone(), 0xffb43a);
    if (e.hp <= 0) {
      e.alive = false;
      e.group.visible = false;
      this.kills++;
      this.score += 800;
      this.flash("gold");
      this.burst(e.group.position.clone(), 0xffb43a, 30, 9, 8, 1.1);
      this.burst(e.group.position.clone(), 0x7a3cff, 24, 8, 8, 1);
      this.hooks.onToast("سایه‌شاه سرنگون شد — ۸۰۰ امتیاز!", "good");
      this.maybeOpenPortal();
    } else {
      this.hooks.onToast(`ضربه به سایه‌شاه — ${fa(e.hp)} نوبت تا سقوطش`, "good");
    }
    this.pushHud();
  }

  /* ================= input ================= */

  private onKeyDown = (e: KeyboardEvent) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    this.keys.add(e.code);
    if (e.code === "KeyP" || e.code === "Escape") this.togglePause();
    if (e.code === "KeyM") this.hooks.onMuteToggle();
    if (e.code === "Enter") {
      if (this.phase === "menu") this.start(this.charId, this.level.id);
      else if (this.phase === "won" || this.phase === "lost") this.restart();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onVisibility = () => {
    if (document.hidden && this.phase === "playing") this.pause();
  };

  /* ================= update ================= */

  private updatePlayer(dt: number) {
    const k = this.keys;
    const ix = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    const iz = (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0);
    const moving = ix !== 0 || iz !== 0;

    // Camera never rotates, so input maps 1:1 to screen space:
    // +x = screen right, +z = toward camera (down-screen), -z = into the depth (up-screen).
    let wx = ix;
    let wz = iz;
    const len = Math.hypot(wx, wz);
    if (len > 0) {
      wx /= len;
      wz /= len;
    }

    const SPEED = this.charDef.speed;
    const dashHeld = k.has("ShiftLeft") || k.has("ShiftRight");
    if (dashHeld && !this.dashHeldPrev && this.dashCd <= 0 && moving) {
      this.vel.x = wx * 19;
      this.vel.z = wz * 19;
      this.dashCd = this.charDef.dashCd;
      this.audio.dash();
      this.burst(this.player.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 0x9fe8ff, 8, 3, 2, 0.4);
      this.squashTarget.set(0.82, 1.22, 0.82);
    }
    this.dashHeldPrev = dashHeld;
    this.dashCd = Math.max(0, this.dashCd - dt);

    if (moving) {
      const f = 1 - Math.exp(-11 * dt);
      this.vel.x += (wx * SPEED - this.vel.x) * f;
      this.vel.z += (wz * SPEED - this.vel.z) * f;
    } else {
      const f = 1 - Math.exp(-9 * dt);
      this.vel.x -= this.vel.x * f;
      this.vel.z -= this.vel.z * f;
    }

    const jumpHeld = k.has("Space");
    if (jumpHeld && !this.jumpHeldPrev && (this.grounded || this.coyote > 0)) {
      this.vel.y = this.charDef.jump;
      this.grounded = false;
      this.coyote = 0;
      this.audio.jump();
      this.squashTarget.set(0.8, 1.28, 0.8);
      this.burst(this.player.position.clone(), 0xcfd8ff, 6, 2.5, 3, 0.35);
    }
    this.jumpHeldPrev = jumpHeld;

    this.vel.y -= 25 * dt;
    this.player.position.addScaledVector(this.vel, dt);

    const gy = this.groundHeight(this.player.position.x, this.player.position.z);
    if (this.player.position.y <= gy) {
      if (!this.grounded && this.vel.y < -7) {
        this.squashTarget.set(1.28, 0.72, 1.28);
        this.burst(this.player.position.clone(), 0x9fe8ff, 7, 2.5, 3, 0.35);
      }
      this.player.position.y = gy;
      this.vel.y = 0;
      this.grounded = true;
      this.coyote = 0.12;
    } else {
      this.grounded = false;
      this.coyote -= dt;
    }

    if (this.player.position.y < -11) {
      this.audio.fall();
      this.flash("hit");
      this.shake = 0.3;
      this.hearts--;
      if (this.hearts <= 0) {
        this.loseGame("hearts");
        return;
      }
      this.respawn();
      this.pushHud();
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.bodyInner.visible = this.invuln <= 0 || Math.sin(this.elapsed * 28) > -0.3;

    // facing: nose (+Z local) points along the movement direction
    if (moving) {
      const target = Math.atan2(wx, wz);
      this.facing = lerpAngle(this.facing, target, 1 - Math.exp(-14 * dt));
    }
    this.player.rotation.y = this.facing;

    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += dt * (4 + hSpeed * 2.2);
    const amp = Math.min(1, hSpeed / SPEED) * 0.85;
    this.legs[0].rotation.x = Math.sin(this.walkPhase) * amp;
    this.legs[3].rotation.x = Math.sin(this.walkPhase) * amp;
    this.legs[1].rotation.x = Math.sin(this.walkPhase + Math.PI) * amp;
    this.legs[2].rotation.x = Math.sin(this.walkPhase + Math.PI) * amp;
    this.tail.rotation.z = Math.sin(this.elapsed * (moving ? 9 : 3)) * (moving ? 0.4 : 0.22);
    this.head.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.05 * amp;

    const bs = this.bodyInner.scale;
    const sf = 1 - Math.exp(-10 * dt);
    bs.x += (this.squashTarget.x - bs.x) * sf;
    bs.y += (this.squashTarget.y - bs.y) * sf;
    bs.z += (this.squashTarget.z - bs.z) * sf;
    this.squashTarget.lerp(new THREE.Vector3(1, 1, 1), 1 - Math.exp(-6 * dt));
    if (this.grounded && !moving) {
      this.bodyInner.position.y = Math.sin(this.elapsed * 2.6) * 0.045;
    } else {
      this.bodyInner.position.y *= 1 - sf;
    }

    // scarf chain physics
    let prev = new THREE.Vector3(0, 1.1, -0.34).applyMatrix4(this.player.matrixWorld);
    for (const seg of this.scarf) {
      const wp = seg.getWorldPosition(new THREE.Vector3());
      const dir = wp.sub(prev);
      const d = dir.length();
      if (d > 0.23) {
        const target = prev.clone().add(dir.multiplyScalar(0.23 / d));
        seg.position.copy(this.player.worldToLocal(target));
      }
      prev = seg.getWorldPosition(new THREE.Vector3());
      seg.position.y += Math.sin(this.elapsed * 6 + seg.position.z * 4) * 0.0018;
    }

    this.updateGuideArrow();
  }

  private updateGuideArrow() {
    let tx: number | null = null;
    let tz: number | null = null;
    let col = 0x35e0c2;
    if (this.portalOpen) {
      tx = PORTAL.x;
      tz = PORTAL.z;
      col = 0xffb43a;
    } else {
      let best = Infinity;
      for (const c of this.crystals) {
        if (c.taken) continue;
        const d = Math.hypot(c.group.position.x - this.player.position.x, c.group.position.z - this.player.position.z);
        if (d < best) {
          best = d;
          tx = c.group.position.x;
          tz = c.group.position.z;
        }
      }
    }
    if (tx === null || tz === null) {
      this.guideArrow.visible = false;
      return;
    }
    const dx = tx - this.player.position.x;
    const dz = tz - this.player.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 7) {
      this.guideArrow.visible = false;
      return;
    }
    this.guideArrow.visible = true;
    this.guideMat.color.setHex(col);
    const worldAngle = Math.atan2(dx, dz);
    this.guideArrow.rotation.y = worldAngle - this.player.rotation.y;
    this.guideArrow.position.y = 3.0 + Math.sin(this.elapsed * 5) * 0.16;
  }

  private updateCamera(dt: number) {
    const p = this.player.position;
    let desired: THREE.Vector3;
    let look: THREE.Vector3;
    if (this.phase === "menu") {
      const a = this.elapsed * 0.35;
      desired = new THREE.Vector3(p.x + Math.sin(a) * 7.2, p.y + 3.4 + Math.sin(this.elapsed * 0.9) * 0.35, p.z + Math.cos(a) * 7.2);
      look = new THREE.Vector3(p.x, p.y + 1.2, p.z);
      const f = 1 - Math.exp(-3 * dt);
      this.camera.position.lerp(desired, f);
      this.camLook.lerp(look, 1 - Math.exp(-6.5 * dt));
    } else {
      // Fixed-angle chase cam: no orbiting at all, keys always match screen directions.
      desired = p.clone().add(CAM_OFF);
      look = p.clone().add(new THREE.Vector3(this.vel.x * 0.09, 1.6, this.vel.z * 0.09));
      if (this.camSnap) {
        // Jump straight to the gameplay pose on the first frame after leaving the lobby,
        // so screen-left/right never disagree with the keys — not even for a frame.
        this.camera.position.copy(desired);
        this.camLook.copy(look);
        this.camSnap = false;
      } else {
        const f = 1 - Math.exp(-4.4 * dt);
        this.camera.position.lerp(desired, f);
        this.camLook.lerp(look, 1 - Math.exp(-6.5 * dt));
      }
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      const s = this.shake * this.shake * 0.45;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.camLook);

    // sun follows the player so shadows stay crisp on the big map
    this.sun.position.set(p.x + 30, p.y + 42, p.z + 22);
    this.sun.target.position.set(p.x, p.y, p.z);
  }

  private updateEnemies(dt: number) {
    const pp = this.player.position;
    const speedMul = 1 + this.levelElapsed * 0.004;
    const aggro = 15 + this.level.id * 4;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const ep = e.group.position;
      const dx = pp.x - ep.x;
      const dz = pp.z - ep.z;
      const hDist = Math.hypot(dx, dz);
      e.hitFlash = Math.max(0, e.hitFlash - dt);

      if (e.kind === "wisp") {
        e.angle += e.speed * speedMul * dt;
        const tx = e.center.x + Math.cos(e.angle) * e.radius;
        const tz = e.center.z + Math.sin(e.angle) * e.radius;
        const ty = this.groundHeight(tx, tz) + 0.9 + Math.sin(this.elapsed * 3 + e.bobPhase) * 0.14;
        ep.lerp(new THREE.Vector3(tx, ty, tz), 1 - Math.exp(-8 * dt));
        e.group.lookAt(pp.x, ep.y, pp.z);
        if (hDist < aggro && hDist > 0.1 && this.phase === "playing") {
          e.center.x += (dx / hDist) * 1.1 * dt;
          e.center.z += (dz / hDist) * 1.1 * dt;
        }
      } else if (e.kind === "chaser") {
        if (this.phase === "playing" && hDist > 0.2) {
          const sp = 5.4 * speedMul;
          ep.x += (dx / hDist) * sp * dt;
          ep.z += (dz / hDist) * sp * dt;
        }
        ep.y = this.groundHeight(ep.x, ep.z) + 0.75 + Math.abs(Math.sin(this.elapsed * 9 + e.bobPhase)) * 0.1;
        e.group.lookAt(pp.x, ep.y, pp.z);
        const sw = Math.sin(this.elapsed * 16 + e.bobPhase) * 0.7;
        e.legs[0].rotation.x = sw;
        e.legs[3].rotation.x = sw;
        e.legs[1].rotation.x = -sw;
        e.legs[2].rotation.x = -sw;
      } else if (e.kind === "hornet") {
        e.stateT += dt;
        if (e.state === "idle") {
          const ty = this.groundHeight(ep.x, ep.z) + 0.85;
          ep.y += (ty - ep.y) * (1 - Math.exp(-6 * dt));
          e.group.lookAt(pp.x, ep.y, pp.z);
          if (e.stateT > 2 && this.phase === "playing" && hDist < 34) {
            e.state = "tell";
            e.stateT = 0;
            this.audio.chargeUp();
          }
        } else if (e.state === "tell") {
          ep.x += (Math.random() - 0.5) * 0.09;
          ep.z += (Math.random() - 0.5) * 0.09;
          e.group.lookAt(pp.x, ep.y, pp.z);
          if (e.stateT > 0.7) {
            e.state = "charge";
            e.stateT = 0;
            const d = Math.max(0.001, hDist);
            e.chargeDir.set(dx / d, 0, dz / d);
            this.audio.dash();
          }
        } else if (e.state === "charge") {
          ep.addScaledVector(e.chargeDir, 22 * dt);
          ep.y = this.groundHeight(ep.x, ep.z) + 0.85;
          if (e.stateT > 0.85) {
            e.state = "recover";
            e.stateT = 0;
          }
        } else {
          e.group.lookAt(pp.x, ep.y, pp.z);
          if (e.stateT > 1) {
            e.state = "idle";
            e.stateT = 0;
          }
        }
      } else if (e.kind === "bat") {
        if (this.phase === "playing" && hDist > 0.2) {
          const sp = 6.6 * speedMul;
          ep.x += (dx / hDist) * sp * dt;
          ep.z += (dz / hDist) * sp * dt;
        }
        const baseY = this.groundHeight(ep.x, ep.z) + 3.3;
        ep.y = baseY + Math.sin(this.elapsed * 2.6 + e.bobPhase) * 1.1;
        e.group.lookAt(pp.x, ep.y, pp.z);
        const flap = Math.sin(this.elapsed * 22 + e.bobPhase) * 0.9;
        if (e.wings[0]) e.wings[0].rotation.z = flap;
        if (e.wings[1]) e.wings[1].rotation.z = -flap;
      } else {
        // boss state machine
        e.stateT += dt;
        const chaseSp = 4.3 * speedMul;
        if (e.state === "idle" || e.state === "recover") {
          if (hDist > 2 && this.phase === "playing") {
            ep.x += (dx / hDist) * chaseSp * dt;
            ep.z += (dz / hDist) * chaseSp * dt;
          }
          e.group.lookAt(pp.x, ep.y, pp.z);
          if (e.stateT > 3.2 && this.phase === "playing") {
            e.state = "tell";
            e.stateT = 0;
            this.audio.roar();
            this.audio.chargeUp();
          }
        } else if (e.state === "tell") {
          ep.x += (Math.random() - 0.5) * 0.14;
          ep.z += (Math.random() - 0.5) * 0.14;
          e.group.lookAt(pp.x, ep.y, pp.z);
          if (e.stateT > 0.95) {
            e.state = "charge";
            e.stateT = 0;
            const d = Math.max(0.001, hDist);
            e.chargeDir.set(dx / d, 0, dz / d);
          }
        } else if (e.state === "charge") {
          ep.addScaledVector(e.chargeDir, 24 * dt);
          ep.y = this.groundHeight(ep.x, ep.z) + 1.9;
          this.shake = Math.max(this.shake, 0.06);
          if (e.stateT > 1.05) {
            e.state = "tired";
            e.stateT = 0;
          }
        } else {
          // tired — vulnerable, sinks down, panting
          const ty = this.groundHeight(ep.x, ep.z) + 1.4;
          ep.y += (ty - ep.y) * (1 - Math.exp(-5 * dt));
          if (e.stateT > 2.8) {
            e.state = "idle";
            e.stateT = 0;
            this.audio.roar();
          }
        }
        if (e.state !== "tired") {
          const ty = this.groundHeight(ep.x, ep.z) + 1.9 + Math.sin(this.elapsed * 2 + e.bobPhase) * 0.12;
          ep.y += (ty - ep.y) * (1 - Math.exp(-5 * dt));
        }
        const pulse = e.state === "tell" || e.state === "charge" ? 1.18 : 1;
        e.group.scale.setScalar(2.1 * (e.hitFlash > 0 ? 1.06 : 1) * pulse);
      }

      // clamp to island
      const rc = Math.hypot(ep.x, ep.z);
      const maxR = ISLAND_R - 5;
      if (rc > maxR) {
        ep.x *= maxR / rc;
        ep.z *= maxR / rc;
      }
      const rcC = Math.hypot(e.center.x, e.center.z);
      if (rcC > maxR) {
        e.center.x *= maxR / rcC;
        e.center.z *= maxR / rcC;
      }

      if (this.phase !== "playing") continue;

      // contact + stomp resolution
      const dy = pp.y - ep.y;
      if (hDist < e.contactR + 0.55 && Math.abs(dy) < 1.6) {
        const canStomp = e.kind === "boss" ? e.state === "tired" : true;
        if (this.vel.y < -2.5 && dy > 0.25) {
          if (canStomp) {
            this.stompEnemy(e);
          } else {
            this.vel.y = 9.5; // bounce off the armored boss
            this.hooks.onToast("سایه‌شاه زره دارد! فقط وقتی خسته است ضربه بزن", "info");
          }
        } else {
          this.damage(e.group.position, e.kind === "boss" ? 2 : 1);
        }
      }
    }
  }

  private updateCrystals(dt: number) {
    const pp = this.player.position;
    for (const c of this.crystals) {
      if (c.taken) continue;
      c.group.rotation.y += dt * 1.7;
      c.ring.rotation.z += dt * 2.2;
      c.group.position.y = c.baseY + Math.sin(this.elapsed * 2 + c.bobPhase) * 0.18;
      if (this.phase !== "playing") continue;
      const hd = Math.hypot(pp.x - c.group.position.x, pp.z - c.group.position.z);
      if (hd < 1.7 && Math.abs(pp.y + 0.9 - c.group.position.y) < 2.4) {
        this.collectCrystal(c);
      }
    }
  }

  private updatePortal(dt: number) {
    const target = this.portalOpen ? 1 : 0;
    this.portalOpenT += (target - this.portalOpenT) * (1 - Math.exp(-2.5 * dt));
    const t = this.portalOpenT;
    this.portalGroup.scale.setScalar(1.15 + t * 0.25);
    const closed = new THREE.Color(0x4a4f7a);
    const open = new THREE.Color(0xf5a524);
    this.portalMat.color.copy(closed).lerp(open, t);
    this.portalMat.emissive.copy(new THREE.Color(0x262a4e)).lerp(new THREE.Color(0xff9a1f), t);
    this.portalMat.emissiveIntensity = 0.6 + t * 1.3;
    this.portalMatInner.emissiveIntensity = 0.5 + t * 1.6;
    this.portalLight.intensity = t * 2.6;
    this.portalBeam.visible = t > 0.15;
    (this.portalBeam.material as THREE.MeshBasicMaterial).opacity = 0.16 * t;
    this.portalSwirl.rotation.y += dt * (0.6 + t * 5);

    if (this.portalOpen && this.phase === "playing") {
      const pp = this.player.position;
      const hd = Math.hypot(pp.x - PORTAL.x, pp.z - PORTAL.z);
      if (hd < 2 && Math.abs(pp.y - this.portalGroup.position.y) < 2.6) {
        this.winGame();
      }
    }
  }

  private updateAmbient(dt: number) {
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 0.4;
      if (y > 12) y = 0;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    for (const c of this.clouds) {
      c.g.position.x += c.speed * dt;
      if (c.g.position.x > 200) c.g.position.x = -200;
    }
    const pulse = 0.7 + Math.sin(this.elapsed * 2.4) * 0.35;
    for (const m of this.shrooms) m.emissiveIntensity = pulse;

    if (this.phase === "menu") {
      this.bodyInner.position.y = Math.sin(this.elapsed * 2.6) * 0.05;
      this.tail.rotation.z = Math.sin(this.elapsed * 3.2) * 0.3;
      this.bodyInner.visible = true;
    }
  }

  private updateTimer(dt: number) {
    this.levelElapsed += dt;
    this.timeAcc += dt;
    while (this.timeAcc >= 1) {
      this.timeAcc -= 1;
      this.timeLeft--;
      if (this.timeLeft <= 10 && this.timeLeft > 0) this.audio.tick();
      if (this.timeLeft === 30 && !this.warned30) {
        this.warned30 = true;
        this.hooks.onToast("فقط ۳۰ ثانیه تا تاریکی کامل!", "bad");
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.loseGame("time");
        break;
      }
    }
    this.pushHud();
  }

  /* ================= hud / minimap ================= */

  private pushHud(force = false) {
    const boss = this.enemies.find((e) => e.kind === "boss" && e.alive);
    const key = `${this.phase}|${this.collected}|${this.hearts}|${this.timeLeft}|${this.score}|${this.portalOpen}|${this.lostReason}|${this.kills}|${boss ? boss.hp : -1}`;
    if (!force && key === this.lastHudKey) return;
    this.lastHudKey = key;
    this.hooks.onHud({
      phase: this.phase,
      crystals: this.collected,
      total: this.level.crystals,
      hearts: this.hearts,
      maxHearts: this.charDef.hearts,
      time: this.timeLeft,
      score: this.score,
      portalOpen: this.portalOpen,
      lostReason: this.lostReason,
      timeBonus: this.timeBonus,
      heartsBonus: this.heartsBonus,
      kills: this.kills,
      killsRequired: this.level.killsRequired,
      levelId: this.level.id,
      levelName: this.level.title,
      charName: this.charDef.name,
      bossHp: boss ? boss.hp : 0,
      bossMax: this.level.hasBoss ? 6 : 0,
    });
  }

  private drawMinimap() {
    const ctx = this.minimap;
    if (!ctx) return;
    const S = ctx.canvas.width;
    const cx = S / 2;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cx, cx - 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(10,15,38,0.82)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#33407f";
    ctx.stroke();
    const sc = (cx - 10) / ISLAND_R;
    const mapX = (x: number) => cx + x * sc;
    const mapZ = (z: number) => cx + z * sc;

    // portal
    ctx.beginPath();
    ctx.arc(mapX(PORTAL.x), mapZ(PORTAL.z), this.portalOpen ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = this.portalOpen
      ? `rgba(255,180,58,${0.6 + Math.sin(this.elapsed * 6) * 0.4})`
      : "rgba(120,128,180,0.7)";
    ctx.fill();

    for (const c of this.crystals) {
      if (c.taken) continue;
      ctx.save();
      ctx.translate(mapX(c.group.position.x), mapZ(c.group.position.z));
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#35e0c2";
      ctx.fillRect(-2.4, -2.4, 4.8, 4.8);
      ctx.restore();
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      ctx.beginPath();
      ctx.arc(mapX(e.group.position.x), mapZ(e.group.position.z), e.kind === "boss" ? 5.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = e.kind === "boss" ? "#ff2e55" : "#ff5d73";
      ctx.fill();
    }

    // player arrow — map: screen-up = world -Z; arrow art points up by default
    const p = this.player.position;
    ctx.save();
    ctx.translate(mapX(p.x), mapZ(p.z));
    ctx.rotate(Math.PI - this.facing);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.4, 5);
    ctx.lineTo(-4.4, 5);
    ctx.closePath();
    ctx.fillStyle = "#ffe8c9";
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* ================= main loop ================= */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    if (this.phase === "playing") {
      this.updatePlayer(dt);
      this.updateEnemies(dt);
      this.updateTimer(dt);
    } else if (this.phase === "menu") {
      this.player.rotation.y = START_FACING + Math.sin(this.elapsed * 0.5) * 0.4;
      this.facing = this.player.rotation.y;
    }
    this.updateCrystals(dt);
    this.updatePortal(dt);
    this.updateAmbient(dt);
    this.updateBursts(dt);
    this.updateCamera(dt);
    this.drawMinimap();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.fxLayer.remove();
  }
}
