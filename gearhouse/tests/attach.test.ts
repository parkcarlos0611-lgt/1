// docs/systems/115 P1: the free surface parts (render/car/attach) on both lumps' skins, their mirror twins, their kinds'
// limits, the stock sets, the ray picking's hierarchy against brute force, and format 6's entries for them
import { describe, it, expect } from 'vitest';
import { buildShell, shellSkin, p959Mesh } from '../render/car/p959';
import { buildN33Shell, n33Skin, n33Mesh } from '../render/car/n33';
import { subdivSkin, type Skin } from '../render/car/skin';
import { fitPart, fitAll } from '../render/car/attach';
import { stockParts, aimPart, newPart } from '../render/car/attach/stock';
import { fitPlaced, fitPlacedOne, withPlaced, nextN, PART_KINDS, FREE_IDS, type Placed, type FreeId } from '../core/placed';
import { fromPreset, parseDesign, designJson } from '../core/designstore';
import { normalise } from '../core/design';
import type { V } from '../render/car/mesh';
import { makeAtlas, ATLAS_CELLS } from '../render/live/style';
import { lampSheet, lampUV, lampPaint, LAMP_ART, type LampArt } from '../render/car/lampart';

const SA = buildShell({ lamps: false, details: false, bumperF: 'blank', bumperR: 'blank', glass: null }), SB = buildN33Shell({ glass: null });
const A = shellSkin(SA), B = n33Skin(SB);
const at = (skin: Skin, id: FreeId, o: V, d: V, x: Partial<Placed> = {}): Placed => ({ ...aimPart(skin, { id, o, d })!, ...x });

describe('the ray picking', () => {
  it('the hierarchy finds what brute force finds, on both lumps, for rays from every side', () => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const S of [SA, SB]) { const fast = subdivSkin({ P: S.P, F: S.F, N: S.N, tag: S.tag, nSub: S.nSub, parent: S.fine.parent }), slow = subdivSkin({ P: S.P, F: S.F, N: S.N, tag: S.tag, nSub: S.nSub, parent: S.fine.parent }, false);
      let hits = 0;
      for (let i = 0; i < 400; i++) { const o: V = [rnd() * 7000 - 1200, rnd() * 4000 - 2000, rnd() * 3000 - 500], q: V = [rnd() * 4600, rnd() * 1800 - 900, rnd() * 1400], d0: V = [q[0] - o[0], q[1] - o[1], q[2] - o[2]], l = Math.hypot(...d0), d: V = [d0[0] / l, d0[1] / l, d0[2] / l];
        const a = fast.hit(o, d), b = slow.hit(o, d); expect(!!a).toBe(!!b); if (a && b) { hits++; expect(a.t).toBeCloseTo(b.t, 6); for (let k = 0; k < 3; k++) expect(a.p[k]).toBeCloseTo(b.p[k]!, 4); } }
      // axis rays along the centre line (the seam between the halves) and with signed zeros
      for (const d of [[-1, 0, 0], [-1, -0, -0], [0, 0, -1]] as V[]) { const o: V = d[2] ? [700, 0, 3000] : [5200, 0, 560]; expect(fast.hit(o, d)?.t).toBeCloseTo(slow.hit(o, d)!.t, 6); }
      expect(hits).toBeGreaterThan(100); } });
});

