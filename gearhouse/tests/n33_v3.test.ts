// The N33's third cage, gate 1 (docs/systems/117 §15): the remade front third is a closed shell with the real car's
// measures where the second cage was wrong (the lamps' band, the ledge, the wing's crest over the bonnet's edge, the wheel)
import { describe, expect, it } from 'vitest';
import { buildCageV3, buildN33ShellV3, V3 } from '../render/car/n33/v3';
import { edgeUse } from '../render/car/p959/shell';
import { DIM } from '../render/car/n33';

describe('the N33 third cage (front third)', () => {
  const C = buildCageV3(), S = buildN33ShellV3(), at = (i: number, j: number) => C.P[C.M[i]![j]!]!;
  it('is a closed shell', () => { const use = [...edgeUse(S.F).values()]; expect(use.filter(u => u !== 2).length).toBe(0); });
  it('has the lamps\' band about 100 mm high with its foot near 590', () => { expect(at(0, 0)[2]).toBeGreaterThan(580); expect(at(0, 0)[2]).toBeLessThan(600); const h = at(2, 4)[2] - at(0, 5)[2]; expect(h).toBeGreaterThan(95); expect(h).toBeLessThan(125); });
  it('has the bumper\'s ledge standing out ahead of the lamps', () => { const edge = Math.min(...C.P.filter(p => p[2] > 500).map(p => p[0])), foot = at(0, 0)[0]; expect(foot - edge).toBeGreaterThan(60); });
  it('has the wing\'s crest above the bonnet\'s edge along the bonnet', () => { for (let i = 5; i <= 11; i++) expect(at(i, 6)[2]).toBeGreaterThan(at(i, 5)[2] + 3); });
  it('keeps the bonnet\'s flank flat between the ramp and the shut line', () => { for (let i = 5; i <= 11; i++) { const a = at(i, 2), b = at(i, 5), m = at(i, 3), t = (m[1] - a[1]) / (b[1] - a[1]); expect(Math.abs(m[2] - (a[2] + (b[2] - a[2]) * t))).toBeLessThan(0.5); } });
  it('fits a 245/45 R17 wheel in the arch', () => { expect(DIM.tyreR * 2).toBeGreaterThan(645); expect(V3.archR - DIM.tyreR).toBeLessThanOrEqual(25); expect(V3.rimR / DIM.tyreR).toBeGreaterThan(0.7); });
});
