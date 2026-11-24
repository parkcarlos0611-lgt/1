// The Speed Bowl (review 162; the plan in review 140, its dumbbell): a concrete proving ground for top speed, two
// parallel 15 km straights joined by two flat 180-degree turns of 1.2 km radius, 16 m wide, run anticlockwise; a lap
// 37.5 km. The turns are left flat: at 1.2 km a 340 km/h car needs 0.76 g, which radial tyres give, and the test
// driver lifts to about 290 there. The start line stands 400 m into the south straight; boards mark 400 m and 1 km
// from it, and the flying kilometre's timing posts stand at 11 and 12 km, leaving 2.6 km to slow for the turn.
// The lap is measured from the start line (beyond the turns' easing, so the straights lie true), and the layout is
// centred on the origin (the line at x -7.1 km, the turns' far edges at 8.7 km) so the positions stay precise in the
// GPU's 32-bit numbers (about a millimetre at 8 km).
import { Track, type TrackSpec } from './track';

export const STRAIGHT = 15000, TURN_R = 1200, LINE = 400;
export const SPEEDWAY: TrackSpec = {
  id: 'speed', name: 'Speed Bowl',
  pieces: [
    { kind: 'straight', len: STRAIGHT - LINE, name: 'South Straight' },
    { kind: 'arc', radius: TURN_R, turn: 180, name: 'East Turn' },
    { kind: 'straight', len: STRAIGHT, name: 'North Straight' },
    { kind: 'arc', radius: TURN_R, turn: 180, name: 'West Turn' },
    { kind: 'straight', len: LINE, name: 'South Straight' }],
  start: { x: -STRAIGHT / 2 + LINE, y: -TURN_R, heading: 0 }, width: 16, easing: 300,
  banking: [], bumps: [],
  landmarks: [
    { s: 0, name: 'Start and finish', kind: 'line' },
    { s: 400, name: '400 m', kind: 'mark' },
    { s: 1000, name: '1 km', kind: 'mark' },
    { s: 11000, name: 'Flying km start', kind: 'mark' },
    { s: 12000, name: 'Flying km end', kind: 'mark' }],
  joints: 15 };
export const speedway = () => new Track(SPEEDWAY);
