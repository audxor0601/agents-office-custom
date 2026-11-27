import * as THREE from 'three';

// Taegukgi drawn on canvas to the official proportions (국기법 시행령 기준).
// Everything is expressed in units of the flag height H:
//   width = 1.5H (3:2) · taegeuk diameter = H/2 · trigram bar length = H/4,
//   bar thickness = H/24, gap between bars and in broken bars = H/48,
//   circle-to-trigram gap = H/8 → trigram center at H/4 + H/8 + H/12 = 11H/24 from the flag center,
//   on the flag diagonals, bars perpendicular to the diagonal (i.e. turned toward the circle).
const RED = '#CD2E3A';
const BLUE = '#0047A0';
const BLACK = '#000000';

export function drawTaegukgi(ctx: CanvasRenderingContext2D, H: number): void {
  const W = H * 1.5;
  const R = H / 4;
  const theta = Math.atan2(2, 3); // diagonal top-left → bottom-right, in canvas coords (y down)

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const circle = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // --- Taegeuk. Rotated frame: +x = toward bottom-right corner, y < 0 = the upper (red) side.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(theta);
  circle(0, 0, R, BLUE);
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(0, 0, R, Math.PI, Math.PI * 2); // upper half
  ctx.fill();
  circle(-R / 2, 0, R / 2, RED);  // red swells down on the upper-left half of the diagonal
  circle(R / 2, 0, R / 2, BLUE);  // blue swells up on the lower-right half
  ctx.restore();

  // --- Trigrams. pattern: true = solid bar, listed from the circle outward.
  const L = H / 4, w = H / 24, g = H / 48, D = (11 * H) / 24;
  const drawTrigram = (angle: number, dist: number, pattern: boolean[]) => {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(angle);
    ctx.fillStyle = BLACK;
    const dir = Math.sign(dist);
    pattern.forEach((solid, k) => {
      // k = 0 is closest to the circle; bars stack outward along the diagonal
      const xc = dist + dir * (k - 1) * (w + g);
      if (solid) {
        ctx.fillRect(xc - w / 2, -L / 2, w, L);
      } else {
        const half = (L - g) / 2;
        ctx.fillRect(xc - w / 2, -L / 2, w, half);
        ctx.fillRect(xc - w / 2, g / 2, w, half);
      }
    });
    ctx.restore();
  };

  // Main diagonal (rotate +θ): -x = top-left, +x = bottom-right
  drawTrigram(theta, -D, [true, true, true]);     // 건 ☰ top-left
  drawTrigram(theta, D, [false, false, false]);   // 곤 ☷ bottom-right
  // Other diagonal (rotate -θ): +x = top-right, -x = bottom-left
  drawTrigram(-theta, D, [false, true, false]);   // 감 ☵ top-right
  drawTrigram(-theta, -D, [true, false, true]);   // 리 ☲ bottom-left
}

/**
 * Flag mesh hung on the wall at z = wallZ facing -z (into the room), plus a soft spotlight.
 * height is in world units; width = 1.5 × height.
 */
export function createTaegukgi(height: number, centerY: number, wallZ: number): THREE.Group {
  const H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = H * 1.5;
  canvas.height = H;
  drawTaegukgi(canvas.getContext('2d')!, H);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const group = new THREE.Group();

  // Lambert so the spotlight shades it; a faint self-glow keeps it readable in the dark room
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(height * 1.5, height),
    new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.35 })
  );
  flag.position.set(0, centerY, wallZ);
  flag.rotation.y = Math.PI; // face into the room (-z)
  group.add(flag);

  const light = new THREE.SpotLight(0xfff4e0, 4, 8, Math.PI / 5, 0.6, 1);
  light.position.set(0, 5.7, wallZ - 2.6);
  light.target.position.set(0, centerY, wallZ);
  group.add(light, light.target);

  return group;
}
