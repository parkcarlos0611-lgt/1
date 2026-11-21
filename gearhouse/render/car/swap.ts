// Putting one car's parts on another (reviews 60, 65, 66): the part builder's core. Every slot has a mount on the car
// it goes on, found from the car itself (no hand-written numbers): wings and lamps stand on their wheel, the grille on
// the bonnet's front edge, bumpers on the frame's ends, the running boards between the wings, the tail lamp at the
// rear wing's tail. A donor's parts are moved from the donor's mount to the base's and scaled by what that mount says
// (a wheel's radius, the bonnet's height, the track), keeping their own shape. How much they had to be scaled says how
// well they fit: as they are, with work (a panel beaten wider, a bracket made), or not at all.
import { viewDesign, type CarModel, type CarPart } from './model';
import { rasterizeFlat } from './flat';
/** slots whose parts interlock with the body (the body was cut to them): what they covered must not be left open */
const BACKED = new Set<Slot>(['fenderF', 'fenderR', 'grille', 'board']);
/** the side view's coverage of some parts, as a coarse mask */
function cover(m: CarModel, keep: (p: CarPart) => boolean): { mask: Uint8Array; w: number } { const d = viewDesign(m, 'left', keep); d.wheels = []; const im = rasterizeFlat(d, { mm: 25, shadow: false }); const mask = new Uint8Array(im.w * im.h); for (let i = 0; i < mask.length; i++) mask[i] = im.rgba[i * 4 + 3]! > 100 ? 1 : 0; return { mask, w: im.w }; }

export type Slot = 'grille' | 'lamp' | 'bumperF' | 'bumperR' | 'fenderF' | 'fenderR' | 'board' | 'tail' | 'wheel';
export const SLOTS: { id: Slot; name: string }[] = [
  { id: 'grille', name: '그릴' }, { id: 'lamp', name: '헤드램프' }, { id: 'fenderF', name: '앞 펜더' }, { id: 'fenderR', name: '뒤 펜더' },
  { id: 'board', name: '발판' }, { id: 'bumperF', name: '앞 범퍼' }, { id: 'bumperR', name: '뒤 범퍼' }, { id: 'tail', name: '미등' }, { id: 'wheel', name: '바퀴' } ];
export type Grade = 'own' | 'fits' | 'work' | 'no';
export interface Fit { grade: Grade; notes: string[]; change: number }
/** the player's own reshaping of a slot's part, as multipliers on the fitted size: 1 leaves it as it was fitted */
export interface Adjust { size: number; width: number; length: number }
export const NO_ADJUST: Adjust = { size: 1, width: 1, length: 1 };
/** how much change still fits as it is, and how much can be made to fit with work (beaten, cut, lengthened) */
export const FITS = 0.08, WORK = 0.40;
type B4 = [number, number, number, number];
const AX: Record<string, [string, string]> = { side: ['x', 'z'], front: ['y', 'z'], rear: ['y', 'z'], top: ['x', 'y'] };
const part = (m: CarModel, id: string) => m.parts.find(p => p.id === id);
const sb = (p: CarPart | undefined, v: string) => p?.sheet?.[v as 'side'] as B4 | undefined;
/** half the track: the tyres' middle from the centre line, as the plan of the tyres says */
const halfTrack = (m: CarModel) => { const t = sb(part(m, 'tyreF'), 'top'); return t ? (t[2] + t[3]) / 2 : m.width * 0.42; };

