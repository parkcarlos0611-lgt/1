// docs/systems/115 P1a: the surface adapter (render/car/skin.ts) on the 959's shell, the plates placed freely on it
// (render/car/p959/plates.ts), and format 6's placed parts (core/placed.ts)
import { describe, it, expect } from 'vitest';
import { buildShell, shellSkin, sockets, frameOf, fitPlate, stockPlace, snapCentre, p959Mesh, PLATE_RULES } from '../render/car/p959';
import { viewRay, partFrame, type Skin } from '../render/car/skin';
import { fitPlaced, withPlaced, type Placed } from '../core/placed';
import { fromPreset, parseDesign, designJson } from '../core/designstore';
import { normalise } from '../core/design';
import type { V } from '../render/car/mesh';

const LUMP = { lamps: false, details: false, bumperF: 'blank', bumperR: 'blank', glass: null } as const;
const stockSkin = shellSkin(buildShell(LUMP)), marks = sockets().marks, mark = (n: string) => marks.find(m => m.name === n)!;
/** the skin's distance from a point: a ray along the skin's normal both ways */
const off = (skin: Skin, p: V, n: V) => { const a = skin.hit([p[0] + n[0] * 50, p[1] + n[1] * 50, p[2] + n[2] * 50], [-n[0], -n[1], -n[2]], 100); return a ? Math.abs(50 - a.t) : Infinity; };
/** the place under a point of the skin (a ray along -x or +x through it) */
const placeAt = (skin: Skin, x: number, y: number, z: number, back = false) => skin.hit([back ? x + 600 : x - 600, y, z], [back ? -1 : 1, 0, 0], 2000)!;

describe('the skin', () => {
  it('a ray finds the point, its normal and its surface place, and the place gives the point back', () => {
    const h = placeAt(stockSkin, 0, 120, 300); expect(h.at).not.toBeNull(); expect(h.n[0]).toBeLessThan(-0.6);
    const back = stockSkin.at(h.at!)!; for (let k = 0; k < 3; k++) expect(back.p[k]).toBeCloseTo(h.p[k]!, 0); expect(back.face).toBe(h.face);
    expect(off(stockSkin, back.p, back.n)).toBeLessThan(0.6); });
  it('a place stays on the surface when the lump is stretched, and moves with it', () => {
    const picks = [placeAt(stockSkin, 0, 0, 280), placeAt(stockSkin, 0, 300, 420), placeAt(stockSkin, 4300, 0, 420, true), placeAt(stockSkin, 4300, -380, 640, true), stockSkin.hit([2400, 1500, 600], [0, -1, 0])!];
    const dims = { overhangF: 80, wheelbase: 150, overhangR: -60, width: 60, roof: 40, ride: 40 }, fr = frameOf(dims), big = shellSkin(buildShell({ ...LUMP, dims }));
    for (const h of picks) { const q = big.at(h.at!)!, want = fr.at(h.p); expect(off(big, q.p, q.n)).toBeLessThan(1);
      // where the cage's own map carries the point (within a few mm: the subdivision's smoothing moves it a little)
      expect(Math.hypot(q.p[0] - want[0], q.p[1] - want[1], q.p[2] - want[2])).toBeLessThan(8); } });
  it('the ray under a pixel of the builder\'s picture: the car\'s middle under the picture\'s target', () => {
    const v = { x: 0, y: 0, z: 0.55, ang: Math.PI - 0.7, pitch: 17, mm: 5, W: 1000, H: 800, cy: 0.55 }, car = { x: 0, y: 0, z: 0, yaw: 0, len: 4260 };
    const r = viewRay(v, car, 500, 440); // the target: the car's middle 0.55 m up; the ray passes it
    const c: V = [2130, 0, 550], d = [c[0] - r.o[0], c[1] - r.o[1], c[2] - r.o[2]], along = d[0]! * r.d[0] + d[1]! * r.d[1] + d[2]! * r.d[2];
    expect(Math.hypot(d[0]! - r.d[0] * along, d[1]! - r.d[1] * along, d[2]! - r.d[2] * along)).toBeLessThan(10); });
});

