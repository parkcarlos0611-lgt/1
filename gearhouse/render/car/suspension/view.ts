// The builder's suspension view (docs/systems/101, M3): the car with its body taken off and its wheels' faces too, so the
// arms, the coil-overs, the brakes and the powertrain show; and a slow bounce that takes each wheel through its travel
// and the front wheels from lock to lock, so the linkage is seen working.
import type { Mesh } from '../mesh';
import { isSuspPart } from './names';

const bares = new WeakMap<Mesh, Mesh>();
/** the mesh with only its chassis: the suspension, the powertrain (the rig's `chassis` names), the tyres and the rims */
export function bareMesh(M: Mesh): Mesh { const have = bares.get(M); if (have) return have; const rig = M.susp; if (!rig) return M;
  const N = M.names ?? [], own = new Set(rig.chassis ?? []), keep: number[] = [];
  for (let t = 0; t < M.n; t++) { const n = N[M.part[t]!] ?? ''; if (isSuspPart(n) || own.has(n) || /^(tyre|rim)/.test(n)) keep.push(t); }
  const pick = <A extends Float32Array | Uint8Array | Int16Array>(a: A, w: number, make: (n: number) => A): A => { const o = make(keep.length * w); keep.forEach((t, i) => o.set(a.subarray(t * w, t * w + w), i * w)); return o; };
  const B: Mesh = { ...M, decals: [], n: keep.length, pos: pick(M.pos, 9, n => new Float32Array(n)), col: pick(M.col, 3, n => new Uint8Array(n)), gloss: pick(M.gloss, 1, n => new Float32Array(n)),
    part: pick(M.part, 1, n => new Int16Array(n)), kind: pick(M.kind, 1, n => new Uint8Array(n)), tex: pick(M.tex, 1, n => new Uint8Array(n)) };
  bares.set(M, B); return B; }

/** the demo's pose at time t (s): each wheel's travel (m: the two axles a quarter turn apart, a little roll between the
 *  sides), the front wheels' steer swinging slowly, the wheels turning */
export function bounce(t: number): { travel: number[]; steerL: number; steerR: number; spin: number } {
  const a = t * 1.5, up = (ph: number) => -0.012 + 0.062 * Math.sin(a + ph), st = 0.3 * Math.sin(t * 0.55);
  return { travel: [up(0), up(0.9), up(1.6), up(2.5)], steerL: st * (st > 0 ? 1.08 : 0.93), steerR: st * (st > 0 ? 0.93 : 1.08), spin: t * 1.2 }; }
