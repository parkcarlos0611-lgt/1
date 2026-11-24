// The kinematic suspension (docs/systems/102, M4): the tables from each base's linkage (the camber a wishbone gains in
// bump, the roll centre where it should be, nothing missing at the settings' ends), the design's format 5 and its
// migration, the physics reading the same linkage the picture moves, and the builder's seven steps.
import { describe, it, expect } from 'vitest';
import { DESIGN_NSX, DESIGN_F355, DESIGN_EB110, DESIGN_XJ220, SUSP_OWN, SUSP_LIMITS, SUSP_KINDS, RC_PRESETS, normalise, suspLock, applyPatch, type Design, type DesignV4, type SuspKind } from '../core/design';
import { asDesign } from '../core/designstore';
import { designSusp } from '../render/car/designsusp';
import { designMesh } from '../render/car/design';
import { rigCorners } from '../render/car/suspension/setup';
import { cornerTable, lookup, rollCentre, antiGeometry, TABLE_TRAVEL } from '../render/car/suspension/tables';
import { solve, camberOf, steerOf, dist } from '../render/car/suspension/kinematics';
import { poseRig } from '../render/car/suspension';
import { designSpec } from '../race/design';
import { raceSpec } from '../race/cars';
import { kinRig, kinOn, kinOf, PHYSICS, camberAt, toeAt } from '../race/kin';
import { Vehicle } from '../race/vehicle';
import { Track } from '../race/track';
import { STEPS, STEPS_06, FIT_STEP, stepFrom, seenFrom, stepNo, stepMark } from '../ui/builder_steps';

const D = 180 / Math.PI, BASES: [string, Design][] = [['nsx', DESIGN_NSX], ['f355', DESIGN_F355], ['eb110', DESIGN_EB110]];
const tablesOf = (d: Design) => { const K = designSusp(d)!, C = rigCorners(K.spec, K.wheels, K.setup, K.ride); return { K, C, T: C.map(H => cornerTable(H, -K.ride, H.steer.rack ? -H.side * K.setup.front.toe / D : 0)) }; };
const tweak = (d: Design, f: (d: Design) => void): Design => { const e = structuredClone(d); f(e); return normalise(e); };

