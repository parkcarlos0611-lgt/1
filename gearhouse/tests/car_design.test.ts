// A design made into the car kit (render/car/design.ts, docs/systems/98_alpha_interface_and_builder_plan.md B1): the
// two cars the kit was made from come out exactly as their own specs; every combination of base, nose, front, tail and
// wheel the builder offers closes at every seam, and so do the tweaks at the ends of their ranges.
import { describe, it, expect } from 'vitest';
import { wheelsOf, type Mesh } from '../render/car/mesh';
import { assemble } from '../render/car/kit/assemble';
import { seamCheck } from '../render/car/kit/check';
import { designChoices, designKit, designMesh } from '../render/car/design';
import { F355_KIT } from '../render/car/cars/f355.kit';
import { NSX_KIT } from '../render/car/cars/nsx.kit';
import { BASES, DESIGN_F355, DESIGN_NSX, FRONTS, LIMITS, NOSES, TAILS, WHEELS, type BaseId, type Design } from '../core/design';

const closed = (r: ReturnType<typeof seamCheck>, what: string) => { expect(r.open.map(e => `${e.names} ${e.a.map(Math.round)}`), what).toEqual([]); expect(r.nonManifold.length, what).toBe(0); expect(r.duplicates, what).toBe(0); expect(r.overlaps, what).toBe(0); expect(r.seams, what).toBeGreaterThan(300); };
const sameShape = (a: Mesh, b: Mesh) => { expect(a.n).toBe(b.n); expect(a.length).toBe(b.length); let worst = 0; for (let i = 0; i < a.pos.length; i++) worst = Math.max(worst, Math.abs(a.pos[i]! - b.pos[i]!)); expect(worst).toBe(0); };
const own = (b: BaseId) => b === 'nsx' ? DESIGN_NSX : DESIGN_F355;
const body = (d: Design, b: Partial<Design['body']>): Design => ({ ...d, body: { ...d.body, ...b } });
const check = (d: Design, lamps = 0) => { const { kit, tweak } = designKit(d); return seamCheck(assemble(kit, { lamps, tweak })); };
const label = (d: Design) => `${d.body.base} ${d.body.nose} ${d.body.front} ${d.body.tail} ${d.body.wheel} wb ${d.body.wheelbase} w ${d.body.width}`;

describe('design: the kit\'s own cars', () => {
  it('the NSX\'s design is the NSX\'s spec (the same triangles at the same places, lamps down and up)', () => {
    sameShape(designMesh(DESIGN_NSX), assemble(NSX_KIT).mesh); sameShape(designMesh(DESIGN_NSX, 0.4, 1), assemble(NSX_KIT, { spin: 0.4, lamps: 1 }).mesh);
    expect(designKit(DESIGN_NSX).tweak).toEqual({});
  });
  it('the F355\'s design is the F355\'s spec', () => { sameShape(designMesh(DESIGN_F355), assemble(F355_KIT).mesh); sameShape(designMesh(DESIGN_F355, 0, 1), assemble(F355_KIT, { lamps: 1 }).mesh); });
  it('the paint goes into the colours, the wheelbase and the width into the tweak', () => {
    const { kit, tweak } = designKit(body(DESIGN_NSX, { paint: '#1040a0', gloss: 0.8, wheelbase: 120, width: 30 }));
    expect(kit.colours.paint).toBe('#1040a0'); expect(kit.colours.gloss).toBe(0.8); expect(kit.colours.seam).not.toBe(NSX_KIT.colours.seam); expect(tweak).toEqual({ wheelbase: 120, halfWidth: 30 });
    const M = designMesh(body(DESIGN_NSX, { wheelbase: 120 })), w = wheelsOf(M); expect(M.length).toBe(NSX_KIT.lines.length + 120); expect(w[1]!.hx - w[0]!.hx).toBeCloseTo(NSX_KIT.lines.wheels.r.x - NSX_KIT.lines.wheels.f.x + 120, 3);
  });
  it('the tyres\' widths and the rims\' size go into the wheels', () => {
    const { kit } = designKit({ ...DESIGN_F355, kit: { ...DESIGN_F355.kit, rim: 16, tyres: [245, 295] } }), W = kit.lines.wheels;
    expect(W.f.w).toBe(245); expect(W.r.w).toBe(295); expect(W.f.rim).toBeLessThan(F355_KIT.lines.wheels.f.rim); expect(W.f.r).toBe(F355_KIT.lines.wheels.f.r);
    expect(wheelsOf(designMesh({ ...DESIGN_NSX, kit: { ...DESIGN_NSX.kit, rim: 18, tyres: [335, 335] } })).length).toBe(4);
  });
  it('offers every kind on both bases', () => { for (const b of BASES) expect(designChoices(b)).toEqual({ nose: NOSES, front: FRONTS, tail: TAILS, wheel: WHEELS }); });
});

describe('design: every combination closes', () => {
  for (const b of BASES) it(`on the ${b}: every nose, front, tail and wheel (lamps down; up with each base's own wheel)`, () => {
    const C = designChoices(b);
    for (const nose of C.nose) for (const front of C.front) for (const tail of C.tail) for (const wheel of C.wheel) {
      const d = body(own(b), { nose, front, tail, wheel }); closed(check(d), label(d)); if (wheel === own(b).body.wheel) closed(check(d, 1), `${label(d)} lamps up`); }
  }, 60000);
  for (const b of BASES) it(`on the ${b}: the wheelbase and the width at the ends of their ranges, its own kinds and the other base's`, () => {
    const other = own(b === 'nsx' ? 'f355' : 'nsx').body;
    for (const wheelbase of LIMITS.wheelbase) for (const width of LIMITS.width) for (const kinds of [{}, { nose: other.nose, front: other.front, tail: other.tail, wheel: other.wheel }]) {
      const d = body(own(b), { ...kinds, wheelbase, width }); closed(check(d), label(d)); }
    closed(check(body(own(b), { wheelbase: LIMITS.wheelbase[1], width: LIMITS.width[1], tail: 'roundLamps' }), 1), 'long and wide, round lamps, lamps up');
  }, 60000);
});
