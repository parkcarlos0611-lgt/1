// Putting one car's parts on another (reviews 60, 65, 66): the part builder's core. Every slot has a mount on the car
// it goes on, found from the car itself (no hand-written numbers): wings and lamps stand on their wheel, the grille on
// the bonnet's front edge, bumpers on the frame's ends, the running boards between the wings, the tail lamp at the
// rear wing's tail. A donor's parts are moved from the donor's mount to the base's and scaled by what that mount says
// (a wheel's radius, the bonnet's height, the track), keeping their own shape. How much they had to be scaled says how
// well they fit: as they are, with work (a panel beaten wider, a bracket made), or not at all.
import type { CarModel, CarPart } from './model';

export type Slot = 'grille' | 'lamp' | 'bumperF' | 'bumperR' | 'fenderF' | 'fenderR' | 'board' | 'tail' | 'wheel';
export const SLOTS: { id: Slot; name: string }[] = [
  { id: 'grille', name: '그릴' }, { id: 'lamp', name: '헤드램프' }, { id: 'fenderF', name: '앞 펜더' }, { id: 'fenderR', name: '뒤 펜더' },
  { id: 'board', name: '발판' }, { id: 'bumperF', name: '앞 범퍼' }, { id: 'bumperR', name: '뒤 범퍼' }, { id: 'tail', name: '미등' }, { id: 'wheel', name: '바퀴' } ];
export type Grade = 'own' | 'fits' | 'work' | 'no';
export interface Fit { grade: Grade; notes: string[]; change: number }
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
export function fitSlot(base: CarModel, donor: CarModel, slot: Slot): { model: CarModel; fit: Fit } {
  const r = JSON.parse(JSON.stringify(base)) as CarModel;
  if (base === donor) return { model: r, fit: { grade: 'own', notes: [], change: 0 } };
  if (slot === 'wheel') { const ratio = donor.wheels[0]!.r / base.wheels[0]!.r; r.wheel = JSON.parse(JSON.stringify(donor.wheel));
    const ch = Math.abs(ratio - 1); return { model: r, fit: { grade: ch < 0.06 ? 'fits' : ch < 0.15 ? 'work' : 'no', notes: [ch < 0.06 ? '바퀴 규격 교체' : `원래 지름이 ${Math.round((ratio - 1) * 100)}% 다름: 림을 바꿔야 함`], change: ch } }; }
  const mine = r.parts.filter(p => p.slot === slot), theirs = JSON.parse(JSON.stringify(donor.parts.filter(p => p.slot === slot))) as CarPart[];
  const mb = mount(base, slot), md = mount(donor, slot);
  if (!theirs.length) return { model: r, fit: { grade: 'no', notes: ['가져올 차에 이 부품이 없음'], change: 1 } };
  if (!mb || !md) return { model: r, fit: { grade: 'no', notes: ['붙일 자리를 찾지 못함'], change: 1 } };
  const s = mb.size / md.size, sy = mb.y / md.y;
  const fx = mb.span && md.span ? (x: number) => mb.span![0] + (x - md.span![0]) * (mb.span![1] - mb.span![0]) / Math.max(1, md.span![1] - md.span![0]) : (x: number) => mb.x + (x - md.x) * s;
  const fz = (z: number) => mb.z + (z - md.z) * s, fy = (y: number) => y * sy;
  const MAP: Record<string, (t: number) => number> = { x: fx, y: fy, z: fz };
  for (const p of theirs) {
    for (const [v, b] of Object.entries(p.sheet ?? {})) { const [a, c] = AX[v]!; const A = MAP[a]!, C = MAP[c]!; const q = [A(b![0]), A(b![1]), C(b![2]), C(b![3])]; p.sheet![v as 'side'] = [Math.min(q[0]!, q[1]!), Math.max(q[0]!, q[1]!), Math.min(q[2]!, q[3]!), Math.max(q[2]!, q[3]!)].map(Math.round) as B4; }
    for (const ax of ['x', 'y', 'z'] as const) { const F = MAP[ax]!, b = p.box[ax]; const q = [F(b[0]), F(b[1])]; p.box[ax] = [Math.round(Math.min(q[0]!, q[1]!)), Math.round(Math.max(q[0]!, q[1]!))]; }
    if (p.cutWheel) { p.cutWheel = { ...p.cutWheel, r: Math.round(p.cutWheel.r * s) }; }
    p.id = 'x_' + p.id; if (p.on && theirs.some(q => 'x_' + p.on === q.id || q.id === p.on)) p.on = 'x_' + p.on.replace(/^x_/, '');
  }
  const at = Math.max(0, r.parts.findIndex(p => p.slot === slot)); r.parts = r.parts.filter(p => p.slot !== slot); r.parts.splice(Math.min(at, r.parts.length), 0, ...theirs);
  // how well it fits: by how much it had to be scaled, widened or stretched
  const stretch = mb.span && md.span ? (mb.span[1] - mb.span[0]) / Math.max(1, md.span[1] - md.span[0]) : 1;
  const notes: string[] = [], pc = (k: number) => `${k > 1 ? '+' : ''}${Math.round((k - 1) * 100)}%`;
  if (Math.abs(s - 1) >= 0.03) notes.push(`크기 ${pc(s)}`); if (Math.abs(sy - 1) >= 0.03) notes.push(`폭 ${pc(sy)}`); if (Math.abs(stretch - 1) >= 0.03) notes.push(`길이 ${pc(stretch)}`);
  if (!mine.length) notes.push('바탕 차에 없던 부품');
  const change = Math.max(Math.abs(s - 1), Math.abs(sy - 1), Math.abs(stretch - 1));
  return { model: r, fit: { grade: change < 0.08 ? 'fits' : change < 0.25 ? 'work' : 'no', notes: notes.length ? notes : ['그대로 맞음'], change } };
}

/** several slots at once: each from its own donor (or the base's own part) */
export function assemble(base: CarModel, choice: Partial<Record<Slot, CarModel>>): { model: CarModel; fits: Partial<Record<Slot, Fit>> } {
  let m = base; const fits: Partial<Record<Slot, Fit>> = {};
  for (const { id } of SLOTS) { const d = choice[id]; if (!d || d === base) { fits[id] = { grade: 'own', notes: [], change: 0 }; continue; }
    const r = fitSlot(m, d, id); m = r.model; fits[id] = r.fit; }
  return { model: m, fits };
}
