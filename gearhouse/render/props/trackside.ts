// The circuit's edge as placeholder meshes in the drift look (docs/systems/111 T1; their final shapes are T2's): simple
// boxes and bars, outlined and shaded in two bands by the renderer. Each piece `arg` mm long along x from 0, its face
// toward the road on -y. A concrete wall painted white and red in 2 m blocks; a steel guardrail (a grey beam on posts);
// a wall of tyres stacked three high, black with a white and blue band; the catch fence: posts every 3 m, a top and a
// bottom rail, wires between (the chain-link's textured panel is T2's).
import { Build, type Mesh } from '../car/mesh';

const WHITE = '#ecebe6', RED = '#c8302e', GREY = '#9aa0a4', DARK = '#5f6468', BLACK = '#26272a', BLUE = '#2f6fc0';
/** a concrete wall `arg` mm long: 1.0 m high, 0.4 m thick, in 2 m blocks painted white and red by turns */
export function edgeWall(arg = 6000): Mesh { const b = new Build(), L = Math.max(300, arg), n = Math.max(1, Math.round(L / 2000));
  for (let k = 0; k < n; k++) b.mat(k % 2 ? RED : WHITE, 0.15, 'paint').box(k * L / n, (k + 1) * L / n, -200, 200, -150, 1000); return b.mesh(L); }
/** a steel guardrail `arg` mm long: a beam 0.3 m deep at 0.45-0.75 m, a post every 2 m behind it */
export function edgeRail(arg = 6000): Mesh { const b = new Build(), L = Math.max(300, arg), n = Math.max(1, Math.round(L / 2000));
  b.mat(DARK, 0.3, 'metal'); for (let k = 0; k <= n; k++) { const x = Math.min(L - 60, Math.max(60, k * L / n)); b.box(x - 60, x + 60, 40, 160, -150, 700); }
  b.mat(GREY, 0.5, 'metal').box(0, L, -80, 40, 450, 750); return b.mesh(L); }
/** tyres stacked three high `arg` mm long (0.6 m tyres, 0.7 m deep): black, the middle tyre of each stack white and blue by turns */
export function edgeTyres(arg = 6000): Mesh { const b = new Build(), L = Math.max(300, arg), n = Math.max(1, Math.round(L / 620)), w = L / n;
  for (let k = 0; k < n; k++) { const x = k * w + w / 2; for (let up = 0; up < 3; up++) { b.mat(up === 1 ? (k % 2 ? BLUE : WHITE) : BLACK, 0.1, up === 1 ? 'paint' : 'tyre');
    const ring = (z: number) => Array.from({ length: 8 }, (_, i) => [x + Math.cos(i * Math.PI / 4) * 300, Math.sin(i * Math.PI / 4) * 300, z] as [number, number, number]); b.loft([ring(up * 300), ring(up * 300 + 290)]); } }
  return b.mesh(L); }
/** the catch fence `arg` mm long: 3.6 m high, posts every 3 m, top, middle and bottom rails, four wires between */
export function edgeFence(arg = 6000): Mesh { const b = new Build(), L = Math.max(300, arg), n = Math.max(1, Math.round(L / 3000)), H = 3600;
  b.mat(GREY, 0.4, 'metal'); for (let k = 0; k <= n; k++) { const x = k * L / n; b.bar([x, 0, 0], [x, 0, H], 80, 80); }
  for (const z of [100, H / 2, H]) b.bar([0, 0, z], [L, 0, z], 50, 50);
  b.mat(DARK, 0.3, 'metal'); for (const z of [500, 1200, 2400, 3000]) b.bar([0, 0, z], [L, 0, z], 18, 18); return b.mesh(L); }
