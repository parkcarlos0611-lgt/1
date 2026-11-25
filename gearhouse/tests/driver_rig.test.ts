import { describe, it, expect } from 'vitest';
import { interiorMesh, INTERIORS, DriverMotion, poseCabin, poseDials, solveDriver, restPose, rimAt, gate, leverPath, along, segBone, ctlBone, SEGS, MOTION, type CabinPose, type CabinRig, type InteriorInput } from '../render/car/interior';
import { N33_CABIN } from '../render/car/bodies';
import { BONE_SLOTS } from '../render/live/renderer';
import type { Mesh, V } from '../render/car/mesh';

const stock = interiorMesh(INTERIORS.stock), rhd = interiorMesh({ ...INTERIORS.n33Stock, cabin: N33_CABIN });
const rigOf = (M: Mesh) => M.dials!.cabin!;
const app = (B: Float32Array, b: number, p: V): V => [0, 1, 2].map(i => B[b * 12 + i * 4]! * p[0] + B[b * 12 + i * 4 + 1]! * p[1] + B[b * 12 + i * 4 + 2]! * p[2] + B[b * 12 + i * 4 + 3]!) as V;
const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** a drive held for t seconds in steps of 1/60 */
function run(m: DriverMotion, rig: CabinRig, t: number, i: InteriorInput | ((t: number) => InteriorInput)): CabinPose { let p!: CabinPose; for (let k = 0; k * (1 / 60) < t; k++) p = m.step(1 / 60, typeof i === 'function' ? i(k / 60) : i, rig); return p; }

