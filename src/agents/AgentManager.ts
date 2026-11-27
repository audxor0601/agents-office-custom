import * as THREE from 'three';
import { StickFigure } from '../characters/StickFigure.js';
import { AgentInfo, ACTIVITY_STATION_MAP } from './AgentData.js';
import { Activity } from './ActivityAnimations.js';
import { Station } from '../scene/Office.js';
import { Colors } from '../utils/Colors.js';
import type { Workforce } from '../characters/Staff.js';

interface ManagedAgent {
  info: AgentInfo;
  /** null in workforce mode: the agent's work is shown by a permanent employee instead */
  figure: StickFigure | null;
  stationKey: string | null;
  /** Own desk for the agent's lifetime (command-center only). Stays reserved (occupied). */
  homeKey: string | null;
}

// Station types done at the agent's own desk when it has one
const HOME_TYPES = new Set(['implementing', 'meeting', 'idle']);

export class AgentManager {
  private agents = new Map<string, ManagedAgent>();
  private stations: Map<string, Station>;
  private scene: THREE.Scene;
  /** Order in which home desks are handed out; null = no home desks (default theme). */
  private homeOrder: string[] | null;
  /** Command-center: permanent staff do the agents' work; agents get no figure of their own. */
  private workforce: Workforce | null;

  constructor(scene: THREE.Scene, stations: Map<string, Station>, homeOrder: string[] | null = null, workforce: Workforce | null = null) {
    this.scene = scene;
    this.stations = stations;
    this.homeOrder = homeOrder;
    this.workforce = workforce;
  }

  addAgent(info: AgentInfo): StickFigure | null {
    if (this.workforce) {
      this.agents.set(info.id, { info, figure: null, stationKey: null, homeKey: null });
      this.workforce.set(info);
      return null;
    }

    const colorIndex = this.agents.size % Colors.accents.length;
    const figure = new StickFigure(info.name, Colors.accents[colorIndex], this.agents.size);

    const managed: ManagedAgent = {
      info,
      figure,
      stationKey: null,
      homeKey: null,
    };
    this.agents.set(info.id, managed);
    this.scene.add(figure.group);

    // Claim the first free home desk in order (reserved until the agent is removed).
    // Agents beyond the number of home desks get none and use the original behavior.
    if (this.homeOrder) {
      const key = this.homeOrder.find((k) => !this.stations.get(k)?.occupied);
      if (key) {
        this.stations.get(key)!.occupied = true;
        managed.homeKey = key;
      }
    }

    // Assign to station (teleport immediately, no walk animation)
    this.assignStation(managed, info.activity, true);

    return figure;
  }

  setActivity(agentId: string, activity: Activity): void {
    const managed = this.agents.get(agentId);
    if (!managed) return;
    if (this.workforce || !managed.figure) {
      managed.info.activity = activity;
      this.workforce?.set(managed.info);
      return;
    }

    const newStationType = ACTIVITY_STATION_MAP[activity];
    const oldStationType = ACTIVITY_STATION_MAP[managed.info.activity];

    // Stay put if the station type is unchanged, or if both activities happen at the home desk
    const bothAtHome = managed.homeKey !== null && managed.stationKey === managed.homeKey
      && HOME_TYPES.has(newStationType) && HOME_TYPES.has(oldStationType);
    if ((newStationType === oldStationType || bothAtHome) && managed.stationKey) {
      managed.info.activity = activity;
      managed.figure.setActivity(activity);
      return;
    }

    this.releaseAway(managed);

    managed.info.activity = activity;
    managed.figure.setActivity(activity);
    this.assignStation(managed, activity);
  }

  update(elapsed: number, delta: number): void {
    for (const managed of this.agents.values()) {
      managed.figure?.update(elapsed, delta);
    }
  }

  removeAgent(agentId: string): void {
    const managed = this.agents.get(agentId);
    if (!managed) return;
    if (!managed.figure) {
      this.workforce?.remove(agentId);
      this.agents.delete(agentId);
      return;
    }

    // Release current station and home desk
    this.releaseAway(managed);
    if (managed.homeKey) {
      const home = this.stations.get(managed.homeKey);
      if (home) home.occupied = false;
    }

    // Remove from scene
    this.scene.remove(managed.figure.group);
    managed.figure.dispose();

    this.agents.delete(agentId);
  }

  getAgents(): ManagedAgent[] {
    return Array.from(this.agents.values());
  }

  /** Free the current station unless it is the agent's (permanently reserved) home desk. */
  private releaseAway(managed: ManagedAgent): void {
    if (managed.stationKey && managed.stationKey !== managed.homeKey) {
      const station = this.stations.get(managed.stationKey);
      if (station) station.occupied = false;
    }
    managed.stationKey = null;
  }

  private assignStation(managed: ManagedAgent, activity: Activity, teleport = false): void {
    const stationType = ACTIVITY_STATION_MAP[activity];
    const figure = managed.figure!;

    const placeAt = (key: string, station: Station) => {
      station.occupied = true;
      managed.stationKey = key;
      figure.seated = key === managed.homeKey;
      if (teleport) {
        figure.teleportTo(station.position, station.lookAt);
      } else {
        figure.moveTo(station.position, station.lookAt);
      }
      figure.setActivity(activity);
    };

    const home = managed.homeKey ? this.stations.get(managed.homeKey) : undefined;

    // Home-desk activities (coding, reporting, break) happen at the agent's own desk
    if (home && HOME_TYPES.has(stationType)) {
      placeAt(managed.homeKey!, home);
      return;
    }

    // Find an unoccupied station of the right type
    for (const [key, station] of this.stations) {
      if (station.type === stationType && !station.occupied) {
        placeAt(key, station);
        return;
      }
    }

    // Agents with a home desk wait there when the away station is busy
    if (home) {
      placeAt(managed.homeKey!, home);
      return;
    }

    // Fallback: any unoccupied station
    for (const [key, station] of this.stations) {
      if (!station.occupied) {
        placeAt(key, station);
        return;
      }
    }
  }
}
