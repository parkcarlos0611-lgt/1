// The parts builder's studio floor for the live renderer (docs/systems/98, B3): a wide floor of dark painted concrete,
// a turntable a shade lighter in its middle with a dark rim, and a few rings and spokes marked on it (the floor stands; the car turns on it).
// The same vertex layout as the track's ground (render/live/ground.ts): position, colour, a flag (0: no grass speckle),
// and no place on a track (all zeros: not the concrete the track's shader paints).
import type { GroundData } from './ground';

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** the floor (half its side, m) and the turntable's radius (m) */
export function studioFloor(half = 120, R = 3.4): GroundData {
  const P: number[] = [], C: number[] = [];
  const tri = (a: number[], b: number[], c: number[], col: number[]) => { P.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) C.push(...col); };
  const floor = hex('#4a4844'), deck = hex('#6f6b64'), rim = hex('#26241f'), line = hex('#5d5a54');
  tri([-half, -half, -0.012], [half, -half, -0.012], [half, half, -0.012], floor); tri([-half, -half, -0.012], [half, half, -0.012], [-half, half, -0.012], floor);
  const N = 96, at = (r: number, k: number, z: number) => [r * Math.cos(k / N * Math.PI * 2), r * Math.sin(k / N * Math.PI * 2), z];
  const ring = (r0: number, r1: number, z: number, col: number[]) => { for (let k = 0; k < N; k++) { tri(at(r0, k, z), at(r1, k, z), at(r1, k + 1, z), col); tri(at(r0, k, z), at(r1, k + 1, z), at(r0, k + 1, z), col); } };
  ring(R, R + 0.12, -0.006, rim); ring(0, R, -0.004, deck);
  for (const r of [1.2, 2.3]) ring(r, r + 0.025, -0.002, line);
  for (let s = 0; s < 8; s++) { const a = s / 8 * Math.PI * 2, c = Math.cos(a), si = Math.sin(a), w = 0.012, p = (r: number, o: number) => [r * c - o * si, r * si + o * c, -0.002];
    tri(p(0.3, -w), p(R - 0.05, -w), p(R - 0.05, w), line); tri(p(0.3, -w), p(R - 0.05, w), p(0.3, w), line); }
  const n = P.length / 3; return { pos: new Float32Array(P), col: new Uint8Array(C), flag: new Float32Array(n), n, trk: new Float32Array(n * 3) }; }
