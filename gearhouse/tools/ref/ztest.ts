// The same four changes made to one car held two ways (decision of 2026-11-19): as a captured pixel map (Y) and as
// fitted elements (Z). Longer by a tenth, another paint, other lamps and wheels, and the elements pulled apart.
// npx tsx tools/ref/ztest.ts <body z json> <its captured map json> <donor map json> <out dir> [skin json: method ZY]
import { readFileSync, writeFileSync } from 'node:fs';
import { rasterizeFlat } from '../../render/car/flat';
import { expandParts } from '../../render/car/parts';
import { buildCar, newEdit } from '../../render/car/edit';
import { drawMap, type CarMap } from '../../render/car/mapped';
import { encodePNG } from '../png';
import type { CarDesign, Pt } from '../../render/car/types';
import type { PartSpec } from '../../render/car/parts';
const [zPath, yPath, donorPath, out, skinPath] = process.argv.slice(2) as [string, string, string, string, string | undefined];
const Z0 = JSON.parse(readFileSync(zPath, 'utf8')) as CarDesign, Y0 = JSON.parse(readFileSync(yPath, 'utf8')) as CarMap, DON = JSON.parse(readFileSync(donorPath, 'utf8')) as CarMap;
if (skinPath) Z0.skin = JSON.parse(readFileSync(skinPath, 'utf8'));
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
const save = (name: string, img: { w: number; h: number; rgba: Uint8ClampedArray }) => { writeFileSync(`${out}/${name}.png`, encodePNG(img.w, img.h, img.rgba)); console.log(name, `${img.w}x${img.h}`); };
const PAINT = '#7a1420', HOOD = 150, CABIN = 315;

// ---------------- Z: change the figures, then draw ----------------
const zExp = (d: CarDesign) => { const e = expandParts(d); delete e.parts; return e; };
save('z_base', rasterizeFlat(Z0));
const long = buildCar({ z: zExp(Z0) }, { ...newEdit('z'), prop: { frontOH: 0, hood: HOOD, cabin: CABIN, rearOH: 0, body: 1, green: 1 } }); save('z_long', rasterizeFlat(long));
save('z_paint', rasterizeFlat({ ...Z0, paint: PAINT, paint2: PAINT }));
{ const d = clone(Z0); d.parts = d.parts!.map((p): PartSpec => (p.kind === 'lamp' && p.form === 'pod' ? { kind: 'lamp', form: 'bullet', d: 200, len: 250, stand: true, at: [p.at[0] - 40, p.at[1] + 60] } : p));
  d.wheels = d.wheels.map(w => ({ ...w, style: 'wire' as const, spokes: 36, whitewall: 0.3, rim: 0.62 })); save('z_swap', rasterizeFlat(d)); }
const OFF: Record<string, [number, number]> = { 'body.hood': [-330, 260], 'body.cowl': [-110, 420], 'body.roof': [120, 520], 'body.door': [60, 120], 'body.sill': [60, -40], 'body.quarter': [420, 260], 'body.tail': [640, 150],
  glass: [-110, 420], glass2: [60, 120], inside: [60, 120], glass3: [420, 260], fenderF: [-330, -180], fenderR: [420, -180], mascot: [-330, 260], board: [60, -260], boardTrim: [60, -260], apron: [60, -260] };
const slotOff: Record<string, [number, number]> = { grille: [-620, 260], lamp: [-560, 40], bumperF: [-420, -180], bumperR: [760, -180], tail: [760, 150] };
{ const d = zExp(clone(Z0)), LIFT = 320, PUSH = 700; d.features = [];
  for (const p of d.panels) { const o = OFF[p.id] ?? (p.slot ? slotOff[p.slot] : undefined) ?? [0, 0]; for (const q of p.pts) { q[0] += o[0] + PUSH; q[1] += o[1] + LIFT; } for (const c of p.cut ?? []) { c.x += o[0] + PUSH; c.z += o[1] + LIFT; }
    if (p.clip === 'body') p.clip = Object.keys(OFF).find(k => k.startsWith('body.') && OFF[k]![0] === o[0] && OFF[k]![1] === o[1]) ?? 'body'; }
  d.panels = d.panels.filter(p => p.material !== 'shadow' && !p.id.startsWith('under'));
  for (const w of d.wheels) { w.z = w.r + LIFT - 180; w.x += PUSH; } d.length += PUSH * 2 + 200; d.height += LIFT + 620; save('z_apart', rasterizeFlat(d, { shadow: false })); }

