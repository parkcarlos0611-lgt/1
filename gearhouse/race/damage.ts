// Crash damage by deformation (review 121; plan in docs/systems/74 and 76 §4 step 3). The car's body as BeamNG.drive
// builds one: nodes through its parts and beams between them, each beam a spring that yields for good past its yield
// strain and parts past its breaking strain. The car still drives as the rigid body of race/vehicle.ts; the structure is
// worked only when something strikes it: the blow's energy is taken by pressing a flat impactor into the car along the
// blow, step by step, the structure relaxing about it, until the beams' elastic and plastic work has taken the energy.
// Then the impactor is withdrawn and the elastic part springs back; the bend stays. The skin follows its nodes. A part
// whose every beam to the rest has parted comes away (a bumper, a lamp, a wing). A wheel's mounting pushed askew sets
// its toe and camber; a crushed radiator cools less and leaks.
// Axes: the mesh's own (mm; x back from the nose, y to the left, z up from the ground).
import { wheelsOf, type Mesh } from '../render/car/mesh';

/** what a part is made of: stiffness (N/m per beam), yield and breaking strain, mass per node (kg) */
interface Stuff { k: number; yld: number; brk: number; m: number }
// (the yield force of a beam is k x yield x its length: a panel's about 7 kN, a frame rail's about 60 kN, so a car's
// front crushes at a few hundred kN, as the period's heavy frames and axles did: half a metre for a 50 km/h blow)
const FRAME: Stuff = { k: 1.5e7, yld: 0.015, brk: 0.5, m: 9 }, PANEL: Stuff = { k: 2.5e6, yld: 0.01, brk: 0.35, m: 2.5 }, BRIGHT: Stuff = { k: 3e6, yld: 0.012, brk: 0.12, m: 3 },
  GLASS: Stuff = { k: 1e6, yld: 0.004, brk: 0.015, m: 1.5 }, HEAVY: Stuff = { k: 6e7, yld: 0.03, brk: 0.8, m: 25 }, SOFT: Stuff = { k: 3e5, yld: 0.02, brk: 0.6, m: 1.5 };
function stuffOf(name: string): Stuff {
  if (/chassis|frame|axle|spring|engine|block|sump|gearbox/i.test(name)) return /engine|block|sump|gearbox/i.test(name) ? HEAVY : FRAME;
  if (/screen|glass|pane|lens|lamp(?!Stand)|lampCover/i.test(name)) return GLASS;
  if (/bumper|grille|shell|core|radiator|exhaust|board|rim|tail/i.test(name)) return BRIGHT;
  if (/seat|cockpit|hood_?cloth|canvas|tonneau|spare/i.test(name)) return SOFT;
  return PANEL; }

