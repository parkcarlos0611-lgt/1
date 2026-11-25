// docs/systems/115 P2: the hole parts (render/car/attach/holes.ts): the cut made again from the lump's own shell (a moved
// or removed part's hole closes), the rim and the pocket watertight, the triangles a hole adds, the refusals, the rim's
// line and creases, and the 599's stock set made of hole parts against the old stock 599
import { describe, it, expect } from 'vitest';
import { buildShell, shellSkin, p959Model, P959_LUMP } from '../render/car/p959';
import { buildN33Shell, n33Skin, n33Model } from '../render/car/n33';
import { fitPart, fitAll } from '../render/car/attach';
import { cutShell, coordOf } from '../render/car/attach/holes';
import { stockParts, aimPart } from '../render/car/attach/stock';
import { edgeUse } from '../render/car/p959/shell';
import { fitPlacedOne, type Placed, type FreeId } from '../core/placed';
import { fitModel } from '../core/design';
import type { Shell959 } from '../render/car/p959/shell';
import type { Skin } from '../render/car/skin';
import type { Mesh, V } from '../render/car/mesh';

const LUMP = { ...P959_LUMP, plateF: false, plateR: false };
const SA = buildShell({ ...LUMP, lamps: false }), A = shellSkin(SA), SB = buildN33Shell({ glass: null }), B = n33Skin(SB);
const at = (skin: Skin, id: FreeId, o: V, d: V, x: Partial<Placed> = {}): Placed => ({ ...aimPart(skin, { id, o, d })!, ...x });
/** the hole parts placed unusually (tools/ref/p959.ts parts=holes: docs/reference/p2_holes.png) */
const odd = (sk: Skin, n33: boolean): Placed[] => { const L = n33 ? 4675 : 4260, H = n33 ? 1364 : 1281;
  return [at(sk, 'lampEllipsoid', [L * 0.8, 1600, H * 0.6], [0, -1, 0], { scale: 0.7, sx: 1.3 }), at(sk, 'lampSquare', [L * 0.13, 330, 3000], [0, 0, -1], { scale: 0.55, sx: 2 }), at(sk, 'tailRound', [-600, 420, H * 0.33], [1, 0, 0]),
    at(sk, 'grille', [L * 0.22, 0, 3000], [0, 0, -1], { scale: 0.55, sx: 1.2 }), at(sk, 'sideIntake', [L * 0.29, 1600, H * 0.52], [0, -1, 0], { scale: 0.9 }), at(sk, 'louvreCut', [L * 0.5, 0, 3000], [0, 0, -1], { scale: 1.1 }),
    at(sk, 'ventCut', [L * 0.47, 1600, H * 0.4], [0, -1, 0], { rot: 15 }), at(sk, 'tailBand', [L + 600, 0, H * 0.33], [-1, 0, 0], { scale: 0.8 })]; };
/** closed: every edge used twice, once each way */
function watertight(S: Shell959) { const use = [...edgeUse(S.F).values()], dir = new Set<string>(); let twice = 0;
  for (const f of S.F) f.forEach((a, q) => { const k = `${a}>${f[(q + 1) % f.length]!}`; if (dir.has(k)) twice++; dir.add(k); });
  return { open: use.filter(u => u === 1).length, over: use.filter(u => u > 2).length, twice }; }
const shellKeys = (S: Shell959) => new Set(S.F.map(f => f.map(v => S.P[v]!.map(x => x.toFixed(2)).join(',')).join(';')));

