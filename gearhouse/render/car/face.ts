// The car's face in slots (alpha 0.12, E2; docs/systems/101 section 10): the prow's plan, the bumper, the grille, the
// head lamps and the auxiliary lamps of a design (core/design.ts Face), each laid over a base's kit on its own. A base's
// own value in a slot changes nothing (its own car comes out exactly). The others:
//  - the prow: the base's nose patches (the plan of the top's edge and the bumper's plan with it);
//  - the bumper: a style's lines (STYLE: each line's share of the way from the bumper's top line down to its lip, and how
//    far it stands from the top line) between the base's own top line and lip;
//  - the grille and the auxiliary lamps: cut from the bumper's cells. Which lines they lie between is the bumper's
//    (STYLE's zones: the lamp strip's line, the mouth's, the outer intakes', the fog lamps' block), which rows across
//    the base's (ROWS): so every grille and every lamp fits every bumper, re-fitted (a grille's bars and slats, a fog
//    lamp's centre and size are measured on the bumper built). Pockets are kept a row or a line apart (two pockets'
//    walls on one edge would lie on each other); a mesh grille takes the corners' rows (core/design.ts faceLock);
//  - the head lamps: the same block of the bonnet as covers that rise, a pocket under glass, or a flush lens; the
//    units' layout (two square, one wide, two round) for a pod's face and a pocket's units.
// Data and a function of the design; the kit's panels (kit/panels/noseBumper.ts, popupLamp.ts) do the cutting.
import type { AuxKind, BaseId, BumperKind, Face, GrilleKind, HeadKind, NoseKind, PodKind } from '../../core/design';
import { FACE_OWN } from '../../core/design';
import { makeLines } from './kit/lines';
import { makeSkin } from './kit/skin';
import type { CarKit, OuterIntake, PopupSpec } from './kit/spec';
import type { Grid } from './kit/geom';
import { F355_KIT, F355_MASS_NOSE, F355_PLAIN_FRONT, F355_POCKET_LAMPS, F355_ROUND_NOSE } from './cars/f355.kit';
import { NSX_FIXED_LAMPS, NSX_KIT, NSX_MASS_NOSE, NSX_POCKET_LAMPS, NSX_POINTED_NOSE, NSX_SUNK_FRONT } from './cars/nsx.kit';
import { EB110_KIT, EB110_POINTED_NOSE, EB110_POPUP_LAMPS, EB110_ROUND_NOSE, EB110_SUNK_FRONT } from './cars/eb110.kit';

type Span = [number, number];
/** a bumper's style: its eight lines (the chain's points from the widest line down: section.ts FLANK.H on) and its zones */
interface Style {
  /** each line's share of the way from the top line (0) down to the lip (1) */ share: number[];
  /** how far each line stands behind the top line on the centre line (mm; negative: ahead of it) */ d: number[];
  /** the chain point under whose line the lamp strip lies; the chain points the mouth (the centre grille), a wide mesh,
   *  the outer intakes and the fog lamps' block lie between */
  strip: number; mouth: Span; wide: Span; outer: Span; fog: Span;
  /** a thin blade under the lip */ splitter?: boolean;
}
/** the styles: the three cars' own bumpers (their lines' shares and stand-offs as their specs have them) and the air dam */
const STYLE: Record<BumperKind, Style> = {
  // the NSX's: the lamp strip under the top line, an upright face, the mouth low, tucking under to the lip
  upright: { share: [0, 0.194, 0.294, 0.417, 0.66, 0.74, 0.937, 1], d: [0, -8, -8, -6, 5, 12, 26, 38], strip: 4, mouth: [6, 9], wide: [6, 9], outer: [7, 8], fog: [7, 9] },
  // the F355's: a crease on top, the grille high between the lamps, the face full at its middle and swept back to the lip
  crease: { share: [0, 0.054, 0.259, 0.518, 0.759, 0.828, 0.97, 1], d: [0, -18, -30, -32, -4, 14, 48, 91], strip: 5, mouth: [5, 7], wide: [6, 8], outer: [6, 8], fog: [6, 8] },
  // the EB110's: leaning forward from the top line to a low lip, the intakes in its lower half, a splitter
  wedge: { share: [0, 0.121, 0.393, 0.557, 0.721, 0.902, 0.974, 1], d: [0, -23, -57, -79, -89, -91, -81, -63], strip: 5, mouth: [6, 9], wide: [6, 9], outer: [6, 8], fog: [6, 8], splitter: true },
  // an air dam: a short upper face, then a deep chin dropping straight to a splitter
  airdam: { share: [0, 0.1, 0.3, 0.5, 0.72, 0.9, 0.975, 1], d: [0, -10, -16, -20, -24, -27, -28, -22], strip: 5, mouth: [6, 9], wide: [6, 9], outer: [6, 8], fog: [6, 8], splitter: true },
};
/** a base's rows across its bumper (the nose's rows from the centre line: skin.ts NSG): the centre grille's, the pair of
 *  barred intakes beside a shield, a wide mesh's, the corner's (the outer intakes, the fog lamps), the lamp strip's
 *  (its first row, where the clear lamp gives way to the amber one, its end) */
