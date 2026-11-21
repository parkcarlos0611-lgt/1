// The front of the house, the second living place (reviews 45, 46, 49): the planner's sprites and season pictures put
// together and lit by the game (render/place/front2.ts).
import type { App } from '../shell/app';
import { Front2, type Pic } from '../../render/place/front2';
import { Front2GL } from '../../render/place/front2gl';
import { air, moon, dayOfYear } from '../../core/atmosphere';
import { newGround } from '../../core/ground';
import { newHouse } from '../../core/house';
import { carSprite, carTurns, stepCar, along, depthScale, TURN_X, KERB_GROUND, type CarSprite, type CarMotion } from './car';
import { pixels } from './pics';
import cut from '../../data/places/front2_cut.json';
import p_garage from '../../assets/places/front2/garage.png';
import p_ground_autumn from '../../assets/places/front2/ground_autumn.png';
import p_ground_spring from '../../assets/places/front2/ground_spring.png';
import p_ground_summer from '../../assets/places/front2/ground_summer.png';
import p_ground_winter_bare from '../../assets/places/front2/ground_winter_bare.png';
import p_ground_winter_snow from '../../assets/places/front2/ground_winter_snow.png';
import p_house from '../../assets/places/front2/house.png';
import p_lamp from '../../assets/places/front2/lamp.png';
import p_leaves_0 from '../../assets/places/front2/leaves_0.png';
import p_leaves_1 from '../../assets/places/front2/leaves_1.png';
import p_leaves_2 from '../../assets/places/front2/leaves_2.png';
import p_mailbox from '../../assets/places/front2/mailbox.png';
import p_nightwin_0 from '../../assets/places/front2/nightwin_0.png';
import p_nightwin_1 from '../../assets/places/front2/nightwin_1.png';
import p_nightwin_2 from '../../assets/places/front2/nightwin_2.png';
import p_nightwin_3 from '../../assets/places/front2/nightwin_3.png';
import p_puddle_0 from '../../assets/places/front2/puddle_0.png';
import p_puddle_1 from '../../assets/places/front2/puddle_1.png';
import p_puddle_2 from '../../assets/places/front2/puddle_2.png';
import p_sky_autumn from '../../assets/places/front2/sky_autumn.png';
import p_sky_spring from '../../assets/places/front2/sky_spring.png';
import p_sky_summer from '../../assets/places/front2/sky_summer.png';
import p_sky_winter from '../../assets/places/front2/sky_winter.png';
import p_snowcaps from '../../assets/places/front2/snowcaps.png';
import p_snowpile_0 from '../../assets/places/front2/snowpile_0.png';
import p_snowpile_1 from '../../assets/places/front2/snowpile_1.png';
import p_snowpile_2 from '../../assets/places/front2/snowpile_2.png';
import p_tree_bare from '../../assets/places/front2/tree_bare.png';
import p_tree_blossom from '../../assets/places/front2/tree_blossom.png';
import p_tree_bud from '../../assets/places/front2/tree_bud.png';
import p_tree_late from '../../assets/places/front2/tree_late.png';
import p_tree_red from '../../assets/places/front2/tree_red.png';
import p_tree_summer from '../../assets/places/front2/tree_summer.png';
import p_tree_yellow from '../../assets/places/front2/tree_yellow.png';

