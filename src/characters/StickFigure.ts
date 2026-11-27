import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildSkeleton, Joints } from './StickFigureParts.js';
import { createLabel, updateLabel } from './Label.js';
import { dressInSuit } from './SuitFigure.js';
import { themeName } from '../utils/Theme.js';
import { Activity, animateActivity, animateWalking, getRestPose } from '../agents/ActivityAnimations.js';
import { ACTIVITY_LABELS } from '../agents/AgentData.js';

const TRANSITION_DURATION = 0.5;
const WALK_SPEED = 4.5;

export class StickFigure {
  joints: Joints;
  label: CSS2DObject;
  name: string;
  activity: Activity = 'idle';
  private targetActivity: Activity = 'idle';
  private transitionProgress = 1;
  private previousPose: Map<THREE.Object3D, THREE.Euler> = new Map();
  private targetPosition = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();
  private isMoving = false;
  /** Set when at a desk: standing activities (idle, meeting) are done seated instead. */
  seated = false;
  /** Rest pose: undefined = original idle, null = arms down, 0..1 = holding a cup (1 = sip). */
  hold: number | null | undefined = themeName === 'command-center' ? null : undefined;
  private cup: THREE.Group | null = null;

  constructor(name: string, accentColor: THREE.Color, variant = 0) {
    this.name = name;
    this.joints = buildSkeleton(accentColor);
    if (themeName === 'command-center') dressInSuit(this.joints, variant);
    this.label = createLabel(name, ACTIVITY_LABELS.idle);
    this.joints.root.add(this.label);

    // Apply rest pose
    this.applyPose(getRestPose(this.joints));
  }

  get group(): THREE.Group {
    return this.joints.root;
  }

  setActivity(activity: Activity): void {
    if (activity === this.activity && this.transitionProgress >= 1) return;

    // Save current pose for blending
    this.previousPose.clear();
    this.saveCurrentPose(this.joints.root);

    this.targetActivity = activity;
    this.transitionProgress = 0;
    updateLabel(this.label, this.name, ACTIVITY_LABELS[activity]);
  }

  moveTo(position: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.targetPosition.copy(position);
    this.targetLookAt.copy(lookAt);
    this.isMoving = true;
  }

  get moving(): boolean {
    return this.isMoving;
  }

  /** Put a cup (water or coffee) in the right hand. */
  takeCup(kind: 'water' | 'coffee'): void {
    this.dropCup()?.removeFromParent();
    this.cup = createCup(kind);
    this.cup.position.set(0, -0.32, 0.04);
    this.joints.rightForearm.add(this.cup);
    this.hold = 0;
  }

  /** Take the cup out of the hand; returns it (caller decides where it goes). */
  dropCup(): THREE.Group | null {
    const cup = this.cup;
    this.cup = null;
    if (cup) cup.removeFromParent();
    if (this.hold !== undefined) this.hold = null;
    return cup;
  }

  teleportTo(position: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.joints.root.position.copy(position);
    this.targetPosition.copy(position);
    this.isMoving = false;

    // Face look-at direction immediately
    const lookDir = new THREE.Vector3().subVectors(lookAt, position);
    lookDir.y = 0;
    if (lookDir.length() > 0.01) {
      this.joints.root.rotation.y = Math.atan2(lookDir.x, lookDir.z);
    }
  }

  update(elapsed: number, delta: number): void {
    // Handle movement
    if (this.isMoving) {
      const currentPos = this.joints.root.position;
      const moveDir = new THREE.Vector3().subVectors(this.targetPosition, currentPos);
      const dist = moveDir.length();

      if (dist < 0.05) {
        currentPos.copy(this.targetPosition);
        this.isMoving = false;
        // Snap to face the station's lookAt direction on arrival
        const lookDir = new THREE.Vector3().subVectors(this.targetLookAt, currentPos);
        lookDir.y = 0;
        if (lookDir.length() > 0.01) {
          this.joints.root.rotation.y = Math.atan2(lookDir.x, lookDir.z);
        }
      } else {
        const speed = Math.min(WALK_SPEED * delta, dist);
        currentPos.add(moveDir.normalize().multiplyScalar(speed));

        // Face movement direction while walking
        const faceDir = moveDir.clone();
        faceDir.y = 0;
        if (faceDir.length() > 0.01) {
          const angle = Math.atan2(faceDir.x, faceDir.z);
          const currentAngle = this.joints.root.rotation.y;
          let angleDiff = angle - currentAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          this.joints.root.rotation.y += angleDiff * Math.min(5 * delta, 1);
        }
      }

      // Walking animation overrides activity animation (a held cup is carried in front)
      animateWalking(this.joints, elapsed, delta);
      if (this.cup) {
        this.joints.rightUpperArm.rotation.x = -0.6;
        this.joints.rightForearm.rotation.x = -1.1;
        this.keepCupUpright();
      }
      return;
    }

    // Handle transition
    if (this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + delta / TRANSITION_DURATION);

      if (this.transitionProgress >= 1) {
        this.activity = this.targetActivity;
      }
    }

    // Animate activity
    animateActivity(this.joints, this.activity, elapsed, delta, this.seated, this.hold);
    this.keepCupUpright();
  }

  /** Cancel the arm rotation so the cup stays upright (tilted a little while sipping). */
  private keepCupUpright(): void {
    if (!this.cup) return;
    const j = this.joints;
    this.cup.rotation.x = -(j.rightUpperArm.rotation.x + j.rightForearm.rotation.x) + (this.hold ?? 0) * 0.5;
  }

  private saveCurrentPose(obj: THREE.Object3D): void {
    this.previousPose.set(obj, obj.rotation.clone());
    for (const child of obj.children) {
      this.saveCurrentPose(child);
    }
  }

  dispose(): void {
    // Remove label DOM element
    if (this.label.element && this.label.element.parentNode) {
      this.label.element.parentNode.removeChild(this.label.element);
    }
    // Traverse and dispose geometries/materials
    this.joints.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
  }

  private applyPose(pose: Map<THREE.Object3D, THREE.Euler>): void {
    for (const [obj, euler] of pose) {
      obj.rotation.copy(euler);
    }
  }
}

/** Small cup: clear glass of water, or a white mug of coffee. Origin at the bottom centre. */
export function createCup(kind: 'water' | 'coffee'): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'water') {
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.03, 0.1, 14, 1, true),
      new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    glass.position.y = 0.05;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.031, 0.029, 0.07, 14),
      new THREE.MeshPhongMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.6 }),
    );
    water.position.y = 0.037;
    g.add(glass, water);
  } else {
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.09, 14), new THREE.MeshToonMaterial({ color: 0xf2f2f2 }));
    mug.position.y = 0.045;
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.033, 14), new THREE.MeshToonMaterial({ color: 0x3b1d0c }));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.088;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 6, 10), new THREE.MeshToonMaterial({ color: 0xf2f2f2 }));
    handle.position.set(0.045, 0.045, 0);
    g.add(mug, coffee, handle);
  }
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return g;
}
