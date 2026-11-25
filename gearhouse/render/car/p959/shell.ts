// The 959's body shell (docs/systems/109): the control cage (cage.ts) subdivided once (subdiv.ts), then finished by
// hand-set operations on its loops: the wheel arches trued to their circles and given a lip and a well, the sockets
// sunk (head lamps, tail lamp bar, side intakes), the underside closed. The result is one closed surface of quads and
// a few triangles, every face tagged with its region (the shell itself or a module hung on a boundary loop), material
// and panel; with it the drawn lines, the hard creases (split shading) and the modules' boundary loops, as points.
import { buildCage, DIM, type Cage959, type CageOpts, type Tag } from './cage';
import { cornerNormals, ekey, faceNormal, subdivide, type Fine, type V } from './subdiv';
import { frameOf } from './frame';

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]), unit = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export interface ShellLine { kind: Cage959['lines'][number]['kind']; name: string; pts: V[]; closed?: boolean; w?: number }
export interface Shell959 { P: V[]; F: number[][]; tag: Tag[]; /** shading normals per face corner */ N: V[][]; /** edges whose shading is split, as point pairs */ crease: Set<string>;
  lines: ShellLine[]; /** the modules' boundary loops (the points a replacement must meet), left side; mirror y for the right */ loops: Record<string, V[]>;
  cage: Cage959; fine: Fine; /** how many of the faces came from the subdivision (the rest are lips, wells, socket walls, the floor) */ nSub: number }

/** the fine points along a path of cage points */
function finePath(c: Cage959, f: Fine, path: number[], closed = false): number[] { const out: number[] = []; const n = path.length;
  for (let q = 0; q < n; q++) { out.push(f.vp[path[q]!]!); if (q + 1 < n || closed) out.push(f.ep.get(ekey(path[q]!, path[(q + 1) % n]!))!); } return out; }

export interface ShellOpts extends CageOpts { /** leave the sockets flush (no recess) */ flush?: boolean }
export function buildShell(o: ShellOpts = {}): Shell959 { const fr = frameOf(o.dims), lamps = o.lamps !== false, details = o.details !== false;
  return shellFrom(buildCage(o), { arches: [{ x: fr.archF[0], z: fr.archF[1] }, { x: fr.archR[0], z: fr.archR[1] }], archR: DIM.archR,   // the hubs on the stretched body
    sinks: o.flush ? [] : [...[false, true].flatMap(right => [...(lamps ? [{ pick: (t: Tag) => t.socket === 'headLamp' && !!t.right === right, depth: 14, inset: 5, rim: 'headLampRim' }] : []), ...(details ? [{ pick: (t: Tag) => t.socket === 'sideIntake' && !!t.right === right, depth: 34, inset: 4, rim: 'sideIntakeRim' }] : [])]),
      ...(details ? [{ pick: (t: Tag) => t.socket === 'tailLamp', depth: 9, inset: 3, rim: 'tailLampRim' }] : [])] }); }

/** a socket's recess: the cells it picks sunk `depth` below the skin, a wall `inset` in from their loop (its panel `rim`) */
export interface Sink { pick: (t: Tag) => boolean; depth: number; inset: number; rim: string }
/** how a cage is finished into a shell: its arches' hubs on the body (the ring of open edges at radius `archR` round
 *  each, at |y| over `archY`, trued and given a lip and a well), the sockets sunk in order */
export interface ShellFinish { arches: { x: number; z: number }[]; archR: number; archY?: number; sinks?: Sink[] }
/** any cage-built body's shell (the 959's above; the N33's: render/car/n33): the cage subdivided once, its arches,
 *  its sockets, its floor, its creases, normals, lines and loops */
