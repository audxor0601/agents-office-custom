import * as THREE from 'three';
import { createScene, ALARM_INTENSITY } from './scene/SceneSetup.js';
import { createOffice, HOME_DESK_ORDER } from './scene/Office.js';
import { AgentManager } from './agents/AgentManager.js';
import { ACTIVITIES, ACTIVITY_LABELS } from './agents/AgentData.js';
import { Activity } from './agents/ActivityAnimations.js';
import { updateFreeCamera } from './scene/FreeCamera.js';
import { AgentPoller } from './agents/AgentPoller.js';
import { switchTheme, nextThemeLabel, themeName } from './utils/Theme.js';
import { createSituationBoard } from './furniture/CommandScreens.js';
import { createCommander } from './characters/Commander.js';
import { Workforce } from './characters/Staff.js';
import { initPhotoMode } from './scene/PhotoMode.js';

// Setup scene
const { scene, camera, renderer, labelRenderer, alarmLights } = createScene();

// Theme toggle button
const themeBtn = document.getElementById('theme-toggle')!;
themeBtn.textContent = `테마: ${nextThemeLabel()}(으)로`;
themeBtn.addEventListener('click', switchTheme);

// Build office and get stations
const stations = createOffice(scene);
const situationBoard = themeName === 'command-center' ? createSituationBoard(scene) : null;

// 📷 photo mode button (after the office is built, so walls/ceiling can be found by name)
initPhotoMode(scene, camera);

// Agent manager
// Command-center: every desk is always staffed (8 employees + 비서실장 + 전략기획 매니저);
// sessions and subagents are shown through the employee who does that job.
const staff = themeName === 'command-center' ? new Workforce(scene, stations) : null;
const agentManager = new AgentManager(scene, stations, HOME_DESK_ORDER, staff);

// The user (마스터) always sits at the commander desk. Not a session agent.
const commander = themeName === 'command-center' ? createCommander(scene) : null;

// --- UI Panel ---
function buildUI(): void {
  const listEl = document.getElementById('agent-list')!;
  listEl.innerHTML = '';

  for (const managed of agentManager.getAgents()) {
    const card = document.createElement('div');
    card.className = 'agent-card';

    const nameEl = document.createElement('div');
    nameEl.className = 'agent-name';
    nameEl.textContent = managed.info.name;
    card.appendChild(nameEl);

    const select = document.createElement('select');
    for (const act of ACTIVITIES) {
      const option = document.createElement('option');
      option.value = act;
      option.textContent = ACTIVITY_LABELS[act];
      if (act === managed.info.activity) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      agentManager.setActivity(managed.info.id, select.value as Activity);
    });
    card.appendChild(select);

    listEl.appendChild(card);
  }
}

// Start polling for real agents (falls back to mock if none found)
const poller = new AgentPoller(agentManager);
poller.start(3000, buildUI);

// --- Render loop ---
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  updateFreeCamera(camera, delta);
  agentManager.update(elapsed, delta);
  commander?.update(elapsed, delta);
  staff?.update(elapsed, delta);
  situationBoard?.update(elapsed);
  for (const l of alarmLights) l.intensity = ALARM_INTENSITY * (0.5 + 0.5 * Math.sin(elapsed * 3));

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

animate();
