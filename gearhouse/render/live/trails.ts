// The speed effects (속도 효과, docs/systems/114): thin air streaks off the rear wing's tips (or the tail's top corners)
// and thin light trails off the tail lamps. Each anchor's place in the world is kept for the last fraction of a second
// and a ribbon drawn through those places, so a trail bends through a corner and drags sideways in a drift. They fade in
// from about 80 km/h and grow longer and stronger with the speed; the lamps' grow brighter and longer under braking and
// are faint by day. Pure: the drive keeps a CarTrails per car and hands the renderer the vertices (LiveRenderer.render's
// `trails`), drawn depth-tested over the composed picture and under the smoke.
import type { CarAnchors, Mesh, V } from '../car/mesh';

/** the setting (설정 > 그래픽 "속도 효과"): off, 약하게, 보통 */
export type SpeedFx = 'off' | 'weak' | 'mid';
/** each setting's strength */
export const SPEED_FX: Record<SpeedFx, number> = { off: 0, weak: 0.55, mid: 1 };
/** the tuning (thin and short by default; widths are half the ribbon's, at the car, in metres) */
export const TRAIL = {
  /** km/h: the effects start, and are full */ onKmh: 80, fullKmh: 150,
  /** s: how long a trail is (its points' oldest age) at the start, and at lifeKmh and above */ life0: 0.3, life1: 0.6, lifeKmh: 220,
  /** the air streaks: half width, opacity */ airW: 0.022, airA: 0.42,
  /** the lamp trails: half width, opacity by night (by day `lampDay` of it) */ lampW: 0.026, lampA: 0.7, lampDay: 0.35,
  /** under full braking: the lamps' strength times (1 + brakeA), their length times (1 + brakeL) */ brakeA: 1.6, brakeL: 0.45,
  /** how much the smoke round the car thins the streaks (the smoke drawn over them does the rest) */ smokeCut: 0.75,
  /** the points a trail keeps at most; the least time between two (s) */ maxPts: 48, minDt: 1 / 90,
} as const;

const clamp01 = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export interface TrailLook { /** strength 0..1 (0: not drawn) */ k: number; /** s */ life: number; /** half width at the car (m) */ w: number }
/** how the trails look this moment: by the speed (km/h), the brake (0..1), the setting's strength (SPEED_FX), the time
 *  of day (1 day .. 0 night) and the smoke about the car (0 none .. 1 dense) */
export function trailLook(kmh: number, brake: number, level: number, day = 1, smoke = 0): { air: TrailLook; lamp: TrailLook } {
  const s = smooth(TRAIL.onKmh, TRAIL.fullKmh, kmh) * clamp01(level), life = TRAIL.life0 + (TRAIL.life1 - TRAIL.life0) * smooth(TRAIL.onKmh, TRAIL.lifeKmh, kmh), b = clamp01(brake);
  const lampBase = TRAIL.lampA * (TRAIL.lampDay + (1 - TRAIL.lampDay) * (1 - clamp01(day)));
  return { air: { k: s * TRAIL.airA * (1 - TRAIL.smokeCut * clamp01(smoke)), life, w: TRAIL.airW * (0.8 + 0.4 * s) },
    lamp: { k: Math.min(1, s * lampBase * (1 + TRAIL.brakeA * b)), life: life * (1 + TRAIL.brakeL * b), w: TRAIL.lampW * (1 + 0.3 * b) } }; }

/** one anchor's recent places (world, m) and when it was there (s) */
export class Trail { readonly p: number[] = []; readonly t: number[] = [];
  get n() { return this.t.length; }
  /** the anchor's place now; older than `keep` seconds dropped (a jump of more than 15 m, the car put back: begun again) */
  push(time: number, x: number, y: number, z: number, keep: number) { const n = this.n;
    if (n && Math.hypot(x - this.p[n * 3 - 3]!, y - this.p[n * 3 - 2]!, z - this.p[n * 3 - 1]!) > 15) this.clear();
    if (this.n && time - this.t[this.n - 1]! < TRAIL.minDt) { const k = (this.n - 1) * 3; this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z; }   /* too soon: the newest moved to now */
    else { this.p.push(x, y, z); this.t.push(time); }
    let drop = 0; while (drop < this.n - 1 && (time - this.t[drop]! > keep || this.n - drop > TRAIL.maxPts)) drop++;
    if (drop) { this.t.splice(0, drop); this.p.splice(0, drop * 3); } }
  clear() { this.p.length = 0; this.t.length = 0; }
  /** the age (s) the trail reaches back to */
  span(time: number) { return this.n ? time - this.t[0]! : 0; } }

/** floats a ribbon's vertex has: place (3), the trail's way there (3), signed half width (m), opacity, kind (0 air, 1 lamp) */
export const RIBBON_FLOATS = 9;
/** a trail's ribbon as triangles (two a segment) into `out`: the points younger than `look.life`, wide and strong at the
 *  car, narrowing and fading to nothing at the far end. How many vertices it added */
