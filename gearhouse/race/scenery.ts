// Millbrook's surroundings (review 88): where every building, tree and fence stands, and the ground's own features
// (the railway beside the Railway Straight, the river under the Byfleet Banking, the aerodrome inside, the paddock's
// apron, the earth banks behind the bankings). The props are meshes (render/props/*); a placing is a prop's name, where
// its anchor stands, its heading (where its -x points; its front, -y, faces the track when placed by `facing`), and
// for a deck over the track its height. Seeded, so the woods stand in the same places every time.
import type { Track } from './track';

export interface Placed { kind: string; x: number; y: number; heading: number; z?: number; overhead?: boolean; /** a size the prop's mesh takes (an abutment's height, mm) */ arg?: number }
export interface GroundLine { pts: [number, number][]; width: number; kind: 'rail' | 'river' | 'road' }
/** the ground's patches: the paddock's gravel apron, the mown strip; the stone paving and paths of a square, a gravel
 *  car park, the trodden grass of a spectators' enclosure (review 181) */
export interface GroundArea { pts: [number, number][]; kind: 'apron' | 'mown' | 'paving' | 'gravel' | 'trodden' }
/** a tree of the woods (review 181): drawn many at once by the renderer, near as a low-poly tree, far as a card. kind:
 *  0 round-headed (oak, elm), 1 Scots pine, 2 poplar, 3 bush; size: times the tree's mesh; rank 0..1: a density keeps
 *  the trees whose rank is under its share (DENSITY_SHARE), so the thinner woods are the denser ones thinned */
export interface Tree { x: number; y: number; z: number; kind: number; size: number; heading: number; rank: number }
/** props: drawn one by one (and in the baked pictures); detail: the many small things of the site plan (review 181),
 *  which the live renderer gathers into a few meshes by place; trees: the woods, instanced */
export interface Scenery { props: Placed[]; lines: GroundLine[]; areas: GroundArea[]; railway: [number, number][]; trees?: Tree[]; detail?: Placed[] }
/** the graphics setting 풍경 밀도 (scenery density): how many of the woods' trees stand */
export type Density = 'low' | 'mid' | 'high';
export const DENSITY_SHARE: Record<Density, number> = { low: 0.3, mid: 0.6, high: 1 };
let density: Density = 'mid';
/** the setting as the shell holds it (ui/shell/settings.ts); the renderer reads it each frame */
export function setSceneryDensity(d: Density): void { if (d in DENSITY_SHARE) density = d; }
export function sceneryDensity(): Density { return density; }
/** the trees that stand at a density */
export function treesAt(S: Scenery, d: Density = density): Tree[] { const k = DENSITY_SHARE[d]; return (S.trees ?? []).filter(t => t.rank < k); }

