// The glasshouse panel. Kind 'canopy': ONE glossy black glasshouse on the body: the screen with its black band, black
// pillars, the black roof panel, the door glass, the black B pillar, the quarter glass and the big rear glass, all on
// one surface; the belt line its border (the flank's K points), ending as a tongue between the rear wings' ridges.
// The pillar's band ahead of the roof shares every point of the screen's edge (a strip joins the two spacings).
import type { Ctx } from '../ctx';
import { TOP } from '../section';
import { cross, dot, mir, mix, sub, un, type Grid, type V } from '../geom';
import { border } from '../emit';
import { glassRibs } from './deck';

export function canopy(x: Ctx): void {
  if (x.k.canopy.kind === 'buttress') return buttress(x);
  if (x.k.canopy.kind === 'bubble') return bubble(x);
  const { e, s, c, k, L } = x, C = k.canopy, B = C.screenBand, iQ0 = L.at(C.quarter) - s.iA, iB0 = L.at(C.bPillar) - s.iA, iR0 = L.at(C.roof.from) - s.iA, nR = s.RGX.length, edge = TOP.N - 1 - B.cols;
  e.name('canopy').mat(c.black, 0.75, 'paint'); e.cells(s.RFG); e.cells(s.SCR, (i, j) => (i < B.foot || i >= B.top || j >= edge) && j < TOP.N - 2);
  // the A pillar's band: its outer line is the screen's edge (on the same straight line), so it takes the screen's points too
  const D: V[] = s.US.slice(0, iR0 + 1).map(r => r[0]!), T: V[] = s.US.slice(0, iR0 + 1).map(r => r[1]!), scr = s.SCR.map(r => r[TOP.N - 1]!);
  const a0 = D[0]!, a1 = D[D.length - 1]!, d2 = (p: V) => (p[0] - a0[0]) ** 2 + (p[1] - a0[1]) ** 2 + (p[2] - a0[2]) ** 2, Lt = d2(a1);
  const merged = [...D, ...scr.slice(1, -1)].sort((p, q) => d2(p) - d2(q)).filter((p, i, a) => i === 0 || d2(p) - d2(a[i - 1]!) > 1e-6 * Lt);
  e.strip(merged, T); e.strip(s.SCR.map(r => r[TOP.N - 2]!), merged);   // the screen's last column, joined to the same points
  e.cells(s.US, (i, j) => (j === 0 && i >= iR0) || (i >= iB0 && i < iQ0 && j > 0) || (i === 0 && j > 0));
  e.cells(s.RGL, (i, j) => j >= TOP.N - 1 - C.rearBlackCols || i >= nR - 1 - C.rearBlackRows);
  e.name('screenPane').mat(c.glass, 0.5, 'glass'); e.cells(s.SCR, (i, j) => i >= B.foot && i < B.top && j < edge);
  e.name('sidePane').mat(c.glass, 0.5, 'glass'); e.cells(s.US, (i, j) => j > 0 && i > 0 && i < iB0);
  e.name('quarterPane').mat(c.glass, 0.5, 'glass'); e.cells(s.US, (i, j) => j > 0 && i >= iQ0);
  e.name('rearPane').mat(c.glass, C.rearGloss, 'glass'); e.cells(s.RGL, (i, j) => j < TOP.N - 1 - C.rearBlackCols && i < nR - 1 - C.rearBlackRows);
}