describe('the parts on the skin', () => {
  it('every kind fits at its default place on both lumps (the N33\'s ring wing a little narrower), each a few hundred triangles', () => {
    for (const [skin, base] of [[A, 'p959'], [B, 'bnr33']] as const) for (const id of FREE_IDS) { const p = newPart(base, skin, id, 1, undefined)!, f = fitPart(skin, base === 'bnr33' && id === 'wingRing' ? { ...p, scale: 0.85 } : p)!;
      // the 599's lump carries its own hoop: the ring wing as a part is refused there (no double wing; docs/systems/117 R3)
      if (base === 'p959' && id === 'wingRing') { expect(f.why).toMatch(/차체의 일부/); continue; }
      // a hole part (P2): its drag preview (its insides lifted onto its footprint) stands for it
      const n = f.hole ? f.hole.preview().n : f.mesh.n; expect(f.ok, `${base} ${id}: ${f.why}`).toBe(true); expect(n).toBeGreaterThan(40); expect(n).toBeLessThan(500); } });
  it('a pair is mirrored across the centre line; one side only has no twin; near the line a centre kind is single', () => {
    const v = at(A, 'vent', [800, 300, 3000], [0, 0, -1]), f = fitPart(A, v)!; expect(f.twin).toBe(true);
    const draw = (p: Placed) => { const M = p959Mesh({ lamp: 'none', details: false, bumperF: 'blank', bumperR: 'blank', glass: null, plateF: false, plateR: false, placed: [p] }), ys: number[] = [];
      for (let t = 0; t < M.n; t++) if (/^vent/.test(M.names![M.part[t]!] ?? '')) ys.push((M.pos[t * 9 + 1]! + M.pos[t * 9 + 4]! + M.pos[t * 9 + 7]!) / 3); return ys; };
    const two = draw(v), one = draw({ ...v, one: true }); expect(two.length).toBe(2 * one.length); expect(two.filter(y => y < 0).length).toBe(one.length); expect(one.every(y => y > 0)).toBe(true);
    const c = fitPart(A, at(A, 'vent', [800, 0, 3000], [0, 0, -1]))!; expect(c.twin).toBe(false); expect(c.ok).toBe(true);
    // a pair across the line: refused (its footprint and its twin's would meet)
    expect(fitPart(A, at(A, 'vent', [800, 60, 3000], [0, 0, -1]))!.why).toMatch(/가운데 선/); });
  it('each kind on its own faces: a mirror on a side, a wing on top and on the line, tips on a rear face; not on glass, lamps or arches', () => {
    expect(fitPart(A, at(A, 'mirror', [800, 0, 3000], [0, 0, -1]))!.why).toMatch(/옆을/);
    expect(fitPart(B, at(B, 'wingGT', [4380, 300, 3000], [0, 0, -1]))!.why).toMatch(/가운데 선 위/);
    expect(fitPart(A, at(A, 'exhaust1', [2400, 1500, 500], [0, -1, 0]))!.why).toMatch(/뒤를/);
    const glass = shellSkin(buildShell({})); expect(fitPart(glass, at(glass, 'badge', [1500, 0, 3000], [0, 0, -1]))!.why).toMatch(/유리|창문/);
    expect(fitPart(A, at(A, 'badge', [1500, 0, 3000], [0, 0, -1]))!.why).toMatch(/창문/);   // the lump's glass places, painted: refused too
    expect(fitPart(glass, at(glass, 'marker', [4400, 560, 623], [-1, 0, 0]))!.why).toMatch(/램프/);
    const low = fitPart(B, at(B, 'wingGT', [4380, 0, 3000], [0, 0, -1], { depth: 60 }))!; expect(low.ok).toBe(true);
    const sunk = fitPart(A, at(A, 'wingGT', [3700, 0, 3000], [0, 0, -1], { depth: 80, scale: 1.25 }))!; expect(sunk.why ?? '').toMatch(/닿습니다/); });
  it('overlapping surface parts are shown, not refused', () => {
    const v = at(A, 'louvre', [800, 0, 3000], [0, 0, -1]), w = at(A, 'badge', [800, 0, 3000], [0, 0, -1]), [f, g] = fitAll(A, [v, w]);
    expect(f!.ok && g!.ok).toBe(true); expect(g!.warn).toMatch(/겹칩니다/); });
  it('the figures P3 will read: a wing\'s blade and plan area, a mirror pair\'s frontal area, the twins counted', () => {
    const [w] = fitAll(B, [at(B, 'wingGT', [4380, 0, 3000], [0, 0, -1])]), [m] = fitAll(A, stockParts('p959', A).filter(p => p.id === 'mirror'));
    expect(w!.fig.wing!.span).toBe(1500); expect(w!.fig.plan).toBeGreaterThan(0.2); expect(w!.fig.at[1]).toBeCloseTo(0, 3);
    expect(m!.fig.count).toBe(2); expect(m!.fig.frontal).toBeGreaterThan(0.01); expect(m!.fig.frontal).toBeLessThan(0.06); expect(m!.fig.at[1]).toBe(0); });
});

