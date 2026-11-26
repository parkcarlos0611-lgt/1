// One level of Catmull-Clark subdivision with creases (docs/systems/109 §6): a coarse control cage of quads (any
// polygons, any valence) becomes the car's shell. An edge's sharpness: 0 smooth, 1 (or more) hard, between the two a
// blend (a tight radius); an edge only one face uses is a border and is always hard. Along hard edges the surface
// follows the edge's own points alone (the curve rule), so two pieces that share a loop of hard edges meet exactly,
// whatever lies on either side: that is what lets a module be swapped on its boundary loop.
// Also here: the shading normals of a mesh of polygons, weighted by the corner angles, split along chosen edges.
export type V = [number, number, number];
export const ekey = (a: number, b: number) => a < b ? `${a}|${b}` : `${b}|${a}`;
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const mixv = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]), unit = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export interface Cage { P: V[]; F: number[][]; /** edge key -> sharpness (0..1; 1 hard) */ sharp: Map<string, number> }
export interface Fine { P: V[]; /** quads, wound as their parent */ F: [number, number, number, number][]; /** the cage face each quad came from */ parent: number[];
  /** the new point of each cage point, edge and face */ vp: number[]; ep: Map<string, number>; fp: number[];
  /** the fine edges lying on a cage edge that was sharp (>= 1) or a border */ hard: Set<string> }

export function subdivide(c: Cage): Fine {
  const { P, F } = c, nV = P.length, edges = new Map<string, { a: number; b: number; f: number[] }>(), vF: number[][] = P.map(() => []), vE: string[][] = P.map(() => []);
  F.forEach((f, k) => f.forEach((a, q) => { const b = f[(q + 1) % f.length]!, key = ekey(a, b); let e = edges.get(key); if (!e) { e = { a, b, f: [] }; edges.set(key, e); vE[a]!.push(key); vE[b]!.push(key); } e.f.push(k); vF[a]!.push(k); }));
  const sh = (key: string) => { const e = edges.get(key)!; return e.f.length < 2 ? 1 : Math.min(1, c.sharp.get(key) ?? 0); };
  const out: V[] = [], fp: number[] = [], ep = new Map<string, number>(), vp: number[] = [];
  const cen = F.map(f => mul(f.reduce((s, v) => add(s, P[v]!), [0, 0, 0] as V), 1 / f.length));
  for (let v = 0; v < nV; v++) { const fs = vF[v]!, es = vE[v]!; if (!es.length) { vp.push(-1); continue; }
    const n = fs.length, other = (key: string) => { const e = edges.get(key)!; return e.a === v ? e.b : e.a; };
    // the smooth rule (a border point never uses it: its sharp count is at least 2)
    let smooth = P[v]!; if (n >= 2) { const Q = mul(fs.reduce((s, k) => add(s, cen[k]!), [0, 0, 0] as V), 1 / n), R = mul(es.reduce((s, key) => add(s, mixv(P[v]!, P[other(key)]!, 0.5)), [0, 0, 0] as V), 1 / es.length);
      smooth = mul(add(add(Q, mul(R, 2)), mul(P[v]!, n - 3)), 1 / n); }
    const hardE = es.filter(key => sh(key) > 0), w = hardE.length ? hardE.reduce((s, key) => s + sh(key), 0) / hardE.length : 0;
    let p: V; if (hardE.length < 2) p = smooth; else if (hardE.length === 2) { const cr = mul(add(add(mul(P[v]!, 6), P[other(hardE[0]!)]!), P[other(hardE[1]!)]!), 1 / 8); p = mixv(smooth, cr, w); } else p = mixv(smooth, P[v]!, w);
    vp.push(out.length); out.push(p); }
  for (const [key, e] of edges) { const mid = mixv(P[e.a]!, P[e.b]!, 0.5), s = sh(key); let p = mid;
    if (s < 1 && e.f.length === 2) { const sm = mul(add(add(P[e.a]!, P[e.b]!), add(cen[e.f[0]!]!, cen[e.f[1]!]!)), 0.25); p = mixv(sm, mid, s); }
    ep.set(key, out.length); out.push(p); }
  F.forEach((_, k) => { fp.push(out.length); out.push(cen[k]!); });
  const Q: [number, number, number, number][] = [], parent: number[] = [], hard = new Set<string>();
  F.forEach((f, k) => f.forEach((v, q) => { const nx = f[(q + 1) % f.length]!, pv = f[(q + f.length - 1) % f.length]!; Q.push([vp[v]!, ep.get(ekey(v, nx))!, fp[k]!, ep.get(ekey(pv, v))!]); parent.push(k); }));
  for (const [key, e] of edges) if (sh(key) >= 1) { const m = ep.get(key)!; hard.add(ekey(vp[e.a]!, m)); hard.add(ekey(m, vp[e.b]!)); }
  return { P: out, F: Q, parent, vp, ep, fp, hard };
}

/** a polygon's normal (Newell), not normalised: its length is twice the area */
export function faceNormal(P: V[], f: number[]): V { let n: V = [0, 0, 0]; for (let q = 0; q < f.length; q++) { const a = P[f[q]!]!, b = P[f[(q + 1) % f.length]!]!; n = add(n, cross(a, b)); } return n; }
/** Shading normals, one per face corner: at each point the faces round it are gathered into fans that do not cross a
 *  `split` edge (nor a border), and each fan's normal is its faces' normals weighted by their corner angles there. */
export function cornerNormals(P: V[], F: number[][], split: Set<string>): V[][] {
  const fn = F.map(f => unit(faceNormal(P, f))), vF: number[][] = P.map(() => []); F.forEach((f, k) => f.forEach(v => vF[v]!.push(k)));
  const out: V[][] = F.map(f => f.map(() => [0, 0, 1] as V));
  for (let v = 0; v < P.length; v++) { const fs = vF[v]!; if (!fs.length) continue; const grp = fs.map((_, i) => i), find = (i: number): number => grp[i] === i ? i : (grp[i] = find(grp[i]!));
    const nb = (k: number): [number, number] => { const f = F[k]!, q = f.indexOf(v); return [f[(q + 1) % f.length]!, f[(q + f.length - 1) % f.length]!]; };
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) { const a = nb(fs[i]!), b = nb(fs[j]!); for (const u of a) if (b.includes(u) && !split.has(ekey(v, u))) grp[find(i)] = find(j); }
    const sum = new Map<number, V>();
    fs.forEach((k, i) => { const [a, b] = nb(k), da = unit(sub(P[a]!, P[v]!)), db = unit(sub(P[b]!, P[v]!)), w = Math.acos(Math.max(-1, Math.min(1, da[0] * db[0] + da[1] * db[1] + da[2] * db[2]))), g = find(i); sum.set(g, add(sum.get(g) ?? [0, 0, 0], mul(fn[k]!, w))); });
    fs.forEach((k, i) => { out[k]![F[k]!.indexOf(v)] = unit(sum.get(find(i))!); }); }
  return out;
}