// Kind 'buttress': the roof, the A pillars and the roof rails in the body's colour round a black-banded screen; the door
// glass, a black B pillar, a quarter glass narrowing to its tip; behind the roof two flying buttresses fall from its back
// corners to their tips on the deck: each one's outer face is the side strip carried on (the sail behind the quarter
// glass), its top the strip's rail, its inner wall drops to the deck's rail column; between them an upright rear glass
// under a header. Every border is its neighbour's own points (the roof's back edge, the deck's first row and rail column).
function buttress(x: Ctx): void {
  const { e, s, c, k, L } = x, C = k.canopy, Bt = C.buttress!, B = C.screenBand, col = k.deck.rail!.col, at = (a: number | string) => L.at(a) - s.iA;
  if (L.at(k.deck.from) !== L.at(k.lines.centre.glassFoot)) throw new Error('kit: a buttress car\'s deck starts at the rear glass\'s foot');
  const iQ0 = at(C.quarter), iB0 = at(C.bPillar), iR0 = at(C.roof.from), iT = at(C.slantFoot), iQ1 = at(Bt.quarterTip), nR = s.RGX.length, edge = TOP.N - 1 - B.cols, nt = Bt.taper, US = s.US;
  const paint = () => e.mat(c.paint, c.gloss, 'paint'), black = () => e.mat(c.black, 0.75, 'paint'), glass = (g = 0.5) => e.mat(c.glass, g, 'glass');
  // the quarter glass's top edge steps down a column a row over its last rows: the column it crosses in row i (0: none yet, 9: past the tip)
  const cutCol = (i: number) => i >= iQ1 ? 9 : i >= iQ1 - nt ? 4 - (iQ1 - i) : 0, sail = (i: number, j: number) => j > 0 && i >= iQ0 && i < iT - 1 && j < cutCol(i), pane = (i: number, j: number) => j > 0 && i >= iQ0 && i < iQ1 && j > cutCol(i);
  e.name('roof'); paint(); e.cells(s.RFG);
  const D: V[] = US.slice(0, iR0 + 1).map(r => r[0]!), T: V[] = US.slice(0, iR0 + 1).map(r => r[1]!), scr = s.SCR.map(r => r[TOP.N - 1]!);
  const a0 = D[0]!, a1 = D[D.length - 1]!, d2 = (p: V) => (p[0] - a0[0]) ** 2 + (p[1] - a0[1]) ** 2 + (p[2] - a0[2]) ** 2, Lt = d2(a1);
  const merged = [...D, ...scr.slice(1, -1)].sort((p, q) => d2(p) - d2(q)).filter((p, i, a) => i === 0 || d2(p) - d2(a[i - 1]!) > 1e-6 * Lt);
  e.strip(merged, T); e.cells(US, (i, j) => i < iT - 1 && ((j === 0 && i >= iR0) || (i === 0 && j > 0)));
  e.zip(s.RFG[s.RFG.length - 1]!, s.RGL[0]!, [0.5, 0, 1]);   // the header over the rear glass
  // the buttresses: the sail, the inner walls (beside the glass, then along the deck to the tip), the tip run out on the deck's row
  e.name('buttress'); paint(); e.cells(US, sail);
  for (let i = Math.max(iQ0, iQ1 - nt); i < iQ1; i++) { const j = cutCol(i); e.both([US[i]![j]!, US[i + 1]![j]!, US[i + 1]![j + 1]!]); }
  const iTd = L.at(C.slantFoot) - s.iDk, foot: V[] = [...s.RGL.map(r => r[col]!), ...s.DKG.slice(1, iTd).map(r => r[col]!)], top: V[] = [...C.rear.map(a => US[at(a)]![0]!), ...s.DKG.slice(1, iTd).map((_, i) => US[s.iDk + 1 + i - s.iA]![0]!)], tip = s.DKG[iTd]![col]!;
  e.wall(foot, top, [0, -1, 0]); e.tri2(foot[foot.length - 1]!, tip, top[top.length - 1]!, [0, -1, 0]);
  e.zip(US[iT - 1]!, s.DKG[iTd]!.slice(col), [0, 0, 1]);
  e.name('canopy'); black(); e.cells(s.SCR, (i, j) => (i < B.foot || i >= B.top || j >= edge) && j < TOP.N - 2); e.strip(s.SCR.map(r => r[TOP.N - 2]!), merged);
  e.cells(US, (i, j) => i >= iB0 && i < iQ0 && j > 0);
  const rearPane = (i: number, j: number) => j < col - C.rearBlackCols && i < nR - 1 - C.rearBlackRows; e.cells(s.RGL, (i, j) => !rearPane(i, j));
  e.name('screenPane'); glass(); e.cells(s.SCR, (i, j) => i >= B.foot && i < B.top && j < edge);
  e.name('sidePane'); glass(); e.cells(US, (i, j) => j > 0 && i > 0 && i < iB0);
  e.name('quarterPane'); glass(); e.cells(US, pane); for (let i = Math.max(iQ0, iQ1 - nt); i < iQ1; i++) { const j = cutCol(i); e.both([US[i]![j]!, US[i + 1]![j + 1]!, US[i]![j + 1]!]); }
  e.name('rearPane'); glass(C.rearGloss); e.cells(s.RGL as Grid, rearPane);
}

