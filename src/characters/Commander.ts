import * as THREE from 'three';
import { StickFigure } from './StickFigure.js';
import { updateLabel } from './Label.js';
import { tieMaterial } from './SuitFigure.js';
import { Colors } from '../utils/Colors.js';
import { getToonMaterial, getEmissiveMaterial } from '../utils/Materials.js';
import { COMMANDER_DESK, COMMANDER_Z } from '../furniture/CommanderDesk.js';
import { execSeatZ, execMonitorZ, DESK_HEIGHT } from '../furniture/ExecutiveDesk.js';
import { createDeskMic } from '../furniture/OfficeExtras.js';

// The user (마스터) at the commander desk: suit + thick horn-rimmed glasses,
// burgundy tie and a white pocket square, lit by a warm spotlight.

const FRAME = 0x2b1a10;      // dark tortoise-shell horn rims
const TIE = '#6b1f2a';       // burgundy
// The commander is drawn larger than the staff so he isn't hidden behind the two big monitors.
// Scaling grows from the floor, so the body is lowered by (scale - 1) × hip height (0.5)
// to keep the hips on the chair; the extra leg length goes under the desk's modesty panel.
const COMMANDER_SCALE = 1.35;

function add(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Thick rectangular rim with a hole in the middle (one lens frame). */
function rimGeometry(w: number, h: number, t: number): THREE.ExtrudeGeometry {
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2, -h / 2); outer.lineTo(w / 2, -h / 2); outer.lineTo(w / 2, h / 2); outer.lineTo(-w / 2, h / 2);
  outer.closePath();
  const hole = new THREE.Path();
  const iw = w / 2 - t, ih = h / 2 - t;
  hole.moveTo(-iw, -ih); hole.lineTo(-iw, ih); hole.lineTo(iw, ih); hole.lineTo(iw, -ih);
  hole.closePath();
  outer.holes.push(hole);
  return new THREE.ExtrudeGeometry(outer, { depth: 0.012, bevelEnabled: false });
}

function addGlasses(head: THREE.Mesh): void {
  const mat = getToonMaterial(FRAME);
  const Z = 0.148; // just in front of the eyes (eyes sit at z 0.145)
  for (const side of [-1, 1]) {
    add(rimGeometry(0.075, 0.055, 0.014), mat, head).position.set(side * 0.052, 0.022, Z);
    // Temple arm from the outer edge of the rim back toward the ear
    const arm = add(new THREE.BoxGeometry(0.012, 0.012, 0.15), mat, head);
    arm.position.set(side * 0.092, 0.035, Z - 0.07);
    arm.rotation.y = side * 0.18;
  }
  // Bridge over the nose
  add(new THREE.BoxGeometry(0.03, 0.012, 0.012), mat, head).position.set(0, 0.035, Z + 0.006);
}

function dressAsGentleman(fig: StickFigure): void {
  const torso = fig.joints.torso;
  // Swap the shared black tie for a burgundy one
  for (const child of torso.children) {
    if (child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry) child.material = tieMaterial(TIE);
  }
  // White pocket square on the left breast (figure faces +z, its left is +x)
  const white = getEmissiveMaterial(0xffffff, 0xffffff, 0.6);
  add(new THREE.BoxGeometry(0.06, 0.02, 0.012), white, torso).position.set(0.11, 0.17, 0.102);
  for (const dx of [-0.015, 0.012]) {
    const tip = add(new THREE.BoxGeometry(0.02, 0.025, 0.01), white, torso);
    tip.position.set(0.11 + dx, 0.188, 0.102);
    tip.rotation.z = dx < 0 ? 0.35 : -0.25;
  }
  addGlasses(fig.joints.head);
}

export function createCommander(scene: THREE.Scene): StickFigure {
  const fig = new StickFigure('마스터', Colors.accents[0], 0); // variant 0 = black hair
  dressAsGentleman(fig);
  scene.add(fig.group);

  const seatZ = COMMANDER_Z + execSeatZ(COMMANDER_DESK);
  fig.seated = true;
  fig.teleportTo(new THREE.Vector3(0, 0, seatZ), new THREE.Vector3(0, 1.2, COMMANDER_Z + execMonitorZ(COMMANDER_DESK)));
  fig.group.scale.setScalar(COMMANDER_SCALE);
  fig.group.position.y = -(COMMANDER_SCALE - 1) * 0.5;
  fig.setActivity('idle');
  updateLabel(fig.label, '마스터', 'COMMANDER');

  // Gooseneck mic on the desk, right of center, bending toward the commander
  const mic = createDeskMic();
  mic.position.set(0.45, DESK_HEIGHT + 0.035, COMMANDER_Z + 0.35);
  mic.rotation.y = -0.4;
  scene.add(mic);

  // Warm spotlight from above and slightly in front, so the face and suit read clearly
  const spot = new THREE.SpotLight(0xffe8c8, 6, 7, Math.PI / 9, 0.6, 1);
  spot.position.set(0, 4.6, seatZ - 1.6);
  spot.target.position.set(0, 1.1, seatZ);
  scene.add(spot, spot.target);

  return fig;
}
