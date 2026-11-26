// The engine designer (task M2, docs/systems/101 1-1 and 1-2): the engine library kept in a storage (a fake one, one that
// throws), each part's quality (nothing moves at 0; the right way at +-3), format 3's designs and links brought to
// format 4 and driving as before, the engine's voice worked out from its design, the dyno drawn from the very torque
// the physics uses, the stand's model for every layout with its exploded view and its part picking.
import { describe, it, expect } from 'vitest';
import { DESIGN_NSX, DESIGN_F355, DESIGN_DIABLO, DESIGN_EB110, DESIGN_XJ220, DESIGN_MCLAREN_F1, LAYOUTS, QUALITY_PARTS, BS_DEFAULT, normalise, type Design, type DesignV3 } from '../core/design';
import { parseDesign, decodeDesign, encodeDesign, type KeyStore } from '../core/designstore';
import { savedEngines, saveEngine, deleteEngine, duplicateEngine, engineEntry, asEngine, joinEngine, splitEngine, withEngine, familyRange, engineTechs, engineYear, ENGINES_KEY } from '../core/engines';
import { designSpec, designCost } from '../race/design';
import { torqueAt } from '../race/cars';
import { dynoCurve, engineSheet } from '../race/dyno';
import { engineFigures, qualityPower, enginePackage, engineMass } from '../race/designparts';
import { designVoice, voiceCharacter } from '../ui/sound';
import { standModel, exploded, pickPart, PART_INFO } from '../render/car/powertrain/stand';

class MapStore implements KeyStore { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }
const broken: KeyStore = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
const tweak = (d: Design, f: (d: Design) => void): Design => { const e = structuredClone(d); f(e); return normalise(e); };
const SIX = [DESIGN_NSX, DESIGN_F355, DESIGN_DIABLO, DESIGN_EB110, DESIGN_XJ220, DESIGN_MCLAREN_F1];

describe('the engine library', () => {
  it('saves, lists the last first, duplicates and deletes; a family and a variant come back as the engine they were', () => {
    const s = new MapStore(), a = engineEntry(DESIGN_F355.engine, 'F129B', undefined, 'e1'), b = engineEntry(DESIGN_EB110.engine, 'EB110 쿼드 터보', [3000, 3800], 'e2');
    expect(saveEngine(s, a, 1)).toBe(true); expect(saveEngine(s, b, 2)).toBe(true);
    expect(savedEngines(s).map(e => e.name)).toEqual(['EB110 쿼드 터보', 'F129B']);
    const back = savedEngines(s)[1]!; expect(joinEngine(back.family, back.variant, DESIGN_F355)).toEqual(DESIGN_F355.engine);
    expect(savedEngines(s)[0]!.family.cc).toEqual([3000, 3800]);
    const c = duplicateEngine(s, 'e1', 3)!; expect(c.name).toBe('F129B 사본'); expect(c.id).not.toBe('e1'); expect(savedEngines(s)).toHaveLength(3); expect(savedEngines(s)[0]!.id).toBe(c.id);
    saveEngine(s, { ...a, name: 'F129B 개량' }, 4); expect(savedEngines(s)).toHaveLength(3); expect(savedEngines(s)[0]!.name).toBe('F129B 개량');
    expect(deleteEngine(s, 'e2')).toBe(true); expect(savedEngines(s).map(e => e.id)).not.toContain('e2'); });
  it('a storage that throws keeps nothing and reads empty; rubbish in the storage reads as what can be made of it', () => {
    expect(savedEngines(broken)).toEqual([]); expect(saveEngine(broken, engineEntry(DESIGN_NSX.engine, 'x'))).toBe(false); expect(deleteEngine(broken, 'x')).toBe(false); expect(duplicateEngine(broken, 'x')).toBeNull();
    expect(savedEngines(null)).toEqual([]); expect(saveEngine(null, engineEntry(DESIGN_NSX.engine, 'x'))).toBe(false);
    const s = new MapStore(); s.setItem(ENGINES_KEY, '{not json'); expect(savedEngines(s)).toEqual([]);
    s.setItem(ENGINES_KEY, JSON.stringify([1, null, { name: 'no family' }, { name: '이상한 엔진', family: { layout: 'W16', cc: [9000, 500], bs: 9 }, variant: { grade: 9, cc: 99999, turbo: 7, quality: { head: 12, block: 'x' } } }]));
    const all = savedEngines(s); expect(all).toHaveLength(1); const e = all[0]!;
    expect(LAYOUTS).toContain(e.family.layout); expect(e.family.cc[0]).toBeLessThanOrEqual(e.family.cc[1]); expect(e.family.bs).toBeLessThanOrEqual(1.4);
    expect(e.variant.cc).toBeLessThanOrEqual(e.family.cc[1]); expect(e.variant.quality.head).toBe(3); expect(e.variant.quality.block).toBe(0); expect([0, 1, 2, 3, 4]).toContain(e.variant.turbo);
    expect(asEngine('engine')).toBeNull(); });
  it('a variant stays inside its family\'s displacements; an engine put into a car replaces only the engine', () => {
    const { family, variant } = splitEngine(DESIGN_F355.engine, [3000, 3600]);
    expect(joinEngine(family, { ...variant, cc: 5000 }).cc).toBe(3600); expect(joinEngine(family, { ...variant, cc: 2000 }).cc).toBe(3000);
    const r = familyRange(3500); expect(r[0]).toBeLessThan(3500); expect(r[1]).toBeGreaterThan(3500);
    const d = withEngine(DESIGN_NSX, DESIGN_EB110.engine); expect(d.engine).toEqual(DESIGN_EB110.engine); expect(d.body).toEqual(DESIGN_NSX.body); expect(d.kit).toEqual(DESIGN_NSX.kit); });
  it('the technologies\' years: VTEC from 1989, four turbos from 1991, the F1 gearbox from 1997', () => {
    expect(engineTechs(DESIGN_NSX.engine)).toContain('vvt'); expect(engineYear(DESIGN_NSX.engine)).toBe(1989);
    expect(engineYear(DESIGN_EB110.engine)).toBe(1991); expect(engineYear(DESIGN_F355.engine, 'f1')).toBe(1997); });
});

