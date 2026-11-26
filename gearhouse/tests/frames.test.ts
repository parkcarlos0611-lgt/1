// The builder's frame "차체 A" (docs/systems/115 F1): the 959's lump with no openings, its dimensions stretching the
// cage (each end of each range keeps the surface rules of docs/systems/108 that the car itself keeps), the glass sets
// as material tags only, the interior sets, and the frame's data (core/frames.ts).
import { describe, expect, it } from 'vitest';
import { p959Model, P959_LUMP, DIM, frameOf, sockets } from '../render/car/p959';
import { measure } from '../render/car/p959/check';
import { buildShell, edgeUse } from '../render/car/p959/shell';
import { FRAMES, FRAME_DIMS, fitFrameDims, bodyDimsOf, interiorOfKit, kitOfInterior, fitInterior, GLASS_IDS, NO_FRAME_DIMS } from '../core/frames';

const tris = (S: ReturnType<typeof buildShell>, pick: (k: number) => boolean) => S.F.reduce((n, f, k) => n + (pick(k) ? f.length - 2 : 0), 0);
const lump = p959Model(P959_LUMP);

describe('the lump (차체 A)', () => {
  const S = lump.shell, names = new Set(lump.mesh.names!.filter(Boolean));
  it('has no openings: no glass, lens, lamp or grille on its skin; no mirrors, exhausts, plates, crest or lettering; the steel wheel', () => {
    const mats = new Set(S.tag.map(t => t.mat)); expect([...mats].sort()).toEqual(['dark', 'paint']);   // the dark: the wells, the floor, the slot under the wing
    for (const n of ['mirror', 'exhaust', 'plate', 'badge', 'rearLettering', 'headLamp', 'lampBezel', 'indicatorF', 'ventF', 'intakeF', 'ventR', 'exhaustSlot', 'tailLamp', 'sideIntake']) expect(names.has(n), n).toBe(false);
    for (const n of ['tyreF', 'rim', 'wheel', 'hub', 'wheelHole', 'wheelWell', 'archLip']) expect(names.has(n), n).toBe(true);
    expect(lump.mesh.lines!.some(l => /headLampRim|sideIntake|tailLamp|windscreen|sideGlass|doorHandle/.test(l.part ?? (l as { name?: string }).name ?? ''))).toBe(false); });
  it('keeps the body shell in its budget (5,000 - 6,000), one closed surface, the bumpers on the same seams', () => { const shell = tris(S, k => S.tag[k]!.region === 'shell');
    console.log(`lump triangles: body shell ${shell}, the whole lump with its wheels ${lump.mesh.n}`); expect(shell).toBeGreaterThanOrEqual(5000); expect(shell).toBeLessThanOrEqual(6000);
    expect([...edgeUse(S.F).values()].filter(u => u !== 2).length).toBe(0);
    const base = buildShell(), key = (p: number[]) => p.map(v => Math.round(v * 100)).join(','); expect(S.loops.frontBumper!.map(key)).toEqual(base.loops.frontBumper!.map(key)); expect(S.loops.rearBumper!.map(key)).toEqual(base.loops.rearBumper!.map(key)); });
  it('the panel lines are faint until a glass set is picked', () => { const door = (m: typeof lump.mesh) => m.lines!.find(l => l.kind === 'door')!.w!, withGlass = p959Model({ ...P959_LUMP, glass: 'stock' }).mesh;
    expect(door(lump.mesh)).toBeCloseTo(door(withGlass) / 2); expect(withGlass.lines!.some(l => l.kind === 'glass')).toBe(true); expect(lump.mesh.lines!.some(l => l.kind === 'glass')).toBe(false); });
  it('keeps the surface rules as the car does', () => { const R = measure(S); for (const p of R.panels) { expect(p.across, p.panel.name).toBeLessThanOrEqual(p.panel.across ?? 0); expect(p.along, p.panel.name).toBeLessThanOrEqual(p.panel.along ?? 0); expect(p.dimples, p.panel.name).toBe(0); }
    console.log(`lump folds: 20-35 unmarked ${R.mushy.length} (worst ${Math.max(0, ...R.mushy.map(e => e.deg)).toFixed(1)}), 35+ unmarked ${R.unmarked.length}, slivers ${R.slivers}`);
    expect(R.unmarked.length).toBe(0); expect(R.mushy.length).toBeLessThanOrEqual(80); expect(Math.max(0, ...R.mushy.map(e => e.deg))).toBeLessThan(30); expect(R.slivers).toBe(0); });
  it('the car as built is unchanged by it: the stock options draw what they drew', () => { expect(p959Model().mesh.n).toBe(p959Model({ glass: 'stock', details: true, lamp: 'round' }).mesh.n); });
});

