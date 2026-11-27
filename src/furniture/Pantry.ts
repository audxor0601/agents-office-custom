import * as THREE from 'three';
import { getToonMaterial } from '../utils/Materials.js';

// Command-center pantry: a slim countertop water purifier on a cabinet, and a
// black bean-to-cup espresso machine on a dark counter. Both face local +z.

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), getToonMaterial(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function screenTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createWaterPurifier(): THREE.Group {
  const g = new THREE.Group();
  const shell = 0xe6e3dd;
  const ribColor = 0xd9d6cf;

  // Cabinet the purifier stands on
  const cabH = 0.82;
  g.add(box(0.52, cabH, 0.46, 0xdedbd4, 0, cabH / 2, 0));
  g.add(box(0.005, cabH - 0.12, 0.005, 0xbfbcb5, 0, cabH / 2, 0.232)); // door split line

  // Drip tray
  const trayY = cabH + 0.015;
  g.add(box(0.36, 0.03, 0.34, 0xf0eee9, 0, trayY, 0.03));

  // Lower body with vertical fluting
  const lowH = 0.34;
  const lowY = cabH + 0.03 + lowH / 2;
  g.add(box(0.34, lowH, 0.3, ribColor, 0, lowY, -0.01));
  for (let i = 0; i < 15; i++) {
    const x = -0.155 + i * (0.31 / 14);
    g.add(box(0.01, lowH - 0.03, 0.02, 0xb4b0a8, x, lowY, 0.145));
  }

  // Head unit (slightly deeper, overhangs the front)
  const headH = 0.36;
  const headY = cabH + 0.03 + lowH + headH / 2;
  g.add(box(0.38, headH, 0.38, shell, 0, headY, 0.02));

  // Front control face: clock + soft-touch icons
  const faceTex = screenTexture((ctx, w, h) => {
    ctx.fillStyle = '#e9e6e0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4a4a4a';
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('12:45', w * 0.72, h * 0.2);
    ctx.fillStyle = '#6b6b6b';
    const dot = (x: number, y: number, r = 5) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    [0.6, 0.72, 0.84].forEach((fx) => { dot(w * fx, h * 0.42); dot(w * fx, h * 0.56); });
    dot(w * 0.18, h * 0.5);
    ctx.strokeStyle = '#6b6b6b';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w * 0.18, h * 0.78, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(w * 0.72, h * 0.78, 10, 0, Math.PI * 2); ctx.stroke();
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.34), new THREE.MeshToonMaterial({ map: faceTex }));
  face.position.set(0, headY, 0.211);
  g.add(face);

  // Nozzle under the head
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 12), getToonMaterial(0xbdbab3));
  nozzle.position.set(0, headY - headH / 2 - 0.02, 0.12);
  g.add(nozzle);

  g.scale.setScalar(1.15);
  return g;
}

export function createEspressoMachine(): THREE.Group {
  const g = new THREE.Group();
  const black = 0x16181b;

  // Counter
  const cH = 0.9;
  g.add(box(1.2, cH - 0.04, 0.6, 0x2a2d31, 0, (cH - 0.04) / 2, 0));
  g.add(box(1.24, 0.04, 0.64, 0x3d4146, 0, cH - 0.02, 0)); // top slab

  const mx = -0.15; // machine sits left of centre
  const base = cH;

  // Base drawer + body
  g.add(box(0.46, 0.14, 0.44, 0x1c1e21, mx, base + 0.07, 0));
  g.add(box(0.44, 0.04, 0.2, 0x2b2e32, mx, base + 0.16, 0.13)); // drip tray
  g.add(box(0.44, 0.5, 0.24, black, mx, base + 0.39, -0.1)); // back column
  g.add(box(0.44, 0.22, 0.42, black, mx, base + 0.53, 0)); // upper head

  // Bronze control band with knobs
  const bandY = base + 0.47;
  g.add(box(0.45, 0.06, 0.43, 0x5b4636, mx, bandY, 0.003));
  [-0.15, -0.09, 0.09, 0.15].forEach((dx) => {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 12), getToonMaterial(0x2a2a2a));
    k.rotation.x = Math.PI / 2;
    k.position.set(mx + dx, bandY, 0.222);
    g.add(k);
  });

  // Touch screen
  const scrTex = screenTexture((ctx, w, h) => {
    ctx.fillStyle = '#1d5fc4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) ctx.fillRect(22 + c * 56, 40 + r * 70, 34, 34);
    ctx.fillRect(22, 196, 212, 16);
  });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.12), new THREE.MeshBasicMaterial({ map: scrTex }));
  scr.position.set(mx, base + 0.58, 0.211);
  g.add(scr);

  // Bean hopper
  const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.13, 20), getToonMaterial(0x2c2a28));
  hop.position.set(mx, base + 0.71, -0.02);
  g.add(hop);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.02, 20), getToonMaterial(0x111111));
  lid.position.set(mx, base + 0.785, -0.02);
  g.add(lid);

  // Spout
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.06, 12), getToonMaterial(0x8a8d91));
  spout.position.set(mx, base + 0.41, 0.12);
  g.add(spout);

  // Glass cup of espresso under the spout
  const cupY = base + 0.18 + 0.045;
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.036, 0.09, 20, 1, true),
    new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glass.position.set(mx, cupY, 0.12);
  g.add(glass);
  const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.034, 0.06, 20), getToonMaterial(0x2b1508));
  coffee.position.set(mx, cupY - 0.012, 0.12);
  g.add(coffee);
  const crema = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.006, 20), getToonMaterial(0xa0642c));
  crema.position.set(mx, cupY + 0.02, 0.12);
  g.add(crema);

  // Steam above the cup
  const steamMat = getToonMaterial(0xdddddd);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), steamMat);
    s.position.set(mx + (i - 1) * 0.015, cupY + 0.08 + i * 0.035, 0.12);
    s.userData.steamIndex = i;
    g.add(s);
  }

  // Stack of take-away cups on the right of the counter
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.1, 16), getToonMaterial(0xf2f2f2));
    c.position.set(0.38, base + 0.05 + i * 0.03, 0.08);
    g.add(c);
  }

  // Warm pendant light so the pantry corner reads in the dark room
  const lamp = new THREE.PointLight(0xffe2b8, 6, 4, 1.5);
  lamp.position.set(0.3, 2.3, 0.7);
  g.add(lamp);

  return g;
}