describe('the kinematic tables', () => {
  it('each base: the camber gains about 1 to 2 degrees negative for 50 mm of bump, steadily; the toe and the track barely move', () => {
    for (const [id, d] of BASES) { const { T } = tablesOf(d);
      for (const t of T) { const g = (lookup(t, t.camber, 25) - lookup(t, t.camber, -25)) * D, tag = `${id} ${t.front ? 'front' : 'rear'}`;
        expect(t.ok, tag).toBe(true); expect(g, tag).toBeLessThan(-0.9); expect(g, tag).toBeGreaterThan(-2.1);
        for (let i = 1; i < t.camber.length; i++) expect(t.camber[i]!, tag).toBeLessThan(t.camber[i - 1]!);   // bump: ever more negative
        // the static camber its design sets, at the static ride
        expect(lookup(t, t.camber, 0) * D, tag).toBeCloseTo(t.front ? d.susp.front.camber : d.susp.rear.camber, 2); expect(lookup(t, t.toe, 0) * D, tag).toBeCloseTo(t.front ? d.susp.front.toe : d.susp.rear.toe, 2);
        expect(Math.abs((lookup(t, t.toe, 40) - lookup(t, t.toe, -40)) * D), tag).toBeLessThan(0.5); expect(Math.abs(lookup(t, t.dy, 80)), tag).toBeLessThan(25);
        // the spring's motion ratio a coil-over's on a lower arm, a little under half
        for (const m of t.mr) { expect(m, tag).toBeGreaterThan(0.3); expect(m, tag).toBeLessThan(0.7); } } }
  });
  it('the bump steer is small, a little toe-out at the front and a little toe-in at the rear (the tie rods trimmed: under 1.2 mrad for 40 mm)', () => {
    // alpha 0.13: untrimmed it was about 2 mrad each way, and its roll understeer pushed the heavy cars wide on the Byfleet Banking (docs/systems/102 7-1)
    for (const [id, d] of BASES) for (const t of tablesOf(d).T) { const b = (lookup(t, t.toe, 40) - lookup(t, t.toe, 0)) * 1000, tag = `${id} ${t.front ? 'front' : 'rear'}`;
      expect(Math.abs(b), tag).toBeLessThan(1.2); if (t.front) expect(b, tag).toBeLessThan(0); else expect(b, tag).toBeGreaterThan(0); }
  });
  it('the roll centre stands inside the car and near the ground, and moves within it as the body rises, falls and rolls', () => {
    for (const [id, d] of BASES) { const { T } = tablesOf(d);
      for (const a of [0, 2]) { const L = T[a]!, R = T[a + 1]!, z0 = rollCentre(L, R, 0, 0), tag = `${id} ${a ? 'rear' : 'front'}`;
        expect(z0.z, tag).toBeGreaterThan(20); expect(z0.z, tag).toBeLessThan(180); expect(Math.abs(z0.y), tag).toBeLessThan(1);
        for (let t = TABLE_TRAVEL.from; t <= TABLE_TRAVEL.to; t += 20) { const h = rollCentre(L, R, t, t); expect(h.z, `${tag} heave ${t}`).toBeGreaterThan(-150); expect(h.z, `${tag} heave ${t}`).toBeLessThan(350); }
        for (const r of [10, 30, 50]) { const q = rollCentre(L, R, r, -r); expect(Math.abs(q.y), `${tag} roll ${r}`).toBeLessThan(L.cpY); expect(Number.isFinite(q.z)).toBe(true); } }
      const A = antiGeometry(T[0]!, T[2]!, 440, 2500); for (const v of Object.values(A)) { expect(Number.isFinite(v)).toBe(true); expect(Math.abs(v)).toBeLessThan(60); } }
  });
  it('the roll-centre presets order the height, and a strut and a multilink solve with their tables whole', () => {
    for (const [id, d] of BASES) { const rc = (p: 'low' | 'mid' | 'high') => { const { T } = tablesOf(tweak(d, e => { e.susp.front.rc = p; e.susp.rear.rc = p; })); return [rollCentre(T[0]!, T[1]!, 0, 0).z, rollCentre(T[2]!, T[3]!, 0, 0).z]; };
      const lo = rc('low'), mid = rc('mid'), hi = rc('high'); for (const k of [0, 1]) { expect(lo[k]!, id).toBeLessThan(mid[k]! - 15); expect(hi[k]!, id).toBeGreaterThan(mid[k]! + 15); }
      const { T } = tablesOf(tweak(d, e => { e.susp.front.type = 'macpherson'; e.susp.rear.type = 'multilink'; }));
      for (const t of T) { expect(t.ok, `${id} ${t.front}`).toBe(true); const g = (lookup(t, t.camber, 25) - lookup(t, t.camber, -25)) * D; expect(g).toBeLessThan(0); expect(g).toBeGreaterThan(-3); } }
  });
  it('no number is missing at the settings\' ends, for every kind an axle may have', () => {
    const ends = (k: keyof typeof SUSP_LIMITS) => SUSP_LIMITS[k];
    for (const [id, d] of BASES) for (const tf of ['doubleWishbone', 'macpherson'] as SuspKind[]) for (const tr of ['doubleWishbone', 'macpherson', 'multilink'] as SuspKind[]) for (const end of [0, 1] as const) for (const p of RC_PRESETS) {
      const e = tweak(d, x => { for (const [a, t] of [[x.susp.front, tf], [x.susp.rear, tr]] as const) { a.type = t; a.rc = p; a.arm = ends('arm')[end]; a.camber = ends('camber')[end]; a.toe = ends('toe')[1 - end]!; a.hz = ends('hz')[end]; }
        x.susp.front.caster = ends('caster')[end]; x.body.ride = end ? 40 : -25; });
      const { T } = tablesOf(e), tag = `${id} ${tf}/${tr} ${end} ${p}`;
      for (const t of T) { expect(t.ok, tag).toBe(true); for (const col of [t.camber, t.toe, t.dx, t.dy, t.cy, t.spring, t.mr, t.jy, t.jx, t.jxW, t.rc, ...(t.steerCam ? [t.steerCam] : [])]) for (const v of col) expect(Number.isFinite(v), tag).toBe(true); } }
  });
  it('the arms keep their lengths with the static shims set (the linkage, not a lean painted on)', () => {
    const e = tweak(DESIGN_F355, x => { x.susp.front.camber = -2.5; x.susp.rear.camber = 0.5; x.susp.rear.toe = 0.4; }), { K, C } = tablesOf(e);
    for (const H of C) { const P0 = solve(H, -K.ride), P1 = solve(H, -K.ride + 70); expect(dist(P1.lbj, P1.ubj)).toBeCloseTo(dist(P0.lbj, P0.ubj), 6); expect(dist(P1.outer, P1.inner)).toBeCloseTo(dist(P0.outer, P0.inner), 6); }
  });
});

