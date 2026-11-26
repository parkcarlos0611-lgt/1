// The rear wing: a blade across the tail lying on the deck (its section follows the deck's surface under it, its
// trailing edge the tail's top edge). Kinds:
//   'active'  it lies in its dark bed and rises with the assembler's `wing` 0..1: lifted on its struts, tilted about
//             its pivot, the trailing edge up
//   'fixed'   it stands raised always
import type { Ctx } from '../ctx';
import { UP } from '../ctx';
import { clamp01, gridProbe, lerp, type V } from '../geom';

export function wing(x: Ctx): void {
  const { e, s, c, k, L } = x, W = k.wing; if (!W) return; const up = W.kind === 'fixed' ? 1 : x.wing;
  // the deck's surface under it (the roof's rear, the deck, a spoiler's blade), and the tail's top edge in plan
  // (between two grids, where a strip joins them, it is taken straight across from the nearest rows either side)
  const hit = (px: number, y: number) => { let z = NaN; for (const G of [s.RFG, s.RGL, s.DKG, s.BT]) { const v = gridProbe(G, 0, 1, 2, px, Math.abs(y)); if (!Number.isNaN(v) && !(v <= z)) z = v; } return z; };
  const zOn = (px: number, y: number) => { const z = hit(px, y); if (!Number.isNaN(z)) return z; let a = NaN, b = NaN, da = 0, db = 0; while (Number.isNaN(a) && da < 300) a = hit(px - (da += 10), y); while (Number.isNaN(b) && db < 300) b = hit(px + (db += 10), y);
    return Number.isNaN(a) ? Number.isNaN(b) ? s.zK(px) : b : Number.isNaN(b) ? a : lerp(a, b, da / (da + db)); };
  const tops = s.TLG.map(r => r[0]!).reverse(), xEdge = (y: number) => { const a = Math.abs(y); let i = 0; while (i + 2 < tops.length && tops[i + 1]![1] < a) i++; const p = tops[i]!, q = tops[i + 1]!; return lerp(p[0], q[0], clamp01((a - p[1]) / (q[1] - p[1] || 1))); };
  const x0 = L.X(W.from), xp = L.X(W.pivot), half = L.my(W.half), sit = L.my(W.sit), zp = zOn(xp, 0), a = W.tilt * up * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), lift = W.rise * up;
  const Tf = (p: V): V => { const dx = p[0] - xp, dz = p[2] - zp; return [xp + dx * ca - dz * sa, p[1], zp + dx * sa + dz * ca + lift]; };
  if (W.bed) { const bx = L.X(W.bed.from), bh = L.my(W.bed.half), n = W.bed.n; e.name('wingBed').mat(c.frame, 0.1);
    for (let i = 0; i < n; i++) { const y0 = lerp(-bh, bh, i / n), y1 = lerp(-bh, bh, (i + 1) / n); for (const [u0, u1] of [[0, 0.5], [0.5, 1]] as const) { const top = (y: number, u: number): V => { const px = lerp(bx, xEdge(y) - W.back - 6, u); return [px, y, zOn(px, y) + 3]; };
      e.face(top(y0, u0), top(y0, u1), top(y1, u1), top(y1, u0), UP); } } }
  e.name('wing').mat(c.paint, c.gloss, 'paint'); e.b.loft([...W.across.slice(1).reverse().map(f => -f), ...W.across].map(f => { const y = f * half, x1 = xEdge(y) - W.back;
    return W.section.map(([u, du, dz]) => { const px = lerp(x0, x1, u) + du; return Tf([px, y, zOn(px, Math.min(Math.abs(y), sit)) + dz]); }); }));
  if (up > 0.02) { e.name('wing').mat(c.frame, 0.2); for (const y of W.struts.y.flatMap(v => [-L.my(v), L.my(v)])) e.b.bar([xp, y, zOn(xp, y) - 12], Tf([xp, y, zOn(xp, y) - 8]), W.struts.w, W.struts.t); }
}