interface Mount { x: number; z: number; s: number; sy: number; fx?: (x: number) => number }
/** where a slot sits on a car, and the measure its parts are sized by */
function mount(m: CarModel, slot: Slot): { x: number; z: number; size: number; y: number; span?: [number, number] } | null {
  const w = m.wheels, hood = sb(part(m, 'hood'), 'side'), hoodF = sb(part(m, 'hood'), 'front'), frame = sb(part(m, 'frame'), 'side');
  const fF = sb(part(m, 'fenderF'), 'side'), fR = sb(part(m, 'fenderR'), 'side');
  switch (slot) {
    case 'fenderF': case 'lamp': return { x: w[0]!.x, z: 0, size: w[0]!.r, y: halfTrack(m) };
    case 'fenderR': return { x: w[1]!.x, z: 0, size: w[1]!.r, y: halfTrack(m) };
    case 'tail': return fR ? { x: fR[1], z: 0, size: w[1]!.r, y: halfTrack(m) } : null;
    case 'grille': return hood && hoodF ? { x: hood[0], z: hood[3], size: hood[3] - hood[2], y: Math.max(Math.abs(hoodF[0]), Math.abs(hoodF[1])) } : null;
    case 'bumperF': return frame ? { x: frame[0], z: frame[2], size: 1, y: halfTrack(m) } : null;
    case 'bumperR': return frame ? { x: frame[1], z: frame[2], size: 1, y: halfTrack(m) } : null;
    case 'board': return fF && fR && frame ? { x: fF[1], z: frame[2], size: 1, y: halfTrack(m), span: [fF[1], fR[0]] } : null;
    default: return null; }
}

