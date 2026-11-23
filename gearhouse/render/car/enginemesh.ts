// An engine as a low-polygon mesh, built from its specification (doc 86; doc 77 §2 step 2), to be set into a car's
// mesh where it shows through glass or louvres. (render/car/engine.ts is the builder's engine swap, a different thing.)
//
// The engine is laid out in its own frame, then turned and scaled into the car's:
//   u  along the crank, from the bellhousing face (u = 0) to the accessory end (the pulleys)
//   v  across, the banks either side
//   w  up from the crank's centre
// Proportions come from rules of thumb, not drawings: the bore from the displacement of one cylinder, the cylinder
// pitch from the bore, the deck, head and cam cover heights from the bore. Each bank is a block, a DOHC head and its cam
// covers set along the bank's axis (half the bank angle from upright); the intake sits between the banks (or on top),
// the exhaust headers on the outer sides, the turbos beside the collectors, the belt drive at the accessory end.
// What matters most is the view from above through the glass: plenums, cam covers, runners, labels, the brace.
// Every part is named `engine...`, so nothing here is ever taken for a wheel (mesh.ts wheelsOf).
import type { Build, Kind, V } from './mesh';

export interface EngineSpec {
  layout: 'I' | 'V' | 'flat';
  cylinders: number;
  /** the angle between the banks (V only; default 90; a flat engine is 180) */
  bankDeg?: number;
  litres: number;
  /** set across the car (only a hint for the car file; the axis is chosen by addEngine's `dir`) */
  transverse?: boolean;
  turbos?: number;
  superchargers?: number;
  /** one plenum over the vee, one along each bank, or a short plenum per bank with long visible runners */
  plenum?: 'single' | 'twin' | 'runners';
  colours?: { block?: string; heads?: string; covers?: string; plenum?: string; accent?: string; label?: string; pipes?: string };
  /** a crinkle-finish intake (a flat, grained lacquer: lower gloss) */
  crinkle?: boolean;
  label?: string;
}
export interface EngineOpts {
  /** the way the crank runs from `o`, the bellhousing end, to the pulleys (car axes); 'x' = '+x', 'y' = '+y' */
  dir?: 'x' | '+x' | '-x' | 'y' | '+y' | '-y';
  /** the room it must fit (mm): length along the crank, width across it (centred on the crank), height overall */
  box?: { len: number; wid: number; hgt: number };
  detail?: 0 | 1 | 2;
  /** a polished strut brace across the car over the engine (default: on at detail 1 and 2) */
  brace?: boolean;
}
export interface EngineBuilt {
  tris: number;
  /** the uniform scale applied to fit the box (1: as drawn) */
  scale: number;
  /** the engine's size as built: along the crank, across it, overall height */
  size: { len: number; wid: number; hgt: number };
  /** its bounds in the car's axes */
  min: V; max: V;
}

type G = { name: string; col: string; gloss: number; kind: Kind; t: V[] };
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const area = (a: V, b: V, c: V) => len(cross(sub(b, a), sub(c, a))) / 2;

