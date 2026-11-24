// The 959's body shell (docs/systems/109): the control cage (cage.ts) subdivided once (subdiv.ts), then finished by
// hand-set operations on its loops: the wheel arches trued to their circles and given a lip and a well, the sockets
// sunk (head lamps, tail lamp bar, side intakes), the underside closed. The result is one closed surface of quads and
// a few triangles, every face tagged with its region (the shell itself or a module hung on a boundary loop), material
// and panel; with it the drawn lines, the hard creases (split shading) and the modules' boundary loops, as points.
import { buildCage, ARCH, DIM, type Cage959, type Tag } from './cage';
import { cornerNormals, ekey, faceNormal, subdivide, type Fine, type V } from './subdiv';

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]), unit = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export interface ShellLine { kind: Cage959['lines'][number]['kind']; name: string; pts: V[]; closed?: boolean; w?: number }
export interface Shell959 { P: V[]; F: number[][]; tag: Tag[]; /** shading normals per face corner */ N: V[][]; /** edges whose shading is split, as point pairs */ crease: Set<string>;
  lines: ShellLine[]; /** the modules' boundary loops (the points a replacement must meet), left side; mirror y for the right */ loops: Record<string, V[]>;
  cage: Cage959; fine: Fine; /** how many of the faces came from the subdivision (the rest are lips, wells, socket walls, the floor) */ nSub: number }

/** the fine points along a path of cage points */
function finePath(c: Cage959, f: Fine, path: number[], closed = false): number[] { const out: number[] = []; const n = path.length;
  for (let q = 0; q < n; q++) { out.push(f.vp[path[q]!]!); if (q + 1 < n || closed) out.push(f.ep.get(ekey(path[q]!, path[(q + 1) % n]!))!); } return out; }

