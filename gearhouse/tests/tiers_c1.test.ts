// The class as a wall (docs/systems/115 C1): format 6's chosen class read and kept (older formats placed by their
// figures), the restrictor and the limiter in the design's physics, the builder's walls (an option's need, a slider's
// stop, an engine brought under a cap, what a move down holds), the era's lock on the hyper rungs.
import { describe, it, expect } from 'vitest';
import { DESIGN_P959, DESIGN_MCLAREN_F1, type Design } from '../core/design';
import { asDesign, fromPreset, encodeDesign, decodeDesign } from '../core/designstore';
import { designSpec, designFigures } from '../race/design';
import { tierById, tierLock, tierOf, TIERS } from '../race/tiers';
import { withTier, chosenTier, freeHp, needOf, needText, sliderWall, wallStop, fitEngine, moveTo } from '../ui/builder_tier';
import { Vehicle } from '../race/vehicle';
import { Track } from '../race/track';
import { asSettings } from '../ui/shell/settings';

const at = (d: Design, tier: string): Design => ({ ...structuredClone(d), tier: tierById(tier)!.id });

describe('format 6: the chosen class', () => {
  it('a new design asks for its class; a file keeps its class; an older format has none until the builder gives it the rung it reaches', () => {
    const n = fromPreset('p959'); expect(n.v).toBe(6); expect(n.fresh).toBe(true); expect(n.tier).toBeUndefined();
    const kept = asDesign(JSON.parse(JSON.stringify(at(DESIGN_P959, 'P3'))))!; expect(kept.tier).toBe('P3'); expect(kept.fresh).toBeUndefined();
    expect(decodeDesign(encodeDesign(at(DESIGN_P959, 'S2')))!.tier).toBe('S2');   // the test drive's link carries it
    const { tier: _t, ...v5 } = { ...structuredClone(DESIGN_P959), v: 5 }; void _t; const old = asDesign(v5)!;
    expect(old.v).toBe(6); expect(old.tier).toBeUndefined(); expect(old.fresh).toBeUndefined();
    expect(withTier(old).tier).toBe('P1'); expect(withTier(asDesign({ ...structuredClone(DESIGN_MCLAREN_F1), v: 5 })!).tier).toBe('P3');
    expect(asDesign({ ...structuredClone(DESIGN_P959), tier: 'X9', fresh: true })!.tier).toBeUndefined();   // a class that is none: none
    expect(designFigures(old).hp).toBe(442);   // no class: nothing held (as the format-5 design drove)
  });
});

describe('the restrictor and the limiter (doc 115 §3, question 5: held, not refused)', () => {
  it('the 599 chosen at S3: held to 400 hp by the restrictor and 310 km/h by the limiter; at P1 it is as it was', () => {
    const f = designFigures(at(DESIGN_P959, 'S3')); expect(f.hpFree).toBe(442); expect(f.hp).toBe(400); expect(f.restrictor).toBe(42);
    expect(f.topKmh).toBe(310); expect(f.limiter).toBe(310); expect(f.topFree).toBeGreaterThan(310); expect(tierOf(f).id).toBe('S3');
    const p = designFigures(at(DESIGN_P959, 'P1')); expect(p.hp).toBe(442); expect(p.restrictor).toBe(0); expect(p.limiter).toBe(0); expect(p.topKmh).toBe(326);
  });
  it('the driving game holds the limiter: an N1 car on the flat does not pass 161 km/h', () => {
    const d = fitEngine(at(DESIGN_P959, 'N1'), 80), s = designSpec(d); expect(s.limiter).toBe(160);
    const flat = new Track({ name: 'flat', pieces: [{ kind: 'straight', len: 9000, name: 'a' }, { kind: 'arc', radius: 400, turn: 180, name: 'b' }, { kind: 'straight', len: 9000, name: 'c' }, { kind: 'arc', radius: 400, turn: 180, name: 'd' }], start: { x: 0, y: 0, heading: 0 }, width: 30, easing: 30, banking: [], bumps: [], landmarks: [], joints: 12 });
    const c = new Vehicle(s, flat).place(100, 0, 0); let vmax = 0; for (let t = 0; t < 90; t += 1 / 200) { c.step(1 / 200, { throttle: 1, brake: 0, steer: 0 }); vmax = Math.max(vmax, c.speed * 3.6); }
    expect(vmax).toBeLessThan(161); expect(vmax).toBeGreaterThan(150);
  });
});

describe('the builder\'s walls', () => {
  const p1 = at(DESIGN_P959, 'P1');
  it('an option past the cap needs a higher rung; one that lowers the power is free', () => {
    const n = needOf(p1, e => { e.cc = 3600; })!; expect(n.need.group).toBe('P'); expect(n.hp).toBeGreaterThan(460); expect(needText(n)).toMatch(/^P[23] 필요$/);
    expect(needOf(p1, e => { e.turbo = 0; })).toBeNull(); expect(needOf(p1, e => { e.cc = 2400; })).toBeNull();
    const h = needOf(at(DESIGN_P959, 'P3'), e => { e.cc = 6000; e.boost = 1.4; })!; expect(h.need.group).toBe('H'); expect(h.locked).toBe('2000년대 이후'); expect(needOf(at(DESIGN_P959, 'P3'), e => { e.cc = 6000; e.boost = 1.4; }, true)!.locked).toBeNull();
  });
  it('a slider stops at the last value under the cap, and says where its wall is', () => {
    const w = sliderWall(p1, 'cc', 50); expect(w.at).not.toBeNull(); expect(w.need!.id).toBe('P2');
    const stop = wallStop(w, p1.engine.cc, 6000); expect(stop).toBeLessThan(w.at!); expect(freeHp({ ...p1, engine: { ...p1.engine, cc: stop } })).toBeLessThanOrEqual(460);
    expect(wallStop(w, p1.engine.cc, 2000)).toBe(2000);   // down is always free
  });
  it('an engine brought under each rung\'s cap (a new design on a lower rung); above its own rung it stays as it is', () => {
    for (const t of TIERS.filter(x => x.road && Number.isFinite(x.hpMax))) { const d = fitEngine(p1, t.hpMax); expect(freeHp(d), t.id).toBeLessThanOrEqual(t.hpMax); }
    expect(fitEngine(p1, 650).engine).toEqual(p1.engine);
  });
  it('a move down says what it would hold; a move up holds nothing', () => {
    const m = moveTo(p1, tierById('S3')!); expect(m.down).toBe(true); expect(m.cut).toBe(42); expect(m.limiter).toBe(310);
    const u = moveTo(p1, tierById('P3')!); expect(u.down).toBe(false); expect(u.cut).toBe(0); expect(u.limiter).toBe(0);
    expect(chosenTier(at(DESIGN_P959, 'S3')).id).toBe('S3');
  });
  it('the hyper rungs are the 2000s\' (opened by the sandbox\'s setting), the racing rungs not ready', () => {
    expect(tierLock(tierById('H1')!)).toBe('2000년대 이후'); expect(tierLock(tierById('H1')!, true)).toBeNull(); expect(tierLock(tierById('R2')!, true)).toBe('준비 중'); expect(tierLock(tierById('P3')!)).toBeNull();
    expect(asSettings(null).sandbox.eraOpen).toBe(false); expect(asSettings({ sandbox: { eraOpen: true } }).sandbox.eraOpen).toBe(true);
  });
});
