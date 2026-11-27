import * as THREE from 'three';
import { OFFICE } from '../utils/Constants.js';

// Command-center screens: wall situation board, digital clocks, desk monitor screens.
// Everything is drawn on <canvas> and used as an unlit (MeshBasicMaterial) texture so it glows.

type Ctx = CanvasRenderingContext2D;

const GLOW = 0xcfd8e6; // <1 multiplier keeps the screens soft instead of blown-out

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvasTexture(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { ctx: canvas.getContext('2d')!, tex };
}

// ---------- Panel 1: blue world map + flight paths ----------

// Very rough continent outlines as [lon, lat]
const CONTINENTS: [number, number][][] = [
  [[-165, 65], [-140, 70], [-95, 72], [-65, 60], [-55, 50], [-80, 30], [-97, 18], [-85, 10], [-105, 22], [-118, 33], [-125, 48], [-150, 60]],
  [[-80, 10], [-60, 8], [-35, -6], [-40, -22], [-55, -35], [-68, -55], [-75, -40], [-70, -15], [-80, -5]],
  [[-10, 36], [0, 44], [-5, 48], [5, 52], [10, 56], [5, 62], [20, 70], [40, 68], [40, 45], [28, 40], [15, 38]],
  [[-17, 15], [-10, 30], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [32, -30], [20, -35], [12, -18], [8, 4], [-8, 5]],
  [[40, 68], [70, 73], [110, 76], [140, 72], [170, 66], [140, 55], [130, 42], [122, 30], [108, 20], [100, 5], [95, 15], [80, 8], [72, 20], [60, 25], [48, 30], [40, 45]],
  [[113, -22], [130, -12], [142, -11], [153, -26], [147, -38], [135, -34], [115, -34]],
];

const CITIES: Record<string, [number, number]> = {
  seoul: [127, 37.5], la: [-118, 34], london: [0, 51.5], dubai: [55, 25],
  sydney: [151, -34], ny: [-74, 40.7], singapore: [104, 1.3], moscow: [37.6, 55.7],
};
const ROUTES: [string, string][] = [
  ['seoul', 'la'], ['seoul', 'london'], ['seoul', 'sydney'], ['ny', 'london'],
  ['dubai', 'singapore'], ['moscow', 'dubai'], ['la', 'ny'], ['london', 'dubai'],
];

function drawWorld(ctx: Ctx, x0: number, y0: number, w: number, h: number, t: number) {
  const s = h / 384;
  const proj = (lon: number, lat: number): [number, number] =>
    [x0 + ((lon + 180) / 360) * w, y0 + ((85 - lat) / 145) * h];

  const bg = ctx.createLinearGradient(0, y0, 0, y0 + h);
  bg.addColorStop(0, '#0b2c5e');
  bg.addColorStop(1, '#071c40');
  ctx.fillStyle = bg;
  ctx.fillRect(x0, y0, w, h);

  // lat/lon grid
  ctx.strokeStyle = 'rgba(120,180,255,0.15)';
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) {
    const [x] = proj(lon, 0);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + h); ctx.stroke();
  }
  for (let lat = -60; lat <= 85; lat += 20) {
    const [, y] = proj(0, lat);
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
  }

  // continents
  ctx.fillStyle = 'rgba(70,140,220,0.55)';
  ctx.strokeStyle = 'rgba(150,205,255,0.9)';
  ctx.lineWidth = 1.5 * s;
  for (const poly of CONTINENTS) {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const [x, y] = proj(lon, lat);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // flight paths (white curves) with a dot travelling along each
  ROUTES.forEach(([a, b], i) => {
    const [ax, ay] = proj(...CITIES[a]);
    const [bx, by] = proj(...CITIES[b]);
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2 - Math.hypot(bx - ax, by - ay) * 0.3;

    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.6 * s;
    ctx.setLineDash([8 * s, 6 * s]);
    ctx.lineDashOffset = -t * 20 * s;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, bx, by); ctx.stroke();
    ctx.setLineDash([]);

    const p = (t * 0.06 + i * 0.17) % 1;
    const q = 1 - p;
    const px = q * q * ax + 2 * q * p * cx + p * p * bx;
    const py = q * q * ay + 2 * q * p * cy + p * p * by;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(px, py, 3.5 * s, 0, Math.PI * 2); ctx.fill();
  });

  // cities
  ctx.fillStyle = '#ffe680';
  for (const c of Object.values(CITIES)) {
    const [x, y] = proj(...c);
    ctx.beginPath(); ctx.arc(x, y, 3 * s, 0, Math.PI * 2); ctx.fill();
  }

  label(ctx, 'GLOBAL AIR TRACK', x0 + 14 * s, y0 + 26 * s, s);
}

