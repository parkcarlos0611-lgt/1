// The number plates placed freely on the 959's skin (docs/systems/115 P1a, the pilot of the free parts, §5): a plate's
// place (core/placed.ts: surface coordinates, a turn, a tilt, a size) evaluated on the shell's skin (render/car/skin.ts)
// and checked against the plate's rules, and the plate drawn there. The plate itself stays flat (a plate is a flat
// plate); where the skin under it is curved, the black plinth behind it grows into a bracket whose sides run back to
// the skin, so no gap shows round it. The rules (the user's choice):
//   - the face it sits on looks forward (the front plate) or back (the rear one) within 35 degrees of the car's axis;
//   - the bracket fills at most 70 mm (a place more curved than that is refused);
//   - it covers no lamp, no glass, no arch lip or wheel well, and not the other plate; and it stays on the body.
// A plate near the centre line snaps onto it (a plate has no mirror twin: one plate, on the line or off it).
import type { Build, V } from '../mesh';
import { plate, type PlateText } from './parts';
import type { Mark } from './sockets';
import { partFrame, probe, rectPoints, footprintsMeet, vdot, vmadd, type Skin, type PartFrame, type SkinTag, type SurfaceAt } from '../skin';
import type { Placed, PlateId as PlacedId } from '../../../core/placed';

/** the plate's size (the old Korean plate's, mm) and its plinth's margin round it */
export const PLATE_W = 335, PLATE_H = 170, PLINTH: readonly [number, number] = [22, 16];
/** the rules: the angle off the car's axis (degrees), the deepest bracket (mm), the centre line's pull (mm) */
export const PLATE_RULES = { angle: 35, bracket: 70, snap: 30 } as const;
/** the way each plate looks: the front one forward (the files' -x), the rear one back */
export const PLATE_AXIS: Record<PlacedId, V> = { plateF: [-1, 0, 0], plateR: [1, 0, 0] };
/** a plate on the skin as its place gives it: its frame (its centre on the skin, its normal, across and up), its size,
 *  its face's height over the plane there (over the highest skin under it), the bracket's outline and where each side
 *  ends, and whether the place keeps the rules (`why` the first rule it breaks, in the builder's words) */
export interface PlateFit { id: PlacedId; F: PartFrame; s: number; lift: number; rim: [number, number][]; to: number[]; gap: number; ok: boolean; why: string | null }
/** what is fitted on the car round the plate (a lamp's lens is only there when the lamps are) */
const BAD_MAT = new Set(['glass', 'lens', 'lamp', 'amber']), BAD_PANEL = /^(archLip|wheelWell|floor|wingSlot)$/;
const badTag = (t: SkinTag) => BAD_MAT.has(t.mat ?? '') ? '램프나 유리와 겹칩니다' : BAD_PANEL.test(t.panel) ? '바퀴 아치·바닥에는 붙일 수 없습니다' : null;

/** a plate at its place on this skin (null: the place is not on this skin at all) */
export function fitPlate(skin: Skin, p: Placed, others: readonly PlateFit[] = []): PlateFit | null { const id = p.id as PlacedId;
  const pt = skin.at(p.at); if (!pt) return null;
  const F = partFrame(pt.p, pt.n, p.rot, p.tilt), s = p.scale, hw = (PLATE_W / 2 + PLINTH[0]) * s, hh = (PLATE_H / 2 + PLINTH[1]) * s;
  const { rim, inside } = rectPoints(hw, hh, 50), face = rectPoints(PLATE_W / 2 * s, PLATE_H / 2 * s, 40).inside;
  const R = probe(skin, F, rim), I = probe(skin, F, inside), Q = probe(skin, F, face);
  const hs = [...R, ...I].filter(Boolean).map(r => r!.h), lift = Math.max(1, (hs.length ? Math.max(...hs) : 0) + 1.5);
  // the bracket's sides: from the plinth's face back to a little under the skin (a point off the body: as deep as the deepest found)
  const deep = Math.min(...[...R].filter(Boolean).map(r => r!.h), 0), to = R.map(r => (r ? r.h : deep) - 4), gap = lift - Math.min(...[...R, ...I].map(r => r ? r.h : -Infinity));
  const cos = vdot(pt.n, PLATE_AXIS[id]), why = cos < Math.cos(PLATE_RULES.angle * Math.PI / 180) ? `${id === 'plateF' ? '앞을' : '뒤를'} 보는 면(차 축에서 ${PLATE_RULES.angle}° 안)에만 붙일 수 있습니다`
    : [...R, ...I, ...Q].some(r => !r) ? '판이 차체 밖으로 나갑니다'
    : gap > PLATE_RULES.bracket ? `면이 너무 굽었습니다 (받침 ${Math.round(gap)} mm, 최대 ${PLATE_RULES.bracket} mm)`
    : Q.map(r => badTag(r!.tag)).find(Boolean) ?? (Q.some(r => !r!.at) ? '바퀴 아치·바닥에는 붙일 수 없습니다' : null)
    ?? (others.some(o => o.id !== id && footprintsMeet({ F, hw, hh }, { F: o.F, hw: (PLATE_W / 2 + PLINTH[0]) * o.s, hh: (PLATE_H / 2 + PLINTH[1]) * o.s })) ? '다른 번호판과 겹칩니다' : null);
  return { id: id, F, s, lift, rim, to, gap, ok: !why, why }; }

/** the surface place of the car's own plate (its mark: render/car/p959/sockets.ts), found by a ray along its normal */
export function stockPlace(skin: Skin, m: Mark): SurfaceAt | null { const r = skin.hit(vmadd(m.o, m.n, 300), [-m.n[0], -m.n[1], -m.n[2]], 700); return r?.at ?? null; }
/** a place moved onto the centre line when it is within the pull of it: the skin under the same point at y 0, by a ray
 *  along the place's normal (null: not near it, or no skin there) */
export function snapCentre(skin: Skin, a: SurfaceAt): SurfaceAt | null { const pt = skin.at(a); if (!pt || Math.abs(pt.p[1]) > PLATE_RULES.snap || pt.p[1] === 0) return null;
  const o: V = [pt.p[0] + pt.n[0] * 200, 0, pt.p[2] + pt.n[2] * 200], r = skin.hit(o, [-pt.n[0], 0, -pt.n[2]].map((x, _, l) => x / Math.hypot(...l)) as V, 500); return r?.at ?? null; }
/** a plate drawn at its fitted place: the plate, its frame and figures on its face, the plinth and its bracket behind */
export function drawPlate(b: Build, f: PlateFit, text?: PlateText): void {
  plate(b, { name: f.id, o: f.F.o, n: f.F.n, w: PLATE_W * f.s, h: PLATE_H * f.s }, text, { u: f.F.u, up: f.F.up, s: f.s, lift: f.lift, bracket: { rim: f.rim, to: f.to } }); }
