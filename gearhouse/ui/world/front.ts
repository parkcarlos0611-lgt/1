// The front of the house, the second living place (reviews 45, 46, 49): the planner's sprites and season pictures put
// together and lit by the game (render/place/front2.ts).
import type { App } from '../shell/app';
import { Front2, type Pic } from '../../render/place/front2';
import { air, moon, dayOfYear } from '../../core/atmosphere';
import { newGround } from '../../core/ground';
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

export function frontPlace(app: App) {
  let scene: Front2 | null = null, t = 0;
  function draw(dt: number): boolean {
    if (!scene) { const P: Record<string, Pic> = {}; for (const [n, [url, w, h]] of Object.entries(PICS)) { const px = pixels(url, w, h); if (!px) return false; P[n] = { px, w, h }; } scene = new Front2(cut as never, P); }
    t += dt; const W = app.world!, g = W.sim.g, sky = g.weather.today ?? 'clear', A = air(W.clock.today, W.clock.minute, sky, g.seed), gr = (g.ground ??= newGround());
    scene.draw(app.S.d, { t, dt, air: A, moon: moon(W.clock.today, W.clock.minute), minute: W.clock.minute, doy: dayOfYear(W.clock.today), houseLit: !!g.house?.kitchen.lamp, snow: gr.snow, wet: gr.wet });
    return true; }
  return { draw };
}
