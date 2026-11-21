// The kitchen, the first living place (review 42): the reference picture taken apart (tools/places/kitchen.py) and lit
// by the game every frame (render/place/room.ts). What the player can do here now: pull the lamp's chain, put the
// window up or down, light the gas under the kettle (a match, the flame, the water coming to the boil and the kettle
// whistling, steam fogging a shut window on a cold day). The table is where customers will sit (version one, step 4).
// The state is the house's (core/house.ts), saved with the game.
import type { App } from '../shell/app';
import type { Rect } from '../pixel/kit';
import { Room, type RoomData, type RoomEnv } from '../../render/place/room';
import { air } from '../../core/atmosphere';
import { newHouse, stepKitchen, type KitchenState } from '../../core/house';
import { pixels } from './pics';
import data from '../../data/places/kitchen.json';
import imgBase from '../../assets/places/kitchen/base.png';
import imgLamp from '../../assets/places/kitchen/lamp.png';
import imgFar from '../../assets/places/kitchen/far.png';
import imgRegions from '../../assets/places/kitchen/regions.png';

export interface KitchenSpot { r: Rect; label: () => string; act: string; hl: string[]; go?: 'workshop' }
const ROOM_TEMP = 18;

export function kitchenPlace(app: App) {
  let room: Room | null = null, lampLevel = -1, t = 0;
  const k = (): KitchenState => ((app.world!.sim.g.house ??= newHouse()).kitchen);
  const spots: KitchenSpot[] = [
    { r: { x: 96, y: 186, w: 290, h: 60 }, label: () => '탁자 (손님과 마주 앉는 곳)', act: 'table', hl: ['tableTop', 'cloth', 'legs'] },
    { r: { x: 24, y: 30, w: 117, h: 97 }, label: () => (k().windowWanted ? '창문 내리기' : '창문 올리기'), act: 'window', hl: ['glass', 'frame', 'curtain'] },
    { r: { x: 332, y: 86, w: 91, h: 124 }, label: () => (k().burner ? '화덕 불 끄기' : k().kettle >= 99 ? '물이 끓는다 · 불 끄기' : '화덕에 불 붙이기 (주전자)'), act: 'stove', hl: ['stoveTop', 'stove', 'kettle'] },
    { r: { x: 208, y: 0, w: 62, h: 54 }, label: () => (k().lamp ? '등 끄기 (줄)' : '등 켜기 (줄)'), act: 'lamp', hl: ['lamp'] },
    { r: { x: 462, y: 40, w: 18, h: 190 }, label: () => '공방 방으로', act: 'go', hl: [], go: 'workshop' } ];

  function act(a: string): boolean { const s = k(), snd = app.sound;
    if (a === 'lamp') { s.lamp = !s.lamp; snd.once('chain'); return true; }
    if (a === 'window') { s.windowWanted = s.windowWanted ? 0 : 1; snd.once('sash'); return true; }
    if (a === 'stove') { s.burner = !s.burner; snd.once(s.burner ? 'ignite' : 'tick'); return true; }
    return false; }

  /** draw the room into the screen; `over` is the spot under the pointer */
  function draw(dt: number, over: KitchenSpot | null): boolean {
    if (!room) { const b = pixels(imgBase), l = pixels(imgLamp), f = pixels(imgFar), r = pixels(imgRegions); if (!b || !l || !f || !r) return false; room = new Room(data as unknown as RoomData, { base: b, lamp: l, far: f, regions: r }); }
    t += dt; const W = app.world!, g = W.sim.g, s = k(), A = air(W.clock.today, W.clock.minute, g.weather.today ?? 'clear', g.seed);
    stepKitchen(s, dt, ROOM_TEMP, A.temp);
    const want = s.lamp ? 1 : 0; if (lampLevel < 0) lampLevel = want; lampLevel += (want - lampLevel) * Math.min(1, dt * (want ? 18 : 10));
    const env: RoomEnv = { t, dt, air: A, minute: W.clock.minute, lamp: lampLevel, window: s.window, burner: s.burner, kettle: s.kettle, fog: s.fog, highlight: over ? over.hl : null };
    room.draw(app.S.d, env);
    for (const q of room.sounds) if (q === 'drip' || q === 'rattle') app.sound.once(q);
    app.sound.ambient('simmer', Math.max(0, Math.min(1, (s.kettle - 55) / 45)) * (s.burner ? 1 : 0.4));
    app.sound.ambient('whistle', s.kettle >= 99 && s.burner ? 1 : 0);
    app.sound.ambient('rain', A.rain * (0.25 + 0.65 * s.window)); app.sound.ambient('wind', A.wind * (0.1 + 0.6 * s.window));
    return true; }

  /** leaving the kitchen: its sounds stop */
  function quiet() { app.sound.ambient('simmer', 0); app.sound.ambient('whistle', 0); }
  return { spots, act, draw, quiet, state: k };
}
