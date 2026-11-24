// Millbrook's surroundings (review 88): where every building, tree and fence stands, and the ground's own features
// (the railway beside the Railway Straight, the river under the Byfleet Banking, the aerodrome inside, the paddock's
// apron, the earth banks behind the bankings). The props are meshes (render/props/*); a placing is a prop's name, where
// its anchor stands, its heading (where its -x points; its front, -y, faces the track when placed by `facing`), and
// for a deck over the track its height. Seeded, so the woods stand in the same places every time.
import type { Track } from './track';

export interface Placed { kind: string; x: number; y: number; heading: number; z?: number; overhead?: boolean; /** a size the prop's mesh takes (an abutment's height, mm) */ arg?: number }
export interface GroundLine { pts: [number, number][]; width: number; kind: 'rail' | 'river' | 'road' }
export interface GroundArea { pts: [number, number][]; kind: 'apron' | 'mown' }
export interface Scenery { props: Placed[]; lines: GroundLine[]; areas: GroundArea[]; railway: [number, number][] }

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
  const busy = (s: number) => Math.abs(T.gap(start + 100, s)) < 380;   // keep the stands' side open
  const nearRail = (s: number) => s > rail.s0 - 120 && s < rail.s1 + 120, works = (s: number) => s > rail.s0 + 200 && s < rail.s0 + 230 + 9 * 15.5;
  for (let s = 0; s < L; s += 6) { if (busy(s)) continue; const k = rnd(); if (k < 0.7 && !nearRail(s)) { const kind = k < 0.2 ? 'treeRound' : k < 0.32 ? 'treePoplar' : 'treePine', bank = T.bankAt(s).b ? T.height(s, -W2) * 2.4 : 0, p = T.point(s + rnd() * 6, -(W2 + 5 + bank + rnd() * 30)); props.push({ kind, x: p.x, y: p.y, heading: rnd() * 6.28 }); }
    if (s > mem.s0 + 60 && s < mem.s1 - 60 && rnd() < 0.6) { const p = T.point(s, W2 + 7 + rnd() * 45); props.push({ kind: rnd() < 0.6 ? 'treeRound' : 'bush', x: p.x, y: p.y, heading: rnd() * 6.28 }); }
    if (!works(s) && !(s > mem.s0 + 60 && s < mem.s1 - 60) && rnd() < 0.18) { const p = T.point(s, W2 + 12 + rnd() * 40); props.push({ kind: rnd() < 0.5 ? 'treeRound' : 'bush', x: p.x, y: p.y, heading: rnd() * 6.28 }); }   // inside the circuit, a few
    if (rnd() < 0.08 && !nearRail(s) && !T.bankAt(s).b) { const p = T.point(s, -(W2 + 6 + rnd() * 4)); /* not on the earth bank behind a banking */ props.push({ kind: 'bush', x: p.x, y: p.y, heading: rnd() * 6.28 }); } }
  return { props, lines, areas, railway }; }

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