/** the base car with the donor's parts for one slot put on */
export function fitSlot(base: CarModel, donor: CarModel, slot: Slot, adj: Adjust = NO_ADJUST): { model: CarModel; fit: Fit } {
  const r = JSON.parse(JSON.stringify(base)) as CarModel, same = (a: Adjust) => a.size === 1 && a.width === 1 && a.length === 1;
  if (base === donor && same(adj)) return { model: r, fit: { grade: 'own', notes: [], change: 0 } };
  if (slot === 'wheel') { const ratio = donor.wheels[0]!.r / base.wheels[0]!.r; r.wheel = JSON.parse(JSON.stringify(donor.wheel));
    const ch = Math.abs(ratio - 1); return { model: r, fit: { grade: ch < 0.06 ? 'fits' : ch < 0.15 ? 'work' : 'no', notes: [ch < 0.06 ? '바퀴 규격 교체' : `원래 지름이 ${Math.round((ratio - 1) * 100)}% 다름: 림을 바꿔야 함`], change: ch } }; }
  const mine = r.parts.filter(p => p.slot === slot), theirs = JSON.parse(JSON.stringify((base === donor ? base : donor).parts.filter(p => p.slot === slot))) as CarPart[];
  const mb = mount(base, slot), md = mount(donor, slot);
  if (!theirs.length) return { model: r, fit: { grade: 'no', notes: ['가져올 차에 이 부품이 없음'], change: 1 } };
  if (!mb || !md) return { model: r, fit: { grade: 'no', notes: ['붙일 자리를 찾지 못함'], change: 1 } };
  // fitted to the mount, then reshaped as the player asks
  const s0 = mb.size / md.size, sy0 = mb.y / md.y, st0 = mb.span && md.span ? (mb.span[1] - mb.span[0]) / Math.max(1, md.span[1] - md.span[0]) : 1;
  const s = s0 * adj.size, sy = sy0 * adj.width, sx = (mb.span ? st0 : s0 * adj.size) * adj.length;
  const fx = mb.span && md.span ? (x: number) => mb.span![0] + (x - md.span![0]) * sx : (x: number) => mb.x + (x - md.x) * sx;
  const fz = (z: number) => mb.z + (z - md.z) * s, fy = (y: number) => y * sy;
  const MAP: Record<string, (t: number) => number> = { x: fx, y: fy, z: fz };
  for (const p of theirs) {
    for (const [v, b] of Object.entries(p.sheet ?? {})) { const [a, c] = AX[v]!; const A = MAP[a]!, C = MAP[c]!; const q = [A(b![0]), A(b![1]), C(b![2]), C(b![3])]; p.sheet![v as 'side'] = [Math.min(q[0]!, q[1]!), Math.max(q[0]!, q[1]!), Math.min(q[2]!, q[3]!), Math.max(q[2]!, q[3]!)].map(Math.round) as B4; }
    for (const ax of ['x', 'y', 'z'] as const) { const F = MAP[ax]!, b = p.box[ax]; const q = [F(b[0]), F(b[1])]; p.box[ax] = [Math.round(Math.min(q[0]!, q[1]!)), Math.round(Math.max(q[0]!, q[1]!))]; }
    if (p.cutWheel) { p.cutWheel = { ...p.cutWheel, r: Math.round(p.cutWheel.r * s) }; }
    p.id = 'x_' + p.id; if (p.on && theirs.some(q => 'x_' + p.on === q.id || q.id === p.on)) p.on = 'x_' + p.on.replace(/^x_/, '');
  }
  const at = Math.max(0, r.parts.findIndex(p => p.slot === slot)); r.parts = r.parts.filter(p => p.slot !== slot); r.parts.splice(Math.min(at, r.parts.length), 0, ...theirs);
  // what the old part covered stays closed: its outline left behind the body as the black inner panel (a splash apron,
  // a wing's inner valance, the radiator's dark core), so a smaller part shows that, not a hole
  let open = 0;
  if (BACKED.has(slot) && mine.length) {
    const backs = mine.filter(p => !p.on).map(p => { const q = JSON.parse(JSON.stringify(p)) as CarPart; q.id = 'back_' + p.id; q.material = 'black'; q.surface = 'flat'; delete q.slot; delete q.features; delete q.detail; delete q.shade; delete q.color;
      const inner = Math.max(40, Math.min(Math.abs(q.box.y[0]), Math.abs(q.box.y[1])) - 60); q.box.y = q.pair ? [Math.max(0, inner - 40), inner] : [-inner, inner]; return q; });
    r.parts.unshift(...backs);
    const before = cover(base, p => p.slot === slot), after = cover(r, p => theirs.some(q => q.id === p.id)); let n = 0, o = 0;
    for (let i = 0; i < before.mask.length; i++) if (before.mask[i]) { n++; if (!after.mask[i]) o++; }
    open = n ? o / n : 0;
  }
  // how well it fits: the work of reshaping it from what it was (beaten wider, cut shorter), and how far it is still from
  // the place it has to fill (a gap, or standing proud): the larger decides
  const pc = (k: number) => `${k > 1 ? '+' : ''}${Math.round((k - 1) * 100)}%`, notes: string[] = [];
  const work = { 크기: s, 폭: sy, 길이: sx }, off = { 크기: adj.size, 폭: adj.width, 길이: adj.length };
  for (const [n, k] of Object.entries(work)) if (Math.abs(k - 1) >= 0.03) notes.push(`${n} ${pc(k)}`);
  for (const [n, k] of Object.entries(off)) if (Math.abs(k - 1) >= 0.03) notes.push(`자리보다 ${n} ${pc(k)}`);
  if (!mine.length) notes.push('바탕 차에 없던 부품');
  if (open >= 0.03) notes.push(`안쪽 판 새로 댐 ${Math.round(open * 100)}%`);
  const change = Math.max(open * 0.5, ...Object.values(work).map(k => Math.abs(k - 1)), ...Object.values(off).map(k => Math.abs(k - 1)));
  return { model: r, fit: { grade: change < FITS ? 'fits' : change < WORK ? 'work' : 'no', notes: notes.length ? notes : ['그대로 맞음'], change } };
}

/** several slots at once: each from its own donor (or the base's own part) */
export function assemble(base: CarModel, choice: Partial<Record<Slot, CarModel>>, adjust: Partial<Record<Slot, Adjust>> = {}): { model: CarModel; fits: Partial<Record<Slot, Fit>> } {
  let m = base; const fits: Partial<Record<Slot, Fit>> = {};
  for (const { id } of SLOTS) { const d = choice[id] ?? base, a = adjust[id] ?? NO_ADJUST; if (d === base && a === NO_ADJUST) { fits[id] = { grade: 'own', notes: [], change: 0 }; continue; }
    const r = fitSlot(m, d === base ? m : d, id, a); m = r.model; fits[id] = r.fit; }
  return { model: m, fits };
}
