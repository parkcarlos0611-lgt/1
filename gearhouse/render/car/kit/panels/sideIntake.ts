// The side intake (the kit's common carving): a block of flank cells cut in, deepening backward to a dark grille.
// Its front row is the opening's own border (depth 0 there), its back wall joins the inner points to the skin's, so
// the pocket closes on the flank without a gap. Rounded corners are laid as skin-coloured fillets over the opening.
// Kind 'scoop': a long channel, its floor curved across (each inner point's own share of the depth), its inner edges
// closing toward the middle near its back end (a rounded end), the depth growing along a smooth step.
import type { Ctx } from '../ctx';
import { FLANK } from '../section';
import { add, lerp, mir, mix, sm, type Grid, type V } from '../geom';
import { zones } from './zones';

export function sideIntake(x: Ctx): void {
  const { e, s, c, k, L } = x, I = k.intake, z = zones(x), CH = s.CH, top = FLANK.H, bot = FLANK.SILL, x0 = L.X(I.from), x1 = L.X(I.full);
  const sc = I.kind === 'scoop', cl0 = sc && I.close ? L.X(I.close[0]) : 0, xe = L.X(I.to);
  const dep = (px: number) => I.depth * sm(x0, x1, px), inn = (i: number, q: number): V => { const p = CH[i]![q]!, d = dep(p[0]) * (sc ? I.profile?.[q - top] ?? 1 : 1), lip = I.lip * d / I.depth;
    if (!sc) return [p[0], p[1] - d, p[2] + (q === top ? -lip : q === bot ? lip : 0)];
    const zm = (CH[i]![top]![2] + CH[i]![bot]![2]) / 2, u = I.close ? I.close[1] * sm(cl0, xe, p[0]) : 0, z = p[2] + (q === top ? -lip : q === bot ? lip : 0); return [p[0], p[1] - d, lerp(z, zm, u)]; };
  const IN: Grid = []; for (let i = z.iI0; i <= z.iI1; i++) { const r: V[] = [CH[i]![top]!]; for (let q = top; q <= bot; q++) r.push(inn(i, q)); r.push(CH[i]![bot]!); IN.push(r); }
  const nc = bot - top + 3;   // the pocket's columns: the skin's top edge, the inner points top..bot, the skin's foot edge
  e.name('intake').mat(c.paint, c.gloss, 'paint'); e.cells(IN, (i, j) => j > 0 && j < nc - 2 && i < I.paintRows);
  e.name('intake').mat(c.dark, 0.05); e.cells(IN, (i, j) => j === 0 || j === nc - 2 || i >= I.paintRows);
  // the back wall: from the last inner row out to the skin
  const skin: V[] = [CH[z.iI1]![top]!]; for (let q = top; q <= bot; q++) skin.push(CH[z.iI1]![q]!); skin.push(CH[z.iI1]![bot]!);
  e.name('intakeGrille').mat(c.dark, 0.05, 'grille'); e.cells([IN[IN.length - 1]!, skin]);
  e.with('part', () => {
    // its corners rounded: a fillet of the skin left in the corners given
    e.name('quarter').mat(c.paint, c.gloss, 'paint'); for (const sg of [1, -1]) for (const [at, q, di, dq] of I.fillets) { const i = at === 'to' ? z.iI1 : z.iI0, cp = CH[i]![q]!; e.tri(mir(cp, sg), mir(mix(cp, CH[i + di]![q]!, I.fillet), sg), mir(mix(cp, CH[i]![q + dq]!, I.fillet), sg), [0, sg, 0]); }
    e.name('intakeGrille').mat(c.frame, 0.2); for (const sg of [1, -1]) { const a = IN[IN.length - 2]!.map(p => mir(p, sg)), b = IN[IN.length - 1]!.map(p => mir(p, sg));
      for (let f = 1; f <= I.fins; f++) { const u = f / (I.fins + 1); e.b.bar(add(mix(a[1]!, a[nc - 2]!, u), [0, sg * I.fin[0], 0]), add(mix(b[1]!, b[nc - 2]!, u), [I.fin[1], sg * I.fin[0], 0]), I.fin[2], I.fin[3]); } } });
}
