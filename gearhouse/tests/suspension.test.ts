// The suspension as parts that move (docs/systems/101, M3): each base's hardpoints, the linkage's kinematics (the arms
// keep their lengths through the travel, the upright reaches the hub wherever the wheel is asked to stand), the parts in
// the car (named, within the budget, no number missing), and that they stay inside the wheel and the wheel's well at
// the ends of the travel.
import { describe, it, expect } from 'vitest';
import { DESIGN_NSX, DESIGN_F355, DESIGN_EB110, BODY_LIMITS, applyPatch, type Design } from '../core/design';
import { designKit, designMesh } from '../render/car/design';
import { assemble, type Assembled } from '../render/car/kit/assemble';
import { wheelsOf } from '../render/car/mesh';
import { SUSPENSION, TRAVEL, NB, RIG_BONES, axlePoints, barAt, bones, camberOf, isSuspPart, poseMesh, poseRig, solve, steerOf, type Hardpoints, type SuspWheel } from '../render/car/suspension';
import { dist, affPt, type V } from '../render/car/suspension/kinematics';
import { bareMesh, bounce } from '../render/car/suspension/view';

const BASES: [string, Design][] = [['nsx', DESIGN_NSX], ['f355', DESIGN_F355], ['eb110', DESIGN_EB110]];
const build = (d: Design, detail: 0 | 1 | 2 = 2): Assembled => { const { kit, tweak } = designKit(d, detail); return assemble(kit, { tweak }); };
const built = new Map<string, Assembled>(), car = (id: string) => { let A = built.get(id); if (!A) { A = build(BASES.find(b => b[0] === id)![1]); built.set(id, A); } return A; };
const WHEEL: SuspWheel = { x: 1000, y: 760, r: 300, w: 215, rim: 200, back: 65 };
const NAMES = ['wishboneUpper', 'wishboneLower', 'upright', 'hubFlange', 'spring', 'damper', 'damperRod', 'antiRollBar', 'dropLink', 'tieRod', 'toeLink', 'brakeDisc', 'caliper', 'steeringRack'];
/** the lengths a corner's rigid parts must keep */
const lengths = (H: Hardpoints, P: ReturnType<typeof solve>) => [dist(P.lbj, H.lower.f), dist(P.lbj, H.lower.r), dist(P.ubj, H.upper.f), dist(P.ubj, H.upper.r), dist(P.lbj, P.ubj), dist(P.outer, P.inner), dist(P.outer, P.lbj), dist(P.outer, P.ubj)];

describe('suspension: the hardpoints', () => {
  it('every kit base has a double wishbone at both ends, its two sides mirrored', () => {
    for (const [id] of BASES) { const S = SUSPENSION[id]!; expect(S, id).toBeTruthy();
      for (const front of [true, false]) { const ax = front ? S.front : S.rear; expect(ax.type).toBe('doubleWishbone'); const [L, R] = axlePoints(ax, WHEEL, front);
        expect(L.side).toBe(1); expect(R.side).toBe(-1); expect(L.steer.rack).toBe(front);
        for (const k of ['f', 'r', 'bj'] as const) { expect(R.lower[k]).toEqual([L.lower[k][0], -L.lower[k][1], L.lower[k][2]]); expect(R.upper[k]).toEqual([L.upper[k][0], -L.upper[k][1], L.upper[k][2]]); }
        // the ball joints inboard of the wheel's closed back and inside the rim, the upper arm the shorter, the pivots inboard of the joints
        for (const bj of [L.lower.bj, L.upper.bj]) { expect(WHEEL.y - bj[1]).toBeGreaterThan(WHEEL.back + 15); expect(Math.hypot(bj[0] - WHEEL.x, bj[2] - WHEEL.r)).toBeLessThan(WHEEL.rim - 40); }
        expect(L.lower.bj[2]).toBeLessThan(WHEEL.r); expect(L.upper.bj[2]).toBeGreaterThan(WHEEL.r);
        expect(dist(L.upper.bj, [L.upper.bj[0], L.upper.f[1], L.upper.f[2]])).toBeLessThan(dist(L.lower.bj, [L.lower.bj[0], L.lower.f[1], L.lower.f[2]]));
        expect(L.lower.f[1]).toBeLessThan(L.lower.bj[1] - 250); expect(L.lower.f[0]).toBeLessThan(L.lower.r[0]);
        expect(L.dampers.length).toBeGreaterThanOrEqual(1); expect(L.bar).toBeTruthy(); } }
    // the EB110's pair of coil-overs a side at the rear, either side of the driveshaft
    const eb = axlePoints(SUSPENSION.eb110!.rear, WHEEL, false)[0]; expect(eb.dampers.length).toBe(2); expect(eb.dampers[0]!.bot[0]).toBeLessThan(WHEEL.x - 50); expect(eb.dampers[1]!.bot[0]).toBeGreaterThan(WHEEL.x + 50);
  });
  it('the other kinds are named and not built yet', () => { for (const type of ['macpherson', 'multilink', 'beamLeaf'] as const) expect(() => axlePoints({ type }, WHEEL, true)).toThrow(/not built yet/); });
});

