// A design made into the car kit (render/car/design.ts, docs/systems/98_alpha_interface_and_builder_plan.md B1): the
// three cars the kit was made from come out exactly as their own specs; every combination of base, nose, front, tail and
// wheel the builder offers closes at every seam, and so do the body's dimensions at the ends of each base's ranges (alpha
// 0.11, E1: one at a time on every kind, and a few random designs with all of them at once); the wing and the diffuser
// are drawn when the kit has them.
import { describe, it, expect } from 'vitest';
import { wheelsOf, type Mesh } from '../render/car/mesh';
import { assemble } from '../render/car/kit/assemble';
import { seamCheck } from '../render/car/kit/check';
import { designChoices, designKit, designMesh } from '../render/car/design';
import { F355_KIT } from '../render/car/cars/f355.kit';
import { EB110_KIT } from '../render/car/cars/eb110.kit';
import { Rng } from '../core/rng';
import { NSX_KIT } from '../render/car/cars/nsx.kit';
import { BASES, BODY_LIMITS, DESIGN_EB110, DESIGN_F355, DESIGN_NSX, DIMS, FRONTS, LIMITS, NOSES, TAILS, WHEELS, type BaseId, type Design } from '../core/design';

const closed = (r: ReturnType<typeof seamCheck>, what: string) => { expect(r.open.map(e => `${e.names} ${e.a.map(Math.round)}`), what).toEqual([]); expect(r.nonManifold.length, what).toBe(0); expect(r.duplicates, what).toBe(0); expect(r.overlaps, what).toBe(0); expect(r.seams, what).toBeGreaterThan(300); };
const sameShape = (a: Mesh, b: Mesh) => { expect(a.n).toBe(b.n); expect(a.length).toBe(b.length); let worst = 0; for (let i = 0; i < a.pos.length; i++) worst = Math.max(worst, Math.abs(a.pos[i]! - b.pos[i]!)); expect(worst).toBe(0); };
const own = (b: BaseId) => ({ nsx: DESIGN_NSX, f355: DESIGN_F355, eb110: DESIGN_EB110 })[b];
const names = (M: Mesh) => new Set(M.names);
const body = (d: Design, b: Partial<Design['body']>): Design => ({ ...d, body: { ...d.body, ...b } });
const check = (d: Design, lamps = 0) => { const { kit, tweak } = designKit(d); return seamCheck(assemble(kit, { lamps, tweak })); };
const label = (d: Design) => `${d.body.base} ${d.body.nose} ${d.body.front} ${d.body.tail} ${d.body.wheel} ${DIMS.map(k => `${k} ${d.body[k]}`).join(' ')}`;

describe('design: the kit\'s own cars', () => {
  it('the NSX\'s design is the NSX\'s spec (the same triangles at the same places, lamps down and up)', () => {
    sameShape(designMesh(DESIGN_NSX), assemble(NSX_KIT).mesh); sameShape(designMesh(DESIGN_NSX, 0.4, 1), assemble(NSX_KIT, { spin: 0.4, lamps: 1 }).mesh);
    expect(designKit(DESIGN_NSX).tweak).toEqual({});
  });
  it('the F355\'s design is the F355\'s spec (its undertray\'s diffuser drawn besides)', () => { const bare = { ...DESIGN_F355, kit: { ...DESIGN_F355.kit, diffuser: false } };
    sameShape(designMesh(bare), assemble(F355_KIT).mesh); sameShape(designMesh(bare, 0, 1), assemble(F355_KIT, { lamps: 1 }).mesh);
    expect(names(designMesh(DESIGN_F355)).has('diffuser')).toBe(true); expect(names(designMesh(bare)).has('diffuser')).toBe(false); });
  it('the EB110\'s design is the EB110\'s spec (its real 325 mm rear tyres), its active wing down and up', () => { const kitTyres = { ...DESIGN_EB110, kit: { ...DESIGN_EB110.kit, tyres: [245, 310] as [number, number] } };
    // the body and its parts (the powertrain is built from the design's machinery, render/car/powertrain: not compared)
    const body = (A: ReturnType<typeof assemble>) => { const k: number[] = []; for (let t = 0; t < A.mesh.n; t++) if (A.panels[A.panelOf[t]!] !== 'engine') for (let i = 0; i < 9; i++) k.push(A.mesh.pos[t * 9 + i]!); return k; };
    for (const w of [0, 1]) expect(body(assemble(designKit(kitTyres).kit, { wing: w }))).toEqual(body(assemble(EB110_KIT, { wing: w }))); expect(designKit(DESIGN_EB110).tweak).toEqual({});
    expect(names(designMesh({ ...DESIGN_EB110, kit: { ...DESIGN_EB110.kit, wing: false } })).has('wing')).toBe(false); });
  it('a wing on every base and tail when the kit has one (an active one rises), none without', () => {
    for (const b of BASES) for (const tail of TAILS) { const d = body({ ...own(b), kit: { ...own(b).kit, wing: true } }, { tail }), up = designMesh(d, 0, 0, 1);
      expect(names(up).has('wing'), `${b} ${tail}`).toBe(true); expect(names(designMesh({ ...d, kit: { ...d.kit, wing: false } })).has('wing')).toBe(false); }
  });
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
  it('offers every kind on every base', () => { for (const b of BASES) expect(designChoices(b)).toEqual({ nose: NOSES, front: FRONTS, tail: TAILS, wheel: WHEELS }); });
});

