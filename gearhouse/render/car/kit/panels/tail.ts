// The tail panel, seen from behind. Kinds:
//   'frame'       ONE frame: the spoiler's blade across the top runs into the rear wings' tops, the wings' rear faces come
//                 down the sides, and in the opening they frame the full-width lamp panel, recessed and upright, an open
//                 slot between its top and the blade (the deck shows through); under it the bumper, a box standing proud
//                 with a ledge and a plate recess, the dark valance let into its foot
//   'roundLamps'  the same frame and bumper, the lamp panel in the body's colour carrying round lamps (parts/lampCluster)
// The tail's rows go round from the last chain to the centre line; its columns are the standard section's points read
// as the tail's lines (section.ts TAILP). The opening's outer end is cut slanting across the lamp panel's rows.
import type { Ctx } from '../ctx';
import { TAILP as P } from '../section';
import { mir } from '../geom';
import { frameOf } from '../spec';
import { duckTail } from './ducktail';

export function tail(x: Ctx): void {
  if (x.k.tail.kind === 'ducktail') { duckTail(x); return; }
  const { e, s, c, k } = x, T = { ...k.tail, ...frameOf(k.tail) }, { TLG, LG, VG, DKG, BT, BU } = s, FR = T.frameRows, [a3, a4, a5] = T.opening;
  if (T.kind !== 'frame' && T.kind !== 'roundLamps') throw new Error(`kit: tail kind ${T.kind} is not built yet`);
  if (a3 !== a4 + 1 || a4 !== a5 + 1 || a3 >= FR) throw new Error('kit: the frame tail cuts its opening one row a step');
  const paint = () => e.mat(c.paint, c.gloss, 'paint');
  // the frame: the blade (top, trailing edge, underside, leading edge) and the wings' rear faces down to the bumper
  // the blade's top runs out over the gutter into the ridges; its leading edge and underside stop at the gutter, where the slot's side wall comes up to them
  const G = k.deck.lidCols;
  e.name('spoiler'); paint(); e.cells(BT); e.cells([BU[2]!, BT[0]!], (_, j) => j < G); e.cells(TLG, (i, q) => q < P.UNDER && i >= FR);
  e.name('tailSlot').mat(c.shade, 0.3, 'paint'); e.cells(BU, (_, j) => j < G);
  e.name('quarter'); paint(); e.cells(TLG, (i, q) => (q <= P.UNDER && i < FR) || (q === P.LAMP_TOP && i < a4) || (q === P.LAMP_MID && i < a5));
  e.tri2(TLG[a4]![P.LAMP_TOP]!, TLG[a3]![P.LAMP_TOP]!, TLG[a4]![P.LAMP_MID]!, [1, 0, 0]); e.tri2(TLG[a5]![P.LAMP_MID]!, TLG[a4]![P.LAMP_MID]!, TLG[a5]![P.LAMP_FOOT]!, [1, 0, 0]);
  // the opening's reveal: down the slanting end, along the top in the corner
  const cut = [TLG[a3]![P.LAMP_TOP]!, TLG[a4]![P.LAMP_MID]!, TLG[a5]![P.LAMP_FOOT]!], cutL = [LG[a3]![P.LAMP_TOP]!, LG[a4]![P.LAMP_MID]!, LG[a5]![P.LAMP_FOOT]!];
  e.wall(cut, cutL, [0, -1, -1]);
  const top = [], topL = []; for (let i = FR; i >= a3; i--) { top.push(TLG[i]![P.LAMP_TOP]!); topL.push(LG[i]![P.LAMP_TOP]!); } e.wall(top, topL, [0, 0, -1]);
  // the slot's side wall, from the deck's gutter up to the blade's leading edge and underside, back to the frame; ahead of it the gutter's end under the blade's front
  const iB = s.iBl, slot = [DKG[iB]![G]!, BT[0]![G]!, BU[2]![G]!, BU[1]![G]!, TLG[FR]![P.UNDER]!, TLG[FR]![P.LAMP_TOP]!, LG[FR]![P.LAMP_TOP]!, DKG[DKG.length - 2]![G]!];
  for (const sg of [1, -1]) { e.fan(slot.map(p => mir(p, sg)), [0, -sg, 0]); e.tri(mir(DKG[iB]![G]!, sg), mir(DKG[iB]![G + 1]!, sg), mir(BT[0]![G]!, sg), [-1, 0, 0]); }
  // the lamp panel across the opening, its outer ends cut slanting by the wings
  if (T.kind === 'frame') e.name('tailBand').mat(c.smoke, 0.85); else { e.name('tailBand'); paint(); }
  e.cells(LG, (i, q) => (q === P.LAMP_TOP && i >= a3) || (q === P.LAMP_MID && i >= a4));
  e.tri2(LG[a3]![P.LAMP_TOP]!, LG[a3]![P.LAMP_MID]!, LG[a4]![P.LAMP_MID]!, [1, 0, 0]); e.tri2(LG[a4]![P.LAMP_MID]!, LG[a4]![P.LAMP_FOOT]!, LG[a5]![P.LAMP_FOOT]!, [1, 0, 0]);
  // the bumper: the ledge from the lamp panel's foot out to its top edge, the face with the plate's recess, the corners; the valance let into its foot
  const [p0, p1] = T.plateRows, plate = (i: number, q: number) => q === P.PLATE_TOP && i >= p0 && i < p1;
  e.name('bumperR'); paint(); e.cells(TLG.slice(0, a5 + 1).map(r => [r[P.LAMP_FOOT]!, r[P.BUMPER]!])); e.cells(TLG.slice(a5).map((r, i) => [LG[i + a5]![P.LAMP_FOOT]!, r[P.BUMPER]!])); e.tri2(TLG[a5]![P.LAMP_FOOT]!, LG[a5]![P.LAMP_FOOT]!, TLG[a5]![P.BUMPER]!, [0, -1, 0.5]);
  e.cells(TLG, (i, q) => (q >= P.BUMPER && q < P.VALANCE && !plate(i, q)) || (q >= P.VALANCE && i < FR));
  e.wall(TLG.slice(FR).map(r => r[P.VALANCE]!), VG.slice(FR).map(r => r[P.VALANCE]!), [0, 0, -1]); e.wall(TLG[FR]!.slice(P.VALANCE), VG[FR]!.slice(P.VALANCE), [0, -1, 0]);
  e.name('valance').mat(c.trim, 0.15); e.cells(VG, (i, q) => q >= P.VALANCE && i >= FR && !(q === P.VALANCE && i > FR));
  e.name('valance').mat(c.dark, 0.05, 'grille'); e.cells(VG, (i, q) => q === P.VALANCE && i > FR);
  // the plate's recess in the bumper's face
  const r = [TLG[p1]![P.PLATE_TOP]!, TLG[p0]![P.PLATE_TOP]!, TLG[p0]![P.PLATE_FOOT]!, TLG[p1]![P.PLATE_FOOT]!]; e.name('bumperR'); e.pocket([...r, mir(r[2]!, -1), mir(r[1]!, -1)], [-T.plateDepth, 0, 0], [1, 0, 0], c.dark);
}