// ---------------- Y: change the picture ----------------
const unrle = (a: number[], n: number) => { const o = new Int16Array(n); let p = 0; for (let i = 0; i < a.length; i += 2) { o.fill(a[i]!, p, p + a[i + 1]!); p += a[i + 1]!; } return o; };
const rle = (a: Int16Array) => { const o: number[] = []; let s = 0; for (let i = 1; i <= a.length; i++) if (i === a.length || a[i] !== a[s]) { o.push(a[s]!, i - s); s = i; } return o; };
interface Grid { w: number; h: number; e: Int16Array; m: Int16Array; l: Int16Array }
const open = (M: CarMap): Grid => ({ w: M.w, h: M.h, e: unrle(M.e, M.w * M.h), m: unrle(M.m, M.w * M.h), l: unrle(M.l, M.w * M.h) });
const close = (M: CarMap, g: Grid): CarMap => ({ ...M, w: g.w, h: g.h, length: g.w * M.mm, height: g.h * M.mm, e: rle(g.e), m: rle(g.m), l: rle(g.l) });
const blank = (w: number, h: number): Grid => ({ w, h, e: new Int16Array(w * h).fill(-1), m: new Int16Array(w * h), l: new Int16Array(w * h) });
save('y_base', drawMap(Y0));
save('y_paint', drawMap(Y0, { paint: PAINT }));
{ // longer: the same stations stretched; a picture can only repeat its columns
  const probe = clone(zExp(Z0)); probe.panels = [{ id: 'probe', pts: Array.from({ length: Y0.w + 1 }, (_, i) => [i * Y0.mm, 0, 1] as Pt), material: 'paint', surface: 'side', z: 0 }]; probe.features = [];
  const xs = buildCar({ z: probe }, { ...newEdit('z'), prop: { frontOH: 0, hood: HOOD, cabin: CABIN, rearOH: 0, body: 1, green: 1 } }).panels[0]!.pts.map(q => q[0] / Y0.mm);
  const g = open(Y0), W2 = Math.round(xs.at(-1)!), o = blank(W2, g.h);
  for (let x = 0; x < W2; x++) { let k = 0; while (k < xs.length - 2 && xs[k + 1]! <= x + 0.5) k++; const sx = Math.min(g.w - 1, Math.floor(k + (x + 0.5 - xs[k]!) / Math.max(1e-6, xs[k + 1]! - xs[k]!)));
    for (let y = 0; y < g.h; y++) { o.e[y * W2 + x] = g.e[y * g.w + sx]!; o.m[y * W2 + x] = g.m[y * g.w + sx]!; o.l[y * W2 + x] = g.l[y * g.w + sx]!; } }
  save('y_long', drawMap(close(Y0, o))); }
const idsOf = (M: CarMap, pred: (id: string) => boolean) => new Set(M.elements.filter(e => pred(e.id)).map(e => e.k));
const boxOf = (g: Grid, ks: Set<number>) => { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 0; i < g.e.length; i++) if (ks.has(g.e[i]!)) { const x = i % g.w, y = (i / g.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1 }; };
{ // other lamps and wheels: cut the element out, paste the donor car's element in its place
  const g = open(Y0), dg = open(DON), tm = (name: string) => Math.max(0, Y0.materials.indexOf(name));
  for (const pred of [(id: string) => id.startsWith('lamp'), (id: string) => id === 'wheelF', (id: string) => id === 'wheelR']) {
    const mine = idsOf(Y0, pred), theirs = idsOf(DON, pred), a = boxOf(g, mine), b = boxOf(dg, theirs), dx = Math.round((a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2), dy = pred('wheelF') || pred('wheelR') ? a.y1 - b.y1 : Math.round((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2), keep = [...mine][0]!;
    for (let i = 0; i < g.e.length; i++) if (mine.has(g.e[i]!)) g.e[i] = -1;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const i = y * dg.w + x; if (!theirs.has(dg.e[i]!)) continue; const X = x + dx, Yy = y + dy; if (X < 0 || Yy < 0 || X >= g.w || Yy >= g.h) continue; const j = Yy * g.w + X; g.e[j] = keep; g.m[j] = tm(DON.materials[dg.m[i]!]!); g.l[j] = dg.l[i]!; } }
  save('y_swap', drawMap(close(Y0, g))); }   // the donor's pixels take this car's tones: a map has one set of tones per material
{ // apart: every element moved by the same amounts as in Z
  const g = open(Y0), LIFT = 32, PUSH = 70, W2 = g.w + PUSH * 2 + 20, H2 = g.h + LIFT + 62, o = blank(W2, H2), name = new Map(Y0.elements.map(e => [e.k, e]));
  const order = [...name.values()].sort((a, b) => a.z - b.z);
  for (const el of order) { const off = OFF[el.id] ?? (el.slot && el.slot !== 'wheel' ? slotOff[el.slot] : undefined) ?? [0, 0], dx = Math.round(off[0] / Y0.mm) + PUSH, dy = -Math.round(off[1] / Y0.mm) + (H2 - g.h) - LIFT + (el.slot === 'wheel' ? 18 : 0);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const i = y * g.w + x; if (g.e[i] !== el.k) continue; const X = x + dx, Yy = y + dy; if (X < 0 || Yy < 0 || X >= W2 || Yy >= H2) continue; const j = Yy * W2 + X; o.e[j] = el.k; o.m[j] = g.m[i]!; o.l[j] = g.l[i]!; } }
  save('y_apart', drawMap(close(Y0, o))); }