export function millbrookScenery(T: Track): Scenery { const L = T.length, W2 = T.spec.width / 2, props: Placed[] = [], lines: GroundLine[] = [], areas: GroundArea[] = [];
  let r = 20251122; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const piece = (name: string) => { let acc = 0; for (const p of T.spec.pieces) { const len = p.kind === 'straight' ? p.len : Math.abs(p.radius * p.turn * Math.PI / 180); if (p.name === name) return { s0: acc, s1: acc + len }; acc += len; } return { s0: 0, s1: 0 }; };
  /** a prop beside the track at s, `off` to the left (+) or right (-), its front toward the track */
  const facing = (kind: string, s: number, off: number, z?: number) => { const p = T.point(s, off), h = T.at(s).h; props.push({ kind, x: p.x, y: p.y, heading: off < 0 ? h + Math.PI : h, z }); };   // the drawing mirrors a mesh's sides, so a front (-y) toward the track needs the half turn
  const start = T.spec.landmarks.find(l => l.kind === 'line')!.s, home = piece('Home Straight'), mem = piece("Members' Banking"), rail = piece('Railway Straight'), byf = piece('Byfleet Banking');
  // ---- the start: stands outside along the straight, the clock, the timing box and the scoreboard ----
  for (let k = 0; k < 6; k++) facing('grandstandBay', start - 40 + k * 15.6, -(W2 + 9));
  facing('timingBox', start, W2 + 6); facing('clockTower', start + 22, W2 + 9); facing('scoreboard', start + 130, -(W2 + 12));
  for (let k = 0; k < 5; k++) facing('hoarding', start + 170 + k * 10, -(W2 + 5));
  // ---- the paddock inside the straight: the clubhouse, garages, pumps, a tea hut on a gravel apron ----
  { const s0 = start + 120, s1 = start + 380, apron: [number, number][] = []; for (let s = s0; s <= s1; s += 20) { const p = T.point(s, W2 + 8); apron.push([p.x, p.y]); } for (let s = s1; s >= s0; s -= 20) { const p = T.point(s, W2 + 52); apron.push([p.x, p.y]); } areas.push({ pts: apron, kind: 'apron' });
    facing('clubhouseWing', s0 + 24, W2 + 40); facing('clubhouseCentre', s0 + 36, W2 + 40); facing('clubhouseWing', s0 + 48, W2 + 40);
    for (let k = 0; k < 6; k++) facing('garageBay', s0 + 90 + k * 14.5, W2 + 34); facing('fuelPumps', s0 + 78, W2 + 14); facing('teaHut', s0 + 8, W2 + 14); }
  // ---- the Members' Bridge across the track ----
  { const s = T.spec.landmarks.find(l => l.name === "Members' Bridge")!.s, h = T.at(s).h, top = (o: number) => T.height(s, o);
    // the deck lies level 5.8 m over the higher edge (here the banking's top); each abutment stands on the ground at its
    // side and reaches up to the deck, so the low side's is the taller (review 113: it stood 5.8 m and the deck floated)
    const deck = Math.max(top(-W2), top(W2)) + 5.8; for (const o of [-(W2 + 3), W2 + 3]) { const z = top(o), p = T.point(s, o); props.push({ kind: 'bridgeAbutment', x: p.x, y: p.y, heading: o < 0 ? h + Math.PI : h, z, arg: Math.round((deck - z) * 1000) }); }
    for (const o of [-13, 0, 13]) { const p = T.point(s, o); props.push({ kind: 'bridgeDeck', x: p.x, y: p.y, heading: h - Math.PI / 2, z: deck, overhead: true }); } }
  // ---- the railway: a line outside the Railway Straight, running on past both ends; a station and signal box ----
  const railway: [number, number][] = []; { const off = -(W2 + 26), a = T.point(rail.s0, off), b = T.point(rail.s1, off), dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    for (let d = -900; d <= l + 900; d += 30) railway.push([a.x + ux * d, a.y + uy * d]); lines.push({ pts: railway, width: 4, kind: 'rail' });
    const at = (d: number, side: number): Placed => ({ kind: '', x: a.x + ux * d - uy * side, y: a.y + uy * d + ux * side, heading: Math.atan2(uy, ux) + (side > 0 ? Math.PI : 0) });
    for (let k = 0; k < 3; k++) props.push({ ...at(-500 + k * 15.2, 9), kind: 'platform' }); props.push({ ...at(-485, 16), kind: 'stationBuilding' }); props.push({ ...at(-300, -8), kind: 'signalBox' });
    for (let d = -880; d < l + 880; d += 55) props.push({ ...at(d, -6), kind: 'telegraphPole' }); }
  // ---- the river under the Byfleet Banking, and the bridge's parapets ----
  { const s = T.spec.landmarks.find(l => l.name === 'Byfleet Bridge')!.s, pts: [number, number][] = []; for (let o = -420; o <= 420; o += 30) { const p = T.point(s + Math.sin(o / 90) * 25, o); pts.push([p.x, p.y]); } lines.push({ pts, width: 9, kind: 'river' });
    for (const o of [-(W2 + 1), W2 + 1]) { const p = T.point(s, o); props.push({ kind: 'riverBridge', x: p.x, y: p.y, heading: T.at(s).h + (o < 0 ? Math.PI : 0), z: T.height(s, o) }); } }   /* on the edge of the road, the banking's top on the high side */
  // ---- the aerodrome inside: a mown strip, hangars and works along the Railway Straight's inside, aeroplanes, a windsock ----
  { const mid = T.nodes.reduce((a, n) => [a[0]! + n.x / L, a[1]! + n.y / L], [0, 0]); const h = T.at((rail.s0 + rail.s1) / 2).h, ux = Math.cos(h), uy = Math.sin(h);
    areas.push({ pts: [[-500, -60], [500, -60], [500, 60], [-500, 60]].map(([a, b]) => [mid[0]! + ux * a! - uy * b!, mid[1]! + uy * a! + ux * b!] as [number, number]), kind: 'mown' });
    const s0 = rail.s0 + 250; for (let k = 0; k < 4; k++) facing('hangarBay', s0 + k * 15.5, W2 + 30); for (let k = 0; k < 5; k++) facing('factoryBay', s0 + 120 + k * 15.5, W2 + 30);
    for (let k = 0; k < 3; k++) { const p = T.point(s0 + 15 + k * 20, W2 + 16); props.push({ kind: 'biplane', x: p.x, y: p.y, heading: h + Math.PI / 2 + (rnd() - 0.5) * 0.4 }); }
    props.push({ kind: 'windsock', x: mid[0]! + 40, y: mid[1]! - 30, heading: 0 }); }
  // ---- straw bales on the corner entries, the woods round the outside and on the Members' hill ----
  for (const s of [mem.s0 - 30, byf.s0 - 30, home.s1 - 10]) for (let k = 0; k < 3; k++) facing('hayBales', s + k * 6, W2 + 3);
  const encl = enclosures(T), inEnclosure = (s: number, o: number) => encl.some(e => s > e.s0 - 5 && s < e.s1 + 5 && o > e.o0 - 3 && o < e.o1 + 3);
  const busy = (s: number) => Math.abs(T.gap(start + 100, s)) < 380;   // keep the stands' side open
  const nearRail = (s: number) => s > rail.s0 - 120 && s < rail.s1 + 120, works = (s: number) => s > rail.s0 + 200 && s < rail.s0 + 230 + 9 * 15.5;
  for (let s = 0; s < L; s += 6) { if (busy(s)) continue; const k = rnd(); if (k < 0.7 && !nearRail(s)) { const kind = k < 0.2 ? 'treeRound' : k < 0.32 ? 'treePoplar' : 'treePine', bank = T.bankAt(s).b ? T.height(s, -W2) * 2.4 : 0, p = T.point(s + rnd() * 6, -(W2 + 5 + bank + rnd() * 30)); props.push({ kind, x: p.x, y: p.y, heading: rnd() * 6.28 }); }
    if (s > mem.s0 + 60 && s < mem.s1 - 60 && rnd() < 0.6) { const o = W2 + 7 + rnd() * 45, p = T.point(s, o), q: Placed = { kind: rnd() < 0.6 ? 'treeRound' : 'bush', x: p.x, y: p.y, heading: rnd() * 6.28 }; if (!inEnclosure(s, o)) props.push(q); }   // (none inside a spectators' enclosure, review 181; the draws kept so the rest stand where they stood)
    if (!works(s) && !(s > mem.s0 + 60 && s < mem.s1 - 60) && rnd() < 0.18) { const o = W2 + 12 + rnd() * 40, p = T.point(s, o), q: Placed = { kind: rnd() < 0.5 ? 'treeRound' : 'bush', x: p.x, y: p.y, heading: rnd() * 6.28 }; if (!inEnclosure(s, o)) props.push(q); }   // inside the circuit, a few
    if (rnd() < 0.08 && !nearRail(s) && !T.bankAt(s).b) { const p = T.point(s, -(W2 + 6 + rnd() * 4)); /* not on the earth bank behind a banking */ props.push({ kind: 'bush', x: p.x, y: p.y, heading: rnd() * 6.28 }); } }
  const mown = areas.find(a => a.kind === 'mown')!.pts;
  const { trees, detail } = millbrookPlan(T, { props, lines, areas, start, HOME: home.s1, ME: mem.s1, RA: rail.s1, BY: byf.s1, mown, encl });
  return { props, lines, areas, railway, trees, detail }; }

