// The 1948 utility driven over the test course (ui/course.ts) at a steady 15 km/h, written out as frames: top as
// seen, bottom with the body as a line. npx tsx tools/ref/rigdemo.ts <out dir> [seconds]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { DriveScene, LR48_LAYOUT } from '../../render/car/scene';
import { Canvas } from '../../render/car/running';
import { Rig, UTILITY48 } from '../../physics/rig';
import { COURSE, kind } from '../../ui/course';
import { encodePNG } from '../png';
import type { CarDesign } from '../../render/car/types';
const out = process.argv[2]!; mkdirSync(out, { recursive: true });
const J = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as CarDesign;
const rig = new Rig(UTILITY48, COURSE, 3); rig.run(1.0);
const scene = new DriveScene(rig, COURSE, kind, { body: J('data/bodies/lr48_right.json'), chassis: J('data/bodies/lr48_chassis_right.json') }, LR48_LAYOUT);
await scene.build();
const FPS = 20, frames = Math.round(Number(process.argv[3] ?? 8) * FPS), W = scene.W, H = scene.H, a = new Canvas(W, H), b = new Canvas(W, H);
for (let f = 0; f < frames; f++) {
  rig.throttle = Math.max(0, Math.min(1, (4.2 - rig.vx) * 0.7)); rig.run(1 / FPS); scene.step(1 / FPS);
  scene.xray = false; scene.draw(a); scene.xray = true; scene.draw(b);
  const img = new Uint8ClampedArray(W * H * 8); img.set(a.rgba, 0); img.set(b.rgba, W * H * 4); writeFileSync(`${out}/f${String(f).padStart(4, '0')}.png`, encodePNG(W, H * 2, img));
}
console.log(frames, 'frames in', out);
