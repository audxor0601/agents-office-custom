import * as THREE from 'three';
import { StickFigure } from './StickFigure.js';
import { updateLabel } from './Label.js';
import { Colors } from '../utils/Colors.js';
import { Activity } from '../agents/ActivityAnimations.js';
import { ACTIVITY_LABELS, ACTIVITY_STATION_MAP, AgentInfo } from '../agents/AgentData.js';
import { Station } from '../scene/Office.js';

// Command-center workforce: every desk is always staffed.
// Real Claude Code sessions / subagents don't get their own figure any more; each one is
// routed (by the job title the server gives it) to the employee who does that job.
// Review work goes to the two staff officers next to the commander.

const SECRETARY = '비서실장';
const STRATEGY = '전략기획 매니저';

// Desk employees. desk_0..3 = left leg (board side → commander), desk_4..7 = right leg.
const DESK_STAFF: [string, string][] = [
  ['desk_0', '채용 리서처'], ['desk_1', '채용 분석가'], ['desk_2', '카피라이터'], ['desk_3', '에디터'],
  ['desk_4', '연구원'], ['desk_5', '디자이너'], ['desk_6', '엔지니어'], ['desk_7', '공간 디자이너'],
];
const OFFICER_SEATS: [string, string][] = [['review_0', SECRETARY], ['review_1', STRATEGY]];

// Work done sitting at one's own desk (no walking)
const AT_DESK = new Set(['implementing', 'meeting', 'idle']);

type Drink = 'water' | 'coffee';
const PANTRY: Record<Drink, string> = { water: 'pantry_water', coffee: 'pantry_coffee' };
const POUR_TIME = 1.5;   // seconds standing at the machine
const SIP_CYCLE = 5;     // seconds per sip
const SIPS = 3;

/** A coffee/water break in progress (휴식 중). */
interface Break {
  phase: 'toPantry' | 'pouring' | 'toDesk' | 'drinking' | 'resting';
  drink: Drink;
  timer: number;
  /** Cup left on the desk after drinking */
  deskCup: THREE.Object3D | null;
}

interface Employee {
  title: string;
  figure: StickFigure;
  homeKey: string;
  officer: boolean;
  /** agentId → activity, in arrival order. The newest one is what the figure shows. */
  tasks: Map<string, Activity>;
  stationKey: string;
  brk: Break | null;
}

export class Workforce {
  private employees: Employee[] = [];
  private stations: Map<string, Station>;
  /** agentId → the employee doing its work right now */
  private assigned = new Map<string, Employee>();
  /** Review requests waiting for a free officer */
  private reviewQueue: { id: string; activity: Activity }[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, stations: Map<string, Station>) {
    this.scene = scene;
    this.stations = stations;
    const seats = [...DESK_STAFF.map(([k, t]) => [k, t, false] as const), ...OFFICER_SEATS.map(([k, t]) => [k, t, true] as const)];
    seats.forEach(([key, title, officer], i) => {
      const station = stations.get(key);
      if (!station) return;
      station.occupied = true; // permanently someone's seat
      const figure = new StickFigure(title, Colors.accents[i % Colors.accents.length], i);
      figure.seated = true;
      figure.teleportTo(station.position, station.lookAt);
      scene.add(figure.group);
      const e: Employee = { title, figure, homeKey: key, officer, tasks: new Map(), stationKey: key, brk: null };
      this.employees.push(e);
      this.refresh(e);
    });
  }

  /** A session/subagent appeared or changed activity. */
  set(info: AgentInfo): void {
    // Only reviewing goes to the officers; writing docs is done at the employee's own desk
    const reviewing = info.activity === 'reviewing';
    const current = this.assigned.get(info.id);

    // Already with the right kind of employee: just update the activity
    if (current && current.officer === reviewing) {
      current.tasks.set(info.id, info.activity);
      this.refresh(current);
      return;
    }
    if (current) this.drop(info.id);
    this.reviewQueue = this.reviewQueue.filter((q) => q.id !== info.id);

    if (reviewing) {
      const officer = this.freeOfficer();
      if (officer) this.give(officer, info.id, info.activity);
      else this.reviewQueue.push({ id: info.id, activity: info.activity });
      return;
    }
    this.give(this.byTitle(info.name), info.id, info.activity);
  }

  /** A session/subagent went away. */
  remove(agentId: string): void {
    this.reviewQueue = this.reviewQueue.filter((q) => q.id !== agentId);
    this.drop(agentId);
  }

  update(elapsed: number, delta: number): void {
    for (const e of this.employees) {
      if (e.brk) this.stepBreak(e, delta);
      e.figure.update(elapsed, delta);
    }
  }

  // --- breaks (휴식 중): fetch water or coffee, drink it at the desk ---

  private startBreak(e: Employee): void {
    const first: Drink = Math.random() < 0.5 ? 'water' : 'coffee';
    const other: Drink = first === 'water' ? 'coffee' : 'water';
    const drink = [first, other].find((d) => !this.stations.get(PANTRY[d])?.occupied);
    // Both spots taken: no queue, just rest at the desk with arms down
    if (!drink) { e.brk = { phase: 'resting', drink: first, timer: 0, deskCup: null }; return; }

    const spot = this.stations.get(PANTRY[drink])!;
    spot.occupied = true;
    e.brk = { phase: 'toPantry', drink, timer: 0, deskCup: null };
    e.stationKey = PANTRY[drink];
    e.figure.seated = false;
    e.figure.moveTo(spot.position, spot.lookAt);
  }

