import * as THREE from 'three';
import { getToonMaterial, getEmissiveMaterial } from '../utils/Materials.js';
import { Colors } from '../utils/Colors.js';
import { themeName } from '../utils/Theme.js';
import { getConsoleMaterial } from './CommandScreens.js';

export function createTestStation(): THREE.Group {
  const group = new THREE.Group();

  // Tall desk
  const deskGeo = new THREE.BoxGeometry(1.4, 0.08, 0.7);
  const desk = new THREE.Mesh(deskGeo, getToonMaterial(Colors.desk));
  desk.position.set(0, 1.0, 0);
  desk.castShadow = true;
  desk.receiveShadow = true;
  group.add(desk);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.06, 1.0, 0.06);
  const legMat = getToonMaterial(Colors.deskLegs);
  const positions: [number, number, number][] = [
    [-0.6, 0.5, -0.25],
    [0.6, 0.5, -0.25],
    [-0.6, 0.5, 0.25],
    [0.6, 0.5, 0.25],
  ];
  for (const [x, y, z] of positions) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    group.add(leg);
  }

  // Large monitor
  const screenGeo = new THREE.BoxGeometry(0.9, 0.6, 0.04);
  const screen = new THREE.Mesh(screenGeo, getToonMaterial(Colors.monitor));
  screen.position.set(0, 1.44, -0.15);
  screen.castShadow = true;
  group.add(screen);

  // Monitor stand
  const standGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.2, 6);
  const stand = new THREE.Mesh(standGeo, getToonMaterial(Colors.monitor));
  stand.position.set(0, 1.1, -0.15);
  stand.castShadow = true;
  group.add(stand);

  // Screen face - green for tests passing
  const faceGeo = new THREE.PlaneGeometry(0.8, 0.5);
  const commandCenter = themeName === 'command-center';
  const face = new THREE.Mesh(faceGeo, commandCenter
    ? getConsoleMaterial() // blue comms / equipment-check screen
    : getEmissiveMaterial(Colors.monitorScreenActive, Colors.monitorScreenActive, 0.6));
  face.position.set(0, 1.44, -0.128);
  group.add(face);
  group.userData.screenFace = face;

  if (commandCenter) {
    group.add(createEquipmentRack());
    return group;
  }

  // Progress bar on screen
  const barBgGeo = new THREE.PlaneGeometry(0.6, 0.04);
  const barBg = new THREE.Mesh(barBgGeo, getToonMaterial(0x1a1a2a));
  barBg.position.set(0, 1.35, -0.125);
  group.add(barBg);

  const barGeo = new THREE.PlaneGeometry(0.4, 0.03);
  const bar = new THREE.Mesh(barGeo, getEmissiveMaterial(0x44ff44, 0x44ff44, 1.0));
  bar.position.set(-0.1, 1.35, -0.122);
  group.add(bar);

  return group;
}

// Small radio/equipment rack on the desk's right end: front panel with status LEDs + antenna
function createEquipmentRack(): THREE.Group {
  const rack = new THREE.Group();
  rack.position.set(0.58, 1.04, 0.02); // desk top surface is y = 1.04

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.4), getToonMaterial(0x2a3038));
  body.position.y = 0.21;
  body.castShadow = true;
  rack.add(body);

  const ledGeo = new THREE.BoxGeometry(0.025, 0.025, 0.01);
  const blue = getEmissiveMaterial(0x3fa9ff, 0x3fa9ff, 1.2);
  const amber = getEmissiveMaterial(0xffb43a, 0xffb43a, 1.0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const led = new THREE.Mesh(ledGeo, row === 1 && col === 3 ? amber : blue);
      led.position.set(-0.06 + col * 0.04, 0.32 - row * 0.07, 0.205);
      rack.add(led);
    }
  }

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 5), getToonMaterial(0x1a1d22));
  antenna.position.set(0.07, 0.6, -0.12);
  rack.add(antenna);

  return rack;
}
