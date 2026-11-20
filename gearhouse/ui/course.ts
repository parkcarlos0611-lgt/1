// The test course for the drive scene (review 24): asphalt, a gravel stretch with a log on one side and a hump on the
// other, a dip, a ledge, washboard, soft sand dunes, two rock steps, asphalt again. Two tracks, near and far.
import { SOILS, type Ground } from '../physics/rig';
import type { SurfaceKind } from '../render/car/scene';

const hs = (x: number, a: number, b: number, h: number) => (x > a && x < b ? h * Math.sin((x - a) / (b - a) * Math.PI) : 0);
const ramp = (x: number, a: number, b: number, h: number) => (x <= a ? 0 : x >= b ? h : h * (x - a) / (b - a));
const smooth = (x: number, a: number, b: number, h: number) => (x <= a ? 0 : x >= b ? h : h * (1 - Math.cos((x - a) / (b - a) * Math.PI)) / 2);
export const COURSE_END = 96;
export function kind(x: number): SurfaceKind { return x < 12 ? 'asphalt' : x < 46 ? 'gravel' : x < 62 ? 'sand' : x < 74 ? 'dirt' : 'asphalt'; }
const base = (x: number) =>
  - 0.12 * (x > 25 && x < 26.6 ? (1 - Math.cos((x - 25) / 1.6 * Math.PI * 2)) / 2 : 0)        // a dip
  - ramp(x, 33, 33.08, 0.22)                                                                   // a ledge down
  + (x > 37 && x < 43 ? 0.022 * Math.sin((x - 37) / 0.5 * Math.PI * 2) : 0)                    // washboard
  + smooth(x, 48, 52, 0.5) - smooth(x, 53, 57, 0.5) + hs(x, 57.5, 60, 0.18)                   // sand dunes
  + ramp(x, 65, 65.06, 0.18) + ramp(x, 67.5, 67.56, 0.16) - smooth(x, 70, 73, 0.34);           // two rock steps, down again
export const COURSE: Ground = {
  near: x => base(x) + hs(x, 16, 16.45, 0.13),
  far: x => base(x) + hs(x, 21, 21.55, 0.15) + (x > 37 && x < 43 ? 0.022 * (Math.sin((x - 37.25) / 0.5 * Math.PI * 2) - Math.sin((x - 37) / 0.5 * Math.PI * 2)) : 0),
  soil: x => SOILS[kind(x)]!,
};