describe('the glass sets: material tags only', () => {
  it('every set has the same faces as the lump; the glass where the set puts it', () => { const n = lump.shell.F.length;
    for (const g of GLASS_IDS) { const S = buildShell({ ...P959_LUMP, lamps: false, glass: g }), glass = new Set(S.tag.filter(t => t.mat === 'glass').map(t => t.panel));
      expect(S.F.length, g).toBe(n); expect(glass.has('windscreen'), g).toBe(true); expect(glass.has('quarterGlass'), g).toBe(g !== 'noQuarter'); expect(glass.has('rearWindow'), g).toBe(g !== 'louvre'); }
    const lv = p959Model({ ...P959_LUMP, glass: 'louvre' }).mesh.lines!; expect(lv.filter(l => l.kind === 'vent').length).toBeGreaterThanOrEqual(8); });
});

describe('the frame dimensions (§4-4)', () => {
  const R = FRAMES.A959.ranges;
  it('stretch the car where they say: the length, the axles, the track; the arches stay round about the hubs', () => {
    const f = frameOf({ overhangF: 80, wheelbase: 150, overhangR: 80, width: 60, ride: 40 });
    expect(f.length).toBeCloseTo(DIM.length + 310, 3); expect(f.axleF).toBeCloseTo(DIM.axleF + 80, 3); expect(f.wheelbase).toBeCloseTo(DIM.wheelbase + 150, 3); expect(f.width).toBe(DIM.width + 60);
    const K = sockets(f); expect(K.hubs[1]!.o[0] - K.hubs[0]!.o[0]).toBeCloseTo(DIM.wheelbase + 150, 3); expect(K.hubs[0]!.o[2]).toBe(DIM.hubZ);   // the wheels on the ground still
    expect(Math.abs(K.hubs[0]!.o[1])).toBeCloseTo((DIM.trackF / 2 + 118) * f.kY, 3);
    const S = buildShell({ ...P959_LUMP, lamps: false, dims: f.dims }), lips = S.F.filter((_, k) => S.tag[k]!.panel === 'archLip').flat();
    for (const v of lips) { const p = S.P[v]!, a = p[0] < f.length / 2 ? f.archF : f.archR, r = Math.hypot(p[0] - a[0], p[2] - a[1]); expect(r).toBeGreaterThan(DIM.archR - 20); expect(r).toBeLessThan(DIM.archR + 1); }
    const m = p959Model({ ...P959_LUMP, dims: f.dims }).mesh; expect(m.length).toBeCloseTo(f.length, 3); });
  it('each end of each range keeps the surface rules (no wave, no dimple, no unmarked fold) and the closed surface', () => {
    for (const k of FRAME_DIMS) for (const v of R[k]) { const S = p959Model({ ...P959_LUMP, dims: { [k]: v } }).shell, M = measure(S), at = `${k} ${v}`;
      expect([...edgeUse(S.F).values()].filter(u => u !== 2).length, at).toBe(0);
      for (const p of M.panels) { expect(p.across, `${at} ${p.panel.name}`).toBeLessThanOrEqual(p.panel.across ?? 0); expect(p.along, `${at} ${p.panel.name}`).toBeLessThanOrEqual(p.panel.along ?? 0); expect(p.dimples, `${at} ${p.panel.name}`).toBe(0); }
      expect(M.unmarked.length, at).toBe(0); expect(Math.max(0, ...M.mushy.map(e => e.deg)), at).toBeLessThan(30);
      // the narrowest body turns four triangles by the screen's foot just under 5 degrees (4.9): the car's own are just over
      expect(M.slivers, at).toBeLessThanOrEqual(k === 'width' && v < 0 ? 4 : 0); } });
  it('all at once, either way', () => { for (const s of [0, 1]) { const d = Object.fromEntries(FRAME_DIMS.map(k => [k, R[k][s]])), M = measure(p959Model({ ...P959_LUMP, glass: 'stock', dims: d }).shell);
    for (const p of M.panels) expect(p.dimples + Math.max(0, p.along - (p.panel.along ?? 0)) + Math.max(0, p.across - (p.panel.across ?? 0)), `${s} ${p.panel.name}`).toBe(0); expect(M.unmarked.length).toBe(0); } });
});