interface Rows { centre: number; side: Span; wide: number; corner: Span; strip: { from: number; split: number; to: number } }
interface FaceBase {
  kit: CarKit; rows: Rows; /** half the nose's width at the front arch (the crest's) */ half: number;
  /** the prow's patches (the plan of the nose; a base's own: none) */
  nose: Record<NoseKind, Partial<CarKit> | null>;
  /** how far a foreign bumper's top line stands from the base's own (mm), and how much of its stand-offs it takes */
  fit: Partial<Record<BumperKind, { shift: number; scale: number }>>;
  head: Record<HeadKind, PopupSpec>;
  /** the auxiliary lamps on the base's own bumper where they were fitted by hand (the builder's fronts of alpha 0.11) */
  aux: Partial<Record<AuxKind, Pick<CarKit['intakes'], 'outer' | 'fog' | 'patches'> & { lamps: CarKit['bumperLamps'] }>>;
}
const NO_LAMPS: CarKit['bumperLamps'] = { from: 0, split: 0, to: 0 };
const BASE: Record<BaseId, FaceBase> = {
  nsx: { kit: NSX_KIT, half: 790, rows: { centre: 3, side: [1, 3], wide: 6, corner: [4, 6], strip: { from: 4, split: 6, to: 9 } },
    nose: { round: null, pointed: NSX_POINTED_NOSE, mass: NSX_MASS_NOSE }, fit: {},
    head: { popup: NSX_KIT.popup, pocket: NSX_POCKET_LAMPS.popup, fixed: NSX_FIXED_LAMPS.popup },
    aux: { strip: { outer: NSX_KIT.intakes.outer, lamps: NSX_KIT.bumperLamps }, round: { fog: NSX_SUNK_FRONT.intakes.fog, lamps: NSX_SUNK_FRONT.bumperLamps } } },
  f355: { kit: F355_KIT, half: 850, rows: { centre: 3, side: [1, 3], wide: 6, corner: [4, 6], strip: { from: 4, split: 5, to: 6 } },
    nose: { round: F355_ROUND_NOSE, pointed: null, mass: F355_MASS_NOSE }, fit: {},
    head: { popup: F355_KIT.popup, pocket: F355_POCKET_LAMPS.popup, fixed: { ...F355_KIT.popup, kind: 'fixed' } },
    aux: { round: { fog: F355_KIT.intakes.fog, lamps: F355_KIT.bumperLamps }, strip: { outer: F355_PLAIN_FRONT.intakes.outer, lamps: F355_PLAIN_FRONT.bumperLamps } } },
  eb110: { kit: EB110_KIT, half: 792, rows: { centre: 4, side: [1, 5], wide: 6, corner: [6, 8], strip: { from: 6, split: 8, to: 9 } },
    nose: { round: EB110_ROUND_NOSE, pointed: EB110_POINTED_NOSE, mass: null }, fit: {},
    head: { pocket: EB110_KIT.popup, popup: EB110_POPUP_LAMPS.popup, fixed: { ...EB110_KIT.popup, kind: 'fixed' } },
    aux: { none: { patches: EB110_KIT.intakes.patches, lamps: EB110_KIT.bumperLamps }, round: { fog: EB110_SUNK_FRONT.intakes.fog, patches: [], lamps: EB110_KIT.bumperLamps } } },
};
const H = 4;   // section.ts FLANK.H: the chain point of the bumper's top line (its lines are the chain's points from there down)

