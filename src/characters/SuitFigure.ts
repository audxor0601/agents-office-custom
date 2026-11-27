import * as THREE from 'three';
import { Joints } from './StickFigureParts.js';
import { getToonMaterial, getEmissiveMaterial, gradientTexture } from '../utils/Materials.js';
import { Colors } from '../utils/Colors.js';

// Command-center outfit: re-skins the stick-figure skeleton in place.
// Joint pivots stay where StickFigureParts put them, so every animation and
// the movement logic work unchanged. Front of the body is +z.

const SUIT = 0x1a1a1e;   // black jacket + trousers (not pure 0, so toon steps still show)
const SHOE = 0x111114;
const EYE = 0x22222a;
// Hair colour is the only per-agent difference
const HAIR = [0x1a1a1a, 0x3b2a1e, 0x5a4030, 0x6b4a2e, 0x8a6a48, 0x4a4a4e, 0x2a1a14];

// Shirt: slight white self-glow cancels the room's blue light so it reads pure white
const shirtMaterial = () => getEmissiveMaterial(0xffffff, 0xffffff, 0.6);

// Black suit with a faint cool rim light so it doesn't vanish into the dark room.
// Fresnel term added to emissive; tweak RIM_STRENGTH if it looks too strong/weak.
const RIM_COLOR = new THREE.Color(0x8fa8d8);
const RIM_STRENGTH = 0.55;
let suitMat: THREE.MeshToonMaterial | null = null;
function suitMaterial(): THREE.MeshToonMaterial {
  if (suitMat) return suitMat;
  suitMat = new THREE.MeshToonMaterial({ color: SUIT, gradientMap: gradientTexture });
  suitMat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: RIM_COLOR };
    shader.uniforms.rimStrength = { value: RIM_STRENGTH };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 rimColor;\nuniform float rimStrength;\nvoid main() {')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += rimColor * rim * rimStrength;`);
  };
  return suitMat;
}

const tieMats = new Map<string, THREE.MeshToonMaterial>();
/** Tie material in a given colour (default solid black, shared by all staff). */
export function tieMaterial(color = '#111114'): THREE.MeshToonMaterial {
  const cached = tieMats.get(color);
  if (cached) return cached;

  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  // Silhouette: knot on top, blade widening to a point
  ctx.beginPath();
  ctx.moveTo(10, 0); ctx.lineTo(22, 0); ctx.lineTo(19, 16); // knot
  ctx.lineTo(26, 108); ctx.lineTo(16, 128); ctx.lineTo(6, 108); ctx.lineTo(13, 16);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 32, 128);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshToonMaterial({ map, alphaTest: 0.5, gradientMap: gradientTexture });
  tieMats.set(color, mat);
  return mat;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Swap the mesh(es) hanging off a joint group for one new limb segment. */
function reskinLimb(group: THREE.Group, length: number, radius: number): void {
  for (const child of [...group.children]) {
    if (child instanceof THREE.Mesh && child.geometry.type === 'CylinderGeometry') {
      child.geometry.dispose();
      group.remove(child);
    }
  }
  const geo = new THREE.CylinderGeometry(radius, radius * 0.9, length, 6);
  geo.translate(0, -length / 2, 0);
  mesh(geo, suitMaterial(), group);
}

export function dressInSuit(j: Joints, variant: number): void {
  // --- Torso: tapered box (broad shoulders, narrower waist) ---
  j.torso.geometry.dispose();
  const torsoGeo = new THREE.BoxGeometry(0.36, 0.6, 0.2);
  const pos = torsoGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 0) pos.setX(i, pos.getX(i) * 0.85);
  }
  torsoGeo.computeVertexNormals();
  j.torso.geometry = torsoGeo;
  j.torso.material = suitMaterial();

  // White shirt V under the jacket, tie on top of it
  const v = new THREE.Shape();
  v.moveTo(-0.08, 0.3); v.lineTo(0.08, 0.3); v.lineTo(0, 0.02); v.closePath();
  mesh(new THREE.ShapeGeometry(v), shirtMaterial(), j.torso).position.z = 0.101;
  const tie = mesh(new THREE.PlaneGeometry(0.08, 0.3), tieMaterial(), j.torso);
  tie.position.set(0, 0.14, 0.103);
  tie.castShadow = false;
  // Shirt collar points either side of the knot
  for (const side of [-1, 1]) {
    const collar = mesh(new THREE.BoxGeometry(0.06, 0.035, 0.02), shirtMaterial(), j.torso);
    collar.position.set(side * 0.04, 0.285, 0.1);
    collar.rotation.z = side * -0.5;
  }

  // --- Sleeves and trousers (same pivots as the stick limbs) ---
  for (const g of [j.leftUpperArm, j.leftForearm, j.rightUpperArm, j.rightForearm]) reskinLimb(g, 0.3, 0.055);
  for (const g of [j.leftUpperLeg, j.leftLowerLeg, j.rightUpperLeg, j.rightLowerLeg]) reskinLimb(g, 0.4, 0.065);
  for (const f of [j.leftFoot, j.rightFoot]) {
    f.geometry.dispose();
    f.geometry = new THREE.BoxGeometry(0.1, 0.06, 0.16);
    f.material = getToonMaterial(SHOE);
  }

  // --- Neck, head, face, hair ---
  mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.14, 6), getToonMaterial(Colors.skin), j.neck).position.y = -0.03;
  j.head.geometry.dispose();
  j.head.geometry = new THREE.IcosahedronGeometry(0.15, 1); // low-poly
  j.head.scale.set(0.95, 1.08, 1);

  // Plain face: two dot eyes, nothing else, so no one in particular
  for (const side of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.025, 0.03, 0.01), getToonMaterial(EYE), j.head).position.set(side * 0.05, 0.02, 0.145);
  }

  // Short hair parted and swept to one side
  const hairMat = getToonMaterial(HAIR[variant % HAIR.length]);
  const cap = mesh(new THREE.SphereGeometry(0.16, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat, j.head);
  cap.position.y = 0.01;
  const back = mesh(new THREE.SphereGeometry(0.158, 8, 6, Math.PI, Math.PI, 0, Math.PI * 0.68), hairMat, j.head);
  back.position.y = 0.005;
  const swoop = mesh(new THREE.BoxGeometry(0.2, 0.045, 0.1), hairMat, j.head);
  swoop.position.set(0.02, 0.125, 0.075);
  swoop.rotation.set(0.35, 0, -0.25);
}
