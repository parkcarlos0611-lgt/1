// The car's face in slots (alpha 0.12, E2: core/design.ts Face, render/car/face.ts): the prow, the bumper, the grille,
// the head lamps (and their units) and the auxiliary lamps swapped on every base. A format-3 design (a nose and a front)
// comes out as the same car; the rules say what cannot go together; a grille and the lamps take their places from the
// bumper chosen; and a sample of the faces the rules allow closes at every seam on every base, lamps down and up. The
// sample: every value of every slot with every value of every other slot (a pairwise cover, drawn with a fixed seed), about
// thirty faces a base. Every combination (1,620 a base, twice for the lamps) is tried by tools/ref/face.ts `all`.
import { describe, it, expect } from 'vitest';
import { assemble } from '../render/car/kit/assemble';
import { seamCheck } from '../render/car/kit/check';
import { designKit } from '../render/car/design';
import type { CarKit } from '../render/car/kit/spec';
import { NSX_KIT, NSX_MASS_NOSE, NSX_POINTED_NOSE, NSX_SUNK_FRONT } from '../render/car/cars/nsx.kit';
import { F355_KIT, F355_MASS_NOSE, F355_PLAIN_FRONT, F355_ROUND_NOSE } from '../render/car/cars/f355.kit';
import { EB110_KIT, EB110_POINTED_NOSE, EB110_ROUND_NOSE, EB110_SUNK_FRONT } from '../render/car/cars/eb110.kit';
import { Rng } from '../core/rng';
import { asDesign } from '../core/designstore';
import { AUXES, BASES, BUMPERS, DESIGN_EB110, DESIGN_F355, DESIGN_NSX, FACE_KEYS, FACE_OWN, FRONTS, GRILLES, HEADS, NOSES, PODS, faceLock, fitFace, normalise,
  type BaseId, type Design, type DesignV3, type Face, type FrontKind, type NoseKind } from '../core/design';

const own = (b: BaseId) => ({ nsx: DESIGN_NSX, f355: DESIGN_F355, eb110: DESIGN_EB110 })[b];
type Fc = Face & { nose: NoseKind };
const made = (b: BaseId, f: Partial<Fc>): Design => ({ ...own(b), body: { ...own(b).body, ...f } });
const build = (d: Design, lamps = 0) => { const { kit, tweak } = designKit(d, 0); return assemble(kit, { lamps, tweak }); };
const closed = (d: Design, lamps: number) => { const r = seamCheck(build(d, lamps)), what = `${d.body.base} ${d.body.nose} ${FACE_KEYS.map(k => d.body[k]).join(' ')} lamps ${lamps}`;
  expect(r.open.map(e => `${e.names} ${e.a.map(Math.round)}`), what).toEqual([]); expect(r.nonManifold.length, what).toBe(0); expect(r.duplicates, what).toBe(0); expect(r.overlaps, what).toBe(0); };
const ok = (b: BaseId, f: Fc) => FACE_KEYS.every(k => !faceLock({ ...f, base: b }, k, f[k]));
/** every triangle's points but the machinery's (the powertrain is built from the design's engine, the suspension at the
 *  engine's level of detail) */
const shell = (A: ReturnType<typeof assemble>) => { const k: number[] = []; for (let t = 0; t < A.mesh.n; t++) if (A.panels[A.panelOf[t]!] !== 'engine' && A.panels[A.panelOf[t]!] !== 'suspension') for (let i = 0; i < 9; i++) k.push(A.mesh.pos[t * 9 + i]!); return k; };

