import * as THREE from 'three';
import { getToonMaterial } from '../utils/Materials.js';
import { Colors } from '../utils/Colors.js';
import { getMonitorMaterial } from './CommandScreens.js';

// Command-center back-row desk: wider panel-sided desk, larger monitor(s), high-back executive chair.
// Local frame matches Desk.ts: the seated person is on +z, looking toward -z.

export interface ExecDeskOptions {
  width: number;        // desk top, x
  depth: number;        // desk top, z
  monitors: 1 | 2;
  monitorScale: number; // relative to the standard 0.7 × 0.45 desk monitor
  chairWidth: number;
  chairBack: number;    // backrest height
}

export const DESK_HEIGHT = 0.76;
const SEAT_HEIGHT = 0.47; // matches the seated pose (hips at 0.5), regardless of chair size

/** Local z of the chair / seated agent, and of the monitors (use for the station lookAt). */
export function execSeatZ(o: ExecDeskOptions): number { return o.depth / 2 + 0.3; }
export function execMonitorZ(o: ExecDeskOptions): number { return -o.depth / 2 + 0.3; }

export function createExecutiveDesk(o: ExecDeskOptions): THREE.Group {
  const group = new THREE.Group();
  const deskMat = getToonMaterial(Colors.desk);
  const darkMat = getToonMaterial(Colors.deskLegs);
  const monitorMat = getToonMaterial(Colors.monitor);

  // Top
  const top = new THREE.Mesh(new THREE.BoxGeometry(o.width, 0.07, o.depth), deskMat);
  top.position.y = DESK_HEIGHT;
  top.castShadow = top.receiveShadow = true;
  group.add(top);

  // Solid side panels + modesty panel on the visitor (-z) side instead of thin legs
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, DESK_HEIGHT, o.depth - 0.04), darkMat);
    side.position.set(sx * (o.width / 2 - 0.05), DESK_HEIGHT / 2, 0);
    side.castShadow = true;
    group.add(side);
  }
  const modesty = new THREE.Mesh(new THREE.BoxGeometry(o.width - 0.16, 0.5, 0.03), darkMat);
  modesty.position.set(0, DESK_HEIGHT - 0.3, -o.depth / 2 + 0.06);
  group.add(modesty);

  // Monitor(s)
  const mw = 0.7 * o.monitorScale;
  const mh = 0.45 * o.monitorScale;
  const mz = execMonitorZ(o);
  const xs = o.monitors === 2 ? [-(mw / 2 + 0.04), mw / 2 + 0.04] : [0];
  xs.forEach((x, i) => {
    const mon = new THREE.Group();
    mon.position.set(x, 0, mz);
    if (o.monitors === 2) mon.rotation.y = i === 0 ? 0.12 : -0.12; // angled slightly toward the seat

    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.16, 6), monitorMat);
    stand.position.y = DESK_HEIGHT + 0.11;
    mon.add(stand);

    const cy = DESK_HEIGHT + 0.19 + mh / 2;
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, 0.04), monitorMat);
    bezel.position.y = cy;
    bezel.castShadow = true;
    mon.add(bezel);

    const face = new THREE.Mesh(new THREE.PlaneGeometry(mw - 0.06, mh - 0.06), getMonitorMaterial());
    face.position.set(0, cy, 0.021);
    mon.add(face);

    group.add(mon);
  });
  group.userData.monitorCount = xs.length;

  // Keyboard
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.14), monitorMat);
  kb.position.set(0, DESK_HEIGHT + 0.045, o.depth / 2 - 0.25);
  group.add(kb);

  const chair = createExecutiveChair(o.chairWidth, o.chairBack);
  chair.position.set(0, 0, execSeatZ(o));
  group.add(chair);
  group.userData.chair = chair;

  return group;
}

function createExecutiveChair(w: number, backH: number): THREE.Group {
  const chair = new THREE.Group();
  const leather = getToonMaterial(0x23262d);
  const trim = getToonMaterial(0x15171b);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, w * 0.95), leather);
  seat.position.y = SEAT_HEIGHT;
  seat.castShadow = true;
  chair.add(seat);

  // High backrest + headrest, behind the sitter (+z)
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, backH, 0.09), leather);
  back.position.set(0, SEAT_HEIGHT + 0.05 + backH / 2, w * 0.45);
  back.rotation.x = -0.08;
  back.castShadow = true;
  chair.add(back);
  const head = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.18, 0.1), leather);
  head.position.set(0, SEAT_HEIGHT + 0.12 + backH, w * 0.45 + 0.04);
  chair.add(head);

  // Armrests
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, w * 0.7), trim);
    arm.position.set(sx * (w / 2 + 0.02), SEAT_HEIGHT + 0.22, 0.02);
    chair.add(arm);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), trim);
    post.position.set(sx * (w / 2 + 0.02), SEAT_HEIGHT + 0.1, 0.1);
    chair.add(post);
  }

  // Gas lift + 5-star base
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, SEAT_HEIGHT - 0.08, 6), trim);
  pole.position.y = (SEAT_HEIGHT - 0.08) / 2 + 0.04;
  chair.add(pole);
  for (let k = 0; k < 5; k++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, w * 0.55), trim);
    leg.rotation.y = (k / 5) * Math.PI * 2;
    leg.position.set(Math.sin(leg.rotation.y) * w * 0.25, 0.04, Math.cos(leg.rotation.y) * w * 0.25);
    chair.add(leg);
  }

  return chair;
}
