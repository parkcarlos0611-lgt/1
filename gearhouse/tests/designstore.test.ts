// The builder's designs kept and carried (core/designstore.ts, docs/systems/98 B3-B4): a design through a link and
// back, anything else turned away or mended, the saved list and the measurements in a fake storage; format 1's designs
// (before review 177) brought to format 2 (core/design.ts), and the engine's grade keeping its details in bounds.
import { describe, it, expect } from 'vitest';
import { DESIGN_NSX, DESIGN_F355, LIMITS, normalise, migrate, gradeFor, gradeLock, GRADE_RULES, type Design, type DesignV1 } from '../core/design';
import { encodeDesign, decodeDesign, parseDesign, designJson, asDesign, savedDesigns, saveDesign, deleteDesign, currentDesign, keepCurrent,
  measured, recordRun, fromPreset, designSig, KEYS, type KeyStore } from '../core/designstore';

/** a storage in a map; `broken` throws on every call (a private window) */
const fake = (broken = false): KeyStore & { m: Map<string, string> } => { const m = new Map<string, string>(), no = () => { throw new Error('refused'); };
  return { m, getItem: k => broken ? no() : m.get(k) ?? null, setItem: (k, v) => { if (broken) no(); m.set(k, v); }, removeItem: k => { if (broken) no(); m.delete(k); } }; };
const tweak = (d: Design, f: (d: Design) => void): Design => { const e = structuredClone(d); f(e); return e; };

describe('a design in a link', () => {
  it('comes back as it went, Korean name and all, in link-safe characters', () => {
    for (const d of [DESIGN_NSX, DESIGN_F355, tweak(DESIGN_F355, e => { e.name = '노란 오리꼬리 V12'; e.engine.layout = 'V12'; e.engine.turbo = 2; e.body.wheelbase = 120; e.kit.tyres = [245, 305]; })]) {
      const s = encodeDesign(d); expect(s).toMatch(/^[A-Za-z0-9_-]+$/); expect(decodeDesign(s)).toEqual(d); } });
  it('turns away what is not a design', () => {
    expect(decodeDesign('not base64 at all!')).toBeNull(); expect(decodeDesign(encodeDesign({ ...DESIGN_NSX, body: { ...DESIGN_NSX.body, base: 'mini' as 'nsx' } }))).toBeNull();
    expect(parseDesign('{"hello": 1}')).toBeNull(); expect(parseDesign('{')).toBeNull(); expect(parseDesign('null')).toBeNull(); });
  it('mends a partial or out-of-range design from its base and the limits', () => {
    const d = asDesign({ name: '  반쪽  ', body: { base: 'f355', tail: 'frame', wheelbase: 9999, paint: 'red' }, engine: { cc: 100, valves: 7 }, kit: { tyres: [500] } })!;
    expect(d.name).toBe('반쪽'); expect(d.body.tail).toBe('frame'); expect(d.body.nose).toBe(DESIGN_F355.body.nose); expect(d.body.paint).toBe(DESIGN_F355.body.paint);
    expect(d.body.wheelbase).toBe(LIMITS.wheelbase[1]); expect(d.engine.cc).toBe(LIMITS.cc[0]); expect(d.engine.valves).toBe(DESIGN_F355.engine.valves);
    expect(d.kit.tyres).toEqual([LIMITS.tyre[1], DESIGN_F355.kit.tyres[1]]); expect(d.id).toMatch(/^[\w-]+$/); });
  it('a file round trip; a preset copy is its own design that drives the same', () => {
    expect(parseDesign(designJson(DESIGN_NSX))).toEqual(DESIGN_NSX);
    const p = fromPreset('nsx'); expect(p.id).not.toBe('nsx'); expect(p.name).toContain('NSX'); expect(designSig(p)).toBe(designSig(DESIGN_NSX)); expect(fromPreset('nsx').id).not.toBe(p.id); });
});

