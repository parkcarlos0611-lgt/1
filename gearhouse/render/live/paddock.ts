// Where the photographed props stand (review 125): the pits and paddock as they were on a race day of the period, laid
// by the track's own buildings (race/scenery.ts): oil drums and spare tyres stacked before each garage, a mechanic's
// crate and fuel cans; drums and cans by the fuel pumps; benches, tables and stools by the tea hut; a table of oil tins
// at the pit counter by the timing box. Positions by distance along the track and offset to its left (m); each a
// matrix for the renderer (the model's metres, sat on the ground, turned about the vertical, sometimes lying down).
import type { Track } from '../../race/track';
export interface PropPlace { id: string; s: number; off: number; turn: number; /** lying on its side (a drum or a tyre knocked over) */ lie?: boolean; up?: number }
export function paddockProps(): PropPlace[] { const out: PropPlace[] = []; let r = 1925; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const drumCluster = (s: number, off: number, n: number) => { for (let k = 0; k < n; k++) { const a = rnd() * Math.PI * 2, d = k ? 0.62 + rnd() * 0.15 : 0; out.push({ id: rnd() < 0.6 ? 'barrel_03' : 'Barrel_01', s: s + Math.cos(a) * d, off: off + Math.sin(a) * d, turn: rnd() * 6.28, lie: k === n - 1 && rnd() < 0.4 }); } };
  const tyreStack = (s: number, off: number, n: number) => { for (let k = 0; k < n; k++) out.push({ id: 'old_tyre', s: s + (rnd() - 0.5) * 0.06, off: off + (rnd() - 0.5) * 0.06, turn: rnd() * 6.28, lie: true, up: k }); };
  // before each garage bay (s 330..402, garages at offset 49): drums, a stack of spare tyres, a crate, fuel cans
  for (let s = 326; s <= 404; s += 14.5) { drumCluster(s - 3, 44.2, 2 + Math.floor(rnd() * 3)); tyreStack(s + 1.5, 44.6, 2 + Math.floor(rnd() * 3)); if (rnd() < 0.7) out.push({ id: 'old_military_crate', s: s + 3.8, off: 44.4, turn: (rnd() - 0.5) * 0.4 });
    for (let k = 0; k < 2; k++) if (rnd() < 0.6) out.push({ id: 'metal_jerrycan', s: s - 0.6 + k * 0.4, off: 45.6, turn: rnd() * 0.6 }); }
  // the fuel pumps (s 318, offset 29)
  drumCluster(312, 31.5, 5); drumCluster(324.5, 31.2, 3); for (let k = 0; k < 4; k++) out.push({ id: 'metal_jerrycan', s: 315.6 + k * 0.45, off: 27.6, turn: (rnd() - 0.5) * 0.3 }); out.push({ id: 'oil_tin', s: 321, off: 27.8, turn: rnd() * 6 });
  // the tea hut (s 248, offset 29): benches, tables and stools in front
  for (const [ds, doff] of [[-6, -4.2], [0, -4.6], [6, -4.2]] as const) { out.push({ id: 'WoodenTable_01', s: 248 + ds, off: 29 + doff, turn: Math.PI / 2 + (rnd() - 0.5) * 0.3 }); out.push({ id: 'painted_wooden_bench', s: 248 + ds, off: 29 + doff - 0.85, turn: Math.PI / 2 + (rnd() - 0.5) * 0.15 }); for (const q of [-0.6, 0.6]) out.push({ id: 'folding_wooden_stool', s: 248 + ds + q, off: 29 + doff + 0.8, turn: rnd() * 6 }); }
  // the pit counter by the timing box (s 120, offset 21): a table with oil tins, drums of oil, spare tyres
  out.push({ id: 'WoodenTable_01', s: 128, off: 19.2, turn: 0 }); for (let k = 0; k < 3; k++) out.push({ id: 'oil_tin', s: 127.6 + k * 0.35, off: 19.2, turn: rnd() * 6, up: -1 });
  drumCluster(132, 19.4, 3); tyreStack(135, 19.2, 3); tyreStack(136.2, 19.4, 2);
  return out; }
/** a pit row for any track (review 162), in the manner of Millbrook's: before each of `n` garages from s0 (14.5 m
 *  apart, their fronts at offset `off`) drums, a stack of spare tyres, a crate and fuel cans; drums and cans by the fuel
 *  pumps; a table of oil tins, drums and tyres at the pit counter by the timing box */
