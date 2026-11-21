import { describe, expect, test } from 'vitest';
import { newWorld } from '../core/world';

describe('ordering on the telephone (review 47)', () => {
  test('a supplier quotes at once on the telephone, and the order goes as any other', () => {
    const W = newWorld(77, { background: 'coachbuilder', age: 31, given: 'W', family: 'H' }); const g = W.sim.g;
    expect(() => W.supply.call('kessler_hardware', [{ part: 'paint_set', qty: 1 }])).toThrow();   // no telephone in the shop yet
    g.supply.phone = true; const q = W.supply.call('kessler_hardware', [{ part: 'paint_set', qty: 1 }]);
    expect(q).not.toBeNull(); expect(q!.via).toBe('phone'); expect(q!.lines[0]!.part).toBe('paint_set');
    const cash = g.ledger.cash, o = W.supply.order(q!.id); expect(o.state).toBe('coming');
    if (q!.prepaid) expect(g.ledger.cash).toBeLessThan(cash);
    expect(W.supply.call('kessler_hardware', [{ part: 'engine', qty: 1 }])).toBeNull();          // not a thing they sell
    expect(() => W.supply.call('dunmore_glass', [{ part: 'glass_set', qty: 1 }])).toThrow();       // no telephone there
  });
});