const PICS: Record<string, [string, number, number]> = {
  garage: [p_garage, 186, 113],
  ground_autumn: [p_ground_autumn, 480, 270],
  ground_spring: [p_ground_spring, 480, 270],
  ground_summer: [p_ground_summer, 480, 270],
  ground_winter_bare: [p_ground_winter_bare, 480, 270],
  ground_winter_snow: [p_ground_winter_snow, 480, 270],
  house: [p_house, 252, 152],
  lamp: [p_lamp, 21, 116],
  leaves_0: [p_leaves_0, 66, 16],
  leaves_1: [p_leaves_1, 73, 20],
  leaves_2: [p_leaves_2, 83, 17],
  mailbox: [p_mailbox, 13, 30],
  nightwin_0: [p_nightwin_0, 33, 46],
  nightwin_1: [p_nightwin_1, 34, 46],
  nightwin_2: [p_nightwin_2, 32, 46],
  nightwin_3: [p_nightwin_3, 32, 46],
  puddle_0: [p_puddle_0, 68, 21],
  puddle_1: [p_puddle_1, 83, 24],
  puddle_2: [p_puddle_2, 80, 22],
  sky_autumn: [p_sky_autumn, 480, 180],
  sky_spring: [p_sky_spring, 480, 180],
  sky_summer: [p_sky_summer, 480, 180],
  sky_winter: [p_sky_winter, 480, 180],
  snowcaps: [p_snowcaps, 480, 270],
  snowpile_0: [p_snowpile_0, 79, 31],
  snowpile_1: [p_snowpile_1, 101, 21],
  snowpile_2: [p_snowpile_2, 93, 28],
  tree_bare: [p_tree_bare, 150, 178],
  tree_blossom: [p_tree_blossom, 163, 186],
  tree_bud: [p_tree_bud, 154, 178],
  tree_late: [p_tree_late, 154, 178],
  tree_red: [p_tree_red, 159, 178],
  tree_summer: [p_tree_summer, 159, 178],
  tree_yellow: [p_tree_yellow, 158, 178] };

export interface FrontSpot { r: { x: number; y: number; w: number; h: number }; label: () => string; act: string; hl: string[]; go?: 'kitchen' | 'garage' }

