import { describe, it, expect } from 'vitest';
import { millbrook } from '../race/millbrook';
import { millbrookScenery } from '../race/scenery';
describe('the bridges stand on the ground (review 113)', () => {
  const T = millbrook(), S = millbrookScenery(T);
  it("the Members' Bridge deck rests on its abutments, each reaching up from the ground at its side", () => {
    const deck = S.props.filter(p => p.kind === 'bridgeDeck'), ab = S.props.filter(p => p.kind === 'bridgeAbutment'); expect(deck.length).toBe(3); expect(ab.length).toBe(2);
    for (const a of ab) { const l = T.locate(a.x, a.y), ground = T.height(l.s, l.off); expect(Math.abs((a.z ?? 0) - ground)).toBeLessThan(0.05); expect((a.z ?? 0) + (a.arg ?? 5800) / 1000).toBeCloseTo(deck[0]!.z!, 2); }
    const s = T.spec.landmarks.find(l => l.name === "Members' Bridge")!.s, W2 = T.spec.width / 2; expect(deck[0]!.z!).toBeGreaterThan(Math.max(T.height(s, -W2), T.height(s, W2)) + 5);   // clear of the road
  });
  it('the Byfleet river bridge parapets stand on the edges of the road, the banking top on the high side', () => {
    for (const p of S.props.filter(p => p.kind === 'riverBridge')) { const l = T.locate(p.x, p.y); expect(Math.abs((p.z ?? 0) - T.height(l.s, l.off))).toBeLessThan(0.05); }
  });
});