/** the bumper's lines of a style between a base's own top line and lip */
function bumperLines(B: FaceBase, kind: BumperKind, own: CarKit['nose']): Pick<CarKit['nose'], 'levels' | 'reach'> {
  const S = STYLE[kind], f = B.fit[kind] ?? { shift: 0, scale: 1 }, top = own.levels[0]!, lip = own.levels[7]!;
  return { levels: S.share.map(s => Math.round(top - s * (top - lip))), reach: S.d.map(d => Math.round(own.reach[0]! + f.shift + d * f.scale)) }; }

/** the lamp units' layout laid on a base's head lamps (two square units: as the base has them) */
function withPod(P: PopupSpec, pod: PodKind): PopupSpec {
  if (pod === 'twin') return P;
  const a = P.lens[0]![0], b = P.lens[P.lens.length - 1]![1], m = (a + b) / 2;
  if (pod === 'single') return { ...P, lens: [[a, b]], round: [] };
  // two round units: each in its half of the run across, as far apart as their size lets them stand
  return { ...P, lens: [[a, m - 0.02], [m + 0.02, b]], round: [0, 1] }; }

/** the base's kit with the design's face laid over it */
export function faceKit(base: BaseId, F: Face & { nose: NoseKind }): CarKit {
  const B = BASE[base], own = FACE_OWN[base], S = STYLE[F.bumper], R = B.rows, ownBumper = F.bumper === own.bumper;
  let kit: CarKit = { ...B.kit }; const np = B.nose[F.nose]; if (np) kit = { ...kit, ...np };
  // the bumper: a style's lines; the prow's own change to the stand-offs (a prow that reaches further forward) kept on top
  if (!ownBumper) { const bl = bumperLines(B, F.bumper, B.kit.nose), lead = kit.nose.reach.map((r, i) => r - B.kit.nose.reach[i]!);
    kit.nose = { ...kit.nose, levels: bl.levels, reach: bl.reach.map((r, i) => r + lead[i]!) };
    const lip = bl.levels[7]!;
    kit.splitter = S.splitter ? { reach: Math.min(...kit.nose.reach) - 10, half: Math.round(B.half * 1.075), z: [lip - 8, lip - 16], until: 0.9 } : undefined; }
  kit.popup = withPod(B.head[F.head], F.pod);
  if (ownBumper && F.grille === own.grille && F.aux === own.aux) return kit;   // the base's own bumper face: as its spec has it
  // ---- the grille and the lamps, measured on the bumper as built ----
  const N: Grid = makeSkin(makeLines(kit.lines), kit).NSG, lv = kit.nose.levels, z = (q: number) => lv[q - H]!, mesh = F.grille === 'mesh';
  const yAt = (i: number, q: number) => N[i]![q]![1], I0 = B.kit.intakes;
  let centre: CarKit['intakes']['centre'] = { rows: 0, cols: S.mouth, depth: 75, bars: [], barX: 0, barZ: [0, 0] }, shield: CarKit['intakes']['shield'], side: OuterIntake | undefined;
  if (ownBumper && F.grille === own.grille) { centre = I0.centre; shield = I0.shield; side = I0.side; }
  else if (F.grille !== 'none') centre = grille(F.grille, S, R, yAt, z, v => { shield = v.shield; side = v.side; }) ?? centre;
  // the auxiliary lamps: by hand on the base's own bumper where they were; else fitted to the style's zones
  const hand = ownBumper && !mesh ? B.aux[F.aux] : undefined, from = mesh && F.aux === 'round' ? Math.max(R.strip.from, R.wide + 1) : R.strip.from,   /* a sunk strip's pocket stands clear of the mesh's */ strip = { from, split: Math.max(from, R.strip.split), to: Math.max(from, R.strip.to), col: S.strip };
  let outer: OuterIntake | undefined, fog: CarKit['intakes']['fog'], patches: CarKit['intakes']['patches'], lamps = NO_LAMPS;
  if (hand) { outer = hand.outer; fog = hand.fog; patches = hand.patches; lamps = hand.lamps;
    // the NSX's sunk front rounded its own slot's corner and set a badge in it (alpha 0.11's look kept)
    if (base === 'nsx' && F.aux === 'round' && F.grille === own.grille) centre = NSX_SUNK_FRONT.intakes.centre; }
  else if (F.aux === 'strip') { lamps = strip; if (!mesh) outer = { rows: R.corner, cols: S.outer, depth: 80, fog: [R.corner[1] - 1, 0, 0.85, 0.1, 0.9, 40] }; }
  else if (F.aux === 'round') { const [r0, r1] = R.corner, [c0, c1] = S.fog, P = [N[r0]![c0]!, N[r1]![c0]!, N[r1]![c1]!, N[r0]![c1]!];
    const y0 = Math.max(P[0]![1], P[3]![1]), y1 = Math.min(P[1]![1], P[2]![1]), z0 = Math.max(P[2]![2], P[3]![2]), z1 = Math.min(P[0]![2], P[1]![2]);
    fog = { rows: R.corner, cols: S.fog, y: Math.round((y0 + y1) / 2), z: Math.round((z0 + z1) / 2), r: Math.round(Math.min(52, 0.4 * (y1 - y0), 0.4 * (z1 - z0))), depth: 28, seg: 12 };
    lamps = { ...strip, depth: 28, amberFirst: true }; }
  else if (ownBumper) patches = B.aux.none?.patches;
  kit.intakes = { centre, ...(shield ? { shield } : {}), ...(side ? { side } : {}), ...(outer ? { outer } : {}), ...(fog ? { fog } : {}), ...(patches ? { patches } : {}) };
  kit.bumperLamps = lamps;
  return kit;
}

