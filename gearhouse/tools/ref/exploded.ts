// A car's part model taken apart for looking at (review 63): its four views, the side view in groups (roof, body,
// wings and boards, lamps-radiator-bumpers, wheels, chassis) each drawn alone on the same frame so they can be laid out
// apart, and every part alone in the side view (or the first view it shows in) with its name, slot and material.
// npx tsx tools/ref/exploded.ts <model json> <out dir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { viewDesign, type CarModel, type ViewName, type CarPart } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import { encodePNG } from '../png';
const m = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as CarModel, out = process.argv[3]!; mkdirSync(`${out}/parts`, { recursive: true });
const MM = 10;
const GROUP: Record<string, string> = { roof: 'roof', screen: 'body', body: 'body', hood: 'body', cowl: 'body', radiator: 'front', lamp: 'front', bumperF: 'front', bumperR: 'rear', tail: 'rear', spare: 'rear',
  fenderF: 'wings', fenderR: 'wings', board: 'wings', apron: 'wings', wheel: 'wheels' };
const groupOf = (p: CarPart) => (p.layer === 'chassis' ? 'chassis' : GROUP[p.element] ?? 'chassis');
for (const v of ['left', 'front', 'rear', 'top'] as ViewName[]) { const im = rasterizeFlat(viewDesign(m, v), { mm: MM, shadow: v !== 'top' }); writeFileSync(`${out}/view_${v}.png`, encodePNG(im.w, im.h, im.rgba)); }
// the groups: the model's wheels belong to the model, not to a part, so the wheel group is drawn with the wheels alone
for (const g of ['roof', 'body', 'front', 'rear', 'wings', 'wheels', 'chassis']) {
  const d = g === 'wheels' ? viewDesign(m, 'left') : viewDesign(m, 'left', p => groupOf(p) === g, { chassis: g === 'chassis' });
  if (g !== 'wheels') d.wheels = []; else d.panels = [];          // the wheels are the model's own, drawn from its wheel spec
  const im = rasterizeFlat(d, { mm: MM, shadow: false }); writeFileSync(`${out}/group_${g}.png`, encodePNG(im.w, im.h, im.rgba)); }
const list: { id: string; element: string; slot?: string; material: string; group: string; view: string; size: number[] }[] = [];
for (const p of m.parts) { for (const v of ['left', 'front', 'rear', 'top'] as ViewName[]) { const d = viewDesign(m, v, q => q.id === p.id, { chassis: p.layer === 'chassis' }); d.wheels = []; if (!d.panels.length) continue;
    const im = rasterizeFlat(d, { mm: 6, shadow: false }); writeFileSync(`${out}/parts/${p.id}.png`, encodePNG(im.w, im.h, im.rgba));
    list.push({ id: p.id, element: p.element, slot: p.slot, material: p.material, group: groupOf(p), view: v, size: [p.box.x[1] - p.box.x[0], (p.box.y[1] - p.box.y[0]) * (p.pair ? 2 : 1), p.box.z[1] - p.box.z[0]] }); break; } }
writeFileSync(`${out}/parts.json`, JSON.stringify({ id: m.id, name: m.name, year: m.year, length: m.length, width: m.width, height: m.height, paint: m.paint, wheel: m.wheel, parts: list }, null, 1));
