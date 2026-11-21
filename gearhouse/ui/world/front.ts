// The front of the house, the second living place (reviews 45, 46, 49): the planner's sprites and season pictures put
// together and lit by the game (render/place/front2.ts).
import type { App } from '../shell/app';
import { Front2, lantern, type Pic } from '../../render/place/front2';
import { Front2GL } from '../../render/place/front2gl';
import { air, moon, dayOfYear } from '../../core/atmosphere';
import { newGround } from '../../core/ground';
import { newHouse } from '../../core/house';
import { carSprite, carTurns, stepCar, along, depthScale, TURN_X, TURN_IN, KERB_GROUND, type CarSprite, type CarMotion } from './car';
import { pixels } from './pics';
import { newCaller, stepCaller, drawCaller, TO_DOOR, AWAY, FROM_LEFT, type Caller } from './caller';
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
  /** the customer's car once the job is agreed: into the garage (its rectangle follows the car; empty when there is none) */
  const carSpot: FrontSpot = { r: { x: 0, y: 0, w: 0, h: 0 }, label: () => (house().bay ? '차고 칸이 차 있다' : garageOpen() ? '차를 차고에 넣는다' : '차를 넣으려면 차고문부터 연다'), act: 'carIn', hl: [] };
  let scene: Front2 | null = null, gpu: Front2GL | null = null, gpuTried = false, t = 0, door = 0, doorWant = 0, flag = 0, leaves = [0, 0, 0, 0], leafAt = [0, 0, 0, 0], then: (() => void) | null = null, thenAt = 0;
  const house = () => (app.world!.sim.g.house ??= newHouse()), garageOpen = () => !!house().garageOpen, unread = () => house().mail ?? 0;
  const spots: FrontSpot[] = [
    { r: { x: 156, y: 96, w: 30, h: 70 }, label: () => (caller?.state === 'knock' && !handing ? (collecting !== null ? '문을 연다 (차를 찾으러 온 손님)' : '문을 열어 손님을 들인다') : '현관 (집 안으로)'), act: 'door', hl: [] },
    // the garage: shut, its doors open it; open, the doors folded back at each side shut it, and the way in is between
    ...[[303, 316], [366, 391], [445, 458]].map(([x0, x1]) => ({ r: { x: x0!, y: 98, w: x1! - x0!, h: 70 }, label: () => (garageOpen() ? '차고문을 닫는다' : '차고문을 연다'), act: 'garageDoors', hl: [] })),
    { r: { x: 316, y: 98, w: 50, h: 70 }, label: () => (garageOpen() ? '차고 안으로 들어간다' : '차고문을 연다'), act: 'garageIn', hl: [] },
    { r: { x: 391, y: 98, w: 54, h: 70 }, label: () => (garageOpen() ? '차고 안으로 들어간다' : '차고문을 연다'), act: 'garageIn', hl: [] },
    carSpot,
    { r: { x: 136, y: 174, w: 22, h: 34 }, label: () => (unread() ? `우편함 (편지 ${unread()}통)` : '우편함 (비었다)'), act: 'mail', hl: [] } ];
  /** returns true if the front handled it; `go` is called to move to another place */
  function act(a: string, go: (to: 'kitchen' | 'garage') => void): boolean { const snd = app.sound;
    if (a === 'door' && caller?.state === 'knock' && !handing) { letIn(go); return true; }
    if (a === 'door') { doorWant = 1; snd.once('tick'); snd.once('creak'); then = () => go('kitchen'); thenAt = t + 0.9; return true; }   // the door swings open, the hall shows, then in
    const openG = () => { house().garageOpen = true; leafAt = [t, t + 0.25, t + 0.5, t + 0.75]; snd.once('sash'); setTimeout(() => snd.once('creak'), 300); setTimeout(() => snd.once('sash', { vol: 0.8 }), 550); };
    const shutG = () => { house().garageOpen = false; leafAt = [t + 0.75, t + 0.5, t + 0.25, t]; snd.once('creak'); setTimeout(() => snd.once('knock', { vol: 0.5 }), 900); };
    if (a === 'garageDoors') { if (garageOpen()) shutG(); else openG(); return true; }
    if (a === 'garageIn') { if (!garageOpen()) openG(); else if (Math.min(...leaves) > 0.9) go('garage'); return true; }   // in only once the doors stand open
    if (a === 'carIn' && car) { const h = house(); if (h.bay) { app.toast('차고 칸에 이미 다른 차가 있다'); return true; } if (!garageOpen()) { openG(); return true; }
      h.bay = { job: car.job, fixed: [], minutes: 0 }; h.car = undefined; car = null; app.sound.once('car'); app.sound.ambient('engine', 0); go('garage'); return true; }
    if (a === 'mail') { const n = unread(); snd.once('paper'); app.toast(n ? `편지 ${n}통을 꺼냈다 (책상 위 쪽지에 있다)` : '우편함은 비어 있다'); house().mail = 0; return true; }
    return false; }
  // ---- the customer's car (step 2): it comes along the road and stops at the kerb; it is kept in the save while its job is open
  let car: { job: number; frames: CarSprite[] | null; m: CarMotion; puffs: { x: number; y: number; age: number }[] } | null = null;
  function carArrives(job: number) { car = { job, frames: null, m: { s: 320, v: 70, wheel: 0, state: 'arrive', t: 0 }, puffs: [] }; house().car = job; }
  function carLeaves() { if (car) { car.m.state = 'leave'; car.m.t = 0; } }
  function carFrame(dt: number, outdoorTemp: number) { const W = app.world!, h = house();
    if (!car && h.car) { try { W.repair.view(h.car); car = { job: h.car, frames: null, m: { s: 0, v: 0, wheel: 0, state: 'parked', t: 9 }, puffs: [] }; } catch { h.car = undefined; } }
    if (!car) return null;
    if (!car.frames) { const v = W.repair.view(car.job), side = carSprite(v.colour, v.state === 'collected' ? [] : v.damages); if (!side) return null; car.frames = TURN_IN ? carTurns(side, v.colour) : [side]; }
    const m = car.m, was = m.state; stepCar(m, dt, car.frames[0]!.hubs[0]![2]);
    if (m.state === 'gone') { car = null; h.car = undefined; app.sound.ambient('engine', 0); return null; }
    const running = m.state !== 'parked'; app.sound.ambient('engine', running ? (m.state === 'idle' ? 0.45 : 0.75) : 0, 0.8 + m.v / 70);
    if (was === 'idle' && m.state === 'parked') app.sound.once('knock', { vol: 0.6 });   // the engine off, the door shut
    // where it is: along the way in (or, leaving, back out and away to the left), turned as the way turns, smaller further up the drive
    const p = m.state === 'leave' && (m.away ?? 0) > 0 ? { x: (TURN_IN ? TURN_X : along(m.s).x) - m.away!, y: KERB_GROUND, yaw: 0 } : along(m.s), k = Math.min(car.frames.length - 1, Math.round(p.yaw / 7.5)), sp = car.frames[k]!, sc = depthScale(p.y);
    // exhaust from the tail pipe while the engine runs: thick in the cold
    if (running && Math.random() < dt * (outdoorTemp < 8 ? 14 : 5)) { const tx = k === 0 ? sp.tail[0] - sp.anchor[0] : k === 12 ? sp.tail[0] - sp.anchor[0] : sp.w * 0.45, ty = k === 0 || k === 12 ? sp.tail[1] - sp.anchor[1] : -6; car.puffs.push({ x: p.x + tx * sc, y: p.y + ty * sc, age: 0 }); }
    for (const q of car.puffs) { q.age += dt; q.x += dt * (6 + m.v * 0.3) + Math.sin(q.age * 3) * dt * 2; q.y -= dt * 4; } car.puffs = car.puffs.filter(q => q.age < 2.2);
    return { sprite: sp, x: p.x - sp.anchor[0] * sc, y: p.y - sp.anchor[1] * sc, wheel: k === 0 ? m.wheel : 0, scale: sc, side: k === 0 }; }
  // ---- the customer on foot (step 3): out of the parked car, up to the door, a knock; let in, he sits at the kitchen table
  let caller: Caller | null = null, callerWait = -1, leaving: 'walk' | 'drive' | null = null, knockAt = 0;
  const hooks: { knock?: (n: number, name: string) => void; gaveUp?: () => void; handover?: (job: number) => void } = {};
  // ---- a customer come to collect (step 5): on foot to the door; let in, the car is handed over and paid for, and he drives it away
  let collecting: number | null = null, handing = false;
  function collectorArrives(job: number) { if (collecting !== null) return; collecting = job; handing = false; caller = newCaller(FROM_LEFT); }
  /** the car handed over: paid for, out of the bay to the kerb with him at the wheel, and away */
  function handOver(): { satisfaction: number; paid: number } | null { if (collecting === null) return null; const job = collecting, h = house(); let r: { satisfaction: number; paid: number };
    try { r = app.world!.repair.collect(job); } catch { collecting = null; caller = null; return null; }
    collecting = null; handing = false; caller = null; doorWant = 0; if (h.bay?.job === job) h.bay = undefined; if (car) { leaving = 'walk'; return r; }   /* the kerb taken by another customer's car: his is driven out the back lane; he walks round to it */
    h.car = job; car = { job, frames: null, m: { s: 0, v: 0, wheel: 0, state: 'parked', t: 9 }, puffs: [] }; leaving = 'drive'; return r; }   /* out of the bay to the kerb; he walks down to it and drives off */
  const jobOpen = () => { const h = house(); if (!h.car) return false; try { return app.world!.repair.view(h.car).state === 'asked'; } catch { return false; } };
  function letIn(go?: (to: 'kitchen') => void) { if (!caller || caller.state !== 'knock') return; doorWant = 1; app.sound.once('creak');
    if (collecting !== null) { handing = true; const job = collecting; setTimeout(() => hooks.handover?.(job), 500); return; }   /* he has come for his car: it is handed over on the step */
    setTimeout(() => { caller = null; house().visitor = true; if (go) { then = () => go('kitchen'); thenAt = t + 0.3; } else setTimeout(() => { doorWant = 0; }, 700); }, 650); }
  /** the talk is over: he comes out of the house; agreed, he walks off and leaves the car; not, he drives away */
  function visitorLeaves(drive: boolean) { house().visitor = false; leaving = drive ? 'drive' : 'walk'; }
  function callerFrame(dt: number) { const h = house();
    if (!caller && !leaving && !h.visitor && car?.m.state === 'parked' && jobOpen()) { if (callerWait < 0) callerWait = car.m.t > 5 ? 0 : 0.9; callerWait -= dt; if (callerWait <= 0) { caller = newCaller(TO_DOOR); if (car.m.t > 5) { caller.s = 1e4; } callerWait = -1; } }
    if (!caller && leaving) { caller = newCaller(leaving === 'drive' ? [...TO_DOOR].reverse() : AWAY); doorWant = 1; app.sound.once('creak'); setTimeout(() => { doorWant = 0; setTimeout(() => app.sound.once('knock', { vol: 0.35 }), 450); }, 900); }
    if (!caller) return; const r = stepCaller(caller, dt);
    if (r === 'step') app.sound.once('step', { vol: 0.5 + 0.5 * Math.min(1, (caller.s / 200)) });
    if (caller.path === FROM_LEFT) { if (!handing && (r === 'arrived' || (caller.state === 'knock' && caller.t >= knockAt && caller.knocks < 5))) { caller.knocks++; app.sound.once('knock'); knockAt = caller.t + 14; try { hooks.knock?.(caller.knocks, app.world!.repair.view(collecting!).name); } catch { /* gone */ } } }
    else if (caller.path === TO_DOOR) { if (r === 'arrived' || (caller.state === 'knock' && caller.t >= knockAt)) { caller.knocks++; app.sound.once('knock'); knockAt = caller.t + 14;
        if (caller.knocks > 4) { try { app.world!.repair.decline(h.car!); } catch { /* already settled */ } caller = null; leaving = 'drive'; hooks.gaveUp?.(); }
        else hooks.knock?.(caller.knocks, app.world!.repair.view(h.car!).name); } }
    else if (caller.state === 'knock') { const was = leaving; caller = null; leaving = null; if (was === 'drive') carLeaves(); } }
  /** coming out of the house: the door is open behind and swings shut */
  function cameOut() { door = 1; doorWant = 0; setTimeout(() => app.sound.once('knock', { vol: 0.35 }), 450); }
  function draw(dt: number): boolean {
    if (!scene) { const P: Record<string, Pic> = {}; for (const [n, [url, w, h]] of Object.entries(PICS)) { const px = pixels(url, w, h); if (!px) return false; P[n] = { px, w, h }; } scene = new Front2(cut as never, P); leaves = leaves.map(() => (garageOpen() ? 1 : 0)); }
    t += dt; const W = app.world!, g = W.sim.g, sky = g.weather.today ?? 'clear', A = air(W.clock.today, W.clock.minute, sky, g.seed), gr = (g.ground ??= newGround());
    door += Math.max(-dt * 1.6, Math.min(dt * 1.6, doorWant - door)); if (then && t >= thenAt) { const f = then; then = null; f(); setTimeout(() => { if (!then) { doorWant = 0; door = 0; } }, 900); }   /* shut behind, once the screen has gone dark */
    const want = garageOpen() ? 1 : 0; leaves = leaves.map((v, k) => (t < leafAt[k]! ? v : v + Math.max(-dt * 1.4, Math.min(dt * 1.4, want - v))));
    flag += Math.max(-dt * 3, Math.min(dt * 3, (unread() ? 1 : 0) - flag));
    if (!gpuTried) { gpuTried = true; const off = (globalThis as { __cpu?: boolean }).__cpu; gpu = off ? null : Front2GL.make(scene); (globalThis as { __gpu?: boolean }).__gpu = !!gpu; }   // the GPU where there is one; the CPU otherwise
    callerFrame(dt); const cf = carFrame(dt, A.temp);
    { let agreed = false; if (car && car.m.state === 'parked' && !caller) { try { agreed = W.repair.view(car.job).state === 'agreed'; } catch { /* gone */ } }
      if (cf && agreed) Object.assign(carSpot.r, { x: Math.round(cf.x), y: Math.round(cf.y), w: Math.round(cf.sprite.w * cf.scale), h: Math.round(cf.sprite.h * cf.scale) }); else Object.assign(carSpot.r, { w: 0, h: 0 }); }
    const heads = A.daylight < 0.35 || (A.rain > 0 && A.daylight < 0.6);
    if (gpu) gpu.car = cf ? { sprite: cf.sprite, x: cf.x, y: cf.y, wheel: cf.wheel, scale: cf.scale, heads: heads && cf.side && car!.m.state !== 'parked' } : null;
    (gpu ?? scene).draw(app.S.d, { t, dt, air: A, moon: moon(W.clock.today, W.clock.minute), minute: W.clock.minute, doy: dayOfYear(W.clock.today), houseLit: !!g.house?.kitchen.lamp, snow: gr.snow, wet: gr.wet, door, garage: leaves.map(v => v * v * (3 - 2 * v)), flag });
    const d = app.S.d;
    { const day = A.daylight; lantern(d, scene.P.lamp!, scene.C.lamp!.at as [number, number], day < 0.32 || (A.rain > 0 && day < 0.55) ? 1 : 0); }   // the street lamp's head, from its own picture
    if (cf && !gpu) { const sp = cf.sprite, ox = Math.round(cf.x), oy = Math.round(cf.y), k = 0.25 + 0.75 * A.daylight, sc = cf.scale;   // no GPU: the car laid in, lit by the hour only
      for (let y = 0; y < Math.round(sp.h * sc); y++) for (let x = 0; x < Math.round(sp.w * sc); x++) { const j = (Math.min(sp.h - 1, Math.floor(y / sc)) * sp.w + Math.min(sp.w - 1, Math.floor(x / sc))) * 4; if (sp.rgba[j + 3]! < 128) continue; const X = ox + x, Y = oy + y; if (X < 0 || X >= 480 || Y < 0 || Y >= 270) continue; const i = (Y * 480 + X) * 4; d[i] = sp.rgba[j]! * k; d[i + 1] = sp.rgba[j + 1]! * k; d[i + 2] = sp.rgba[j + 2]! * k; } }
    if (caller) drawCaller(d, caller, Math.max(A.daylight, door * (g.house?.kitchen.lamp ? 0.5 : 0)));
    if (car) for (const p of car.puffs) { const r = 1 + p.age * 2.2, a = 0.28 * (1 - p.age / 2.2); for (let y = Math.floor(p.y - r); y <= p.y + r; y++) for (let x = Math.floor(p.x - r); x <= p.x + r; x++) { if (x < 0 || y < 0 || x >= 480 || y >= 270) continue; const w = a * Math.max(0, 1 - Math.hypot(x - p.x, y - p.y) / (r + 0.5)), i = (y * 480 + x) * 4, lv = 150 + 60 * A.daylight; d[i] = d[i]! + (lv - d[i]!) * w; d[i + 1] = d[i + 1]! + (lv - d[i + 1]!) * w; d[i + 2] = d[i + 2]! + (lv + 6 - d[i + 2]!) * w; } }
    return true; }
  const api = { draw, spots, act, cameOut, carArrives, carLeaves, carState: () => car?.m.state ?? 'none', letIn, visitorLeaves, hooks, collectorArrives, handOver, collecting: () => collecting, callerState: () => caller?.state ?? (leaving ? 'leaving' : 'none') }; (globalThis as { __front?: unknown }).__front = api;   // for tests
  return api;
}
