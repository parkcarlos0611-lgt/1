// An engine of the player's choosing put into a car (review 67): the engine's outside from its layout, valve gear, bore
// and stroke (as tools/ref/chassisgen.py makes it), set where the car's own engine stood, the clutch housing and gearbox
// behind it and the drive line from there to the differential, the exhaust along it; and whether it goes into the car's
// engine room: its length, height and width against the room under the bonnet (the Automation wiki's "fill"), fits as it
// is, with work (the radiator brought forward or the bulkhead set back, the bonnet sides bulged), or not at all.
import type { CarModel, CarPart } from './model';

export type Layout = 'I4' | 'I6' | 'I8' | 'V8';
export type Valves = 'sv' | 'ohv' | 'sleeve';
export interface EngineSpec { layout: Layout; kind: Valves; bore: number; stroke: number }
export const LAYOUTS: { id: Layout; name: string; cyl: number; banks: number }[] = [{ id: 'I4', name: '직렬 4', cyl: 4, banks: 1 }, { id: 'I6', name: '직렬 6', cyl: 6, banks: 1 }, { id: 'I8', name: '직렬 8', cyl: 8, banks: 1 }, { id: 'V8', name: 'V8', cyl: 8, banks: 2 }];
export const VALVES: { id: Valves; name: string }[] = [{ id: 'sv', name: '사이드 밸브' }, { id: 'ohv', name: 'OHV' }, { id: 'sleeve', name: '슬리브' }];
const L = (id: Layout) => LAYOUTS.find(l => l.id === id)!;
/** cubic centimetres */
export const displacement = (e: EngineSpec) => Math.round(Math.PI / 4 * e.bore ** 2 * e.stroke * L(e.layout).cyl / 1000);
/** outside length, height, width, mm */
export function engineSize(e: EngineSpec): [number, number, number] { const l = L(e.layout), perBank = l.cyl / l.banks, pitch = e.bore + 24;
  const length = perBank * pitch + 170, height = e.stroke * 2.6 + (e.kind === 'ohv' ? 230 : e.kind === 'sleeve' ? 170 : 120) - (l.banks > 1 ? 60 : 0);
  const width = l.banks > 1 ? e.bore * 2.2 + 120 + 2 * e.stroke * 0.9 : e.bore * 2.2 + 120; return [Math.round(length), Math.round(height), Math.round(width)]; }
type B = { x: number[]; y: number[]; z: number[] };
const unit = (pts: number[][]) => { const xs = pts.map(p => p[0]!), ys = pts.map(p => p[1]!), b = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; return { b, o: pts.map(([x, y]) => [Math.round((x! - b[0]!) / Math.max(1, b[1]! - b[0]!) * 1e4) / 1e4, Math.round((y! - b[2]!) / Math.max(1, b[3]! - b[2]!) * 1e4) / 1e4, 1]) }; };
function mk(id: string, element: string, views: Record<string, number[][]>): CarPart {
  const p = { id, element, material: 'iron', surface: 'flat', pair: false, layer: 'chassis', outlines: {}, sheet: {}, box: {} } as unknown as CarPart & { outlines: Record<string, unknown>; sheet: Record<string, number[]> };
  const AX: Record<string, [string, string]> = { side: ['x', 'z'], front: ['y', 'z'], rear: ['y', 'z'], top: ['x', 'y'] }; const got: Record<string, number[][]> = {};
  for (const [v, pts] of Object.entries(views)) { const { b, o } = unit(pts); p.outlines[v] = o; p.sheet[v] = b.map(Math.round); const [a, c] = AX[v]!; (got[a] ??= []).push([b[0]!, b[1]!]); (got[c] ??= []).push([b[2]!, b[3]!]); }
  const box: B = { x: [0, 0], y: [-100, 100], z: [0, 0] }; for (const [ax, g] of Object.entries(got)) (box as unknown as Record<string, number[]>)[ax] = [Math.round(g.reduce((t, q) => t + q[0]!, 0) / g.length), Math.round(g.reduce((t, q) => t + q[1]!, 0) / g.length)];
  p.box = box as CarPart['box']; return p; }
const rect = (x0: number, x1: number, a0: number, a1: number) => [[x0, a0], [x1, a0], [x1, a1], [x0, a1]];

