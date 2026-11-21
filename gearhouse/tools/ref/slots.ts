// Where each part sits on a body, in mm: the box of every slot's panels and of each wheel. npx tsx tools/ref/slots.ts <body.json>
import { readFileSync } from 'node:fs';
import { expandParts } from '../../render/car/parts';
import type { CarDesign } from '../../render/car/types';
const d = expandParts(JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as CarDesign), box: Record<string, number[]> = {};
for (const p of d.panels) { if (!p.slot) continue; const b = box[p.slot] ??= [1e9, 1e9, -1e9, -1e9]; for (const [x, z] of p.pts) { b[0] = Math.min(b[0]!, x); b[1] = Math.min(b[1]!, z); b[2] = Math.max(b[2]!, x); b[3] = Math.max(b[3]!, z); } }
d.wheels.forEach((w, k) => { box['wheel' + (k ? 'R' : 'F')] = [w.x - w.r, 0, w.x + w.r, 2 * w.r]; });
console.log(JSON.stringify(box));
