// The kinematic suspension for the physics (docs/systems/102, M4): a car built from a base of the kit carries its
// suspension's makings (RaceSpec.kin: render/car/suspension/setup.ts), and the vehicle (race/vehicle.ts) reads each
// wheel's camber, toe, path, spring and its share of the forces at the road from the tables of its own linkage
// (render/car/suspension/tables.ts) instead of the rules it had before (a wishbone's camber gain of half the rise, a
// roll centre fixed 0.1 m up, no bump steer, the spring at the wheel). The switch: a spec's own `physics` ('old' keeps
// the rules), else the developers' setting (PHYSICS.kinematic, the settings' 개발자 · 기구학 물리).
import type { RaceSpec } from './cars';
import type { SuspDesign, SuspAxle } from '../core/design';
import type { DesignSusp } from '../render/car/suspension/setup';
import { rigCorners, frontToe } from '../render/car/suspension/setup';
import { cornerTable, lookup, steerCamber, rollCentre, antiGeometry, type CornerTable } from '../render/car/suspension/tables';
import type { Hardpoints } from '../render/car/suspension/hardpoints';
import { kitCarSusp } from '../render/car/designsusp';

/** what a spec carries: its suspension's makings, and which physics drives it ('old': the rules before alpha 0.13) */
export type KinSpec = DesignSusp & { physics?: 'kinematic' | 'old' };
/** the developers' switch: the kinematic physics for every car that has a rig (on: the regression passed, docs/systems/102 2-3) */
export const PHYSICS = { kinematic: true };

/** an axle's corners as the physics reads them, and its settings */
export interface KinAxle { tables: [CornerTable, CornerTable] | null; set: SuspAxle; /** the motion ratio at the static ride, each side */ mr0: [number, number] }
export interface KinRig { front: KinAxle; rear: KinAxle; corners: (Hardpoints | null)[];
  /** the side view's shares (%) and the roll centres at the static ride (mm over the ground) */ anti: { dive: number; lift: number; squat: number }; rc: { front: number; rear: number } }

/** a car's makings: its own, or a kit's own car's (the NSX, the F355, the EB110 as registered); null for the period's cars */
export function kinOf(s: RaceSpec): KinSpec | null { return s.kin ?? (s.era && /^199/.test(s.era) ? kitCarSusp(s.body ?? s.id) : null); }
/** whether a spec drives on its kinematic rig */
export function kinOn(s: RaceSpec): boolean { const K = kinOf(s); return !!K && (K.physics ?? s.kin?.physics ?? (PHYSICS.kinematic ? 'kinematic' : 'old')) === 'kinematic'; }

const rigs = new WeakMap<object, KinRig>();
/** the tables of a car's four corners at its static ride (cached on its makings) */
export function kinRig(K: KinSpec, cgH = 0.44, L = 2.5, fDrive = 0): KinRig {
  const had = rigs.get(K); if (had) return had;
  const set: SuspDesign = K.setup, beamF = set.front.type === 'beamLeaf', beamR = set.rear.type === 'beamLeaf';
  // a beam axle on leaves is the old physics' own (its tables are the restoration work's): its corners are not built
  const S = { ...K.spec, front: beamF ? K.spec.rear : K.spec.front, rear: beamR ? K.spec.front : K.spec.rear }, all = rigCorners(S, K.wheels, set, K.ride);
  const corners: (Hardpoints | null)[] = all.map((H, k) => (k < 2 ? beamF : beamR) ? null : H);
  const tab = (k: number) => { const H = corners[k]; return H ? cornerTable(H, -K.ride, H.steer.rack ? frontToe(H.side, set.front.toe) : 0) : null; };
  const T = [0, 1, 2, 3].map(tab), ax = (a: number, s: SuspAxle): KinAxle => { const L0 = T[a * 2], R0 = T[a * 2 + 1], t = L0 && R0 ? [L0, R0] as [CornerTable, CornerTable] : null;
    return { tables: t, set: s, mr0: t ? [mr(t[0], 0), mr(t[1], 0)] : [1, 1] }; };
  const front = ax(0, set.front), rear = ax(1, set.rear), z = (A: KinAxle) => A.tables ? rollCentre(A.tables[0], A.tables[1], 0, 0).z : 0;
  const anti = front.tables && rear.tables ? antiGeometry(front.tables[0], rear.tables[0], cgH * 1000, L * 1000, 0.58, fDrive) : { dive: 0, lift: 0, squat: 0 };
  const out: KinRig = { front, rear, corners, anti: { dive: anti.dive, lift: anti.lift, squat: anti.squat }, rc: { front: z(front), rear: z(rear) } };
  rigs.set(K, out); return out; }

// ---- what the vehicle reads, at a wheel's travel t (m from its static ride) ----
const mm = (t: number) => t * 1000;
/** the wheel's camber against the body (rad, - the top in), with its steer's change (st: rad, the wheel's front to the left) */
export const camberAt = (T: CornerTable, t: number, st = 0) => lookup(T, T.camber, mm(t)) + (T.steerCam ? steerCamber(T, st - T.steer) : 0);
/** the wheel's toe against the body (rad, + in): its static toe and its bump steer */
export const toeAt = (T: CornerTable, t: number) => lookup(T, T.toe, mm(t));
/** the wheel's centre moved back along the car and outward (m) */
export const pathAt = (T: CornerTable, t: number): [number, number] => [lookup(T, T.dx, mm(t)) / 1000, lookup(T, T.dy, mm(t)) / 1000];
/** the spring's compression from the static ride (m) and its motion ratio */
export const springAt = (T: CornerTable, t: number): [number, number] => [lookup(T, T.spring, mm(t)) / 1000, Math.max(0.05, lookup(T, T.mr, mm(t)))];
export const mr = (T: CornerTable, t: number) => Math.max(0.05, lookup(T, T.mr, mm(t)));
/** the contact point's (and the wheel centre's) moves for each metre the wheel rises: outward, back */
export const jackAt = (T: CornerTable, t: number): [number, number, number] => [lookup(T, T.jy, mm(t)), lookup(T, T.jx, mm(t)), lookup(T, T.jxW, mm(t))];