describe('face: format 3\'s nose and front as slots', () => {
  // alpha 0.11's patches, laid as its builder laid them
  const OLD: Record<BaseId, { kit: CarKit; nose: Record<NoseKind, Partial<CarKit> | null>; front: Record<FrontKind, Partial<CarKit> | null> }> = {
    nsx: { kit: NSX_KIT, nose: { round: null, pointed: NSX_POINTED_NOSE, mass: NSX_MASS_NOSE }, front: { plain: null, sunk: NSX_SUNK_FRONT } },
    f355: { kit: F355_KIT, nose: { round: F355_ROUND_NOSE, pointed: null, mass: F355_MASS_NOSE }, front: { plain: F355_PLAIN_FRONT, sunk: null } },
    eb110: { kit: EB110_KIT, nose: { round: EB110_ROUND_NOSE, pointed: EB110_POINTED_NOSE, mass: null }, front: { plain: null, sunk: EB110_SUNK_FRONT } } };
  const v3 = (b: BaseId, nose: NoseKind, front: FrontKind): DesignV3 => { const { bumper: _b, grille: _g, head: _h, pod: _p, aux: _a, ...body } = own(b).body; void _b; void _g; void _h; void _p; void _a;
    return { ...own(b), v: 3, engine: own(b).engine as DesignV3['engine'], body: { ...body, nose, front }, kit: { ...own(b).kit, wing: false, diffuser: false, tyres: [OLD[b].kit.lines.wheels.f.w, OLD[b].kit.lines.wheels.r.w] } }; };
  for (const b of BASES) it(`on the ${b}: every nose and front of alpha 0.11 loads as the same body`, () => {
    for (const nose of NOSES) for (const front of FRONTS) { const d = normalise(v3(b, nose, front)), O = OLD[b]; let kit: CarKit = { ...O.kit, wing: undefined };
      for (const p of [O.nose[nose], O.front[front]]) if (p) kit = { ...kit, ...p };
      expect(d.v).toBe(4); expect('front' in d.body).toBe(false);
      expect(shell(build(d)), `${b} ${nose} ${front}`).toEqual(shell(assemble(kit))); }
  }, 60000);
  it('the slots a format-3 design had no say in are its base\'s own; a saved value and a link load the same', () => {
    for (const b of BASES) { const d = normalise(v3(b, 'round', 'sunk')); expect({ ...d.body }).toMatchObject({ ...FACE_OWN[b], aux: 'round', nose: 'round' });
      const s = asDesign(JSON.parse(JSON.stringify(v3(b, 'mass', 'plain'))))!; expect(s.v).toBe(4); expect({ ...s.body }).toMatchObject({ ...FACE_OWN[b], aux: b === 'eb110' ? 'none' : 'strip', nose: 'mass' }); }
    const kept = asDesign(JSON.parse(JSON.stringify(made('nsx', { bumper: 'wedge', grille: 'oval', head: 'pocket', pod: 'round', aux: 'none' }))))!;
    expect({ ...kept.body }).toMatchObject({ bumper: 'wedge', grille: 'oval', head: 'pocket', pod: 'round', aux: 'none' });
    expect(asDesign({ ...made('f355', {}), body: { ...made('f355', {}).body, grille: 'teeth', head: 7 } })!.body).toMatchObject({ grille: 'oval', head: 'popup' });
  });
  it('a format-4 file made while its halves were apart (the engine\'s fields with a front; the face\'s slots alone) loads whole', () => {
    for (const b of BASES) { const P = own(b), { bs: _s, quality: _q, ...engine } = P.engine; void _s; void _q;
      const engineHalf = { ...v3(b, 'pointed', 'sunk'), v: 4, engine: { ...P.engine, layout: 'I6', bs: 0.9, quality: { ...P.engine.quality, head: 2 } } };
      const faceHalf = { ...P, body: { ...P.body, bumper: 'airdam', grille: 'mesh', aux: 'none' }, engine };
      for (const d of [normalise(engineHalf as unknown as Design), asDesign(JSON.parse(JSON.stringify(engineHalf)))!]) {
        expect(d.v).toBe(4); expect('front' in d.body).toBe(false); expect({ ...d.body }).toMatchObject({ ...FACE_OWN[b], aux: 'round', nose: 'pointed' });
        expect(d.engine).toMatchObject({ layout: 'I6', bs: 0.9 }); expect(d.engine.quality.head).toBe(2); }
      for (const d of [normalise(faceHalf as unknown as Design), asDesign(JSON.parse(JSON.stringify(faceHalf)))!]) {
        expect({ ...d.body }).toMatchObject({ bumper: 'airdam', grille: 'mesh', aux: 'none' }); expect(d.engine).toEqual(P.engine); } }
  });
});

