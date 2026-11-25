// Smoke as parcels of gas (review 107, brief 75 §2): each parcel carries its temperature above the air and its density.
// Hot gas rises (buoyancy by its temperature) and cools toward the air, quickly at first then slowly; it is dragged
// toward the wind; curl noise stirs it at two scales (a large slow swirl and a finer break-up: curl noise has no
// divergence, so it swirls without bunching the parcels); its density fades (dissipation) and it spreads as it ages.
// Dust is cold and heavy and settles; tyre smoke starts hot and fast; steam hot and white. World axes, metres, seconds.
// The sizes are a cartoon's (docs/systems/103): a drift's tyre smoke a puff over a metre across at once, growing to
// clouds of several metres that hang for ten seconds and more; dust as big but settling; steam and exhaust smaller.
// The cars bore through it (V4 for the parcels): a parcel a car drives into is shoved out of its box, sideways and up,
// with the car's speed, and shrinks, so a gap opens where it went; the gap fills only as the parcels grow and drift.
export type SmokeKind = 'tyre' | 'dust' | 'steam' | 'exhaust';
export interface Parcel { x: number; y: number; z: number; vx: number; vy: number; vz: number; T: number; rho: number; r: number; age: number; kind: SmokeKind; seed: number; floor: number }
const KIND: Record<SmokeKind, { T: number; rho: number; r: number; grow: number; cool: number; fade: number; heavy: number; life: number }> = {
  tyre: { T: 160, rho: 0.75, r: 1.2, grow: 1.4, cool: 1.6, fade: 0.11, heavy: 0, life: 22 },
  dust: { T: 5, rho: 0.6, r: 1.0, grow: 1.1, cool: 0.8, fade: 0.16, heavy: 0.9, life: 16 },
  steam: { T: 90, rho: 0.7, r: 0.3, grow: 1.0, cool: 1.0, fade: 0.5, heavy: 0, life: 7 },
  exhaust: { T: 220, rho: 0.35, r: 0.18, grow: 0.8, cool: 2.5, fade: 0.6, heavy: 0, life: 5 } };
/** a car as the smoke sees it: where (its ground), heading, velocity (world), size (m) */
export interface SmokeCar { x: number; y: number; z: number; yaw: number; vx: number; vy: number; len: number; width: number; height: number }

// ---- noise: smooth 3D value noise, and its curl (a field without divergence) ----
const hash = (x: number, y: number, z: number) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function vnoise(x: number, y: number, z: number): number { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), f = x - i, g = y - j, h = z - k, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g), w = h * h * (3 - 2 * h);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(l(l(hash(i, j, k), hash(i + 1, j, k), u), l(hash(i, j + 1, k), hash(i + 1, j + 1, k), u), v), l(l(hash(i, j, k + 1), hash(i + 1, j, k + 1), u), l(hash(i, j + 1, k + 1), hash(i + 1, j + 1, k + 1), u), v), w) * 2 - 1; }
/** the curl of a noise potential (three offset noises) at p: a swirl field without divergence */
export function curl(x: number, y: number, z: number): [number, number, number] { const e = 0.1, P = (a: number, b: number, c: number, o: number) => vnoise(a + o, b - o * 0.7, c + o * 1.3);
  const dPz_dy = (P(x, y + e, z, 31) - P(x, y - e, z, 31)) / (2 * e), dPy_dz = (P(x, y, z + e, 17) - P(x, y, z - e, 17)) / (2 * e);
  const dPx_dz = (P(x, y, z + e, 0) - P(x, y, z - e, 0)) / (2 * e), dPz_dx = (P(x + e, y, z, 31) - P(x - e, y, z, 31)) / (2 * e);
  const dPy_dx = (P(x + e, y, z, 17) - P(x - e, y, z, 17)) / (2 * e), dPx_dy = (P(x, y + e, z, 0) - P(x, y - e, z, 0)) / (2 * e);
  return [dPz_dy - dPy_dz, dPx_dz - dPz_dx, dPy_dx - dPx_dy]; }