describe('design: every combination closes', () => {
  for (const b of BASES) it(`on the ${b}: every nose, front, tail and wheel (lamps down; up with each base's own wheel)`, () => {
    const C = designChoices(b);
    for (const nose of C.nose) for (const front of C.front) for (const tail of C.tail) for (const wheel of C.wheel) {
      const d = body(own(b), { nose, front, tail, wheel }); closed(check(d), label(d)); if (wheel === own(b).body.wheel) closed(check(d, 1), `${label(d)} lamps up`); }
  }, 60000);
  for (const b of BASES) it(`on the ${b}: the wheelbase and the width at the ends of their ranges, its own kinds and the other base's`, () => {
    const other = own(BASES[(BASES.indexOf(b) + 1) % BASES.length]!).body;
    for (const wheelbase of LIMITS.wheelbase) for (const width of LIMITS.width) for (const kinds of [{}, { nose: other.nose, front: other.front, tail: other.tail, wheel: other.wheel }]) {
      const d = body(own(b), { ...kinds, wheelbase, width }); closed(check(d), label(d)); }
    closed(check(body(own(b), { wheelbase: LIMITS.wheelbase[1], width: LIMITS.width[1], tail: 'roundLamps' }), 1), 'long and wide, round lamps, lamps up');
  }, 60000);
});

describe('design: the body\'s dimensions (E1) close at the ends of each base\'s ranges', () => {
  // every kind of every slot comes round as each end of each dimension is tried (the kinds stepped through together)
  const kinds = (i: number) => ({ nose: NOSES[i % NOSES.length]!, front: FRONTS[(i >> 1) % FRONTS.length]!, tail: TAILS[i % TAILS.length]!, wheel: WHEELS[(i + 1) % WHEELS.length]! });
  for (const b of BASES) it(`on the ${b}: each dimension at each end, one at a time, the kinds stepped through; the wing and the diffuser on`, () => {
    const lim = BODY_LIMITS(b); let i = 0;
    for (const k of DIMS) for (const v of lim[k]) { const d = body({ ...own(b), kit: { ...own(b).kit, wing: true, diffuser: true } }, { ...kinds(i++), [k]: v }); closed(check(d), label(d)); }
  }, 60000);
  it('a few random designs with every dimension set at once (each base, lamps up on some)', () => {
    const r = new Rng(110);
    for (let n = 0; n < 12; n++) { const b = BASES[n % BASES.length]!, lim = BODY_LIMITS(b), dims = Object.fromEntries(DIMS.map(k => [k, Math.round(lim[k][0] + (lim[k][1] - lim[k][0]) * r.float())]));
      const d = body(own(b), { ...kinds(Math.floor(r.float() * 24)), ...dims }); closed(check(d, n % 3 === 0 ? 1 : 0), label(d)); }
  }, 60000);
  it('the dimensions move the car as they say', () => {
    const top = (M: Mesh) => { let z = 0; for (let t = 0; t < M.n; t++) if (/^(roof|canopy|rail|screen)/.test(M.names![M.part[t]!] ?? '') || true) for (let k = 0; k < 3; k++) { const i = t * 9 + k * 3; if (Math.abs(M.pos[i + 1]!) < 50) z = Math.max(z, M.pos[i + 2]!); } return z; };
    const M0 = designMesh(DESIGN_NSX), w0 = wheelsOf(M0);
    expect(top(designMesh(body(DESIGN_NSX, { roof: -60 })))).toBeCloseTo(top(M0) - 60, 0);
    const L = designMesh(body(DESIGN_NSX, { overhangF: 100, overhangR: 150 })), wl = wheelsOf(L); expect(L.length).toBe(M0.length + 250); expect(wl[0]!.hx).toBeCloseTo(w0[0]!.hx + 100, 3); expect(wl[1]!.hx - wl[0]!.hx).toBeCloseTo(w0[1]!.hx - w0[0]!.hx, 3);
    const R = designMesh(body(DESIGN_NSX, { ride: 30 })), wr = wheelsOf(R); expect(wr[0]!.hz).toBeCloseTo(w0[0]!.hz, 3); expect(top(R)).toBeCloseTo(top(M0) + 30, 0);
    const T = wheelsOf(designMesh(body(DESIGN_NSX, { track: 60 }))); expect(Math.abs(T[0]!.hy) - Math.abs(w0[0]!.hy)).toBeCloseTo(30, 0);
    expect(designKit(body(DESIGN_NSX, { track: 60, roof: -20, rake: 3, cabin: 50 })).tweak).toEqual({ halfTrack: 30, roof: -20, rake: 3, cabin: 50 });
  });
});
