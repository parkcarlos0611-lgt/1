// Draw traced designs with the game's two body renderers, to set beside their sources:
// <id>_game.png (gloss: reflections, many tones) and <id>_flat.png (the first build's manner).
// npx tsx tools/ref/render.ts <dir with *.json>
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { rasterize } from '../../render/car/raster';
import { rasterizeFlat } from '../../render/car/flat';
import { encodePNG } from '../png';
import type { CarDesign } from '../../render/car/types';
const dir = process.argv[2]!;
for (const f of readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.skin.json') && !f.endsWith('.decals.json'))) { const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as CarDesign; const sk = `${dir}/${f.replace('.json', '.skin.json')}`; if (existsSync(sk)) d.skin = JSON.parse(readFileSync(sk, 'utf8')); const dc = `${dir}/${f.replace('.json', '.decals.json')}`; if (existsSync(dc)) d.decals = JSON.parse(readFileSync(dc, 'utf8'));
  const mm = Number(process.env.MM ?? 10);
  for (const [tag, img] of [['game', rasterize(d, { frameW: 2, tone: 1.6 })], ['flat', rasterizeFlat(d, { mm })]] as const) { writeFileSync(`${dir}/${f.replace('.json', '')}_${tag}.png`, encodePNG(img.w, img.h, img.rgba)); console.log(f, tag, `${img.w}x${img.h}`, img.ms.toFixed(0) + ' ms'); } }
