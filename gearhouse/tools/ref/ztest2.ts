// The same changes made to a car held as ZY2 (cells on the game ramps) and as Z2 (shapes on the game ramps):
// longer, repainted, lamps and wheels taken from another car with their own detail, elements pulled apart, and drawn
// at two other scales. npx tsx tools/ref/ztest2.ts <id> <donor id> <out dir>   (data/bodies, data/skins, data/decals)
import { readFileSync, writeFileSync } from 'node:fs';
import { rasterizeFlat } from '../../render/car/flat';
import { expandParts, type PartSpec } from '../../render/car/parts';
import { buildCar, newEdit } from '../../render/car/edit';
import { encodePNG } from '../png';
import type { CarDesign } from '../../render/car/types';
const [id, donor, out] = process.argv.slice(2) as [string, string, string];
const J = (p: string) => JSON.parse(readFileSync(p, 'utf8')), clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
const save = (name: string, img: { w: number; h: number; rgba: Uint8ClampedArray }) => writeFileSync(`${out}/${name}.png`, encodePNG(img.w, img.h, img.rgba));
const PAINT = '#7a1420';
for (const m of ['zy2', 'z2'] as const) {
  const load = (k: string): CarDesign => { const d = J(`data/bodies/${k}.json`) as CarDesign; if (m === 'zy2') d.skin = J(`data/skins/${k}.json`); else d.decals = J(`data/decals/${k}.json`); return d; };
  const D0 = load(id), DN = load(donor), t = performance.now();
  save(`${m}_base`, rasterizeFlat(D0));
  const exp = (d: CarDesign) => { const e = expandParts(d); delete e.parts; return e; };
  save(`${m}_long`, rasterizeFlat(buildCar({ z: exp(D0) }, { ...newEdit('z'), prop: { frontOH: 0, hood: 150, cabin: 315, rearOH: 0, body: 1, green: 1 } })));
  save(`${m}_paint`, rasterizeFlat({ ...D0, paint: PAINT }));
  { // the donor's lamp and wheels, each with the detail its own view gave it
    const d = clone(D0), lampAt = (d.parts!.find(p => p.kind === 'lamp') as { at: [number, number] }).at, dl = DN.parts!.find(p => p.kind === 'lamp')!, wl = DN.wheels.find(w => !w.spare)!;
    d.parts = d.parts!.map((p): PartSpec => (p.kind === 'lamp' ? { ...(dl as PartSpec & { at: [number, number] }), at: [lampAt[0], lampAt[1] + 30] } : p));
    d.wheels = d.wheels.map(w => ({ ...w, style: wl.style, spokes: wl.spokes, rim: wl.rim, whitewall: wl.whitewall, rimMaterial: wl.rimMaterial }));
    const li = DN.parts!.indexOf(dl), mine = d.parts!.findIndex(p => p.kind === 'lamp'), from = (k: string) => k.replace(`lamp${li}_`, `lamp${mine}_`);
    if (m === 'zy2') { for (const k of Object.keys(d.skin!.elements)) if (k.startsWith(`lamp${mine}_`)) delete d.skin!.elements[k]; for (const [k, v] of Object.entries(DN.skin!.elements)) if (k.startsWith(`lamp${li}_`) || k.startsWith('wheel')) d.skin!.elements[from(k)] = v; }
    else { for (const k of Object.keys(d.decals!)) if (k.startsWith(`lamp${mine}_`)) delete d.decals![k]; for (const [k, v] of Object.entries(DN.decals!)) if (k.startsWith(`lamp${li}_`) || k.startsWith('wheel')) d.decals![from(k)] = v; }
    save(`${m}_swap`, rasterizeFlat(d)); }
  { // pulled apart: each element moved its own way
    const d = exp(clone(D0)), PUSH = 700, LIFT = 320; d.features = [];
    const OFF: Record<string, [number, number]> = { hood: [-330, 260], cowl: [-110, 420], roof: [120, 520], door: [60, 120], sill: [60, -40], quarter: [420, 260], tail: [640, 150], back: [420, 260] };
    const slotOff: Record<string, [number, number]> = { fenderF: [-330, -180], fenderR: [420, -180], grille: [-620, 260], lamp: [-560, 40], bumperF: [-420, -180], bumperR: [760, -180], tail: [760, 150], board: [60, -260] };
    for (const p of d.panels) { const o = p.element ? OFF[p.element] ?? [0, 0] : p.slot ? slotOff[p.slot] ?? [0, 0] : [0, 0];
      for (const q of p.pts) { q[0] += o[0] + PUSH; q[1] += o[1] + LIFT; } for (const c of p.cut ?? []) { c.x += o[0] + PUSH; c.z += o[1] + LIFT; } }
    d.panels = d.panels.filter(p => p.material !== 'shadow' && !p.id.startsWith('under') && p.material !== 'glass' && !p.clip);
    for (const w of d.wheels) { w.z = w.r + LIFT - 180; w.x += PUSH; } d.length += PUSH * 2 + 200; d.height += LIFT + 620; save(`${m}_apart`, rasterizeFlat(d, { shadow: false })); }
  save(`${m}_mm7`, rasterizeFlat(D0, { mm: 7 })); save(`${m}_mm15`, rasterizeFlat(D0, { mm: 15 }));
  console.log(m, 'seven drawings in', (performance.now() - t).toFixed(0), 'ms'); }
