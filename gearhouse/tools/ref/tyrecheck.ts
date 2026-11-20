// How lively the tyres are (review 26): over the gravel stretch of the test course at 15 km/h, how far the free part
// of each tyre's ring wanders from round (shape wobble) and how much the hubs ring after a hit (wheel hop), in mm.
// npx tsx tools/ref/tyrecheck.ts
import { Rig, UTILITY48 } from '../../physics/rig';
import { COURSE } from '../../ui/course';
const r = new Rig(UTILITY48, COURSE, 28); r.run(1);
let wob = 0, wobMax = 0, n = 0, breath = 0; const lastM: number[] = [], slowC: number[][] = []; let jelly = 0, jellyMax = 0; let hop = 0, prev = [r.ay[0], r.ay[1]], lp = [r.ay[0], r.ay[1]];
for (let i = 0; i < 2400; i++) { r.throttle = Math.max(0, Math.min(1, (4.2 - r.vx) * 0.7)); r.run(1 / 400);
  for (const t of r.tyres) { const rs = t.p.filter(p => p.y - t.hub.y > 0.15).map(p => Math.hypot(p.x - t.hub.x, p.y - t.hub.y)); const m = rs.reduce((a, b) => a + b, 0) / rs.length;
    for (const q of rs) { const d = Math.abs(q - m) * 1000; wob += d; wobMax = Math.max(wobMax, d); n++; }
    const cx = t.p.reduce((a, p) => a + p.x, 0) / t.p.length - t.hub.x, cy = t.p.reduce((a, p) => a + p.y, 0) / t.p.length - t.hub.y, k0 = r.tyres.indexOf(t);
    const sc = (slowC[k0] ??= [cx, cy]); sc[0] = sc[0]! + (cx - sc[0]!) * 0.02; sc[1] = sc[1]! + (cy - sc[1]!) * 0.02; const j = Math.hypot(cx - sc[0]!, cy - sc[1]!) * 1000; jelly += j; jellyMax = Math.max(jellyMax, j);
    const k = r.tyres.indexOf(t); breath += Math.abs(m - (lastM[k] ?? m)) * 1000; lastM[k] = m; }
  for (const a of [0, 1] as const) { lp[a] = lp[a]! + (r.ay[a] - lp[a]!) * 0.05; hop += Math.abs(r.ay[a] - lp[a]!) * 1000; } prev = [r.ay[0], r.ay[1]]; }
console.log(`shape wobble (upper ring, against its own mean) mean ${(wob / n).toFixed(2)} mm, max ${wobMax.toFixed(1)} mm; breathing ${(breath / 9600 * 400).toFixed(0)} mm/s; wheel hop (hub against its own slow motion) mean ${(hop / 4800).toFixed(1)} mm; hub inside tyre (jelly) mean ${(jelly / 9600).toFixed(1)} mm max ${jellyMax.toFixed(0)} mm; x ${r.x.toFixed(1)}`);
