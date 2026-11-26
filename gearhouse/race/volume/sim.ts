// The volumetric smoke's reference (docs/systems/104 part B, step V1): a box of air in cells, the smoke in it a fluid.
// The same passes, in the same order and with the same sums, as the GPU's (render/live/volume/simgpu.ts), on a small
// grid: for the tests, for comparing the GPU's numbers with (step V2), and as the rules written down once.
//
// The grid: nx x ny x nz cells of h metres, world axes (z up), its corner at `origin`. Each cell holds the smoke's
// density (tyre smoke, steam and exhaust together), the dust's (it settles), the heat above the air, and the pressure.
// The air's velocity is on the cells' faces (a staggered "MAC" grid: u on the -x face of each cell, v on its -y face,
// w on its -z face), so the divergence, the pressure's solve and the projection are one consistent discretisation:
// the projection takes out exactly what the solve found, and the pressure's Jacobi sweeps converge to no divergence.
//
// One step (B-2): the puffs put in; the solid cells found (the ground's height and the fences from a height map, the
// cars as boxes that move); what a car now stands in pushed out to the cells beside it (the hole it bores); everything
// carried along the flow (semi-Lagrangian, a midpoint trace back); the forces (buoyancy from the heat less the gas's
// weight, the drag toward the wind, vorticity confinement where there is smoke); the faces at a solid set to its
// velocity; the divergence, the pressure (Jacobi, warm-started from the last step's) and the projection; then the
// smoke's fading, the heat cooling, a spreading that fills holes from where the smoke is thick (a diffusion whose
// strength grows with the density, so a thin edge stays crisp), and a fade near the open sides.
//
// The cut (docs/systems/103, step V4): a car's hole in the smoke is kept a while, as cartoons draw it ("숭 뚫리는"). A
// fourth field, C, is 1 where a solid stood and is carried along the flow like the smoke, fading over a few seconds;
// where it is high the spreading is mostly held back (the tunnel's walls stay crisp) and what the flow smears back in is
// thinned again, so the car-shaped hole stays clear for 2-3 s and then fills slowly. Its slope pushes the air out of the
// tunnel (the smoke shoved aside) and the vorticity confinement is stronger in it (a swirl in the wake). Fresh smoke put
// in fills the cut (a drifting car's own smoke is not eaten by its own tunnel). It is a wake: the hold (and the drawing's
// clearing, draw.ts) starts only once the cut has faded below 0.9 (about 0.4 s after the car), so the smoke the car is
// in, pushed round its body, still covers it; the tunnel opens behind it.
export interface VolParams {
  nx: number; ny: number; nz: number; /** a cell's size, m */ h: number;
  /** the pressure's Jacobi sweeps */ iters: number;
  /** open sides and top (smoke leaves; the pressure 0 outside) or a closed box (the tests' conservation) */ open: boolean;
  /** buoyancy: m/s² per degree of heat; the smoke's and the dust's weight, m/s² per unit of density */ alpha: number; betaS: number; betaD: number;
  /** the wind (m/s, x and y) and how fast the air is dragged toward it (1/s) */ wind: [number, number]; drag: number;
  /** vorticity confinement's strength (1/s), only where there is smoke */ vort: number;
  /** the dust's fall through the air, m/s */ settle: number;
  /** the smoke's and the dust's fading, the heat's cooling (1/s) */ fade: number; cool: number;
  /** the spreading's strength, m²/s at unit density */ spread: number;
  /** the fade at the open sides: the cells it covers */ edge: number;
  /** the cut: how fast it fades (1/s); how hard the smoke is thinned in it (1/s); the push out of it (m/s² across a
   *  cell's step of the cut); the extra swirl in it (x the confinement) */ cutFade: number; cutHold: number; cutPush: number; cutSwirl: number;
}
export const VOL_DEFAULT: VolParams = { nx: 16, ny: 16, nz: 8, h: 0.25, iters: 16, open: true, alpha: 0.012, betaS: 0.35, betaD: 2.2, wind: [1.2, 0.5], drag: 1.0, vort: 4, settle: 0.35, fade: 0.05, cool: 0.9, spread: 0.3, edge: 2, cutFade: 0.25, cutHold: 5, cutPush: 10, cutSwirl: 0.3 };
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** how much of the hold works at a cut of c: none below 0.45, all of it at 0.85-0.9, none again over 0.97 (where the car
 *  still is or has only just been: the wake opens behind it) */
