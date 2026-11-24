// The tail panel, seen from behind. Kinds:
//   'frame'       ONE frame: the spoiler's blade across the top runs into the rear wings' tops, the wings' rear faces come
//                 down the sides, and in the opening they frame the full-width lamp panel, recessed and upright, an open
//                 slot between its top and the blade (the deck shows through); under it the bumper, a box standing proud
//                 with a ledge and a plate recess, the dark valance let into its foot
//   'roundLamps'  the same frame and bumper, the lamp panel in the body's colour carrying round lamps (parts/lampCluster)
//   'ducktail'    no blade and no slot: the deck sweeps up into a lip right across the tail (the chain's first lines: its top
//                 edge, its trailing roll, its under-edge), a dark band along its trailing face; the body-coloured lamp
//                 panel is set in under it between the wings' ends, its lamps sunk in round recesses cut in it; the same bumper
// The tail's rows go round from the last chain to the centre line; its columns are the standard section's points read
// as the tail's lines (section.ts TAILP). The opening's outer end is cut slanting across the lamp panel's rows.
import type { Ctx } from '../ctx';
import { TAILP as P } from '../section';
import { border } from '../emit';
import { add, mir, type V } from '../geom';
import { lampSurface } from '../parts/lampCluster';

export function tail(x: Ctx): void {
  const { e, s, c, k } = x, T = k.tail, { TLG, LG, VG, DKG, BT, BU } = s, FR = T.frameRows, [a3, a4, a5] = T.opening;
  if (T.kind !== 'frame' && T.kind !== 'roundLamps' && T.kind !== 'ducktail') throw new Error(`kit: tail kind ${T.kind} is not built yet`);
  const duck = T.kind === 'ducktail', FRt = duck ? TLG.length - 1 : FR, band = (i: number, q: number) => duck && !!T.band && q === P.ROLL && i >= T.band[0] && i < T.band[1];
  if (a3 !== a4 + 1 || a4 !== a5 + 1 || a3 >= FR) throw new Error('kit: the frame tail cuts its opening one row a step');
  const paint = () => e.mat(c.paint, c.gloss, 'paint');
  // the frame: the blade (top, trailing edge, underside, leading edge) and the wings' rear faces down to the bumper
  // the blade's top runs out over the gutter into the ridges; its leading edge and underside stop at the gutter, where the slot's side wall comes up to them
  const G = k.deck.lidCols;
  if (duck) { e.name('spoiler'); paint(); e.cells(TLG, (i, q) => q <= P.UNDER && !band(i, q)); e.name('tailSlot').mat(c.black, 0.3); e.cells(TLG, band); }
  else { e.name('spoiler'); paint(); e.cells(BT); e.cells([BU[2]!, BT[0]!], (_, j) => j < G); e.cells(TLG, (i, q) => q < P.UNDER && i >= FR);
    e.name('tailSlot').mat(c.shade, 0.3, 'paint'); e.cells(BU, (_, j) => j < G); }
  e.name('quarter'); paint(); e.cells(TLG, (i, q) => (!duck && q <= P.UNDER && i < FR) || (q === P.LAMP_TOP && i < a4) || (q === P.LAMP_MID && i < a5));
  e.tri2(TLG[a4]![P.LAMP_TOP]!, TLG[a3]![P.LAMP_TOP]!, TLG[a4]![P.LAMP_MID]!, [1, 0, 0]); e.tri2(TLG[a5]![P.LAMP_MID]!, TLG[a4]![P.LAMP_MID]!, TLG[a5]![P.LAMP_FOOT]!, [1, 0, 0]);
  // the opening's reveal: down the slanting end, along the top in the corner
  const cut = [TLG[a3]![P.LAMP_TOP]!, TLG[a4]![P.LAMP_MID]!, TLG[a5]![P.LAMP_FOOT]!], cutL = [LG[a3]![P.LAMP_TOP]!, LG[a4]![P.LAMP_MID]!, LG[a5]![P.LAMP_FOOT]!];
  e.wall(cut, cutL, [0, -1, -1]);
  const top = [], topL = []; for (let i = FRt; i >= a3; i--) { top.push(TLG[i]![P.LAMP_TOP]!); topL.push(LG[i]![P.LAMP_TOP]!); } e.wall(top, topL, [0, 0, -1]);
  // the slot's side wall, from the deck's gutter up to the blade's leading edge and underside, back to the frame; ahead of it the gutter's end under the blade's front
  const iB = s.iBl, slot = duck ? [] : [DKG[iB]![G]!, BT[0]![G]!, BU[2]![G]!, BU[1]![G]!, TLG[FR]![P.UNDER]!, TLG[FR]![P.LAMP_TOP]!, LG[FR]![P.LAMP_TOP]!, DKG[DKG.length - 2]![G]!];
  if (!duck) for (const sg of [1, -1]) { e.fan(slot.map(p => mir(p, sg)), [0, -sg, 0]); e.tri(mir(DKG[iB]![G]!, sg), mir(DKG[iB]![G + 1]!, sg), mir(BT[0]![G]!, sg), [-1, 0, 0]); }
  // the lamp panel across the opening, its outer ends cut slanting by the wings
  if (T.kind === 'frame') e.name('tailBand').mat(c.smoke, 0.85); else { e.name('tailBand'); paint(); }
  const SK = duck ? k.tailLamps.sunk : undefined, inBlock = (i: number) => !!SK && SK.blocks.some(([a, b]) => i >= a && i < b);
  e.cells(LG, (i, q) => ((q === P.LAMP_TOP && i >= a3) || (q === P.LAMP_MID && i >= a4)) && !inBlock(i));
  e.tri2(LG[a3]![P.LAMP_TOP]!, LG[a3]![P.LAMP_MID]!, LG[a4]![P.LAMP_MID]!, [1, 0, 0]); e.tri2(LG[a4]![P.LAMP_MID]!, LG[a4]![P.LAMP_FOOT]!, LG[a5]![P.LAMP_FOOT]!, [1, 0, 0]);
  // lamps sunk in the panel: each block of its cells cut round a port, a dark barrel behind it, the lens at its back
  if (SK) { const at = lampSurface(x), d: V = [-SK.depth, 0, 0]; SK.blocks.forEach(([r0, r1], n) => { if (r0 < a3) throw new Error('kit: a sunk lamp lies in the panel, clear of the opening\'s slanting end');
    for (const sg of [1, -1]) { const yc = x.L.my(SK.y[n]!), ring = (r: number, lift: number) => Array.from({ length: SK.seg }, (_, t) => { const a = t / SK.seg * Math.PI * 2; return at(yc + r * Math.cos(a), SK.z + r * Math.sin(a), lift, sg); }), hole = ring(SK.r, 0);
      e.name('tailBand'); paint(); e.porthole(border(LG, r0, r1, P.LAMP_TOP, P.LAMP_FOOT).map(p => mir(p, sg)), hole, [1, 0, 0]);
      e.name(SK.names[n]!).mat(c.dark, 0.2); e.tube(hole, d); e.mat(c[SK.colours[n]!] as string, 0.7, 'lens'); e.fan(hole.map(p => add(p, d)), [1, 0, 0]);
      if (SK.rim > 0) e.with('part', () => { e.name(SK.names[n]!).mat(c.chrome, 0.8, 'metal'); e.porthole(ring(SK.r + SK.rim, 1.5), ring(SK.r, 1.5), [1, 0, 0]); }); } }); }
  // the bumper: the ledge from the lamp panel's foot out to its top edge, the face with the plate's recess, the corners; the valance let into its foot
  const [p0, p1] = T.plateRows, plate = (i: number, q: number) => q === P.PLATE_TOP && i >= p0 && i < p1;
  e.name('bumperR'); paint(); e.cells(TLG.slice(0, a5 + 1).map(r => [r[P.LAMP_FOOT]!, r[P.BUMPER]!])); e.cells(TLG.slice(a5).map((r, i) => [LG[i + a5]![P.LAMP_FOOT]!, r[P.BUMPER]!])); e.tri2(TLG[a5]![P.LAMP_FOOT]!, LG[a5]![P.LAMP_FOOT]!, TLG[a5]![P.BUMPER]!, [0, -1, 0.5]);
  e.cells(TLG, (i, q) => (q >= P.BUMPER && q < P.VALANCE && !plate(i, q)) || (q >= P.VALANCE && i < FR));
  e.wall(TLG.slice(FR).map(r => r[P.VALANCE]!), VG.slice(FR).map(r => r[P.VALANCE]!), [0, 0, -1]); e.wall(TLG[FR]!.slice(P.VALANCE), VG[FR]!.slice(P.VALANCE), [0, -1, 0]);
  // the valance: dark trim with a grille across it; or, with cut-outs, in the body's colour and dark only in those rows (round the exhausts)
  const cut2 = T.cutouts, hole = (i: number, q: number) => q === P.VALANCE && (cut2 ? i >= cut2[0] && i < cut2[1] : i > FR);
  e.name('valance'); if (cut2) paint(); else e.mat(c.trim, 0.15); e.cells(VG, (i, q) => q >= P.VALANCE && i >= FR && !hole(i, q));
  e.name('valance').mat(c.dark, 0.05, 'grille'); e.cells(VG, hole);
  // the plate's recess in the bumper's face
  const rows = TLG.slice(p0, p1 + 1), r: V[] = [...rows.map(q => q[P.PLATE_TOP]!).reverse(), ...rows.map(q => q[P.PLATE_FOOT]!)]; e.name('bumperR'); e.pocket([...r, ...r.slice(1, -1).reverse().map(q => mir(q, -1))], [-T.plateDepth, 0, 0], [1, 0, 0], c.dark);
}
