// The nose's bumper panel: below the shut line, in the standard section going round from the centre line to the front
// arch; the lamp strip at its top corners (cells of the same grid), the centre intake and the two outer ones with the
// fog lamps, cut in as pockets.
import type { Ctx } from '../ctx';
import { FLANK } from '../section';
import { border } from '../emit';
import { cross, mir, mix, sub, type V } from '../geom';

export function noseBumper(x: Ctx): void {
  const { e, s, c, k } = x, bl = k.bumperLamps, ic = k.intakes.centre, oc = k.intakes.outer, fg = k.intakes.fog, lc = bl.col ?? FLANK.H;
  const lampCell = (i: number, q: number) => q === lc && i >= bl.from && i < bl.to, fogCell = (i: number, q: number) => !!fg && i >= fg.rows[0] && i < fg.rows[1] && q >= fg.cols[0] && q < fg.cols[1];
  const mouthC = (i: number, q: number) => i < ic.rows && q >= ic.cols[0] && q < ic.cols[1], mouthO = (i: number, q: number) => !!oc && i >= oc.rows[0] && i < oc.rows[1] && q >= oc.cols[0] && q < oc.cols[1];
  const clear = (i: number) => bl.amberFirst ? i >= bl.split : i < bl.split;
  e.name('bumperF').mat(c.paint, c.gloss, 'paint'); e.cells(s.NSG, (i, q) => q >= FLANK.H && !lampCell(i, q) && !mouthC(i, q) && !mouthO(i, q) && !fogCell(i, q));
  const N = s.NSG;
  const ld = bl.depth ?? 0;
  if (ld > 0) for (const sg of [1, -1]) {   // the strip sunk as a dark slot, its lenses at the back
    e.name('indicatorF'); e.pocket(border(N, bl.from, bl.to, lc, lc + 1).map(p => mir(p, sg)), [ld, 0, 0], [-1, 0, 0], c.dark);
    e.with('part', () => { for (let i = bl.from; i < bl.to; i++) { if (clear(i)) e.name('sidelightF').mat(c.lens, 0.7, 'lens'); else e.name('indicatorF').mat(c.amber, 0.7, 'lens'); e.inCell(N, i, lc, 0.04, 0.96, 0.14, 0.86, 3 - ld, [-1, 0, 0], sg); } }); }
  else { e.name('sidelightF').mat(c.lens, 0.7); e.cells(N, (i, q) => lampCell(i, q) && clear(i));
    e.name('indicatorF').mat(c.amber, 0.7); e.cells(N, (i, q) => lampCell(i, q) && !clear(i)); }
  // the centre intake: one pocket across the centre line
  const rows = N.slice(0, ic.rows + 1), r: V[] = [...rows.map(p => p[ic.cols[0]]!)];
  for (let q = ic.cols[0] + 1; q < ic.cols[1]; q++) r.push(N[ic.rows]![q]!);
  r.push(...rows.slice().reverse().map(p => p[ic.cols[1]]!));
  const full = [...r, ...r.slice(1, -1).reverse().map(p => mir(p, -1))];
  e.name('grille'); e.pocket(full, [ic.depth, 0, 0], [-1, 0, 0], c.dark, 'grille');
  e.with('part', () => { e.name('grille').mat(c.frame, 0.2); for (const y of ic.bars) e.b.bar([ic.barX, y, ic.barZ[0]], [ic.barX, y, ic.barZ[1]], 12, 16);
    if (ic.slats) for (const z of ic.slats.z) e.b.bar([ic.barX, -x.L.my(ic.slats.half), z], [ic.barX, x.L.my(ic.slats.half), z], 12, 10);
    if (ic.badge) { const [h, z0, z1] = ic.badge, bx = ic.barX - 10; e.name('badge').mat(c.chrome, 0.85, 'metal'); e.face([bx, -h, z0], [bx, h, z0], [bx, h, z1], [bx, -h, z1], [-1, 0, 0]); }
    // its corners rounded: fillets of the skin left across them
    e.name('bumperF').mat(c.paint, c.gloss, 'paint'); for (const [i, q, di, dq] of ic.fillets ?? []) { const cp = N[i]![q]!; e.tri2(cp, mix(cp, N[i + di]![q]!, ic.fillet ?? 0.5), mix(cp, N[i]![q + dq]!, ic.fillet ?? 0.5), [-1, 0, 0]); } });
  if (oc) for (const sg of [1, -1]) { e.name('grille'); e.pocket(border(N, oc.rows[0], oc.rows[1], oc.cols[0], oc.cols[1]).map(p => mir(p, sg)), [oc.depth, 0, 0], [-1, 0, 0], c.dark, 'grille');
    e.with('part', () => { const f = oc.fog; e.name('fogF').mat(c.lens, 0.7); e.inCell(N, f[0], oc.cols[0], f[1], f[2], f[3], f[4], -f[5], [-1, 0, 0], sg); }); }
  // a round lamp sunk in a recess: its block of cells cut round a port
  if (fg) { const [r0, r1] = fg.rows, [c0, c1] = fg.cols, P = (i: number, q: number) => N[i]![q]!, yc = x.L.my(fg.y), d: V = [fg.depth, 0, 0];
    const xa = (y: number, z: number) => { const u = (y - (P(r0, c0)[1] + P(r0, c1)[1]) / 2) / ((P(r1, c0)[1] + P(r1, c1)[1] - P(r0, c0)[1] - P(r0, c1)[1]) / 2), v = (P(r0, c0)[2] - z) / (P(r0, c0)[2] - P(r0, c1)[2]); return mix(mix(P(r0, c0), P(r1, c0), u), mix(P(r0, c1), P(r1, c1), u), v)[0]; };
    for (const sg of [1, -1]) { const hole = Array.from({ length: fg.seg }, (_, t) => { const a = t / fg.seg * Math.PI * 2, y = yc + fg.r * Math.cos(a), z = fg.z + fg.r * Math.sin(a); return [xa(y, z), sg * y, z] as V; });
      e.name('bumperF').mat(c.paint, c.gloss, 'paint'); e.porthole(border(N, r0, r1, c0, c1).map(p => mir(p, sg)), hole, [-1, 0, 0]);
      e.name('fogF').mat(c.dark, 0.2); e.tube(hole, d); e.mat(c.frame, 0.7, 'lens'); e.fan(hole.map(p => [p[0] + d[0], p[1], p[2]] as V), [-1, 0, 0]); } }
}
/** the bumper's shut line along its top edge, round the nose to the front arch */
export function noseTrim(x: Ctx): void {
  const { e, s, c, k } = x, N = s.NSG, H = FLANK.H; if (!k.nose.seam) return;
  const nrm = (i: number): V => { const a = N[Math.max(0, i - 1)]![H]!, b = N[Math.min(N.length - 1, i + 1)]![H]!, u = N[i]![H - 1]!, d = N[i]![H + 1]!; return cross(sub(b, a), sub(d, u)); };
  e.name('seam').mat(c.seam, 0.1); e.seam(N.map(r => r[H]!), i => { const n = nrm(i); return n[0] * -1 + n[1] * 1 < 0 ? [-n[0], -n[1], -n[2]] : n; }, 7, 2)([1, -1]);
}
