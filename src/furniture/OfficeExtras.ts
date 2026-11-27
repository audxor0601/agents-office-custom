import * as THREE from 'three';
import { getToonMaterial, getEmissiveMaterial } from '../utils/Materials.js';

// Command-center fittings: security door, research console, wall speaker,
// ceiling cassette air conditioner and the commander's desk microphone.

function addBox(parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function canvasMaterial(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.MeshBasicMaterial {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t });
}

/** Steel double door with keypad and a security sign. Faces +z, bottom at y = 0. */
export function createSecurityDoor(): THREE.Group {
  const g = new THREE.Group();
  const frame = getToonMaterial(0x2a2e36);
  const steel = getToonMaterial(0x4a5260);
  const dark = getToonMaterial(0x15171c);
  const slit = getEmissiveMaterial(0x9fc4ff, 0x6fa0ff, 0.6);

  addBox(g, 2.1, 0.12, 0.14, frame, 0, 2.46, 0.05);                       // lintel
  for (const s of [-1, 1]) addBox(g, 0.12, 2.5, 0.14, frame, s * 1.0, 1.25, 0.05); // jambs
  for (const s of [-1, 1]) {
    addBox(g, 0.92, 2.36, 0.06, steel, s * 0.47, 1.18, 0.06);            // door leaf
    addBox(g, 0.12, 0.6, 0.02, slit, s * 0.47, 1.65, 0.1);               // narrow window
    addBox(g, 0.5, 0.05, 0.05, dark, s * 0.47, 1.0, 0.12);               // push bar
  }
  addBox(g, 0.02, 2.36, 0.07, dark, 0, 1.18, 0.07);                       // center seam
  addBox(g, 0.16, 0.24, 0.05, dark, 1.25, 1.3, 0.06);                     // keypad
  addBox(g, 0.05, 0.05, 0.02, getEmissiveMaterial(0x33ff66, 0x33ff66, 1.5), 1.25, 1.38, 0.09); // green LED

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.3),
    canvasMaterial(768, 120, (c) => {
      c.fillStyle = '#7a1010'; c.fillRect(0, 0, 768, 120);
      c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.strokeRect(6, 6, 756, 108);
      c.fillStyle = '#ffffff'; c.font = 'bold 50px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('보안구역 · 인가자 외 출입금지', 384, 62);
    })
  );
  sign.position.set(0, 2.78, 0.08);
  g.add(sign);
  return g;
}

/** Analysis console: equipment cabinet with a data screen and status lights. Faces +z. */
export function createResearchConsole(): THREE.Group {
  const g = new THREE.Group();
  const body = getToonMaterial(0x22262e);
  const trim = getToonMaterial(0x3a404c);

  addBox(g, 1.5, 2.1, 0.6, body, 0, 1.05, -0.05);                          // cabinet
  addBox(g, 1.56, 0.06, 0.66, trim, 0, 2.13, -0.05);                       // top cap
  addBox(g, 1.3, 0.05, 0.35, trim, 0, 1.0, 0.4);                           // keyboard shelf
  addBox(g, 0.9, 0.025, 0.22, getToonMaterial(0x111318), 0, 1.04, 0.42);   // keyboard

  // Data screen (waveform + text rows)
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.62),
    canvasMaterial(512, 264, (c) => {
      c.fillStyle = '#04120c'; c.fillRect(0, 0, 512, 264);
      c.strokeStyle = '#1f6f4a'; c.lineWidth = 1;
      for (let x = 0; x < 512; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 264); c.stroke(); }
      for (let y = 0; y < 264; y += 33) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
      c.strokeStyle = '#4dff9a'; c.lineWidth = 3; c.beginPath();
      for (let x = 0; x <= 512; x += 4) {
        const y = 90 + Math.sin(x * 0.045) * 30 + Math.sin(x * 0.13) * 12;
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      c.fillStyle = '#4dff9a'; c.font = 'bold 22px monospace';
      c.fillText('DATA ANALYSIS', 16, 180);
      c.fillStyle = '#9fffc8'; c.font = '18px monospace';
      c.fillText('> scanning sources ...', 16, 212);
      c.fillText('> 128 docs indexed', 16, 240);
    })
  );
  screen.position.set(0, 1.62, 0.26);
  g.add(screen);
  addBox(g, 1.28, 0.7, 0.03, trim, 0, 1.62, 0.24);                         // screen bezel

  // Status lights (3 rows) below the shelf
  const colors = [0x33ff66, 0xffb020, 0x33ff66, 0x33ff66, 0xff4040, 0x33ff66];
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 6; i++) {
      const col = colors[(i + r * 2) % colors.length];
      addBox(g, 0.05, 0.03, 0.02, getEmissiveMaterial(col, col, 1.2), -0.45 + i * 0.18, 0.75 - r * 0.15, 0.26);
    }
  }
  // Vent slats
  for (let i = 0; i < 4; i++) addBox(g, 1.1, 0.02, 0.02, trim, 0, 0.18 + i * 0.06, 0.26);
  return g;
}

