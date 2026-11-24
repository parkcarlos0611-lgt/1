// The engine's insides for the workshop's cutaway (render/car/powertrain/internals.ts): each layout's crank fires evenly
// where the real engine does (720 / cylinders) and a 90-degree V6 on common pins fires 90/150 as the odd-fire ones did;
// each cylinder's firing top falls where its pin points up its bank; the pistons stay in their bores and their stroke,
// the rods keep their length, the valves never reach a piston (the overlap at the top included: a clearance check on the
// posed mesh), the lobes push their valves when they lift, the cams turn once in two turns of the crank, the cutaway
// takes the housing out of the region it opens, and the bones fit the shader's limit (a V12 the most).
import { describe, it, expect } from 'vitest';
import { DESIGN_F355, DESIGN_NSX, normalise, type Design, type Layout } from '../core/design';
import { crankPins, fireAngles, firingGaps, cylAt, poseInternals, strokeOf, plugGlint, ENGINE_BONES, TIMING, type CrankKind, type EngineRig } from '../render/car/powertrain/internals';
import { standModel, cutMesh } from '../render/car/powertrain/stand';
import { RIG_BONES } from '../render/car/suspension';
import type { Mesh } from '../render/car/mesh';
import { engineDims } from '../render/car/powertrain/engine';
import { fromDesign } from '../render/car/powertrain/spec';

