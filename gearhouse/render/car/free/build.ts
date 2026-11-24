// The free body assembled (docs/systems/106): the skin from the control curves, the fixtures placed on it (the cut-in
// ones open their holes before the skin is laid, so the shell closes round them), the panel lines, the wheels in their
// arches, a dark cabin behind the glass; one Mesh out, with the shell's closure and what each fixture did.
import { Build, type Mesh } from '../mesh';
import { add, cross, mix, sub, un, type V } from '../kit/geom';
import { Body, closure, COLOURS, JK, JLIP, M, type Colours } from './body';
import { placeFixture, type Placed, type FixtureReport } from './fixture';
import type { Silhouette } from './curves';

export interface FreeCar { mesh: Mesh; body: Body; closure: ReturnType<typeof closure>; fixtures: FixtureReport[] }
export interface FreeOpts { colours?: Partial<Colours>; fixtures?: Placed[]; spin?: number; seams?: boolean; cabin?: boolean }

export function buildFree(sil: Silhouette, o: FreeOpts = {}): FreeCar { const col = { ...COLOURS, ...o.colours }, body = new Body(sil, col), parts: ((b: Build) => void)[] = [], reports: FixtureReport[] = [];
  for (const f of o.fixtures ?? []) reports.push(placeFixture(body, f, parts));
  body.emitSkin();
  const b = new Build(), sh = body.shell, P = sh.pos;
  // the shell, one part per material (so the outline falls between paint and glass, not across every cell)
  const byMat = new Map<number, number[]>(); for (let t = 0; t < sh.tmat.length; t++) { const m = sh.tmat[t]!; const l = byMat.get(m); if (l) l.push(t); else byMat.set(m, [t]); }
  for (const [m, ts] of byMat) { const mt = sh.mats[m]!; b.name(mt.name).mat(mt.colour, mt.gloss, mt.kind); for (const t of ts) b.tri(P[sh.tri[t * 3]!]!, P[sh.tri[t * 3 + 1]!]!, P[sh.tri[t * 3 + 2]!]!); }
  if (o.seams !== false) seams(b, body);
  if (o.cabin !== false) cabin(b, body);
  for (const f of parts) f(b);
  wheels(b, body, o.spin ?? 0);
  return { mesh: b.mesh(body.L), body, closure: closure(sh), fixtures: reports }; }

/** a thin dark ribbon laid on the skin through the points (s, a), on both sides */
export function ribbon(b: Build, body: Body, path: [number, number][], w = 9, lift = 2.5, colour = '#141414'): void {
  const pts = path.map(([s, a]) => body.point(s, a)), nr = path.map(([s, a]) => body.normal(s, a));
  const e = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)]!, c = pts[Math.min(pts.length - 1, i + 1)]!, n = nr[i]!, sd = un(cross(n, sub(c, a))), o = add(p, [n[0] * lift, n[1] * lift, n[2] * lift]);
    return [add(o, [sd[0] * w / 2, sd[1] * w / 2, sd[2] * w / 2]), sub(o, [sd[0] * w / 2, sd[1] * w / 2, sd[2] * w / 2])] as [V, V]; });
  b.name('seam').mat(colour, 0.05);
  for (const sg of [1, -1]) for (let i = 0; i + 1 < e.length; i++) { const m = (p: V): V => [p[0], p[1] * sg, p[2]]; b.quad(m(e[i]![0]), m(e[i + 1]![0]), m(e[i + 1]![1]), m(e[i]![1])); } }
const run = (s0: number, s1: number, a: number | ((s: number) => number), n = 10): [number, number][] => Array.from({ length: n + 1 }, (_, k) => { const s = s0 + (s1 - s0) * k / n; return [s, typeof a === 'number' ? a : a(s)]; });
const across = (s: number, a0: number, a1: number, n = 8): [number, number][] => Array.from({ length: n + 1 }, (_, k) => [s, a0 + (a1 - a0) * k / n]);

