import { buildN33Shell } from '../../render/car/n33';
import { faceNormal, ekey } from '../../render/car/p959/subdiv';
const S = buildN33Shell({ glass: null }); const P = S.P, E = new Map<string, number[]>();
S.F.forEach((f, k) => { if (S.tag[k]!.mat !== 'paint') return; f.forEach((a, q) => { const key = ekey(a, f[(q + 1) % f.length]!); (E.get(key) ?? E.set(key, []).get(key)!).push(k); }); });
const ang = (a: number[], b: number[]) => { const la = Math.hypot(...a), lb = Math.hypot(...b); return Math.acos(Math.max(-1, Math.min(1, (a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!) / la / lb))) * 180 / Math.PI; };
const lim = +(process.argv[2] ?? 30);
for (const [key, fs] of E) { if (fs.length !== 2 || S.crease.has(key)) continue; const d = ang(faceNormal(P, S.F[fs[0]!]!), faceNormal(P, S.F[fs[1]!]!)); if (d < lim) continue; const [a, b] = key.split('|').map(Number);
  if (P[a!]![1] < 0) continue; const pf = (k: number) => S.fine.parent[k] ?? -1, cage = S.cage, cf = (k: number) => { const c = pf(k); if (c < 0 || k >= S.nSub) return 'helper'; const q = cage.F[c]!; let r = ''; for (let i = 0; i < cage.M.length; i++) for (let j = 0; j < cage.M[0]!.length; j++) if (q.includes(cage.M[i]![j]!) && cage.M[i]![j]! >= 0) r += `${i},${j} `; return r; };
  console.log(d.toFixed(1), P[a!]!.map(Math.round).join(' '), '->', P[b!]!.map(Math.round).join(' '), '|', cf(fs[0]!), '|', cf(fs[1]!)); }