describe('the plates placed freely', () => {
  const at = (id: 'plateF' | 'plateR', h: { at: Placed['at'] | null }, o: Partial<Placed> = {}): Placed => ({ id, at: h.at!, rot: 0, tilt: 0, scale: 1, ...o });
  it('the stock places keep the rules; their brackets are shallow', () => {
    for (const id of ['plateF', 'plateR'] as const) { const a = stockPlace(stockSkin, mark(id))!, f = fitPlate(stockSkin, { id, at: a, rot: 0, tilt: 0, scale: 1 })!;
      console.log(`${id} at the stock place: bracket ${f.gap.toFixed(1)} mm, face ${f.lift.toFixed(1)} mm out`); expect(f.ok, f.why ?? '').toBe(true); expect(f.gap).toBeLessThan(40); } });
  it('only on faces looking forward (front) or back (rear) within 35 degrees', () => {
    const side = stockSkin.hit([2400, 1500, 600], [0, -1, 0])!, lid = stockSkin.hit([500, 0, 2000], [0, 0, -1])!;
    expect(fitPlate(stockSkin, at('plateF', side))!.why).toMatch(/35°/); expect(fitPlate(stockSkin, at('plateF', lid))!.why).toMatch(/35°/);
    expect(fitPlate(stockSkin, at('plateR', placeAt(stockSkin, 0, 0, 280)))!.why).toMatch(/35°/);   // the rear plate on the nose: it looks forward
    expect(Math.acos(Math.min(1, -fitPlate(stockSkin, at('plateF', placeAt(stockSkin, 0, 0, 280)))!.F.n[0])) * 180 / Math.PI).toBeLessThan(PLATE_RULES.angle); });
  it('off the centre line on the curved nose: flat, the bracket grows to the skin; too far round, refused', () => {
    const f = fitPlate(stockSkin, at('plateF', placeAt(stockSkin, 0, 330, 300)))!; console.log(`front plate 330 mm off the line: ${f.ok ? 'ok' : f.why}, bracket ${f.gap.toFixed(0)} mm`);
    expect(f.gap).toBeGreaterThan(fitPlate(stockSkin, at('plateF', placeAt(stockSkin, 0, 0, 300)))!.gap);
    const far = fitPlate(stockSkin, at('plateF', placeAt(stockSkin, 0, 750, 300)))!; expect(far.why).toMatch(/35°/);
    const deep = fitPlate(stockSkin, at('plateF', placeAt(stockSkin, 0, 650, 380)))!; expect(deep.why).toMatch(/받침/); });
  it('not on a lamp: the stock car\'s tail lamp band and front indicators refuse a plate the lump takes', () => {
    const lamps = shellSkin(buildShell({})), r = (s: Skin) => fitPlate(s, at('plateR', placeAt(s, 4300, 0, 620, true)))!, f = (s: Skin) => fitPlate(s, at('plateF', placeAt(s, 0, 330, 380)))!;
    for (const p of [r, f]) { expect(p(lamps).why).toMatch(/램프/); expect(p(stockSkin).ok).toBe(true); } });
  it('the centre line pulls a plate near it onto it', () => {
    const h = placeAt(stockSkin, 0, 22, 300), s = snapCentre(stockSkin, h.at!)!; expect(Math.abs(stockSkin.at(s)!.p[1])).toBeLessThan(0.5);
    expect(snapCentre(stockSkin, placeAt(stockSkin, 0, 120, 300).at!)).toBeNull(); });
  it('the two plates may not meet', () => {
    const a = placeAt(stockSkin, 4300, 0, 420, true), f = fitPlate(stockSkin, at('plateR', a))!;
    expect(fitPlate(stockSkin, at('plateR', a), [{ ...f, id: 'plateF' }])!.why).toMatch(/다른 번호판/); });
  it('drawn on the car: a placed plate moves, the other stays; a turn and a size', () => {
    const plates = (M: ReturnType<typeof p959Mesh>) => { const out: V[] = []; for (let t = 0; t < M.n; t++) if (/^plate/.test(M.names![M.part[t]!] ?? '')) out.push([M.pos[t * 9]!, M.pos[t * 9 + 1]!, M.pos[t * 9 + 2]!]); return out; };
    const S = buildShell(), skin = shellSkin(S), a = placeAt(skin, 4300, 300, 420, true).at!;
    const stock = plates(p959Mesh()), moved = plates(p959Mesh({ placed: [{ id: 'plateR', at: a, rot: 10, tilt: 0, scale: 1.1 }] }));
    const front = (P: V[]) => P.filter(p => p[0] < 1000), rear = (P: V[]) => P.filter(p => p[0] > 3000), my = (P: V[]) => P.reduce((s, p) => s + p[1], 0) / P.length;
    expect(front(moved)).toEqual(front(stock)); expect(Math.abs(my(rear(moved)) - 300)).toBeLessThan(40); expect(Math.abs(my(rear(stock)))).toBeLessThan(5);
    expect(rear(moved).length).toBeGreaterThan(rear(stock).length);   // the bracket's sides
    void partFrame; });
});

describe('format 6: the placed parts', () => {
  it('kept in a file and a link, read back within the limits; an older design has none and keeps its signature', () => {
    const d = fromPreset('p959'); expect(d.body.parts).toBeUndefined(); expect(designJson(normalise(d))).not.toMatch(/"parts"/);
    d.body.parts = [{ id: 'plateR', at: { f: 12, u: 0.25, v: 0.75 }, rot: 5, tilt: -3, scale: 1.1 }]; const back = parseDesign(designJson(normalise(d)))!;
    expect(back.body.parts).toEqual(d.body.parts);
    expect(fitPlaced([{ id: 'plateR', at: { f: 3, u: 2, v: 0.12345 }, rot: 90, tilt: 0, scale: 3 }, { id: 'wing', at: { f: 1, u: 0, v: 0 } }, { id: 'plateF', at: { f: -1 } }]))
      .toEqual([{ id: 'plateR', at: { f: 3, u: 1, v: 0.123 }, rot: 20, tilt: 0, scale: 1.15 }]);
    expect(withPlaced(back.body.parts, 'plateR', null)).toBeUndefined(); });
});