/** the panel lines: the doors' shut lines, the bonnet's and the engine lid's, the glasshouse's pillars and rails */
function seams(b: Build, body: Body): void { const m = body.sil.marks, aK = JK / M, aSill = (JLIP - 1.4) / M, aB = 4.6 / M, aE = 3 / M;
  const [d0, d1] = m.door, s0 = Math.max(0.12, Math.min(0.3, m.screen * 0.15));
  ribbon(b, body, across(d0, aK + 0.01, aSill)); ribbon(b, body, across(d1, aK + 0.01, aSill)); ribbon(b, body, run(d0, d1, aSill, 8));
  // the bonnet: across its front, along its sides, across at the cowl
  const sb = m.screen - 0.06; ribbon(b, body, run(s0, sb, aB, 12)); ribbon(b, body, across(s0, 0, aB, 5)); ribbon(b, body, across(sb, 0, aB, 5));
  // the engine lid behind the glass
  const l0 = Math.min(2.85, m.glass + 0.05), l1 = 2.9; if (l1 - l0 > 0.08) { ribbon(b, body, run(l0, l1, aB, 8)); ribbon(b, body, across(l0, 0, aB, 5)); ribbon(b, body, across(l1, 0, aB, 5)); }
  // the glasshouse: the A pillar along the screen's edge, the roof's rails, the rear pillar, the glass's foot
  ribbon(b, body, run(m.screen + 0.01, m.roofF, aE, 8), 34, 3); ribbon(b, body, run(m.roofF, m.roofB, aE, 8), 22, 3);
  ribbon(b, body, run(m.roofB, Math.min(m.glass, m.sideEnd + 0.4), aE, 8), 30, 3); ribbon(b, body, run(m.screen + 0.01, m.sideEnd, (JK - 0.1) / M, 12), 16, 2.5);
  ribbon(b, body, across(m.sideEnd, aE, (JK - 0.05) / M, 5), 30, 3); }

/** a dark tub behind the glass, two seats */
function cabin(b: Build, body: Body): void { const m = body.sil.marks, x0 = body.x(m.screen + 0.05), x1 = body.x(Math.min(m.sideEnd, m.roofB + 0.1)), S = body.sect((m.screen + m.roofB) / 2), w = S.pts[JK]![1] * 0.86, zf = S.pts[M]![2] + 60, zt = S.pts[JK]![2] - 30;
  b.name('cabin').mat('#1a1918', 0.05).box(x0, x1, -w, w, zf, zt); const xs = body.x(m.roofF + (m.roofB - m.roofF) * 0.45), roof = body.sect(m.roofF + (m.roofB - m.roofF) * 0.45).pts[0]![2];
  for (const sg of [1, -1]) { b.name('seat').mat(COLOURS.seat, 0.1); const y = sg * w * 0.45; b.box(xs - 330, xs + 40, y - 200, y + 200, zt - 10, zt + 40); b.box(xs, xs + 90, y - 190, y + 190, zt + 30, Math.min(zt + 380, roof - 140)); } }

/** the road wheels: the tyre turned about the axle, a dark disc behind a bright five-spoke face */
function wheels(b: Build, body: Body, spin: number): void { for (const w of body.wheels) for (const sg of [1, -1]) { const y = sg * w.y, h = w.w / 2, o: V = [w.x, y, w.r], out = sg;
  b.name('wheel').mat(COLOURS.tyre, 0.1, 'tyre').lathe('y', o, [[-h, w.rim], [-h, w.r * 0.9], [-h + 22, w.r], [h - 22, w.r], [h, w.r * 0.9], [h, w.rim]], 20, false);
  b.name('rim').mat('#2a2a2c', 0.1).lathe('y', o, [[h * out - 30 * out, w.rim], [h * out - 60 * out, w.rim * 0.2]], 16);
  b.mat(COLOURS.rim, 0.7, 'metal').lathe('y', o, [[-h * out, w.rim], [-h * out + 10 * out, w.rim * 0.3]], 12);
  b.name('rim').mat(COLOURS.rim, 0.7, 'metal').lathe('y', o, [[h * out - 4 * out, w.rim], [h * out - 18 * out, w.rim * 0.92]], 18);
  const c: V = [w.x, y + out * (h - 22), w.r]; b.lathe('y', [c[0], c[1], c[2]], [[0, w.rim * 0.2], [out * 8, w.rim * 0.12]], 10);
  for (let k = 0; k < 5; k++) { const a = spin + k * Math.PI * 2 / 5, e: V = [w.x + Math.cos(a) * w.rim * 0.9, y + out * (h - 30), w.r + Math.sin(a) * w.rim * 0.9]; b.bar(mix(c, e, 0.12), e, 46, 22); } } }