describe('the design (format 5)', () => {
  it('a format-4 design (and a link or a file of one) takes its base\'s own suspension, and drives as the base\'s own design does', () => {
    for (const [id, d] of BASES) { const { susp: _s, ...rest } = structuredClone(d); void _s; const v4: DesignV4 = { ...rest, v: 4 };
      const n = normalise(v4); expect(n.v).toBe(5); expect(n.susp).toEqual(SUSP_OWN[id as 'nsx']); expect(n).toEqual(d);
      const f = asDesign(JSON.parse(JSON.stringify(v4)))!; expect(f.susp).toEqual(SUSP_OWN[id as 'nsx']);
      expect(JSON.stringify(designSpec(f).kin?.setup)).toBe(JSON.stringify(designSpec(d).kin?.setup)); }
  });
  it('the settings are held to their ranges; the beam axle and a front multilink are not offered on the 1990s bases', () => {
    const n = normalise({ ...DESIGN_NSX, susp: { front: { ...DESIGN_NSX.susp.front, type: 'beamLeaf', hz: 9, camber: -40, caster: 99 }, rear: { ...DESIGN_NSX.susp.rear, type: 'multilink', bar: -3, toe: 4 } } });
    expect(n.susp.front.type).toBe('doubleWishbone'); expect(n.susp.front.hz).toBe(SUSP_LIMITS.hz[1]); expect(n.susp.front.camber).toBe(SUSP_LIMITS.camber[0]); expect(n.susp.front.caster).toBe(SUSP_LIMITS.caster[1]);
    expect(n.susp.rear.type).toBe('multilink'); expect(n.susp.rear.bar).toBe(0); expect(n.susp.rear.toe).toBe(SUSP_LIMITS.toe[1]);
    expect(suspLock(true, 'beamLeaf')).toMatch(/1930년대/); expect(suspLock(false, 'beamLeaf')).toMatch(/1930년대/); expect(suspLock(true, 'multilink')).toBeTruthy(); expect(suspLock(false, 'multilink')).toBeNull();
    for (const k of SUSP_KINDS) expect(normalise(applyPatch(DESIGN_F355, { susp: { rear: { type: k } } })).susp.rear.type).toBe(k === 'beamLeaf' ? 'doubleWishbone' : k);
  });
});

