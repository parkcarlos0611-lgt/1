// A tyre as a ring of nodes (review 101), in the manner of a soft-body car game: 32 nodes round the tread, each on a
// radial spring to the rim and tied to its neighbours (the tread's band, which spreads a dent into a smooth bulge),
// damped, stepped several times a car step. The road pushes the nodes it reaches inward (their depth under the hub
// read from the ground under each: the bumps' profile along the car, so a ridge rolls through the tread), so the
// contact patch flattens with the load and the tread bulges either side of it; the patch is also pulled sideways and
// along by the tyre's forces (the walls' shear). It shapes the tyre as drawn; the car's own grip and springing stay
// the vehicle's (its corner springs already hold the tyre's give).
// Ring axes: the wheel's plane, angle from straight down, positive toward the car's front; u: a node's inward give (m).
export const NODES = 32;
export class TyreRing {
  readonly u = new Float32Array(NODES); private v = new Float32Array(NODES);
  /** the contact patch's shift against the rim (m): across (+ to the car's left) and along (+ forward), as the walls shear */
  sy = 0; sx = 0;
  private readonly wr: number; private readonly wc: number; private readonly kt: number;
  /** R: the tyre's radius (m), F0: the load it carries standing (N), sag: its give then as a share of the radius */
  constructor(readonly R: number, readonly F0: number, readonly sag = 0.05) { this.wr = 2 * Math.PI * 32; this.wc = this.wr * 1.3; this.kt = F0 / (sag * R); }
  /** the give at standstill (m): the car is drawn lower by it, so the flattened tyre sits on the road */
  get rest(): number { return this.F0 / this.kt; }
  /** one car step: the load on the wheel (N), the tyre's forces along and across (N, wheel axes), and the ground's
   *  height under the tread at a distance x ahead of the hub (m) against the ground under it */
  step(dt: number, load: number, fx: number, fy: number, ground: (x: number) => number): void {
    const h = this.R - Math.max(0, load) / this.kt, n = NODES, sub = 4, d = dt / sub, z = 0.3, depth = new Float32Array(n).fill(Infinity);
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, c = Math.cos(a); if (c < 0.05) continue; depth[k] = (h - ground(this.R * Math.sin(a))) / c; }   // how far out the road lets node k reach
    for (let s = 0; s < sub; s++) for (let k = 0; k < n; k++) {
      const um = this.u[(k + n - 1) % n]!, up = this.u[(k + 1) % n]!, uk = this.u[k]!;
      const acc = -this.wr * this.wr * uk - 2 * z * this.wr * this.v[k]! + this.wc * this.wc * (um + up - 2 * uk);
      this.v[k] = this.v[k]! + acc * d; this.u[k] = uk + this.v[k]! * d;
      const least = this.R - depth[k]!; if (this.u[k]! < least) { this.u[k] = least; if (this.v[k]! < 0) this.v[k] = 0; } }   // the road: no further out than it lets
    // the walls' shear: stiffer along than across, followed with a little lag
    const kl = this.F0 / 0.025, f = Math.min(1, dt / 0.03), on = load > 0 ? 1 : 0;
    this.sy += (Math.max(-0.05, Math.min(0.05, on * fy / kl)) - this.sy) * f; this.sx += (Math.max(-0.03, Math.min(0.03, on * fx / (kl * 2))) - this.sx) * f; }
  /** the give at an angle (rad from straight down, + toward the front), between the nodes */
  at(a: number): number { const n = NODES, t = ((a / (Math.PI * 2)) * n % n + n) % n, i = Math.floor(t), f = t - i; return this.u[i]! * (1 - f) + this.u[(i + 1) % n]! * f; }
}
