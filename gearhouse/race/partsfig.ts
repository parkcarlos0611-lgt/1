// The placed parts in the car's figures (docs/systems/115 P3, §5-7: what you see is the performance). Each free part
// fitted on a model body's skin (render/car/attach: P1's surface parts, P2's hole parts) carries its figures (its kind,
// its centre, its frontal and plan areas, a mass estimate, a wing's blade, a hole's open area); this file turns them
// into what the physics reads:
//   mass:    each part's mass at its place (its share along the axles, its height): race/design.ts massing() adds them to
//            the car's list, so the total, the front share and the centre of gravity move with them.
//   wings:   a blade of span b and chord c at an angle a (degrees), standing h off the deck: its area S = b c; its
//            aspect ratio b / c, end plates (the GT wing's plates, the stay wing's stays, the ring's hoop) counting it a
//            little longer; the lift slope of a finite wing, 2 pi / (1 + 2 / AR) a radian, from a cambered blade's 0.3 at
//            no angle, held under 1.5 (the stall: past 14 degrees its drag climbs instead); a blade low over the deck
//            works in the body's slow, turned air (0.55 of its lift on the deck, all of it from 300 mm up). Its drag:
//            the section's 0.025, the induced CL^2 / (pi 0.85 AR) and 0.02 for the stands and their meeting with the
//            blade. The lift acts at the part's place: shared by the axles by the lever (a wing behind the rear axle
//            takes a little off the front).
//   lips:    a front lip or splitter: its plan area (the blade out ahead of the face) a lift area at 1.0, its drag a tenth
//            of that and a little of its face.
//   surface: a mirror's frontal area at 0.5, the stick-on trim's (vents, louvres, markers, badges, handles, a garnish)
//            at 0.1 (most of it lies in the body's own flow), exhaust tips none (they stand in the wake).
//   holes:   their open area (the footprint times its open share, P2's `fig.open`), counted by how squarely it faces the
//            air (0.4 + 0.6 of how far its face looks forward) toward the cooling; the air taken through costs a little
//            drag (0.1 of the open area, more for a face looking forward). A lamp's hole has no opening.
// The body's own figures (race/design.ts: its real car's mass, drag and cooling) are the car with its own parts on, so
// what changes them is the difference: the parts placed less the stock set's parts the shell no longer draws (the
// 599's own mirrors, tips and crest go when `smalls` is off, its tail lamp band, intakes and lid grille when its
// `openings` are, its lamps when the lamp is 'none'; the N33's lump draws none of its own). The stock set on its stock
// places so comes out on the old figures exactly; taking a part off takes its mass and its drag off; a lump with no
// intakes has nothing to cool its engine. A design with no free parts on a body that still draws its own (every
// design before P1, the race's opponents, the stock N33 car) is not read here at all: its figures are unchanged.
import type { Design } from '../core/design';
import { MODEL_OWN, isModelBase } from '../core/design';
import { PART_KINDS, freeParts, type FreeId, type Placed } from '../core/placed';
import { modelSkin, modelFrame } from '../render/car/bodies';
import { fitAll, type PartFigures, type PartFit } from '../render/car/attach';
import { stockParts } from '../render/car/attach/stock';

const RHO = 1.2, G = 9.81, Q200 = 0.5 * RHO * (200 / 3.6) ** 2;
/** how much longer a wing's end plates make it read to the air */
const PLATES: Partial<Record<FreeId, number>> = { wingGT: 1.3, wingStay: 1.2, wingRing: 1.3 };
/** a wing's lift and drag areas (m²) from its blade (P1's `fig.wing`) */
export function wingAero(id: FreeId, w: NonNullable<PartFigures['wing']>): { clA: number; cdA: number; cl: number } {
  const S = w.span * w.chord / 1e6, AR = w.span / Math.max(40, w.chord) * (PLATES[id] ?? 1), slope = 2 * Math.PI / (1 + 2 / AR);
  const cl = Math.max(-0.3, Math.min(1.5, 0.3 + slope * w.aoa * Math.PI / 180)), eta = 0.55 + 0.45 * Math.min(1, Math.max(0, w.height) / 300);
  const cd = 0.025 + cl * cl / (Math.PI * 0.85 * AR) + 0.02 + Math.max(0, w.aoa - 14) * 0.01;
  return { clA: S * cl * eta, cdA: S * cd, cl }; }
/** a hole's opening as the cooling sees it (m²) */
const coolOf = (f: PartFigures) => (f.open ?? 0) * (0.4 + 0.6 * (f.facing ?? 0));
/** one part's own figures: kg, its lift area (m², down +), its drag area (m²), its opening toward the cooling (m²) */
export interface PartAero { mass: number; clA: number; cdA: number; cool: number }
export function partAero(f: PartFigures): PartAero {
  const g = PART_KINDS[f.id].group, out: PartAero = { mass: f.mass, clA: 0, cdA: 0, cool: 0 };
  if (f.wing) { const w = wingAero(f.id, f.wing); out.clA = w.clA; out.cdA = w.cdA; }
  else if (g === 'lip') { out.clA = f.plan; out.cdA = 0.1 * f.plan + 0.05 * f.frontal; }
  else if (g === 'mirror') out.cdA = 0.5 * f.frontal;
  else if (g === 'exhaust') out.cdA = 0;
  else if (f.open !== undefined) { out.cool = coolOf(f); out.cdA = (f.open ?? 0) * 0.1 * (0.3 + 0.7 * (f.facing ?? 0)); }
  else out.cdA = 0.1 * f.frontal;
  return out; }