describe('the driver\'s rig (docs/systems/118 D2-D4)', () => {
  it('has fifteen pieces and five controls on their own bones, within the shader\'s slots; at rest every bone is as built', () => {
    for (const M of [stock, rhd]) { const R = M.dials!, C = rigOf(M); expect(R.bones).toBeLessThanOrEqual(BONE_SLOTS); expect(SEGS).toHaveLength(15);
      const used = new Set(Array.from(M.dial!)); for (const s of SEGS) expect(used.has(segBone(C, s)), s).toBe(true); for (const c of ['lever', 'handbrake', 'clutch', 'brake', 'throttle'] as const) expect(used.has(ctlBone(C, c)), c).toBe(true);
      for (let t = 0; t < M.n; t++) { const nm = M.names![M.part[t]!]!; if (/^driver/.test(nm)) expect(M.dial![t]! >= C.first && M.dial![t]! < C.ctl, nm).toBe(true); if (/^(shifterBoot|shifterBase|handbrakeLeverBase|handbrakeLeverCylinder|seat|dash|tunnel)/.test(nm)) expect(M.dial![t], nm).toBe(0); }
      const B = poseCabin(R, null, restPose(C)), B0 = poseDials(R); for (let i = 0; i < R.bones * 12; i++) expect(Math.abs(B[i]! - B0[i]!), `entry ${i}`).toBeLessThan(0.02); }
  });
  it('the hands reach the rim at nine and three, and follow it as the wheel turns (two-bone IK, the torso leaning when it must)', () => {
    for (const M of [stock, rhd]) { const C = rigOf(M);
      for (const deg of [-120, -90, -45, 0, 30, 60, 90, 120]) { const w = deg * Math.PI / 180, P = restPose(C); P.wheel = w; P.hands.L.alpha = C.wheel.home.L - w; P.hands.R.alpha = C.wheel.home.R - w;
        const S = solveDriver(C, P), B = poseCabin(M.dials!, null, P); expect(S.gap.L, `left at ${deg}`).toBeLessThan(2); expect(S.gap.R, `right at ${deg}`).toBeLessThan(2);
        // the glove's middle is on the rim where the hand holds it
        for (const k of ['L', 'R'] as const) expect(dist(app(B, segBone(C, `hand${k}`), C.driver.hand[k]), rimAt(C.wheel, P.hands[k].alpha).p), `${k} at ${deg}`).toBeLessThan(0.5); } }
  });
  it('past 120 degrees a hand lets go and takes the rim again (hand over hand), one at a time, and comes back home when the wheel rests', () => {
    const C = rigOf(stock), m = new DriverMotion(); let lifted = 0, both = 0, most = 0;
    // a quick wind to 400 degrees of lock and back, as a drift's counter-steer
    for (let k = 0; k < 240; k++) { const t = k / 60, w = (t < 1.5 ? t / 1.5 : Math.max(0, 1 - (t - 2) / 1.5)) * 400 * Math.PI / 180, P = m.step(1 / 60, { steer: w, on: true, kmh: 60, gear: 3 }, C);
      const offL = Math.abs(Math.atan2(Math.sin(P.hands.L.alpha - C.wheel.home.L), Math.cos(P.hands.L.alpha - C.wheel.home.L))), offR = Math.abs(Math.atan2(Math.sin(P.hands.R.alpha - C.wheel.home.R), Math.cos(P.hands.R.alpha - C.wheel.home.R)));
      most = Math.max(most, Math.min(offL, offR)); if (P.hands.L.lift > 0 || P.hands.R.lift > 0) lifted++; if (P.hands.L.lift > 0 && P.hands.R.lift > 0) both++;
      const S = solveDriver(C, P); expect(Math.max(S.gap.L, S.gap.R), `reach at ${t.toFixed(2)} s`).toBeLessThan(3); }
    expect(lifted).toBeGreaterThan(10); expect(both).toBe(0); expect(most).toBeLessThanOrEqual(MOTION.regripAt + 0.15);
    const P = run(m, C, 2, { steer: 0, on: true, kmh: 60, gear: 3 }); for (const k of ['L', 'R'] as const) expect(Math.abs(P.hands[k].alpha - C.wheel.home[k])).toBeLessThan(0.05);
  });
  it('the H pattern: each gear its own place, the lever\'s path through the neutral line, the hand on the knob through the move', () => {
    const places = new Set<string>(); for (let g = 1; g <= 6; g++) places.add(gate(g, 6).join()); places.add(gate('R', 6).join()); expect(places.size).toBe(7);
    expect(gate(1)).toEqual([-1, 1]); expect(gate(2)).toEqual([-1, -1]); expect(gate(5)).toEqual([1, 1]); expect(gate('R', 5)).toEqual([1, -1]);
    for (const [a, b] of [[1, 2], [2, 3], [3, 4], [4, 5], [5, 4], [3, 2], [2, 1]] as const) { const p = leverPath(a, b, 6); expect(p[0]).toEqual(gate(a, 6)); expect(p[p.length - 1]).toEqual(gate(b, 6));
      for (let u = 0; u <= 1; u += 0.05) { const q = along(p, u); expect(Math.abs(q[1]) < 1e-9 || Math.abs(q[0] - gate(a, 6)[0]) < 1e-9 || Math.abs(q[0] - gate(b, 6)[0]) < 1e-9, `${a}-${b} at ${u}`).toBe(true); } }   // across only on the neutral line
    // each gear puts the knob in its own place, and a shift 2 -> 3 runs reach, move, return in about 0.42 s with the inner hand on the knob
    const C = rigOf(stock), K = C.controls.lever.knob, knob = (g: number) => app(poseCabin(stock.dials!, null, { ...restPose(C), lever: gate(g) }), ctlBone(C, 'lever'), K);
    for (let g = 1; g < 5; g++) expect(dist(knob(g), knob(g + 1))).toBeGreaterThan(40); expect(knob(1)[0]).toBeLessThan(knob(2)[0]); expect(knob(1)[1]).toBeGreaterThan(knob(3)[1]);
    const m = new DriverMotion(), at = (g: number) => ({ steer: 0, on: true, kmh: 80, gear: g, throttle: 0.5 }); run(m, C, 0.5, at(2));
    let onKnob = 0, clutchMost = 0; const t0: number[] = []; for (let k = 0; k < 40; k++) { const P = m.step(1 / 60, at(3), C); if (P.hands.R.task === 'lever' && P.hands.R.w > 0.99) { onKnob++; t0.push(k); } clutchMost = Math.max(clutchMost, P.pedals.clutch); expect(P.hands.L.task).toBeNull(); }
    expect(onKnob).toBeGreaterThan(5); expect(clutchMost).toBeGreaterThan(0.9); const P = run(m, C, 0.5, at(3)); expect(P.lever).toEqual(gate(3)); expect(P.hands.R.task).toBeNull(); expect(P.pedals.clutch).toBeLessThan(0.05);
    // right-hand drive: the left hand shifts
    const C2 = rigOf(rhd), m2 = new DriverMotion(); run(m2, C2, 0.5, at(2)); let left = 0; for (let k = 0; k < 30; k++) { const Q = m2.step(1 / 60, at(3), C2); if (Q.hands.L.task === 'lever') left++; expect(Q.hands.R.task).toBeNull(); } expect(left).toBeGreaterThan(5);
  });
  it('the feet: the right from the throttle to the brake in a tenth, heel and toe on a braking downshift; the handbrake and the key by the inner hand', () => {
    const C = rigOf(stock), m = new DriverMotion(); run(m, C, 0.5, { on: true, kmh: 100, gear: 4, throttle: 1 });
    let P = run(m, C, 0.1, { on: true, kmh: 100, gear: 4, brake: 0.8 }); expect(P.foot).toBeGreaterThan(0.95); expect(P.pedals.brake).toBeGreaterThan(0.3);
    P = run(m, C, 0.15, { on: true, kmh: 90, gear: 3, brake: 0.8 }); expect(P.heelToe).toBeGreaterThan(0.5); expect(P.pedals.throttle).toBeGreaterThan(0.1);
    const S = solveDriver(C, P), B = poseCabin(stock.dials!, null, P); expect(dist(app(B, segBone(C, 'footR'), C.driver.ankle.R), app(B, segBone(C, 'shinR'), C.driver.ankle.R))).toBeLessThan(2); void S;
    P = run(m, C, 0.4, { on: true, kmh: 60, gear: 3, handbrake: 1 }); expect(P.hands.R.task).toBe('handbrake'); expect(P.handbrake).toBeGreaterThan(0.8);
    const m2 = new DriverMotion(); P = run(m2, C, 0.4, { on: true, kmh: 0, gear: 1, cranking: true }); expect(P.hands.R.task).toBe('key'); expect(P.hands.R.w).toBeGreaterThan(0.99);
    expect(dist(handOf(C, P, 'R'), C.controls.key)).toBeLessThan(5); expect(solveDriver(C, P).gap.R).toBeLessThan(3);
    P = run(m2, C, 0.5, { on: true, kmh: 0, gear: 1, cranking: false }); expect(P.hands.R.task).toBeNull();
  });
  it('the head sways with the car (its setting), looks into a slide, and leaves the eye where the cockpit\'s camera takes it; hidden in that view', () => {
    const C = rigOf(stock), m = new DriverMotion(); m.move = 'normal'; const P = run(m, C, 1, { on: true, kmh: 90, gear: 3, ay: 8, vx: 25, vy: 5 });
    expect(P.head[2]).toBeLessThan(-0.02); expect(P.head[0]).toBeGreaterThan(0.05);
    const off = new DriverMotion(); off.move = 'off'; const Q = run(off, C, 1, { on: true, kmh: 90, gear: 3, ay: 8, vx: 25, vy: 5 }); expect(Math.abs(Q.head[2]) + Math.abs(Q.head[0])).toBeLessThan(1e-6);
    const R0 = restPose(C); poseCabin(stock.dials!, null, R0); expect(dist(R0.eye!, C.driver.eye)).toBeLessThan(0.5);
    const hid = { ...restPose(C), hideHead: true }, B = poseCabin(stock.dials!, null, hid), b = segBone(C, 'head'); expect([0, 1, 2, 4, 5, 6, 8, 9, 10].every(i => B[b * 12 + i] === 0)).toBe(true);
  });
});
function handOf(C: CabinRig, P: CabinPose, k: 'L' | 'R'): V { const S = solveDriver(C, P); const pl = S.segs.find(([s]) => s === `hand${k}`)![1]; const R = pl.R, d: V = [C.driver.hand[k][0] - pl.from[0], C.driver.hand[k][1] - pl.from[1], C.driver.hand[k][2] - pl.from[2]];
  return [R[0] * d[0] + R[1] * d[1] + R[2] * d[2] + pl.to[0], R[3] * d[0] + R[4] * d[1] + R[5] * d[2] + pl.to[1], R[6] * d[0] + R[7] * d[1] + R[8] * d[2] + pl.to[2]]; }