describe('each part\'s quality', () => {
  it('at 0 changes nothing: the six cars\' engines, costs and reliability are what the old formulas gave', () => {
    for (const d of SIX) { expect(qualityPower(d)).toBe(1);
      const off = tweak(d, e => { for (const k of QUALITY_PARTS) e.engine.quality[k] = 0; }); expect(designSpec(off)).toEqual(designSpec(d)); expect(designCost(off)).toEqual(designCost(d)); }
    // the NSX's and the F355's rated power as race/cars.ts has them (within the calibration's 3 %)
    expect(designSpec(DESIGN_NSX).hp).toBeGreaterThan(270 * 0.97); expect(designSpec(DESIGN_NSX).hp).toBeLessThan(270 * 1.03);
    expect(designSpec(DESIGN_F355).hp).toBeGreaterThan(375 * 0.97); expect(designSpec(DESIGN_F355).hp).toBeLessThan(375 * 1.03); });
  it('raised: a little more power, more reliability, more cost; lowered the other way; the turbo\'s only with turbos', () => {
    const base = DESIGN_F355, c0 = designCost(base), h0 = designSpec(base).hp;
    const up = tweak(base, e => { e.engine.quality.head = 3; e.engine.quality.block = 3; }), dn = tweak(base, e => { e.engine.quality.head = -3; e.engine.quality.block = -3; });
    const hu = designSpec(up).hp, hd = designSpec(dn).hp; expect(hu).toBeGreaterThan(h0); expect(hu / h0).toBeLessThan(1.05); expect(hd).toBeLessThan(h0);
    expect(designCost(up).reliability).toBeGreaterThan(c0.reliability); expect(designCost(up).cost).toBeGreaterThan(c0.cost);
    expect(designCost(dn).reliability).toBeLessThan(c0.reliability); expect(designCost(dn).cost).toBeLessThan(c0.cost);
    expect(designSpec(tweak(base, e => { e.engine.quality.turbo = 3; }))).toEqual(designSpec(base));
    const t = tweak(DESIGN_EB110, e => { e.engine.quality.turbo = 3; }); expect(designSpec(t).hp).toBeGreaterThan(designSpec(DESIGN_EB110).hp);
    expect(normalise({ ...structuredClone(base), engine: { ...base.engine, quality: { ...base.engine.quality, head: 9, intake: -9 } } }).engine.quality).toMatchObject({ head: 3, intake: -3 }); });
});

