import * as THREE from 'three';
import { createExecutiveDesk, ExecDeskOptions, DESK_HEIGHT } from './ExecutiveDesk.js';

// Back-row desk sizes (command-center). Standard desk is 1.8 × 0.9 with a 0.7 × 0.45 monitor.
// Review: 1.5× wide, 1.3× deep, 1.5× monitor. Commander: largest desk, 2 monitors, largest chair.
export const REVIEW_DESK: ExecDeskOptions = {
  width: 2.7, depth: 1.17, monitors: 1, monitorScale: 1.5, chairWidth: 0.6, chairBack: 0.8,
};
export const COMMANDER_DESK: ExecDeskOptions = {
  width: 3.2, depth: 1.4, monitors: 2, monitorScale: 1.5, chairWidth: 0.72, chairBack: 1.0,
};

/** z of the commander desk (back row). Office.ts places it here; Commander.ts seats the user here. */
export const COMMANDER_Z = 8;

// Commander's seat (the user's). Deliberately NOT a station: agents are never assigned here.
export function createCommanderDesk(): THREE.Group {
  const desk = createExecutiveDesk(COMMANDER_DESK);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#1a1d22';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#c9a54a';
  g.lineWidth = 4;
  g.strokeRect(4, 4, 248, 56);
  g.fillStyle = '#e6c463';
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('COMMANDER', 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  // Plate stands on the desk's front edge (local -z, visitor side), facing away from the chair
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.17, 0.03),
    [0, 0, 0, 0, 0, 1].map((i) =>
      i ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshBasicMaterial({ color: 0x1a1d22 })
    )
  );
  // BoxGeometry face 5 is -z: textured side faces outward
  plate.position.set(0, DESK_HEIGHT + 0.12, -COMMANDER_DESK.depth / 2 + 0.08);
  desk.add(plate);

  return desk;
}
