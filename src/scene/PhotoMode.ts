import * as THREE from 'three';
import { setCameraFrozen, setCameraView } from './FreeCamera.js';

// 📷 photo mode: each click goes ① → ② → ③ → back to the normal view.
// The ceiling and the wall between the camera and the room are hidden, and the
// on-screen panels are hidden by the body.photo-mode CSS in index.html.

interface Shot {
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  hideWall: string | null;
  /** Also hide meshes hung on that wall (z beyond this), e.g. the back of the situation board */
  hideBeyondZ?: number;
}

const SHOTS: Shot[] = [
  { label: '① 지휘관석 → 상황판', position: [0, 21, 25], target: [0, 0, -1.5], hideWall: 'wall-front' },
  { label: '② 상황판 → 지휘관석', position: [0, 21, -24], target: [0, 0, 1.5], hideWall: 'wall-back', hideBeyondZ: -12.4 },
  { label: '③ 위에서', position: [0, 30, 0.5], target: [0, 0, 0], hideWall: null },
];
const PHOTO_FOV = 45;

export function initPhotoMode(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
  const byName = (n: string) => scene.getObjectByName(n);
  const ceiling = byName('ceiling');
  const normalFov = camera.fov;

  let index = -1; // -1 = normal view
  let saved: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;
  let hiddenExtras: THREE.Object3D[] = [];
  const wp = new THREE.Vector3();

  const btn = document.createElement('button');
  btn.id = 'photo-btn';
  btn.textContent = '📷 촬영 모드';
  document.body.appendChild(btn);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (index === -1) {
      // Remember where the user was looking so we can come back
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      saved = { position: camera.position.clone(), target: camera.position.clone().add(forward) };
    }
    index = index + 1 < SHOTS.length ? index + 1 : -1;

    // Reset walls, then hide what this shot needs hidden
    for (const s of SHOTS) if (s.hideWall) { const w = byName(s.hideWall); if (w) w.visible = true; }
    if (ceiling) ceiling.visible = index === -1;
    for (const o of hiddenExtras) o.visible = true;
    hiddenExtras = [];

    if (index === -1) {
      document.body.classList.remove('photo-mode');
      camera.fov = normalFov;
      camera.updateProjectionMatrix();
      if (saved) setCameraView(camera, saved.position, saved.target);
      setCameraFrozen(false);
      btn.textContent = '📷 촬영 모드';
      return;
    }

    const shot = SHOTS[index];
    if (shot.hideWall) { const w = byName(shot.hideWall); if (w) w.visible = false; }
    if (shot.hideBeyondZ !== undefined) {
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || !o.visible) return;
        if (o.getWorldPosition(wp).z < shot.hideBeyondZ!) hiddenExtras.push(o);
      });
      for (const o of hiddenExtras) o.visible = false;
    }
    document.body.classList.add('photo-mode');
    camera.fov = PHOTO_FOV;
    camera.updateProjectionMatrix();
    setCameraFrozen(true);
    setCameraView(camera, new THREE.Vector3(...shot.position), new THREE.Vector3(...shot.target));
    btn.textContent = `📷 ${shot.label}`;
  });
}
