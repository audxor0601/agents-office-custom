import * as THREE from 'three';
import { createFloor } from '../furniture/Floor.js';
import { createDesk } from '../furniture/Desk.js';
import { createWhiteboard } from '../furniture/Whiteboard.js';
import { createBookshelf } from '../furniture/Bookshelf.js';
import { createCoffeeMachine } from '../furniture/CoffeeMachine.js';
import { createTestStation } from '../furniture/TestStation.js';
import { createWalls } from '../furniture/Walls.js';
import { createDecorations } from '../furniture/Decorations.js';
import { createMeetingTable } from '../furniture/MeetingTable.js';
import { createSofa } from '../furniture/Sofa.js';
import { createWaterCooler } from '../furniture/WaterCooler.js';
import { createWaterPurifier, createEspressoMachine } from '../furniture/Pantry.js';
import { createPrinter } from '../furniture/Printer.js';
import { createCommanderDesk, COMMANDER_DESK, REVIEW_DESK, COMMANDER_Z } from '../furniture/CommanderDesk.js';
import { createExecutiveDesk, execSeatZ, execMonitorZ } from '../furniture/ExecutiveDesk.js';
import { createTaegukgi } from '../furniture/Taegukgi.js';
import { createResearchConsole, createSecurityDoor, createWallSpeaker, createCeilingAC } from '../furniture/OfficeExtras.js';
import { OFFICE } from '../utils/Constants.js';
import { themeName } from '../utils/Theme.js';

export interface Station {
  type: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  occupied: boolean;
}

// Command-center: each agent gets its own desk, handed out front (board side) to back,
// alternating left leg (desk_0..3) and right leg (desk_4..7). Null = no home desks.
export const HOME_DESK_ORDER: string[] | null = themeName === 'command-center'
  ? ['desk_0', 'desk_4', 'desk_1', 'desk_5', 'desk_2', 'desk_6', 'desk_3', 'desk_7']
  : null;