describe('the cut', () => {
  it('the odd set on both lumps: every hole fits and is cut, the shell stays closed and consistently wound, each hole a hundred or so triangles', () => {
    for (const [S, sk, n33] of [[SA, A, false], [SB, B, true]] as const) { const fits = fitAll(sk, odd(sk, n33));
      for (const f of fits) expect(f.ok, `${n33 ? 'B' : 'A'} ${f.key}: ${f.why}`).toBe(true);
      const C = cutShell(S, sk, fits.flatMap(f => f.hole!.cuts)); expect([...C.failed]).toEqual([]); expect(C.done.size).toBe(13);
      expect(watertight(C.S)).toEqual({ open: 0, over: 0, twice: 0 });
      for (const [k, n] of C.added) { expect(n, k).toBeGreaterThan(30); expect(n, k).toBeLessThan(k.startsWith('tailBand') ? 320 : 150); } } });
  it('cut again from the lump: a hole moved leaves its old place as the lump had it; taken off, the shell is the lump\'s own', () => {
    const p = at(A, 'ventCut', [1800, 1600, 520], [0, -1, 0]), q = { ...p, at: at(A, 'ventCut', [2150, 1600, 560], [0, -1, 0]).at }, none = p959Model(LUMP);
    const m1 = p959Model({ ...LUMP, placed: [p] }), m2 = p959Model({ ...LUMP, placed: [q] });
    expect(m1.holes?.size).toBe(2); expect(m2.holes?.size).toBe(2); expect(m1.mesh.n).not.toBe(none.mesh.n);
    // every lump face round the first place is in the second shell again
    const near = (S: Shell959) => new Set([...shellKeys(S)].filter(k => k.split(';').every(c => { const [x, y, z] = c.split(',').map(Number); return Math.abs(x! - 1800) < 120 && Math.abs(Math.abs(y!) - 860) < 120 && Math.abs(z! - 520) < 120; })));
    const before = near(none.shell), after = near(m2.shell); expect(before.size).toBeGreaterThan(4); for (const k of before) expect(after.has(k)).toBe(true);
    expect([...near(m1.shell)].filter(k => before.has(k)).length).toBeLessThan(before.size);
    // removed: the very same mesh as the lump's
    const off = p959Model({ ...LUMP, placed: [] }); expect(off.mesh.n).toBe(none.mesh.n); expect(Array.from(off.mesh.pos)).toEqual(Array.from(none.mesh.pos)); });
  it('the rim: a closed drawn line (lamp or vent) and creases; lines crossing a hole (the bonnet\'s shut line) are cut at its rim', () => {
    const p = at(A, 'ventCut', [670, 530, 3000], [0, 0, -1], { scale: 0.8 }), M = p959Model({ ...LUMP, placed: [p] }), f = fitPart(A, p)!;
    const rims = (M.mesh.lines ?? []).filter(l => l.closed && l.kind === 'vent'); expect(f.ok, f.why ?? '').toBe(true); expect(rims.length).toBe(2); expect(rims[0]!.pts.length).toBe(f.hole!.cuts[0]!.ring.length);
    const ck = new Set((M.mesh.creases ?? []).map(([a, b]) => [a, b].map(v => v.map(x => x.toFixed(1)).join(',')).sort().join('|'))), r = f.hole!.cuts[0]!.ring;
    // the rim's edges are creases (as the shell's points, which sit on the ring)
    let hit = 0; for (let i = 0; i < r.length; i++) if (ck.has([r[i]!, r[(i + 1) % r.length]!].map(v => v.map(x => x.toFixed(1)).join(',')).sort().join('|'))) hit++; expect(hit).toBe(r.length);
    // no drawn line runs inside the band (the rear bumper's seam crosses it on the lump)
    const c = f.hole!.cuts[0]!, cut = (M.mesh.lines ?? []).filter(l => !l.closed && l.pts.some(q => { const [s, y, h] = coordOf(c.proj, q as V); return Math.abs(s) < f.hw + 20 && Math.abs(y) < f.hh + 20 && Math.abs(h) < 40; }));
    expect(cut.length).toBeGreaterThan(0);
    for (const l of cut) for (const q of l.pts) { const [s, y, h] = coordOf(c.proj, q as V); expect((s / (f.hw - 3)) ** 2 + (y / (f.hh - 3)) ** 2 < 1 && Math.abs(h) < 40).toBe(false); } });
});

describe('the rules', () => {
  it('refused: overlapping another hole (40 mm), over glass, across a door gap, across the centre line, hidden under the wing', () => {
    const a = at(A, 'ventCut', [1800, 1600, 520], [0, -1, 0]), b = { ...at(A, 'ventCut', [1900, 1600, 530], [0, -1, 0]), n: 1 };
    const fs = fitAll(A, [a, b]); expect(fs[0]!.ok).toBe(true); expect(fs[1]!.why).toMatch(/구멍/);
    const glassy = shellSkin(buildShell({ ...LUMP, lamps: false, glass: 'stock' })); expect(fitPart(glassy, at(glassy, 'louvreCut', [1700, 0, 3000], [0, 0, -1]))!.why).toMatch(/창문/);
    expect(fitPart(A, at(A, 'ventCut', [1445, 1600, 650], [0, -1, 0]))!.why).toMatch(/문 틈/);
    expect(fitPart(A, at(A, 'ventCut', [700, 80, 3000], [0, 0, -1]))!.why).toMatch(/가운데 선/);
    // the 599's own engine lid grille stretched under the ring wing's leading edge
    expect(fitPart(A, at(A, 'louvreCut', [3760 + 0.418 * 400, 0, 860 + 0.908 * 400], [-0.418, 0, -0.908], { scale: 1.2, sx: 1.4 }))!.why).toMatch(/가려/); });
  it('format 6: the width ratio kept within the kind, absent at 1; the openings flag kept', () => {
    expect(fitPlacedOne({ id: 'grille', at: { f: 3, u: 0.5, v: 0.5 }, rot: 0, tilt: 0, scale: 1, sx: 9 })!.sx).toBe(3);
    expect(fitPlacedOne({ id: 'grille', at: { f: 3, u: 0.5, v: 0.5 }, rot: 0, tilt: 0, scale: 1, sx: 1 })!.sx).toBeUndefined();
    expect(fitPlacedOne({ id: 'mirror', at: { f: 3, u: 0.5, v: 0.5 }, rot: 0, tilt: 0, scale: 1, sx: 2 })!.sx).toBeUndefined();
    expect(fitModel('p959', { openings: false } as never).openings).toBe(false); expect(fitModel('p959', {}).openings).toBeUndefined(); });
});

