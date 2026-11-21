// The customer on foot at the front (version one, step 3; review 57). Out of the car once it is parked, round its
// nose onto the pavement, along it to the path and up to the door, where he knocks; let in, he goes through the door;
// sent away (or the job agreed) he comes back out and down the path, to his car or off along the pavement on foot.
// The planner's walking sheet (tools/people/walker.py): four ways, four steps each, scaled by how far up the ground he
// stands (the road 37 px a metre, the door step 32), lit by the hour, with a soft shadow under his shoes.
import { pixels } from './pics';
import meta from '../../data/people/walk.json';
import imgWalk from '../../assets/people/walk.png';

const W = 480, H = 270, M = meta as unknown as { h: number; strip: [number, number]; frames: Record<string, [number, number, number, number]> };
type P = [number, number];
/** the way from the car's door to the front door: in front of the car, round its nose, the pavement, the path */
export const TO_DOOR: P[] = [[236, 247], [192, 247], [190, 211], [171, 209], [171, 169]];
/** after the job is agreed: down the path and off along the pavement to the left, on foot */
export const AWAY: P[] = [[171, 169], [171, 209], [-20, 211]];
const pxPerM = (y: number) => 32 + Math.max(0, Math.min(1, (y - 169) / 75)) * 5, TALL = 1.8;

export type CallerState = 'walk' | 'knock' | 'gone';
export interface Caller { path: P[]; s: number; state: CallerState; t: number; face: string; knocks: number }
const len = (p: P[]) => p.slice(1).reduce((a, q, k) => a + Math.hypot(q[0] - p[k]![0], q[1] - p[k]![1]), 0);
/** where along a path, and which way he faces */
function at(p: P[], s: number): { x: number; y: number; face: string } { let left = s;
  for (let k = 1; k < p.length; k++) { const a = p[k - 1]!, b = p[k]!, d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (left <= d || k === p.length - 1) { const u = Math.min(1, left / Math.max(1e-6, d)), dx = b[0] - a[0], dy = b[1] - a[1];
      return { x: a[0] + dx * u, y: a[1] + dy * u, face: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down' }; } left -= d; }
  const e = p[p.length - 1]!; return { x: e[0], y: e[1], face: 'up' }; }

export const newCaller = (path: P[]): Caller => ({ path, s: 0, state: 'walk', t: 0, face: 'left', knocks: 0 });
/** a step of time: returns 'arrived' the moment he reaches the end of his path, 'step' on each footfall */
export function stepCaller(c: Caller, dt: number): 'arrived' | 'step' | null { c.t += dt; if (c.state !== 'walk') return null;
  const end = len(c.path), y = at(c.path, c.s).y, v = 1.25 * pxPerM(y), was = Math.floor(c.s / (0.36 * pxPerM(y))); c.s = Math.min(end, c.s + v * dt);
  if (c.s >= end) { c.state = 'knock'; c.t = 0; return 'arrived'; } return Math.floor(c.s / (0.36 * pxPerM(y))) !== was ? 'step' : null; }

/** draw him into the screen; `light` 0..1 the hour's light on him, `warm` the hall's lamp behind an open door */
export function drawCaller(out: Uint8ClampedArray, c: Caller, light: number, hide?: (x: number, y: number) => boolean) {
  const strip = pixels(imgWalk, M.strip[0], M.strip[1]); if (!strip || c.state === 'gone') return;
  const p = at(c.path, c.s), face = c.state === 'walk' ? p.face : 'up', step = c.state === 'walk' ? Math.floor(c.s / (0.36 * pxPerM(p.y))) % 4 : 0;
  const f = M.frames[face + step] ?? M.frames.up0!, [fx, fy, fw, fh] = f, sc = TALL * pxPerM(p.y) / M.h, w = Math.round(fw * sc), h = Math.round(fh * sc);
  const ox = Math.round(p.x - w / 2), oy = Math.round(p.y - h), k = 0.22 + 0.78 * light;
  // his shadow on the ground
  const rx = w * 0.42, ry = 1.6 + sc; for (let y = Math.floor(p.y - ry); y <= p.y + ry; y++) for (let x = Math.floor(p.x - rx); x <= p.x + rx; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const q = ((x - p.x) / rx) ** 2 + ((y - p.y) / ry) ** 2; if (q >= 1) continue; const i = (y * W + x) * 4, m = 1 - (0.15 + 0.3 * light) * (1 - q); out[i] = out[i]! * m; out[i + 1] = out[i + 1]! * m; out[i + 2] = out[i + 2]! * m; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = ((fy + Math.min(fh - 1, Math.floor(y / sc))) * M.strip[0] + fx + Math.min(fw - 1, Math.floor(x / sc))) * 4; if (strip[j + 3]! < 128) continue;
    const X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= W || Y >= H || hide?.(X, Y)) continue; const i = (Y * W + X) * 4; out[i] = strip[j]! * k; out[i + 1] = strip[j + 1]! * k; out[i + 2] = Math.min(255, strip[j + 2]! * k * (1.06 - 0.06 * light)); } }