export function createOffice(scene: THREE.Scene): Map<string, Station> {
  const stations = new Map<string, Station>();

  // Floor
  scene.add(createFloor());

  // Walls + Ceiling
  scene.add(createWalls());

  // Decorations (plants, art, clock, rugs)
  scene.add(createDecorations());

  // --- Whiteboards (Planning) — against back wall ---
  const wb1 = createWhiteboard();
  wb1.position.set(-5, 0, -12);
  // Command-center: whiteboard models hidden (they block the situation board).
  // The planning stations below stay; agents stand there facing the board instead.
  wb1.visible = themeName !== 'command-center';
  scene.add(wb1);
  stations.set('whiteboard_0', {
    type: 'planning',
    position: new THREE.Vector3(-5, 0, -11.2),
    lookAt: new THREE.Vector3(-5, 1.5, -12),
    occupied: false,
  });

  const wb2 = createWhiteboard();
  wb2.position.set(5, 0, -12);
  wb2.visible = themeName !== 'command-center';
  scene.add(wb2);
  stations.set('whiteboard_1', {
    type: 'planning',
    position: new THREE.Vector3(5, 0, -11.2),
    lookAt: new THREE.Vector3(5, 1.5, -12),
    occupied: false,
  });

  // --- Coding Desks ---
  // [x, z, rotationY]. Default: 2 rows of 4 facing the back wall.
  // Command-center: U shape. The two legs run from the board side (z = -6.5) toward the
  // commander's row (z = 8), facing the center aisle; the base is the commander row (below).
  const deskPositions: [number, number, number][] = themeName === 'command-center'
    ? [
        [-5.6, -6.5, -Math.PI / 2], [-5.6, -2.5, -Math.PI / 2], // left leg (faces +x)
        [-5.6, 1.5, -Math.PI / 2], [-5.6, 5.5, -Math.PI / 2],
        [5.6, -6.5, Math.PI / 2], [5.6, -2.5, Math.PI / 2],     // right leg (faces -x)
        [5.6, 1.5, Math.PI / 2], [5.6, 5.5, Math.PI / 2],
      ]
    : [
        [-8, -5, 0], [-3, -5, 0], [3, -5, 0], [8, -5, 0],
        [-8, -2, 0], [-3, -2, 0], [3, -2, 0], [8, -2, 0],
      ];
  deskPositions.forEach(([x, z, rot], i) => {
    const desk = createDesk(true);
    desk.position.set(x, 0, z);
    desk.rotation.y = rot;
    scene.add(desk);
    // Seat (local z +0.7) and monitor (local z -0.15) offsets, rotated with the desk.
    // rot = 0 gives exactly the original (x, z + 0.7) / (x, z - 0.15).
    const s = Math.sin(rot), c = Math.cos(rot);
    stations.set(`desk_${i}`, {
      type: 'implementing',
      position: new THREE.Vector3(x + 0.7 * s, 0, z + 0.7 * c),
      lookAt: new THREE.Vector3(x - 0.15 * s, 1.2, z - 0.15 * c),
      occupied: false,
    });
  });

  // --- Commander row = U base (command-center only), back of the room facing the board ---
  // 3 separate executive desks with 1.25 m gaps:
  //   review_0 (x -4.2, 2.7 wide) | COMMANDER (x 0, 3.2 wide) | review_1 (x 4.2, 2.7 wide)
  // Spans x -5.55..5.55, z 7.3..8.7 (+ chairs to ~9.5). Nearest U-leg desks (z 4.6..6.4)
  // end ≥ 0.9 m in front of it, so nothing overlaps.
  // The commander desk is NOT a station: agents are never assigned to it.
  const CMD_Z = COMMANDER_Z;
  const REVIEW_X = COMMANDER_DESK.width / 2 + 1.25 + REVIEW_DESK.width / 2; // 4.2
  if (themeName === 'command-center') {
    const commander = createCommanderDesk();
    commander.position.set(0, 0, CMD_Z);
    scene.add(commander);

    // Taegukgi centered on the wall behind the commander (z = +halfZ), facing the board.
    // 3:2 can't reach 40% of the 30-wide wall in a 6-high room: 3.6 high × 5.4 wide (18%),
    // spanning y 2.1–5.7 (above a seated commander's head, just under the ceiling).
    scene.add(createTaegukgi(3.6, 3.9, OFFICE.halfZ - 0.1));
  }

  // --- Bookshelves (Researching) — along left wall ---
  // Command-center: analysis consoles instead of bookshelves (same researching stations)
  const cc = themeName === 'command-center';
  const bookshelf1 = cc ? createResearchConsole() : createBookshelf();
  bookshelf1.position.set(-13.5, 0, -2);
  bookshelf1.rotation.y = Math.PI / 2;
  scene.add(bookshelf1);

  const bookshelf2 = cc ? createResearchConsole() : createBookshelf();
  bookshelf2.position.set(-13.5, 0, 0.5);
  bookshelf2.rotation.y = Math.PI / 2;
  scene.add(bookshelf2);

  stations.set('bookshelf_0', {
    type: 'researching',
    position: new THREE.Vector3(-12.5, 0, -2),
    lookAt: new THREE.Vector3(-13.5, 1.0, -2),
    occupied: false,
  });
  stations.set('bookshelf_1', {
    type: 'researching',
    position: new THREE.Vector3(-12.5, 0, 0.5),
    lookAt: new THREE.Vector3(-13.5, 1.0, 0.5),
    occupied: false,
  });

  // --- Test Station (Running tests) — right side ---
  const testStation1 = createTestStation();
  testStation1.position.set(12, 0, -2);
  scene.add(testStation1);
  stations.set('test_0', {
    type: 'testing',
    position: new THREE.Vector3(12, 0, -1.2),
    lookAt: new THREE.Vector3(12, 1.4, -2),
    occupied: false,
  });

  const testStation2 = createTestStation();
  testStation2.position.set(12, 0, 1.5);
  scene.add(testStation2);
  stations.set('test_1', {
    type: 'testing',
    position: new THREE.Vector3(12, 0, 2.2),
    lookAt: new THREE.Vector3(12, 1.4, 1.5),
    occupied: false,
  });

  // --- Review Desks (Reviewing / Writing docs) ---
  // Command-center: only 2 review seats, either side of the commander, facing the board.
  if (themeName === 'command-center') {
    // Executive review desks; station = the chair, looking at the monitor
    [-REVIEW_X, REVIEW_X].forEach((x, i) => {
      const desk = createExecutiveDesk(REVIEW_DESK);
      desk.position.set(x, 0, CMD_Z);
      scene.add(desk);
      stations.set(`review_${i}`, {
        type: 'reviewing',
        position: new THREE.Vector3(x, 0, CMD_Z + execSeatZ(REVIEW_DESK)),
        lookAt: new THREE.Vector3(x, 1.2, CMD_Z + execMonitorZ(REVIEW_DESK)),
        occupied: false,
      });
    });
  }
  const reviewPositions: [number, number][] = themeName === 'command-center'
    ? []
    : [
        [-5, 4],
        [3, 4],
        [9, 4],
      ];
  reviewPositions.forEach(([x, z], i) => {
    const desk = createDesk(true);
    desk.position.set(x, 0, z);
    scene.add(desk);
    stations.set(`review_${i}`, {
      type: 'reviewing',
      position: new THREE.Vector3(x, 0, z + 0.7),
      lookAt: new THREE.Vector3(x, 1.2, z - 0.15),
      occupied: false,
    });
  });

  // --- Coffee Machine (Idle) — front-left ---
  const coffee = cc ? createEspressoMachine() : createCoffeeMachine();
  // Command-center: coffee + water cooler live in the back-right corner (right of the commander)
  if (cc) {
    coffee.position.set(13.4, 0, 12.55);
    coffee.rotation.y = Math.PI; // machine front faces into the room
  }
  else coffee.position.set(-12, 0, 9);
  scene.add(coffee);
  stations.set('coffee_0', {
    type: 'idle',
    position: cc ? new THREE.Vector3(13.4, 0, 11.6) : new THREE.Vector3(-11.2, 0, 9),
    lookAt: cc ? new THREE.Vector3(13.4, 1.0, 12.6) : new THREE.Vector3(-12, 1.0, 9),
    occupied: false,
  });
  stations.set('coffee_1', {
    type: 'idle',
    position: cc ? new THREE.Vector3(12.3, 0, 11.8) : new THREE.Vector3(-10.8, 0, 9.5),
    lookAt: cc ? new THREE.Vector3(13.4, 1.0, 12.6) : new THREE.Vector3(-12, 1.0, 9),
    occupied: false,
  });

  // --- Water Cooler — near coffee ---
  const waterCooler = cc ? createWaterPurifier() : createWaterCooler();
  if (cc) {
    waterCooler.position.set(14.5, 0, 12.55);
    waterCooler.rotation.y = Math.PI; // tap faces into the room
  } else {
    waterCooler.position.set(-12, 0, 7);
  }
  scene.add(waterCooler);

  // Command-center break spots: one person at the purifier, one at the coffee machine
  if (cc) {
    stations.set('pantry_water', {
      type: 'pantry',
      position: new THREE.Vector3(14.5, 0, 11.75),
      lookAt: new THREE.Vector3(14.5, 1.0, 12.6),
      occupied: false,
    });
    stations.set('pantry_coffee', {
      type: 'pantry',
      position: new THREE.Vector3(13.55, 0, 11.75),
      lookAt: new THREE.Vector3(13.55, 1.0, 12.6),
      occupied: false,
    });
  }

  if (cc) {
    // Security door on the left wall, where the coffee corner used to be
    const door = createSecurityDoor();
    door.position.set(-OFFICE.halfX + 0.075, 0, 7);
    door.rotation.y = Math.PI / 2; // faces +x, into the room
    scene.add(door);

    // Wall speakers at the top-left / top-right corners of the situation board, angled down and in
    for (const s of [-1, 1]) {
      const spk = createWallSpeaker();
      spk.position.set(s * 13.4, 5.0, -OFFICE.halfZ + 0.075 + 0.405);
      spk.rotation.set(0.3, -s * 0.35, 0, 'YXZ');
      scene.add(spk);
    }

    // Ceiling cassette air conditioners between the three ceiling lamps (z = -7, 0, 7)
    for (const z of [-3.5, 3.5]) {
      const ac = createCeilingAC();
      ac.position.set(0, OFFICE.height, z);
      scene.add(ac);
    }
  }

  // --- Printer — against right wall ---
  const printer = createPrinter();
  printer.position.set(13, 0, 5);
  printer.rotation.y = -Math.PI / 2;
  scene.add(printer);

  // --- Meeting area (front-right) — round table + sofa ---
  // Command-center: table (with its 4 chairs) and sofas removed; meeting stations become
  // a "reporting" spot 1.2–1.6 m in front of the commander's desk, facing the commander.
  const commandCenter = themeName === 'command-center';
  const meetingTable = createMeetingTable();
  meetingTable.position.set(9, 0, 9);
  meetingTable.visible = !commandCenter;
  scene.add(meetingTable);

  const commanderSeat = new THREE.Vector3(0, 1.2, CMD_Z + 0.7);
  stations.set('meeting_0', {
    type: 'meeting',
    position: commandCenter ? new THREE.Vector3(0, 0, CMD_Z - 2.0) : new THREE.Vector3(9, 0, 7.3),
    lookAt: commandCenter ? commanderSeat : new THREE.Vector3(9, 1.2, 9),
    occupied: false,
  });
  stations.set('meeting_1', {
    type: 'meeting',
    position: commandCenter ? new THREE.Vector3(1.2, 0, CMD_Z - 1.6) : new THREE.Vector3(10.7, 0, 9),
    lookAt: commandCenter ? commanderSeat : new THREE.Vector3(9, 1.2, 9),
    occupied: false,
  });
  stations.set('meeting_2', {
    type: 'meeting',
    position: commandCenter ? new THREE.Vector3(-1.2, 0, CMD_Z - 1.6) : new THREE.Vector3(7.3, 0, 9),
    lookAt: commandCenter ? commanderSeat : new THREE.Vector3(9, 1.2, 9),
    occupied: false,
  });

  // --- Sofa — lounge area front-left ---
  const sofa1 = createSofa(0x6a5acd);
  sofa1.position.set(-6, 0, 10);
  sofa1.rotation.y = Math.PI;
  sofa1.visible = !commandCenter;
  scene.add(sofa1);

  const sofa2 = createSofa(0x5a7aad);
  sofa2.position.set(-3, 0, 10);
  sofa2.rotation.y = Math.PI;
  sofa2.visible = !commandCenter;
  scene.add(sofa2);

  // --- Second bookshelf against back wall (right side) ---
  const bookshelf3 = createBookshelf();
  bookshelf3.position.set(11, 0, -12);
  bookshelf3.visible = !cc; // removed under the situation board
  scene.add(bookshelf3);

  return stations;
}
