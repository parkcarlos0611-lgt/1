// The front of the house, the second living place (review 45): the sky, the tree, the chimney, the street lamp and the
// weather drawn by the game (render/place/outdoor.ts) over the planner's picture.
import type { App } from '../shell/app';
import { Outdoor, type OutdoorData } from '../../render/place/outdoor';
import { air, moon } from '../../core/atmosphere';
import { pixels } from './pics';
import data from '../../data/places/front.json';
import imgBase from '../../assets/places/front/front.png';
import imgRegions from '../../assets/places/front/regions.png';

export function frontPlace(app: App) {
  let scene: Outdoor | null = null, t = 0;
  function draw(dt: number): boolean {
    if (!scene) { const b = pixels(imgBase), r = pixels(imgRegions); if (!b || !r) return false; scene = new Outdoor(data as unknown as OutdoorData, b, r); }
    t += dt; const W = app.world!, g = W.sim.g, sky = g.weather.today ?? 'clear', A = air(W.clock.today, W.clock.minute, sky, g.seed);
    scene.draw(app.S.d, { t, dt, air: A, moon: moon(W.clock.today, W.clock.minute), minute: W.clock.minute, houseLit: !!g.house?.kitchen.lamp, wet: sky === 'rain' ? 1 : 0, snowCover: sky === 'snow' ? 0.75 : 0 });
    return true; }
  return { draw };
}
