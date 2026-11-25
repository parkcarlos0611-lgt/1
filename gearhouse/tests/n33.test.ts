// The N33's frame "차체 B" (docs/systems/117 R1): its lump from the hand-placed cage (closed, in its budget, keeping the
// surface rules of docs/systems/108 as the 959's does, at both ends of each dimension's range), its glass sets as tags,
// its stretch on the shared frame map (render/car/frame.ts), and its body in the game (core/frames.ts, the design,
// the physics, the front engine bay's fit) without it being offered as a stock car or in a race yet.
import { describe, expect, it } from 'vitest';
import { n33Model, N33_LUMP, DIM, frameOf, buildN33Shell, n33Hubs } from '../render/car/n33';
import { N33_PANELS } from '../render/car/n33/check';
import { measure } from '../render/car/p959/check';
import { edgeUse } from '../render/car/p959/shell';
import { FRAMES, FRAME_DIMS, FRAME_OF_BASE, fitFrameDims, NO_FRAME_DIMS, GLASS_IDS } from '../core/frames';
import { normalise, DESIGN_BNR33 } from '../core/design';
import { newDesign, designJson, parseDesign } from '../core/designstore';
import { ENABLED_BODIES, isEnabledBody, stockP959 } from '../core/bodies';
import { BODY_NAME, bannedIn } from '../core/names';
import { designFigures } from '../race/design';
import { fit } from '../race/fit';
import { designMesh } from '../render/car/design';

const lump = n33Model(N33_LUMP), tris = (S: typeof lump.shell, pick: (k: number) => boolean) => S.F.reduce((n, f, k) => n + (pick(k) ? f.length - 2 : 0), 0);
const rules = (S: typeof lump.shell, at: string) => { const M = measure(S, N33_PANELS);
  for (const p of M.panels) { expect(p.across, `${at} ${p.panel.name}`).toBeLessThanOrEqual(p.panel.across ?? 0); expect(p.along, `${at} ${p.panel.name}`).toBeLessThanOrEqual(p.panel.along ?? 0); expect(p.dimples, `${at} ${p.panel.name}`).toBe(0); }
  expect(M.unmarked.length, at).toBe(0); expect(Math.max(0, ...M.mushy.map(e => e.deg)), at).toBeLessThan(30); expect(M.mushy.length, at).toBeLessThanOrEqual(80); expect(M.slivers, at).toBe(0); return M; };

describe('the lump (차체 B)', () => {
  const S = lump.shell;
  it('has no openings: only paint and the dark of its wells and floor; the steel wheel; one closed surface', () => {
    expect([...new Set(S.tag.map(t => t.mat))].sort()).toEqual(['dark', 'paint']);
    expect([...edgeUse(S.F).values()].filter(u => u !== 2).length).toBe(0);
    const names = new Set(lump.mesh.names!.filter(Boolean)); for (const n of ['wheel', 'wheelHole', 'wheelWell', 'archLip', 'bonnet', 'door', 'bootLid']) expect(names.has(n), n).toBe(true);
    // the sockets' places kept as tags for the parts to come
    for (const s of ['headLamp', 'grille', 'tailLamp']) expect(S.tag.some(t => t.socket === s), s).toBe(true); });
  it('keeps its shell near the budget (target 5,000 - 6,000, ceiling 10,000 for the car) and its cage hand-sized', () => {
    const shell = tris(S, k => S.tag[k]!.region === 'shell'); console.log(`N33 lump: cage ${S.cage.F.length} faces, body shell ${shell} triangles, bumpers ${tris(S, k => S.tag[k]!.region !== 'shell')}, whole lump ${lump.mesh.n}`);
    expect(shell).toBeGreaterThan(4500); expect(shell).toBeLessThanOrEqual(6000); expect(lump.mesh.n).toBeLessThan(10000); });
  it('keeps the surface rules', () => { const M = rules(S, 'stock'); console.log(`N33 folds: 20-35 unmarked ${M.mushy.length} (worst ${Math.max(0, ...M.mushy.map(e => e.deg)).toFixed(1)})`); });
  it('the panel lines are faint until a glass set is picked; the glass sets are tags on the same faces', () => {
    const door = (m: typeof lump.mesh) => m.lines!.find(l => l.kind === 'door')!.w!, withGlass = n33Model({ ...N33_LUMP, glass: 'stock' }).mesh; expect(door(lump.mesh)).toBeCloseTo(door(withGlass) / 2);
    for (const g of GLASS_IDS) { const G = buildN33Shell({ glass: g }), glass = new Set(G.tag.filter(t => t.mat === 'glass').map(t => t.panel)); expect(G.F.length, g).toBe(S.F.length);
      expect(glass.has('windscreen'), g).toBe(true); expect(glass.has('doorGlass'), g).toBe(true); expect(glass.has('quarterGlass'), g).toBe(g !== 'noQuarter'); expect(glass.has('rearWindow'), g).toBe(g !== 'louvre'); } });
  it('its measures: the maker\'s length, width and wheelbase; the arches round about the hubs', () => { const f = frameOf();
    expect(f.length).toBe(4675); expect(f.wheelbase).toBe(2720); const xs = S.P.map(p => p[0]), ys = S.P.map(p => Math.abs(p[1]));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(4630); expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(4690); expect(2 * Math.max(...ys)).toBeGreaterThan(1760); expect(2 * Math.max(...ys)).toBeLessThanOrEqual(1782);
    for (const v of S.F.filter((_, k) => S.tag[k]!.panel === 'archLip').flat()) { const p = S.P[v]!, a = p[0] < 2000 ? f.archF : f.archR, r = Math.hypot(p[0] - a[0], p[2] - a[1]); expect(r).toBeGreaterThan(DIM.archR - 20); expect(r).toBeLessThan(DIM.archR + 1); } });
});