describe('format 3 brought to format 4', () => {
  /** a design as format 3 wrote it (alpha 0.11: no bore/stroke, no quality) */
  const v3 = (d: Design): DesignV3 => { const { bs: _b, quality: _q, ...engine } = structuredClone(d.engine); void _b; void _q; return { ...structuredClone(d), v: 3, engine: engine as DesignV3['engine'] }; };
  it('a format-3 design, file and link load as format 4 with the old bore/stroke and every quality 0, and drive the same', () => {
    for (const d of SIX) { const old = v3(d), n = normalise(old);
      expect(n.v).toBe(5); expect(n.engine.bs).toBe(BS_DEFAULT); expect(n.engine.quality).toEqual({ block: 0, head: 0, intake: 0, exhaust: 0, turbo: 0 }); expect(n).toEqual(d);
      expect(parseDesign(JSON.stringify(old))).toEqual(d);
      const bytes = new TextEncoder().encode(JSON.stringify(old)); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
      expect(decodeDesign(btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''))).toEqual(d);
      expect(designSpec(n)).toEqual(designSpec(d)); }
    const x = tweak(DESIGN_F355, e => { e.engine.layout = 'F6'; e.engine.bs = 1.3; e.engine.quality.exhaust = 2; }); expect(decodeDesign(encodeDesign(x))).toEqual(x); });
  it('in-line and flat layouts: an in-line six longer and narrower than a V6, a flat six lower and wider; the bore/stroke moves the stroke', () => {
    const at = (l: Design['engine']['layout']) => enginePackage(tweak(DESIGN_F355, e => { e.engine.layout = l; e.engine.cc = 3000; }));
    expect(at('I6').length).toBeGreaterThan(at('V6').length); expect(at('I6').width).toBeLessThan(at('V6').width);
    expect(at('F6').height).toBeLessThan(at('V6').height); expect(at('F6').width).toBeGreaterThan(at('V6').width);
    expect(engineMass(tweak(DESIGN_F355, e => { e.engine.layout = 'I6'; }))).toBeLessThan(engineMass(tweak(DESIGN_F355, e => { e.engine.layout = 'V6'; })));
    const short = tweak(DESIGN_F355, e => { e.engine.bs = 1.4; }), long = tweak(DESIGN_F355, e => { e.engine.bs = 0.85; });
    expect(engineSheet(short).stroke).toBeLessThan(engineSheet(long).stroke); expect(engineFigures(long).torquePeak).toBeGreaterThan(engineFigures(short).torquePeak);
    for (const l of LAYOUTS) { const s = designSpec(tweak(DESIGN_NSX, e => { e.engine.layout = l; })); expect(Number.isFinite(s.hp) && s.hp > 100).toBe(true); expect(s.topKmh).toBeGreaterThan(150); } });
});