export const cutHoldAt = (c: number): number => sstep(0.45, 0.85, c) * (1 - sstep(0.9, 0.97, c));

/** a puff put into the grid: where (world, m), its size (m, a Gaussian's radius), how much smoke and dust (peak density),
 *  its heat (degrees above the air) and its velocity (m/s) */
export interface VolEmit { x: number; y: number; z: number; r: number; smoke: number; dust: number; T: number; vx: number; vy: number; vz: number }
/** a solid box that moves (a car's lower body or its cabin): its middle (world), half sizes, heading (about z), velocity */
export interface VolBox { x: number; y: number; z: number; hx: number; hy: number; hz: number; yaw: number; vx: number; vy: number; vz: number }

/** the puffs' kinds as the grid takes them: the smoke and dust shares, the heat, the size (from race/smoke.ts's kinds) */
export const VOL_KIND = { tyre: { smoke: 0.6, dust: 0, T: 160, r: 0.35 }, dust: { smoke: 0, dust: 0.6, T: 5, r: 0.45 }, steam: { smoke: 0.7, dust: 0, T: 90, r: 0.28 }, exhaust: { smoke: 0.4, dust: 0, T: 220, r: 0.2 } } as const;

export class VolumeSim {
  readonly P: VolParams; readonly n: number;
  /** the corner of cell (0,0,0), world metres */ origin: [number, number, number] = [0, 0, 0];
  /** the cut (1 where a solid has just been, fading) */ C: Float32Array;
  S: Float32Array; D: Float32Array; T: Float32Array; p: Float32Array; u: Float32Array; v: Float32Array; w: Float32Array;
  /** 1 where solid this step; the solid's velocity */ solid: Uint8Array; ou: Float32Array; ov: Float32Array; ow: Float32Array;
  /** the top of the solid ground and fences in each column (world z), nx x ny; -Infinity: none */ top: Float32Array;
  /** the last divergence (before the projection), for the tests */ div: Float32Array;
  constructor(p: Partial<VolParams> = {}) { this.P = { ...VOL_DEFAULT, ...p }; const { nx, ny, nz } = this.P; this.n = nx * ny * nz; const f = () => new Float32Array(this.n);
    this.S = f(); this.D = f(); this.T = f(); this.C = f(); this.p = f(); this.u = f(); this.v = f(); this.w = f(); this.solid = new Uint8Array(this.n); this.ou = f(); this.ov = f(); this.ow = f(); this.div = f();
    this.top = new Float32Array(nx * ny).fill(-Infinity); }
  idx(i: number, j: number, k: number): number { return i + this.P.nx * (j + this.P.ny * k); }
  /** the world point of grid coordinates (cells; a cell's middle at +0.5) */
  world(x: number, y: number, z: number): [number, number, number] { const h = this.P.h, o = this.origin; return [o[0] + x * h, o[1] + y * h, o[2] + z * h]; }