export function ribbon(tr: Trail, time: number, look: TrailLook, kind: number, out: number[]): number { if (look.k <= 0.002 || tr.n < 2) return 0;
  const P = tr.p, T = tr.t, n = tr.n; let first = 0; while (first < n - 1 && time - T[first]! > look.life) first++;
  if (n - first < 2) return 0;
  const vert = (i: number, side: number) => { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); let tx = P[b * 3]! - P[a * 3]!, ty = P[b * 3 + 1]! - P[a * 3 + 1]!, tz = P[b * 3 + 2]! - P[a * 3 + 2]!; const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
    const u = clamp01((time - T[i]!) / look.life), w = look.w * (1 - 0.8 * u), al = look.k * Math.pow(1 - u, 1.6);
    out.push(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!, tx, ty, tz, side * w, al, kind); };
  let added = 0;
  for (let i = first; i < n - 1; i++) { const j = i + 1; if (Math.hypot(P[j * 3]! - P[i * 3]!, P[j * 3 + 1]! - P[i * 3 + 1]!, P[j * 3 + 2]! - P[i * 3 + 2]!) < 1e-3) continue;
    vert(i, -1); vert(i, 1); vert(j, 1); vert(i, -1); vert(j, 1); vert(j, -1); added += 6; }
  return added; }

/** a car's anchors from its mesh: its own (a hand-made body's) or, for a kit car, found from its bounds: the tips at the
 *  outer top corners of the tail (a spoiler's top where there is one), the lamps from the tail lamps found on the mesh
 *  (`tailLamps`: the renderer's lamps flagged 2) or else low on the tail's corners */
export function anchorsOf(M: Mesh, tailLamps: readonly V[] = []): CarAnchors { if (M.anchors) return M.anchors;
  const L = M.length; let xr = 0; for (let v = 0; v < M.n * 3; v++) xr = Math.max(xr, M.pos[v * 3]!);
  const slice = xr - Math.max(250, L * 0.12); let hw = 1, zTop = 0, zLow = 1e9;
  for (let v = 0; v < M.n * 3; v++) { const x = M.pos[v * 3]!; if (x < slice) continue; hw = Math.max(hw, Math.abs(M.pos[v * 3 + 1]!)); }
  for (let v = 0; v < M.n * 3; v++) { const x = M.pos[v * 3]!, y = Math.abs(M.pos[v * 3 + 1]!), z = M.pos[v * 3 + 2]!; if (x < slice || y < hw * 0.7) continue; zTop = Math.max(zTop, z); zLow = Math.min(zLow, z); }
  if (zLow > zTop) zLow = 0; const tipY = hw * 0.9, tipZ = zTop - 20, tipX = xr - 60;
  const l = tailLamps.filter(p => p[1] > 0).sort((a, b) => b[1] - a[1])[0], r = tailLamps.filter(p => p[1] < 0).sort((a, b) => a[1] - b[1])[0];
  const lampZ = zLow + (zTop - zLow) * 0.55, lamp = (p: V | undefined, s: number): V => p ? [p[0] + 15, p[1], p[2]] : [xr + 5, s * hw * 0.72, lampZ];
  return { tips: [[tipX, tipY, tipZ], [tipX, -tipY, tipZ]], lamps: [lamp(l, 1), lamp(r, -1)] }; }

/** where a body's point (mesh axes, mm) is in the world: the car placed as the renderer places it (render/live/gpu.ts
 *  placeMesh: the middle on (x, y, z), the nose toward the yaw, the files' +y to the left), rolled and pitched about its middle */
export function toWorld(p: V, len: number, x: number, y: number, z: number, yaw: number, roll: number, pitch: number): V {
  // about the middle: pitch (about y) first, then roll (about x), as the renderer's body matrix
  const m = len / 2, px = p[0] - m, py = p[1], pz = p[2], cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const ax = cp * px + sp * pz, ay = py, az = -sp * px + cp * pz;
  const bx = ax + m, by = cr * ay - sr * az, bz = sr * ay + cr * az, c = Math.cos(yaw), s = Math.sin(yaw);
  return [x + c * len / 2000 + (-c * bx - s * by) / 1000, y + s * len / 2000 + (-s * bx + c * by) / 1000, z + bz / 1000]; }

/** what the trails need of a car each frame */
export interface TrailCar { len: number; x: number; y: number; z: number; yaw: number; roll: number; pitch: number; kmh: number; brake: number; smoke?: number }
/** a car's four trails: the two tips, the two lamps (left first) */
export class CarTrails { readonly tr = [new Trail(), new Trail(), new Trail(), new Trail()];
  constructor(readonly a: CarAnchors) {}
  /** the anchors' places now recorded, and the ribbons drawn into `out` (vertices added) */
  step(time: number, c: TrailCar, level: number, day: number, out: number[]): number { const L = trailLook(c.kmh, c.brake, level, day, c.smoke ?? 0), keep = Math.max(L.air.life, L.lamp.life) + 0.05;
    const pts = [...this.a.tips, ...this.a.lamps]; let n = 0;
    pts.forEach((p, i) => { const w = toWorld(p, c.len, c.x, c.y, c.z, c.yaw, c.roll, c.pitch), tr = this.tr[i]!; tr.push(time, w[0], w[1], w[2], keep);
      n += ribbon(tr, time, i < 2 ? L.air : L.lamp, i < 2 ? 0 : 1, out); });
    return n; } }
