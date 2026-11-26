// The free body assembled (docs/systems/106): the skin from the control curves, the fixtures placed on it (the cut-in
// ones open their holes before the skin is laid, so the shell closes round them), the panel lines, the wheels in their
// arches, a dark cabin behind the glass; one Mesh out, with the shell's closure and what each fixture did.
import { Build, type Mesh } from '../mesh';
import { Emit } from '../kit/emit';
import { wheel as kitWheel } from '../kit/parts/wheel';
import type { Ctx } from '../kit/ctx';
import { NSX_KIT } from '../cars/nsx.kit';
import { F355_KIT } from '../cars/f355.kit';
import { EB110_KIT } from '../cars/eb110.kit';
import { add, cross, mix, sub, un, type V } from '../kit/geom';
import { Body, closure, COLOURS, JK, JLIP, M, type Colours } from './body';
import { placeFixture, type Placed, type FixtureReport } from './fixture';
import type { Silhouette } from './curves';

export interface FreeCar { mesh: Mesh; body: Body; closure: ReturnType<typeof closure>; fixtures: FixtureReport[] }
export interface FreeOpts { colours?: Partial<Colours>; fixtures?: Placed[]; spin?: number; seams?: boolean; cabin?: boolean }

export function buildFree(sil: Silhouette, o: FreeOpts = {}): FreeCar { const col = { ...COLOURS, ...o.colours }, body = new Body(sil, col), parts: ((b: Build) => void)[] = [], reports: FixtureReport[] = [];
  for (const f of o.fixtures ?? []) reports.push(placeFixture(body, f, parts));
  body.emitSkin();
  const e = new Emit(), b = e.b, sh = body.shell, P = sh.pos;
  // the shell, one part per material (so the outline falls between paint and glass, not across every cell)
  const byMat = new Map<number, number[]>(); for (let t = 0; t < sh.tmat.length; t++) { const m = sh.tmat[t]!; const l = byMat.get(m); if (l) l.push(t); else byMat.set(m, [t]); }
  for (const [m, ts] of byMat) { const mt = sh.mats[m]!; b.name(mt.name).mat(mt.colour, mt.gloss, mt.kind); for (const t of ts) b.tri(P[sh.tri[t * 3]!]!, P[sh.tri[t * 3 + 1]!]!, P[sh.tri[t * 3 + 2]!]!); }
  if (o.seams !== false) seams(b, body);
  if (o.cabin !== false) cabin(b, body);
  for (const f of parts) f(b);
  wheels(e, body, col.paint, o.spin ?? 0);
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
  ribbon(b, body, across(m.sideEnd, aE, (JK - 0.05) / M, 5), 30, 3);
  // the B pillar: a broad black post from the belt to the roof's rail behind the door
  if (m.door[1] < m.sideEnd - 0.03) ribbon(b, body, across(m.door[1] - 0.015, aE, (JK - 0.05) / M, 5), body.sil.roofBlack ? 95 : 60, 3.5, '#121212'); }

/** a dark tub behind the glass, two seats */
function cabin(b: Build, body: Body): void { const m = body.sil.marks, x0 = body.x(m.screen + 0.05), x1 = body.x(Math.min(m.sideEnd, m.roofB + 0.1)), S = body.sect((m.screen + m.roofB) / 2), w = S.pts[JK]![1] * 0.86, zf = S.pts[M]![2] + 60, zt = S.pts[JK]![2] - 30;
  b.name('cabin').mat('#1a1918', 0.05).box(x0, x1, -w, w, zf, zt); const xs = body.x(m.roofF + (m.roofB - m.roofF) * 0.45), roof = body.sect(m.roofF + (m.roofB - m.roofF) * 0.45).pts[0]![2];
  for (const sg of [1, -1]) { b.name('seat').mat(COLOURS.seat, 0.1); const y = sg * w * 0.45; b.box(xs - 330, xs + 40, y - 200, y + 200, zt - 10, zt + 40); b.box(xs, xs + 90, y - 190, y + 190, zt + 30, Math.min(zt + 380, roof - 140)); } }

/** the road wheels: the kit's wheel part (render/car/kit/parts/wheel.ts) with the look of the car the silhouette came from */
const KITS = { nsx: NSX_KIT, f355: F355_KIT, eb110: EB110_KIT };
function wheels(e: Emit, body: Body, paint: string, spin: number): void { const k = KITS[body.sil.wheel ?? 'nsx'], x = { e, c: { ...k.colours, paint }, spin } as unknown as Ctx;
  for (const w of body.wheels) for (const sg of [1, -1] as const) kitWheel(x, { x: w.x, r: w.r, y: w.y, w: w.w, rim: w.rim }, sg, w.front, k.wheel); }
