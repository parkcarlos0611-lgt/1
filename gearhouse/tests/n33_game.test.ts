// The N33 in the game (docs/systems/117 R4): its straight six and its figures against the real car's, the variable
// four-wheel drive (rear-driven, the front's share rising with the rear's slip), its own multilinks, the stock car the
// player picks (not a race opponent: the field stays the 599's one-make), its engine in the workshop's library.
import { describe, it, expect } from 'vitest';
import { normalise, DESIGN_BNR33, DESIGN_P959, DESIGN_EB110, SUSP_OWN } from '../core/design';
import { designSpec, designFigures, frontalArea } from '../race/design';
import { engineFigures } from '../race/designparts';
import { tierOf } from '../race/tiers';
import { fit } from '../race/fit';
import { Vehicle } from '../race/vehicle';
import { Track } from '../race/track';
import type { RaceSpec } from '../race/cars';
import { ENABLED_BODIES, enabledDesign, stockN33 } from '../core/bodies';
import { oneMakeField } from '../race/onemake';
import { STOCK_ENGINES, joinEngine } from '../core/engines';
import { CAR_N33, ENGINE_N33, bannedIn } from '../core/names';
import { SUSPENSION } from '../render/car/suspension/hardpoints';
import { designMesh } from '../render/car/design';
import { MODEL_BODIES } from '../render/car/bodies';

const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 8000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 8000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });
const dt = 1 / 200, N33 = normalise(DESIGN_BNR33);

describe('the N33\'s machinery and figures (real: 280 PS at 6,800, 368 Nm at 4,400, 1,530 kg, Cd 0.35 [~], about 5 s, 250+ km/h [~])', () => {
  it('its six lands on its power and the class S2; its torque a little under (the game\'s turbo curve) [~]', () => {
    const e = engineFigures(N33); expect(N33.engine).toMatchObject({ layout: 'I6', cc: 2568, valves: 4, turbo: 2, intercooler: true, grade: 2 });
    expect(e.hp).toBeGreaterThan(270); expect(e.hp).toBeLessThan(283); expect(Math.abs(e.hpRpm - 6800)).toBeLessThan(100);
    expect(e.torquePeak).toBeGreaterThan(330); expect(e.torquePeak).toBeLessThan(375); expect(e.torqueRpm).toBeGreaterThan(3900); expect(e.torqueRpm).toBeLessThan(4600);
    const F = designFigures(N33); expect(tierOf(F)?.id).toBe('S2');
  });
  it('weighs its 1,530 kg (with the driver 1,605), 59 % on the front; Cd about 0.35; 250 - 280 km/h; 0-100 in the fives', () => {
    const F = designFigures(N33), s = designSpec(N33);
    expect(F.mass - 75).toBeGreaterThanOrEqual(1525); expect(F.mass - 75).toBeLessThanOrEqual(1545); expect(F.front).toBeCloseTo(0.59, 2);
    expect(s.cdA / frontalArea(N33)).toBeGreaterThan(0.33); expect(s.cdA / frontalArea(N33)).toBeLessThan(0.37);
    expect(F.topKmh).toBeGreaterThan(250); expect(F.topKmh).toBeLessThan(280); expect(F.zeroTo100).toBeGreaterThan(4.8); expect(F.zeroTo100).toBeLessThan(6.2);
    expect(s.gears.length).toBe(5); expect(s.tech!.gearbox).toBe('manual');
  });
  it('fits its bay ahead of the bulkhead, lengthwise', () => { const c = fit(N33); for (const x of c) expect(x.verdict, x.reason).toBe('ok'); expect(c.find(x => x.part === 'bayLength')!.reason).toContain('앞 세로 배치'); });
});

