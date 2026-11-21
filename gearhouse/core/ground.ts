// The ground outside, as the weather leaves it (review 49): snow lies for days after it falls and melts as it warms
// (rain melts it faster); the road and the paths are wet while it rains and dry slowly after, slower under cloud and
// in the cold. Kept in the save, so the morning after a snowfall is white.
import type { Air } from './atmosphere';

export interface Ground { /** 0 bare .. 1 covered */ snow: number; /** 0 dry .. 1 soaked */ wet: number; /** the game minute it was last brought up to */ at?: number }
export const newGround = (): Ground => ({ snow: 0, wet: 0 });

/** a stretch of `minutes` under the air `a` */
export function stepGround(gr: Ground, minutes: number, a: Air): void {
  if (minutes <= 0) return; const h = minutes / 60;
  gr.snow += a.snow * h / 3;                                                             // about three hours of steady snow covers it
  if (a.temp > 0.5) { const melt = (a.temp * 0.012 + a.rain * 0.12 + (a.daylight * (1 - a.cloud)) * 0.02) * h; gr.snow -= melt; gr.wet += melt * 0.6; }
  gr.wet += a.rain * h * 1.5;
  if (a.rain === 0) gr.wet -= h / (3 + a.cloud * 6 + (a.temp < 3 ? 6 : 0));            // dries in hours: slower under cloud and in the cold
  gr.snow = Math.max(0, Math.min(1, gr.snow)); gr.wet = Math.max(0, Math.min(1, gr.wet));
}