export interface EngineFit { grade: 'fits' | 'work' | 'no'; fill: number; over: { length: number; height: number; width: number }; notes: string[] }
/** the car with another engine, and whether it goes in */
export function fitEngine(m0: CarModel, e: EngineSpec, gears = 3): { model: CarModel; fit: EngineFit; size: [number, number, number]; cc: number } {
  const m = JSON.parse(JSON.stringify(m0)) as CarModel, P = (id: string) => m.parts.find(p => p.id === id);
  const old = P('engine'), hood = P('hood'), diff = P('rearDiff'); const [el, eh, ew] = engineSize(e);
  const ex0 = old ? old.box.x[0] : (hood ? hood.box.x[0] + 60 : 600), ez0 = old ? old.box.z[0] : 400, R = m.wheels[1]!.r, RX = m.wheels[1]!.x;
  m.parts = m.parts.filter(p => !['engine', 'bell', 'gearbox', 'driveline', 'manifold', 'exhaust', 'mount0', 'mount1'].includes(p.id));
  const add: CarPart[] = [mk('engine', 'engine', { side: rect(ex0, ex0 + el, ez0, ez0 + eh), top: rect(ex0, ex0 + el, -ew / 2, ew / 2), front: rect(-ew / 2, ew / 2, ez0, ez0 + eh) })];
  let end = ex0 + el;
  if (gears > 2) { const bl = 170, gl = gears === 3 ? 300 : 360, bh = eh * 0.62, gh = eh * 0.48, bz = ez0 + eh * 0.08, gz = ez0 + eh * 0.12, gw = Math.min(ew, 330) * 0.7;
    add.push(mk('bell', 'gearbox', { side: [[end, bz], [end + bl, bz + bh * 0.15], [end + bl, bz + bh * 0.85], [end, bz + bh]], top: [[end, -Math.min(ew, 330) * 0.48], [end + bl, -gw / 2], [end + bl, gw / 2], [end, Math.min(ew, 330) * 0.48]] }));
    add.push(mk('gearbox', 'gearbox', { side: rect(end + bl, end + bl + gl, gz, gz + gh), top: rect(end + bl, end + bl + gl, -gw / 2, gw / 2) })); end += bl + gl; }
  const dz = ez0 + eh * 0.35, dx = diff ? diff.box.x[0] + 30 : RX - 150;
  add.push(mk('driveline', 'driveline', { side: [[end, dz + 40], [dx, R + 40], [dx, R - 40], [end, dz - 40]], top: rect(end, dx, -40, 40) }));
  const mz = ez0 + eh * 0.55, ey = ew / 2 + 35, mf = P('muffler'), mx0 = mf ? mf.box.x[0] : RX - 1300, pz = mf ? (mf.box.z[0] + mf.box.z[1]) / 2 : ez0 - 40;
  add.push(mk('manifold', 'exhaust', { side: rect(ex0 + 40, ex0 + el - 30, mz - 30, mz + 30), top: rect(ex0 + 40, ex0 + el - 30, ey - 30, ey + 30) }));
  add.push(mk('exhaust', 'exhaust', { side: [[ex0 + el - 85, mz], [ex0 + el - 35, mz], [ex0 + el + 85, pz + 25], [mx0, pz + 25], [mx0, pz - 25], [ex0 + el + 35, pz - 25], [ex0 + el - 85, mz - 10]], top: rect(ex0 + el - 85, mx0, ey - 25, ey + 25) }));
  m.parts.push(...add);
  (m as unknown as { running: unknown }).running = { ...(m0 as unknown as { running?: object }).running, engine: { ...e, length: el, height: eh, width: ew, cc: displacement(e) } };
  // the engine room: from the engine's own front (the radiator stands there) back to the bulkhead at the bonnet's rear, up to
  // the bonnet's top, as wide as the bonnet; a gearbox goes under the floor
  const hb: { x: number[]; y: number[]; z: number[] } = hood ? hood.box : { x: [ex0, ex0 + 700], z: [ez0, ez0 + 600], y: [0, 300] }, hf = hood?.sheet?.front as number[] | undefined;
  const roomL = hb.x[1]! - ex0 + 60, roomH = hb.z[1]! - ez0 - 30, roomW = hf ? Math.abs(hf[1]! - hf[0]!) - 60 : 2 * Math.max(Math.abs(hb.y[0]!), Math.abs(hb.y[1]!)) - 60;
  const over = { length: el / roomL - 1, height: eh / roomH - 1, width: ew / roomW - 1 }, worst = Math.max(over.length, over.height, over.width);
  const fill = Math.round(Math.max(el / roomL, eh / roomH, ew / roomW) * 100), notes: string[] = [];   // the tightest way: 100% touches
  const pc = (k: number) => `${Math.round(k * 100)}%`;
  if (over.length > 0) notes.push(`길이 ${pc(over.length)} 넘침: 라디에이터 앞으로·격벽 뒤로`); if (over.height > 0) notes.push(`높이 ${pc(over.height)} 넘침: 보닛을 높임`); if (over.width > 0) notes.push(`폭 ${pc(over.width)} 넘침: 보닛 옆판 부풀림`);
  if (!notes.length) notes.push('엔진룸에 들어감');
  return { model: m, fit: { grade: worst <= 0 ? 'fits' : worst <= 0.15 ? 'work' : 'no', fill, over, notes }, size: [el, eh, ew], cc: displacement(e) };
}
