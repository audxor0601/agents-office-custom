import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Colors } from '../utils/Colors.js';
import { initFreeCamera } from './FreeCamera.js';
import { createCeilingLampWithLight } from '../furniture/CeilingLamp.js';
import { getEmissiveMaterial } from '../utils/Materials.js';
import { theme } from '../utils/Theme.js';

export const ALARM_INTENSITY = 1.5;

export function createScene() {
  // Scene
  const scene = new THREE.Scene();
  scene.background = Colors.sky;

  // Camera
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(-12, 5.5, 11);
  const lookAtTarget = new THREE.Vector3(2, 1, -2);

  // WebGL Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme.lighting.exposure;
  document.body.appendChild(renderer.domElement);

  // CSS2D Renderer for labels
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  document.body.appendChild(labelRenderer.domElement);

  // Free camera (pointer lock + WASD)
  initFreeCamera(camera, renderer.domElement, lookAtTarget);

  // --- Lighting ---

  // Ambient light (soft fill for the whole room)
  const L = theme.lighting;
  const ambientLight = new THREE.AmbientLight(L.ambient.color, L.ambient.intensity);
  scene.add(ambientLight);

  // Hemisphere light (sky/ground bounce)
  const hemiLight = new THREE.HemisphereLight(L.hemi.sky, L.hemi.ground, L.hemi.intensity);
  hemiLight.position.set(0, 10, 0);
  scene.add(hemiLight);

  // 3 ceiling lamps with spotlights
  const lampPositions: [number, number][] = [
    [0, -7],   // back area (desks/whiteboards)
    [0, 0],    // center
    [0, 7],    // front area (coffee/meeting)
  ];

  for (const [x, z] of lampPositions) {
    const { lampGroup, light } = createCeilingLampWithLight(x, z);
    scene.add(lampGroup);
    scene.add(light);
    scene.add(light.target);
  }

  // Red warning beacons (command-center theme only; pulsed in main.ts)
  const alarmLights: THREE.PointLight[] = [];
  const beaconMat = getEmissiveMaterial(0x661010, 0xff2a1a, 2);
  for (const [x, y, z] of L.alarms) {
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), beaconMat);
    beacon.position.set(x, y, z);
    scene.add(beacon);
    // Small local glow only (2.5-unit reach) so it doesn't tint the room
    const light = new THREE.PointLight(0xff2a1a, ALARM_INTENSITY, 2.5, 2);
    light.position.set(x, y - 0.3, z + 0.3);
    scene.add(light);
    alarmLights.push(light);
  }

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, labelRenderer, alarmLights };
}
