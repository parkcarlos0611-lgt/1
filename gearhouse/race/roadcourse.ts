// Ashcombe Park (review 162): a fictional road circuit in the manner of the 1930s English park courses, laid out on
// level ground: 3.77 km, 13 m of concrete, run anticlockwise, completely flat (no banking, no bumps). A long main
// straight past the pits, Paddock Bend (a medium left), the Lodge Straight up to the fast Long Sweep (a 250 m right),
// the Top Road to the slow Hairpin (25 m), the long Back Straight down the hill, the Esses, Wood Lane, the Chapel
// complex (two lefts, 50 and 80 m) and the Last Corner (110 m) onto the main straight. The radii run 25 to 250 m, so a
// 1930s car brakes for most corners and a 1990s car for all but the Long Sweep's fastest line. The two straights
// after the Hairpin and the Chapel (Back Straight, Pit Lane Road) are solved so the loop closes on itself.
import { Track, type TrackSpec } from './track';

export const ROAD_COURSE: TrackSpec = {
  id: 'road', name: 'Ashcombe Park',
  pieces: [
    { kind: 'straight', len: 425, name: 'Main Straight' },
    { kind: 'arc', radius: 60, turn: 90, name: 'Paddock Bend' },
    { kind: 'straight', len: 330, name: 'Lodge Straight' },
    { kind: 'arc', radius: 250, turn: -60, name: 'Long Sweep' },
    { kind: 'straight', len: 300, name: 'Top Road' },
    { kind: 'arc', radius: 25, turn: 165, name: 'Hairpin' },
    { kind: 'straight', len: 1086.4, name: 'Back Straight' },
    { kind: 'arc', radius: 90, turn: 45, name: 'Esses' },
    { kind: 'straight', len: 30, name: 'Esses' },
    { kind: 'arc', radius: 90, turn: -45, name: 'Esses' },
    { kind: 'straight', len: 140, name: 'Wood Lane' },
    { kind: 'arc', radius: 50, turn: 40, name: 'Chapel' },
    { kind: 'straight', len: 60, name: 'Chapel' },
    { kind: 'arc', radius: 80, turn: 35, name: 'Chapel Exit' },
    { kind: 'straight', len: 150.4, name: 'Pit Lane Road' },
    { kind: 'arc', radius: 110, turn: 90, name: 'Last Corner' },
    { kind: 'straight', len: 425, name: 'Main Straight' }],
  start: { x: 0, y: -380, heading: 0 }, width: 13, easing: 24,   // the loop begins half way down the main straight, so the corners' easing does not lean it
  banking: [], bumps: [],
  landmarks: [{ s: 20, name: 'Start and finish', kind: 'line' }],
  joints: 10 };
export const roadCourse = () => new Track(ROAD_COURSE);
