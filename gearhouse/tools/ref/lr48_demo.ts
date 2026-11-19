// What method Z lets the game do with one car (the 1948 utility, left side): the tilt off, a longer wheelbase,
// another colour, other wheels. npx tsx tools/ref/lr48_demo.ts <design json> <out dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { rasterizeFlat } from '../../render/car/flat';
import { encodePNG } from '../png';
import type { CarDesign } from '../../render/car/types';
const d0 = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as CarDesign, out = process.argv[3]!, clone = (): CarDesign => JSON.parse(JSON.stringify(d0));
const save = (n: string, d: CarDesign) => { const im = rasterizeFlat(d); writeFileSync(`${out}/${n}.png`, encodePNG(im.w, im.h, im.rgba)); };
save('base', d0);
{ const d = clone(); d.panels = d.panels.filter(p => p.element !== 'tilt' && p.id !== 'upright' && p.id !== 'screen'); d.features = d.features.filter(f => !('pts' in f) || f.pts[0]![1] < 1010); save('open', d); }
{ // a longer wheelbase: everything behind the door moves back 500 mm, the tub and the tilt grow with it
  const d = clone(), DX = 500, AT = 2200, mv = (x: number) => (x > AT ? x + DX : x);
  for (const p of d.panels) { let a = 1e9, b = -1e9; for (const q of p.pts) { a = Math.min(a, q[0]); b = Math.max(b, q[0]); }
    if (b - a < 250) { const dx = mv((a + b) / 2) - (a + b) / 2; for (const q of p.pts) q[0] += dx; } else for (const q of p.pts) q[0] = mv(q[0]);   // small parts move whole
    for (const c of p.cut ?? []) c.x = mv(c.x); }
  for (const w of d.wheels) w.x = mv(w.x);
  for (const f of d.features) { if ('pts' in f) for (const q of f.pts) q[0] = mv(q[0]); if ('at' in f) f.at[0] = mv(f.at[0]); }
  const extra = clone().panels.find(p => p.id === 'strap2700')!; extra.id = 'strapX'; for (const q of extra.pts) q[0] += 260; d.panels.push(extra);
  d.length += DX; save('long', d); }
{ const d = clone(); d.paint = d.paint2 = '#4d5d6e'; d.canvas = '#d8d2c0'; save('paint', d); }
{ const d = clone(); d.wheels = d.wheels.map(w => ({ ...w, tread: false, capMaterial: 'chrome', cap: 0.55, capRings: 1, whitewall: 0 })); d.panels = d.panels.filter(p => p.id !== 'mirror'); save('wheels', d); }
console.log('five drawings in', out);