describe('suspension: the linkage', () => {
  it('reaches the hub at every travel within the stops (and the ride heights a design may set), the arms and links keeping their lengths', () => {
    for (const [id] of BASES) { const A = car(id), rig = A.mesh.susp!; expect(rig.corners.length).toBe(4); const ride = BODY_LIMITS(id as 'nsx').ride;
      rig.corners.forEach(H => { const L0 = lengths(H, solve(H, 0));
        for (let z = -ride[1] - TRAVEL.droop; z <= -ride[0] + TRAVEL.bump + 0.01; z += 12.5) for (const st of H.steer.rack ? [-0.55, -0.2, 0, 0.3, 0.55] : [0]) { const P = solve(H, z, st), tag = `${id} ${H.front ? 'front' : 'rear'} z ${z} steer ${st}`;
          expect(P.ok, tag).toBe(true); expect(Math.abs(P.wc[2] - H.wc[2] - z), tag).toBeLessThan(0.06); if (H.steer.rack) expect(Math.abs(steerOf(P.R) - st), tag).toBeLessThan(2e-4);
          lengths(H, P).forEach((l, k) => expect(Math.abs(l - L0[k]!), `${tag} length ${k}`).toBeLessThan(1e-6 * L0[k]! + 1e-6));
          for (const v of [...P.wc, ...P.lbj, ...P.ubj, ...P.outer, P.theta, P.phi, P.rack]) expect(Number.isFinite(v), tag).toBe(true);
          // the wheel stays near upright and near its own track: a wishbone's small camber gain, no wild toe at the rear
          expect(Math.abs(camberOf(P.R)), tag).toBeLessThan(0.2); expect(Math.abs(P.wc[1] - H.wc[1]), tag).toBeLessThan(45); if (!H.steer.rack) expect(Math.abs(steerOf(P.R)), tag).toBeLessThan(0.02);
          const B = barAt(H, P)!; expect(Math.abs(dist(B.end, B.link) - dist(H.bar!.end, H.bar!.link)), tag).toBeLessThan(1e-6); } }); }
  });
  it('gains negative camber as the wheel rises (the shorter upper arm) and keeps its toe within a quarter of a degree through the travel', () => {
    for (const [id] of BASES) for (const H of car(id).mesh.susp!.corners) { const up = solve(H, 60), dn = solve(H, -60);
      // camber: the top toward +y positive, so a rising wheel on the +y side leans its top in (negative)
      expect(camberOf(up.R) * H.side, id).toBeLessThan(camberOf(dn.R) * H.side - 0.01); expect(Math.abs(steerOf(up.R) - steerOf(dn.R)), id).toBeLessThan(0.0045 * 2); }
  });
  it('every bone is a rigid map but the spring, which only shortens along its own line; the disc turns with the wheel and the caliper does not', () => {
    const H = car('f355').mesh.susp!.corners[0]!, P = solve(H, 70, 0.3), B = bones(H, P, 0), S = bones(H, P, 1.1); expect(B.length).toBe(NB);
    B.forEach((m, k) => { const d = m[0]! * (m[5]! * m[10]! - m[6]! * m[9]!) - m[1]! * (m[4]! * m[10]! - m[6]! * m[8]!) + m[2]! * (m[4]! * m[9]! - m[5]! * m[8]!);
      if (k === 7) { expect(d).toBeGreaterThan(0.4); expect(d).toBeLessThan(0.98); } else expect(Math.abs(d - 1), `bone ${k}`).toBeLessThan(1e-9); });
    // the joints meet: the lower arm's and the upright's bones carry the lower ball joint to the same place, the upper too, the tie rod's end
    expect(dist(affPt(B[0]!, H.lower.bj), affPt(B[2]!, H.lower.bj))).toBeLessThan(1e-6); expect(dist(affPt(B[1]!, H.upper.bj), affPt(B[2]!, H.upper.bj))).toBeLessThan(1e-6); expect(dist(affPt(B[4]!, H.steer.outer), affPt(B[2]!, H.steer.outer))).toBeLessThan(1e-6);
    // the damper's body follows the arm's foot, its rod stays on the top mount, the spring's ends stay on their seats
    const D = H.dampers[0]!; expect(dist(affPt(B[5]!, D.bot), affPt(B[0]!, D.bot))).toBeLessThan(1e-6); expect(dist(affPt(B[6]!, D.top), D.top)).toBeLessThan(1e-6);
    const u: V = [(D.top[0] - D.bot[0]) / dist(D.top, D.bot), (D.top[1] - D.bot[1]) / dist(D.top, D.bot), (D.top[2] - D.bot[2]) / dist(D.top, D.bot)], at = (k: number): V => [D.bot[0] + u[0] * k, D.bot[1] + u[1] * k, D.bot[2] + u[2] * k], L = dist(D.top, D.bot);
    expect(dist(affPt(B[7]!, at(D.seat[0])), affPt(B[5]!, at(D.seat[0])))).toBeLessThan(1e-6); expect(dist(affPt(B[7]!, at(L - D.seat[1])), affPt(B[6]!, at(L - D.seat[1])))).toBeLessThan(1e-6);
    // spin: only the disc's bone changes; a point on the disc's rim goes round the axle
    S.forEach((m, k) => { const same = m.every((v, i) => Math.abs(v - B[k]![i]!) < 1e-12); expect(same, `bone ${k}`).toBe(k !== 3); });
    const rimPt: V = [H.wc[0] + 100, H.wc[1], H.wc[2]]; expect(dist(affPt(S[3]!, rimPt), affPt(B[3]!, rimPt))).toBeGreaterThan(80); expect(dist(affPt(S[3]!, H.wc), affPt(B[3]!, H.wc))).toBeLessThan(1e-9);
  });
});