const tweak = (d: Design, f: (e: Design['engine']) => void): Design => { const e = structuredClone(d); f(e.engine); return normalise(e); };
const mod = (a: number, m: number) => ((a % m) + m) % m;
type V = [number, number, number];
const ap = (B: Float32Array, k: number, p: V): V => { const o = k * 12; return [B[o]! * p[0] + B[o + 1]! * p[1] + B[o + 2]! * p[2] + B[o + 3]!, B[o + 4]! * p[0] + B[o + 5]! * p[1] + B[o + 6]! * p[2] + B[o + 7]!, B[o + 8]! * p[0] + B[o + 9]! * p[1] + B[o + 10]! * p[2] + B[o + 11]!]; };
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const near = (a: V, b: V, e = 1e-3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < e;
/** the posed corners of the triangles of a part name on a bone */
function corners(M: Mesh, name: string, bone: number): V[] { const k = M.names!.indexOf(name), out: V[] = []; for (let t = 0; t < M.n; t++) { if (M.bone![t] !== bone || M.names![M.part[t]!] !== name) continue; for (let j = 0; j < 3; j++) out.push([M.pos[t * 9 + j * 3]!, M.pos[t * 9 + j * 3 + 1]!, M.pos[t * 9 + j * 3 + 2]!]); } void k; return out; }
const axis = (c: EngineRig['cyl'][number]): V => [0, Math.sin(c.beta * Math.PI / 180), Math.cos(c.beta * Math.PI / 180)];
const engineDimsOf = (l: Layout) => engineDims(fromDesign(tweak(DESIGN_F355, e => { e.layout = l; e.cc = l[1] === '4' ? 2000 : l === 'V12' ? 6000 : l === 'V10' ? 5000 : 3500; })));
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('the crank and the firing', () => {
  const even: [string, 'I' | 'V' | 'flat', number, number, CrankKind | undefined][] = [['in-line four (flat plane)', 'I', 4, 0, undefined], ['in-line six', 'I', 6, 0, undefined], ['flat four (boxer)', 'flat', 4, 180, undefined],
    ['flat six (boxer)', 'flat', 6, 180, undefined], ['60-degree V6, split pins', 'V', 6, 60, 'split'], ['90-degree V6, split pins (the NSX)', 'V', 6, 90, 'split'], ['V8 flat plane (the F355)', 'V', 8, 90, 'flat'], ['V8 cross plane', 'V', 8, 90, 'cross'],
    ['72-degree V10', 'V', 10, 72, undefined], ['60-degree V12', 'V', 12, 60, undefined]];
  for (const [what, l, n, deg, k] of even) it(`${what}: fires every ${720 / n} degrees, each at a top its pin makes`, () => {
    const p = crankPins(l, n, deg, k), { fire, shift } = fireAngles(p, deg, l), { gaps } = firingGaps(fire);
    for (const g of gaps) expect(g).toBeCloseTo(720 / n, 6);
    const half = l === 'I' ? 0 : l === 'flat' ? 90 : deg / 2;
    p.forEach((c, i) => expect(mod(c.s * half - (c.pin + shift) - fire[i]!, 360)).toBeCloseTo(0, 6)); });
  it('the throws: a flat-plane crank\'s pins at 0 and 180 only, a cross plane\'s four 90 apart, a V shares its pins but a V6\'s are split by 120 less the vee, a boxer\'s pair 180 apart', () => {
    const set = (l: 'I' | 'V' | 'flat', n: number, d: number, k?: CrankKind) => [...new Set(crankPins(l, n, d, k).map(c => mod(c.pin, 360)))].sort((a, b) => a - b);
    expect(set('I', 4, 0)).toEqual([0, 180]); expect(set('V', 8, 90, 'flat')).toEqual([0, 180]); expect(set('V', 8, 90, 'cross')).toEqual([0, 90, 180, 270]); expect(set('I', 6, 0)).toEqual([0, 120, 240]);
    for (const i of [0, 1, 2, 3]) { const P = crankPins('V', 8, 90, 'cross').filter(c => c.i === i); expect(P[0]!.pin).toBe(P[1]!.pin); }
    for (const [d, sp] of [[60, 60], [90, 30]]) for (const i of [0, 1, 2]) { const P = crankPins('V', 6, d!, 'split').filter(c => c.i === i); expect(mod(P[1]!.pin - P[0]!.pin, 360)).toBe(sp); }
    for (const n of [4, 6]) for (const i of [0, 1, 2].slice(0, n / 2)) { const P = crankPins('flat', n, 180).filter(c => c.i === i); expect(mod(P[1]!.pin - P[0]!.pin, 360)).toBe(180); } });
  it('the uneven ones as they are: a 90-degree V6 on common pins fires 90 and 150 by turns (documented, not used by the stand\'s 60-degree V6)', () => {
    const p = crankPins('V', 6, 90, 'common'), { gaps } = firingGaps(fireAngles(p, 90, 'V').fire); expect([...gaps].sort((a, b) => a - b)).toEqual([90, 90, 90, 150, 150, 150]);
    for (let j = 0; j < 6; j++) expect(gaps[j]! + gaps[(j + 1) % 6]!).toBe(240); });
  it('the cross plane\'s banks do not take turns (its burble), the flat plane\'s do', () => {
    const turns = (k: CrankKind) => { const p = crankPins('V', 8, 90, k), { order } = firingGaps(fireAngles(p, 90, 'V').fire); return order.filter((c, j) => p[c]!.s !== p[order[(j + 1) % 8]!]!.s).length; };
    expect(turns('flat')).toBe(8); expect(turns('cross')).toBeLessThan(8); });
});

// the stand's cutaway for each layout (the F355's engine with the layout changed), the valves at each count on a V12
const LAYOUTS_ALL: Layout[] = ['I4', 'I6', 'F4', 'F6', 'V6', 'V8', 'V10', 'V12'];
const cutOf = (l: Layout, valves: 2 | 3 | 4 | 5 = 4, bs = 1.0, crank?: CrankKind) => { const d = tweak(DESIGN_F355, e => { e.layout = l; e.valves = valves; e.bs = bs; e.cc = l[1] === '4' ? 2000 : l === 'V12' ? 6000 : l === 'V10' ? 5000 : 3500; e.turbo = 0; }); return standModel(d, 2, { crank }); };

describe('the motion', () => {
  for (const l of LAYOUTS_ALL) for (const bs of [0.8, 1.4]) it(`${l}, bore/stroke ${bs}: pistons in their bores and within their stroke, the rods\' length kept, the bones carrying pin and wrist, no valve reaching a piston`, () => {
    const m = cutOf(l, 4, bs), rig = m.rig!, M = m.mesh, o = rig.off;
    expect(rig.l / rig.stroke).toBeGreaterThanOrEqual(1.38 - 1e-9); expect(rig.l / rig.stroke).toBeLessThanOrEqual(1.7 + 1e-9);
    const rest = Object.fromEntries(rig.cyl.map(c => [c.no, { pist: corners(M, 'piston', c.bones.piston), inV: corners(M, 'intakeValve', c.bones.inV), exV: corners(M, 'exhaustValve', c.bones.exV) }]));
    for (let th = 0; th < 720; th += 6) { const B = poseInternals(rig, th);
      for (const c of rig.cyl) { const q = cylAt(rig, c, th), a = axis(c), C: V = [c.u + o[0], o[1], o[2]], z = cylAt(rig, c, 0);
        expect(Math.hypot(q.wrist[1] - q.pin[1], q.wrist[2] - q.pin[2])).toBeCloseTo(rig.l, 6);                        // the rod's length
        expect(q.x).toBeGreaterThanOrEqual(rig.l - rig.r - 1e-9); expect(q.x).toBeLessThanOrEqual(rig.l + rig.r + 1e-9);   // the stroke
        expect(q.crown).toBeLessThan(rig.deck);                                                                         // under the deck at the top
        expect(near(ap(B, c.bones.rod, add(z.pin, o)), add(q.pin, o))).toBe(true); expect(near(ap(B, c.bones.rod, add(z.wrist, o)), add(q.wrist, o))).toBe(true);   // the rod on its bone
        expect(near(ap(B, 1, add(z.pin, o)), add(q.pin, o))).toBe(true);                                                // the crank carries the pin
        if (th % 30) continue;
        let top = -Infinity, rad = 0; for (const p of rest[c.no]!.pist) { const w = ap(B, c.bones.piston, p), d: V = [w[0] - C[0], w[1] - C[1], w[2] - C[2]], al = dot(d, a); top = Math.max(top, al); rad = Math.max(rad, Math.hypot(d[0], d[1] - a[1] * al, d[2] - a[2] * al)); }
        expect(rad).toBeLessThanOrEqual(rig.bore / 2); expect(top).toBeCloseTo(q.crown, 3);                                // in the bore, its crown where the slider-crank puts it
        let low = Infinity; for (const [k, P] of [[c.bones.inV, rest[c.no]!.inV], [c.bones.exV, rest[c.no]!.exV]] as const) for (const p of P) { const w = ap(B, k, p); low = Math.min(low, dot([w[0] - C[0], w[1] - C[1], w[2] - C[2]], a)); }
        expect(low - q.crown).toBeGreaterThan(0.5); } } });
  it('the overlap at the exhaust top: both valves a little open, still clear of the piston (each layout, each valve count)', () => {
    for (const l of ['I4', 'V8', 'V12', 'F6'] as Layout[]) for (const v of [2, 3, 4, 5] as const) { const m = cutOf(l, v, 0.8), rig = m.rig!;
      for (const c of rig.cyl) { const th = c.fire + 360, q = cylAt(rig, c, th); expect(q.inLift).toBeGreaterThan(0); expect(q.exLift).toBeGreaterThan(0);
        const B = poseInternals(rig, th), C: V = [c.u + rig.off[0], rig.off[1], rig.off[2]], a = axis(c); let low = Infinity;
        for (const [nm, k] of [['intakeValve', c.bones.inV], ['exhaustValve', c.bones.exV]] as const) for (const p of corners(m.mesh, nm, k)) { const w = ap(B, k, p); low = Math.min(low, dot([w[0] - C[0], w[1] - C[1], w[2] - C[2]], a)); }
        expect(low - q.crown).toBeGreaterThan(0.5); } } });
  it('the cams turn once in two turns of the crank; each lobe pushes its valve open as far as the valve lifts', () => {
    const m = cutOf('V8', 4, 1, 'flat'), rig = m.rig!, cam = rig.cams[0]!, p: V = [1000, rig.off[1] + cam.c[1] + 30, rig.off[2] + cam.c[2]];
    expect(near(ap(poseInternals(rig, 720), cam.bone, p), p)).toBe(true); expect(near(ap(poseInternals(rig, 360), cam.bone, p), p)).toBe(false);
    const camOf = (c: EngineRig['cyl'][number], side: number) => rig.cams.find(k => k.s === c.s && k.side === side)!;
    for (const c of rig.cyl.filter(c => rig.cams.some(k => k.s === c.s))) for (const side of [-1, 1]) { const k = camOf(c, side), d = side < 0 ? c.inD : c.exD, at = (th: number) => { const B = poseInternals(rig, th); let r = 0;
        for (let t = 0; t < m.mesh.n; t++) { if (m.mesh.bone![t] !== k.bone) continue; for (let j = 0; j < 3; j++) { const q = t * 9 + j * 3, P: V = [m.mesh.pos[q]!, m.mesh.pos[q + 1]!, m.mesh.pos[q + 2]!]; if (Math.abs(P[0] - rig.off[0] - c.u) > 0.4 * rig.bore) continue;
          const w = ap(B, k.bone, P); r = Math.max(r, dot([w[0] - rig.off[0] - k.c[0], w[1] - rig.off[1] - k.c[1], w[2] - rig.off[2] - k.c[2]], d)); } } return r; };
      const peak = c.fire + (side < 0 ? (TIMING.inOpen + TIMING.inClose) / 2 : (TIMING.exOpen + TIMING.exClose) / 2), shut = peak + 360;
      expect(at(peak) - at(shut)).toBeGreaterThan(rig.lift * 0.85); } });
  it('the strokes and the spark: power from the firing top, then exhaust, intake, compression; the plug flashes just before', () => {
    const rig = cutOf('I4').rig!, c = rig.cyl[0]!;
    expect([10, 190, 370, 550].map(a => strokeOf(c, c.fire + a))).toEqual([0, 1, 2, 3]);
    expect(plugGlint(c, c.fire - TIMING.spark + 1)).toBeGreaterThan(0.9); expect(plugGlint(c, c.fire + 200)).toBe(0); expect(plugGlint(c, c.fire + 380)).toBe(0); });
});

describe('the cutaway and the bones', () => {
  it('each layout: the housing out of the opened region, the covers and the intake gone, the insides there', () => {
    for (const l of LAYOUTS_ALL) { const m = cutOf(l), M = m.mesh, N = M.names!, rig = m.rig!;
      for (const nm of ['crankshaft', 'conRod', 'piston', 'pistonRing', 'cylinderBore', 'camshaft', 'intakeValve', 'exhaustValve', 'sparkPlug']) expect(N.includes(nm), `${l} ${nm}`).toBe(true);
      for (let t = 0; t < M.n; t++) { const nm = N[M.part[t]!]!; expect(['camCover', 'intakePlenum', 'intakeRunner', 'coilPack'].includes(nm), `${l} ${nm}`).toBe(false); }
      // no housing left inside the opened region (each cut triangle's middle outside one of its planes at least), and the cut made
      const D = engineDimsOf(l), o = rig.off, at = (k: number): V => [o[0], o[1], o[2] + k * D.B];
      const planes: { o: V; n: V }[] = l[0] === 'I' ? [{ o: at(0), n: [0, -1, 0] }] : l[0] === 'F' ? [{ o: at(-0.15), n: [0, 0, 1] }] : [{ o: at(-0.12), n: [0, -D.cs, D.sn] }, { o: at(-0.12), n: [0, D.cs, D.sn] }];
      let inside = 0, onCut = 0; for (let t = 0; t < M.n; t++) { const nm = N[M.part[t]!]!; if (!['engineBlock', 'cylinderHead', 'sump', 'cylinderBore'].includes(nm)) continue;
        const c: V = [0, 1, 2].map(k => (M.pos[t * 9 + k]! + M.pos[t * 9 + 3 + k]! + M.pos[t * 9 + 6 + k]!) / 3) as V, f = (p: V, q: { o: V; n: V }) => dot([p[0] - q.o[0], p[1] - q.o[1], p[2] - q.o[2]], q.n);
        if (planes.every(q => f(c, q) > 0.5)) inside++; for (let j = 0; j < 3; j++) { const p: V = [M.pos[t * 9 + j * 3]!, M.pos[t * 9 + j * 3 + 1]!, M.pos[t * 9 + j * 3 + 2]!]; if (planes.some(q => Math.abs(f(p, q)) < 0.01)) onCut++; } }
      const hit = inside; expect(onCut, l).toBeGreaterThan(50);
      expect(hit, l).toBe(0); } });
  it('a triangle across a plane is cut along it', () => {
    const M: Mesh = { n: 1, pos: new Float32Array([-10, 0, 0, 10, 0, 0, 0, 10, 0]), col: new Uint8Array(3), gloss: new Float32Array(1), part: new Int16Array([1]), kind: new Uint8Array(1), tex: new Uint8Array(1), length: 0, names: ['', 'x'] };
    const C = cutMesh(M, () => 'clip', [{ o: [0, 0, 0], n: [1, 0, 0] }]); let maxX = -Infinity, area = 0; for (let i = 0; i < C.pos.length; i += 3) maxX = Math.max(maxX, C.pos[i]!);
    for (let t = 0; t < C.n; t++) { const p = C.pos.subarray(t * 9, t * 9 + 9); area += Math.abs((p[3]! - p[0]!) * (p[7]! - p[1]!) - (p[6]! - p[0]!) * (p[4]! - p[1]!)) / 2; }
    expect(maxX).toBeCloseTo(0, 5); expect(area).toBeCloseTo(50, 3); });
  it('the bones: within the shader\'s limit for every layout and valve count, a V12 with four valves the most (ENGINE_BONES counts its near bank\'s two cams the cutaway leaves out); the vertex rows within what WebGL2 promises', () => {
    let most = 0; for (const l of LAYOUTS_ALL) for (const v of [2, 3, 4, 5] as const) { const rig = cutOf(l, v).rig!; expect(rig.bones).toBeLessThanOrEqual(ENGINE_BONES); most = Math.max(most, rig.bones);
      expect(Math.max(...cutOf(l, v).mesh.bone!)).toBeLessThan(rig.bones); }
    expect(cutOf('V12', 4).rig!.bones).toBe(ENGINE_BONES - 2); expect(most).toBe(ENGINE_BONES - 2);   // the cutaway leaves out a V's near-bank cams (their bones too)
    expect(Math.max(RIG_BONES, ENGINE_BONES) * 3 + 32 + 16 + 4).toBeLessThanOrEqual(256); });
  it('the V8\'s crank by choice, the firing order shown from cylinder 1; the NSX\'s V6 split-pinned', () => {
    const flat = cutOf('V8', 4, 1, 'flat').rig!, cross = cutOf('V8', 4, 1, 'cross').rig!;
    expect(flat.crank).toBe('flat'); expect(cross.crank).toBe('cross'); expect(flat.order.split('-')[0]).toBe('1'); expect(new Set(flat.order.split('-')).size).toBe(8);
    expect(standModel(DESIGN_NSX, 2, {}).rig!.crank).toBe('split'); });
});
