// The builder's designs kept and carried (core/designstore.ts, docs/systems/98 B3-B4): a design through a link and
// back, anything else turned away or mended, the saved list and the measurements in a fake storage, and the tyres'
// warning against the arches.
import { describe, it, expect } from 'vitest';
import { DESIGN_NSX, DESIGN_F355, LIMITS, type Design } from '../core/design';
import { encodeDesign, decodeDesign, parseDesign, designJson, asDesign, savedDesigns, saveDesign, deleteDesign, currentDesign, keepCurrent,
  measured, recordRun, tyreWarning, fromPreset, designSig, KEYS, type KeyStore } from '../core/designstore';

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

describe('the tyres against the arches', () => {
  it('fits the base cars and anything up to 40 mm wider; warns past it, the body widened making room', () => {
    expect(tyreWarning(DESIGN_NSX)).toBeNull(); expect(tyreWarning(DESIGN_F355)).toBeNull();
    expect(tyreWarning(tweak(DESIGN_NSX, d => { d.kit.tyres = [245, 265]; }))).toBeNull();
    const w = tyreWarning(tweak(DESIGN_NSX, d => { d.kit.tyres = [205, 295]; }))!; expect(w).toContain('뒤 295'); expect(w).not.toContain('앞');
    expect(tyreWarning(tweak(DESIGN_NSX, d => { d.kit.tyres = [205, 295]; d.body.width = 40; }))).toBeNull();
    expect(tyreWarning(tweak(DESIGN_F355, d => { d.body.width = -40; }))).toBeNull(); expect(tyreWarning(tweak(DESIGN_F355, d => { d.body.width = -40; d.kit.tyres = [230, 265]; }))).toContain('앞 230'); });
});