/** Box wall speaker with a perforated grille. Faces +z, hangs from a short wall bracket. */
export function createWallSpeaker(): THREE.Group {
  const g = new THREE.Group();
  const shell = getToonMaterial(0x15161a);
  const grille = canvasMaterial(128, 192, (c) => {
    c.fillStyle = '#1c1d22'; c.fillRect(0, 0, 128, 192);
    c.fillStyle = '#08080a';
    for (let y = 6; y < 192; y += 7) for (let x = 6 + ((y / 7) % 2) * 3; x < 128; x += 7) {
      c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = '#555a66'; c.lineWidth = 2; c.strokeRect(54, 166, 20, 14);
  });
  addBox(g, 0.4, 0.62, 0.32, shell, 0, 0, 0);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.58), grille);
  front.position.z = 0.161;
  g.add(front);
  addBox(g, 0.08, 0.08, 0.25, getToonMaterial(0x2a2c32), 0, 0, -0.28);    // wall bracket
  return g;
}

/** Ceiling cassette air conditioner (four-way). Hangs flush under the ceiling, origin at its top. */
export function createCeilingAC(): THREE.Group {
  const g = new THREE.Group();
  const panel = getToonMaterial(0xe6e8ec);
  addBox(g, 0.95, 0.06, 0.95, panel, 0, -0.03, 0);
  const center = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    canvasMaterial(128, 128, (c) => {
      c.fillStyle = '#cfd2d8'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#a4a8b0'; c.lineWidth = 3;
      for (let y = 10; y < 128; y += 12) { c.beginPath(); c.moveTo(6, y); c.lineTo(122, y); c.stroke(); }
    })
  );
  center.rotation.x = Math.PI / 2;
  center.position.y = -0.061;
  g.add(center);
  const vent = getToonMaterial(0x30333a);
  for (const s of [-1, 1]) {
    addBox(g, 0.62, 0.012, 0.06, vent, 0, -0.062, s * 0.36);
    addBox(g, 0.06, 0.012, 0.62, vent, s * 0.36, -0.062, 0);
  }
  return g;
}

/** Gooseneck desk microphone. Origin = base bottom; the neck bends toward +z. */
export function createDeskMic(): THREE.Group {
  const g = new THREE.Group();
  const black = getToonMaterial(0x111214);
  addBox(g, 0.17, 0.035, 0.15, black, 0, 0.0175, 0);                       // base
  addBox(g, 0.025, 0.008, 0.025, getEmissiveMaterial(0xff2020, 0xff2020, 2), 0.04, 0.038, 0.05); // red LED
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.035, -0.02),
    new THREE.Vector3(0, 0.2, -0.02),
    new THREE.Vector3(0, 0.36, 0.04),
    new THREE.Vector3(0, 0.44, 0.16),
  ]);
  const neck = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.008, 6, false), black);
  neck.castShadow = true;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.1, 10), getToonMaterial(0x9aa0a8));
  const end = curve.getPoint(1), tangent = curve.getTangent(1);
  head.position.copy(end).addScaledVector(tangent, 0.05);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  g.add(head);
  return g;
}