// ---------- Panel 2: graphs / waveforms ----------

function box(ctx: Ctx, x: number, y: number, w: number, h: number, title: string, s: number) {
  ctx.fillStyle = 'rgba(10,40,80,0.6)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(90,160,255,0.6)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(x, y, w, h);
  label(ctx, title, x + 8 * s, y + 18 * s, s * 0.8);
}

function label(ctx: Ctx, text: string, x: number, y: number, s: number, color = 'rgba(170,215,255,0.95)') {
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(18 * s)}px monospace`;
  ctx.fillText(text, x, y);
}

function drawCharts(ctx: Ctx, x0: number, y0: number, w: number, h: number, t: number) {
  const s = h / 384;
  ctx.fillStyle = '#05162e';
  ctx.fillRect(x0, y0, w, h);

  const pad = 10 * s;
  const bw = (w - pad * 3) / 2;
  const bh = (h - pad * 3) / 2;
  const cells = [
    [x0 + pad, y0 + pad], [x0 + pad * 2 + bw, y0 + pad],
    [x0 + pad, y0 + pad * 2 + bh], [x0 + pad * 2 + bw, y0 + pad * 2 + bh],
  ];

  // 1. scrolling line chart
  {
    const [x, y] = cells[0];
    box(ctx, x, y, bw, bh, 'SIGNAL STRENGTH', s);
    ctx.strokeStyle = '#4fc3ff';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const v = Math.sin(i * 0.15 + t * 1.2) * 0.3 + Math.sin(i * 0.05 + t * 0.4) * 0.4 + Math.sin(i * 0.37 + t * 2) * 0.1;
      const px = x + 6 * s + (i / 60) * (bw - 12 * s);
      const py = y + bh * 0.58 - v * bh * 0.35;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // 2. bar chart
  {
    const [x, y] = cells[1];
    box(ctx, x, y, bw, bh, 'SORTIE STATUS', s);
    const n = 12;
    const gw = (bw - 20 * s) / n;
    for (let i = 0; i < n; i++) {
      const v = 0.5 + 0.4 * Math.sin(t * 0.7 + i * 1.3);
      const bhh = v * (bh - 36 * s);
      ctx.fillStyle = i % 4 === 0 ? '#7fe0a0' : '#3d8fe0';
      ctx.fillRect(x + 10 * s + i * gw + gw * 0.15, y + bh - 8 * s - bhh, gw * 0.7, bhh);
    }
  }

  // 3. waveform
  {
    const [x, y] = cells[2];
    box(ctx, x, y, bw, bh, 'RF WAVEFORM', s);
    for (const [color, f, ph] of [['#5dffa0', 0.22, 0], ['#3fd0ff', 0.13, 1.7]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const v = Math.sin(i * f + t * 3 + ph) * Math.sin(i * 0.03 + t * 0.5);
        const px = x + 6 * s + (i / 120) * (bw - 12 * s);
        const py = y + bh * 0.58 + v * bh * 0.28;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  // 4. radar sweep
  {
    const [x, y] = cells[3];
    box(ctx, x, y, bw, bh, 'RADAR', s);
    const cx = x + bw / 2;
    const cy = y + bh / 2 + 8 * s;
    const r = Math.min(bw, bh) * 0.38;
    ctx.strokeStyle = 'rgba(90,255,160,0.35)';
    ctx.lineWidth = 1 * s;
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath(); ctx.arc(cx, cy, (r * k) / 3, 0, Math.PI * 2); ctx.stroke();
    }
    const a = t * 1.2;
    ctx.strokeStyle = 'rgba(120,255,170,0.9)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
    ctx.fillStyle = '#9dffbf';
    for (let i = 0; i < 5; i++) {
      const ba = i * 1.9;
      const fade = 1 - (((a - ba) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
      ctx.globalAlpha = fade;
      ctx.beginPath(); ctx.arc(cx + Math.cos(ba) * r * (0.3 + i * 0.13), cy + Math.sin(ba) * r * (0.3 + i * 0.13), 3 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- Panel 3: dark satellite map + red targets ----------

const satCache = new Map<string, HTMLCanvasElement>();

function satelliteBackground(w: number, h: number): HTMLCanvasElement {
  const key = `${w}x${h}`;
  const cached = satCache.get(key);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(7);
  g.fillStyle = '#0c120f';
  g.fillRect(0, 0, w, h);
  const tones = ['#1b291c', '#26261e', '#162020', '#222c22', '#2c2a24'];
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w, y = rnd() * h, r = (0.02 + rnd() * 0.12) * h;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, tones[i % tones.length]);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // river
  g.strokeStyle = 'rgba(30,50,70,0.9)';
  g.lineWidth = h * 0.02;
  g.beginPath();
  g.moveTo(0, h * 0.7);
  g.bezierCurveTo(w * 0.3, h * 0.4, w * 0.6, h * 0.9, w, h * 0.35);
  g.stroke();
  // roads
  g.strokeStyle = 'rgba(110,110,95,0.35)';
  g.lineWidth = Math.max(1, h * 0.004);
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.moveTo(rnd() * w, rnd() * h);
    g.lineTo(rnd() * w, rnd() * h);
    g.stroke();
  }
  satCache.set(key, c);
  return c;
}

const TARGETS: [number, number][] = [[0.22, 0.35], [0.48, 0.62], [0.7, 0.28], [0.82, 0.7], [0.35, 0.8]];

function drawSatellite(ctx: Ctx, x0: number, y0: number, w: number, h: number, t: number) {
  const s = h / 384;
  ctx.drawImage(satelliteBackground(Math.round(w), Math.round(h)), x0, y0);

  ctx.strokeStyle = 'rgba(120,200,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const x = x0 + (w * i) / 8;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + h); ctx.stroke();
  }
  for (let i = 1; i < 4; i++) {
    const y = y0 + (h * i) / 4;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
  }

  TARGETS.forEach(([u, v], i) => {
    const x = x0 + u * w, y = y0 + v * h;
    const pulse = (t * 0.8 + i * 0.3) % 1;
    ctx.strokeStyle = `rgba(255,60,50,${1 - pulse})`;
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.arc(x, y, (5 + pulse * 18) * s, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(x, y, 4.5 * s, 0, Math.PI * 2); ctx.fill();
    label(ctx, `TGT-0${i + 1}`, x + 9 * s, y - 7 * s, s * 0.7, 'rgba(255,140,130,0.9)');
  });

  // slowly drifting crosshair
  const cx = x0 + w * (0.5 + 0.3 * Math.sin(t * 0.15));
  const cy = y0 + h * (0.5 + 0.25 * Math.sin(t * 0.23));
  ctx.strokeStyle = 'rgba(255,220,120,0.8)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 24 * s, cy); ctx.lineTo(cx + 24 * s, cy);
  ctx.moveTo(cx, cy - 24 * s); ctx.lineTo(cx, cy + 24 * s);
  ctx.stroke();
  ctx.strokeRect(cx - 14 * s, cy - 14 * s, 28 * s, 28 * s);

  label(ctx, 'SAT-IMG  SECTOR 7', x0 + 14 * s, y0 + 26 * s, s);
}

// ---------- Situation board (back wall) + clocks ----------

// Back wall (z = -halfZ) is the "front" wall: widest (30). Board = 80% of it, centered on x = 0,
// bottom edge 2.1 (just above eye level), flush against the wall's inner face (wall is 0.15 thick).
const WALL_INNER_Z = -OFFICE.halfZ + 0.075;
const BOARD = { width: OFFICE.halfX * 2 * 0.8, height: 3.0, y: 3.6, z: WALL_INNER_Z + 0.045 };

export function createSituationBoard(scene: THREE.Scene) {
  const W = 3072, H = 384; // 8:1, matches 24 x 3 board
  const { ctx, tex } = makeCanvasTexture(W, H);
  const panelW = W / 3;

  const group = new THREE.Group();

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD.width + 0.3, BOARD.height + 0.3, 0.04),
    new THREE.MeshToonMaterial({ color: 0x15181d })
  );
  frame.position.set(0, BOARD.y, WALL_INNER_Z + 0.02); // back face touches the wall
  group.add(frame);

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD.width, BOARD.height),
    new THREE.MeshBasicMaterial({ map: tex, color: GLOW })
  );
  board.position.set(0, BOARD.y, BOARD.z);
  group.add(board);

  // Blue spill from the board onto the room (main light source in this theme)
  for (const x of [-9, 0, 9]) {
    const light = new THREE.SpotLight(0x4f86ff, 4, 30, Math.PI / 2.6, 1, 1);
    light.position.set(x, BOARD.y, BOARD.z + 0.5);
    light.target.position.set(x, 0, 4);
    group.add(light, light.target);
  }

  // Two green digital clocks above the board's top-left corner
  const clocks = [
    { label: 'LOCAL', utc: false },
    { label: 'ZULU (UTC)', utc: true },
  ].map((c, i) => {
    const { ctx: cctx, tex: ctex } = makeCanvasTexture(512, 160);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.56),
      new THREE.MeshBasicMaterial({ map: ctex, color: GLOW })
    );
    const x = -BOARD.width / 2 + 1.0 + i * 2.0;
    const y = BOARD.y + BOARD.height / 2 + 0.47;
    mesh.position.set(x, y, BOARD.z);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.66, 0.04), frame.material);
    back.position.set(x, y, WALL_INNER_Z + 0.02);
    group.add(back, mesh);
    return { ...c, ctx: cctx, tex: ctex };
  });

  scene.add(group);

  let lastDraw = -1;
  let lastSecond = -1;

  function drawClocks() {
    const now = new Date();
    for (const c of clocks) {
      const hh = c.utc ? now.getUTCHours() : now.getHours();
      const mm = c.utc ? now.getUTCMinutes() : now.getMinutes();
      const ss = c.utc ? now.getUTCSeconds() : now.getSeconds();
      const txt = [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':');
      const g = c.ctx;
      g.fillStyle = '#020a04';
      g.fillRect(0, 0, 512, 160);
      g.fillStyle = 'rgba(50,255,110,0.12)';
      g.font = 'bold 96px monospace';
      g.textAlign = 'center';
      g.fillText('88:88:88', 256, 118); // dim "unlit segments" look
      g.fillStyle = '#39ff6e';
      g.fillText(txt, 256, 118);
      g.font = 'bold 26px monospace';
      g.fillText(c.label, 256, 150);
      g.textAlign = 'left';
      c.tex.needsUpdate = true;
    }
  }

  function update(t: number) {
    const sec = Math.floor(Date.now() / 1000);
    if (sec !== lastSecond) { lastSecond = sec; drawClocks(); }

    // ponytail: board + monitors redraw at 10fps, raise if motion looks choppy
    if (t - lastDraw < 0.1) return;
    lastDraw = t;
    drawWorld(ctx, 0, 0, panelW, H, t);
    drawCharts(ctx, panelW, 0, panelW, H, t);
    drawSatellite(ctx, panelW * 2, 0, panelW, H, t);
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(panelW - 4, 0, 8, H);
    ctx.fillRect(panelW * 2 - 4, 0, 8, H);
    tex.needsUpdate = true;
    updateMonitors(t);
    updateConsole(t);
  }

  return { update };
}

// ---------- Desk monitor screens (3 shared variants) ----------

const MONITOR_DRAW = [drawWorld, drawCharts, drawSatellite];
const monitors: { ctx: Ctx; tex: THREE.CanvasTexture; mat: THREE.MeshBasicMaterial }[] = [];
let monitorCount = 0;

export function getMonitorMaterial(): THREE.MeshBasicMaterial {
  const i = monitorCount++ % MONITOR_DRAW.length;
  if (!monitors[i]) {
    const { ctx, tex } = makeCanvasTexture(320, 196);
    MONITOR_DRAW[i](ctx, 0, 0, 320, 196, 0);
    monitors[i] = { ctx, tex, mat: new THREE.MeshBasicMaterial({ map: tex, color: GLOW }) };
  }
  return monitors[i].mat;
}

function updateMonitors(t: number) {
  monitors.forEach((m, i) => {
    MONITOR_DRAW[i](m.ctx, 0, 0, 320, 196, t + i * 5);
    m.tex.needsUpdate = true;
  });
}

// ---------- Comms / equipment-check console screen (test stations) ----------

const CHANNELS = ['SATCOM-A', 'SATCOM-B', 'HF-01', 'UHF-02', 'LINK-16', 'TACLAN'];

function drawComms(ctx: Ctx, x0: number, y0: number, w: number, h: number, t: number) {
  const s = h / 384;
  ctx.fillStyle = '#04122a';
  ctx.fillRect(x0, y0, w, h);
  label(ctx, 'COMMS / EQUIP CHECK', x0 + 14 * s, y0 + 30 * s, s * 1.2);

  // channel list with status lamps
  CHANNELS.forEach((name, i) => {
    const y = y0 + (64 + i * 40) * s;
    const warn = i === 3 && Math.sin(t * 0.7) > 0.6; // one channel flickers to amber now and then
    ctx.fillStyle = warn ? '#ffb43a' : '#3fa9ff';
    ctx.beginPath(); ctx.arc(x0 + 26 * s, y - 6 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
    label(ctx, name, x0 + 44 * s, y, s);
    label(ctx, warn ? 'DEGRADED' : 'NOMINAL', x0 + 180 * s, y, s, warn ? '#ffcf80' : 'rgba(150,210,255,0.9)');
  });

  // spectrum bars
  const bx = x0 + w * 0.5, bw = w * 0.46, by = y0 + h * 0.85, bh = h * 0.65;
  ctx.strokeStyle = 'rgba(90,160,255,0.6)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(bx, by - bh, bw, bh);
  const n = 24;
  for (let i = 0; i < n; i++) {
    const v = 0.25 + 0.6 * Math.abs(Math.sin(t * 1.5 + i * 0.7) * Math.cos(t * 0.4 + i * 0.23));
    ctx.fillStyle = i % 6 === 0 ? '#7fd8ff' : '#2f7fe0';
    ctx.fillRect(bx + (i + 0.15) * (bw / n), by - v * bh, (bw / n) * 0.7, v * bh);
  }
  label(ctx, 'SPECTRUM', bx + 8 * s, by - bh + 20 * s, s * 0.8);
}

let consoleScreen: { ctx: Ctx; tex: THREE.CanvasTexture; mat: THREE.MeshBasicMaterial } | null = null;

export function getConsoleMaterial(): THREE.MeshBasicMaterial {
  if (!consoleScreen) {
    const { ctx, tex } = makeCanvasTexture(384, 240);
    drawComms(ctx, 0, 0, 384, 240, 0);
    consoleScreen = { ctx, tex, mat: new THREE.MeshBasicMaterial({ map: tex, color: GLOW }) };
  }
  return consoleScreen.mat;
}

function updateConsole(t: number) {
  if (!consoleScreen) return;
  drawComms(consoleScreen.ctx, 0, 0, 384, 240, t);
  consoleScreen.tex.needsUpdate = true;
}