/** the line the place bar shows for a part (docs/systems/115 P3): its mass, its downforce at 200 km/h, its drag
 *  against the car's (`cdA` the car's drag area now, m²), its opening */
export function partLine(f: PartFigures, cdA: number): string { const a = partAero(f), bits = [`+${a.mass < 1 ? a.mass.toFixed(1) : Math.round(a.mass)} kg`];
  if (Math.abs(a.clA) > 0.002) bits.push(`다운포스 ${a.clA >= 0 ? '+' : '−'}${Math.round(Math.abs(a.clA) * Q200 / G)} kg @200 km/h`);
  if (a.cdA > 0.0005 && cdA > 0) bits.push(`항력 +${(a.cdA / cdA * 100).toFixed(a.cdA / cdA < 0.01 ? 1 : 0)} %`);
  if (a.cool > 0) bits.push(`냉각 열림 ${Math.round(a.cool * 1e4)} cm²`);
  return bits.join(' · '); }

/** whether a design's figures read its placed parts: a model body with free parts on it, or a 599 whose shell no longer
 *  draws some of its own (the lump, the stock set of P2) */
export function readsParts(d: Design): boolean { if (!isModelBase(d.body.base)) return false; if (freeParts(d.body.parts).length) return true;
  if (d.body.base !== 'p959') return false; const m = { ...MODEL_OWN.p959, ...d.body.model }; return m.details === false || m.smalls === false || m.openings === false || m.lamp === 'none'; }
/** the stock set's parts the shell still draws itself (they are in the body's own figures): the 599's by its swaps */
function drawnByShell(d: Design, id: FreeId): boolean { if (d.body.base !== 'p959') return false; const m = { ...MODEL_OWN.p959, ...d.body.model }, g = PART_KINDS[id].group;
  if (g === 'mirror' || g === 'exhaust' || g === 'badge') return m.details !== false && m.smalls !== false;
  if (g === 'lamp') return m.lamp !== 'none';
  return m.details !== false && m.openings !== false; }

/** one part's share in the sums: its figures, its place as a share of the way from the front axle to the rear (0..1,
 *  past them outside) and its height (m), +1 placed or -1 the stock set's taken off */
interface Term { a: PartAero; f: number; z: number; k: 1 | -1 }
/** what the placed parts change: the masses at their places (kg; `f` the share along the axles, z m), the drag area,
 *  the lift areas on each axle (m²), and the cooling's opening against the stock set's (m², counted as the cooling sees it) */
export interface PartsEffect { mass: { m: number; f: number; z: number }[]; cdA: number; clF: number; clR: number; cool: number; coolStock: number;
  /** the parts as fitted (the builder's lines) */ terms: number }
const CACHE = new Map<string, PartsEffect | null>();
const fitsOf = (d: Design, ps: readonly Placed[]): PartFit[] => { const s = modelSkin(d); return s ? fitAll(s.skin, ps) : []; };
/** the placed parts' effect on a design's figures (null: the design does not read them, `readsParts`) */
export function partsEffect(d: Design): PartsEffect | null {
  if (!readsParts(d)) return null;
  const key = JSON.stringify([d.body.base, d.body.frame ?? null, d.body.model ?? null, d.body.glass ?? null, d.body.parts ?? null]);
  if (CACHE.has(key)) return CACHE.get(key)!;
  const fr = modelFrame(d), out = ((): PartsEffect | null => { if (!fr) return null;
    const along = (x: number) => (x - fr.axleF) / (fr.axleR - fr.axleF), terms: Term[] = [];
    // the parts placed: every surface part fitted (each is drawn, a broken rule shown in the builder), a hole part only cut
    for (const f of fitsOf(d, d.body.parts ?? [])) if (!f.hole || f.ok) terms.push({ a: partAero(f.fig), f: along(f.fig.at[0]), z: f.fig.at[2] / 1000, k: 1 });
    // the stock set on the shell the stock set is put on (its own openings flush, its own small parts off), its parts the
    // shell does not draw taken off; the cooling's reference is the whole set's
    const base = d.body.base as 'p959' | 'bnr33', bare: Design = { ...d, body: { ...d.body, parts: undefined, ...(base === 'p959' ? { model: { ...MODEL_OWN.p959, ...d.body.model, lamp: 'none', smalls: false, openings: false } } : {}) } };
    const sk = modelSkin(bare), stock = sk ? fitAll(sk.skin, stockParts(base, sk.skin, d.body.frame?.dims)) : []; let coolStock = 0, coolShell = 0;
    for (const f of stock) { if (f.hole && !f.ok) continue; const a = partAero(f.fig); coolStock += a.cool; if (drawnByShell(d, f.fig.id)) coolShell += a.cool; else terms.push({ a, f: along(f.fig.at[0]), z: f.fig.at[2] / 1000, k: -1 }); }
    const sum = (g: (t: Term) => number) => terms.reduce((s, t) => s + t.k * g(t), 0);
    return { mass: terms.map(t => ({ m: t.k * t.a.mass, f: t.f, z: t.z })), cdA: sum(t => t.a.cdA), clF: sum(t => t.a.clA * (1 - t.f)), clR: sum(t => t.a.clA * t.f),
      cool: coolShell + terms.filter(t => t.k > 0).reduce((s, t) => s + t.a.cool, 0), coolStock, terms: terms.filter(t => t.k > 0).length }; })();
  if (CACHE.size > 40) CACHE.clear(); CACHE.set(key, out); return out; }
