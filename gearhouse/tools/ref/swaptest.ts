// The parts-exchange test (reviews 60, 65): a car's slot (grille, lamps, bumpers, wings, boards, tail lamp, wheels) is
// taken off and another car's parts for the same slot are put on, fitted to the place the base car's own parts took
// (each view's box: the donor's slot is moved and scaled onto the base's). The first form of the part builder's
// "put another car's part on": it shows whether the parts, as made from the sheets, can be exchanged.
// npx tsx tools/ref/swaptest.ts <base json> <out dir> <slot>=<donor json> [...]   (slot "wheel" takes the donor's wheel spec)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { viewDesign, type CarModel, type CarPart } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import { encodePNG } from '../png';

type Box4 = [number, number, number, number];
const load = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as CarModel;
const base = load(process.argv[2]!), out = process.argv[3]!; mkdirSync(out, { recursive: true });
const swaps = process.argv.slice(4).map(a => { const [slot, f] = a.split('='); return { slot: slot!, donor: load(f!), name: f!.split('/').pop()!.replace('.json', '') }; });
/** the union of a slot's sheet boxes in one view */
const union = (parts: CarPart[], v: string): Box4 | null => { let b: Box4 | null = null; for (const p of parts) { const s = p.sheet?.[v as 'side']; if (!s) continue; b = b ? [Math.min(b[0], s[0]), Math.max(b[1], s[1]), Math.min(b[2], s[2]), Math.max(b[3], s[3])] : [...s] as Box4; } return b; };
const map = (s: Box4, from: Box4, to: Box4): Box4 => { const fa = (t: number) => to[0] + (t - from[0]) * (to[1] - to[0]) / Math.max(1, from[1] - from[0]), fb = (t: number) => to[2] + (t - from[2]) * (to[3] - to[2]) / Math.max(1, from[3] - from[2]); return [fa(s[0]), fa(s[1]), fb(s[2]), fb(s[3])].map(Math.round) as Box4; };
const AX: Record<string, [string, string]> = { side: ['x', 'z'], front: ['y', 'z'], rear: ['y', 'z'], top: ['x', 'y'] };

function swap(m: CarModel, slot: string, donor: CarModel): CarModel {
  const r = JSON.parse(JSON.stringify(m)) as CarModel;
  if (slot === 'wheel') { r.wheel = JSON.parse(JSON.stringify(donor.wheel)); return r; }
  const mine = r.parts.filter(p => p.slot === slot), theirs = JSON.parse(JSON.stringify(donor.parts.filter(p => p.slot === slot))) as CarPart[];
  if (!mine.length || !theirs.length) { console.log(`${slot}: ${!mine.length ? 'the base has none' : 'the donor has none'}`); return r; }
  // pairs (left and right lamps, wings) are fitted to the base's pairs, single middle parts (a tie bar, a grille) to its middle
  // parts; a donor without the base's middle part simply has none
  for (const pair of [true, false]) {
    const m2 = mine.filter(p => !!p.pair === pair), t2 = theirs.filter(p => !!p.pair === pair), ref = m2.length ? m2 : mine;
    for (const v of ['side', 'front', 'rear', 'top']) {
      const to = union(ref, v), from = union(t2, v); if (!to || !from) continue;
      for (const p of t2) { const s = p.sheet?.[v as 'side']; if (s) p.sheet![v as 'side'] = map(s as Box4, from, to); }
    }
  }
  for (const p of theirs) {                      // the common box again from the moved views
    const got: Record<string, number[][]> = {};
    for (const [v, s] of Object.entries(p.sheet ?? {})) { const [a, b] = AX[v]!; (got[a] ??= []).push([s![0], s![1]]); (got[b] ??= []).push([s![2], s![3]]); }
    for (const [ax, g] of Object.entries(got)) if (ax !== 'y' || !p.pair) (p.box as Record<string, number[]>)[ax] = [Math.round(g.reduce((t, q) => t + q[0]!, 0) / g.length), Math.round(g.reduce((t, q) => t + q[1]!, 0) / g.length)];
    p.id = 'x_' + p.id; if (p.on) p.on = 'x_' + p.on;
  }
  const at = r.parts.indexOf(mine[0]!); r.parts = r.parts.filter(p => p.slot !== slot); r.parts.splice(Math.min(at, r.parts.length), 0, ...theirs);
  return r;
}
const draw = (m: CarModel, name: string) => { for (const v of ['left', 'front'] as const) { const im = rasterizeFlat(viewDesign(m, v), { mm: 10, shadow: true }); writeFileSync(`${out}/${name}_${v}.png`, encodePNG(im.w, im.h, im.rgba)); } };
draw(base, '0_base'); let all = base;
swaps.forEach((s, k) => { draw(swap(base, s.slot, s.donor), `${k + 1}_${s.slot}_${s.name}`); all = swap(all, s.slot, s.donor); });
draw(all, `${swaps.length + 1}_all`); writeFileSync(`${out}/all.json`, JSON.stringify(all));
