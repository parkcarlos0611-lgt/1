// Draw traced designs with the game's own body renderer, to set beside their sources.
// npx tsx tools/ref/render.ts <dir with *.json> 
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { rasterize } from '../../render/car/raster';
import { encodePNG } from '../png';
import type { CarDesign } from '../../render/car/types';
const dir = process.argv[2]!;
for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) { const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as CarDesign, img = rasterize(d);
  writeFileSync(`${dir}/${f.replace('.json', '')}_game.png`, encodePNG(img.w, img.h, img.rgba)); console.log(f, `${img.w}x${img.h}`, img.ms.toFixed(0) + ' ms', 'ground', img.groundY); }
