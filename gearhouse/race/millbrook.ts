// Millbrook Circuit (review 84): the game's first track, after the 1907 concrete motor course at Weybridge in Surrey
// that raced until 1939. The Outer Circuit: 4.45 km, 30.5 m (100 ft) wide, run anticlockwise. A finishing straight
// past the paddock, the Members' Banking (inner radius 1000 ft, turning through 165 degrees, about 9.5 m high at its
// steepest), the Railway Straight beside the line, the Byfleet Banking (inner radius 1500 ft, 213 degrees, 6.4 m high,
// gentler and longer) and the slight right-hand bend at the Fork, where the finishing straight branches off. Sources:
// Historic England listing 1020137 (heights), Motor Sport March 1930 and Grand Prix Engines note 104B (radii, turns,
// width, direction). The straights' lengths are fitted to the period plan with the radii held (mean error 14 m); the Fork's bend is
// taken as gently as the plan allows (radius 450 m).
import { Track, type TrackSpec } from './track';

const W = 30.5, R1 = 305 + W / 2, R2 = 457 + W / 2;
const HOME = 659.1, RAIL = 956.3, FORK = 20;
const ME = HOME + R1 * 165 * Math.PI / 180, RA = ME + RAIL, BY = RA + R2 * 213 * Math.PI / 180;
export const MILLBROOK_OUTER: TrackSpec = {
  id: 'millbrook', name: 'Millbrook Outer Circuit',
  pieces: [
    { kind: 'straight', len: HOME, name: 'Home Straight' },
    { kind: 'arc', radius: R1, turn: 165, name: "Members' Banking" },
    { kind: 'straight', len: RAIL, name: 'Railway Straight' },
    { kind: 'arc', radius: R2, turn: 213, name: 'Byfleet Banking' },
    { kind: 'straight', len: FORK, name: 'The Fork' },
    { kind: 'arc', radius: 450, turn: -18, name: 'The Fork' }],
  start: { x: 0, y: 0, heading: 59 * Math.PI / 180 }, width: W, easing: 90,
  banking: [
    { s0: HOME, s1: ME, height: 9.5, curve: 2.2, ease: 140, name: "Members' Banking" },
    { s0: RA, s1: BY, height: 6.4, curve: 1.8, ease: 160, name: 'Byfleet Banking' }],
  bumps: [
    { s: HOME + 70, height: 0.16, len: 7, name: "under the Members' Bridge" },   // the famous one: cars left the ground here
    { s: HOME + 260, height: 0.07, len: 5 }, { s: ME + 380, height: 0.06, len: 5 },
    { s: RA + 420, height: 0.09, len: 6, name: 'Byfleet Bridge over the river' }, { s: BY - 200, height: 0.05, len: 4 }],
  landmarks: [
    { s: 120, name: 'Start and finish', kind: 'line' },
    { s: HOME + 70, name: "Members' Bridge", kind: 'bridge' },
    { s: RA + 420, name: 'Byfleet Bridge', kind: 'bridge' },
    { s: BY + 10, name: 'The Fork', kind: 'fork' }],
  joints: 12 };
export const millbrook = () => new Track(MILLBROOK_OUTER);