describe('its dimensions (§4-4) on the shared frame map', () => {
  const R = FRAMES.B33.ranges;
  it('stretch the car where they say: the wheelbase ahead of the screen, the hubs with it', () => { const f = frameOf({ overhangF: 80, wheelbase: 120, overhangR: 80, width: 60 });
    expect(f.length).toBeCloseTo(DIM.length + 280, 3); expect(f.axleF).toBeCloseTo(DIM.axleF + 80, 3); expect(f.wheelbase).toBeCloseTo(DIM.wheelbase + 120, 3);
    expect(f.x(1400)).toBeLessThan(1400 + 80 + 120); expect(f.x(1700)).toBeCloseTo(1700 + 200, 3);   // the stretch is ahead of the door; the cabin only moves
    const h = n33Hubs(f); expect(h[1]!.o[0] - h[0]!.o[0]).toBeCloseTo(DIM.wheelbase + 120, 3); });
  it('each end of each range keeps the surface rules and the closed surface', () => {
    for (const k of FRAME_DIMS) for (const v of R[k]) { const S = buildN33Shell({ dims: { [k]: v } }); expect([...edgeUse(S.F).values()].filter(u => u !== 2).length, `${k} ${v}`).toBe(0); rules(S, `${k} ${v}`); } });
  it('all at once, either way', () => { for (const s of [0, 1]) rules(buildN33Shell({ glass: 'stock', dims: Object.fromEntries(FRAME_DIMS.map(k => [k, R[k][s]])) }), `all ${s}`); });
  it('are clamped to the frame\'s own ranges', () => expect(fitFrameDims('B33', { wheelbase: 999, roof: 999 })).toEqual({ ...NO_FRAME_DIMS, wheelbase: 120, roof: 30 }));
});

