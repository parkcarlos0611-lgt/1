import { n33Model } from '../../render/car/n33';
const m = n33Model({ glass: 'stock', bare: true }), M = m.mesh, S = m.shell;
type V = [number, number, number];
const tri: V[][] = []; for (let t = 0; t < M.n; t++) tri.push([0, 1, 2].map(c => [M.pos[t * 9 + c * 3]!, M.pos[t * 9 + c * 3 + 1]!, M.pos[t * 9 + c * 3 + 2]!] as V));
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cr = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function hits(o: V, d: V): number[] { const out: number[] = []; for (const [a, b, c] of tri) { const e1 = sub(b, a), e2 = sub(c, a), p = cr(d, e2), det = dot(e1, p); if (Math.abs(det) < 1e-9) continue; const tv = sub(o, a), u = dot(tv, p) / det; if (u < 0 || u > 1) continue; const q = cr(tv, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) continue; const t = dot(e2, q) / det; if (t > 0) out.push(t); } return out.sort((x, y) => x - y); }
const f = (n: number) => n.toFixed(0);
console.log('side: first skin from the middle outward (y) at x, z');
for (const x of [1560, 1650, 1800, 2000, 2200, 2500, 2800, 2950, 3100, 3250, 3400]) { console.log('x', x, [250, 300, 400, 500, 600, 700, 800, 860, 900, 918, 940, 1000, 1100, 1200, 1280].map(z => { const h = hits([x, 0, z], [0, 1, 0]); return `${z}:${h.length ? f(h[0]!) : '-'}`; }).join(' ')); }
console.log('up from z=160 at (x,y): hits z');
for (const y of [0, 200, 400, 550, 650]) console.log('y', y, [1450, 1500, 1550, 1600, 1700, 1800, 2000, 2200, 2500, 2800, 3000, 3200, 3400, 3600, 3800, 4000, 4100].map(x => { const h = hits([x, y, 160], [0, 0, 1]); return `${x}:${h.map(t => f(160 + t)).join('/')}`; }).join(' '));
console.log('screen foot (cage row 10) and glass: forward from x=2600 at (y,z) first hit x');
for (const z of [930, 950, 970, 990, 1010, 1050, 1100, 1200, 1280]) console.log('z', z, [0, 100, 200, 300, 400, 500, 560, 600, 640, 680, 700].map(y => { const h = hits([2600, y, z], [-1, 0, 0]); return `${y}:${h.length ? f(2600 - h[0]!) : '-'}`; }).join(' '));
console.log('rear: back from x=2600 at (y,z) first hit x');
for (const z of [300, 400, 500, 700, 900, 1000, 1040, 1080, 1150, 1250]) console.log('z', z, [0, 200, 400, 500, 560, 600, 650, 700].map(y => { const h = hits([2600, y, z], [1, 0, 0]); return `${y}:${h.length ? f(2600 + h[0]!) : '-'}`; }).join(' '));
// tags: floor / wheelWell extents
const ext: Record<string, number[]> = {}; S.F.forEach((F, k) => { const t = S.tag[k]!; const key = t.panel ?? '?'; const e = ext[key] ??= [1e9, -1e9, 1e9, -1e9, 1e9, -1e9]; for (const v of F) { const p = S.P[v]!; e[0] = Math.min(e[0]!, p[0]); e[1] = Math.max(e[1]!, p[0]); e[2] = Math.min(e[2]!, Math.abs(p[1])); e[3] = Math.max(e[3]!, Math.abs(p[1])); e[4] = Math.min(e[4]!, p[2]); e[5] = Math.max(e[5]!, p[2]); } });
for (const [k, e] of Object.entries(ext)) console.log(k, e.map(f).join(' '));
// the glass's foot line: lowest points of the windscreen panel by y
const pts = (panel: string) => { const s = new Map<number, V>(); S.F.forEach((F, k) => { if (S.tag[k]!.panel === panel && S.tag[k]!.mat === 'glass') for (const v of F) s.set(v, S.P[v]! as V); }); return [...s.values()]; };
for (const pn of ['windscreen', 'doorGlass', 'quarterGlass', 'rearWindow']) { const P = pts(pn).filter(p => p[1] >= -1e-6); console.log(pn, P.length, 'x', f(Math.min(...P.map(p => p[0]))), f(Math.max(...P.map(p => p[0]))), 'y', f(Math.min(...P.map(p => p[1]))), f(Math.max(...P.map(p => p[1]))), 'z', f(Math.min(...P.map(p => p[2]))), f(Math.max(...P.map(p => p[2]))));
  if (pn === 'windscreen') { const by = new Map<number, V>(); for (const p of P) { const k = Math.round(p[1] / 20); if (!by.has(k) || by.get(k)![0] > p[0]) by.set(k, p); } console.log(' foot', [...by.values()].sort((a, b) => a[1] - b[1]).map(p => `(${f(p[0])},${f(p[1])},${f(p[2])})`).join(' ')); }
  if (pn === 'doorGlass' || pn === 'quarterGlass') { const bx = new Map<number, V>(); for (const p of P) { const k = Math.round(p[0] / 60); if (!bx.has(k) || bx.get(k)![2] > p[2]) bx.set(k, p); } console.log(' belt', [...bx.values()].sort((a, b) => a[0] - b[0]).map(p => `(${f(p[0])},${f(p[1])},${f(p[2])})`).join(' ')); } }
