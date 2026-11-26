// The door mirror: a head lofted through its outline at a few stations across (scaled about its centre), on a short
// stalk from the door's top front corner, the glass across its back. The whole part moves with its anchor.
import type { Ctx } from '../ctx';
import type { V } from '../geom';
import type { MirrorSpec } from '../spec';

export function mirror(x: Ctx, M: MirrorSpec): void {
  const { e, c, L } = x, dx = L.mx(M.at[0]) - M.at[0], dy = L.my(M.at[1]) - M.at[1], [cx, cz] = [M.at[0], M.at[2]];
  for (const sg of [1, -1]) { const P = (p: V): V => [p[0] + dx, sg * (p[1] + dy), p[2]];
    const hs = (y: number, k: number, ox: number): V[] => M.head.map(([px, pz]) => P([cx + (px - cx) * k + ox, y, cz + (pz - cz) * k]));
    e.name('mirror').mat(c.paint, c.gloss, 'paint'); e.b.loft(M.loft.map(([y, k, ox]) => hs(y, k, ox))).bar(P(M.stalk[0]), P(M.stalk[1]), M.stalk[2], M.stalk[3]);
    const [g0, g1] = M.glass; e.name('mirrorGlass').mat(c.silver, 0.9, 'metal'); e.face(P(g0), P([g0[0], g1[1], g0[2]]), P(g1), P([g1[0], g0[1], g1[2]]), [1, 0, 0]); }
}