export function shellFrom(cage: Cage959, o: ShellFinish): Shell959 {
  const fine = subdivide(cage), P = fine.P, F: number[][] = fine.F.map(q => q.slice()), tag: Tag[] = fine.parent.map(k => cage.tag[k]!), nSub = F.length;
  const crease = new Set<string>(); for (const key of cage.crease) { const [a, b] = key.split('|').map(Number) as [number, number], m = fine.ep.get(key)!; crease.add(ekey(fine.vp[a]!, m)); crease.add(ekey(m, fine.vp[b]!)); }
  const pt = (p: V) => P.push(p) - 1;
  const openEdges = () => { const m = new Map<string, [number, number, number]>(); F.forEach((f, k) => f.forEach((a, q) => { const b = f[(q + 1) % f.length]!, key = ekey(a, b); if (m.has(key)) m.set(key, [0, 0, -1]); else m.set(key, [a, b, k]); })); return [...m.values()].filter(e => e[2] >= 0); };

  // ---- the arches: the ring trued to its circle, a lip turned in, a well behind
  for (const side of [1, -1]) for (const a of o.arches) { const R = o.archR, rad = (p: V) => Math.hypot(p[0] - a.x, p[2] - a.z);
    const es = openEdges().filter(([u, v]) => [u, v].every(w => P[w]![1] * side > (o.archY ?? 600) && Math.abs(rad(P[w]!) - R) < 30)); if (!es.length) continue;
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

  // ---- the sockets: a shallow recess for each module (docs/systems/109 §3). The loop round it stays where it is (the
  //      module's boundary); inside it a wall steps in and the floor lies `depth` below the skin
  { const sink = (pick: (t: Tag) => boolean, depth: number, inset: number, rim: string) => { const S = new Set<number>(); F.forEach((_, k) => { if (k < nSub && pick(tag[k]!)) S.add(k); }); if (!S.size) return;
      const use = new Map<string, number>(), vn = new Map<number, V>(), vc = new Map<number, V>(), cnt = new Map<number, number>();
      for (const k of S) { const f = F[k]!, n = unit(faceNormal(P, f)), c = mul(f.reduce((q, v) => add(q, P[v]!), [0, 0, 0] as V), 1 / f.length);
        f.forEach((v, q) => { const key = ekey(v, f[(q + 1) % f.length]!); use.set(key, (use.get(key) ?? 0) + 1); vn.set(v, add(vn.get(v) ?? [0, 0, 0], n)); vc.set(v, add(vc.get(v) ?? [0, 0, 0], c)); cnt.set(v, (cnt.get(v) ?? 0) + 1); }); }
      const border = new Set<number>(), edges: [number, number][] = [];
      for (const k of S) { const f = F[k]!; f.forEach((v, q) => { const u = f[(q + 1) % f.length]!; if (use.get(ekey(v, u)) === 1) { border.add(v); border.add(u); edges.push([v, u]); } }); }
      const moved = new Map<number, number>();
      for (const [v, n0] of vn) { const n = unit(n0), down = mul(n, -depth); if (!border.has(v)) { P[v] = add(P[v]!, down); continue; }
        const c = mul(vc.get(v)!, 1 / cnt.get(v)!), d = sub(c, P[v]!), flat = sub(d, mul(n, d[0] * n[0] + d[1] * n[1] + d[2] * n[2])), l = len(flat) || 1; moved.set(v, pt(add(add(P[v]!, down), mul(flat, inset / l)))); }
      for (const k of S) F[k] = F[k]!.map(v => moved.get(v) ?? v);
      for (const [a, b] of edges) { F.push([a, b, moved.get(b)!, moved.get(a)!]); const t = tag[[...S][0]!]!; tag.push({ region: t.region, mat: 'paint', panel: rim, right: P[a]![1] + P[b]![1] < 0 }); crease.add(ekey(a, b)); crease.add(ekey(moved.get(a)!, moved.get(b)!)); } };
    // a socket whose module is not there (the lump's: its lamps, its intakes, its tail lamp band) stays flush: not in the list
    for (const s of o.sinks ?? []) sink(s.pick, s.depth, s.inset, s.rim); }

  // ---- the underside: every edge still open is on the outline of the floor; each is joined to the centre line
  { const centre = new Map<string, number>(), cOf = (v: number) => { const p = P[v]!; if (Math.abs(p[1]) < 1e-6) return v; const key = `${Math.round(p[0] * 10)},${Math.round(p[2] * 10)}`; let c = centre.get(key); if (c === undefined) { c = pt([p[0], 0, p[2]]); centre.set(key, c); } return c; };
    for (const [u, v] of openEdges()) { const cu = cOf(u), cv = cOf(v), f = [v, u, cu, cv].filter((w, q, l) => l.indexOf(w) === q); if (f.length < 3) continue;
      // u and v are already reversed against their face; the centre points close the quad (a triangle where they meet)
      F.push(f); tag.push({ region: 'shell', mat: 'dark', panel: 'floor', right: P[u]![1] + P[v]![1] < 0 }); crease.add(ekey(u, v)); } }
  // helper faces (lips, wells, socket walls, the slot, the floor) fold hard against their neighbours: those folds are creases too
  // and a cell the lump paints over (its glass's sharp front corner by the A pillar) splits at a fold of 25 degrees or more
  { const helper = (t: Tag) => /Rim$|archLip|wheelWell|floor|wingSlot/.test(t.panel), first = new Map<string, number>(), nrm = F.map(f => unit(faceNormal(P, f)));
    F.forEach((f, k) => f.forEach((a, q) => { const key = ekey(a, f[(q + 1) % f.length]!), o2 = first.get(key); if (o2 === undefined) first.set(key, k); else if ((tag[o2]!.was === 'glass' || tag[k]!.was === 'glass') && nrm[o2]![0] * nrm[k]![0] + nrm[o2]![1] * nrm[k]![1] + nrm[o2]![2] * nrm[k]![2] < 0.906) crease.add(key); else if ((helper(tag[o2]!) || helper(tag[k]!)) && nrm[o2]![0] * nrm[k]![0] + nrm[o2]![1] * nrm[k]![1] + nrm[o2]![2] * nrm[k]![2] < 0.82) crease.add(key); })); }
  // the shading is also split where the material changes (glass, a grille or a lens against the paint), as the game splits it;
  // where the lump paints its glass over, where the glass's edge was (the folds round it are the same hard edges)
  { const cls = (t: Tag) => { const m = t.was === 'glass' ? 'glass' : t.mat; return m === 'paint' || m === 'dark' ? 'body' : m; }, first = new Map<string, number>();
    F.forEach((f, k) => f.forEach((a, q) => { const key = ekey(a, f[(q + 1) % f.length]!), o2 = first.get(key); if (o2 === undefined) first.set(key, k); else if (cls(tag[o2]!) !== cls(tag[k]!)) crease.add(key); })); }
  const split = new Set<string>(crease);
  const N = cornerNormals(P, F, split);
  const faceOf = new Map<string, number>(); cage.F.forEach((f, k) => faceOf.set(f.slice().sort((a, b) => a - b).join(','), k));
  const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  /** a line between two cage paths: it runs over the fine points of a, of the row between them, and of b */
  const between = (a: number[], b: number[], t: number, span?: [number, number]): V[] => { const A = finePath(cage, fine, a), B = finePath(cage, fine, b), mid: number[] = [];
    for (let q = 0; q < a.length; q++) { mid.push(fine.ep.get(ekey(a[q]!, b[q]!))!); if (q + 1 < a.length) mid.push(fine.fp[faceOf.get([a[q]!, a[q + 1]!, b[q + 1]!, b[q]!].sort((x, y) => x - y).join(','))!]!); }
    let pts = A.map((v, q) => t <= 0.5 ? lerp(P[v]!, P[mid[q]!]!, t * 2) : lerp(P[mid[q]!]!, P[B[q]!]!, t * 2 - 1));
    if (span) { const cum = [0]; for (let q = 1; q < pts.length; q++) cum.push(cum[q - 1]! + len(sub(pts[q]!, pts[q - 1]!))); const L = cum[cum.length - 1]!, at = (u: number): V => { const d = u * L; let q = 1; while (q < cum.length - 1 && cum[q]! < d) q++; return lerp(pts[q - 1]!, pts[q]!, (d - cum[q - 1]!) / ((cum[q]! - cum[q - 1]!) || 1)); };
      pts = [at(span[0]), ...pts.filter((_, q) => cum[q]! > span[0] * L && cum[q]! < span[1] * L), at(span[1])]; }
    return pts; };
  const lines: ShellLine[] = cage.lines.map(l => ({ kind: l.kind, name: l.name, pts: l.between ? between(l.between.a, l.between.b, l.between.t, l.between.span) : finePath(cage, fine, l.path, l.closed).map(v => P[v]!), closed: l.closed, w: l.w }));
  const loops: Record<string, V[]> = {}; for (const [k, p] of Object.entries(cage.loops)) loops[k] = finePath(cage, fine, p, k === 'headLamp' || k === 'sideIntake' || k === 'tailLamp').map(v => P[v]!);
  return { P, F, tag, N, crease, lines, loops, cage, fine, nSub };
}

/** the shell's edges and how many faces use each (a closed surface: every edge twice) */
export function edgeUse(F: number[][]): Map<string, number> { const m = new Map<string, number>(); for (const f of F) f.forEach((a, q) => { const k = ekey(a, f[(q + 1) % f.length]!); m.set(k, (m.get(k) ?? 0) + 1); }); return m; }
/** a quad cut into two triangles (docs/systems/108 T3): where it is twisted by more than 2 degrees, along the diagonal
 *  that leaves the two flatter; elsewhere along the diagonal that runs back and outward (down the side), the same way
 *  over a whole panel and mirrored on the other side */
export function cut(P: V[], f: number[]): [number, number, number][] { if (f.length === 3) return [[f[0]!, f[1]!, f[2]!]]; const [a, b, c, d] = f as [number, number, number, number];
  const nn = (p: number, q: number, r: number) => unit(faceNormal(P, [p, q, r])), dot = (u: V, v: V) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const t0 = dot(nn(a, b, c), nn(a, c, d)), t1 = dot(nn(b, c, d), nn(b, d, a)); let alt: boolean;
  if (Math.abs(t1 - t0) > 6e-4) alt = t1 > t0; else { const n = unit(faceNormal(P, f)), side = P[a]![1] + P[b]![1] + P[c]![1] + P[d]![1] < 0 ? -1 : 1, g: V = [0, n[2] * side, -n[1] * side];   // across the face: n x (the car's length), turned over on the other side
    const d0 = sub(P[c]!, P[a]!), d1 = sub(P[d]!, P[b]!), s0 = d0[0] * dot(d0, g), s1 = d1[0] * dot(d1, g); alt = s1 > s0 + 1e-6; }
  return alt ? [[b, c, d], [b, d, a]] : [[a, b, c], [a, c, d]]; }
export { add, sub, mul, len, unit };