export interface ShellOpts { /** leave the sockets flush (no recess) */ flush?: boolean }
export function buildShell(o: ShellOpts = {}): Shell959 {
  const cage = buildCage(), fine = subdivide(cage), P = fine.P, F: number[][] = fine.F.map(q => q.slice()), tag: Tag[] = fine.parent.map(k => cage.tag[k]!), nSub = F.length;
  const crease = new Set<string>(); for (const key of cage.crease) { const [a, b] = key.split('|').map(Number) as [number, number], m = fine.ep.get(key)!; crease.add(ekey(fine.vp[a]!, m)); crease.add(ekey(m, fine.vp[b]!)); }
  const pt = (p: V) => P.push(p) - 1;
  const openEdges = () => { const m = new Map<string, [number, number, number]>(); F.forEach((f, k) => f.forEach((a, q) => { const b = f[(q + 1) % f.length]!, key = ekey(a, b); if (m.has(key)) m.set(key, [0, 0, -1]); else m.set(key, [a, b, k]); })); return [...m.values()].filter(e => e[2] >= 0); };

  // ---- the arches: the ring trued to its circle, a lip turned in, a well behind
  for (const side of [1, -1]) for (const a of [ARCH.f, ARCH.r]) { const R = DIM.archR, rad = (p: V) => Math.hypot(p[0] - a.x, p[2] - a.z);
    const es = openEdges().filter(([u, v]) => [u, v].every(w => P[w]![1] * side > 600 && Math.abs(rad(P[w]!) - R) < 30)); if (!es.length) continue;
    // order the chain: each open edge runs a -> b in its face's winding
    const next = new Map<number, number>(), has = new Set<number>(); for (const [u, v] of es) { next.set(u, v); has.add(v); }
    let s = [...next.keys()].find(u => !has.has(u))!; const ring = [s]; while (next.has(s)) { s = next.get(s)!; ring.push(s); }
    for (const v of ring) { const p = P[v]!, k = R / rad(p); P[v] = [a.x + (p[0] - a.x) * k, p[1], a.z + (p[2] - a.z) * k]; }
    const inward = (v: number, dr: number, dy: number): V => { const p = P[v]!, k = (R - dr) / R; return [a.x + (p[0] - a.x) * k, p[1] - side * dy, a.z + (p[2] - a.z) * k]; };
    const lip = ring.map(v => pt(inward(v, 14, 16))), well = ring.map(v => pt(inward(v, 14, 300))), hub = pt([a.x, P[well[0]!]![1], a.z]);
    for (let q = 0; q + 1 < ring.length; q++) { F.push([ring[q + 1]!, ring[q]!, lip[q]!, lip[q + 1]!]); tag.push({ region: 'shell', mat: 'paint', panel: 'archLip', right: side < 0 });
      F.push([lip[q + 1]!, lip[q]!, well[q]!, well[q + 1]!]); tag.push({ region: 'shell', mat: 'dark', panel: 'wheelWell', right: side < 0 });
      F.push([well[q + 1]!, well[q]!, hub]); tag.push({ region: 'shell', mat: 'dark', panel: 'wheelWell', right: side < 0 }); }
    for (let q = 0; q + 1 < ring.length; q++) crease.add(ekey(ring[q]!, ring[q + 1]!)); }

  // ---- the underside: every edge still open is on the outline of the floor; each is joined to the centre line
  { const centre = new Map<string, number>(), cOf = (v: number) => { const p = P[v]!; if (Math.abs(p[1]) < 1e-6) return v; const key = `${Math.round(p[0] * 10)},${Math.round(p[2] * 10)}`; let c = centre.get(key); if (c === undefined) { c = pt([p[0], 0, p[2]]); centre.set(key, c); } return c; };
    for (const [u, v] of openEdges()) { const cu = cOf(u), cv = cOf(v), f = [v, u, cu, cv].filter((w, q, l) => l.indexOf(w) === q); if (f.length < 3) continue;
      // u and v are already reversed against their face; the centre points close the quad (a triangle where they meet)
      F.push(f); tag.push({ region: 'shell', mat: 'dark', panel: 'floor', right: P[u]![1] + P[v]![1] < 0 }); crease.add(ekey(u, v)); } }
  void o;
  const split = new Set<string>(crease);
  // the shading also splits where the material changes to glass or a lamp's lens against paint? No: the glass lies in the skin. Only creases split.
  const N = cornerNormals(P, F, split);
  const lines: ShellLine[] = cage.lines.map(l => ({ kind: l.kind, name: l.name, pts: finePath(cage, fine, l.path, l.closed).map(v => P[v]!), closed: l.closed, w: l.w }));
  const loops: Record<string, V[]> = {}; for (const [k, p] of Object.entries(cage.loops)) loops[k] = finePath(cage, fine, p, k === 'headLamp' || k === 'sideIntake' || k === 'tailLamp').map(v => P[v]!);
  return { P, F, tag, N, crease, lines, loops, cage, fine, nSub };
}

/** the shell's edges and how many faces use each (a closed surface: every edge twice) */
export function edgeUse(F: number[][]): Map<string, number> { const m = new Map<string, number>(); for (const f of F) f.forEach((a, q) => { const k = ekey(a, f[(q + 1) % f.length]!); m.set(k, (m.get(k) ?? 0) + 1); }); return m; }
/** a quad cut into two triangles along the diagonal that leaves them flatter; equal: the one from corner 0 */
export function cut(P: V[], f: number[]): [number, number, number][] { if (f.length === 3) return [[f[0]!, f[1]!, f[2]!]]; const [a, b, c, d] = f as [number, number, number, number];
  const nn = (p: number, q: number, r: number) => unit(faceNormal(P, [p, q, r])), dot = (u: V, v: V) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const t0 = dot(nn(a, b, c), nn(a, c, d)), t1 = dot(nn(b, c, d), nn(b, d, a)); return t1 > t0 + 1e-4 ? [[b, c, d], [b, d, a]] : [[a, b, c], [a, c, d]]; }
export { add, sub, mul, len, unit };
