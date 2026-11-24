// The suspension as parts that move (docs/systems/101, M3): each corner's arms, upright, coil-over, anti-roll bar, tie
// rod and brake, built from its hardpoints (hardpoints.ts: a base's axles; a double wishbone on the three kit bases)
// and set in a car at its static ride. The car's mesh carries the rig (Mesh.susp); a pose of the rig (poseRig: each
// wheel's travel, the front wheels' steer, the wheels' spin) gives every part's bone as a rigid map and each wheel's
// place and lean, so the renderer draws the linkage working: the arms turn about their chassis pivots to where the
// upright stands, the coil shortens, the bar twists, the upright steers on its ball joints, the disc turns in the
// caliper. The linkage is solved (kinematics.ts), not faked: M4's physics reads the same hardpoints.
import type { Build, Mesh } from '../mesh';
import { wheelsOf } from '../mesh';
import { Geo, type Bounds } from '../powertrain/geo';
import { axlePoints, movePoints, type Hardpoints, type SuspSpec, type SuspWheel } from './hardpoints';
import { AFF_ID, NB, affInv, affMul, affPt, bones, m3m, m3t, m3v, solve, sub, type Aff, type M3, type Pose, type V } from './kinematics';
import { axleParts, cornerParts, type Detail } from './parts';
import { PART_BONE } from './names';

export type { Hardpoints, SuspSpec, SuspWheel, SuspType, AxleSpec, WishboneSpec } from './hardpoints';
export { SUSPENSION, TRAVEL, axlePoints, wishbonePoints } from './hardpoints';
export { solve, forward, bones, barAt, steerOf, camberOf, BONES, NB } from './kinematics';
export { PART_BONE, isSuspPart, WHEEL_FACE } from './names';
export type { Detail } from './parts';

/** a car's suspension as its mesh carries it: the four corners' hardpoints in the car's frame (+y front, -y front, +y rear,
 *  -y rear: the renderer's order), each wheel's centre at the static ride over the hardpoints' own pose (mm), each
 *  corner's bones at the static ride undone (the mesh is drawn there), the station between the axles */
export interface SuspRig { corners: Hardpoints[]; ride: number[]; undo: Aff[][]; midX: number; /** the names of the chassis' other parts in the mesh (the powertrain's): what stays when the body is taken off */ chassis?: string[] }
/** the bones of a rig: one that stands still, then each corner's */
export const RIG_BONES = 1 + 4 * NB;
export interface SuspBuilt { rig: SuspRig; tris: number; parts: Map<string, Bounds> }

/** the suspension built into a car's mesh at its static ride: `ride` how far the body is raised over its wheels from the
 *  base's own height (the wheels then hang that much lower on their arms) */
export function addSuspension(b: Build, spec: SuspSpec, wheels: { f: SuspWheel; r: SuspWheel }, opts: { detail?: Detail; ride?: number } = {}): SuspBuilt {
  const det = opts.detail ?? 2, ride = opts.ride ?? 0, g = new Geo(), corners: Hardpoints[] = [], undo: Aff[][] = [];
  for (const front of [true, false]) { const [L, R] = axlePoints(front ? spec.front : spec.rear, front ? wheels.f : wheels.r, front);
    for (const H of [L, R]) { const P = solve(H, -ride), at = bones(H, P); if (!P.ok) throw new Error(`suspension: the ${front ? 'front' : 'rear'} linkage does not reach its static ride`);
      cornerParts(g, H, spec.look, det, at); corners.push(H); undo.push(at.map(affInv)); }
    axleParts(g, L, R, det); }
  const parts = g.emit(b);
  return { rig: { corners, ride: corners.map(() => -ride), undo, midX: (wheels.f.x + wheels.r.x) / 2 }, tris: g.count(), parts };
}
/** the rig moved whole with the mesh it stands in */
export function moveRig(r: SuspRig, d: V): SuspRig { const to: Aff = [1, 0, 0, d[0], 0, 1, 0, d[1], 0, 0, 1, d[2]], back: Aff = [1, 0, 0, -d[0], 0, 1, 0, -d[1], 0, 0, 1, -d[2]];
  return { ...r, corners: r.corners.map(H => movePoints(H, d)), undo: r.undo.map(u => u.map(a => affMul(to, affMul(a, back)))), midX: r.midX + d[0] }; }