describe('the stock sets', () => {
  const o = { lamp: 'none' as const, openings: false, smalls: false }, sk = shellSkin(buildShell({ ...o, lamps: false })), set = stockParts('p959', sk);
  const old = p959Model({}), now = p959Model({ ...o, placed: set });
  const hex = (M: Mesh, t: number) => '#' + [0, 1, 2].map(i => M.col[t * 3 + i]!.toString(16).padStart(2, '0')).join('');
  const box = (M: Mesh, pick: (n: string, c: string, x: V) => boolean) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let t = 0; t < M.n; t++) { const x = [0, 1, 2].map(k => (M.pos[t * 9 + k]! + M.pos[t * 9 + 3 + k]! + M.pos[t * 9 + 6 + k]!) / 3) as V; if (!pick(M.names?.[M.part[t]!] ?? '', hex(M, t), x)) continue;
      for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k]!, M.pos[t * 9 + i * 3 + k]!); hi[k] = Math.max(hi[k]!, M.pos[t * 9 + i * 3 + k]!); } } return [...lo, ...hi]; };
  const diff = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
  it('the 599\'s stock set of hole parts: every one fits and is cut, the shell closed', () => {
    const fs = fitAll(sk, set); for (const f of fs) expect(f.ok, `${f.key}: ${f.why}`).toBe(true);
    expect([...now.holes!.keys()].sort()).toEqual(['lampRound', 'lampRound~', 'louvreCut', 'sideIntake', 'sideIntake~', 'tailBand']); expect(watertight(now.shell)).toEqual({ open: 0, over: 0, twice: 0 }); });
  it('matches the old stock 599 within a few mm (lamps 2, tail lamp red 10, its amber ends 40, side intake 20, engine lid grille 30, the whole car 15 for the mirrors)', () => {
    const pairs: [string, number, (n: string, c: string, x: V) => boolean, (n: string, c: string, x: V) => boolean][] = [
      ['bezel', 2, (n, _c, x) => n === 'lampBezel' && x[1] > 0, (n, _c, x) => n === 'lampBezel' && x[1] > 0], ['lens', 2, (n, c, x) => n === 'headLamp' && c === '#e3e8ec' && x[1] > 0, (n, c, x) => n === 'headLamp' && c === '#e3e8ec' && x[1] > 0],
      ['tail red', 10, (_n, c, x) => c === '#b3261e' && x[0] > 3900, (_n, c, x) => c === '#b3261e' && x[0] > 3900], ['amber', 40, (_n, c, x) => c === '#d9861c' && x[0] > 3900 && x[1] > 0, (_n, c, x) => c === '#d9861c' && x[0] > 3900 && x[1] > 0],
      ['intake', 20, (n, _c, x) => n === 'sideIntake' && x[1] > 0, (n, _c, x) => n === 'holeFloor' && x[0] > 2500 && x[0] < 2900 && x[1] > 0], ['lid', 30, n => n === 'engineGrille', (n, _c, x) => n === 'holeFloor' && x[0] > 3400 && x[0] < 3950 && x[2] > 760],
      ['all', 15, () => true, () => true]];
    for (const [name, tol, pa, pb] of pairs) expect(diff(box(old.mesh, pa), box(now.mesh, pb)), name).toBeLessThanOrEqual(tol); });
  it('triangles: the stock set about 10.6 thousand (the ceiling is about 10,000: over it by the free mirrors and tips of P1 and the pockets; docs/systems/115 P2)', () => {
    expect(old.mesh.n).toBe(9550); expect(now.mesh.n).toBeGreaterThan(10000); expect(now.mesh.n).toBeLessThan(10800);
    for (const [k, n] of now.holes!) expect(n, k).toBeLessThan(k === 'tailBand' ? 260 : 180); });
  it('the N33\'s placeholders: square lamps, the grille, two round tail lamps a side, all cut', () => {
    const nk = n33Skin(buildN33Shell({ glass: 'stock' })), ps = stockParts('bnr33', nk), M = n33Model({ glass: 'stock', placed: ps, plateF: true, plateR: true });
    expect([...M.holes!.keys()].sort()).toEqual(['grille', 'lampSquare', 'lampSquare~', 'tailRound', 'tailRound#1', 'tailRound#1~', 'tailRound~']); expect(watertight(M.shell)).toEqual({ open: 0, over: 0, twice: 0 }); });
});