export function frontPlace(app: App) {
  let scene: Front2 | null = null, gpu: Front2GL | null = null, gpuTried = false, t = 0, door = 0, doorWant = 0, flag = 0, leaves = [0, 0, 0, 0], leafAt = [0, 0, 0, 0], then: (() => void) | null = null, thenAt = 0;
  const house = () => (app.world!.sim.g.house ??= newHouse()), garageOpen = () => !!house().garageOpen, unread = () => house().mail ?? 0;
  const spots: FrontSpot[] = [
    { r: { x: 156, y: 96, w: 30, h: 70 }, label: () => '현관 (집 안으로)', act: 'door', hl: [] },
    // the garage: shut, its doors open it; open, the doors folded back at each side shut it, and the way in is between
    ...[[303, 316], [366, 391], [445, 458]].map(([x0, x1]) => ({ r: { x: x0!, y: 98, w: x1! - x0!, h: 70 }, label: () => (garageOpen() ? '차고문을 닫는다' : '차고문을 연다'), act: 'garageDoors', hl: [] })),
    { r: { x: 316, y: 98, w: 50, h: 70 }, label: () => (garageOpen() ? '차고 안으로 들어간다' : '차고문을 연다'), act: 'garageIn', hl: [] },
    { r: { x: 391, y: 98, w: 54, h: 70 }, label: () => (garageOpen() ? '차고 안으로 들어간다' : '차고문을 연다'), act: 'garageIn', hl: [] },
    { r: { x: 136, y: 174, w: 22, h: 34 }, label: () => (unread() ? `우편함 (편지 ${unread()}통)` : '우편함 (비었다)'), act: 'mail', hl: [] } ];
  /** returns true if the front handled it; `go` is called to move to another place */
  function act(a: string, go: (to: 'kitchen' | 'garage') => void): boolean { const snd = app.sound;
    if (a === 'door') { doorWant = 1; snd.once('tick'); snd.once('creak'); then = () => go('kitchen'); thenAt = t + 0.9; return true; }   // the door swings open, the hall shows, then in
    const openG = () => { house().garageOpen = true; leafAt = [t, t + 0.25, t + 0.5, t + 0.75]; snd.once('sash'); setTimeout(() => snd.once('creak'), 300); setTimeout(() => snd.once('sash', { vol: 0.8 }), 550); };
    const shutG = () => { house().garageOpen = false; leafAt = [t + 0.75, t + 0.5, t + 0.25, t]; snd.once('creak'); setTimeout(() => snd.once('knock', { vol: 0.5 }), 900); };
    if (a === 'garageDoors') { if (garageOpen()) shutG(); else openG(); return true; }
    if (a === 'garageIn') { if (!garageOpen()) openG(); else if (Math.min(...leaves) > 0.9) go('garage'); return true; }   // in only once the doors stand open
    if (a === 'mail') { const n = unread(); snd.once('paper'); app.toast(n ? `편지 ${n}통을 꺼냈다 (책상 위 쪽지에 있다)` : '우편함은 비어 있다'); house().mail = 0; return true; }
    return false; }
  // ---- the customer's car (step 2): it comes along the road and stops at the kerb; it is kept in the save while its job is open
  let car: { job: number; frames: CarSprite[] | null; m: CarMotion; puffs: { x: number; y: number; age: number }[] } | null = null;
  function carArrives(job: number) { car = { job, frames: null, m: { s: 320, v: 70, wheel: 0, state: 'arrive', t: 0 }, puffs: [] }; house().car = job; }
  function carLeaves() { if (car) { car.m.state = 'leave'; car.m.t = 0; } }
  function carFrame(dt: number, outdoorTemp: number) { const W = app.world!, h = house();
    if (!car && h.car) { try { W.repair.view(h.car); car = { job: h.car, frames: null, m: { s: 0, v: 0, wheel: 0, state: 'parked', t: 9 }, puffs: [] }; } catch { h.car = undefined; } }
    if (!car) return null;
    if (!car.frames) { const v = W.repair.view(car.job), side = carSprite(v.colour, v.damages); if (!side) return null; car.frames = carTurns(side, v.colour); }
    const m = car.m, was = m.state; stepCar(m, dt, car.frames[0]!.hubs[0]![2]);
    if (m.state === 'gone') { car = null; h.car = undefined; app.sound.ambient('engine', 0); return null; }
    const running = m.state !== 'parked'; app.sound.ambient('engine', running ? (m.state === 'idle' ? 0.45 : 0.75) : 0, 0.8 + m.v / 70);
    if (was === 'idle' && m.state === 'parked') app.sound.once('knock', { vol: 0.6 });   // the engine off, the door shut
    // where it is: along the way in (or, leaving, back out and away to the left), turned as the way turns, smaller further up the drive
    const p = m.state === 'leave' && (m.away ?? 0) > 0 ? { x: TURN_X - m.away!, y: KERB_GROUND, yaw: 0 } : along(m.s), k = Math.min(12, Math.round(p.yaw / 7.5)), sp = car.frames[k]!, sc = depthScale(p.y);
    // exhaust from the tail pipe while the engine runs: thick in the cold
    if (running && Math.random() < dt * (outdoorTemp < 8 ? 14 : 5)) { const tx = k === 0 ? sp.tail[0] - sp.anchor[0] : k === 12 ? sp.tail[0] - sp.anchor[0] : sp.w * 0.45, ty = k === 0 || k === 12 ? sp.tail[1] - sp.anchor[1] : -6; car.puffs.push({ x: p.x + tx * sc, y: p.y + ty * sc, age: 0 }); }
    for (const q of car.puffs) { q.age += dt; q.x += dt * (6 + m.v * 0.3) + Math.sin(q.age * 3) * dt * 2; q.y -= dt * 4; } car.puffs = car.puffs.filter(q => q.age < 2.2);
    return { sprite: sp, x: p.x - sp.anchor[0] * sc, y: p.y - sp.anchor[1] * sc, wheel: k === 0 ? m.wheel : 0, scale: sc, side: k === 0 }; }
  /** coming out of the house: the door is open behind and swings shut */
  function cameOut() { door = 1; doorWant = 0; setTimeout(() => app.sound.once('knock', { vol: 0.35 }), 450); }
  function draw(dt: number): boolean {
    if (!scene) { const P: Record<string, Pic> = {}; for (const [n, [url, w, h]] of Object.entries(PICS)) { const px = pixels(url, w, h); if (!px) return false; P[n] = { px, w, h }; } scene = new Front2(cut as never, P); leaves = leaves.map(() => (garageOpen() ? 1 : 0)); }
    t += dt; const W = app.world!, g = W.sim.g, sky = g.weather.today ?? 'clear', A = air(W.clock.today, W.clock.minute, sky, g.seed), gr = (g.ground ??= newGround());
    door += Math.max(-dt * 1.6, Math.min(dt * 1.6, doorWant - door)); if (then && t >= thenAt) { const f = then; then = null; f(); setTimeout(() => { if (!then) { doorWant = 0; door = 0; } }, 900); }   /* shut behind, once the screen has gone dark */
    const want = garageOpen() ? 1 : 0; leaves = leaves.map((v, k) => (t < leafAt[k]! ? v : v + Math.max(-dt * 1.4, Math.min(dt * 1.4, want - v))));
    flag += Math.max(-dt * 3, Math.min(dt * 3, (unread() ? 1 : 0) - flag));
    if (!gpuTried) { gpuTried = true; const off = (globalThis as { __cpu?: boolean }).__cpu; gpu = off ? null : Front2GL.make(scene); (globalThis as { __gpu?: boolean }).__gpu = !!gpu; }   // the GPU where there is one; the CPU otherwise
    const cf = carFrame(dt, A.temp), heads = A.daylight < 0.35 || (A.rain > 0 && A.daylight < 0.6);
    if (gpu) gpu.car = cf ? { sprite: cf.sprite, x: cf.x, y: cf.y, wheel: cf.wheel, scale: cf.scale, heads: heads && cf.side && car!.m.state !== 'parked' } : null;
    (gpu ?? scene).draw(app.S.d, { t, dt, air: A, moon: moon(W.clock.today, W.clock.minute), minute: W.clock.minute, doy: dayOfYear(W.clock.today), houseLit: !!g.house?.kitchen.lamp, snow: gr.snow, wet: gr.wet, door, garage: leaves.map(v => v * v * (3 - 2 * v)), flag });
    const d = app.S.d;
    if (cf && !gpu) { const sp = cf.sprite, ox = Math.round(cf.x), oy = Math.round(cf.y), k = 0.25 + 0.75 * A.daylight, sc = cf.scale;   // no GPU: the car laid in, lit by the hour only
      for (let y = 0; y < Math.round(sp.h * sc); y++) for (let x = 0; x < Math.round(sp.w * sc); x++) { const j = (Math.min(sp.h - 1, Math.floor(y / sc)) * sp.w + Math.min(sp.w - 1, Math.floor(x / sc))) * 4; if (sp.rgba[j + 3]! < 128) continue; const X = ox + x, Y = oy + y; if (X < 0 || X >= 480 || Y < 0 || Y >= 270) continue; const i = (Y * 480 + X) * 4; d[i] = sp.rgba[j]! * k; d[i + 1] = sp.rgba[j + 1]! * k; d[i + 2] = sp.rgba[j + 2]! * k; } }
    if (car) for (const p of car.puffs) { const r = 1 + p.age * 2.2, a = 0.28 * (1 - p.age / 2.2); for (let y = Math.floor(p.y - r); y <= p.y + r; y++) for (let x = Math.floor(p.x - r); x <= p.x + r; x++) { if (x < 0 || y < 0 || x >= 480 || y >= 270) continue; const w = a * Math.max(0, 1 - Math.hypot(x - p.x, y - p.y) / (r + 0.5)), i = (y * 480 + x) * 4, lv = 150 + 60 * A.daylight; d[i] = d[i]! + (lv - d[i]!) * w; d[i + 1] = d[i + 1]! + (lv - d[i + 1]!) * w; d[i + 2] = d[i + 2]! + (lv + 6 - d[i + 2]!) * w; } }
    return true; }
  const api = { draw, spots, act, cameOut, carArrives, carLeaves, carState: () => car?.m.state ?? 'none' }; (globalThis as { __front?: unknown }).__front = api;   // for tests
  return api;
}