describe('suspension: the parts in the car', () => {
  it('are all there by name, no number missing, within the budget (the whole car about 16,000 at full detail), and no wheel takes them for its own', () => {
    for (const [id, d] of BASES) { const A = car(id), M = A.mesh, su = A.panels.indexOf('suspension'), N = M.names!; let n = 0; const seen = new Set<string>();
      for (let t = 0; t < M.n; t++) if (A.panelOf[t] === su) { n++; seen.add(N[M.part[t]!]!); expect(isSuspPart(N[M.part[t]!]!)).toBe(true); }
      for (const nm of NAMES) expect(seen.has(nm), `${id} ${nm}`).toBe(true);
      expect(n, id).toBeGreaterThan(1800); expect(n, id).toBeLessThanOrEqual(3000); expect(M.n, id).toBeLessThanOrEqual(16600);
      for (let i = 0; i < M.pos.length; i++) if (!Number.isFinite(M.pos[i]!)) throw new Error(`${id}: a missing number in the mesh`);
      const W = wheelsOf(M); expect(W.length).toBe(4); for (const w of W) for (const t of w.tris) expect(isSuspPart(N[M.part[t]!]!), `${id}: ${N[M.part[t]!]} turns with a wheel`).toBe(false);
      // the lighter details for the drive
      const n1 = build(d, 1), n0 = build(d, 0), count = (B: Assembled) => B.panelOf.reduce((a, p) => a + (B.panels[p] === 'suspension' ? 1 : 0), 0);
      expect(count(n1)).toBeLessThanOrEqual(1600); expect(count(n0)).toBeLessThanOrEqual(520); expect(count(n0)).toBeGreaterThan(200); }
  });
  it('the rig poses: at rest every bone leaves the mesh as built; no number goes missing through the bounce', () => {
    for (const [id] of BASES) { const rig = car(id).mesh.susp!, P = poseRig(rig); expect(P.bones.length).toBe(RIG_BONES * 12);
      for (let b = 0; b < RIG_BONES; b++) [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0].forEach((v, i) => expect(Math.abs(P.bones[b * 12 + i]! - v), `${id} bone ${b}`).toBeLessThan(i % 4 === 3 ? 2e-3 : 1e-5));
      P.wheels.forEach((w, k) => { expect(dist(w.wc, w.from)).toBeLessThan(0.06); expect(dist(w.wc, rig.corners[k]!.wc) ).toBeLessThan(0.06); });
      for (let t = 0; t < 12; t += 0.37) { const b = bounce(t), Q = poseRig(rig, b.travel.map(v => v * 1000), b.steerL, b.steerR, b.spin); for (const v of Q.bones) expect(Number.isFinite(v)).toBe(true); for (const c of Q.corners) expect(c.ok).toBe(true); } }
  });
  it('a body raised or lowered over its wheels keeps the wheels on the ground and hangs them on the arms', () => {
    for (const [id, d] of BASES) for (const ride of BODY_LIMITS(id as 'nsx').ride) { const A = build(applyPatch(d, { body: { ride } })), rig = A.mesh.susp!, base = car(id).mesh.susp!;
      rig.corners.forEach((H, k) => { const S = poseRig(rig).wheels[k]!; expect(Math.abs(S.wc[2] - H.wheel.r), `${id} ride ${ride}`).toBeLessThan(0.06); expect(H.lower.f[2] - base.corners[k]!.lower.f[2]).toBeCloseTo(ride, 6); }); }
  });
  it('the builder\'s view keeps the suspension, the powertrain, the tyres and the rims, and takes the body off', () => {
    const M = designMesh(DESIGN_NSX), B = bareMesh(M), names = new Set(Array.from({ length: B.n }, (_, t) => B.names![B.part[t]!]!));
    for (const n of ['wishboneLower', 'spring', 'brakeDisc', 'engineBlock', 'gearbox', 'tyreF', 'rim']) expect(names.has(n), n).toBe(true);
    for (const n of ['hood', 'door', 'canopy', 'wheel', 'hub', 'seat']) expect(names.has(n), n).toBe(false); expect(B.susp).toBe(M.susp); expect(bareMesh(M)).toBe(B);
  });
});

