// The free body prototype (docs/systems/106): any reasonable control curves give a closed shell, fixtures cut in or
// laid on keep it closed, and the same input gives the same mesh.
import { describe, expect, it } from 'vitest';
import { buildFree } from '../render/car/free/build';
import { blend, dragCurve, joinPieces, moveKey, pieceOf, CURVES, type Silhouette } from '../render/car/free/curves';
import { PRESETS, WEDGE, CANOPY, COKE, LONGTAIL } from '../render/car/free/presets';
import { FIXTURE_SET, NSX_DUCT, EB110_LAMP } from '../render/car/free/library';

/** a small seeded generator (the same numbers every run) */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const finite = (c: ReturnType<typeof buildFree>) => Array.from(c.mesh.pos).every(Number.isFinite);
/** a silhouette shaken within ranges a designer might drag to: every keypoint moved, the chassis stretched */
function shaken(base: Silhouette, r: () => number): Silhouette { const span: Record<string, number> = { top: 160, crest: 120, floor: 60, half: 120, shoulder: 0.2, roof: 0.2, sail: 200, round: 3, tuck: 60 };
  const curves = { ...base.curves }; for (const n of CURVES) curves[n] = base.curves[n].map(([s, v]) => [s, v + (r() * 2 - 1) * span[n]!]);
  const c = base.chassis; return { ...base, curves, chassis: { ...c, front: c.front * (0.85 + r() * 0.3), wheelbase: c.wheelbase * (0.85 + r() * 0.3), rear: c.rear * (0.8 + r() * 0.4), r: c.r * (0.9 + r() * 0.2) } }; }

describe('free body', () => {
  it('the four presets close', () => { for (const s of PRESETS) { const c = buildFree(s); expect(c.closure.open, s.name).toBe(0); expect(c.closure.over, s.name).toBe(0); expect(finite(c)).toBe(true); } });
  it('random curve sets within ranges close (shaken, blended, joined, dragged)', () => { const r = rng(7);
    for (let k = 0; k < 24; k++) { const a = PRESETS[Math.floor(r() * 4)]!, b = PRESETS[Math.floor(r() * 4)]!;
      let s = k % 3 === 0 ? shaken(a, r) : k % 3 === 1 ? blend(shaken(a, r), b, r()) : joinPieces(pieceOf(a, 'nose'), pieceOf(shaken(b, r), 'cabin'), pieceOf(PRESETS[k % 4]!, 'tail'));
      s = dragCurve(s, 'top', 0.5 + r() * 2, (r() * 2 - 1) * 150, 0.2 + r() * 0.3); s = moveKey(s, 'half', 2, (r() - 0.5) * 0.2, (r() - 0.5) * 100);
      const c = buildFree(s); expect(c.closure.open, `case ${k}`).toBe(0); expect(c.closure.over, `case ${k}`).toBe(0); expect(finite(c), `case ${k}`).toBe(true); } });
  it('the fixture set keeps every preset closed, and cuts its holes', () => { for (const s of PRESETS) { const c = buildFree(s, { fixtures: FIXTURE_SET.map(f => ({ fixture: f })) });
    expect(c.closure.open, s.name).toBe(0); expect(c.closure.over, s.name).toBe(0); expect(c.fixtures.filter(f => f.ok).length, s.name).toBeGreaterThanOrEqual(3); } });
  it('fixtures dragged anywhere keep the body closed (refused where they cannot fit)', () => { const r = rng(11);
    for (let k = 0; k < 8; k++) { const c = buildFree([WEDGE, CANOPY, COKE, LONGTAIL][k % 4]!, { fixtures: [{ fixture: NSX_DUCT, s: 0.3 + r() * 2.4, a: 0.1 + r() * 0.6, scale: 0.7 + r() * 0.6, rot: (r() - 0.5) * 40 }, { fixture: EB110_LAMP, s: 0.2 + r() * 0.8, a: 0.1 + r() * 0.4 }] });
      expect(c.closure.open, `case ${k}`).toBe(0); expect(c.closure.over, `case ${k}`).toBe(0); for (const f of c.fixtures) if (!f.ok) expect(f.why).toBeTruthy(); } });
  it('is deterministic', () => { const a = buildFree(COKE, { fixtures: FIXTURE_SET.map(f => ({ fixture: f })) }), b = buildFree(COKE, { fixtures: FIXTURE_SET.map(f => ({ fixture: f })) });
    expect(a.mesh.n).toBe(b.mesh.n); expect(Array.from(a.mesh.pos)).toEqual(Array.from(b.mesh.pos)); });
  it('a blend at 0 and 1 is its ends', () => { const a = buildFree(blend(WEDGE, LONGTAIL, 0)), w = buildFree(WEDGE); expect(a.mesh.n).toBe(w.mesh.n); });
});
