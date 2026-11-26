// Converts the measured base cars of the first test build (legacy/tools/pixel/gen/v3/base.mjs) into the new
// panel data: data/cars/<id>.json. The legacy specs are millimetre outlines with a fixed layer order; that order
// and the part roles are kept, the pixel shading is not. Run once; the JSON files are the data from then on.
// npx tsx tools/importLegacy.ts
import { writeFileSync, mkdirSync } from 'node:fs';
// @ts-expect-error legacy JavaScript module without types
import { measuredDesign, measuredSide, baseName } from '../legacy/tools/pixel/gen/v3/base.mjs';
// @ts-expect-error legacy JavaScript module without types
import { tire } from '../legacy/tools/pixel/gen/tire.mjs';
import type { CarDesign, Feature, Material, Panel, Pt, Slot, WheelSpec } from '../render/car/types';

const IDS = ['sedan30', 'coupe30', 'cabrio33', 'airflow34', 'town34', 'zephyr37', 'coupe40', 'cont40', 'lux41'];
const PAINT: Record<string, [string, string]> = { sedan30: ['#2f3a4a', '#1c1b1f'], coupe30: ['#3f5a40', '#1c1b1f'], cabrio33: ['#8c2a24', '#1d1a1c'], airflow34: ['#6b6e70', '#2a2c30'], town34: ['#5c1c27', '#1b1a1f'],
  zephyr37: ['#4b6283', '#20242c'], coupe40: ['#7d3a2c', '#241c1a'], cont40: ['#d8c9a0', '#3a3228'], lux41: ['#1f3a36', '#141a19'] };
type P2 = number[];
const mat = (ramp: string | undefined, chrome?: unknown): Material => chrome ? 'chrome' : !ramp || ramp === 'PAINT' || ramp === 'paint.c0' ? 'paint' : ramp === 'black' ? 'black' : ramp === 'white' ? 'white'
  : ramp === 'woodDark' ? 'wood' : ramp === 'lensW' ? 'lens' : ramp.startsWith('paint.') ? 'paint2' : (['rubber', 'iron', 'lensR', 'chrome', 'canvas', 'glass', 'wood'].includes(ramp) ? ramp as Material : 'black');
const sharp = (pts: P2[]): Pt[] => pts.map(p => [Math.round(p[0]!), Math.round(p[1]!), 1]);
const ellipse = (e: number[], n = 20): Pt[] => Array.from({ length: n }, (_, k) => [Math.round(e[0]! + Math.cos(k / n * 6.2832) * e[2]!), Math.round(e[1]! + Math.sin(k / n * 6.2832) * e[3]!)] as Pt);
function band(pts: P2[], th: number): Pt[] { const L: Pt[] = [], R: Pt[] = [], h = Math.max(th, 14) / 2;
  for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!, dx = b[0]! - a[0]!, dz = b[1]! - a[1]!, l = Math.hypot(dx, dz) || 1, nx = -dz / l * h, nz = dx / l * h;
    L.push([Math.round(pts[i]![0]! + nx), Math.round(pts[i]![1]! + nz), 1]); R.unshift([Math.round(pts[i]![0]! - nx), Math.round(pts[i]![1]! - nz), 1]); }
  return [...L, ...R]; }
const shape = (o: any): Pt[] | null => o.e ? ellipse(o.e) : o.band ? band(o.band, o.th ?? 30) : o.pts ? sharp(o.pts) : null;
const cx = (pts: Pt[]) => pts.reduce((a, p) => a + p[0], 0) / pts.length;