describe('the frame data (core/frames.ts)', () => {
  it('dimensions are clamped to the range and whole', () => { expect(fitFrameDims('A959', { wheelbase: 999, width: -12.6, roof: 'x' })).toEqual({ ...NO_FRAME_DIMS, wheelbase: 150, width: -13 }); expect(fitFrameDims('A959', null)).toEqual(NO_FRAME_DIMS); });
  it('the physics reads them as the body\'s own: the width a side, the track as the hubs move', () => { const b = bodyDimsOf('A959', { ...NO_FRAME_DIMS, wheelbase: 100, width: 60 }), o = FRAMES.A959.own;
    expect(b.wheelbase).toBe(100); expect(b.width).toBe(30); expect(2 * b.width + b.track).toBe(Math.round((o.trackF + o.trackR) / 2 * 60 / o.width)); });
  it('the interior sets stand for the old kit interiors both ways', () => { for (const k of ['light', 'standard', 'luxury'] as const) expect(kitOfInterior(interiorOfKit(k))).toBe(k);
    expect(fitInterior({ set: 'drift', trim: 'pink' }, { set: 'stock', trim: 'tan' })).toEqual({ set: 'drift', trim: 'tan' }); });
});

// format 6's frame, glass and interior (docs/systems/115 §7): absent on an older design (the car as built, its
// signature unchanged); a new design's lump kept through files and links; the physics and the fit reading the frame
import { DESIGN_P959, normalise, LUMP_SWAPS, MODEL_OWN, type Design } from '../core/design';
import { designJson, parseDesign, fromPreset, encodeDesign, decodeDesign } from '../core/designstore';
import { designFigures, frontalArea } from '../race/design';
import { fit } from '../race/fit';
import { designMesh } from '../render/car/design';
import { KINDS } from '../render/car/mesh';
const lumpDesign = (dims: Partial<typeof NO_FRAME_DIMS> = {}): Design => { const d = fromPreset('p959'); delete d.fresh;
  d.body.model = LUMP_SWAPS(d.body.model!.plate); d.body.frame = { id: 'A959', dims: { ...NO_FRAME_DIMS, ...dims } }; d.body.glass = null; d.interior = { set: 'drift', trim: 'brown' }; return normalise(d); };
describe('format 6: frame, glass, interior', () => {
  it('an older design gains none of them: read as the car as built, its file unchanged', () => { const d = normalise(DESIGN_P959);
    expect('frame' in d.body || 'glass' in d.body || 'interior' in d).toBe(false); expect(designJson(normalise(JSON.parse(designJson(d))))).toBe(designJson(d)); });
  it('a lump design keeps its frame, glass and interior through a file and a link; its dimensions become the body\'s own', () => {
    const d = lumpDesign({ wheelbase: 150, width: 60, overhangR: 999 }), back = parseDesign(designJson(d))!, link = decodeDesign(encodeDesign(d))!;
    for (const x of [back, link]) { expect(x.body.frame).toEqual({ id: 'A959', dims: { ...NO_FRAME_DIMS, wheelbase: 150, width: 60, overhangR: 80 } }); expect(x.body.glass).toBeNull(); expect(x.interior).toEqual({ set: 'drift', trim: 'brown' });
      expect(x.body.model).toEqual(LUMP_SWAPS(d.body.model!.plate)); expect(x.body.wheelbase).toBe(150); expect(x.body.width).toBe(30); expect(x.body.overhangR).toBe(80); expect(x.kit.interior).toBe('light'); } });
  it('the dimensions move the figures: a longer, wider car is heavier, its frontal area larger; the rear overhang lengthens the engine bay', () => {
    const a = lumpDesign(), b = lumpDesign({ wheelbase: 150, width: 60, overhangR: 80, roof: 40 }), fa = designFigures(a), fb = designFigures(b);
    expect(fb.mass).toBeGreaterThan(fa.mass); expect(frontalArea(b)).toBeGreaterThan(frontalArea(a)); expect(fb.front).not.toBeCloseTo(fa.front, 3);
    const bay = (d: Design) => fit(d).find(x => x.part === 'bayLength')!.reason; expect(bay(b)).not.toBe(bay(a)); });
  it('drawn as the lump: no glass, no lamps, no mirrors; the stock set puts the car as built back', () => { const G = KINDS.indexOf('glass'), d = lumpDesign(), M = designMesh(d, 0, 0, 0, 1), N = new Set(M.names);
    expect(M.kind.filter(k => k === G).length).toBe(0); for (const n of ['mirror', 'headLamp', 'exhaust', 'plate']) expect(N.has(n), n).toBe(false); expect(N.has('seatL') || N.has('seatR')).toBe(true);
    const stock = normalise({ ...d, body: { ...d.body, model: { ...MODEL_OWN.p959, plate: d.body.model!.plate }, glass: 'stock' }, interior: { set: 'stock', trim: 'black' } });
    const own = normalise({ ...DESIGN_P959, body: { ...DESIGN_P959.body, model: { ...MODEL_OWN.p959, plate: d.body.model!.plate } } });
    expect(designMesh(stock, 0, 0, 0, 1).n).toBe(designMesh(own, 0, 0, 0, 1).n); });
});