describe('the variable four-wheel drive', () => {
  const launch = (s: RaceSpec, T: number) => { const c = new Vehicle(s, flat).place(100, 0, 0); let t100 = 0, most = 0; const shares: number[] = [];
    for (let t = 0; t < T; t += dt) { c.step(dt, { throttle: 1, brake: 0, steer: 0 }); most = Math.max(most, c.awdF); shares.push(c.awdF); if (!t100 && c.speed * 3.6 >= 100) t100 = t; } return { c, t100, most, shares }; };
  it('is the N33\'s alone: the other cars keep their fixed split (their physics unchanged)', () => {
    expect(designSpec(N33).tech!.drive).toEqual({ front: 0, visc: 0, vary: { max: 0.5, slip0: 0.01, slip1: 0.06, tau: 0.1 } });
    expect(designSpec(normalise(DESIGN_P959)).tech!.drive).toEqual({ front: 0.3, visc: 140 }); expect(designSpec(normalise(DESIGN_EB110)).tech!.drive).toEqual({ front: 0.3, visc: 60 });
    const p = launch(designSpec(normalise(DESIGN_P959)), 2); expect(p.most).toBe(0);
  });
  it('sends the front some of the drive when the rear slips at the launch, at most half, and hands it back once it grips', () => {
    const s = designSpec(N33), a = launch(s, 40);
    expect(Math.max(...a.shares.slice(0, 200))).toBeGreaterThan(0.1); expect(a.most).toBeLessThanOrEqual(0.5);
    expect(a.c.awdF).toBeLessThan(0.05);   // cruising flat out at 40 s: rear-driven again
    const rwd = launch({ ...s, tech: { ...s.tech, drive: { front: 0, visc: 0 } } }, 12); expect(a.t100).toBeLessThan(rwd.t100 - 0.3);   // quicker off the line than the rear alone
    expect(a.t100).toBeGreaterThan(5); expect(a.t100).toBeLessThan(6.5);
  });
  it('stays steady under rough inputs (finite, inside its range)', () => {
    const c = new Vehicle(designSpec(N33), flat).place(100, 0, 0); let k = 7;
    for (let t = 0; t < 20; t += dt) { if (Math.round(t / dt) % 80 === 0) k = (k * 16807) % 2147483647; const r = (k % 1000) / 1000;
      c.step(dt, { throttle: r > 0.3 ? 1 : 0, brake: r < 0.1 ? 1 : 0, steer: r > 0.6 ? 0.6 : r > 0.4 ? -0.6 : 0 });
      expect(Number.isFinite(c.speed) && Number.isFinite(c.awdF)).toBe(true); expect(c.awdF).toBeGreaterThanOrEqual(0); expect(c.awdF).toBeLessThanOrEqual(0.5); }
  });
});

describe('its own suspension', () => {
  it('multilinks front and rear on its own points (no longer the 599\'s), about the frame\'s wheels', () => {
    const S = SUSPENSION.bnr33!; expect(S).not.toBe(SUSPENSION.p959); expect(S.front.type === 'doubleWishbone' && S.front.kind).toBe('multilink'); expect(S.rear.type === 'doubleWishbone' && S.rear.kind).toBe('multilink');
    expect(SUSP_OWN.bnr33.rear.type).toBe('multilink');
    const w = MODEL_BODIES.bnr33.wheels(N33); expect(w.r.x - w.f.x).toBeCloseTo(2720, -1); expect(2 * w.f.y).toBeCloseTo(1480, -1); expect(2 * w.r.y).toBeCloseTo(1490, -1);
    expect(designSpec(N33).kin).toBeTruthy();
  });
});

describe('in the game', () => {
  it('the stock car: its name, the stock glass and interior, both plates, its paint; the player\'s to pick, not the field\'s', () => {
    const d = stockN33(); expect(d.id).toBe('n33stock'); expect(d.name).toBe(CAR_N33); expect(enabledDesign(d)).toBe(true); expect(ENABLED_BODIES).toContain('bnr33');
    expect(d.body.glass).toBe('stock'); expect(d.interior).toEqual({ set: 'stock', trim: 'black' }); expect(d.body.model!.plateF).toBeUndefined(); expect(d.body.model!.plateR).toBeUndefined();
    expect(d.body.paint).toBe(DESIGN_BNR33.body.paint); expect(stockN33()).toEqual(d);
    for (const f of oneMakeField(7, 3)) expect(f.design.body.base).toBe('p959');
    const m = designMesh(normalise(d), 0, 0, 0, 1); expect(m.susp).toBeTruthy(); expect(m.names!.some(n => /plate/i.test(n))).toBe(true);
    // its own parts (docs/systems/117 R3): the lump's stock set put on by the `stock` flag (kept through normalise), its own five-spoke wheel; a stretched frame carries them
    expect(normalise(d).body.model!.stock).toBe(true); expect(d.body.model!.wheel).toBe('n5'); const names = new Set(m.names);
    for (const n of ['headLamp', 'tailLamp', 'fogLamp', 'lip', 'garnish', 'wing', 'mirror', 'handle', 'grilleMesh', 'intakeCore', 'exhaustTip', 'wheelNut']) expect(names.has(n), n).toBe(true);
    const long = designMesh(normalise({ ...d, body: { ...d.body, frame: { id: 'B33', dims: { overhangF: 0, wheelbase: 100, overhangR: 60, width: 0, roof: 0, ride: 0 } } } }), 0, 0, 0, 1); for (const n of ['headLamp', 'tailLamp', 'lip', 'wing']) expect(long.names!.includes(n), n).toBe(true);
  });
  it('its engine is in the workshop\'s library as a stock family and variant, the design\'s own', () => {
    const e = STOCK_ENGINES.find(x => x.id === 'stock-n33')!; expect(e.name).toBe(ENGINE_N33); expect(bannedIn(e.name)).toEqual([]);
    expect(joinEngine(e.family, e.variant, N33)).toEqual(N33.engine); expect(e.family.cc[0]).toBeLessThan(2568); expect(e.family.cc[1]).toBeGreaterThan(2568);
  });
});
