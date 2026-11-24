// The diffuser under the tail (a design's undertray: core/design.ts kit.diffuser): a dark ramp under the floor from the
// rear axle back to the tail, falling `depth` below the floor at the axle and meeting it at the tail, its front closed by
// a step, and fins hanging from it down to the ramp's lowest line (so from behind the channels between them open up
// toward the tail). It spans the floor between the rear wells' inner walls. A part: it lies outside the shell.
import type { Ctx } from '../ctx';
import { NK } from '../section';
import { lerp, type V } from '../geom';

export function diffuser(x: Ctx): void {
  const { e, s, c, L } = x, D = x.k.diffuser; if (!D) return;
  const A = L.arches.r, x0 = A.x, x1 = s.SF[s.SF.length - 1]! - 5, hw = A.yin - 20, floor = (px: number) => s.F.chain(px, true)[NK]![2] - 1.5;
  const z0 = floor(x0) - D.depth, ramp = (px: number) => lerp(z0, floor(x1), (px - x0) / (x1 - x0));
  e.name('diffuser').mat(c.dark, 0.1);
  // the ramp (seen from below), its front step
  const r = (px: number, y: number): V => [px, y, ramp(px)];
  e.face(r(x0, -hw), r(x1, -hw), r(x1, hw), r(x0, hw), [0, 0, -1]);
  e.face([x0, -hw, z0], [x0, hw, z0], [x0, hw, floor(x0)], [x0, -hw, floor(x0)], [-1, 0, 0]);
  // the fins: from the ramp down to its lowest line, both faces
  e.mat(c.trim, 0.2);
  for (let k = 0; k < D.fins; k++) { const y = lerp(-hw, hw, (k + 1) / (D.fins + 1)), tip: V = [x1, y, z0], foot: V = [x0 + 1, y, z0];
    for (const n of [[0, 1, 0], [0, -1, 0]] as V[]) e.tri(foot, r(x1, y), tip, n); }
}