function convert(id: string): CarDesign {
  const year = +('19' + id.slice(-2)), s = measuredSide(measuredDesign(id, year), 'paint.c0'), g = s.geo, panels: Panel[] = [], features: Feature[] = [];
  const add = (p: Panel) => { let n = 1, base = p.id; while (panels.some(q => q.id === p.id)) p.id = base + (++n); panels.push(p); };
  const T = s.tire ? tire(s.tire) : null, R = T ? T.r : g.r, arches = (s.arches as any[]).map(a => ({ x: Math.round(a.x), z: Math.round(a.z), r: Math.round(a.r) }));
  // underside, frame and axles
  (s.under || []).forEach((u: any) => { const pts = shape(u); if (pts) add({ id: 'under', pts, material: mat(u.ramp), surface: 'flat', z: 1 }); });
  // wheel wells: the dark upper half of each arch
  for (const a of arches) add({ id: 'well', material: 'shadow', surface: 'flat', z: 2, pts: [[a.x + a.r, a.z - 40, 1] as Pt, ...Array.from({ length: 15 }, (_, k) => [Math.round(a.x + Math.cos(Math.PI * k / 14) * (a.r + 6)), Math.round(a.z + Math.sin(Math.PI * k / 14) * (a.r + 6)), 1] as Pt), [a.x - a.r, a.z - 40, 1] as Pt] });
  // parts behind the body (radiator shell, lamp bars...)
  const parts = (s.parts || []) as any[], lw = (s.lamps as any[]).find(l => l.ramp === 'lensW'), lr = (s.lamps as any[]).find(l => l.ramp === 'lensR');
  const near = (pts: Pt[], l: any, d: number) => l && Math.abs(cx(pts) - l.e[0]) < d && Math.abs(pts.reduce((a, p) => a + p[1], 0) / pts.length - l.e[1]) < d;
  const slotOf = (pts: Pt[], p: any): Slot | undefined => p.chrome && p.behind && Math.max(...pts.map(q => q[0])) < g.F + 60 && pts.length >= 9 ? 'grille' : near(pts, lw, 190) ? 'lamp' : near(pts, lr, 120) ? 'tail' : undefined;
  parts.forEach((p, i) => { if (!p.behind) return; const pts = shape(p); if (pts) add({ id: 'part', pts, material: mat(p.ramp, p.chrome), surface: 'side', z: 3 + i * 0.01, slot: slotOf(pts, p), rigid: !(p.pts && p.pts.length >= 9) }); });
  // body, its second-tone areas, glass and what shows through the glass
  add({ id: 'body', pts: sharp(s.body), material: 'paint', surface: 'side', z: 10, bevel: 5, cut: arches });
  (s.tone || []).forEach((t: any) => add({ id: 'bodyTone', pts: sharp(t.pts), material: 'paint2', surface: 'side', z: 11, clip: 'body', bevel: 5 }));
  (s.cut || []).forEach((c: any) => add({ id: 'opening', pts: sharp(c), material: 'shadow', surface: 'flat', z: 11.5, clip: 'body' }));
  [...(s.glass || []), ...(s.glassExtra || [])].forEach((gl: any) => add({ id: 'glass', pts: sharp(gl), material: 'glass', surface: 'side', z: 12, clip: 'body' }));
  (s.interior || []).forEach((h: any) => { const pts = shape(h); if (pts) add({ id: 'inside', pts, material: 'shadow', surface: 'flat', z: 13, clip: 'glass' }); });
  (s.aprons || []).forEach((a: any) => add({ id: 'apron', pts: sharp(a), material: 'black', surface: 'flat', z: 15 }));
  (s.boards || []).forEach((b: any) => add({ id: 'board', pts: sharp(b.pts), material: mat(b.paint), surface: 'flat', z: 19 }));
  (s.fenders || []).forEach((f: any, i: number) => add({ id: i === 0 && f.wx < g.R - 500 ? 'fenderF' : 'fenderR', pts: sharp(f.pts), material: f.paint === 'black' ? 'paint2' : mat(f.paint), surface: 'fender', z: 20,
    cut: f.wr > 5 ? [{ x: Math.round(f.wx), z: Math.round(f.wz), r: Math.round(f.wr) }] : undefined }));
  // bumpers
  const bs = (x: number): Slot => (x < s.len / 2 ? 'bumperF' : 'bumperR');
  (s.bumperSets || []).forEach((b: any) => { const sl = bs(b.x0);
    if (b.iron) add({ id: 'bumperIron', pts: band(b.iron, b.ironTh ?? 28), material: 'black', surface: 'flat', z: 24, slot: sl });
    for (const zc of b.zs) add({ id: 'bumper', material: 'chrome', surface: 'side', z: 25, slot: sl, bevel: 1.5, pts: [[b.x0, zc - b.h / 2], [b.x1, zc - b.h / 2], [b.x1 + b.h * 0.3, zc], [b.x1, zc + b.h / 2], [b.x0, zc + b.h / 2], [b.x0 - b.h * 0.3, zc]].map(p => [Math.round(p[0]!), Math.round(p[1]!), 1] as Pt) });
    if (b.clamp) { const z0 = Math.min(...b.zs) - b.h / 2, z1 = Math.max(...b.zs) + b.h / 2; add({ id: 'bumperClamp', material: 'chrome', surface: 'flat', z: 25.5, slot: sl, pts: [[b.clamp - 22, z0, 1], [b.clamp + 22, z0, 1], [b.clamp + 22, z1, 1], [b.clamp - 22, z1, 1]] }); } });
  (s.bumpers || []).forEach((b: any) => { const pts = sharp(b.pts); add({ id: 'bumper', pts, material: mat(b.ramp ?? 'chrome'), surface: 'side', z: 25, slot: bs(cx(pts)), bevel: 1.5 }); });
  // lamps, then the parts in front (lamp buckets, trunk, brackets...)
  (s.lamps || []).forEach((l: any) => { if (!l.e) return; const front = l.ramp === 'lensW';
    if (l.bezel) add({ id: 'bezel', pts: ellipse([l.e[0], l.e[1], l.e[2] + 14, l.e[3] + 14]), material: 'chrome', surface: 'fender', z: 28, slot: front ? 'lamp' : 'tail', rigid: true, bevel: 2 });
    add({ id: front ? 'lens' : 'tailLens', pts: ellipse(l.e), material: front ? 'lens' : 'lensR', surface: 'flat', z: 28.5, slot: front ? 'lamp' : 'tail', rigid: true }); });
  parts.forEach((p, i) => { if (p.behind) return; const pts = shape(p); if (pts) add({ id: 'part', pts, material: mat(p.ramp, p.chrome), surface: p.e ? 'fender' : 'side', z: (p.e && near(pts, lw, 190) ? 27 : 30) + i * 0.01, slot: slotOf(pts, p), rigid: true, bevel: p.e ? 6 : 1.5 }); });
  // details
  (s.doors || []).forEach((dr: any) => features.push({ kind: 'seam', pts: sharp(dr) }));
  (s.louvres || []).forEach((l: any) => features.push({ kind: 'louvres', x0: Math.round(l.x0), x1: Math.round(l.x1), z0: Math.round(l.z0 ?? g.r + 300), z1: Math.round(l.z1 ?? g.beltZ - 120), n: Math.max(4, Math.round((l.x1 - l.x0) / ((l.step ?? 28) * 2.2))), slant: 0.06 }));
  (s.trim || []).forEach((t: any) => features.push(t.ramp === 'chrome' || (!t.ramp && (t.w ?? 1) >= 2) ? { kind: 'trim', pts: sharp(t.pts), width: t.w ?? 1 } : { kind: 'seam', pts: sharp(t.pts), lit: t.ramp !== 'black' }));
  (s.handles || []).forEach((h: any) => features.push({ kind: 'handle', at: [Math.round(h[0]), Math.round(h[1])], len: 110 }));
  // wheels and spares
  const ws = s.wheel || {}, style: WheelSpec['style'] = ws.style === 'wire' ? 'wire' : ws.style === 'artillery' || ws.style === 'wood' ? 'artillery' : 'disc';
  const mk = (x: number): WheelSpec => ({ x: Math.round(x), r: Math.round(R), rim: +(1 - (ws.tireFrac ?? T?.frac ?? 0.3)).toFixed(2), style, spokes: ws.spokes ?? 12, rimMaterial: style === 'wire' ? 'chrome' : 'paint', whitewall: ws.whitewall ? Math.min(0.45, ws.whitewall) : undefined, zOrder: 5 });
  const wheels: WheelSpec[] = (s.wheels as any[]).map(w => mk(w.x));
  (s.spares || []).forEach((sp: any) => wheels.push({ ...mk(sp.x), z: Math.round(sp.z), spare: true, zOrder: 21.5, style: 'disc', rimMaterial: 'paint', rim: 0.8, whitewall: undefined }));
  const [paint, paint2] = PAINT[id]!;
  return { id, name: baseName(id), year, length: s.len, height: s.height, paint, paint2, panels, features, wheels, frame: s.frame === 'chrome' ? 'chrome' : 'reveal',
    marks: { fx: Math.round(g.F), rx: Math.round(g.R), r: Math.round(R), gap: Math.round(g.gap), cowl: Math.round(g.cowlX), cab: Math.round(g.roofR), belt: Math.round(g.beltZ), roof: Math.round(g.H) } };
}
mkdirSync('data/cars', { recursive: true });
for (const id of IDS) { const c = convert(id); writeFileSync(`data/cars/${id}.json`, JSON.stringify(c)); console.log(id, c.panels.length, 'panels', c.features.length, 'details', c.panels.filter(p => p.slot).map(p => p.slot![0]).join('')); }
