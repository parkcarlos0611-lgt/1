// The conversion trial's pictures (review 62): one model's side view at the three sizes the game draws cars (the
// street at 27 mm a pixel, the garage bay at 15, the bodywork stand at 5), and its front, rear and plan at 10.
// npx tsx tools/ref/trialviews.ts <model json> <out dir> <label>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { viewDesign, type CarModel, type ViewName } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import { encodePNG } from '../png';
const m = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as CarModel, out = process.argv[3]!, lab = process.argv[4]!; mkdirSync(out, { recursive: true });
for (const mm of [27, 15, 5]) { const im = rasterizeFlat(viewDesign(m, 'left'), { mm, shadow: true }); writeFileSync(`${out}/${lab}_side${mm}.png`, encodePNG(im.w, im.h, im.rgba)); }
for (const v of ['front', 'rear', 'top'] as ViewName[]) { const im = rasterizeFlat(viewDesign(m, v), { mm: 10, shadow: v !== 'top' }); writeFileSync(`${out}/${lab}_${v}10.png`, encodePNG(im.w, im.h, im.rgba)); }