export function pitProps(seed: number, garages: { s0: number; n: number; off: number }, pumps: { s: number; off: number }, counter: { s: number; off: number }): PropPlace[] { const out: PropPlace[] = []; let r = seed; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const drumCluster = (s: number, off: number, n: number) => { for (let k = 0; k < n; k++) { const a = rnd() * Math.PI * 2, d = k ? 0.62 + rnd() * 0.15 : 0; out.push({ id: rnd() < 0.6 ? 'barrel_03' : 'Barrel_01', s: s + Math.cos(a) * d, off: off + Math.sin(a) * d, turn: rnd() * 6.28, lie: k === n - 1 && rnd() < 0.4 }); } };
  const tyreStack = (s: number, off: number, n: number) => { for (let k = 0; k < n; k++) out.push({ id: 'old_tyre', s: s + (rnd() - 0.5) * 0.06, off: off + (rnd() - 0.5) * 0.06, turn: rnd() * 6.28, lie: true, up: k }); };
  for (let k = 0; k < garages.n; k++) { const s = garages.s0 + k * 14.5, o = garages.off - 5; drumCluster(s - 3, o, 2 + Math.floor(rnd() * 3)); tyreStack(s + 1.5, o + 0.4, 2 + Math.floor(rnd() * 3)); if (rnd() < 0.7) out.push({ id: 'old_military_crate', s: s + 3.8, off: o + 0.2, turn: (rnd() - 0.5) * 0.4 });
    for (let j = 0; j < 2; j++) if (rnd() < 0.6) out.push({ id: 'metal_jerrycan', s: s - 0.6 + j * 0.4, off: o + 1.4, turn: rnd() * 0.6 }); }
  drumCluster(pumps.s - 6, pumps.off + 2.3, 4); for (let k = 0; k < 3; k++) out.push({ id: 'metal_jerrycan', s: pumps.s - 2.4 + k * 0.45, off: pumps.off - 1.6, turn: (rnd() - 0.5) * 0.3 }); out.push({ id: 'oil_tin', s: pumps.s + 3, off: pumps.off - 1.4, turn: rnd() * 6 });
  out.push({ id: 'WoodenTable_01', s: counter.s + 8, off: counter.off, turn: 0 }); for (let k = 0; k < 3; k++) out.push({ id: 'oil_tin', s: counter.s + 7.6 + k * 0.35, off: counter.off, turn: rnd() * 6, up: -1 });
  drumCluster(counter.s + 12, counter.off + 0.2, 3); tyreStack(counter.s + 15, counter.off, 3);
  return out; }
/** the matrices per model: `base` each model's lowest point and size (its own metres, z up) */
export function propMatrices(T: Track, places: PropPlace[], base: Record<string, { min: number[]; max: number[] }>): Map<string, Float32Array> { const by = new Map<string, number[]>();
  for (const p of places) { const b = base[p.id]; if (!b) continue; const pt = T.point(p.s, p.off), h = T.at(p.s).h + p.turn, c = Math.cos(h), s = Math.sin(h), cx = (b.min[0]! + b.max[0]!) / 2, cy = (b.min[1]! + b.max[1]!) / 2;
    let m: number[];
    const ground = pt.z > -0.5 && Math.abs(p.off) > T.spec.width / 2 ? -0.02 : pt.z;
    if (p.lie) { // lying: a quarter turn about its own x (its depth becoming its height); tyres stack flat, each on the last
      const hy = b.max[1]! - b.min[1]!, cz = (b.min[2]! + b.max[2]!) / 2, zc = ground + ((p.up ?? 0) + 0.5) * hy;
      m = [c, s, 0, 0, 0, 0, 1, 0, s, -c, 0, 0, pt.x - (c * cx + s * cz), pt.y - (s * cx - c * cz), zc - cy, 1]; }
    else { const z0 = ground + (p.up === -1 ? 0.555 : 0) - b.min[2]!;   // up -1: on the table's top
      m = [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, pt.x - (c * cx - s * cy), pt.y - (s * cx + c * cy), z0, 1]; }
    const l = by.get(p.id) ?? []; l.push(...m); by.set(p.id, l); }
  return new Map([...by].map(([k, v]) => [k, new Float32Array(v)])); }