  // ---- sampling (grid coordinates; clamped to the box's edge) ----
  /** a field at a point, trilinear, the field's samples at (i, j, k) + `off` */
  sample(F: Float32Array, x: number, y: number, z: number, ox: number, oy: number, oz: number): number { const { nx, ny, nz } = this.P;
    const fx = Math.min(nx - 1, Math.max(0, x - ox)), fy = Math.min(ny - 1, Math.max(0, y - oy)), fz = Math.min(nz - 1, Math.max(0, z - oz));
    const i0 = Math.min(nx - 2, Math.floor(fx)), j0 = Math.min(ny - 2, Math.floor(fy)), k0 = Math.min(nz - 2, Math.floor(fz)), a = fx - i0, b = fy - j0, c = fz - k0;
    const q = i0 + nx * (j0 + ny * k0), sy = nx, sz = nx * ny;
    const x00 = F[q]! + (F[q + 1]! - F[q]!) * a, x10 = F[q + sy]! + (F[q + sy + 1]! - F[q + sy]!) * a, x01 = F[q + sz]! + (F[q + sz + 1]! - F[q + sz]!) * a, x11 = F[q + sy + sz]! + (F[q + sy + sz + 1]! - F[q + sy + sz]!) * a;
    const y0 = x00 + (x10 - x00) * b, y1 = x01 + (x11 - x01) * b; return y0 + (y1 - y0) * c; }
  /** the air's velocity at a point (m/s) from the three face fields */
  vel(x: number, y: number, z: number): [number, number, number] { return [this.sample(this.u, x, y, z, 0, 0.5, 0.5), this.sample(this.v, x, y, z, 0.5, 0, 0.5), this.sample(this.w, x, y, z, 0.5, 0.5, 0)]; }
  /** where the flow brought a point from, dt ago (a midpoint trace), the dust's fall added to w by `fall` */
  back(x: number, y: number, z: number, dt: number, fall = 0): [number, number, number] { const s = dt / this.P.h; const a = this.vel(x, y, z);
    const mx = x - a[0] * s * 0.5, my = y - a[1] * s * 0.5, mz = z - (a[2] - fall) * s * 0.5, b = this.vel(mx, my, mz); return [x - b[0] * s, y - b[1] * s, z - (b[2] - fall) * s]; }