/** collects triangles by part in the engine's own frame; they are scaled and turned into the car at the end */
class Geo {
  g: G[] = []; private c!: G;
  mat(name: string, col: string, gloss = 0.2, kind: Kind = 'plain'): this { this.c = { name, col, gloss, kind, t: [] }; this.g.push(this.c); return this; }
  tri(a: V, b: V, c: V): this { if (area(a, b, c) > 1) this.c.t.push(a, b, c); return this; }
  quad(a: V, b: V, c: V, d: V): this { return this.tri(a, b, c).tri(a, c, d); }
  /** a box on three axes through a corner-free centre: half sizes along e1, e2, e3; `open` leaves faces off ('-3' the bottom) */
  obox(c: V, e1: V, h1: number, e2: V, h2: number, e3: V, h3: number, open = ''): this {
    if (h1 < 0.5 || h2 < 0.5 || h3 < 0.5) return this;
    const P = (i: number, j: number, k: number) => add(add(add(c, mul(e1, i * h1)), mul(e2, j * h2)), mul(e3, k * h3));
    const F: [string, V, V, V, V][] = [['-1', P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), P(-1, -1, 1)], ['+1', P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)],
      ['-2', P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)], ['+2', P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1)],
      ['-3', P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1)], ['+3', P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)]];
    for (const [id, a, b, cc, d] of F) if (!open.includes(id)) this.quad(a, b, cc, d); return this; }
  /** an axis-aligned box */
  box(u0: number, u1: number, v0: number, v1: number, w0: number, w1: number, open = ''): this {
    return this.obox([(u0 + u1) / 2, (v0 + v1) / 2, (w0 + w1) / 2], [1, 0, 0], Math.abs(u1 - u0) / 2, [0, 1, 0], Math.abs(v1 - v0) / 2, [0, 0, 1], Math.abs(w1 - w0) / 2, open); }
  /** a convex section `sec` ([across, up] about the line) swept straight from a to b; `up` the section's up */
  prism(a: V, b: V, sec: [number, number][], up: V = [0, 0, 1], caps = true): this {
    const d = norm(sub(b, a)); if (len(sub(b, a)) < 1) return this;
    let p = cross(up, d); if (len(p) < 1e-3) p = cross([1, 0, 0], d); p = norm(p); const q = cross(d, p);
    const ring = (o: V) => sec.map(([x, y]) => add(add(o, mul(p, x)), mul(q, y))), A = ring(a), B = ring(b), n = sec.length;
    for (let i = 0; i < n; i++) this.quad(A[i]!, A[(i + 1) % n]!, B[(i + 1) % n]!, B[i]!);
    if (caps) for (const R of [A, B]) for (let i = 1; i + 1 < n; i++) this.tri(R[0]!, R[i]!, R[i + 1]!);
    return this; }
  cyl(a: V, b: V, r: number, seg: number, caps = true, up: V = [0, 0, 1]): this { return this.prism(a, b, circle(r, seg), up, caps); }
  /** a square-section pipe from a to b (its ends open: they always meet something) */
  pipe(a: V, b: V, t: number, caps = false): this { return this.prism(a, b, [[-t / 2, -t / 2], [t / 2, -t / 2], [t / 2, t / 2], [-t / 2, t / 2]], [0, 0, 1], caps); }
  /** a pipe through several points */
  path(pts: V[], t: number): this { for (let i = 0; i + 1 < pts.length; i++) this.pipe(pts[i]!, pts[i + 1]!, t); return this; }
}
const circle = (r: number, seg: number): [number, number][] => Array.from({ length: seg }, (_, i) => { const a = (i + 0.5) / seg * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r] as [number, number]; });
/** a rounded box section: half width hw, half height hh, k points, `sq` how square (2 an ellipse, 6 near a box) */
const rsec = (hw: number, hh: number, k: number, sq = 4): [number, number][] => Array.from({ length: k }, (_, i) => { const t = (i + 0.5) / k * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); return [hw * Math.sign(c) * Math.abs(c) ** (2 / sq), hh * Math.sign(s) * Math.abs(s) ** (2 / sq)] as [number, number]; });

const DEF = { block: '#9a9da2', heads: '#8a8d92', covers: '#1c1c1f', plenum: '#202124', accent: '#c4202a', label: '#d9d8d0', pipes: '#7e7468' };
const STEEL = '#b9bcc1', CHROME = '#d8dadc', BELT = '#1a1a1a', HOSE = '#232326', SHIELD = '#c2c4c6', TURBO = '#8b8780', HOT = '#6f5f53';