describe('the engine\'s voice', () => {
  it('is worked out from the design: the cylinders, the banks, the turbos, the intake', () => {
    expect(designVoice(DESIGN_F355.engine)).toMatchObject({ cylinders: 8, banks: 'V', turbos: 0, itb: false, redline: 8500 });
    expect(designVoice(DESIGN_EB110.engine)).toMatchObject({ cylinders: 12, turbos: 4 }); expect(designVoice(DESIGN_MCLAREN_F1.engine).itb).toBe(true);
    expect(designVoice({ ...DESIGN_NSX.engine, layout: 'F4' })).toMatchObject({ cylinders: 4, banks: 'flat', bankDeg: 180 }); expect(designVoice({ ...DESIGN_NSX.engine, layout: 'I6' }).banks).toBe('I'); });
  it('a V12 smoother than a cross-plane V8, a flat engine rumbling more than an in-line one, turbos whooshing, trumpets roaring; the period cars as before', () => {
    const c = (l: Design['engine']['layout'], more: Partial<Design['engine']> = {}) => voiceCharacter(designVoice({ ...DESIGN_NSX.engine, layout: l, ...more }));
    expect(c('V12').beat).toBeLessThan(c('V8').beat); expect(c('V12').fall).toBeGreaterThan(c('V8').fall); expect(c('F4').beat).toBeGreaterThan(c('I4').beat); expect(c('F6').beat).toBeGreaterThan(c('I6').beat);
    expect(c('V8').whoosh).toBe(0); expect(c('V8', { turbo: 2 }).whoosh).toBeGreaterThan(0); expect(c('V8', { turbo: 2 }).bright).toBeLessThan(c('V8').bright);
    expect(c('V12', { intake: 'itb' }).roar).toBe(1); expect(c('V12').roar).toBe(0);
    expect(voiceCharacter({ cylinders: 4, kind: 'ohv', supercharged: false })).toEqual({ fall: 0.8, even: 0.8, beat: 0.35, sub: 0.3, bright: 1, whoosh: 0, whistle: 0, roar: 0 }); });
});

describe('the dyno', () => {
  it('draws the torque the driving physics uses, its power peak the design\'s rated power', () => {
    for (const d of [...SIX, tweak(DESIGN_F355, e => { e.engine.layout = 'I6'; e.engine.turbo = 2; e.engine.grade = 3; })]) { const s = designSpec(d), C = dynoCurve(d);
      expect(C.rpm[0]).toBeGreaterThanOrEqual(s.idle); expect(C.rpm[C.rpm.length - 1]).toBe(s.redline);
      C.rpm.forEach((r, i) => { expect(C.torque[i]).toBe(torqueAt(s, r)); expect(C.hp[i]).toBeCloseTo(torqueAt(s, r) * r * Math.PI / 30 / 745.7, 6); });
      expect(Math.abs(C.peakHp.hp - s.hp) / s.hp).toBeLessThan(0.02); expect(Math.abs(C.peakTorque.torque - s.torquePeak!) / s.torquePeak!).toBeLessThan(0.03);
      const sh = engineSheet(d, C); expect(sh.fuel90).toBeGreaterThan(3); expect(sh.fuel90).toBeLessThan(sh.fuel120); expect(sh.fuel120).toBeLessThan(30); expect('ABCDE').toContain(sh.emissions); expect(sh.devMonths).toBeGreaterThan(0); }
    expect(engineSheet(DESIGN_NSX).cost).toBe(100); });
});

describe('the stand', () => {
  it('builds every layout on the stand, spreads the parts apart and names the part under the middle of the picture', () => {
    for (const l of LAYOUTS) for (const turbo of [0, 2] as const) { const d = tweak(DESIGN_F355, e => { e.engine.layout = l; e.engine.turbo = turbo; e.engine.grade = 3; }), m = standModel(d, 1);
      expect(m.mesh.n).toBeGreaterThan(300); expect(Array.from(m.mesh.pos).every(Number.isFinite)).toBe(true);
      const N = new Set(m.mesh.names); expect(N.has('engineBlock')).toBe(true); expect(N.has('stand')).toBe(true); if (turbo) expect(N.has('turbo')).toBe(true);
      for (const n of N) if (n) expect(PART_INFO[n], `${n} has a Korean name`).toBeTruthy();
      const X = exploded(m.mesh, 1), zOf = (M: typeof X, name: string) => { const k = M.names!.indexOf(name); let z = -Infinity; for (let t = 0; t < M.n; t++) if (M.part[t] === k) z = Math.max(z, M.pos[t * 9 + 2]!); return z; };
      expect(X.n).toBe(m.mesh.n); expect(zOf(X, 'camCover')).toBeGreaterThan(zOf(m.mesh, 'camCover'));
      const v = { x: 0, y: 0, z: (m.min[2] + m.max[2]) / 2000, ang: Math.PI - 0.75, pitch: 22, mm: 3, W: 800, H: 600, cy: 0.5 };
      expect(pickPart(m.mesh, v, 400, 300)).toBeTruthy(); expect(pickPart(m.mesh, v, 2, 2)).toBeNull(); } });
});