  // ---- the passes ----
  /** the grid moved by whole cells (di, dj, dk): what stays in the box keeps its world place, the new cells empty */
  shift(di: number, dj: number, dk: number): void { if (!di && !dj && !dk) return; const { nx, ny, nz, h } = this.P;
    for (const F of [this.S, this.D, this.T, this.C, this.p, this.u, this.v, this.w]) { const c = F.slice();
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = i + di, b = j + dj, e = k + dk;
        F[this.idx(i, j, k)] = a >= 0 && a < nx && b >= 0 && b < ny && e >= 0 && e < nz ? c[this.idx(a, b, e)]! : 0; } }
    this.origin = [this.origin[0] + di * h, this.origin[1] + dj * h, this.origin[2] + dk * h]; }
  /** the puffs put in: density and heat added by a Gaussian of each one's size, the air there drawn toward its velocity */
  inject(E: readonly VolEmit[]): void { if (!E.length) return; const { nx, ny, nz, h } = this.P, o = this.origin;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k);
      for (const e of E) { const g = (x: number, y: number, z: number) => { const dx = (o[0] + x * h - e.x) / e.r, dy = (o[1] + y * h - e.y) / e.r, dz = (o[2] + z * h - e.z) / e.r, d2 = dx * dx + dy * dy + dz * dz; return d2 > 4 ? 0 : Math.exp(-d2); };
        const c = g(i + 0.5, j + 0.5, k + 0.5); if (c > 0) { this.S[q] = this.S[q]! + (e.smoke * c); this.D[q] = this.D[q]! + (e.dust * c); this.T[q] = this.T[q]! + ((e.T - this.T[q]!) * c); this.C[q] = this.C[q]! * Math.max(0, 1 - 2 * c); }
        const gu = g(i, j + 0.5, k + 0.5), gv = g(i + 0.5, j, k + 0.5), gw = g(i + 0.5, j + 0.5, k);
        this.u[q] = this.u[q]! + ((e.vx - this.u[q]!) * gu * 0.8); this.v[q] = this.v[q]! + ((e.vy - this.v[q]!) * gv * 0.8); this.w[q] = this.w[q]! + ((e.vz - this.w[q]!) * gw * 0.8); } } }
  /** the solid cells: below the height map's top in its column, or inside a box (and moving with it) */
  obstacles(B: readonly VolBox[]): void { const { nx, ny, nz, h } = this.P, o = this.origin;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k), x = o[0] + (i + 0.5) * h, y = o[1] + (j + 0.5) * h, z = o[2] + (k + 0.5) * h;
      let s = z < this.top[i + nx * j]! ? 1 : 0, vx = 0, vy = 0, vz = 0;
      for (const b of B) { const dx = x - b.x, dy = y - b.y, c = Math.cos(b.yaw), sn = Math.sin(b.yaw), lx = dx * c + dy * sn, ly = -dx * sn + dy * c;
        if (Math.abs(lx) < b.hx && Math.abs(ly) < b.hy && Math.abs(z - b.z) < b.hz) { s = 1; vx = b.vx; vy = b.vy; vz = b.vz; } }
      this.solid[q] = s; this.ou[q] = vx; this.ov[q] = vy; this.ow[q] = vz; } }
  /** what a solid now stands in pushed to the cells beside it (each takes a sixth from each solid neighbour), the solid
   *  emptied and cut */
  carve(): void { const { nx, ny, nz } = this.P, S0 = this.S.slice(), D0 = this.D.slice();
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k);
      if (this.solid[q]) { this.S[q] = 0; this.D[q] = 0; this.T[q] = 0; this.C[q] = 1; continue; } let s = 0, d = 0;
      for (const [a, b, c] of NB) { const x = i + a, y = j + b, z = k + c; if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) continue; const r = this.idx(x, y, z); if (this.solid[r]) { s += S0[r]!; d += D0[r]!; } }
      this.S[q] = this.S[q]! + (s / 6); this.D[q] = this.D[q]! + (d / 6); } }
  /** everything carried along the flow (from the velocity before this pass) */
  advect(dt: number): void { const { nx, ny, nz } = this.P, S = new Float32Array(this.n), D = new Float32Array(this.n), T = new Float32Array(this.n), C = new Float32Array(this.n).fill(1), U = new Float32Array(this.n), V = new Float32Array(this.n), W = new Float32Array(this.n);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k);
      if (!this.solid[q]) { const [x, y, z] = this.back(i + 0.5, j + 0.5, k + 0.5, dt); S[q] = this.sample(this.S, x, y, z, 0.5, 0.5, 0.5); T[q] = this.sample(this.T, x, y, z, 0.5, 0.5, 0.5); C[q] = this.sample(this.C, x, y, z, 0.5, 0.5, 0.5);
        const [a, b, c] = this.back(i + 0.5, j + 0.5, k + 0.5, dt, this.P.settle); D[q] = this.sample(this.D, a, b, c, 0.5, 0.5, 0.5); }
      { const [x, y, z] = this.back(i, j + 0.5, k + 0.5, dt); U[q] = this.sample(this.u, x, y, z, 0, 0.5, 0.5); }
      { const [x, y, z] = this.back(i + 0.5, j, k + 0.5, dt); V[q] = this.sample(this.v, x, y, z, 0.5, 0, 0.5); }
      { const [x, y, z] = this.back(i + 0.5, j + 0.5, k, dt); W[q] = this.sample(this.w, x, y, z, 0.5, 0.5, 0); } }
    this.S = S; this.D = D; this.T = T; this.C = C; this.u = U; this.v = V; this.w = W; }
  /** the forces: buoyancy, the drag toward the wind, vorticity confinement (at the cells' middles, then onto the faces),
   *  the push out of the cut */
  forces(dt: number): void { const { nx, ny, nz, h, alpha, betaS, betaD, drag, vort, cutPush, cutSwirl } = this.P, [wx, wy] = this.P.wind;
    // the velocity at the cells' middles, its curl, and the confinement's force there
    const at = (F: Float32Array, i: number, j: number, k: number) => F[this.idx(Math.min(nx - 1, Math.max(0, i)), Math.min(ny - 1, Math.max(0, j)), Math.min(nz - 1, Math.max(0, k)))]!;
    const cU = new Float32Array(this.n), cV = new Float32Array(this.n), cW = new Float32Array(this.n);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k);
      cU[q] = (this.u[q]! + this.faceU(i + 1, j, k)) / 2; cV[q] = (this.v[q]! + this.faceV(i, j + 1, k)) / 2; cW[q] = (this.w[q]! + this.faceW(i, j, k + 1)) / 2; }
    const ox = new Float32Array(this.n), oy = new Float32Array(this.n), oz = new Float32Array(this.n), om = new Float32Array(this.n);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k), d = 1 / (2 * h);
      const x = ((at(cW, i, j + 1, k) - at(cW, i, j - 1, k)) - (at(cV, i, j, k + 1) - at(cV, i, j, k - 1))) * d, y = ((at(cU, i, j, k + 1) - at(cU, i, j, k - 1)) - (at(cW, i + 1, j, k) - at(cW, i - 1, j, k))) * d, z = ((at(cV, i + 1, j, k) - at(cV, i - 1, j, k)) - (at(cU, i, j + 1, k) - at(cU, i, j - 1, k))) * d;
      ox[q] = x; oy[q] = y; oz[q] = z; om[q] = Math.hypot(x, y, z); }
    const fx = new Float32Array(this.n), fy = new Float32Array(this.n), fz = new Float32Array(this.n);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k);
      const gx = at(om, i + 1, j, k) - at(om, i - 1, j, k), gy = at(om, i, j + 1, k) - at(om, i, j - 1, k), gz = at(om, i, j, k + 1) - at(om, i, j, k - 1), gl = Math.hypot(gx, gy, gz) + 1e-5;
      const Nx = gx / gl, Ny = gy / gl, Nz = gz / gl, e = vort * h * Math.min(1, (this.S[q]! + this.D[q]!) * 4) * (1 + cutSwirl * 4 * this.C[q]! * (1 - this.C[q]!));
      fx[q] = e * (Ny * oz[q]! - Nz * oy[q]!); fy[q] = e * (Nz * ox[q]! - Nx * oz[q]!); fz[q] = e * (Nx * oy[q]! - Ny * ox[q]!); }
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k);
      const T = (at(this.T, i, j, k - 1) + this.T[q]!) / 2, S = (at(this.S, i, j, k - 1) + this.S[q]!) / 2, D = (at(this.D, i, j, k - 1) + this.D[q]!) / 2;
      const Cq = this.C[q]!;
      this.u[q] = this.u[q]! + (dt * ((at(fx, i - 1, j, k) + fx[q]!) / 2 + drag * (wx - this.u[q]!) - cutPush * (Cq - at(this.C, i - 1, j, k))));
      this.v[q] = this.v[q]! + (dt * ((at(fy, i, j - 1, k) + fy[q]!) / 2 + drag * (wy - this.v[q]!) - cutPush * (Cq - at(this.C, i, j - 1, k))));
      this.w[q] = this.w[q]! + (dt * ((at(fz, i, j, k - 1) + fz[q]!) / 2 + alpha * T - betaS * S - betaD * D - drag * 0.3 * this.w[q]! - cutPush * (Cq - at(this.C, i, j, k - 1)))); } }
  /** the faces by a solid or the box's walls: the solid's velocity; the open sides' faces as the face inside */
  bounds(): void { const { nx, ny, nz, open } = this.P;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k), sq = this.solid[q]!;
      const by = (F: Float32Array, O: Float32Array, r: number | null) => { const sr = r === null ? 0 : this.solid[r]!; if (sq || sr) F[q] = sq && sr ? (O[q]! + O[r!]!) / 2 : sq ? O[q]! : O[r!]!; };
      by(this.u, this.ou, i > 0 ? this.idx(i - 1, j, k) : null); by(this.v, this.ov, j > 0 ? this.idx(i, j - 1, k) : null); by(this.w, this.ow, k > 0 ? this.idx(i, j, k - 1) : null);
      if (i === 0 && !sq) this.u[q] = open ? this.u[this.idx(1, j, k)]! : 0; if (j === 0 && !sq) this.v[q] = open ? this.v[this.idx(i, 1, k)]! : 0; if (k === 0 && !sq) this.w[q] = 0; } }
  /** the faces past the far walls (not kept): open, as the last face inside; closed, still */
  faceU(i: number, j: number, k: number): number { const { nx } = this.P; return i < nx ? this.u[this.idx(i, j, k)]! : this.P.open ? this.u[this.idx(nx - 1, j, k)]! : 0; }
  faceV(i: number, j: number, k: number): number { const { ny } = this.P; return j < ny ? this.v[this.idx(i, j, k)]! : this.P.open ? this.v[this.idx(i, ny - 1, k)]! : 0; }
  faceW(i: number, j: number, k: number): number { const { nz } = this.P; return k < nz ? this.w[this.idx(i, j, k)]! : this.P.open ? this.w[this.idx(i, j, nz - 1)]! : 0; }
  /** each cell's divergence (the flow out of it less the flow in, m/s; 0 in a solid) */
  divergence(): Float32Array { const { nx, ny, nz } = this.P;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k);
      this.div[q] = this.solid[q] ? 0 : this.faceU(i + 1, j, k) - this.u[q]! + this.faceV(i, j + 1, k) - this.v[q]! + this.faceW(i, j, k + 1) - this.w[q]!; } return this.div; }
  /** the pressure: Jacobi sweeps of sum(neighbours - this) = divergence, a solid or a closed wall's side left out (no flow
   *  through it), an open side's outside 0 */
  pressure(iters: number): void { const { nx, ny, nz, open } = this.P; let p = this.p, q2 = new Float32Array(this.n);
    for (let it = 0; it < iters; it++) { for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k); if (this.solid[q]) { q2[q] = 0; continue; } let s = 0, c = 0;
        for (const [a, b, e] of NB) { const x = i + a, y = j + b, z = k + e; if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) { if (open && z >= 0) c++; continue; } const r = this.idx(x, y, z); if (this.solid[r]) continue; s += p[r]!; c++; }
        q2[q] = c ? (s - this.div[q]!) / c : 0; } [p, q2] = [q2, p]; }
    this.p = p; }
  /** the projection: each face less the pressure's difference across it (the faces by a solid or a wall set again) */
  project(): void { const { nx, ny, nz, open } = this.P, P = (i: number, j: number, k: number) => i < 0 || j < 0 || k < 0 ? 0 : this.p[this.idx(i, j, k)]!;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k), pc = this.p[q]!;
      if (i > 0 || open) this.u[q] = this.u[q]! - (pc - P(i - 1, j, k)); if (j > 0 || open) this.v[q] = this.v[q]! - (pc - P(i, j - 1, k)); if (k > 0) this.w[q] = this.w[q]! - (pc - P(i, j, k - 1)); }
    this.bounds(); }
  /** the smoke fades, the heat cools; the spreading (a flux between neighbours by their densities, so the sum is kept;
   *  held back across a cut); near the open sides the smoke thins away; in a fresh cut it is thinned, the cut fades */
  dissipate(dt: number): void { const { nx, ny, nz, h, fade, cool, spread, open, edge, cutFade, cutHold } = this.P, S0 = this.S.slice(), D0 = this.D.slice(), C0 = this.C.slice(), kf = Math.exp(-fade * dt), kc = Math.exp(-cool * dt), K = spread * dt / (h * h), kC = Math.exp(-cutFade * dt);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = this.idx(i, j, k); if (this.solid[q]) continue; let s = S0[q]!, d = D0[q]!;
      for (const [a, b, c] of NB) { const x = i + a, y = j + b, z = k + c; if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) continue; const r = this.idx(x, y, z); if (this.solid[r]) continue;
        const hb = 1 - 0.85 * Math.max(C0[q]!, C0[r]!); s += Math.min(1 / 7, K * hb * (S0[r]! + S0[q]!) / 2) * (S0[r]! - S0[q]!); d += Math.min(1 / 7, K * hb * (D0[r]! + D0[q]!) / 2) * (D0[r]! - D0[q]!); }
      let f = kf * Math.max(0, 1 - cutHold * dt * cutHoldAt(C0[q]!)); if (open && edge > 0) { const e = Math.min(i, j, nx - 1 - i, ny - 1 - j, nz - 1 - k); if (e < edge) f *= 1 - dt * 3 * (1 - e / edge); }
      this.S[q] = s * f; this.D[q] = d * f; this.T[q] = this.T[q]! * kc; this.C[q] = C0[q]! * kC; } }
  /** one step of dt (the puffs put in first) */
  step(dt: number, emits: readonly VolEmit[] = [], boxes: readonly VolBox[] = []): void {
    this.inject(emits); this.obstacles(boxes); this.carve(); this.advect(dt); this.forces(dt); this.bounds();
    this.divergence(); this.pressure(this.P.iters); this.project(); this.dissipate(dt); }

  // ---- reading ----
  /** the smoke and the dust summed over the cells (density x cell volume) */
  mass(): number { let m = 0; for (let q = 0; q < this.n; q++) m += this.S[q]! + this.D[q]!; return m * this.P.h ** 3; }
  /** the density-weighted middle of a field (world) */
  centroid(F: Float32Array = this.S): [number, number, number] { const { nx, ny, nz } = this.P; let m = 0, x = 0, y = 0, z = 0;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const d = F[this.idx(i, j, k)]!; m += d; x += d * (i + 0.5); y += d * (j + 0.5); z += d * (k + 0.5); }
    return m > 0 ? this.world(x / m, y / m, z / m) : this.world(nx / 2, ny / 2, nz / 2); }
  /** the density (smoke and dust) at a world point */
  densityAt(x: number, y: number, z: number): number { const h = this.P.h, o = this.origin, gx = (x - o[0]) / h, gy = (y - o[1]) / h, gz = (z - o[2]) / h;
    return this.sample(this.S, gx, gy, gz, 0.5, 0.5, 0.5) + this.sample(this.D, gx, gy, gz, 0.5, 0.5, 0.5); }
  /** the light's way through the smoke: for each cell (at half the resolution, 2x2x2 cells a sample) the share of the sun
   *  reaching it, exp(-sigma x the density along the way toward the sun, two cells a step) */
  light(sun: readonly [number, number, number], sigma = 4): Float32Array { const { nx, ny, nz, h } = this.P, mx = nx >> 1, my = ny >> 1, mz = nz >> 1, L = new Float32Array(mx * my * mz);
    for (let k = 0; k < mz; k++) for (let j = 0; j < my; j++) for (let i = 0; i < mx; i++) { let x = i * 2 + 1, y = j * 2 + 1, z = k * 2 + 1, tau = 0;
      for (let s = 0; s < 64; s++) { x += sun[0] * 2; y += sun[1] * 2; z += sun[2] * 2; if (x < 0 || y < 0 || x > nx || y > ny || z > nz) break; tau += sigma * 2 * h * (this.sample(this.S, x, y, z, 0.5, 0.5, 0.5) + this.sample(this.D, x, y, z, 0.5, 0.5, 0.5)); }
      L[i + mx * (j + my * k)] = Math.exp(-tau); } return L; }
}
const NB: readonly (readonly [number, number, number])[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
