// The side intake (the kit's common carving): a block of flank cells cut in, deepening backward to a dark grille.
// Its front row is the opening's own border (depth 0 there), its back wall joins the inner points to the skin's, so
// the pocket closes on the flank without a gap. Rounded corners are laid as skin-coloured fillets over the opening.
import type { Ctx } from '../ctx';
import { FLANK } from '../section';
import { add, mir, mix, sm, type Grid, type V } from '../geom';
import { zones } from './zones';

export function sideIntake(x: Ctx): void {
  const { e, s, c, k, L } = x, I = k.intake, z = zones(x), CH = s.CH, [top, bot] = I.span ?? [FLANK.H, FLANK.SILL], x0 = L.X(I.from), x1 = L.X(I.full);
  const dep = (px: number) => I.depth * sm(x0, x1, px), inn = (i: number, q: number): V => { const p = CH[i]![q]!, d = dep(p[0]), lip = I.lip * d / I.depth; return [p[0], p[1] - d, p[2] + (q === top ? -lip : q === bot ? (I.footLip ?? I.lip) * d / I.depth : 0)]; };
  const IN: Grid = []; for (let i = z.iI0; i <= z.iI1; i++) { const r: V[] = [CH[i]![top]!]; for (let q = top; q <= bot; q++) r.push(inn(i, q)); r.push(CH[i]![bot]!); IN.push(r); }
  const nc = bot - top + 3;   // the pocket's columns: the skin's top edge, the inner points top..bot, the skin's foot edge
  const ramp = I.footLip !== undefined, dark = (i: number, j: number) => j === 0 || (j === nc - 2 && !ramp) || i >= I.paintRows;   // a foot with its own rise is a ramp in the body's colour
  e.name('intake').mat(c.paint, c.gloss, 'paint'); e.cells(IN, (i, j) => !dark(i, j));
  e.name('intake').mat(c.dark, 0.05); e.cells(IN, dark);
  // the back wall: from the last inner row out to the skin
  const skin: V[] = [CH[z.iI1]![top]!]; for (let q = top; q <= bot; q++) skin.push(CH[z.iI1]![q]!); skin.push(CH[z.iI1]![bot]!);
  e.name('intakeGrille').mat(c.dark, 0.05, 'grille'); e.cells([IN[IN.length - 1]!, skin]);
  e.with('part', () => {
    // its corners rounded: a fillet of the skin left in the corners given
    e.name('quarter').mat(c.paint, c.gloss, 'paint'); for (const sg of [1, -1]) for (const [at, q, di, dq] of I.fillets) { const i = at === 'to' ? z.iI1 : z.iI0, cp = CH[i]![q]!; e.tri(mir(cp, sg), mir(mix(cp, CH[i + di]![q]!, I.fillet), sg), mir(mix(cp, CH[i]![q + dq]!, I.fillet), sg), [0, sg, 0]); }
    e.name('intakeGrille').mat(c.frame, 0.2); for (const sg of [1, -1]) { const a = IN[IN.length - 2]!.map(p => mir(p, sg)), b = IN[IN.length - 1]!.map(p => mir(p, sg));
      for (let f = 1; f <= I.fins; f++) { const u = f / (I.fins + 1); e.b.bar(add(mix(a[1]!, a[nc - 2]!, u), [0, sg * I.fin[0], 0]), add(mix(b[1]!, b[nc - 2]!, u), [I.fin[1], sg * I.fin[0], 0]), I.fin[2], I.fin[3]); } } });
}
