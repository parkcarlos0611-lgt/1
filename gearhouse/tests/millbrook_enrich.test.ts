// Millbrook's surroundings filled out by the site plan (review 181, the plan of review 165): where the woods and the
// small things stand, that nothing stands on the concrete, the railway or the river, that every tree is in one of the
// plan's zones, the trees per density, the same every time; the small things laid into meshes where placeMesh puts them.
import { describe, it, expect } from 'vitest';
import { millbrook } from '../race/millbrook';
import { millbrookScenery, treesAt, pieceSpan, enclosures, setSceneryDensity, sceneryDensity, DENSITY_SHARE } from '../race/scenery';
import { staticChunks } from '../render/live/scenerylayer';
import { placeMesh } from '../render/live/gpu';
import { PROPS } from '../render/props/index';
import { asSettings, DEFAULTS } from '../ui/shell/settings';

const T = millbrook(), S = millbrookScenery(T), W2 = T.spec.width / 2, L = T.length;
const start = T.spec.landmarks.find(l => l.kind === 'line')!.s, HOME = pieceSpan(T, 'Home Straight').s1, ME = pieceSpan(T, "Members' Banking").s1, RA = pieceSpan(T, 'Railway Straight').s1, BY = pieceSpan(T, 'Byfleet Banking').s1;
/** the distance to the nearest point of the concrete's centre line, anywhere round the track */
const gap = (x: number, y: number) => { let d = Infinity; for (const n of T.nodes) d = Math.min(d, Math.hypot(n.x - x, n.y - y)); return d; };
const segGap = (pts: [number, number][], x: number, y: number) => { let d = Infinity; for (let k = 0; k + 1 < pts.length; k++) { const [ax, ay] = pts[k]!, [bx, by] = pts[k + 1]!, dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); d = Math.min(d, Math.hypot(ax + dx * t - x, ay + dy * t - y)); } return d; };
const within = (s: number, a: number, b: number) => { const t = ((s % L) + L) % L; return t >= a - 4 && t <= b + 4; };