describe('the saved designs', () => {
  it('saves, replaces by id (the last saved first), deletes, keeps the bench', () => {
    const s = fake(), a = { ...DESIGN_NSX, id: 'a', name: 'A' }, b = { ...DESIGN_F355, id: 'b', name: 'B' };
    expect(savedDesigns(s)).toEqual([]); expect(saveDesign(s, a)).toBe(true); saveDesign(s, b); saveDesign(s, { ...a, name: 'A2' });
    expect(savedDesigns(s).map(d => d.name)).toEqual(['A2', 'B']); deleteDesign(s, 'b'); expect(savedDesigns(s).map(d => d.id)).toEqual(['a']);
    expect(currentDesign(s)).toBeNull(); keepCurrent(s, b); expect(currentDesign(s)).toEqual(b); });
  it('reads empty and keeps nothing when the storage refuses or holds rubbish', () => {
    const s = fake(true); expect(saveDesign(s, DESIGN_NSX)).toBe(false); expect(savedDesigns(s)).toEqual([]); expect(currentDesign(s)).toBeNull(); expect(measured(s, 'x')).toBeNull();
    expect(recordRun(s, DESIGN_NSX, { topKmh: 200 }).topKmh).toBe(200); expect(savedDesigns(null)).toEqual([]);
    const r = fake(); r.m.set(KEYS.designs, '{oops'); expect(savedDesigns(r)).toEqual([]); r.m.set(KEYS.designs, JSON.stringify([{ junk: 1 }, DESIGN_F355])); expect(savedDesigns(r)).toEqual([DESIGN_F355]); });
});

describe('the measurements', () => {
  it('keeps the best of each, per track; a changed design starts afresh', () => {
    const s = fake(), d = DESIGN_NSX;
    recordRun(s, d, { topKmh: 250.4 }); recordRun(s, d, { topKmh: 240 }); recordRun(s, d, { lap: { trackId: 'road', track: 'Ashcombe', t: 101.23456 } }); recordRun(s, d, { lap: { trackId: 'road', track: 'Ashcombe', t: 105 } });
    recordRun(s, d, { lap: { trackId: 'millbrook', track: 'Millbrook', t: 70 } });
    const m = measured(s, d.id)!; expect(m.topKmh).toBe(250); expect(m.laps.road).toEqual({ t: 101.235, track: 'Ashcombe' }); expect(m.laps.millbrook!.t).toBe(70); expect(m.sig).toBe(designSig(d));
    const e = tweak(d, x => { x.engine.turbo = 1; }); recordRun(s, e, { topKmh: 270 }); const n = measured(s, d.id)!; expect(n.topKmh).toBe(270); expect(n.laps).toEqual({}); expect(n.sig).toBe(designSig(e)); });
});

/** the two cars as format 1 wrote them (saved designs and links from before review 177) */
const V1_NSX: DesignV1 = { v: 1, id: 'nsx', name: 'NSX', body: { base: 'nsx', nose: 'round', front: 'plain', tail: 'frame', wheel: 'fiveSpoke', wheelbase: 0, width: 0, paint: '#b0121b', gloss: 0.6, material: 'aluminium' },
  engine: { layout: 'V6', cc: 2977, valves: 4, redline: 8000, turbo: 0, vtec: true }, drive: { gears: 5, gearbox: 'manual', final: 4.062, lsd: true, awd: false },
  kit: { abs: true, tcs: true, steering: 'manual', dampers: 'fixed', wing: false, diffuser: false, tyres: [205, 225], rim: 16 } };
const V1_F355: DesignV1 = { v: 1, id: 'f355', name: 'F355', body: { base: 'f355', nose: 'pointed', front: 'sunk', tail: 'ducktail', wheel: 'star', wheelbase: 0, width: 0, paint: '#f5c300', gloss: 0.6, material: 'steel' },
  engine: { layout: 'V8', cc: 3496, valves: 5, redline: 8500, turbo: 0, vtec: false }, drive: { gears: 6, gearbox: 'manual', final: 4.1, lsd: true, awd: false },
  kit: { abs: true, tcs: false, steering: 'hydraulic', dampers: 'adaptive', wing: false, diffuser: true, tyres: [225, 265], rim: 18 } };
