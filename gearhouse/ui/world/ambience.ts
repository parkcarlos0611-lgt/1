// The quiet of each place (review 44): what you hear when nothing is happening, so a still room is not a silent one.
// - a room's low air (every indoor place; the garage's is bigger)
// - the refrigerator's motor in the kitchen, running a while and resting a while
// - the outdoors far off (the whole of it at the front of the house; through the walls inside, more with the window up)
// - now and then: sparrows in the morning, a car going by in the street, a steam whistle miles off, the house's boards
//   creaking on a cold or windy day; crickets on summer nights
// Made on the spot like the other sounds; the game's own are recorded (docs/version_list.md).
import type { Sound } from '../shell/sound';
import type { Air } from '../../core/atmosphere';

export type Where = 'front' | 'kitchen' | 'workshop' | 'garage' | 'phone';
export function ambience() {
  let fridgeOn = true, fridgeLeft = 25, bird = 4, car = 20, train = 90, creak = 30;
  return function tick(snd: Sound, where: Where, A: Air, minute: number, month: number, windowUp: number, dt: number) {
    const inside = where !== 'front', out = where === 'front' ? 1 : where === 'kitchen' ? 0.25 + 0.6 * windowUp : 0.2, h = minute / 60;
    snd.ambient('room', inside ? (where === 'garage' ? 1.3 : 1) : 0);
    fridgeLeft -= dt; if (fridgeLeft <= 0) { fridgeOn = !fridgeOn; fridgeLeft = fridgeOn ? 30 + Math.random() * 30 : 45 + Math.random() * 60; }
    snd.ambient('fridge', where === 'kitchen' && fridgeOn ? 1 : 0);
    snd.ambient('outside', out * (0.6 + 0.4 * A.wind));
    const summerNight = month >= 6 && month <= 9 && (h > 20.5 || h < 4) && A.rain === 0;
    snd.ambient('crickets', summerNight ? out : 0);
    const dry = A.rain === 0 && A.snow === 0;
    bird -= dt; if (bird <= 0) { bird = (h > 5 && h < 10 ? 3 : 9) + Math.random() * 10; if (dry && A.daylight > 0.3 && month >= 3 && month <= 10) snd.once('bird', { vol: out }); }
    car -= dt; if (car <= 0) { car = 25 + Math.random() * 60; if (h > 6 && h < 22) snd.once('car', { vol: out * 1.2 }); }
    train -= dt; if (train <= 0) { train = 120 + Math.random() * 200; snd.once('train', { vol: 0.5 + out }); }
    creak -= dt; if (creak <= 0) { creak = 20 + Math.random() * 40; if (inside && (A.temp < 5 || A.wind > 0.5)) snd.once('creak'); }
  };
}