describe('suspension: nothing pokes out', () => {
  /** the body's skin over a point of the plan: the highest shell triangle whose box holds it */
  const roof = (A: Assembled, x: number, y: number): number => { const M = A.mesh, sh = 0; let z = -Infinity;
    for (let t = 0; t < M.n; t++) { if (A.role[t] !== sh) continue; const q = t * 9, p = M.pos; if (Math.min(p[q]!, p[q + 3]!, p[q + 6]!) > x + 30 || Math.max(p[q]!, p[q + 3]!, p[q + 6]!) < x - 30 || Math.min(p[q + 1]!, p[q + 4]!, p[q + 7]!) > y + 30 || Math.max(p[q + 1]!, p[q + 4]!, p[q + 7]!) < y - 30) continue; z = Math.max(z, p[q + 2]!, p[q + 5]!, p[q + 8]!); }
    return z; };
  it('at full droop, at rest and at full bump the parts stay inside the wheel, the well and the body', () => {
    for (const [id] of BASES) { const A = car(id), M0 = A.mesh, rig = M0.susp!, su = A.panels.indexOf('suspension'), N = M0.names!, arch = A.lines.arches;
      for (const tr of [-TRAVEL.droop, 0, TRAVEL.bump]) { const P = poseRig(rig, [tr, tr, tr, tr], 0, 0), M = poseMesh(M0, P);
        for (let t = 0; t < M.n; t++) { if (A.panelOf[t] !== su) continue; const nm = N[M.part[t]!]!;
          for (let k = 0; k < 3; k++) { const q = t * 9 + k * 3, x = M.pos[q]!, y = M.pos[q + 1]!, z = M.pos[q + 2]!, c = (x < rig.midX ? 0 : 2) + (y > 0 ? 0 : 1), H = rig.corners[c]!, w = H.wheel, wc = P.wheels[c]!.wc, tag = `${id} ${nm} at travel ${tr}`, a = H.front ? arch.f : arch.r;
            // inside the tyre's outer wall, above the tyre's foot, off the ground at rest
            expect(Math.abs(y), tag).toBeLessThan(w.y + w.w / 2); expect(z, tag).toBeGreaterThan(wc[2] - w.r + 30); if (tr === 0) expect(z, tag).toBeGreaterThan(95);
            // what stands in the tyre's width is inside the rim (and the brake clear of the barrel)
            if (Math.abs(y) > w.y - w.w / 2) expect(Math.hypot(x - wc[0], z - wc[2]), tag).toBeLessThan(nm === 'brakeDisc' || nm === 'caliper' ? w.rim - 12 : w.rim - 2);
            // what stands in the well is inside the arch's round (the body's wing is beyond it)
            if (Math.abs(y) > a.yin + 5 && z > a.z) expect(Math.hypot(x - a.x, z - a.z), tag).toBeLessThan(a.r - 4); } } }
      // the top mounts under the body's skin
      for (const H of rig.corners) for (const D of H.dampers) expect(roof(A, D.top[0], D.top[1]), `${id} top mount`).toBeGreaterThan(D.top[2] + 25); }
  });
  it('the coil-over clears the upper arm\'s legs and the driveshaft, the brake stays between the wheel\'s back and its face', () => {
    const seg = (p: V, a: V, b: V) => { const ab: V = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2))); return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]); };
    for (const [id] of BASES) for (const H of car(id).mesh.susp!.corners) for (const tr of [-TRAVEL.droop, 0, TRAVEL.bump]) { const P = solve(H, tr), B = bones(H, P);
      for (const D of H.dampers) { const bot = affPt(B[0]!, D.bot), L = dist(D.top, bot);
        for (let k = 0; k <= 20; k++) { const p: V = [bot[0] + (D.top[0] - bot[0]) * k / 20, bot[1] + (D.top[1] - bot[1]) * k / 20, bot[2] + (D.top[2] - bot[2]) * k / 20], along = L * k / 20, r = along > D.seat[0] - 12 && along < L - D.seat[1] + 12 ? D.spring[0] + D.spring[1] : D.body;
          for (const leg of [H.upper.f, H.upper.r]) expect(seg(p, leg, P.ubj), `${id} ${H.front ? 'front' : 'rear'} travel ${tr}: the coil-over and the upper arm`).toBeGreaterThan(r + 9 + 2);
          // the driveshaft: along the axle's line at the hub's height (a driven axle's; kept clear at both ends all the same)
          if (D.bot[0] !== H.wc[0]) expect(Math.hypot(p[0] - H.wc[0], p[2] - P.wc[2]), `${id} travel ${tr}: the coil-over and the driveshaft`).toBeGreaterThan(r + 16); } } }
  });
});