/** a grille fitted to the bumper's mouth: the centre pocket's spec (a shield and its side intakes handed to `extra`) */
function grille(kind: Exclude<GrilleKind, 'none'>, S: Style, R: Rows, yAt: (i: number, q: number) => number, z: (q: number) => number, extra: (v: { shield?: CarKit['intakes']['shield']; side?: OuterIntake }) => void): CarKit['intakes']['centre'] | null {
  const [q0, q1] = kind === 'mesh' ? S.wide : S.mouth, zt = z(q0), zb = z(q1), zm = (zt + zb) / 2, hgt = zt - zb, qm = (q0 + q1) >> 1;
  if (kind === 'horseshoe') {   // the EB110's shield, as tall as the mouth's band lets it stand, between two barred intakes
    const k = Math.max(0.7, Math.min(1.1, hgt / 155)), P0 = EB110_KIT.intakes.shield!.pts, c0 = 221;
    extra({ shield: { pts: P0.map(([y, zz]) => [Math.round(y * k), Math.round(zm + 14 * k + (zz - c0) * k)] as [number, number]), grow: 1.14 },
      side: { rows: R.side, cols: [q0, q1], depth: 75, slats: Array.from({ length: q1 - q0 - 1 }, (_, i) => q0 + 1 + i) } });
    return null; }
  const w = yAt(kind === 'mesh' ? R.wide : R.centre, qm), rows = kind === 'mesh' ? R.wide : R.centre;
  if (kind === 'mesh') return { rows, cols: [q0, q1], depth: 90, bars: [], barX: 40, barZ: [zb, zt], follow: true, mesh: { n: [2, 2], w: 7 } };
  if (kind === 'slot') return { rows, cols: [q0, q1], depth: 120, bars: [-0.53 * w, 0, 0.53 * w].map(Math.round), barX: 60, barZ: [zb + 6, zt - 5], follow: true };
  // the oval: five upright bars and three slats, a badge, its outer corners rounded by fillets of the skin
  const tall = q1 - q0 >= 2;
  return { rows, cols: [q0, q1], depth: 90, bars: [-0.67, -0.33, 0, 0.33, 0.67].map(f => Math.round(f * w)), barX: 45, barZ: [zb + 6, zt - 6], follow: true,
    slats: { z: [0.25, 0.5, 0.75].map(f => Math.round(zb + f * hgt)), half: Math.round(w * 0.94) }, badge: [15, Math.round(zm - 0.2 * hgt), Math.round(zm + 0.2 * hgt)],
    fillets: [[rows, q1, -1, -1], [rows, q0, -1, 1]], fillet: tall ? 0.92 : 0.48 };
}
