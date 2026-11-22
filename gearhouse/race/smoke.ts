// Smoke as parcels of gas (review 107, brief 75 §2): each parcel carries its temperature above the air and its density.
// Hot gas rises (buoyancy by its temperature) and cools toward the air, quickly at first then slowly; it is dragged
// toward the wind; curl noise stirs it at two scales (a large slow swirl and a finer break-up: curl noise has no
// divergence, so it swirls without bunching the parcels); its density fades (dissipation) and it spreads as it ages.
// Dust is cold and heavy and settles; tyre smoke starts hot and fast; steam hot and white. World axes, metres, seconds.
export type SmokeKind = 'tyre' | 'dust' | 'steam' | 'exhaust';
export interface Parcel { x: number; y: number; z: number; vx: number; vy: number; vz: number; T: number; rho: number; r: number; age: number; kind: SmokeKind; seed: number; floor: number }
const KIND: Record<SmokeKind, { T: number; rho: number; r: number; grow: number; cool: number; fade: number; heavy: number; life: number }> = {
  tyre: { T: 160, rho: 0.75, r: 0.35, grow: 0.9, cool: 1.6, fade: 0.45, heavy: 0, life: 6 },
  dust: { T: 5, rho: 0.6, r: 0.4, grow: 0.7, cool: 0.8, fade: 0.55, heavy: 0.9, life: 5 },
  steam: { T: 90, rho: 0.7, r: 0.2, grow: 0.8, cool: 1.0, fade: 0.8, heavy: 0, life: 4 },
  exhaust: { T: 220, rho: 0.35, r: 0.12, grow: 0.6, cool: 2.5, fade: 0.9, heavy: 0, life: 3 } };

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
  readonly parcels: Parcel[] = []; wind: [number, number] = [1.2, 0.5]; time = 0; max = 700; private n = 0;
  /** a parcel of `kind` at (x, y, z) over the ground at `floor`, moving at (vx, vy, vz), `amount` 0..1 its share of a full one */
  emit(kind: SmokeKind, x: number, y: number, z: number, vx: number, vy: number, vz: number, amount = 1, floor = 0): void { const K = KIND[kind];
    if (this.parcels.length >= this.max) this.parcels.shift();
    this.parcels.push({ x, y, z, vx, vy, vz, T: K.T * (0.7 + 0.3 * amount), rho: K.rho * Math.min(1, amount), r: K.r * (0.8 + 0.4 * Math.random()), age: 0, kind, seed: (this.n++ * 0.6180339) % 1, floor }); }
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
      p.T -= p.T * K.cool * (0.4 + p.T / 200) * dt; p.rho *= Math.exp(-K.fade * dt * (1 + p.age * 0.15)); p.r += K.grow * dt / (1 + p.age * 0.5); p.age += dt;
      if (p.rho < 0.015 || p.age > K.life) this.parcels.splice(i, 1); } }
}