export interface Loose { part: number; name: string; tris: number[]; centre: [number, number, number] }
export class Damage {
  /** nodes: rest and present positions (mm), each node's part and stuff */
  readonly n: number; readonly rest: Float32Array; readonly pos: Float32Array; readonly part: Int16Array; readonly fixed: Uint8Array;
  /** beams: ends, rest length now (plastic), first rest length, stiffness, yield and breaking strain, broken */
  readonly ba: Int32Array; readonly bb: Int32Array; readonly L0: Float32Array; readonly Lf: Float32Array; readonly bk: Float32Array; readonly by: Float32Array; readonly bbr: Float32Array; readonly gone: Uint8Array; private give: Float32Array;
  /** the skin: each vertex's nodes and weights */
  private vn: Int32Array; private vw: Float32Array; private live: Uint8Array;
  /** the deformed mesh, rebuilt when `dirty`; parts come away into `loose` (taken by the page) */
  mesh: Mesh; dirty = false; readonly loose: Loose[] = []; private gonePart = new Set<number>();
  /** how bent: the most any node has moved (mm), the energy taken (J) */
  worst = 0; taken = 0;
  /** the parts' names, with the frame and engine added */ names: string[] = [];
  constructor(readonly base: Mesh, readonly cell = 280) {
    const M = base, names = M.names ?? [], wheel = new Uint8Array(M.n); for (const w of wheelsOf(M)) for (const t of w.tris) wheel[t] = 1;
    // nodes: the skin's corners gathered in cells, a node at each cell's middle of mass, named for the part most there
    const cells = new Map<string, { x: number; y: number; z: number; c: number; parts: Map<number, number> }>();
    for (let t = 0; t < M.n; t++) { if (wheel[t]) continue; for (let k = 0; k < 3; k++) { const x = M.pos[t * 9 + k * 3]!, y = M.pos[t * 9 + k * 3 + 1]!, z = M.pos[t * 9 + k * 3 + 2]!, key = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
      let c = cells.get(key); if (!c) { c = { x: 0, y: 0, z: 0, c: 0, parts: new Map() }; cells.set(key, c); } c.x += x; c.y += y; c.z += z; c.c++; c.parts.set(M.part[t]!, (c.parts.get(M.part[t]!) ?? 0) + 1); } }
    // what the skin hides (most meshes are their outside only): a ladder frame of two rails from the front dumb irons to
    // behind the rear axle, and the engine, a heavy block between the front axle and the scuttle; nodes of their own
    const W = wheelsOf(M), fw = W.filter(w => w.front), rw = W.filter(w => !w.front);
    if (fw.length && rw.length) { const xf = fw[0]!.hx, xr = rw[0]!.hx, hz = fw[0]!.hz, half = Math.abs(fw[0]!.hy) * 0.55, x0 = Math.max(60, xf - 450), add = (x: number, y: number, z: number, pid: number) => { const c = { x, y, z, c: 1, parts: new Map([[pid, 1]]) }; cells.set(`v${cells.size}`, c); };
      const PF = names.length, PE = names.length + 1; this.names = [...names, 'frame', 'engine'];
      for (let x = x0; x <= xr + 500; x += cell) for (const y of [-half, half]) add(x, y, hz + 40, PF);
      for (let x = xf - 50; x <= xf + 1050; x += cell * 0.9) for (const y of [-240, 0, 240]) for (const z of [hz + 80, hz + 380]) add(x, y, z, PE); }
    else this.names = names;
    const list = [...cells.values()]; this.n = list.length; this.rest = new Float32Array(this.n * 3); this.part = new Int16Array(this.n); this.fixed = new Uint8Array(this.n);
    list.forEach((c, i) => { this.rest.set([c.x / c.c, c.y / c.c, c.z / c.c], i * 3); let best = 0, bc = -1; for (const [p, k] of c.parts) if (k > bc) { bc = k; best = p; } this.part[i] = best; });
    this.pos = Float32Array.from(this.rest);
    // beams: to every node within a cell and a half and a bit (the lattice and its diagonals)
    const A: number[] = [], B: number[] = [], reach = cell * 1.8;
    for (let i = 0; i < this.n; i++) for (let j = i + 1; j < this.n; j++) { const d = this.dist(this.rest, i, j); if (d < reach && d > 1) { A.push(i); B.push(j); } }
    const nb = A.length; this.ba = Int32Array.from(A); this.bb = Int32Array.from(B); this.L0 = new Float32Array(nb); this.Lf = new Float32Array(nb); this.bk = new Float32Array(nb); this.by = new Float32Array(nb); this.bbr = new Float32Array(nb); this.gone = new Uint8Array(nb); this.give = new Float32Array(nb);
    for (let b = 0; b < nb; b++) { const i = A[b]!, j = B[b]!, si = stuffOf(this.names[this.part[i]!] ?? ''), sj = stuffOf(this.names[this.part[j]!] ?? ''), weak = si.k < sj.k ? si : sj;
      this.L0[b] = this.Lf[b] = this.dist(this.rest, i, j); this.bk[b] = weak.k * (this.part[i] === this.part[j] ? 1 : 0.6); this.by[b] = weak.yld; this.bbr[b] = this.part[i] === this.part[j] ? weak.brk : weak.brk * 0.6; this.give[b] = Math.min(1, Math.sqrt(this.bk[b]! / FRAME.k)); }   // between parts: the mounts, weaker
    // the skin: each corner to its four nearest nodes, by inverse distance
    const nv = M.n * 3; this.vn = new Int32Array(nv * 4).fill(-1); this.vw = new Float32Array(nv * 4); this.live = new Uint8Array(M.n).fill(1);
    for (let t = 0; t < M.n; t++) { if (wheel[t]) continue; for (let k = 0; k < 3; k++) { const v = t * 3 + k, x = M.pos[v * 3]!, y = M.pos[v * 3 + 1]!, z = M.pos[v * 3 + 2]!, near: [number, number][] = [];
      for (let i = 0; i < this.n; i++) { const dx = this.rest[i * 3]! - x, dy = this.rest[i * 3 + 1]! - y, dz = this.rest[i * 3 + 2]! - z, d = dx * dx + dy * dy + dz * dz; if (d < (cell * 1.6) ** 2) near.push([i, d]); }
      near.sort((a, b) => a[1] - b[1]); const use = near.slice(0, 4); let ws = 0; use.forEach(([i, d], q) => { const w = 1 / (Math.sqrt(d) + cell * 0.25); this.vn[v * 4 + q] = i; this.vw[v * 4 + q] = w; ws += w; }); for (let q = 0; q < 4; q++) this.vw[v * 4 + q] = this.vw[v * 4 + q]! / (ws || 1); } }
    this.mesh = { ...M, pos: Float32Array.from(M.pos) }; }
  private dist(P: Float32Array, i: number, j: number): number { return Math.hypot(P[i * 3]! - P[j * 3]!, P[i * 3 + 1]! - P[j * 3 + 1]!, P[i * 3 + 2]! - P[j * 3 + 2]!); }
  /** a blow at point p (mm, the mesh's axes) along d (unit, into the car) carrying E joules into bending; the impactor's
   *  face a disc of radius r (mm): a post or a corner small, a flank broad. Returns how deep it went (mm). */
  impact(p: [number, number, number], d: [number, number, number], E: number, r = 320): number {
    if (E < 150) return 0; const P = this.pos, n = this.n, ds = 10; let s = -40, W = 0, depth = 0;   // s: the impactor's face along d from p (mm); it starts a little outside
    // nodes far off (beyond 1.6 m) stand for the rest of the car: they hold
    const far = new Uint8Array(n); for (let i = 0; i < n; i++) { const dx = P[i * 3]! - p[0], dy = P[i * 3 + 1]! - p[1], dz = P[i * 3 + 2]! - p[2]; if (dx * dx + dy * dy + dz * dz > 1600 * 1600) far[i] = 1; }
    const nbAll = this.ba.length, Wb = new Float64Array(nbAll), act: number[] = []; for (let b = 0; b < nbAll; b++) if (!(far[this.ba[b]!] && far[this.bb[b]!])) act.push(b);   /* only the beams near the blow are worked */
    for (let step = 0; step < 100 && W < E; step++) { s += ds;
      // press: nodes within the face's reach and in front of it are put on it
      for (let i = 0; i < n; i++) { if (far[i]) continue; const dx = P[i * 3]! - p[0], dy = P[i * 3 + 1]! - p[1], dz = P[i * 3 + 2]! - p[2], along = dx * d[0] + dy * d[1] + dz * d[2], ax = dx - along * d[0], ay = dy - along * d[1], az = dz - along * d[2];
        if (along < s && ax * ax + ay * ay + az * az < r * r) { const m = s - along; P[i * 3] = P[i * 3]! + d[0] * m; P[i * 3 + 1] = P[i * 3 + 1]! + d[1] * m; P[i * 3 + 2] = P[i * 3 + 2]! + d[2] * m; depth = Math.max(depth, s); } }
      // relax: each beam toward its rest length by its stiffness (a frame rail holds its length, a panel gives), the nodes on the face and the far ones held
      const held = new Uint8Array(n); for (let i = 0; i < n; i++) held[i] = far[i] || this.onFace(i, p, d, s, r) ? 1 : 0;
      for (let it = 0; it < 4; it++) for (const b of act) { if (this.gone[b]) continue; const i = this.ba[b]!, j = this.bb[b]!, L = this.dist(P, i, j), e = (L - this.L0[b]!) / Math.max(1, L);
        const hi = held[i], hj = held[j]; if (hi && hj) continue; const wi = hi ? 0 : hj ? 1 : 0.5, wj = hi ? 1 : hj ? 0 : 0.5, f = e * 0.5 * this.give[b]!;
        for (let k = 0; k < 3; k++) { const dd = (P[j * 3 + k]! - P[i * 3 + k]!) * f; P[i * 3 + k] = P[i * 3 + k]! + dd * wi * 2; P[j * 3 + k] = P[j * 3 + k]! - dd * wj * 2; } }
      // the beams' work: elastic stored, plastic flow (the rest length follows past yield), breaking
      W = 0; for (const b of act) { if (this.gone[b]) { W += Wb[b]!; continue; }   /* a parted beam keeps the work it took (and its breaking's) */ const L = this.dist(P, this.ba[b]!, this.bb[b]!), L0 = this.L0[b]!, e = (L - L0) / this.Lf[b]!, y = this.by[b]!, k = this.bk[b]!;
        if (Math.abs(e) > y) { const flow = (Math.abs(e) - y) * this.Lf[b]! * Math.sign(e); this.L0[b] = L0 + flow; Wb[b] = Wb[b]! + k * y * this.Lf[b]! / 1000 * Math.abs(flow) / 1000; }
        if (Math.abs(L - this.Lf[b]!) / this.Lf[b]! > this.bbr[b]!) { this.gone[b] = 1; Wb[b] = Wb[b]! + 0.5 * k * ((L - this.L0[b]!) / 1000) ** 2; }
        const el = (L - this.L0[b]!) / 1000; W += 0.5 * k * el * el + Wb[b]!; } }
    // the impactor withdrawn: the elastic part springs back
    for (let it = 0; it < 30; it++) for (const b of act) { if (this.gone[b]) continue; const i = this.ba[b]!, j = this.bb[b]!, L = this.dist(P, i, j), e = (L - this.L0[b]!) / Math.max(1, L); if (far[i] && far[j]) continue; const wi = far[i] ? 0 : far[j] ? 1 : 0.5, wj = far[i] ? 1 : far[j] ? 0 : 0.5;
      for (let k = 0; k < 3; k++) { const dd = (P[j * 3 + k]! - P[i * 3 + k]!) * e * 0.5; P[i * 3 + k] = P[i * 3 + k]! + dd * wi * 2; P[j * 3 + k] = P[j * 3 + k]! - dd * wj * 2; } }
    this.taken += Math.min(W, E); for (let i = 0; i < n; i++) this.worst = Math.max(this.worst, this.moved(i)); this.detach(); this.dirty = true; return depth; }
  private onFace(i: number, p: [number, number, number], d: [number, number, number], s: number, r: number): boolean { const P = this.pos, dx = P[i * 3]! - p[0], dy = P[i * 3 + 1]! - p[1], dz = P[i * 3 + 2]! - p[2], along = dx * d[0] + dy * d[1] + dz * d[2];
    return along >= s - 1 && along <= s + 1 && (dx - along * d[0]) ** 2 + (dy - along * d[1]) ** 2 + (dz - along * d[2]) ** 2 < r * r; }
  /** how far node i stands from where it was built (mm) */
  moved(i: number): number { return Math.hypot(this.pos[i * 3]! - this.rest[i * 3]!, this.pos[i * 3 + 1]! - this.rest[i * 3 + 1]!, this.pos[i * 3 + 2]! - this.rest[i * 3 + 2]!); }
  /** parts whose every beam to another part has parted come away */
  private detach(): void { const names = this.names, held = new Map<number, number>(), any = new Map<number, number>();
    for (let b = 0; b < this.ba.length; b++) { const pi = this.part[this.ba[b]!]!, pj = this.part[this.bb[b]!]!; if (pi === pj) continue; for (const p of [pi, pj]) { any.set(p, (any.get(p) ?? 0) + 1); if (!this.gone[b]) held.set(p, (held.get(p) ?? 0) + 1); } }
    for (const [p, c] of any) { if (this.gonePart.has(p) || c === 0 || (held.get(p) ?? 0) > 0) continue; const name = names[p] ?? '';
      if (/chassis|frame|body|cockpit|engine|seat|floor/i.test(name)) continue;   // the car's core does not come away
      this.gonePart.add(p); const tris: number[] = []; let cx = 0, cy = 0, cz = 0, k = 0; for (let t = 0; t < this.base.n; t++) if (this.base.part[t] === p && this.live[t]) { tris.push(t); this.live[t] = 0; for (let q = 0; q < 3; q++) { cx += this.mesh.pos[t * 9 + q * 3]!; cy += this.mesh.pos[t * 9 + q * 3 + 1]!; cz += this.mesh.pos[t * 9 + q * 3 + 2]!; k++; } }
      if (tris.length) this.loose.push({ part: p, name, tris, centre: [cx / k, cy / k, cz / k] }); } }
  /** the skin moved with its nodes; parts come away taken out (folded to nothing) */
  rebuild(): Mesh { const M = this.base, out = new Float32Array(M.pos);
    for (let v = 0; v < M.n * 3; v++) { const t = Math.floor(v / 3); if (!this.live[t]) { out[v * 3] = out[v * 3 + 1] = out[v * 3 + 2] = 0; continue; } let dx = 0, dy = 0, dz = 0;
      for (let q = 0; q < 4; q++) { const i = this.vn[v * 4 + q]!; if (i < 0) continue; const w = this.vw[v * 4 + q]!; dx += (this.pos[i * 3]! - this.rest[i * 3]!) * w; dy += (this.pos[i * 3 + 1]! - this.rest[i * 3 + 1]!) * w; dz += (this.pos[i * 3 + 2]! - this.rest[i * 3 + 2]!) * w; }
      out[v * 3] = out[v * 3]! + dx; out[v * 3 + 1] = out[v * 3 + 1]! + dy; out[v * 3 + 2] = out[v * 3 + 2]! + dz; }
    this.mesh = { ...M, pos: out }; this.dirty = false; return this.mesh; }
  /** a loose part as a mesh of its own about its middle (for the pieces flung off) */
  piece(l: Loose): Mesh { const M = this.mesh, n = l.tris.length, pos = new Float32Array(n * 9), col = new Uint8Array(n * 3), gloss = new Float32Array(n), part = new Int16Array(n), kind = new Uint8Array(n), tex = new Uint8Array(n);
    l.tris.forEach((t, j) => { for (let q = 0; q < 9; q++) pos[j * 9 + q] = M.pos[t * 9 + q]! - l.centre[q % 3]!; col.set(M.col.subarray(t * 3, t * 3 + 3), j * 3); gloss[j] = M.gloss[t]!; part[j] = 0; kind[j] = M.kind[t]!; tex[j] = M.tex[t]!; });
    return { n, pos, col, gloss, part, kind, tex, length: 0, names: [l.name] }; }
  /** a wheel's mounting pushed askew (mm, the mesh's axes): toe (rad, front of the wheel turned left +) and camber (rad,
   *  top to the left +) from how the nodes about its hub have moved */
  askew(hub: [number, number, number]): { toe: number; camber: number } { let a = 0, b = 0, c = 0, d = 0, na = 0, nc = 0;
    for (let i = 0; i < this.n; i++) { const dx = this.rest[i * 3]! - hub[0], dy = this.rest[i * 3 + 1]! - hub[1], dz = this.rest[i * 3 + 2]! - hub[2]; if (dx * dx + dy * dy + dz * dz > 500 * 500) continue;
      const my = this.pos[i * 3 + 1]! - this.rest[i * 3 + 1]!; if (Math.abs(dx) > 80) { a += my * Math.sign(-dx); na++; b += Math.abs(dx); } if (Math.abs(dz) > 80) { c += my * Math.sign(dz); nc++; d += Math.abs(dz); } }
    const toe = na ? Math.atan((a / na) / Math.max(100, b / na)) : 0, camber = nc ? Math.atan((c / nc) / Math.max(100, d / nc)) : 0;
    return { toe: Math.max(-0.12, Math.min(0.12, toe)), camber: Math.max(-0.12, Math.min(0.12, camber)) }; }
  /** how crushed the radiator is: 0 whole .. 1 flattened (its nodes pushed in by 15 cm) */
  get radiator(): number { const names = this.names; let s = 0, c = 0; for (let i = 0; i < this.n; i++) if (/core|radiator|grille|shell/i.test(names[this.part[i]!] ?? '')) { s += this.moved(i); c++; } return c ? Math.min(1, s / c / 150) : 0; }
}
