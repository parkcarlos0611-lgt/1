// Openings cut into the nose's or the tail's face from the spec (HoleSpec): the block of cells each takes (so the
// panel leaves them out), the ring round the outline in the skin's paint, the pocket, and what sits in it (lenses on
// its back, bars across it, an emblem). The face looks along ±x; the outline is drawn on it as seen along x.
import type { Ctx } from '../ctx';
import type { HoleSpec } from '../spec';
import { add, mir, mix, scl, type Grid, type V } from '../geom';
import { annulus, blockLoop, centreLoop, onBlock, outline, yzOf } from '../punch';

/** the block of cells a hole takes: rows lo..hi (cells lo..hi-1) and chain cells q0..q1-1 */
export function holeBlock(h: HoleSpec, iC: number): { lo: number; hi: number; q0: number; q1: number } {
  const [r0, r1] = h.centre ? [iC, h.rows as number] : h.rows as [number, number]; return { lo: Math.min(r0, r1), hi: Math.max(r0, r1), q0: h.pts[0], q1: h.pts[1] }; }
export const inHoles = (hs: HoleSpec[], iC: number) => { const B = hs.map(h => holeBlock(h, iC)); return (i: number, q: number) => B.some(b => i >= b.lo && i < b.hi && q >= b.q0 && q < b.q1); };

/** cut the holes into grid G (n: the face's outward look, iC: the centre line's row, `inward` the way into the body along x) */
export function cutHoles(x: Ctx, G: Grid, hs: HoleSpec[], n: V, iC: number, inward: number): void {
  const { e, c } = x;
  for (const h of hs) { const b = holeBlock(h, iC), d: V = [inward * h.depth, 0, 0], at = onBlock(G, b.lo, b.hi, b.q0, b.q1, n, !!h.centre);
    const ring = outline(at, n, h.at[0], h.at[1], h.size[0], h.size[1], h.pow, h.seg);
    const sides: [V[], V[], number][] = h.centre ? [[centreLoop(G, iC, h.rows as number, b.q0, b.q1), ring, 1]] : [1, -1].map(sg => [blockLoop(G, b.lo, b.hi, b.q0, b.q1).map(p => mir(p, sg)), ring.map(p => mir(p, sg)), sg] as [V[], V[], number]);
    for (const [loop, rg, sg] of sides) {
      e.name(h.name).mat(c.paint, c.gloss, 'paint'); annulus(e, loop, rg, mir(n, sg)); e.pocket(rg, d, n, c[h.wall], h.back);
      // what sits in it, on the side's own outline
      const back = (y: number, z: number, lift: number): V => { const p = at(...yzOf(n, y, z)); return mir(add(add(p, d), scl(n, lift)), sg); };
      e.with('part', () => {
        for (const l of h.lenses ?? []) { e.name(l.name).mat(c[l.colour], l.gloss, l.kind);
          e.fan(Array.from({ length: l.seg }, (_, k) => { const t = k / l.seg * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t); return back(h.at[0] + l.at[0] + l.size[0] * Math.sign(cs) * Math.abs(cs) ** (2 / l.pow), h.at[1] + l.at[1] + l.size[1] * Math.sign(sn) * Math.abs(sn) ** (2 / l.pow), 2); }), n); }
        if (h.bars) { e.name(h.name).mat(c[h.bars.colour], 0.2);
          for (const z of h.bars.z) { const u = (z - h.at[1]) / h.size[1], w = h.size[0] * Math.max(0, 1 - Math.abs(u) ** h.pow) ** (1 / h.pow) - 6; if (w <= 0) continue;
            const p = at(...yzOf(n, h.at[0] - w, z)), q = at(...yzOf(n, h.at[0] + w, z)); e.b.bar(mir(add(p, scl(d, h.bars.at)), sg), mir(add(q, scl(d, h.bars.at)), sg), h.bars.t, h.bars.t * 0.6); } }
        if (h.emblem) { const m = h.emblem; e.name('badge').mat(c[m.colour], m.gloss, 'metal'); e.fan(m.pts.map(([y, z]) => back(h.at[0] + y, h.at[1] + z, 4)), n); }
      });
    }
    void mix;
  }
}
