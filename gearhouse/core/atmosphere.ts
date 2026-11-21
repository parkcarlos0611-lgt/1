// The air by the hour (review 42). The weather system decides each day's sky (clear, rain, snow) in the morning; the
// places need more than that, minute by minute: where the sun is (it comes through the kitchen window in a patch that
// moves across the floor), how much cloud there is, how hard it rains, how the wind blows, how cold it is. These are
// worked out here from the date, the minute and the day's sky, with a little variation from the hour that is the same
// every time the same hour is asked for (so a saved game shows the same weather). Nothing here changes the game.
import { parts, type DateStr } from './calendar';
import type { Sky } from './weather';

export interface Air {
  /** the sun's height above the horizon and its bearing from north, in degrees */
  sunAlt: number; sunAz: number;
  /** 0 at night, 1 in daylight (civil twilight in between) */
  daylight: number;
  /** 0 clear .. 1 overcast */
  cloud: number;
  /** 0 .. 1 */
  rain: number; snow: number; wind: number;
  /** degrees Celsius outdoors */
  temp: number;
  sky: Sky;
}

/** the town lies about here (a New England mill town) */
export const LATITUDE = 42.5;
const MONTH_TEMP = [-4, -3, 1, 7, 13, 19, 22, 21, 17, 11, 5, -1];

const rad = Math.PI / 180;
/** a number 0..1 that belongs to this seed, day and hour and channel */
function hash(seed: number, day: number, hour: number, ch: number): number {
  let h = (seed * 374761393 + day * 668265263 + hour * 2147483647 + ch * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
/** smooth from hour to hour */
function wave(seed: number, day: number, minute: number, ch: number): number {
  const h = minute / 60, i = Math.floor(h), f = h - i, s = f * f * (3 - 2 * f);
  return hash(seed, day, i, ch) * (1 - s) + hash(seed, day, i + 1, ch) * s;
}
export function dayOfYear(date: DateStr): number { const { year, month, day } = parts(date); return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 864e5) + 1; }

/** a body's height and bearing from its declination and hour angle (degrees) */
function place(declDeg: number, hourAngleDeg: number, lat: number): { alt: number; az: number } {
  const decl = declDeg * rad, H = hourAngleDeg * rad, phi = lat * rad;
  const alt = Math.asin(Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) / rad + 180;
  return { alt: alt / rad, az: (az + 360) % 360 };
}
const declination = (date: DateStr) => 23.44 * Math.sin(2 * Math.PI * (284 + dayOfYear(date)) / 365);
/** the sun at local solar time (1930: standard time, no summer time in most places) */
export function sun(date: DateStr, minute: number, lat = LATITUDE): { alt: number; az: number } { return place(declination(date), (minute / 60 - 12) * 15, lat); }

export function air(date: DateStr, minute: number, sky: Sky, seed: number): Air {
  const s = sun(date, minute), day = dayOfYear(date) + parts(date).year * 400;
  const daylight = Math.min(1, Math.max(0, (s.alt + 6) / 12));
  const w = (ch: number) => wave(seed, day, minute, ch);
  const cloud = sky === 'clear' ? 0.08 + 0.4 * w(1) ** 2 : 0.82 + 0.18 * w(1);
  const fall = 0.25 + 0.75 * w(2), lull = w(3) < 0.18 ? 0.15 : 1;
  const rain = sky === 'rain' ? fall * lull : 0, snow = sky === 'snow' ? fall * lull : 0;
  const wind = Math.min(1, 0.12 + 0.45 * w(4) + (sky === 'clear' ? 0 : 0.2));
  const m = parts(date).month - 1, diurnal = -Math.cos((minute / 60 - 3) / 24 * 2 * Math.PI);
  const temp = MONTH_TEMP[m]! + diurnal * (sky === 'clear' ? 6 : 3) - (sky === 'clear' ? 0 : 2) + (w(5) - 0.5) * 3;
  return { sunAlt: s.alt, sunAz: s.az, daylight, cloud, rain, snow, wind, temp, sky };
}

/** the moon, near enough for the sky: its phase (0 new, 0.5 full) from a known new moon; it stands that share of a turn
 *  east of the sun (so it rises about 50 minutes later each day), and a full moon rides as high as the sun does half a
 *  year on */
export function moon(date: DateStr, minute: number, lat = LATITUDE): { alt: number; az: number; phase: number } {
  const { year, month, day } = parts(date), days = (Date.UTC(year, month - 1, day) + minute * 60000 - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
  const phase = ((days / 29.530588) % 1 + 1) % 1, decl = declination(date) * Math.cos(2 * Math.PI * phase);   // full: opposite the sun
  const p = place(decl, (minute / 60 - 12) * 15 - phase * 360, lat);
  return { ...p, phase };
}