describe('face: the rules', () => {
  it('a mesh grille and round fog lamps both want the corners of the NSX\'s and the F355\'s bumper (not the EB110\'s)', () => {
    for (const b of ['nsx', 'f355'] as const) { const round = { ...FACE_OWN[b], base: b, aux: 'round' as const, grille: 'slot' as const }, mesh = { ...round, aux: 'strip' as const, grille: 'mesh' as const };
      expect(faceLock(round, 'grille', 'mesh')).toMatch(/안개등/); expect(faceLock(mesh, 'aux', 'round')).toMatch(/메시/); expect(faceLock(mesh, 'aux', 'none')).toBeNull(); expect(faceLock(round, 'grille', 'oval')).toBeNull();
      expect(fitFace({ ...mesh, aux: 'round' as const }).aux).toBe('strip'); expect(normalise(made(b, { grille: 'mesh', aux: 'round' })).body.aux).toBe('strip'); }
    expect(faceLock({ ...FACE_OWN.eb110, base: 'eb110', aux: 'round' }, 'grille', 'mesh')).toBeNull(); expect(normalise(made('eb110', { grille: 'mesh', aux: 'round' })).body.aux).toBe('round');
    for (const b of BASES) for (const k of FACE_KEYS) expect(faceLock(own(b).body, k, own(b).body[k]), `${b} ${k}`).toBeNull();
  });
  it('a grille and the lamps take their lines from the bumper chosen', () => {
    for (const b of BASES) for (const bumper of BUMPERS) { const lv = designKit(made(b, { bumper }), 0).kit.nose.levels; expect(lv.length).toBe(8); for (let i = 1; i < 8; i++) expect(lv[i]!, `${b} ${bumper}`).toBeLessThan(lv[i - 1]!);
      for (const grille of ['slot', 'oval'] as const) { const c = designKit(made(b, { bumper, grille }), 0).kit.intakes.centre, top = lv[c.cols[0] - 4]!, foot = lv[c.cols[1] - 4]!;
        expect(c.rows).toBeGreaterThan(0); expect(c.barZ[0]).toBeGreaterThanOrEqual(foot); expect(c.barZ[1]).toBeLessThanOrEqual(top); for (const z of c.slats?.z ?? []) { expect(z).toBeGreaterThan(foot); expect(z).toBeLessThan(top); } }
      const f = designKit(made(b, { bumper, aux: 'round', grille: 'none' }), 0).kit.intakes.fog!; expect(f.z + f.r).toBeLessThan(lv[f.cols[0] - 4]!); expect(f.z - f.r).toBeGreaterThan(lv[f.cols[1] - 4]!); expect(f.r).toBeGreaterThan(20); }
    // the same bumper's top line and lip on a base whatever its style; a splitter under the wedge and the air dam
    for (const b of BASES) { const o = own(b).body.bumper, L = (k: typeof o) => designKit(made(b, { bumper: k }), 0).kit;
      for (const k of BUMPERS) { expect(L(k).nose.levels[0]).toBe(L(o).nose.levels[0]); expect(L(k).nose.levels[7]).toBe(L(o).nose.levels[7]); expect(!!L(k).splitter, `${b} ${k}`).toBe(k === 'wedge' || k === 'airdam'); } }
  });
  it('each slot\'s parts are there', () => { const names = (d: Design, lamps = 0) => new Set(build(d, lamps).mesh.names);
    for (const b of BASES) { expect(names(made(b, { aux: 'none', grille: 'none' })).has('fogF')).toBe(false); expect(names(made(b, { aux: 'round' })).has('fogF')).toBe(true); expect(names(made(b, { aux: 'strip' })).has('indicatorF')).toBe(true);
      for (const head of HEADS) for (const pod of PODS) { const n = names(made(b, { head, pod }), 1); expect(n.has('headlamp'), `${b} ${head} ${pod}`).toBe(true); expect(n.has('lampLid')).toBe(head === 'popup'); expect(n.has('lampTray')).toBe(head === 'pocket'); }
      const tris = (g: Face['grille']) => build(made(b, { grille: g, aux: 'none' })).mesh.n; expect(tris('mesh')).toBeGreaterThan(tris('none')); expect(tris('oval')).toBeGreaterThan(tris('slot')); }
  }, 60000);
});

describe('face: the faces the rules allow close at every seam', () => {
  const SLOTS: [keyof Fc, readonly string[]][] = [['nose', NOSES], ['bumper', BUMPERS], ['grille', GRILLES], ['head', HEADS], ['pod', PODS], ['aux', AUXES]];
  /** a pairwise cover of a base's allowed faces: faces picked (the best of a seeded draw each time) until every pair of
   *  two slots' values that some allowed face has is in one of them */
  function cover(b: BaseId, seed: number): Fc[] {
    const all: Fc[] = []; for (const nose of NOSES) for (const bumper of BUMPERS) for (const grille of GRILLES) for (const head of HEADS) for (const pod of PODS) for (const aux of AUXES) { const f = { nose, bumper, grille, head, pod, aux }; if (ok(b, f)) all.push(f); }
    const pairs = (f: Fc) => { const o: string[] = []; for (let i = 0; i < SLOTS.length; i++) for (let j = i + 1; j < SLOTS.length; j++) o.push(`${SLOTS[i]![0]}=${f[SLOTS[i]![0]]}&${SLOTS[j]![0]}=${f[SLOTS[j]![0]]}`); return o; };
    const need = new Set(all.flatMap(pairs)), r = new Rng(seed), out: Fc[] = [];
    while (need.size) { let best: Fc | null = null, gain = 0; for (let n = 0; n < 80; n++) { const f = all[Math.floor(r.float() * all.length)]!, g = pairs(f).filter(p => need.has(p)).length; if (g > gain) { gain = g; best = f; } }
      if (!best) best = all.find(f => pairs(f).some(p => need.has(p)))!; out.push(best); for (const p of pairs(best)) need.delete(p); }
    return out; }
  it('the cover holds every value of every slot with every value of every other slot', () => {
    for (const b of BASES) { const C = cover(b, 12), has = (p: Partial<Fc>) => C.some(f => (Object.keys(p) as (keyof Fc)[]).every(k => f[k] === p[k]));
      expect(C.length).toBeLessThan(45); for (const f of C) expect(ok(b, f)).toBe(true);
      for (const nose of NOSES) for (const bumper of BUMPERS) expect(has({ nose, bumper })).toBe(true); for (const bumper of BUMPERS) for (const grille of GRILLES) for (const aux of AUXES) { expect(has({ bumper, grille })).toBe(true); expect(has({ bumper, aux })).toBe(true); }
      for (const head of HEADS) for (const pod of PODS) expect(has({ head, pod })).toBe(true); expect(has({ grille: 'mesh', aux: 'round' })).toBe(b === 'eb110'); }
  });
  for (const b of BASES) it(`on the ${b}: a pairwise cover of its faces, lamps down and up`, () => { for (const f of cover(b, 12)) { const d = made(b, f); closed(d, 0); closed(d, 1); } }, 120000);
});
