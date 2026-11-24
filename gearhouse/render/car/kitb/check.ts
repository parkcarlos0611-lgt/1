// The kit's checks (docs/systems/95_nsx_kit_breakdown.md, section 6): the seams of the body's shell (every panel's
// border shared exactly with its neighbour's, no face lying on another), and the silhouettes a parity test compares.
import { drawMesh, type Mesh } from '../mesh';
import { ROLES } from './emit';
import type { Assembled } from './assemble';

export interface SeamEdge { a: [number, number, number]; b: [number, number, number]; uses: number; names: string[]; panels: string[] }
export interface SeamReport {
  /** the shell's triangles and its welded points */
  tris: number; points: number;
  /** edges two different panels share (the seams) */
  seams: number;
  /** edges only one face uses: a gap (or an opening nothing backs) */
  open: SeamEdge[];
  /** edges more than two faces use */
  nonManifold: SeamEdge[];
  /** faces lying on another: the same three points, or folded flat onto a neighbour across an edge */
  duplicates: number; overlaps: number;
}

/** the shell's open and over-used edges: points welded within `tol` mm (only exact neighbours meet) */
export function seamCheck(A: Assembled, roles: string[] = ['shell'], tol = 0.01): SeamReport {
  const M = A.mesh, P = M.pos, want = new Set(roles.map(r => ROLES.indexOf(r as never))), q = 1 / tol;
  const ids = new Map<string, number>(), pts: number[][] = [];
  const pid = (i: number) => { const x = P[i]!, y = P[i + 1]!, z = P[i + 2]!, kx = Math.round(x * q), ky = Math.round(y * q), kz = Math.round(z * q);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const id = ids.get(`${kx + dx},${ky + dy},${kz + dz}`); if (id !== undefined) { const p = pts[id]!; if (Math.abs(p[0]! - x) <= tol && Math.abs(p[1]! - y) <= tol && Math.abs(p[2]! - z) <= tol) return id; } }
    const id = pts.length; pts.push([x, y, z]); ids.set(`${kx},${ky},${kz}`, id); return id; };
  const tris: [number, number, number, number][] = [];
  for (let t = 0; t < M.n; t++) { if (!want.has(A.role[t]!)) continue; const a = pid(t * 9), b = pid(t * 9 + 3), c = pid(t * 9 + 6); if (a === b || b === c || c === a) continue; tris.push([a, b, c, t]); }
  const E = new Map<string, number[]>(); const key = (a: number, b: number) => a < b ? `${a}|${b}` : `${b}|${a}`;
  tris.forEach(([a, b, c], k) => { for (const [u, v] of [[a, b], [b, c], [c, a]] as const) { const kk = key(u, v); const l = E.get(kk); if (l) l.push(k); else E.set(kk, [k]); } });
  const nameOf = (k: number) => M.names?.[M.part[tris[k]![3]]!] ?? '', panelOf = (k: number) => A.panels[A.panelOf[tris[k]![3]]!] ?? '';
  const edge = (kk: string, l: number[]): SeamEdge => { const [u, v] = kk.split('|').map(Number); return { a: pts[u!] as [number, number, number], b: pts[v!] as [number, number, number], uses: l.length, names: [...new Set(l.map(nameOf))], panels: [...new Set(l.map(panelOf))] }; };
  const open: SeamEdge[] = [], nonManifold: SeamEdge[] = []; let seams = 0, overlaps = 0;
  const sub = (a: number[], b: number[]) => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!], cr = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!], dt = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  for (const [kk, l] of E) { if (l.length === 1) open.push(edge(kk, l)); else if (l.length > 2) nonManifold.push(edge(kk, l)); if (new Set(l.map(panelOf)).size > 1) seams++;
    // folded flat: two faces across the edge, both third points on the same side in the same plane
    const [u, v] = kk.split('|').map(Number), pu = pts[u!]!, ev = sub(pts[v!]!, pu);
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const third = (k: number) => tris[k]!.slice(0, 3).find(p => p !== u && p !== v)!, c = sub(pts[third(l[i]!)]!, pu), d = sub(pts[third(l[j]!)]!, pu), n1 = cr(ev, c), n2 = cr(ev, d), l1 = Math.hypot(...n1), l2 = Math.hypot(...n2);
      if (l1 > 1e-6 && l2 > 1e-6 && dt(n1, n2) / (l1 * l2) > 0.9999) overlaps++; } }
  const seen = new Set<string>(); let duplicates = 0; for (const [a, b, c] of tris) { const s = [a, b, c].sort((x, y) => x - y).join(','); if (seen.has(s)) duplicates++; else seen.add(s); }
  return { tris: tris.length, points: pts.length, seams, open, nonManifold, duplicates, overlaps };
}

export interface View { name: string; yaw: number; pitch: number }
/** the six views of the parity test: the side, from above, the front, the rear, two three-quarters */
export const VIEWS: View[] = [{ name: 'side', yaw: 0, pitch: 0 }, { name: 'top', yaw: 0, pitch: 89.9 }, { name: 'front', yaw: 90, pitch: 0 }, { name: 'rear', yaw: 270, pitch: 0 },
  { name: 'front34', yaw: 35, pitch: 22 }, { name: 'rear34', yaw: 215, pitch: 22 }];
/** the mesh's silhouette from a view: 1 where it covers a pixel (glass counts), and the picture itself */
export function silhouette(M: Mesh, v: View, mm: number, w: number, h: number, outline = 0) { const p = drawMesh(M, v.yaw, v.pitch, mm, w, h, { outline, shadow: false, glass: 0.7, cy: 0.6 }), s = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) s[i] = p.rgba[i * 4 + 3]! > 0 ? 1 : 0; return { mask: s, pic: p }; }
/** how much two silhouettes agree: what both cover over what either covers */
export function iou(a: Uint8Array, b: Uint8Array): number { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++; } return u ? i / u : 1; }
