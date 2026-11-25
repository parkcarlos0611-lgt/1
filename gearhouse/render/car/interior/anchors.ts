// Where an interior goes (docs/systems/109 section 4): a cabin is described by a few anchor points, and every part of
// the interior is placed by them, so the same seats, wheel, dash and cage go into any car's cabin box. The first set is
// the 959's (read off render/car/p959: the screen's foot and top, the doors, the sills, the roof). The trim's colours
// are data as well: black, brown and tan, as the cars of the time were trimmed.
// The car's axes: x from the nose back, y to the car's left, z up; mm.
import type { V } from '../mesh';

export interface CabinAnchors {
  /** the driver's side: 1 the car's left (y > 0), -1 its right */ side: 1 | -1;
  /** the floor's top */ floorZ: number;
  /** the dash's front plane (the face toward the seats) and its top's height; the dash runs forward from it to the screen's foot */ dashX: number; dashTopZ: number;
  /** the screen's foot (the cowl) and its top (the roof's front edge): x and z, and the cabin's half width there */ screenFoot: [number, number]; screenTop: [number, number]; screenHalf: [number, number];
  /** the steering wheel's centre and its column's rake (degrees from level) */ wheel: V; rake: number;
  /** the driver's hip point (the seat's socket); the passenger's is its mirror */ hip: V; /** the seat back's lean (degrees from upright) */ recline: number;
  /** the cabin's half width at the door cards (the elbow's height), the doors' front and rear edges, the sill's top and the belt line */ half: number; doorX: [number, number]; sillZ: number; beltZ: number;
  /** the tunnel between the seats: its half width and its top */ tunnelHalf: number; tunnelZ: number;
  /** the rear wall behind the seats (the back seats' foot) and the shelf's height */ rearX: number; shelfZ: number;
  /** the roof lining's height over the seats and the roof's half width inside */ roofZ: number; roofHalf: number }

/** the 959's cabin (render/car/p959: the screen's foot at x 1440, z 890, its top at 1983, 1249; doors 1437..2594, sill top 427, belt 876, roof 1281 outside) */
export const P959_CABIN: CabinAnchors = { side: 1, floorZ: 175, dashX: 1800, dashTopZ: 852, screenFoot: [1470, 884], screenTop: [1990, 1205], screenHalf: [640, 520], wheel: [2035, 365, 772], rake: 22,
  hip: [2470, 365, 430], recline: 23, half: 716, doorX: [1500, 2580], sillZ: 330, beltZ: 868, tunnelHalf: 100, tunnelZ: 318, rearX: 2960, shelfZ: 640, roofZ: 1232, roofHalf: 560 };

/** the trim's colours by role */
export interface Trim { name: string; /** the seats' leather and the seats' second tone (bolsters, piping) */ seat: string; seat2: string; /** the dash's pad (top and knee roll) and its face band */ dash: string; face: string; /** door cards, carpet, the tunnel's cover */ door: string; carpet: string; tunnel: string;
  /** the wheel's rim and pad, hard plastics (column, stalks, the binnacle's panel), bright metal (levers, rails) */ wheel: string; plastic: string; metal: string }
export const TRIMS = {
  black: { name: '검정', seat: '#34353a', seat2: '#26272b', dash: '#2b2c30', face: '#17181a', door: '#303136', carpet: '#3a3b40', tunnel: '#2a2b2f', wheel: '#232427', plastic: '#1c1d20', metal: '#9a9ca0' },
  brown: { name: '갈색', seat: '#7a3b27', seat2: '#63301f', dash: '#6b3322', face: '#222224', door: '#733826', carpet: '#52291d', tunnel: '#5c2d1f', wheel: '#6b3322', plastic: '#1f1f22', metal: '#9a9ca0' },
  tan: { name: '황갈색', seat: '#c08a50', seat2: '#a87540', dash: '#b47e47', face: '#232325', door: '#bb854c', carpet: '#8a6642', tunnel: '#a87540', wheel: '#b47e47', plastic: '#222224', metal: '#9a9ca0' },
} as const satisfies Record<string, Trim>;
export type TrimName = keyof typeof TRIMS;