describe('Millbrook site plan (review 181)', () => {
  it('is the same every time (seeded)', () => {
    const S2 = millbrookScenery(millbrook()); expect(JSON.stringify(S2.trees)).toBe(JSON.stringify(S.trees)); expect(JSON.stringify(S2.detail)).toBe(JSON.stringify(S.detail)); expect(S2.props.length).toBe(S.props.length);
  });
  it("keeps every tree off the concrete and the run-off (W2 + 6 m from any stretch: the belt's edge up a banking's earth bank), off the railway and the river", () => {
    const rail = S.lines.find(l => l.kind === 'rail')!, river = S.lines.find(l => l.kind === 'river')!;
    let worst = Infinity; for (const t of S.trees!) { worst = Math.min(worst, gap(t.x, t.y)); expect(segGap(rail.pts, t.x, t.y)).toBeGreaterThan(8); expect(segGap(river.pts, t.x, t.y)).toBeGreaterThan(river.width / 2 + 5); }
    expect(worst).toBeGreaterThan(W2 + 6);
  });
  it('keeps every small thing off the concrete and the run-off by the fence (W2 + 2.5 m), and off the railway and the river', () => {
    const rail = S.lines.find(l => l.kind === 'rail')!, river = S.lines.find(l => l.kind === 'river')!;
    for (const p of S.detail!) { expect(gap(p.x, p.y), p.kind).toBeGreaterThan(W2 + 2.5); expect(segGap(rail.pts, p.x, p.y)).toBeGreaterThan(6); expect(segGap(river.pts, p.x, p.y)).toBeGreaterThan(river.width / 2 + 2); }
  });
  it("stands every tree in one of the plan's zones", () => {
    const groves = ([[RA + 500, W2 + 110, 70], [RA + 1100, W2 + 140, 85], [BY - 300, W2 + 95, 60], [ME - 300, W2 + 150, 65], [HOME + 300, W2 + 190, 55], [RA + 1500, W2 + 80, 50], [ME + 300, W2 + 120, 60], [ME + 700, W2 + 110, 55]] as const).map(([s, o, r]) => ({ p: T.point(s, o), r }));
    const encl = enclosures(T); let miss = 0;
    for (const t of S.trees!) { const { s, off } = T.locate(t.x, t.y), u = T.gap(start, s);
      // (the belt runs to the end of the lap; past the Fork's bend its last trees fall a few metres past the line when measured square to the track, and inside that right-hand bend nearer it)
      const belt = off <= -(W2 + 6) && off >= -(W2 + 150 + 4) && !within(s, start - 80, start + 410) && !within(s, ME - 45, RA + 45);
      const railBelt = off <= -(W2 + 40 - 4) && off >= -(W2 + 130 + 4) && within(s, ME - 60, RA + 60);
      const grove = groves.some(g => Math.hypot(g.p.x - t.x, g.p.y - t.y) <= g.r + 1);
      const line = (off >= W2 + 9 && off <= W2 + 25) || encl.some(e => within(s, e.s0 - 6, e.s1 + 6) && off >= e.o1 + 5 && off <= e.o1 + 16);
      const paddock = u >= -64 && u <= 275 && off >= W2 + 56 && off <= W2 + 92, park = u >= -70 && u <= 275 && off <= -(W2 + 111) && off >= -(W2 + 122);
      if (!(belt || railBelt || grove || line || paddock || park)) miss++; }
    expect(miss).toBe(0);
  });
  it('closes the belt along the fence (review 184): every 20 m of the outside, where the belt runs, has trees within 25 m of the fence at the middle density', () => {
    const mid = treesAt(S, 'mid'), hits = new Set<number>();
    for (const t of mid) { const { s, off } = T.locate(t.x, t.y); if (off <= -(W2 + 5) && off >= -(W2 + 9 + 25)) hits.add(Math.floor(s / 20)); }
    let gaps = 0, n = 0; for (let s = 0; s + 20 < L; s += 20) { if (within(s, start - 160, start + 430) || within(s, ME - 60, RA + 60)) continue; n++; if (!hits.has(Math.floor(s / 20))) gaps++; }
    expect(n).toBeGreaterThan(100); expect(gaps).toBe(0);
  });
  it('has the plan\'s woods at the middle density, fewer at low, more at high; the setting held', () => {
    const n = (d: 'low' | 'mid' | 'high') => treesAt(S, d).length, lo = n('low'), mid = n('mid'), hi = n('high');
    expect(mid).toBeGreaterThan(10000); expect(mid).toBeLessThan(15000);   // the plan's script drew about 5 700 (9 m grid, 85 %); tightened on review to about twice
    expect(hi).toBe(S.trees!.length); expect(lo / mid).toBeGreaterThan(0.4); expect(lo / mid).toBeLessThan(0.65); expect(hi / mid).toBeGreaterThan(1.5);
    for (const t of S.trees!) expect(t.rank).toBeLessThan(1);
    expect(DEFAULTS.graphics.scenery).toBe('mid'); expect(asSettings({ graphics: { scenery: 'high' } }).graphics.scenery).toBe('high'); expect(asSettings({ graphics: { scenery: 'dense!' } }).graphics.scenery).toBe('mid');
    const was = sceneryDensity(); setSceneryDensity('low'); expect(treesAt(S).length).toBe(lo); setSceneryDensity(was);
  });
  it('lays out the start as the detail plan: the square, its wall, beds, benches, lamps, three flagpoles, the car park of 36 period cars, boards, posts, bales', () => {
    const D = S.detail!, of = (k: string) => D.filter(p => p.kind === k), loc = (p: { x: number; y: number }) => { const l = T.locate(p.x, p.y); return { u: T.gap(start, l.s), v: l.off }; };
    expect(of('flagpole').length).toBe(3); expect(of('streetLamp').length).toBe(5); expect(of('flowerBed').length).toBe(2); expect(of('noticeBoard').length).toBe(1); expect(of('marshalPost').length).toBe(7);
    for (const p of of('flagpole')) { const q = loc(p); expect(q.u).toBeGreaterThan(27); expect(q.u).toBeLessThan(37); expect(q.v).toBeCloseTo(W2 + 7, 1); }
    const cars = of('parkedCar'); expect(cars.length).toBe(36); for (const c of cars) { const q = loc(c); expect(q.u).toBeGreaterThan(-60); expect(q.u).toBeLessThan(140); expect(q.v).toBeLessThan(-(W2 + 45)); expect(q.v).toBeGreaterThan(-(W2 + 110)); }
    const boards = of('adBoard'); expect(boards.length).toBeGreaterThan(20); for (const b of boards) expect(loc(b).v).toBeCloseTo(-(W2 + 5), 1);
    expect(S.areas.filter(a => a.kind === 'paving').length).toBe(3); expect(S.areas.filter(a => a.kind === 'gravel').length).toBe(1); expect(S.areas.filter(a => a.kind === 'trodden').length).toBe(4);
    expect(S.lines.filter(l => l.kind === 'road').length).toBe(1);
    for (const k of new Set(D.map(p => p.kind))) expect(PROPS[k], k).toBeTypeOf('function');
  });
  it('lays the small things into meshes where placeMesh would draw them', () => {
    const p = { kind: 'adBoard', x: 123.4, y: -56.7, z: 0.2, heading: 0.7, arg: 2 }, C = staticChunks([p]), M = PROPS.adBoard!(2), c = C[0]!;
    expect(C.length).toBe(1); expect(c.mesh.n).toBe(M.pos.length / 9);
    const m = placeMesh(M.length, p.x, p.y, p.z, p.heading), x = M.pos[0]!, y = M.pos[1]!, z = M.pos[2]!, wx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, wy = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, wz = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
    expect(c.mesh.pos[0]! / 1000 + c.origin[0]).toBeCloseTo(wx, 3); expect(c.mesh.pos[1]! / 1000 + c.origin[1]).toBeCloseTo(wy, 3); expect(c.mesh.pos[2]! / 1000).toBeCloseTo(wz, 3);
    expect(c.mesh.pos[3]! / 1000 + c.origin[0]).not.toBeCloseTo(m[0]! * M.pos[3]! + m[4]! * M.pos[4]! + m[12]!, 3);   // the winding turned back: corners 1 and 2 swapped
  });
});