export function addEngine(b: Build, spec: EngineSpec, o: V, opts: EngineOpts = {}): EngineBuilt {
  const det = opts.detail ?? 2, g = new Geo(), C = { ...DEF, ...spec.colours };
  const seg = det === 2 ? 10 : det === 1 ? 6 : 5, seg2 = det === 2 ? 8 : 5;        // round parts: the large ones, the small ones
  const banks = spec.layout === 'I' ? 1 : 2, nb = Math.ceil(spec.cylinders / banks);
  const half = (spec.layout === 'flat' ? 180 : spec.layout === 'V' ? spec.bankDeg ?? 90 : 0) / 2 * Math.PI / 180, cs = Math.cos(half), sn = Math.sin(half);
  // ---- proportions from the bore ----
  const B = 10.8 * Math.cbrt(spec.litres * 1000 / spec.cylinders);                   // a 500 cc cylinder: 86 mm
  const pitch = Math.min(118, Math.max(78, B * 1.12 + 4)), st = banks > 1 ? 0.3 * pitch : 0;
  const Hd = 2.5 * B, Hh = 1.25 * B, Hc = 0.42 * B, hw = 1.05 * B;                    // deck along the bank's axis, head and cover heights, head half width
  const u0 = 40, Lb = u0 + nb * pitch + st + 25;                                       // the first bore's start, the block's end (the timing case starts there)
  const cylU = (s: number, i: number) => u0 + (s < 0 ? st : 0) + (i + 0.5) * pitch;
  /** a point in bank s's frame: across (+ outward, falling) and along its axis (up from the crank) */
  const P = (s: number, u: number, across: number, along: number): V => [u, s * (across * cs + along * sn), -across * sn + along * cs];
  const ax = (s: number): V => [0, s * sn, cs], acr = (s: number): V => [0, s * cs, -sn];
  const S = banks > 1 ? [1, -1] : [1];
  const bankBox = (s: number, ua: number, ub: number, a0: number, a1: number, al0: number, al1: number, open = '') =>
    g.obox(P(s, (ua + ub) / 2, (a0 + a1) / 2, (al0 + al1) / 2), [1, 0, 0], (ub - ua) / 2, acr(s), (a1 - a0) / 2, ax(s), (al1 - al0) / 2, open);
  const bankU = (s: number): [number, number] => [u0 - 15 + (s < 0 ? st : 0), u0 + (s < 0 ? st : 0) + nb * pitch + 12];
  const topA = Hd + Hh + Hc;                                                           // the cam covers' top along the bank's axis
  const inner = (s: number, along: number) => P(s, 0, -hw, along);                     // the head's inner edge at that height
  const camTop = Math.max(...S.map(s => P(s, 0, -hw, topA)[2]), P(1, 0, hw, topA)[2]);
  const vin = banks > 1 && spec.layout === 'V' ? Math.abs(inner(1, Hd + Hh)[1]) : 0;   // half the vee's opening at the heads' tops
  const crinkle = spec.crinkle ? 0.1 : 0.32;

  // ---- the block: crankcase, sump, a block for each bank, the bellhousing flange ----
  g.mat('engineBlock', C.block, 0.3);
  g.box(u0 - 20, Lb, -1.15 * B, 1.15 * B, -0.55 * B, 0.7 * B);
  for (const s of S) { const [ua, ub] = bankU(s); bankBox(s, ua, ub, -0.95 * B, 0.95 * B, 0.2 * B, Hd, '-3'); }
  if (banks > 1 && spec.layout === 'V') g.box(u0, Lb - 10, -vin * 0.55, vin * 0.55, 0.6 * B, inner(1, Hd)[2] - 0.1 * B, '-3');   // the valley's floor between the banks
  g.mat('engineBlock', C.block, 0.25).prism([0, 0, 0.05 * B], [u0 - 20, 0, 0.05 * B], rsec(1.5 * B, 1.3 * B, det === 0 ? 6 : 8, 2.6), [0, 0, 1]);
  g.mat('engineSump', C.block, 0.2).box(u0, Lb - 30, -0.95 * B, 0.95 * B, -1.45 * B, -0.55 * B, '+3');

  // ---- heads and cam covers ----
  for (const s of S) { const [ua, ub] = bankU(s);
    g.mat('engineHead', C.heads, 0.35); bankBox(s, ua, ub, -hw, hw, Hd, Hd + Hh, '-3');
    const sec = det === 0 ? null : rsec(0.36 * B, Hc / 2, 6, 3);
    if (det === 0) { g.mat('engineCamCover', C.covers, crinkle); bankBox(s, ua + 8, ub - 8, -hw * 0.92, hw * 0.92, Hd + Hh, topA, '-3'); }
    else for (const k of [-1, 1]) { const c0 = P(s, ua + 10, k * 0.5 * B, Hd + Hh + Hc / 2), c1 = P(s, ub - 10, k * 0.5 * B, Hd + Hh + Hc / 2);
      g.mat('engineCamCover', C.covers, crinkle).prism(c0, c1, sec!, ax(s));
      g.mat('engineAccent', C.accent, 0.4); const e0 = P(s, ua + 40, k * 0.5 * B - 0.11 * B, topA + 1.5), e1 = P(s, ub - 40, k * 0.5 * B - 0.11 * B, topA + 1.5), e2 = P(s, ub - 40, k * 0.5 * B + 0.11 * B, topA + 1.5), e3 = P(s, ua + 40, k * 0.5 * B + 0.11 * B, topA + 1.5); g.quad(e0, e1, e2, e3); }
    // the plugs' wells between the covers: coil packs at detail 2, a dark strip below that
    if (det === 2) { g.mat('engineCoils', '#121214', 0.2); for (let i = 0; i < nb; i++) { const u = cylU(s, i); bankBox(s, u - 0.22 * B, u + 0.22 * B, -0.12 * B, 0.12 * B, Hd + Hh - 4, topA + 6, '-3'); } }
    else if (det === 1) { g.mat('engineCoils', '#121214', 0.1); g.quad(P(s, ua + 15, -0.12 * B, Hd + Hh + 1), P(s, ub - 15, -0.12 * B, Hd + Hh + 1), P(s, ub - 15, 0.12 * B, Hd + Hh + 1), P(s, ua + 15, 0.12 * B, Hd + Hh + 1)); } }

  // ---- the accessory end: timing covers, pulleys, the belt ----
  const ue = Lb + 42;
  g.mat('engineTiming', C.covers === DEF.covers ? '#2a2b2e' : C.block, 0.25);
  g.box(Lb, ue, -1.1 * B, 1.1 * B, -1.3 * B, 0.7 * B, '-3');
  for (const s of S) { const [, ub] = bankU(s); bankBox(s, Lb - 2, Math.max(ue, ub + 30), -hw * 0.95, hw * 0.95, 0.2 * B, topA - 0.1 * B, '-3'); }
  const pul: { c: V; r: number }[] = [{ c: [0, 0, -0.35 * B], r: 0.85 * B }];
  if (det > 0) { pul.push({ c: P(1, 0, hw + 0.15 * B, 0.9 * Hd), r: 0.45 * B }); if (banks > 1 || det === 2) pul.push({ c: banks > 1 ? P(-1, 0, hw + 0.05 * B, 0.55 * Hd) : P(1, 0, -hw - 0.3 * B, 0.5 * Hd), r: 0.55 * B }); }
  if (det === 2) pul.push({ c: [0, 0, banks > 1 ? inner(1, Hd)[2] - 0.2 * B : 0.9 * Hd], r: 0.38 * B });
  const pu0 = ue, pu1 = ue + 0.38 * B;
  g.mat('enginePulley', STEEL, 0.6, 'metal'); for (const p of pul) g.cyl([pu0, p.c[1], p.c[2]], [pu1, p.c[1], p.c[2]], p.r, p === pul[0] ? seg : seg2, true, [0, 0, 1]);
  if (pul.length > 1) { g.mat('engineBelt', BELT, 0.1);   // the belt round the pulleys' outsides, in the order round their middle
    const mv = pul.reduce((a, p) => a + p.c[1], 0) / pul.length, mw = pul.reduce((a, p) => a + p.c[2], 0) / pul.length, ring = [...pul].sort((a, c) => Math.atan2(a.c[2] - mw, a.c[1] - mv) - Math.atan2(c.c[2] - mw, c.c[1] - mv));
    for (let i = 0; i < ring.length; i++) { const a = ring[i]!, c = ring[(i + 1) % ring.length]!, dv = c.c[1] - a.c[1], dw = c.c[2] - a.c[2], l = Math.hypot(dv, dw) || 1;
      let nv = dw / l, nw = -dv / l; const mx = (a.c[1] + c.c[1]) / 2 - mv, mz = (a.c[2] + c.c[2]) / 2 - mw; if (nv * mx + nw * mz < 0) { nv = -nv; nw = -nw; }
      const um = (pu0 + pu1) / 2; g.pipe([um, a.c[1] + nv * a.r, a.c[2] + nw * a.r], [um, c.c[1] + nv * c.r, c.c[2] + nw * c.r], 0.2 * B); } }

  // ---- the exhaust: a header from each port down and out to a collector along each bank, a heat shield over it ----
  const pipeT = 0.42 * B, colA = Hd * 0.45, colX = hw + 0.75 * B, turbos = spec.turbos ?? 0;
  for (const s of S) { const [ua, ub] = bankU(s), cu0 = ua + 10, cu1 = ub - 10;
    g.mat('engineHeader', C.pipes, 0.45, 'metal');
    if (det === 0 || (det === 1 && nb > 4)) g.obox(P(s, (cu0 + cu1) / 2, hw + 0.35 * B, Hd * 0.75), [1, 0, 0], (cu1 - cu0) / 2, acr(s), 0.35 * B, ax(s), 0.3 * Hd);   // one cast manifold
    if (det === 2 || (det === 1 && nb <= 4)) { for (let i = 0; i < nb; i++) { const u = cylU(s, i), toward = (cu0 + cu1) / 2 - u; g.path(det === 2 ? [P(s, u, hw - 2, Hd + 0.4 * Hh), P(s, u, hw + 0.55 * B, Hd + 0.2 * Hh), P(s, u + toward * 0.25, colX, colA)] : [P(s, u, hw - 2, Hd + 0.4 * Hh), P(s, u + toward * 0.25, colX, colA)], pipeT); } }
    if (det > 0) { g.mat('engineCollector', HOT, 0.35, 'metal').cyl(P(s, cu0, colX, colA), P(s, cu1, colX, colA), 0.33 * B, seg2 > 6 ? 6 : 5, true);
      g.mat('engineHeatShield', SHIELD, 0.8, 'metal'); bankBox(s, cu0 + 15, cu1 - 15, colX - 0.45 * B, colX + 0.45 * B, colA + 0.4 * B, colA + 0.46 * B); } }

  // ---- turbos beside the collectors, each piped up to an intercooler and on to the plenum ----
  const turboAt: V[] = [];
  if (turbos > 0) { const per = Math.ceil(turbos / S.length);
    for (const s of S) for (let k = 0; k < per && turboAt.length < turbos; k++) { const [ua, ub] = bankU(s), u = per === 1 ? (ua + ub) / 2 : ua + (ub - ua) * (0.22 + 0.56 * k / (per - 1));
      const c = P(s, u, colX + 0.55 * B, colA + 0.55 * B); turboAt.push(c);
      if (det < 2) { g.mat('engineTurbo', TURBO, 0.5, 'metal').cyl([c[0] - 0.5 * B, c[1], c[2]], [c[0] + 0.5 * B, c[1], c[2]], 0.55 * B, det === 0 ? 5 : 6, true); continue; }
      g.mat('engineTurbo', HOT, 0.4, 'metal').cyl([c[0] - 0.55 * B, c[1], c[2]], [c[0], c[1], c[2]], 0.5 * B, 7, true);     // the turbine's housing
      g.mat('engineTurbo', TURBO, 0.55, 'metal').cyl([c[0], c[1], c[2]], [c[0] + 0.5 * B, c[1], c[2]], 0.56 * B, 7, true); } }   // the compressor's

  // ---- the intake ----
  const plTop = camTop + (spec.plenum === 'single' ? 0.75 * B : 0.55 * B);
  const plenumMat = () => g.mat('enginePlenum', C.plenum, crinkle);
  const labels: [V, V, V, V][] = [];
  const kind = spec.plenum ?? (banks > 1 ? 'single' : 'twin');
  const pl0 = u0 + 0.15 * pitch, pl1 = Lb - 0.1 * pitch;
  const runnerEnd = (s: number, i: number) => P(s, cylU(s, i), -hw + 2, Hd + 0.55 * Hh);
  let tbAt: V[] = [];
  if (kind === 'single' || banks === 1) { const hwP = banks > 1 ? Math.max(1.3 * B, vin * 0.95) : 0.9 * B, hh = (plTop - camTop) * 0.5 + 0.25 * B, wc = plTop - hh, vc = banks > 1 ? 0 : -(hw + 0.7 * B);
    plenumMat().prism([pl0, vc, wc], [pl1, vc, wc], rsec(hwP, hh, det === 0 ? 6 : det === 1 ? 10 : 18, 4.5), [0, 0, 1]);
    labels.push([[pl0 + 0.25 * (pl1 - pl0), vc - hwP * 0.4, plTop + 1.5], [pl0 + 0.75 * (pl1 - pl0), vc - hwP * 0.4, plTop + 1.5], [pl0 + 0.75 * (pl1 - pl0), vc + hwP * 0.4, plTop + 1.5], [pl0 + 0.25 * (pl1 - pl0), vc + hwP * 0.4, plTop + 1.5]]);
    if (det > 0) { g.mat('engineRunner', C.plenum, crinkle); for (const s of S) for (let i = 0; i < nb; i++) { const e = runnerEnd(s, i), sv = banks > 1 ? s : 1; const a: V = [e[0], vc + sv * hwP * 0.7, wc - hh * 0.3];
        g.path(det === 1 ? [a, e] : spec.cylinders <= 8 ? [a, [e[0], a[1] + (e[1] - a[1]) * 0.3, a[2] - (a[2] - e[2]) * 0.55], [e[0], a[1] + (e[1] - a[1]) * 0.75, e[2] + (a[2] - e[2]) * 0.12], e] : [a, [e[0], (e[1] + a[1]) / 2, (e[2] + wc) / 2 - 0.1 * B], e], 0.45 * B); } }
    tbAt = [[pl1, vc, wc]]; }
  else { const sec = rsec(0.5 * B, 0.36 * B, det === 0 ? 6 : det === 1 ? 8 : 10, 3.5);
    for (const s of S) { const vc = kind === 'runners' ? s * vin * 0.42 : s * Math.max(vin * 0.78, 0.7 * B), wc = plTop - 0.36 * B;
      plenumMat().prism([pl0, vc, wc], [pl1, vc, wc], sec, [0, 0, 1]);
      labels.push([[pl0 + 0.2 * (pl1 - pl0), vc - 0.2 * B, plTop + 1.5], [pl0 + 0.8 * (pl1 - pl0), vc - 0.2 * B, plTop + 1.5], [pl0 + 0.8 * (pl1 - pl0), vc + 0.2 * B, plTop + 1.5], [pl0 + 0.2 * (pl1 - pl0), vc + 0.2 * B, plTop + 1.5]]);
      if (det > 0) { g.mat('engineRunner', kind === 'runners' ? CHROME : C.plenum, kind === 'runners' ? 0.75 : crinkle, kind === 'runners' ? 'metal' : 'plain');
        for (let i = 0; i < nb; i++) { const e = runnerEnd(s, i), arc: V = kind === 'runners' ? [e[0], (vc + e[1]) / 2 + s * 0.15 * B, plTop + 0.05 * B] : [e[0], (vc + e[1]) / 2, (wc + e[2]) / 2];
          const a: V = [e[0], vc + s * 0.3 * B, wc], pts: V[] = det === 1 ? [a, e] : spec.cylinders <= 8 ? [a, [(a[0] + arc[0]) / 2, (a[1] + arc[1]) / 2, Math.max(a[2], arc[2]) + 0.05 * B], arc, e] : [a, arc, e];
          g.path(pts, kind === 'runners' ? 0.38 * B : 0.42 * B); } }
      tbAt.push([pl1, vc, wc]); } }
  if (spec.colours?.label !== undefined || spec.label) { g.mat('engineLabel', C.label, 0.3); for (const q of labels) g.quad(...q); }
  // throttle bodies at the accessory end of each plenum; an airbox between twin plenums (none with turbos: intercoolers instead)
  g.mat('engineThrottle', STEEL, 0.7, 'metal'); for (const t of det === 0 ? tbAt.slice(0, 1) : tbAt) g.cyl(t, [t[0] + 0.55 * B, t[1], t[2]], 0.38 * B, seg2, true);
  if (det > 0 && kind !== 'single' && banks > 1 && turbos === 0) { const ab0 = Lb - 1.4 * pitch, ab1 = ue + 0.2 * B;
    g.mat('engineAirbox', '#18181a', 0.15).box(ab0, ab1, -vin * 0.55, vin * 0.55, camTop - 0.1 * B, plTop + 0.2 * B, '-3');
    g.mat('engineAirbox', '#2b2b2e', 0.1).box(ab0 + 0.2 * B, ab1 - 0.2 * B, -vin * 0.42, vin * 0.42, plTop + 0.2 * B, plTop + 0.32 * B, '-3'); }

  if (det > 0 && kind === 'single' && turbos === 0 && (spec.superchargers ?? 0) === 0) { const t = tbAt[0]!, tip: V = [t[0] + 0.55 * B, t[1], t[2]], side = banks > 1 ? -1 : 1, box: V = [ue + 0.1 * B, side * (vin + 0.2 * B), camTop + 0.15 * B];
    g.mat('engineHose', HOSE, 0.15); if (det === 2) g.prism(tip, [tip[0] + 0.7 * B, tip[1], tip[2]], circle(0.36 * B, 10), [0, 0, 1], false).prism([tip[0] + 0.7 * B, tip[1], tip[2]], box, circle(0.36 * B, 10), [0, 0, 1], false); else g.pipe(tip, box, 0.6 * B);
    g.mat('engineAirbox', '#18181a', 0.15).box(box[0] - 1.3 * B, box[0] + 0.5 * B, box[1] - side * 0.1 * B, box[1] + side * 1.6 * B, box[2] - 0.6 * B, box[2] + 0.5 * B, '-3'); }
  if (det === 2 && spec.cylinders <= 8) { g.mat('engineAlternator', '#9c9fa4', 0.45, 'metal'); for (const p of pul.slice(1, 3)) g.cyl([Lb - 1.6 * B, p.c[1], p.c[2]], [pu0 - 2, p.c[1], p.c[2]], p.r * 1.35, 10, true); }
  // ---- forced induction plumbing ----
  if (turboAt.length) { const icU = Math.min(Lb + 0.2 * B, (u0 + Lb) / 2 + nb * pitch * 0.45);
    for (const s of S) { const ic: V = [icU - 0.6 * B, s * (colX + 0.2 * B), camTop - 0.2 * B];   // an intercooler each side, high at the accessory end
      g.mat('engineIntercooler', '#4b4f55', 0.45, 'metal').box(ic[0] - 1.1 * B, ic[0] + 0.9 * B, ic[1] - 0.55 * B, ic[1] + 0.55 * B, ic[2] - 0.35 * B, ic[2] + 0.35 * B);
      if (det === 0) continue;
      g.mat('engineBoostPipe', '#c9cbcf', 0.75, 'metal');
      for (const t of turboAt.filter(t => Math.sign(t[1]) === s)) g.path(det === 2 ? [[t[0] + 0.5 * B, t[1], t[2]], [t[0] + 0.5 * B, t[1], ic[2] - 0.35 * B], [ic[0] - 1.1 * B, ic[1], ic[2]]] : [[t[0] + 0.5 * B, t[1], t[2]], [ic[0] - 1.1 * B, ic[1], ic[2]]], 0.36 * B);
      const tb = tbAt.find(t => Math.sign(t[1]) === s) ?? tbAt[0]!; g.path(det === 2 ? [[ic[0] + 0.9 * B, ic[1], ic[2]], [tb[0] + 0.55 * B, ic[1] * 0.75, tb[2]], [tb[0] + 0.55 * B, tb[1], tb[2]]] : [[ic[0] + 0.9 * B, ic[1], ic[2]], [tb[0] + 0.55 * B, tb[1], tb[2]]], 0.4 * B); } }
  const sc = spec.superchargers ?? 0;
  if (sc > 0) { const len0 = Lb - u0 - 0.3 * pitch, wc = plTop + 0.45 * B;
    for (let k = 0; k < sc; k++) { const vc = sc === 1 ? 0 : (k - (sc - 1) / 2) * 1.5 * B;
      g.mat('engineBlower', C.plenum === DEF.plenum ? STEEL : C.plenum, 0.5, 'metal').prism([u0 + 0.3 * pitch, vc, wc], [u0 + 0.3 * pitch + len0, vc, wc], rsec(0.65 * B, 0.45 * B, det === 0 ? 6 : 12, 3), [0, 0, 1]);
      g.mat('enginePulley', STEEL, 0.6, 'metal').cyl([ue, vc, wc], [pu1, vc, wc], 0.4 * B, seg2, true);
      g.mat('engineBelt', BELT, 0.1).pipe([(ue + pu1) / 2, vc, wc + 0.4 * B], [(ue + pu1) / 2, 0, -0.35 * B + 0.85 * B], 0.2 * B); } }

  // ---- details at detail 2: fuel rails, a coolant crossover, the oil filler, the dipstick ----
  if (det === 2) {
    g.mat('engineFuelRail', STEEL, 0.7, 'metal'); for (const s of S) { const [ua, ub] = bankU(s), a = P(s, ua + 20, -hw - 0.15 * B, Hd + 0.85 * Hh), c = P(s, ub - 20, -hw - 0.15 * B, Hd + 0.85 * Hh); g.pipe(a, c, 0.16 * B); }
    g.mat('engineHose', HOSE, 0.15); g.path([[Lb - 0.2 * B, S.length > 1 ? -vin * 0.6 : -hw, camTop - 0.25 * B], [ue + 0.1 * B, 0, camTop - 0.35 * B], [ue + 0.1 * B, S.length > 1 ? vin * 0.6 : hw * 0.4, camTop - 0.25 * B]], 0.28 * B);
    g.mat('engineFiller', '#d0c020', 0.4); { const c = P(1, cylU(1, nb - 1), 0.5 * B, topA); g.cyl(c, add(c, mul(ax(1), 0.25 * B)), 0.28 * B, 6, true, [1, 0, 0]); }
    g.mat('engineFiller', '#e2a21a', 0.4); { const c = P(S[S.length - 1]!, cylU(S[S.length - 1]!, 0), hw + 0.2 * B, Hd * 0.9); g.pipe(c, add(c, [0, 0, 0.35 * B]), 0.12 * B, true); } }

  // ---- the brace: polished, over the top, across the car ----
  const dir = opts.dir ?? 'x', across = dir.endsWith('y');   // a transverse engine's crank runs across the car: the brace then runs along it
  const braceOn = opts.brace ?? det > 0;
  // ---- size: the natural bounds, the scale to fit the room ----
  const all = () => g.g.flatMap(q => q.t);
  let lo: V = [Infinity, Infinity, Infinity], hi: V = [-Infinity, -Infinity, -Infinity];
  const bounds = () => { lo = [Infinity, Infinity, Infinity]; hi = [-Infinity, -Infinity, -Infinity]; for (const p of all()) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k]!, p[k]!); hi[k] = Math.max(hi[k]!, p[k]!); } };
  bounds();
  if (braceOn) { const z = hi[2] + 0.3 * B, t = 0.24 * B; g.mat('engineBrace', CHROME, 0.85, 'metal');
    if (across) { g.prism([Math.max(lo[0], 0), 0, z], [hi[0], 0, z], rsec(t * 0.8, t * 0.5, 6, 3), [0, 0, 1]); for (const u of [Math.max(lo[0], 0) + t, hi[0] - t]) g.box(u - t, u + t, -1.4 * t, 1.4 * t, z - 0.5 * t, z + 0.7 * t); }
    else { const uc = (Lb + u0) / 2, ym = Math.max(-lo[1], hi[1]); g.prism([uc, -ym, z], [uc, ym, z], rsec(t * 0.8, t * 0.5, 6, 3), [0, 0, 1]); for (const y of [-ym + t, ym - t]) g.box(uc - 1.4 * t, uc + 1.4 * t, y - t, y + t, z - 0.5 * t, z + 0.7 * t); }
    bounds(); }
  const hwid = Math.max(-lo[1], hi[1]), nat = { len: hi[0] - Math.min(0, lo[0]), wid: 2 * hwid, hgt: hi[2] - lo[2] };
  const bx = opts.box, scale = bx ? Math.min(1, bx.len / nat.len, bx.wid / nat.wid, bx.hgt / nat.hgt) : 1;
  // ---- into the car: scaled about the crank's end, turned to `dir`, emitted part by part ----
  const toCar = (p: V): V => { const u = p[0] * scale, v = p[1] * scale, w = p[2] * scale;
    switch (dir) { case '-x': return [o[0] - u, o[1] - v, o[2] + w]; case 'y': case '+y': return [o[0] - v, o[1] + u, o[2] + w]; case '-y': return [o[0] + v, o[1] - u, o[2] + w]; default: return [o[0] + u, o[1] + v, o[2] + w]; } };
  let n = 0; const mn: V = [Infinity, Infinity, Infinity], mx: V = [-Infinity, -Infinity, -Infinity];
  for (const q of g.g) { if (!q.t.length) continue; b.name(q.name).mat(q.col, q.gloss, q.kind);
    for (let i = 0; i < q.t.length; i += 3) { const a = toCar(q.t[i]!), c = toCar(q.t[i + 1]!), d = toCar(q.t[i + 2]!); if (area(a, c, d) < 0.5) continue; b.tri(a, c, d); n++;
      for (const p of [a, c, d]) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k]!, p[k]!); mx[k] = Math.max(mx[k]!, p[k]!); } } }
  return { tris: n, scale, size: { len: nat.len * scale, wid: nat.wid * scale, hgt: nat.hgt * scale }, min: mn, max: mx }; }

