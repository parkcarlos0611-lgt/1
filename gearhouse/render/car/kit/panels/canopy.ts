// The glasshouse panel. Kind 'canopy': ONE glossy black glasshouse on the body: the screen with its black band, black
// pillars, the black roof panel, the door glass, the black B pillar, the quarter glass and the big rear glass, all on
// one surface; the belt line its border (the flank's K points), ending as a tongue between the rear wings' ridges.
// The pillar's band ahead of the roof shares every point of the screen's edge (a strip joins the two spacings).
import type { Ctx } from '../ctx';
import { TOP } from '../section';
import type { V } from '../geom';

export function canopy(x: Ctx): void {
  const { e, s, c, k, L } = x, C = k.canopy, B = C.screenBand, iQ0 = L.at(C.quarter) - s.iA, iB0 = L.at(C.bPillar) - s.iA, iR0 = L.at(C.roof.from) - s.iA, nR = s.RGX.length, edge = TOP.N - 1 - B.cols;
  e.name('canopy').mat(c.black, 0.75, 'paint'); e.cells(s.RFG); e.cells(s.SCR, (i, j) => i < B.foot || i >= B.top || j >= edge);
  // the A pillar's band: its outer line is the screen's edge (on the same straight line), so it takes the screen's points too
  const D: V[] = s.US.slice(0, iR0 + 1).map(r => r[0]!), T: V[] = s.US.slice(0, iR0 + 1).map(r => r[1]!), scr = s.SCR.map(r => r[TOP.N - 1]!);
  const a0 = D[0]!, a1 = D[D.length - 1]!, d2 = (p: V) => (p[0] - a0[0]) ** 2 + (p[1] - a0[1]) ** 2 + (p[2] - a0[2]) ** 2, Lt = d2(a1);
  const merged = [...D, ...scr.slice(1, -1)].sort((p, q) => d2(p) - d2(q)).filter((p, i, a) => i === 0 || d2(p) - d2(a[i - 1]!) > 1e-6 * Lt);
  e.strip(merged, T);
  e.cells(s.US, (i, j) => (j === 0 && i >= iR0) || (i >= iB0 && i < iQ0 && j > 0) || (i === 0 && j > 0));
  e.cells(s.RGL, (i, j) => j >= TOP.N - 1 - C.rearBlackCols || i >= nR - 1 - C.rearBlackRows);
  e.name('screenPane').mat(c.glass, 0.5, 'glass'); e.cells(s.SCR, (i, j) => i >= B.foot && i < B.top && j < edge);
  e.name('sidePane').mat(c.glass, 0.5, 'glass'); e.cells(s.US, (i, j) => j > 0 && i > 0 && i < iB0);
  e.name('quarterPane').mat(c.glass, 0.5, 'glass'); e.cells(s.US, (i, j) => j > 0 && i >= iQ0);
  e.name('rearPane').mat(c.glass, C.rearGloss, 'glass'); e.cells(s.RGL, (i, j) => j < TOP.N - 1 - C.rearBlackCols && i < nR - 1 - C.rearBlackRows);
}
