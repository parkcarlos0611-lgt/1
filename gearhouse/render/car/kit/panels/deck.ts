// The deck panel: the lid between the rear wings behind the glass. Kinds:
//   'lid'     a painted boot lid, the tail slot's floor under the spoiler's blade, the lid's shut lines
//   'louvre'  an opening over the engine: the shell sinks a dark bay under it (the opening's own border carried down), and a
//             slotted cover lies in it (a closure): slats across with open slots between them, through which the engine
//             shows, a raised panel in its middle
import type { Ctx } from '../ctx';
import { UP } from '../ctx';
import { lerp, mir, type V } from '../geom';

export function deck(x: Ctx): void {
  const { e, s, c, k } = x, D = k.deck; if (D.kind === 'louvre') return louvre(x); if (D.kind !== 'lid') throw new Error(`kit: deck kind ${D.kind} is not built yet`);
  e.name('bootLid').mat(c.paint, c.gloss, 'paint'); e.cells(s.DKG, (i, j) => j < D.lidCols && i < s.iBl);
  e.name('tailSlot').mat(c.shade, 0.3, 'paint'); e.cells(s.DKG, (i, j) => j < D.lidCols && i >= s.iBl);   // the gutter under the blade lies inside the wing (tail.ts closes it)
}
function louvre(x: Ctx): void {
  const { e, s, c, k, L } = x, D = k.deck, V = D.louvre, G = D.lidCols, P = s.DKG; if (!V) throw new Error('kit: a louvred deck needs its opening and slots');
  const i0 = L.at(V.open[0]) - s.iDk, i1 = L.at(V.open[1]) - s.iDk, xs = P.slice(i0, i1 + 1).map(r => r[0]![0]);
  e.name('bootLid').mat(c.paint, c.gloss, 'paint'); e.cells(P, (i, j) => j < G && (i < i0 || i >= i1));
  // the bay: the opening's border (across the centre line) carried down
  const right: V[] = [...P[i0]!.slice(0, G + 1), ...P.slice(i0 + 1, i1).map(r => r[G]!), ...P[i1]!.slice(0, G + 1).reverse()], ring = [...right, ...right.slice(1, -1).reverse().map(p => mir(p, -1))];
  e.name('engineBay'); e.pocket(ring, [0, 0, -V.depth], UP, c.dark);
  // the cover's surface: the opening's own cells (the lid's edge its last column)
  const at = (px: number, y: number): V => { let i = 0; while (i + 2 < xs.length && xs[i + 1]! < px) i++; const u = (px - xs[i]!) / (xs[i + 1]! - xs[i]!), zr = (r: V[]) => { let j = 0; while (j + 1 < G && r[j + 1]![1] < y) j++; const a = r[j]!, b = r[j + 1]!; return lerp(a[2], b[2], Math.max(0, Math.min(1, (y - a[1]) / (b[1] - a[1])))); };
    return [px, y, lerp(zr(P[i0 + i]!), zr(P[i0 + i + 1]!), u)]; };
  const edgeY = (px: number) => { let i = 0; while (i + 2 < xs.length && xs[i + 1]! < px) i++; return lerp(P[i0 + i]![G]![1], P[i0 + i + 1]![G]![1], (px - xs[i]!) / (xs[i + 1]! - xs[i]!)); };
  const S = V.slots, [yi, yo] = S.y.map(L.my) as [number, number], yl = L.my(S.long), pn = V.panel, px0 = pn ? L.mx(pn.x[0]) : 0, px1 = pn ? L.mx(pn.x[1]) : 0;
  const slots = Array.from({ length: S.n }, (_, q) => { const a = L.mx(S.from + q * S.pitch), b = a + S.width; return { a, b, y: pn && b > px0 && a < px1 ? yi : yl }; }).filter(o => o.a > xs[0]! && o.b < xs[xs.length - 1]!);
  e.with('closure', () => { e.name('engineCover').mat(c.paint, c.gloss, 'paint');
    // the slats: full-width strips between the slots (broken at the stations so they follow the edge), the lid's spine and margin beside each slot
    const cuts = [...xs, ...slots.flatMap(o => [o.a, o.b])].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1]! > 0.5);
    for (let q = 0; q + 1 < cuts.length; q++) { const a = cuts[q]!, b = cuts[q + 1]!, m = (a + b) / 2, sl = slots.find(o => m > o.a && m < o.b), ea = edgeY(a), eb = edgeY(b);
      const strip = (ya0: number, ya1: number, yb0: number, yb1: number) => e.cells([[at(a, ya0), at(a, ya1)], [at(b, yb0), at(b, yb1)]]);
      if (!sl) strip(0, ea, 0, eb); else { strip(0, sl.y, 0, sl.y); strip(yo, ea, yo, eb); } }
    // each slot's front and back walls (the slats' thickness)
    e.name('engineCover').mat(c.shade, 0.2, 'paint'); for (const o of slots) for (const [px, n] of [[o.a, 1], [o.b, -1]] as const) { const A = [at(px, o.y), at(px, yo)], B = A.map(p => [p[0] + n * S.wall * 0.15, p[1], p[2] - S.wall] as V); e.wall(A, B, [n, 0, 0.3]); }
    if (pn) { const h = L.my(pn.half), ins = pn.inset, cx = (px0 + px1) / 2, ring = (dx: number, dy: number, dz: number): V[] => ([[px0 + dx, -h * 0.6], [px0 + dx, h * 0.6], [px0 + dx + (h - dy) * 0.3, h - dy], [px1 - dx - (h - dy) * 0.3, h - dy], [px1 - dx, h * 0.6], [px1 - dx, -h * 0.6], [px1 - dx - (h - dy) * 0.3, -(h - dy)], [px0 + dx + (h - dy) * 0.3, -(h - dy)]] as [number, number][]).map(([qx, qy]) => [qx, qy, at(qx, Math.abs(qy))[2] + dz + (dz ? 0 : 0.5)] as V);
      void cx; e.name('engineCover').mat(c.paint, c.gloss, 'paint'); e.b.loft([ring(0, 0, 0), ring(ins, ins, pn.rise)]); } });
}
export function deckTrim(x: Ctx): void {
  const { e, s, c, k, L } = x; if (k.deck.kind === 'louvre') { const V = k.deck.louvre!, i0 = L.at(V.open[0]) - s.iDk, i1 = L.at(V.open[1]) - s.iDk, G = k.deck.lidCols;
    e.name('seam').mat(c.seam, 0.1); e.seam(s.DKG.slice(i0, i1 + 1).map(r => r[G]!), () => UP)([1, -1]); return; }
  const iS = L.at(k.deck.shut) - s.iDk;
  e.name('seam').mat(c.seam, 0.1); e.seam(s.DKG.slice(0, iS + 1).map(r => r[k.deck.lidCols]!), () => UP)([1, -1]); e.seam(s.DKG[iS]!.slice(0, k.deck.lidCols + 1), () => UP)([1, -1]);
}