describe('the physics on the linkage', () => {
  it('the kit\'s cars and the designs drive on their rigs; the period\'s cars and the old switch on the rules', () => {
    expect(kinOn(designSpec(DESIGN_NSX))).toBe(true); expect(kinOn(raceSpec('nsx'))).toBe(true); expect(kinOn(raceSpec('f355f1'))).toBe(true); expect(kinOn(raceSpec('eb110'))).toBe(true);
    expect(kinOf(raceSpec('xj220'))).toBeNull(); expect(kinOf(raceSpec('fordT23'))).toBeNull(); expect(kinOn(raceSpec('bmw315'))).toBe(false);
    const s = designSpec(DESIGN_XJ220); expect(kinOn({ ...s, kin: { ...s.kin!, physics: 'old' } })).toBe(false);
    PHYSICS.kinematic = false; try { expect(kinOn(s)).toBe(false); expect(new Vehicle(s, new Track(FLAT)).kin).toBeNull(); } finally { PHYSICS.kinematic = true; }
  });
  it('the picture leans and steers each wheel as the physics does (one linkage): the rig posed at a travel against the tables', () => {
    const d = tweak(DESIGN_NSX, x => { x.susp.front.camber = -1.8; x.susp.rear.camber = -2.2; x.susp.front.toe = 0.2; x.susp.rear.toe = 0.3; x.body.ride = 20; });
    const rig = designMesh(d, 0, 0, 0, 0).susp!, s = designSpec(d), K = kinRig(s.kin!);
    const T = [K.front.tables![0], K.front.tables![1], K.rear.tables![0], K.rear.tables![1]];
    for (const tr of [-60, -20, 0, 35, 70]) { const steer = T.map((t, k) => k < 2 ? -(k % 2 === 0 ? 1 : -1) * toeAt(t, tr / 1000) : 0), P = poseRig(rig, [tr, tr, tr, tr], steer[0]!, steer[1]!);
      P.wheels.forEach((w, k) => { const side = k % 2 === 0 ? 1 : -1, cam = side * camberOf(w.R), toe = -side * steerOf(w.R);
        expect(cam * D, `wheel ${k} travel ${tr}`).toBeCloseTo(camberAt(T[k]!, tr / 1000) * D, 1); expect(toe * D, `wheel ${k} travel ${tr}`).toBeCloseTo(toeAt(T[k]!, tr / 1000) * D, 2); }); }
  });
  it('the vehicle stands with its static camber and toe, and a wheel in bump leans in', () => {
    const s = designSpec(DESIGN_F355), c = new Vehicle(s, new Track(FLAT)).place(100, 0, 0); for (let t = 0; t < 1; t += 1 / 200) c.step(1 / 200, { throttle: 0, brake: 0, steer: 0 });
    expect(c.kin).not.toBeNull(); const toe = (i: number) => -(i % 2 === 0 ? 1 : -1) * c.steerAt(i) * D;
    expect(toe(2)).toBeGreaterThan(0.05); expect(toe(3)).toBeGreaterThan(0.05); expect(Math.abs(toe(0) - DESIGN_F355.susp.front.toe)).toBeLessThan(0.05);
    // the lean against the road (top to the left +): the rears' negative static camber leans each top in
    expect(c.camber[2]!).toBeLessThan(-0.008); expect(c.camber[3]!).toBeGreaterThan(0.008);
  });
});

describe('the builder\'s seven steps', () => {
  it('in order, the suspension third; a step kept by the six-step builder found again (by its id, or by its number)', () => {
    expect(STEPS.map(s => s[0])).toEqual(['chassis', 'engine', 'susp', 'body', 'kit', 'paint', 'check']); expect(STEPS[2]![1]).toBe('서스펜션'); expect(stepMark('check')).toBe('⑦');
    expect(stepFrom('kit')).toBe('kit'); expect(stepFrom('susp')).toBe('susp'); expect(stepFrom(2)).toBe('body'); expect(stepFrom(5)).toBe('check'); expect(stepFrom(0)).toBe('chassis');
    expect(stepFrom(6)).toBeNull(); expect(stepFrom('files')).toBeNull(); expect(stepFrom(undefined)).toBeNull(); expect(stepFrom(1.5)).toBeNull();
    expect(seenFrom(['chassis', 2, 'susp', 'oops', 2])).toEqual(['chassis', 'body', 'susp']); expect(seenFrom('x')).toEqual([]);
    expect(STEPS_06.every(s => stepNo(s) >= 0)).toBe(true); for (const s of Object.values(FIT_STEP)) expect(stepNo(s)).toBeGreaterThanOrEqual(0);
    expect(stepNo('body')).toBe(3); expect(stepNo(FIT_STEP.archF)).toBe(4);
  });
});

const FLAT = { name: 'flat', pieces: [{ kind: 'straight' as const, len: 3000, name: 'a' }, { kind: 'arc' as const, radius: 400, turn: 180, name: 'b' }, { kind: 'straight' as const, len: 3000, name: 'c' }, { kind: 'arc' as const, radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 };