export class Smoke {
  readonly parcels: Parcel[] = []; wind: [number, number] = [1.2, 0.5]; time = 0; max = 900; private n = 0;
  /** 연기 크기: the puffs' size against the full (크게) one */ size = 1;
  /** the cars this step, boring through the parcels */ cars: readonly SmokeCar[] = [];
  /** where a puff may go instead (the volumetric smoke's grid, docs/systems/104 B): true when it took it (no parcel made) */
  tap: ((kind: SmokeKind, x: number, y: number, z: number, vx: number, vy: number, vz: number, amount: number) => boolean) | null = null;
  /** a parcel of `kind` at (x, y, z) over the ground at `floor`, moving at (vx, vy, vz), `amount` 0..1 its share of a full one */
  emit(kind: SmokeKind, x: number, y: number, z: number, vx: number, vy: number, vz: number, amount = 1, floor = 0): void { if (this.tap?.(kind, x, y, z, vx, vy, vz, amount)) return; const K = KIND[kind];
    if (this.parcels.length >= this.max) this.parcels.shift();
    this.parcels.push({ x, y, z, vx, vy, vz, T: K.T * (0.7 + 0.3 * amount), rho: K.rho * Math.min(1, amount), r: K.r * this.size * (0.8 + 0.4 * Math.random()), age: 0, kind, seed: (this.n++ * 0.6180339) % 1, floor }); }
  step(dt: number): void { this.time += dt; const t = this.time;
    for (let i = this.parcels.length - 1; i >= 0; i--) { const p = this.parcels[i]!, K = KIND[p.kind];
      // buoyancy from the heat, gravity for dust; drag toward the wind (the air's own motion)
      const lift = 0.018 * p.T - 9.81 * K.heavy * 0.12, drag = 1.6 / (1 + p.r);
      p.vx += (this.wind[0] - p.vx) * drag * dt; p.vy += (this.wind[1] - p.vy) * drag * dt; p.vz += (lift - p.vz * drag * 0.6) * dt;
      // turbulence: a large slow swirl and a finer, quicker break-up, stronger as the parcel slows and spreads
      const c1 = curl(p.x * 0.35, p.y * 0.35, p.z * 0.35 + t * 0.15), c2 = curl(p.x * 1.6 + 40, p.y * 1.6, p.z * 1.6 - t * 0.6), a1 = 1.1, a2 = 0.5 * Math.min(1, p.age * 0.8);
      p.vx += (c1[0] * a1 + c2[0] * a2) * dt * 3; p.vy += (c1[1] * a1 + c2[1] * a2) * dt * 3; p.vz += (c1[2] * a1 + c2[2] * a2) * dt * 1.5;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.z < p.floor + p.r * 0.5) { p.z = p.floor + p.r * 0.5; if (p.vz < 0) p.vz *= -0.2; }
      // cooling toward the air (fast while hot), dissipation, spreading
      p.T -= p.T * K.cool * (0.4 + p.T / 200) * dt; p.rho *= Math.exp(-K.fade * dt * (1 + p.age * 0.15)); p.r += K.grow * this.size * dt / (1 + p.age * 0.8); p.age += dt;
      if (p.age > 0.4) for (const c of this.cars) bore(p, c, dt);   // not a puff just made (a drifting car's own smoke starts at its wheels)
      if (p.rho < 0.015 || p.age > K.life) this.parcels.splice(i, 1); } }
}
/** a parcel in a car's box (padded by part of its size) shoved out of the nearer side or the roof, given the car's
 *  speed outward and a little lift, and shrunk: the hole a car bores through a cloud */
export function bore(p: Parcel, c: SmokeCar, dt: number): void { const sp = Math.hypot(c.vx, c.vy); if (sp < 2) return;
  const pad = p.r * 0.6, hx = c.len / 2 + pad, hy = c.width / 2 + pad, top = c.z + c.height + pad, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), dx = p.x - c.x, dy = p.y - c.y;
  const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs; if (Math.abs(lx) > hx || Math.abs(ly) > hy || p.z > top || p.z < c.z - pad) return;
  const side = ly !== 0 ? Math.sign(ly) : p.seed < 0.5 ? -1 : 1, outY = hy - Math.abs(ly), outZ = top - p.z;
  if (outZ < outY * 0.6) { p.z = top; p.vz = Math.max(p.vz, sp * 0.25); }   // nearer the roof: over it
  else { const ny = side * hy; p.x = c.x + lx * cs - ny * sn; p.y = c.y + lx * sn + ny * cs; p.vx += -sn * side * sp * 0.35; p.vy += cs * side * sp * 0.35; p.vz += sp * 0.12; }
  p.vx += c.vx * 0.25; p.vy += c.vy * 0.25; p.r *= 0.75; }
