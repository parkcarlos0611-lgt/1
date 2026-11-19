// The named elements of a hand-written body, as rough regions for tools/ref/capture.py: every panel (parts expanded)
// with its place, layer and material, chrome strips, and the wheels. npx tsx tools/ref/roles.ts <body.json>
import { readFileSync } from 'node:fs';
import { paintRamp } from '../../render/car/flat';
import { expandParts } from '../../render/car/parts';
import type { CarDesign } from '../../render/car/types';
const d = expandParts(JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as CarDesign);
console.log(JSON.stringify({ ramp: paintRamp(d.paint), id: d.id, length: d.length, height: d.height, paint: d.paint,
  panels: d.panels.map(p => ({ id: p.id, slot: p.slot ?? null, z: p.z, material: p.material, clip: p.clip ?? null, cut: p.cut ?? [], surface: p.surface, pts: p.pts.map(q => [q[0], q[1]]) })),
  trims: d.features.filter(f => f.kind === 'trim').map(f => (f as { pts: number[][] }).pts.map(q => [q[0], q[1]])),
  wheels: d.wheels.map(w => ({ x: w.x, r: w.r, rim: w.rim })) }));
