// Draw a car's 3D part model (render/car/model.ts): its five views, and every part alone in every view it has, for
// the parts check sheet. npx tsx tools/ref/modelviews.ts <model json> <out dir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { viewDesign, type CarModel, type ViewName } from '../../render/car/model';
import { mirrorSide } from '../../render/car/mirror';
import { rasterizeFlat } from '../../render/car/flat';
import { encodePNG } from '../png';
const m = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as CarModel, out = process.argv[3]!; mkdirSync(`${out}/parts`, { recursive: true });
const draw = (view: ViewName, only?: Parameters<typeof viewDesign>[2]) => { const d = view === 'right' ? mirrorSide(viewDesign(m, 'left', only)) : viewDesign(m, view, only); return { d, im: rasterizeFlat(d, { shadow: !only }) }; };
for (const v of ['left', 'right', 'front', 'rear', 'top'] as ViewName[]) { const { d, im } = draw(v); writeFileSync(`${out}/${m.id}_${v}.json`, JSON.stringify(d)); writeFileSync(`${out}/${m.id}_${v}_flat.png`, encodePNG(im.w, im.h, im.rgba)); }
for (const v of ['left', 'front', 'rear', 'top'] as ViewName[]) { const d = viewDesign(m, v, undefined, { chassis: true }); const im = rasterizeFlat(d, { shadow: true }); writeFileSync(`${out}/${m.id}_${v}_chassis.json`, JSON.stringify(d)); writeFileSync(`${out}/${m.id}_${v}_chassis_flat.png`, encodePNG(im.w, im.h, im.rgba)); }
const list: { id: string; element: string; material: string; box: unknown; views: string[] }[] = [];
for (const p of m.parts) { const views: string[] = [];
  for (const v of ['left', 'front', 'rear', 'top'] as ViewName[]) { const { d, im } = draw(v, q => q.id === p.id); if (!d.panels.length && !d.wheels.length) continue; views.push(v); writeFileSync(`${out}/parts/${p.id}_${v}.png`, encodePNG(im.w, im.h, im.rgba)); }
  list.push({ id: p.id, element: p.element, material: p.material, box: p.box, views }); }
writeFileSync(`${out}/parts/list.json`, JSON.stringify(list)); console.log(m.id, m.parts.length, 'parts,', list.reduce((a, p) => a + p.views.length, 0), 'part pictures');