// Kind 'bubble': a cabin standing on its own belt line inboard of the crest (the shelf panel runs from the belt out to
// the crest). The roof in the body's colour, its last column the rail down to the side glass's top; behind the cabin it
// runs on as a fastback to the glass's foot, its flanks (the side strip carried on behind the B pillar) in the body's
// colour with sunk oval ports, a glass engine cover in its middle. Dark frames: the screen's band, the pillar (wide at
// its foot, where the door glass has not yet begun), the band under the rail.
function bubble(x: Ctx): void {
  const { e, s, c, k, L } = x, C = k.canopy, Bb = C.bubble!, B = C.screenBand, at = (a: number | string) => L.at(a) - s.iA, iR0 = at(C.roof.from), iG = at(Bb.glassFrom), iB0 = at(C.bPillar), edge = TOP.N - 1 - B.cols, US = s.US, RG = s.RGL;
  const paint = () => e.mat(c.paint, c.gloss, 'paint'), frame = () => e.mat(c.frame, 0.2), glass = () => e.mat(c.glass, 0.5, 'glass');
  const cv = Bb.cover, r0 = cv ? s.RGX.indexOf(L.X(cv.from)) : 0, r1 = cv ? s.RGX.indexOf(L.X(cv.to)) : 0, isCover = (i: number, j: number) => !!cv && i >= r0 && i < r1 && j < cv.cols;
  if (r0 < 0 || r1 < 0) throw new Error('kit: the glass cover\'s ends lie on stations behind the roof');
  const P = Bb.ports, pr = (P?.rows ?? []).map(([a, b]) => [at(a), at(b)] as [number, number]), inPort = (i: number) => pr.some(([a, b]) => i >= a && i < b);
  e.name('roof'); paint(); e.cells(s.RFG); e.cells(RG, (i, j) => !isCover(i, j)); e.cells(US, (i, j) => j === 0 && i >= iB0);
  e.name('buttress'); paint(); e.cells(US, (i, j) => j > 0 && i >= iB0 && !inPort(i));
  // the ports: each cell of a block cut round an oval, a dished floor sunk behind it
  if (P) for (const [a, b] of pr) for (let j = 1; j + 1 < US[a]!.length; j++) { const p00 = US[a]![j]!, p10 = US[b]![j]!, p01 = US[a]![j + 1]!, p11 = US[b]![j + 1]!, uv = (u: number, v: number) => mix(mix(p00, p10, u), mix(p01, p11, u), v);
    let n = un(cross(sub(p10, p00), sub(p01, p00))); if (dot(n, [0, 1, 1]) < 0) n = [-n[0], -n[1], -n[2]];
    const hole = Array.from({ length: P.seg }, (_, q) => { const t = (q + 0.5) / P.seg * Math.PI * 2; return uv(0.5 + P.r[0] * Math.cos(t), 0.5 + P.r[1] * Math.sin(t)); }), mid = uv(0.5, 0.5), sunk: V = [mid[0] - n[0] * P.depth, mid[1] - n[1] * P.depth, mid[2] - n[2] * P.depth];
    for (const sg of [1, -1]) { const m = (p: V) => mir(p, sg), h = hole.map(m), nn = mir(n, sg);
      e.name('buttress'); paint(); e.porthole(border(US, a, b, j, j + 1).map(m), h, nn);
      e.name('louvre').mat(c.shade, 0.2); for (let q = 0; q < h.length; q++) e.tri(m(sunk), h[q]!, h[(q + 1) % h.length]!, nn); } }
  e.name('engineCover'); glass(); e.cells(RG, isCover);
  if (cv?.ribs) e.with('part', () => glassRibs(x, RG, r0, r1, cv.cols, cv.ribs!));
  // the pillar's band ahead of the roof shares the screen's edge points (a strip joins the two spacings)
  const D: V[] = US.slice(0, iR0 + 1).map(r => r[0]!), T: V[] = US.slice(0, iR0 + 1).map(r => r[1]!), scr = s.SCR.map(r => r[TOP.N - 1]!);
  const a0 = D[0]!, a1 = D[D.length - 1]!, d2 = (p: V) => (p[0] - a0[0]) ** 2 + (p[1] - a0[1]) ** 2 + (p[2] - a0[2]) ** 2, Lt = d2(a1);
  const merged = [...D, ...scr.slice(1, -1)].sort((p, q) => d2(p) - d2(q)).filter((p, i, a) => i === 0 || d2(p) - d2(a[i - 1]!) > 1e-6 * Lt);
  e.name('screenFrame'); frame(); e.strip(merged, T); e.strip(s.SCR.map(r => r[TOP.N - 2]!), merged);
  e.cells(s.SCR, (i, j) => (i < B.foot || i >= B.top || j >= edge) && j < TOP.N - 2);
  e.cells(US, (i, j) => (j === 0 && i >= iR0 && i < iB0) || (j > 0 && i < iG));
  e.name('screenPane'); glass(); e.cells(s.SCR, (i, j) => i >= B.foot && i < B.top && j < edge);
  e.name('sidePane'); glass(); e.cells(US, (i, j) => j > 0 && i >= iG && i < iB0);
  // the rubber along the belt under the side glass
  e.with('part', () => { e.name('screenFrame'); frame(); e.seam(US.slice(iG, iB0 + 1).map(r => r[4]!), () => [0, 0.6, 0.8], 2 * C.side.edge, 3)([1, -1]); });
}
