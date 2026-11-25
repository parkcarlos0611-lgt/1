// The game's bodies and the 959 one-make race (docs/systems/113 V0): one list of enabled bodies, the old designs kept but
// filtered, the title's car an enabled one, and a race set up with a field of 959s that differ car to car.
import { describe, it, expect } from 'vitest';
import { ENABLED_BODIES, isEnabledBody, enabledDesign, recentEnabled, starterDesign, stockP959 } from '../core/bodies';
import { fromPreset, saveDesign, keepCurrent, savedDesigns, type KeyStore } from '../core/designstore';
import { oneMakeField, PAINTS_1980S } from '../race/onemake';
import { designSpec } from '../race/design';
import { addRaceCar } from '../race/cars';
import { Race, bookTime, SKILL } from '../race/race';
import { millbrook } from '../race/millbrook';
import { repaint, fieldMesh, fieldKept } from '../render/car/fieldmesh';
import { KINDS, type Mesh } from '../render/car/mesh';

const mem = (): KeyStore => { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k) }; };

describe('the enabled bodies', () => {
  it('holds the 959 alone; the kit bases are off', () => {
    expect(ENABLED_BODIES).toEqual(['p959']); expect(isEnabledBody('p959')).toBe(true);
    for (const b of ['nsx', 'f355', 'eb110', 'xyz']) expect(isEnabledBody(b)).toBe(false);
    expect(starterDesign().body.base).toBe('p959'); expect(enabledDesign(fromPreset('nsx'))).toBe(false);
  });
  it('keeps an old design in the storage but shows an enabled one (else the stock 959)', () => {
    const s = mem(), old = fromPreset('f355'); saveDesign(s, old); keepCurrent(s, old);
    expect(recentEnabled(s).id).toBe('p959stock'); expect(savedDesigns(s).map(d => d.id)).toEqual([old.id]);
    const mine = fromPreset('p959', '내 959'); saveDesign(s, mine);
    expect(recentEnabled(s).id).toBe(mine.id); keepCurrent(s, mine); expect(recentEnabled(s).id).toBe(mine.id);
    expect(stockP959().body.model?.plate).toBe('08루 0959');
  });
});

describe('a 959 one-make field', () => {
  it('draws the same field from the same seed, each car its own colour, plate, swaps and driver', () => {
    const a = oneMakeField(7, 42), b = oneMakeField(7, 42), c = oneMakeField(7, 43);
    expect(a.map(f => f.design)).toEqual(b.map(f => f.design)); expect(a.map(f => f.design)).not.toEqual(c.map(f => f.design));
    expect(new Set(a.map(f => f.design.id)).size).toBe(7); expect(new Set(a.map(f => f.design.name)).size).toBe(7);
    expect(new Set(a.map(f => f.design.body.model!.plate)).size).toBe(7);
    for (const f of a) { expect(f.design.body.base).toBe('p959'); expect(PAINTS_1980S.some(p => p.hex === f.paint)).toBe(true); expect(f.design.body.model!.plate).toMatch(/^\d{2}\S \d{4}$/); }
    const field = oneMakeField(40, 5), seen = (k: 'bumperF' | 'lamp' | 'wheel') => new Set(field.map(f => f.design.body.model![k])).size;
    expect(seen('bumperF')).toBe(3); expect(seen('lamp')).toBe(3); expect(seen('wheel')).toBe(3); expect(new Set(field.map(f => f.paint)).size).toBeGreaterThan(4);
    const N = SKILL.normal, dares = field.map(f => f.dare), paces = field.map(f => f.pace);
    expect(Math.max(...dares) - Math.min(...dares)).toBeGreaterThan(N.dare[1] - N.dare[0]); expect(Math.max(...paces)).toBeLessThanOrEqual(1); expect(Math.max(...dares)).toBeLessThanOrEqual(0.75);
  });
  it('sets up a race of N 959s with their own drivers and one book time (no handicap between them)', () => {
    const T = millbrook(), me = stockP959(), mySpec = designSpec(me); addRaceCar(mySpec);
    for (const n of [1, 3, 7]) { const field = oneMakeField(n, 9), drivers: Record<string, { dare: number; pace: number }> = {}, ids: string[] = [];
      for (const f of field) { const s = designSpec(f.design); addRaceCar(s); ids.push(s.id); drivers[s.id] = { dare: f.dare, pace: f.pace }; }
      for (const mode of ['handicap', 'scratch'] as const) { const r = new Race(T, [mySpec.id, ...ids], 2, mySpec.id, 3, mode, 'normal', drivers);
        expect(r.cars).toHaveLength(n + 1); expect(r.player?.id).toBe(mySpec.id); expect(r.cars.every(c => c.start === 0)).toBe(true);
        expect(new Set([mySpec.id, ...ids].map(id => bookTime(id, 2))).size).toBe(1);
        for (const e of r.cars) { expect(e.car.spec.mass).toBeCloseTo(mySpec.mass, 6); if (e.driver) expect(e.driver).toMatchObject({ dare: drivers[e.id]!.dare }); }
        for (let i = 0; i < 200; i++) r.step(0.005, { throttle: 1, brake: 0, steer: 0 });
        expect(r.cars.every(e => Number.isFinite(e.car.x) && Number.isFinite(e.car.y))).toBe(true); } }
  });
  it('paints a kept mesh: the body colour changed, the other parts left', () => {
    const P = KINDS.indexOf('paint'), M = { n: 3, col: new Uint8Array([10, 20, 30, 10, 20, 30, 10, 20, 30]), kind: new Uint8Array([P, P, 0]) } as unknown as Mesh;
    const Q = repaint(M, [10, 20, 30], [200, 0, 0]); expect(Array.from(Q.col)).toEqual([200, 0, 0, 200, 0, 0, 10, 20, 30]); expect(Array.from(M.col)).toEqual([10, 20, 30, 10, 20, 30, 10, 20, 30]);
  });
  it('builds a 959 once for its shape and paints the same car in another colour from it', () => {
    const [f] = oneMakeField(1, 77), d = f!.design, d2 = { ...d, body: { ...d.body, paint: '#00ff00' } };
    const before = fieldKept(), A = fieldMesh(d), B = fieldMesh(d2); expect(fieldKept()).toBe(before + 1); expect(fieldMesh(d)).toBe(A); expect(B.n).toBe(A.n);
    let green = 0; for (let t = 0; t < B.n; t++) if (B.col[t * 3] === 0 && B.col[t * 3 + 1] === 255 && B.col[t * 3 + 2] === 0) green++;
    expect(green).toBeGreaterThan(A.n * 0.15);
  });
});