const v1Link = (d: unknown) => { const bytes = new TextEncoder().encode(JSON.stringify(d)); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

describe('format 1 brought to format 2', () => {
  it('the two cars as format 1 wrote them come back as format 2\'s own, through normalise, a file, a link and the saved list', () => {
    expect(normalise(V1_NSX)).toEqual(DESIGN_NSX); expect(normalise(V1_F355)).toEqual(DESIGN_F355); expect(migrate(V1_F355)).toEqual(DESIGN_F355);
    expect(parseDesign(JSON.stringify(V1_NSX))).toEqual(DESIGN_NSX); expect(decodeDesign(v1Link(V1_F355))).toEqual(DESIGN_F355);
    const s = fake(); s.m.set(KEYS.designs, JSON.stringify([{ ...V1_NSX, id: 'old', name: '예전 설계' }, DESIGN_F355])); s.m.set(KEYS.current, JSON.stringify(V1_F355));
    expect(savedDesigns(s)).toEqual([{ ...DESIGN_NSX, id: 'old', name: '예전 설계' }, DESIGN_F355]); expect(currentDesign(s)).toEqual(DESIGN_F355); });
  it('a format-1 turbo engine: its boost as format 1 fixed it, a middle compression; a design without a version but a material is format 1', () => {
    const one = normalise({ ...V1_NSX, engine: { ...V1_NSX.engine, turbo: 1 } }), two = normalise({ ...V1_F355, engine: { ...V1_F355.engine, turbo: 2 } });
    expect(one.engine.boost).toBe(0.8); expect(two.engine.boost).toBe(1.0); expect(two.engine.turbo).toBe(2); expect(two.engine.compression).toBe('mid'); expect(one.engine.grade).toBe(2);
    const { v: _, ...bare } = V1_NSX; expect(asDesign({ ...bare, body: { ...bare.body, material: 'steel' } })!.body).toMatchObject({ structure: 'steel', panels: 'steel' }); });
});

describe('the engine\'s grade', () => {
  it('keeps the details it does not allow out: each falls back to the best one allowed', () => {
    const g = (grade: 1 | 2 | 3 | 4 | 5, e: Partial<Design['engine']>) => normalise(tweak(DESIGN_NSX, d => { Object.assign(d.engine, { grade }, e); })).engine;
    expect(g(2, { intake: 'itb' }).intake).toBe('variable'); expect(g(3, { intake: 'itb' }).intake).toBe('itb'); expect(g(3, { block: 'magnesium' }).block).toBe('aluminium'); expect(g(4, { block: 'magnesium' }).block).toBe('magnesium');
    expect(g(2, { turbo: 4 }).turbo).toBe(2); expect(g(3, { turbo: 4 }).turbo).toBe(4); expect(g(1, { turbo: 2 }).turbo).toBe(1); expect(g(2, { turbo: 2, boost: 1.4 }).boost).toBe(1.0); expect(g(4, { turbo: 2, boost: 1.4 }).boost).toBe(1.4);
    expect(g(2, { redline: 9800 }).redline).toBe(9000); expect(g(1, { valves: 5 }).valves).toBe(4); expect(g(1, { vtec: true }).vtec).toBe(false); expect(g(1, { sump: 'dry' }).sump).toBe('wet'); expect(g(1, { compression: 'high' }).compression).toBe('mid');
    expect(g(2, { boost: 0.1 }).boost).toBe(LIMITS.boost[0]); });
  it('says from which grade a detail can be chosen', () => {
    expect(gradeFor('intake', 'itb')).toBe(3); expect(gradeFor('block', 'magnesium')).toBe(4); expect(gradeFor('turbo', 4)).toBe(3); expect(gradeFor('valves', 5)).toBe(2); expect(gradeFor('intake', 'single')).toBe(1);
    expect(gradeLock(2, 'intake', 'itb')).toBe('3등급(스포츠)부터 고를 수 있습니다'); expect(gradeLock(3, 'intake', 'itb')).toBeNull(); expect(gradeLock(3, 'block', 'magnesium')).toContain('4등급(경주 파생)');
    for (const g of [1, 2, 3, 4] as const) { const a = GRADE_RULES[g], b = GRADE_RULES[(g + 1) as 2 | 3 | 4 | 5];   // a grade allows all a lower one does
      for (const k of ['intake', 'compression', 'sump', 'block', 'valves'] as const) for (const v of a[k]) expect((b[k] as unknown[]).includes(v)).toBe(true);
      expect(b.turbo).toBeGreaterThanOrEqual(a.turbo); expect(b.boost).toBeGreaterThanOrEqual(a.boost); expect(b.redline).toBeGreaterThanOrEqual(a.redline); } });
});

describe('the engine view', () => {
  it('lifts off the named parts and keeps every other triangle as it was', async () => {
    const { designMesh, withoutParts } = await import('../render/car/design');
    const M = designMesh(DESIGN_F355), O = withoutParts(M, ['bootLid', 'engineCover', 'rearPane']), N = M.names!;
    const count = (m: typeof M, n: string) => { let k = 0; for (let t = 0; t < m.n; t++) if (N[m.part[t]!] === n) k++; return k; };
    expect(count(M, 'engineCover')).toBeGreaterThan(0); expect(count(O, 'engineCover')).toBe(0); expect(count(O, 'engineBlock')).toBe(count(M, 'engineBlock'));
    expect(O.n).toBe(M.n - count(M, 'bootLid') - count(M, 'engineCover') - count(M, 'rearPane')); expect(O.pos.length).toBe(O.n * 9); expect(O.col.length).toBe(O.n * 3);
    expect(withoutParts(M, []).pos).toEqual(M.pos); });
});