/** the bone a triangle of a suspension part hangs on: 0 the still one, else 1 + corner * NB + its bone; -1: not the suspension's */
export function boneAt(rig: SuspRig, name: string, cx: number, cy: number): number { const k = PART_BONE[name]; if (k === undefined) return -1; if (k < 0) return 0;
  return 1 + ((cx < rig.midX ? 0 : 2) + (cy > 0 ? 0 : 1)) * NB + k; }

/** a rig posed: every bone's map from the mesh as built (three rows of four each, the still bone first), each wheel's
 *  centre and its turn from the static ride, the corners as solved */
export interface RigPose { bones: Float32Array; wheels: { wc: V; R: M3; from: V }[]; corners: Pose[] }
/** the rig with each wheel `travel` mm above its static ride (within the stops), the front wheels steered (rad, the
 *  renderer's way: the +y one, the -y one), every wheel turned `spin` on its axle */
export function poseRig(rig: SuspRig, travel: ArrayLike<number> = [0, 0, 0, 0], steerL = 0, steerR = 0, spin = 0): RigPose {
  const out = new Float32Array(RIG_BONES * 12), wheels: RigPose['wheels'] = [], poses: Pose[] = []; out.set(AFF_ID, 0);
  rig.corners.forEach((H, k) => { const t = Math.max(-H.travel.droop, Math.min(H.travel.bump, travel[k] ?? 0)), st = H.steer.rack ? (k % 2 === 0 ? steerL : steerR) : 0;
    const S = staticPose(rig, k), P = solve(H, rig.ride[k]! + t, st), B = bones(H, P, spin), U = rig.undo[k]!;
    for (let j = 0; j < NB; j++) out.set(affMul(B[j]!, U[j]!), (1 + k * NB + j) * 12);
    wheels.push({ wc: P.wc, R: m3m(P.R, m3t(S.R)), from: S.wc }); poses.push(P); });
  return { bones: out, wheels, corners: poses }; }
const statics = new WeakMap<SuspRig, Pose[]>();
function staticPose(rig: SuspRig, k: number): Pose { let S = statics.get(rig); if (!S) { S = rig.corners.map((H, i) => solve(H, rig.ride[i]!)); statics.set(rig, S); } return S[k]!; }

/** the mesh with its suspension and its wheels in a pose (for pictures and checks; the live renderer does this on the GPU) */
export function poseMesh(M: Mesh, pose: RigPose): Mesh { const rig = M.susp; if (!rig) return M; const pos = Float32Array.from(M.pos), N = M.names ?? [], inWheel = new Int8Array(M.n).fill(-1);
  for (const w of wheelsOf(M)) { const k = (w.hx < rig.midX ? 0 : 2) + (w.hy > 0 ? 0 : 1); for (const t of w.tris) inWheel[t] = k; }
  for (let t = 0; t < M.n; t++) { const q = t * 9; let f: ((p: V) => V) | null = null;
    if (inWheel[t]! >= 0) { const W = pose.wheels[inWheel[t]!]!; f = p => { const v = m3v(W.R, sub(p, W.from)); return [W.wc[0] + v[0], W.wc[1] + v[1], W.wc[2] + v[2]]; }; }
    else { const b = boneAt(rig, N[M.part[t]!] ?? '', (pos[q]! + pos[q + 3]! + pos[q + 6]!) / 3, (pos[q + 1]! + pos[q + 4]! + pos[q + 7]!) / 3); if (b > 0) { const A = Array.from(pose.bones.subarray(b * 12, b * 12 + 12)); f = p => affPt(A, p); } }
    if (f) for (let k = 0; k < 3; k++) { const p = f([pos[q + k * 3]!, pos[q + k * 3 + 1]!, pos[q + k * 3 + 2]!]); pos[q + k * 3] = p[0]; pos[q + k * 3 + 1] = p[1]; pos[q + k * 3 + 2] = p[2]; } }
  return { ...M, pos }; }