describe('the body in the game', () => {
  it('a new design on it starts as its lump; picking it is kept through a file', () => { const d = newDesign('bnr33');
    expect(d.body.frame).toEqual({ id: 'B33', dims: NO_FRAME_DIMS }); expect(d.body.glass).toBeNull(); expect(FRAME_OF_BASE.bnr33).toBe('B33');
    const back = parseDesign(designJson({ ...d, body: { ...d.body, frame: { id: 'B33', dims: { ...NO_FRAME_DIMS, wheelbase: 100 } } } }))!; expect(back.body.frame).toEqual({ id: 'B33', dims: { ...NO_FRAME_DIMS, wheelbase: 100 } });
    // a frame of another body is not kept on it
    expect(normalise({ ...d, body: { ...d.body, frame: { id: 'A959', dims: NO_FRAME_DIMS } } }).body.frame!.id).toBe('B33'); });
  it('is on the enabled list (R4), after the 959: a new design still starts on the 959', () => { expect(isEnabledBody('bnr33')).toBe(true); expect(ENABLED_BODIES).toEqual(['p959', 'bnr33']); expect(stockP959().body.base).toBe('p959'); });
  it('its name on the screens is the made-up one', () => { expect(BODY_NAME.bnr33).toBe('NISSINO N33 GT-X'); expect(bannedIn(BODY_NAME.bnr33)).toEqual([]); expect(bannedIn('Skyline GT-R')).toEqual(['Skyline', 'GT-R']); });
  it('the physics reads it: the engine ahead, the weight on the front; the bay under the bonnet grows with the wheelbase', () => { const d = normalise(newDesign('bnr33')), F = designFigures(d);
    expect(F.front).toBeGreaterThan(0.52); expect(F.mass).toBeGreaterThan(1350); expect(F.mass).toBeLessThan(1700);
    const bay = (x: typeof d) => fit(x).find(c => c.part === 'bayLength')!.reason, longer = normalise({ ...d, body: { ...d.body, frame: { id: 'B33', dims: { ...NO_FRAME_DIMS, wheelbase: 100 } } } });
    const mmOf = (t: string) => +(t.match(/엔진룸 (\d+) mm/)?.[1] ?? NaN); expect(mmOf(bay(longer)) - mmOf(bay(d))).toBe(100); expect(bay(d)).toContain('앞 세로 배치'); });
  it('draws whole: the body, the suspension about its hubs, the machinery, the right-hand-drive placeholder cabin', () => { const m = designMesh(normalise({ ...DESIGN_BNR33 }));
    expect(m.n).toBeGreaterThan(lump.mesh.n); expect(m.susp).toBeTruthy(); });
});

// R2 (docs/systems/117 §6): its own interior sets, right-hand drive, in the 959's interior manner and budget (doc 109 S4:
// 4,000 - 5,000 triangles); its plates on the generic skin
import { interiorMesh, INTERIORS, interiorBudget } from '../render/car/interior';
import { N33_CABIN, modelSkin } from '../render/car/bodies';
import { fitPlate, stockPlace } from '../render/car/p959/plates';
import { n33Marks, n33Skin } from '../render/car/n33';
import { buildSet } from '../ui/builder_thumbs';
describe('its interior sets and plates (R2)', () => {
  it('right-hand drive: the wheel, the binnacle and the driver on the right; four dials and the centre stack\'s three gauges; in the budget', () => {
    for (const k of ['n33Stock', 'n33Sport'] as const) { const m = interiorMesh({ ...INTERIORS[k], cabin: N33_CABIN, length: 4675 }), B = interiorBudget(m), names = new Set(m.names!.filter(Boolean));
      console.log(`N33 interior ${k}: ${B.total} triangles`); expect(B.total).toBeGreaterThan(2500); expect(B.total).toBeLessThanOrEqual(5000);
      const ys = (re: RegExp) => { let s = 0, n = 0; for (let t = 0; t < m.n; t++) if (re.test(m.names![m.part[t]!] ?? '')) { s += m.pos[t * 9 + 1]!; n++; } return s / n; };
      expect(ys(/^steerWheelRim/)).toBeLessThan(-250); expect(ys(/^gaugeFace\d/)).toBeLessThan(-250); expect(ys(/^driver/)).toBeLessThan(-200);
      expect([0, 1, 2, 3].every(i => names.has(`gaugeFace${i}`))).toBe(true); expect(names.has('gaugeFace4')).toBe(false); expect([0, 1, 2].every(i => names.has(`gaugeConsoleFace${i}`))).toBe(true);
      expect(names.has('gaugePillarPod')).toBe(k === 'n33Sport'); } });
  it('the builder\'s cards draw 차체 B\'s own glass and interior sets', () => { expect(buildSet('glass', 'B33:stock').shell.P.length).toBe(lump.shell.P.length); expect(buildSet('interior', 'B33:drift').mesh.n).toBeGreaterThan(1000); });
  it('plates sit on its bumpers at their own places, and placed freely through the generic skin', () => { const skin = n33Skin(lump.shell);
    for (const m of n33Marks()) { const at = stockPlace(skin, m)!; expect(at).toBeTruthy(); const f = fitPlate(skin, { id: m.name as 'plateF', at, rot: 0, tilt: 0, scale: 1 })!; expect(f.ok, `${m.name} ${f.why}`).toBe(true); }
    const d = normalise(newDesign('bnr33')); expect(modelSkin(d)!.marks.map(k => k.name)).toEqual(['plateF', 'plateR']);
    const withPlates = n33Model({ ...N33_LUMP, plateF: true, plateR: true }).mesh; expect(withPlates.n).toBeGreaterThan(lump.mesh.n); });
});