/** the spectators' enclosures of the site plan (review 165, purple): inside the Members' Banking, and twice inside the
 *  Byfleet Banking (that by the river cut in two either side of it); along the track from s0 to s1, from o0 to o1 to its left */
export function enclosures(T: Track): { s0: number; s1: number; o0: number; o1: number }[] { const W2 = T.spec.width / 2, HOME = pieceSpan(T, 'Home Straight').s1, RA = pieceSpan(T, 'Railway Straight').s1, BY = pieceSpan(T, 'Byfleet Banking').s1, river = RA + 420;
  return [{ s0: HOME + 120, s1: HOME + 420, o0: W2 + 8, o1: W2 + 40 }, { s0: RA + 200, s1: river - 28, o0: W2 + 8, o1: W2 + 35 }, { s0: river + 28, s1: RA + 700, o0: W2 + 8, o1: W2 + 35 }, { s0: BY - 700, s1: BY - 250, o0: W2 + 8, o1: W2 + 35 }]; }

// ---- the site plan carried out (review 181: tools/ref/plan/millbrook_enrich_plan.py, docs/reference/millbrook_enrich_plan_165.png):
// the plan's every place by distance along the track and offset to its left, as its script drew them. The woods: a
// dense belt outside the track (W2+30..150 m out) but along the stands and the car park, thinner beyond the railway;
// eight groves inside; a line of trees along the inside of every straight and banking (but the start and the
// aerodrome), a wood four rows deep behind the paddock and two rows behind the car park. The spectators' enclosures,
// marshals' posts at the corners, straw bales at their entries, advertising boards along the straights; at the start the
// clock tower's square (paving, a low brick wall, flower beds, benches, lamps, three flagpoles and a notice board),
// paths to the timing box and the paddock, bunting along both fences, marquees and a kiosk, the car park with the
// period's cars, its road and telegraph poles. Each tree is kept clear of the concrete (W2 + 12 m), the railway, the
// river, the roads, the buildings, the mown strip and the plan's squares and enclosures. Seeded.
function millbrookPlan(T: Track, c: { props: Placed[]; lines: GroundLine[]; areas: GroundArea[]; start: number; HOME: number; ME: number; RA: number; BY: number; mown: [number, number][]; encl: { s0: number; s1: number; o0: number; o1: number }[] }): { trees: Tree[]; detail: Placed[] } {
  const W2 = T.spec.width / 2, L = T.length, { start, HOME, ME, RA, BY } = c, trees: Tree[] = [], detail: Placed[] = [];
  let r = 16501651; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const zAt = (s: number, o: number) => Math.abs(o) < W2 + 40 ? T.ground(s, o) : -0.03;
  /** a thing at (s, o); its front toward the track (as `facing`), turned by `turn` more */
  const put = (kind: string, s: number, o: number, arg?: number, turn = 0) => { const p = T.point(s, o), h = T.at(s).h; detail.push({ kind, x: p.x, y: p.y, z: zAt(s, o), heading: (o < 0 ? h + Math.PI : h) + turn, arg }); };
  /** a run of a fence or wall from (s0, o0) to (s1, o1), in pieces up to `piece` m: each piece's mesh `kind` its length long */
  const run = (kind: string, s0: number, o0: number, s1: number, o1: number, piece = 10) => { const a = T.point(s0, o0), b = T.point(s1, o1), len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(len / piece));
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, sa = s0 + (s1 - s0) * t0, sb = s0 + (s1 - s0) * t1, oa = o0 + (o1 - o0) * t0, ob = o0 + (o1 - o0) * t1, p = T.point(sa, oa), q = T.point(sb, ob), sm = (sa + sb) / 2, om = (oa + ob) / 2;
      detail.push({ kind, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: zAt(sm, om), heading: Math.atan2(p.y - q.y, p.x - q.x), arg: Math.round(Math.hypot(q.x - p.x, q.y - p.y) * 1000) }); } };
  const band = (s0: number, s1: number, o0: number, o1: number, step = 10): [number, number][] => { const a: [number, number][] = [], b: [number, number][] = [];
    for (let s = s0; s < s1; s += step) { const p = T.point(s, o0), q = T.point(s, o1); a.push([p.x, p.y]); b.push([q.x, q.y]); } const p = T.point(s1, o0), q = T.point(s1, o1); a.push([p.x, p.y]); b.push([q.x, q.y]); return [...a, ...b.reverse()]; };
  // ---- what keeps the trees away: the concrete, the lines, the buildings, the mown strip, the plan's own squares ----
  const cell = 30, grid = new Map<string, [number, number][]>(); for (const n of T.nodes) { const k = `${Math.floor(n.x / cell)},${Math.floor(n.y / cell)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push([n.x, n.y]); }
  const trackGap = (x: number, y: number) => { let d = Infinity; const i = Math.floor(x / cell), j = Math.floor(y / cell); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [nx, ny] of grid.get(`${i + a},${j + b}`) ?? []) d = Math.min(d, (nx - x) ** 2 + (ny - y) ** 2); return Math.sqrt(d); };
  const segGap = (pts: [number, number][], x: number, y: number) => { let d = Infinity; for (let k = 0; k + 1 < pts.length; k++) { const [ax, ay] = pts[k]!, [bx, by] = pts[k + 1]!, dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); d = Math.min(d, Math.hypot(ax + dx * t - x, ay + dy * t - y)); } return d; };
  const inPoly = (pts: [number, number][], x: number, y: number) => { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  const BIG: Record<string, number> = { grandstandBay: 13, clubhouseWing: 10, clubhouseCentre: 10, garageBay: 11, hangarBay: 19, factoryBay: 14, stationBuilding: 11, platform: 10, signalBox: 6, biplane: 9, windsock: 5, bridgeAbutment: 7, riverBridge: 10, clockTower: 5, timingBox: 5, scoreboard: 9, hoarding: 6, teaHut: 5, fuelPumps: 5, telegraphPole: 2.5 };
  const big = c.props.filter(p => BIG[p.kind]), keepOut: [number, number][][] = [];
  const clear = (x: number, y: number) => { if (trackGap(x, y) < W2 + 12 || inPoly(c.mown, x, y)) return false;
    for (const l of c.lines) if (segGap(l.pts, x, y) < (l.kind === 'rail' ? 9 : l.kind === 'river' ? l.width / 2 + 6 : l.width / 2 + 4)) return false;
    for (const p of big) if (Math.hypot(p.x - x, p.y - y) < BIG[p.kind]! + 3) return false; for (const k of keepOut) if (inPoly(k, x, y)) return false; return true; };
  const tree = (x: number, y: number, z: number, mix: number[], rank = rnd()) => { const k = rnd(); let kind = 0; for (let i = 0, acc = 0; i < mix.length; i++) { acc += mix[i]!; if (k < acc) { kind = i; break; } kind = i; }
    const size = 0.82 + rnd() * 0.45, heading = rnd() * 6.283; if (clear(x, y)) trees.push({ x, y, z, kind, size: kind === 3 ? size * 1.1 : size, heading, rank }); };
  const treeAt = (s: number, o: number, mix: number[], rank?: number) => { const p = T.point(s, o); tree(p.x, p.y, zAt(s, o), mix, rank); };
  const BELT = [0.42, 0.3, 0.1, 0.18], LINE = [0.55, 0.05, 0.3, 0.1], GROVE = [0.62, 0.28, 0.04, 0.06];
  // ---- the start (the plan's detail, review 165): along the track from the line (u) and to its left (v) ----
  const S = (u: number) => start + u, cu = 22, V = W2;
  // the clock tower's square: paving, a low brick wall round three sides (a gate in the back, the paths through the
  // sides), two flower beds, four benches, five lamps, three flagpoles, the notice board; the paths to the timing box and the paddock
  c.areas.push({ pts: band(S(cu - 24), S(cu + 30), V + 3.5, V + 30, 6), kind: 'paving' }, { pts: band(S(cu + 30), S(140), V + 15, V + 19, 10), kind: 'paving' }, { pts: band(S(-10), S(cu - 24), V + 15, V + 19, 6), kind: 'paving' });
  keepOut.push(band(S(cu - 28), S(cu + 34), V, V + 34, 6), band(S(-14), S(150), V + 12, V + 22, 10));
  run('lowWall', S(cu - 24), V + 30.5, S(cu - 3), V + 30.5, 7); run('lowWall', S(cu + 3), V + 30.5, S(cu + 30), V + 30.5, 7);
  for (const u of [cu - 24, cu + 30]) { run('lowWall', S(u), V + 3.5, S(u), V + 15, 12); run('lowWall', S(u), V + 19, S(u), V + 30.5, 12); }
  for (const u of [cu - 16, cu + 16]) put('flowerBed', S(u), V + 20);
  for (const [u, v, t] of [[cu - 10, V + 27, 0], [cu + 10, V + 27, 0], [cu - 20, V + 12, Math.PI], [cu + 24, V + 12, Math.PI]] as const) put('parkBench', S(u), v, undefined, t);
  for (const [u, v] of [[cu - 22, V + 5], [cu + 28, V + 5], [cu - 22, V + 28], [cu + 28, V + 28], [cu, V + 28]] as const) put('streetLamp', S(u), v);
  for (let k = 0; k < 3; k++) put('flagpole', S(cu + 6 + k * 4), V + 7, k);
  put('noticeBoard', S(cu - 6.5), V + 5.3);
  // bunting along both fences; straw bales before the line; marquees and a kiosk across the track; the telegraph poles
  for (const v of [V + 3, -(V + 3)]) for (let u = -60; u < 140; u += 10) run('bunting', S(u), v, S(u + 10), v, 10);
  for (const u of [-38, -32, -26]) put('hayBales', S(u), V + 3.6);
  for (const [u, a] of [[-55, 0], [105, 1], [125, 0]] as const) put('marquee', S(u), -(V + 26), a);
  keepOut.push(band(S(-64), S(134), -(V + 36), -(V + 20), 10));
  for (const u of [-62, -30, 150]) put('telegraphPole', S(u), -(V + 6));
  // the car park: gravel; four rows of nine of the period's cars, nose to tail along the track; its road out and poles beside it
  c.areas.push({ pts: band(S(-60), S(140), -(V + 45), -(V + 110), 10), kind: 'gravel' }); keepOut.push(band(S(-64), S(144), -(V + 41), -(V + 112), 10));
  for (let row = 0; row < 4; row++) for (let k = 0; k < 9; k++) { const u = -50 + k * 20 + (row % 2) * 6 + 2.3, v = [-(V + 55), -(V + 72), -(V + 88), -(V + 102)][row]! - 0.9, p = T.point(S(u), v), h = T.at(S(u)).h;
    detail.push({ kind: 'parkedCar', x: p.x, y: p.y, z: -0.02, heading: h + (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.06, arg: Math.floor(rnd() * 11) }); }
  { const road: [number, number][] = []; for (let k = 0; k <= 5; k++) { const p = T.point(S(10), -(V + 110 + k * 40)); road.push([p.x, p.y]); } c.lines.push({ pts: road, width: 8, kind: 'road' });
    for (let k = 0; k < 4; k++) put('telegraphPole', S(19), -(V + 112) - k * 8); for (let d = 150; d <= 310; d += 35) put('telegraphPole', S(19), -(V + d)); }
  // the wood behind the paddock, four rows; two rows behind the car park, the road kept open (always there: rank under 0.6)
  for (let u = -60; u < 260; u += 6) for (let row = 0; row < 4; row++) treeAt(S(u + (rnd() - 0.5) * 4 + row * 3), V + 58 + row * 9 + rnd() * 4, BELT.map((m, i) => i === 3 ? 0.05 : m), rnd() * 0.6);
  for (let u = -66; u < 260; u += 6) for (let row = 0; row < 2; row++) { if (u >= 0 && u <= 20) continue; treeAt(S(u + (rnd() - 0.5) * 4 + row * 3), -(V + 113) - row * 6, BELT, rnd() * 0.6); }
  // ---- the spectators' enclosures: trodden grass, a white fence round, benches in two rows, marquees and a kiosk ----
  for (const e of c.encl) { c.areas.push({ pts: band(e.s0, e.s1, e.o0, e.o1, 10), kind: 'trodden' }); keepOut.push(band(e.s0 - 4, e.s1 + 4, e.o0 - 3, e.o1 + 4, 10));
    run('railFence', e.s0, e.o0, e.s1, e.o0); run('railFence', e.s0, e.o1, e.s1, e.o1); run('railFence', e.s0, e.o0, e.s0, e.o1); run('railFence', e.s1, e.o0, e.s1, e.o1);
    const tents: number[] = []; for (let s = e.s0 + 40; s < e.s1 - 20; s += 90) tents.push(s);
    tents.forEach((s, k) => put('marquee', s, e.o1 - 10, k % 3 === 1 ? 1 : 0));
    for (let s = e.s0 + 6; s < e.s1 - 4; s += 7) { if (tents.some(t => Math.abs(t - s) < 9)) continue; put('parkBench', s, e.o0 + 4); if ((s - e.s0) % 14 < 7) put('parkBench', s + 3.5, e.o0 + 10); } }
  // ---- the corners: a marshal's post at each (red), straw bales at the entries (yellow; none on the bales there already) ----
  for (const s of [HOME + 20, (HOME + ME) / 2, ME - 20, RA + 20, (RA + BY) / 2, BY - 20, BY + 60]) put('marshalPost', s, W2 + 5);
  const bales = c.props.filter(p => p.kind === 'hayBales');
  for (const s of [ME + 30, BY + 30, BY + 90, RA - 40, HOME - 60]) for (let k = 0; k < 3; k++) { const p = T.point(s + k * 8, W2 + 3); if (bales.some(b => Math.hypot(b.x - p.x, b.y - p.y) < 4)) continue; put('hayBales', s + k * 8, W2 + 3); }
  // ---- the advertising boards along the straights (blue), outside, the firms in turn ----
  { let k = 0; for (let s = start + 220; s < HOME - 40; s += 30) put('adBoard', s, -(W2 + 5), k++); for (let s = ME + 120; s < RA - 120; s += 45) put('adBoard', s, -(W2 + 5), k++); }
  // ---- the woods: the belt outside (but along the stands and the car park, and thinner beyond the railway), the
  //      groves inside, the line along the inside (two rows). Tightened on review (the plan's belt read thin and far
  //      from the driver's seat): the belt from W2+15 m (the plan's drawing from W2+30), on a 6 m grid jittered 3 m,
  //      the inner line from W2+14 m; the middle density (보통) about 1.6 times the plan's own count ----
  const segs: [number, number][] = []; { let cur: number | null = null; for (let s = 0; s < L; s += 10) { const ok = !(s >= start - 160 && s <= start + 420) && !(s >= ME - 60 && s <= RA + 60); if (ok && cur === null) cur = s; if (!ok && cur !== null) { segs.push([cur, s]); cur = null; } } if (cur !== null) segs.push([cur, L]); }
  const belt = (s0: number, s1: number, o0: number, o1: number, step: number) => { for (let s = s0; s < s1; s += step) for (let o = o0; o < o1; o += step) { const ss = s + (rnd() - 0.5) * 6, oo = o + (rnd() - 0.5) * 6; treeAt(ss, -oo, BELT); } };
  for (const [a, b] of segs) belt(a, b, W2 + 15, W2 + 150, 6);
  belt(ME - 60, RA + 60, W2 + 40, W2 + 130, 6.5);
  for (const [s, off, R] of [[RA + 500, W2 + 110, 70], [RA + 1100, W2 + 140, 85], [BY - 300, W2 + 95, 60], [ME - 300, W2 + 150, 65], [HOME + 300, W2 + 190, 55], [RA + 1500, W2 + 80, 50], [ME + 300, W2 + 120, 60], [ME + 700, W2 + 110, 55]] as const) {
    const m = T.point(s, off), n = Math.round(R * R / 40 / 0.6); for (let k = 0; k < n; k++) { const a = rnd() * 6.283, d = R * Math.sqrt(rnd()); tree(m.x + d * Math.cos(a), m.y + d * Math.sin(a), -0.03, GROVE); } }
  for (let s = 0; s < L; s += 6) { if ((s >= start - 100 && s <= start + 420) || (s >= ME + 200 && s <= RA - 200)) continue;
    const e = c.encl.find(q => s > q.s0 - 6 && s < q.s1 + 6); for (const row of [0, 1]) { const o = e ? e.o1 + 6 + row * 6 + rnd() * 3 : W2 + 14 + row * 7 + rnd() * 4; treeAt(s + (rnd() - 0.5) * 3 + row * 3, o, LINE); } }
  return { trees, detail }; }

/** where a named piece of the track runs (the first piece of that name) */
export function pieceSpan(T: Track, name: string): { s0: number; s1: number } { let acc = 0; for (const p of T.spec.pieces) { const len = p.kind === 'straight' ? p.len : Math.abs(p.radius * p.turn * Math.PI / 180); if (p.name === name) return { s0: acc, s1: acc + len }; acc += len; } return { s0: 0, s1: 0 }; }
/** the common placing helpers for a track's surroundings: a prop beside the track facing it, a gravel apron, and a
 *  check that a point keeps clear of every part of the concrete (a tree must not stand on another stretch of road) */
function placer(T: Track, props: Placed[]) { const W2 = T.spec.width / 2;
  const facing = (kind: string, s: number, off: number) => { const p = T.point(s, off), h = T.at(s).h; props.push({ kind, x: p.x, y: p.y, heading: off < 0 ? h + Math.PI : h }); };
  const apron = (s0: number, s1: number, o0: number, o1: number): GroundArea => { const pts: [number, number][] = []; for (let s = s0; s <= s1; s += 10) { const p = T.point(s, o0); pts.push([p.x, p.y]); } for (let s = s1; s >= s0; s -= 10) { const p = T.point(s, o1); pts.push([p.x, p.y]); } return { pts, kind: 'apron' }; };
  const clear = (x: number, y: number, margin: number) => { let d = Infinity; for (let i = 0; i < T.nodes.length; i += 2) { const n = T.nodes[i]!; d = Math.min(d, (n.x - x) ** 2 + (n.y - y) ** 2); } return Math.sqrt(d) > W2 + margin; };
  return { facing, apron, clear }; }

// Ashcombe Park's surroundings (review 162): the period's buildings put to the road course: the pits and the paddock
// inside the main straight (garages, the clubhouse, fuel pumps, a tea hut on a gravel apron), the timing box and the
// clock on the pit side of the line, one grandstand and the scoreboard across the road, straw bales on the slow
// corners' outsides, and tree lines round the park, kept clear of every stretch of the road. Seeded.
export function roadScenery(T: Track): Scenery { const W2 = T.spec.width / 2, L = T.length, props: Placed[] = [], areas: GroundArea[] = [], { facing, apron, clear } = placer(T, props);
  let r = 19340611; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const start = T.spec.landmarks.find(l => l.kind === 'line')!.s;
  // the pits and paddock: inside (to the left of) the main straight
  areas.push(apron(start - 230, start + 150, W2 + 5, W2 + 48));
  for (let k = 0; k < 8; k++) facing('garageBay', start - 200 + k * 14.5, W2 + 30);
  facing('fuelPumps', start - 215, W2 + 12); facing('teaHut', start + 125, W2 + 16);
  facing('clubhouseWing', start + 40, W2 + 36); facing('clubhouseCentre', start + 52, W2 + 36); facing('clubhouseWing', start + 64, W2 + 36);
  facing('timingBox', start, W2 + 5); facing('clockTower', start + 18, W2 + 8);
  // across the road: one grandstand of five bays on the line, the scoreboard and the hoardings past it
  for (let k = 0; k < 5; k++) facing('grandstandBay', start - 31 + k * 15.6, -(W2 + 9));
  facing('scoreboard', start + 95, -(W2 + 12)); for (let k = 0; k < 4; k++) facing('hoarding', start + 135 + k * 10, -(W2 + 5));
  // straw bales on the outside of the slow corners' entries (the outside of a left-hander is to the right)
  for (const name of ['Paddock Bend', 'Hairpin', 'Chapel', 'Last Corner']) { const p = pieceSpan(T, name), turn = T.at((p.s0 + p.s1) / 2).k, side = turn > 0 ? -1 : 1;
    for (let k = 0; k < 4; k++) facing('hayBales', p.s0 - 12 + k * 7, side * (W2 + 3)); }
  facing('windsock', start - 260, W2 + 40);
  // tree lines: both sides of the road, thicker on the outside; none in the paddock or before the stands
  const busy = (s: number, side: number) => (side > 0 ? Math.abs(T.gap(start - 40, s)) < 220 : Math.abs(T.gap(start + 40, s)) < 120);
  for (let s = 0; s < L; s += 7) for (const side of [-1, 1]) { if (busy(s, side) || rnd() > (side < 0 ? 0.75 : 0.35)) continue;
    const off = side * (W2 + 9 + rnd() * (side < 0 ? 40 : 25)), p = T.point(s + rnd() * 5, off); if (!clear(p.x, p.y, 7)) continue;
    const k = rnd(); props.push({ kind: k < 0.4 ? 'treeRound' : k < 0.6 ? 'treePoplar' : k < 0.85 ? 'treePine' : 'bush', x: p.x, y: p.y, heading: rnd() * 6.28 }); }
  return { props, lines: [], areas, railway: [] }; }

// The Speed Bowl's surroundings (review 162): open, level fields; a pit hut, garages and the timing box on the inside
// at the line; boards at 400 m, 1 km and every kilometre after along the south straight; the flying kilometre's
// photocell posts (poles) either side at 11 and 12 km; a windsock; a few rows and clumps of trees well back.
export function speedwayScenery(T: Track): Scenery { const W2 = T.spec.width / 2, L = T.length, props: Placed[] = [], areas: GroundArea[] = [], { facing, apron } = placer(T, props);
  let r = 19910523; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const start = T.spec.landmarks.find(l => l.kind === 'line')!.s;
  areas.push(apron(start - 160, start + 60, W2 + 5, W2 + 45));
  facing('timingBox', start, W2 + 5); for (let k = 0; k < 4; k++) facing('garageBay', start - 120 + k * 14.5, W2 + 30); facing('fuelPumps', start - 140, W2 + 12); facing('teaHut', start + 40, W2 + 16);
  facing('windsock', start - 200, W2 + 50); facing('scoreboard', start + 20, -(W2 + 12));
  // the distance boards on the outside: the marks, then each kilometre to the turn
  const boards = new Set<number>(T.spec.landmarks.filter(l => l.kind === 'mark').map(l => Math.round(l.s))); for (let d = 2000; d < 14500; d += 1000) boards.add(start + d);
  for (const s of boards) facing('hoarding', s, -(W2 + 6));
  for (const l of T.spec.landmarks) if (l.kind === 'mark' && /Flying/.test(l.name)) for (const side of [-1, 1]) facing('telegraphPole', l.s, side * (W2 + 2.5));
  // trees: rows well back from the straights and round the turns, thin; a few clumps on the infield
  for (let s = 0; s < L; s += 45) { if (Math.abs(T.gap(start, s)) < 250) continue; if (rnd() < 0.55) { const p = T.point(s + rnd() * 30, -(W2 + 45 + rnd() * 90)), k = rnd(); props.push({ kind: k < 0.5 ? 'treeRound' : k < 0.8 ? 'treePoplar' : 'bush', x: p.x, y: p.y, heading: rnd() * 6.28 }); } }
  for (let c = 0; c < 14; c++) { const cx = -6500 + c * 1000 + rnd() * 400, cy = (rnd() - 0.5) * 1400; for (let k = 0; k < 6; k++) props.push({ kind: rnd() < 0.6 ? 'treeRound' : 'treePine', x: cx + (rnd() - 0.5) * 60, y: cy + (rnd() - 0.5) * 60, heading: rnd() * 6.28 }); }
  return { props, lines: [], areas, railway: [] }; }