  private stepBreak(e: Employee, dt: number): void {
    const b = e.brk!;
    const f = e.figure;
    switch (b.phase) {
      case 'toPantry':
        if (!f.moving) { b.phase = 'pouring'; b.timer = POUR_TIME; }
        break;
      case 'pouring':
        b.timer -= dt;
        if (b.timer <= 0) {
          f.takeCup(b.drink);
          f.hold = 0;
          this.stations.get(PANTRY[b.drink])!.occupied = false;
          const home = this.stations.get(e.homeKey)!;
          e.stationKey = e.homeKey;
          f.moveTo(home.position, home.lookAt);
          b.phase = 'toDesk';
        }
        break;
      case 'toDesk':
        if (!f.moving) { f.seated = true; b.phase = 'drinking'; b.timer = 0; }
        break;
      case 'drinking': {
        b.timer += dt;
        // Each cycle: hold the cup, then a ~1.6 s sip near the end
        const c = b.timer % SIP_CYCLE;
        f.hold = c > SIP_CYCLE - 1.6 ? Math.sin(((c - (SIP_CYCLE - 1.6)) / 1.6) * Math.PI) : 0;
        if (b.timer >= SIP_CYCLE * SIPS) {
          b.deskCup = this.putCupOnDesk(e);
          b.phase = 'resting';
        }
        break;
      }
      case 'resting':
        break;
    }
  }

  /** Set the held cup down on the desk, to the right of the keyboard. */
  private putCupOnDesk(e: Employee): THREE.Object3D | null {
    const cup = e.figure.dropCup();
    if (!cup) return null;
    const home = this.stations.get(e.homeKey)!;
    const fwd = new THREE.Vector3().subVectors(home.lookAt, home.position).setY(0).normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    cup.rotation.set(0, 0, 0);
    cup.position.copy(home.position).addScaledVector(fwd, 0.5).addScaledVector(right, -0.35);
    cup.position.y = 0.79;
    this.scene.add(cup);
    return cup;
  }

  /** Leave the break right away (new work arrived): drop everything, free the spot. */
  private endBreak(e: Employee): void {
    const b = e.brk;
    if (!b) return;
    if (b.phase === 'toPantry' || b.phase === 'pouring') this.stations.get(PANTRY[b.drink])!.occupied = false;
    e.figure.dropCup();
    b.deskCup?.removeFromParent();
    e.brk = null;
    if (e.stationKey !== e.homeKey) {
      const home = this.stations.get(e.homeKey)!;
      e.stationKey = e.homeKey;
      e.figure.moveTo(home.position, home.lookAt);
    }
    e.figure.seated = true;
  }

  // --- internals ---

  private byTitle(name: string): Employee {
    const title = name.replace(/^>>\s*/, ''); // subagents arrive as ">> 채용 리서처"
    return this.employees.find((e) => e.title === title)
      ?? this.employees.find((e) => e.title === SECRETARY)!; // unknown jobs go to the secretary (잡무)
  }

  /** Strategy manager first; the secretary helps when it is free of its own work. */
  private freeOfficer(): Employee | undefined {
    const officers = this.employees.filter((e) => e.officer);
    const strategy = officers.find((e) => e.title === STRATEGY);
    if (strategy && strategy.tasks.size === 0) return strategy;
    return officers.find((e) => e.title === SECRETARY && e.tasks.size === 0) ?? (strategy && strategy.tasks.size === 0 ? strategy : undefined);
  }

  private give(e: Employee, agentId: string, activity: Activity): void {
    e.tasks.set(agentId, activity);
    this.assigned.set(agentId, e);
    this.refresh(e);
  }

  private drop(agentId: string): void {
    const e = this.assigned.get(agentId);
    if (!e) return;
    e.tasks.delete(agentId);
    this.assigned.delete(agentId);
    // A freed officer picks up the next waiting review
    if (e.officer && e.tasks.size === 0) {
      const next = this.reviewQueue.shift();
      if (next) { this.give(e, next.id, next.activity); return; }
    }
    this.refresh(e);
  }

  /** Move/animate the figure and rewrite its label from its current tasks. */
  private refresh(e: Employee): void {
    const list = [...e.tasks.values()];
    const activity: Activity | null = list.length ? list[list.length - 1] : null;

    // 휴식 중: desk staff go for water/coffee once; anything else ends the break
    if (activity === 'idle' && !e.officer) {
      if (!e.brk) this.startBreak(e);
      e.figure.setActivity('idle');
      const st = ACTIVITY_LABELS.idle;
      updateLabel(e.figure.label, e.title, list.length > 1 ? `${st} (${list.length}건)` : st);
      return;
    }
    if (e.brk) this.endBreak(e);

    // Where to be: officers always stay seated; desk staff walk to the matching station
    let target = e.homeKey;
    if (activity && !e.officer && activity !== 'writing_docs' && !AT_DESK.has(ACTIVITY_STATION_MAP[activity])) {
      const type = ACTIVITY_STATION_MAP[activity];
      const found = [...this.stations].find(([k, s]) => s.type === type && (!s.occupied || k === e.stationKey));
      if (found) target = found[0];
    }
    if (target !== e.stationKey) {
      if (e.stationKey !== e.homeKey) this.stations.get(e.stationKey)!.occupied = false;
      const st = this.stations.get(target)!;
      if (target !== e.homeKey) st.occupied = true;
      e.stationKey = target;
      e.figure.seated = target === e.homeKey;
      e.figure.moveTo(st.position, st.lookAt);
    }

    // Officers do non-review work as desk work so they never stand up from the chair
    let pose: Activity = activity ?? 'idle';
    if (e.officer && pose !== 'idle' && pose !== 'reviewing' && pose !== 'writing_docs') pose = 'implementing';
    e.figure.setActivity(pose);

    const status = activity ? ACTIVITY_LABELS[activity] : '대기';
    updateLabel(e.figure.label, e.title, list.length > 1 ? `${status} (${list.length}건)` : status);
  }
}
