// npx tsx tools/ref/drawmap.ts <map.json> <out.png> [paint=#rrggbb] [height=mm] [length=mm] [wheelTop=mm] [elements=1]
import { readFileSync, writeFileSync } from 'node:fs';
import { drawMap, type CarMap } from '../../render/car/mapped';
import { encodePNG } from '../png';
const M = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as CarMap, o = Object.fromEntries(process.argv.slice(4).map(a => a.split('='))) as Record<string, string>;
const img = drawMap(M, { paint: o.paint, height: o.height ? +o.height : undefined, length: o.length ? +o.length : undefined, wheelTop: o.wheelTop ? +o.wheelTop : undefined });
if (o.elements) for (let i = 0; i < img.w * img.h; i++) { const e = img.element[i]!; if (e < 0) continue; const hsh = (e * 2654435761) >>> 0; img.rgba[i * 4] = 60 + (hsh & 127); img.rgba[i * 4 + 1] = 60 + ((hsh >> 8) & 127); img.rgba[i * 4 + 2] = 60 + ((hsh >> 16) & 127); }
writeFileSync(process.argv[3]!, encodePNG(img.w, img.h, img.rgba)); console.log(process.argv[3], `${img.w}x${img.h}`);