/** the engines of the mid-engined cars whose engines show (approximate colours, from photographs' general look) */
export const ENGINES: Record<string, EngineSpec> = {
  /** Honda NSX (1990): C30A, transverse 3.0 V6 at 90 degrees behind the seats; black plenum with a light plate, silver block, black covers with a red stripe */
  nsx: { layout: 'V', cylinders: 6, bankDeg: 90, litres: 3.0, transverse: true, plenum: 'single', colours: { block: '#a4a7ab', heads: '#8f9296', covers: '#17171a', plenum: '#1b1b1e', accent: '#c8202a', label: '#d8d8d0' }, label: 'VTEC' },
  /** Ferrari F355 (1994): F129B, longitudinal 3.5 V8 at 90 degrees under a louvred cover; red crinkle-finish intakes, silver block */
  f355: { layout: 'V', cylinders: 8, bankDeg: 90, litres: 3.5, plenum: 'twin', crinkle: true, colours: { block: '#b0b2b5', heads: '#9c9ea2', covers: '#a8191c', plenum: '#b31a1c', accent: '#1a1a1a', label: '#d6c25a' }, label: 'FERRARI' },
  /** Bugatti EB110 (1991): longitudinal 3.5 V12 at 60 degrees, four turbos, under a glass cover; black and silver */
  eb110: { layout: 'V', cylinders: 12, bankDeg: 60, litres: 3.5, turbos: 4, plenum: 'twin', colours: { block: '#a9acb0', heads: '#b4b7bb', covers: '#1a1a1d', plenum: '#c3c6ca', accent: '#2a55b0', label: '#1b1b1e' }, label: 'BUGATTI' },
  /** Lamborghini Diablo (1990): longitudinal 5.7 V12 at 60 degrees under louvres; black plenums with red lettering, red cam covers */
  diablo: { layout: 'V', cylinders: 12, bankDeg: 60, litres: 5.7, plenum: 'runners', colours: { block: '#9fa2a6', heads: '#8e9195', covers: '#a01a1c', plenum: '#151517', accent: '#151517', label: '#c21d20' }, label: 'LAMBORGHINI' },
};