describe('the stock sets', () => {
  it('each lump\'s stock parts keep the rules; the 599\'s stand where its own mirrors, tips and crest stand', () => {
    for (const [skin, base] of [[A, 'p959'], [B, 'bnr33']] as const) { const fs = fitAll(skin, stockParts(base, skin)); expect(fs.length).toBeGreaterThanOrEqual(3); for (const f of fs) expect(f.ok, `${base} ${f.key}: ${f.why}`).toBe(true); }
    const box = (M: ReturnType<typeof p959Mesh>, re: RegExp) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let t = 0; t < M.n; t++) if (re.test(M.names![M.part[t]!] ?? '')) for (let i = 0; i < 9; i++) { lo[i % 3] = Math.min(lo[i % 3]!, M.pos[t * 9 + i]!); hi[i % 3] = Math.max(hi[i % 3]!, M.pos[t * 9 + i]!); } return [lo, hi]; };
    const own = p959Mesh(), S = shellSkin(buildShell({})), free = p959Mesh({ smalls: false, placed: stockParts('p959', S) });
    for (const re of [/^mirror$/, /^exhaust/, /^badge$/]) { const [a, b] = [box(own, re), box(free, re)]; for (let k = 0; k < 3; k++) expect(Math.abs((a![0]![k]! + a![1]![k]!) / 2 - (b![0]![k]! + b![1]![k]!) / 2), `${re} axis ${k}`).toBeLessThan(45); }
    expect(free.uv).toBeDefined();
    const nm = n33Mesh({ glass: 'stock', plateF: true, plateR: true, placed: stockParts('bnr33', n33Skin(buildN33Shell({ glass: 'stock' }))) }), names = new Set(Array.from(nm.part, p => nm.names![p]!));
    for (const n of ['wing', 'wingBolt', 'mirror', 'exhaustTip', 'markerLamp', 'plate', 'lip', 'garnish', 'garnishLamp', 'emblemPlace', 'handle', 'fuelLidLine', 'headLamp', 'tailLamp', 'fogLamp', 'grilleMesh', 'intakeCore']) expect(names.has(n), n).toBe(true);
    // the lamps' lenses carry their pictures' atlas coordinates (render/car/lampart.ts): every head, tail and fog lens triangle, both sides
    const cell = ATLAS_CELLS.indexOf('lamps') + 1; let lens = 0; for (let t = 0; t < nm.n; t++) if (/^(headLamp|tailLamp|fogLamp)$/.test(nm.names![nm.part[t]!]!)) { lens++; expect(nm.uv![t * 9 + 2]).toBe(cell); expect(nm.uv![t * 9]).toBeGreaterThan(-0.01); expect(nm.uv![t * 9]).toBeLessThanOrEqual(1); }
    expect(lens).toBeGreaterThan(300); });
  it('the lamps\' pictures: each in its region of the lamps cell, the far levels in a few flat colours', () => {
    const A = makeAtlas(1024), i = ATLAS_CELLS.indexOf('lamps'); expect(Array.from(A.rects.subarray(i * 4, i * 4 + 4))).toEqual([0, 0.25, 0.5, 0.25]);
    const colours = (l: Uint8Array) => new Set(Array.from({ length: l.length / 4 }, (_, q) => `${l[q * 4]},${l[q * 4 + 1]},${l[q * 4 + 2]},${l[q * 4 + 3]}`)).size;
    expect(colours(lampSheet(512))).toBeGreaterThan(400); expect(colours(lampSheet(64, true, 1))).toBeLessThanOrEqual(12);
    const lm = A.mips!.filter(m => m.w === 2 * m.h); expect(lm.map(m => m.level)).toEqual([2, 3, 4, 5, 6, 7, 8]); expect(lm[0]).toMatchObject({ x: 0, y: 64, w: 128, h: 64 });
    for (const [k, [x, y, w, h]] of Object.entries(LAMP_ART)) { const [u, v, c] = lampUV(k as LampArt, 0.5, 0.5); expect(c).toBe(i + 1); expect(u * 0.992 + 0.004).toBeCloseTo((x + w / 2) / 512, 5); expect(v * 0.992 + 0.004).toBeCloseTo((y + h / 2) / 256, 5); }
    // the head lamp's picture: its projector's lens pale blue, its housing grey; the tail lamp's middle brighter than its outer ring
    expect(lampPaint('n33Head', -98 / 300, 0.3, false)[2]).toBeGreaterThan(0.8); expect(lampPaint('tailRings', 0.4, 0, false)[0]).toBeGreaterThan(lampPaint('tailRings', 0.8, 0, false)[0] + 0.1); });
});

describe('format 6: the free parts', () => {
  it('kept in a file and a link; each kind\'s limits (the crest 25..120 mm high, +-30 degrees); instances by number', () => {
    const d = fromPreset('p959'), v: Placed = { id: 'vent', n: 2, at: { f: 40, u: 0.5, v: 0.5 }, rot: 10, tilt: 0, scale: 1.2, depth: 6, one: true };
    d.body.parts = [{ id: 'plateR', at: { f: 12, u: 0.25, v: 0.75 }, rot: 5, tilt: -3, scale: 1.1 }, v]; const back = parseDesign(designJson(normalise(d)))!; expect(back.body.parts).toEqual(d.body.parts);
    const b = fitPlacedOne({ id: 'badge', at: { f: 3, u: 0.5, v: 0.5 }, rot: 80, tilt: 9, scale: 9, depth: 50, one: true })!;
    expect(b.rot).toBe(30); expect(b.tilt).toBe(0); expect(PART_KINDS.badge.size * b.scale).toBe(120); expect(b.depth).toBe(6); expect(b.one).toBeUndefined();
    expect(PART_KINDS.badge.size * fitPlacedOne({ id: 'badge', at: { f: 3 }, scale: 0 })!.scale).toBe(25);
    expect(fitPlacedOne({ id: 'wingGT', at: { f: 3 }, rot: 40, depth: 9999 })).toMatchObject({ rot: 0, depth: 450 });
    expect(fitPlaced([v, { ...v, n: 0 }, { ...v, rot: -5 }])!.map(p => [p.n ?? 0, p.rot])).toEqual([[0, 10], [2, -5]]);
    expect(withPlaced([v], 'vent', null, 2)).toBeUndefined(); expect(nextN([{ ...v, n: 0 }], 'vent')).toBe(1); expect(nextN(Array.from({ length: 2 }, (_, n) => ({ ...v, id: 'wingGT' as const, n })), 'wingGT')).toBeNull(); });
});
