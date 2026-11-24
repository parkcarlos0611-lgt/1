// The 1994 Ferrari F355 Berlinetta (pop-up head lamps, Giallo Modena) as an assembly spec for the car kit
// (render/car/kit, docs/systems/95_nsx_kit_breakdown.md): its sheet's lines (data/cars/spec/f355.json,
// docs/systems/88_f355_sheet.md), the standard section's levels, the panels' kinds and shapes, the parts and their
// places, the colours. Data only. Axes: x from the nose back, y across, z up; mm. Axles at 1032 and 3482.
import { ENGINES } from '../enginemesh';
import type { CarKit } from '../kit/spec';
import sheet from '../../../data/cars/spec/f355.json';

const O = sheet.overall;
export const F355_KIT: CarKit = {
  id: 'f355',
  lines: {
    length: O.length,
    wheels: { f: { x: O.axleF, r: 319, y: O.trackF / 2, w: 225, rim: 229 }, r: { x: O.axleR, r: 335, y: O.trackR / 2, w: 265, rim: 229 } },
    arches: { f: { r: sheet.arches.front.radius, yin: 600 }, r: { r: sheet.arches.rear.radius, yin: 630 } },
    // the top's front edge, the front arch's front edge, the screen's foot (the A pillar's), the door's front edge, the
    // roof's front corner and back edge (the buttresses' roots), the rear glass's foot, the buttresses' feet on the
    // crest, the last station (the lip's corner)
    x: { X0: 22, XJ: 687, XA: 1442, XD: 1500, XR0: 1971, XR1: 2730, XG: 2900, XQ: 3773, XT1: 3990 },
    // half the roof at its rail, half the top at the screen's foot
    y: { YD: 590, screen: 765 },
    z: {
      /** the front top's centre line: the nose rolling over into the long straight bonnet, the cowl */
      bonnet: [[0, 455], [22, 468], [60, 490], [160, 545], [300, 604], [450, 655], [600, 700], [800, 748], [1000, 785], [1100, 805], [1160, 812], [1300, 814], [1442, 812]],
      /** the flank's top edge from the screen's foot: the belt, the quarter glass's foot, the rear wing's top, rising into the lip */
      crest: [[1442, 790], [2000, 805], [2650, 825], [2800, 846], [3000, 862], [3150, 869], [3400, 867], [3593, 862], [3773, 860], [3900, 866], [3990, 879]],
      /** the crease (the widest line, round the whole car) */
      shoulder: [[687, 502], [1000, 505], [1450, 528], [2000, 558], [2650, 594], [3000, 600], [3990, 605]],
      /** the roof's centre line and the upright rear glass under it */
      roof: [[1882, 1122], [1971, 1140], [2060, 1158], [2200, 1168], [2350, 1170], [2500, 1166], [2620, 1157], [2730, 1140], [2780, 1080], [2840, 990], [2900, 905]],
      /** the louvred cover and the deck, falling to the tail */
      deck: [[2900, 905], [2930, 896], [3200, 883], [3500, 866], [3650, 856], [3800, 846], [3940, 838], [3990, 842]],
      /** the flying buttresses' outer top edge (from the roof's back corner to the crest) */
      slant: [[2730, 1112], [2850, 1080], [3000, 1036], [3200, 976], [3400, 912], [3565, 866], [3700, 861], [3773, 860]],
      /** their inner top edge, then the deck's edge behind them */
      bInnerZ: [[2730, 1112], [2850, 1084], [3000, 1040], [3200, 980], [3400, 916], [3565, 868], [3700, 858], [3773, 855], [3990, 860]],
    },
    w: {
      /** half the width at the crease (the plan's widest line) */
      half: [[687, 901], [929, 907], [1076, 915], [1266, 920], [1400, 934], [1879, 940], [2661, 943], [3000, 948], [3230, 950], [3458, 942], [3567, 931], [3735, 920], [3925, 915], [3990, 905]],
      /** the crest's half-width: the front wing's crest, the belt under the side glass, the rear wing's top */
      crest: [[687, 817], [1032, 832], [1300, 812], [1442, 765], [2000, 768], [2650, 775], [3100, 798], [3593, 795], [3900, 772], [3990, 758]],
      /** the buttresses' outer top edge, swept out to the crest at their feet */
      slant: [[2730, 590], [3100, 625], [3450, 645], [3565, 652], [3700, 730], [3773, 785]],
      /** the buttresses' inner top edge and inner foot (the gutter), the engine cover's edge; behind them the deck */
      bInner: [[2730, 560], [2900, 522], [3100, 540], [3565, 622], [3700, 700], [3773, 735], [3990, 725]],
      bFoot: [[2730, 500], [2900, 505], [3100, 520], [3565, 572], [3773, 640], [3990, 650]],
      cover: [[2730, 470], [2930, 470], [3500, 535], [3990, 590]],
    },
    centre: { screen: 'XA', glassFoot: 'XG' }, belt: ['XA', 'XQ'],
    nose: { kind: 'pointed', tip: 'X0', pow: 5 },
    levels: { sill: 305, foot: 118 },
    stations: { arcDeg: 18, front: [], mid: ['XA', 'XD', 1560, 1640, 1720, 1800, 1880, 'XR0', 2060, 2150, 2250, 2350, 2450, 2530, 2600, 2680, 'XR1', 2780, 2840, 'XG', 2930, 3040], rear: [3900, 'XT1'] },
  },
  section: {
    shoulder: { reach: 0.6, drop: 0.1, lift: 0.5 }, door: [0.38, 0.72], step: 250, face: 190, tuck: 110,
    // the door's face, the scoop's foot (the sill's crease), the lip at 250 standing out, the slot under it, the foot
    inset: [[305, 22], [250, 14], [190, 32], [118, 46], [110, 90]],
    // the tail's lines: the lip's top, its sharp trailing edge, the face under it running forward, the tail panel's top
    // and foot, the bumper's ledge and top, its face (the plate's top and foot, the black line), the lower grille's top
    // and foot, the tuck
    tail: { from: 3842, to: 'XT1', levels: [879, 862, 848, 812, 628, 602, 596, 560, 410, 335, 235, 200], pow: 1.5 },
  },
  colours: { paint: '#f6c400', gloss: 0.6, smoke: '#4a1214', shade: '#2a2008', black: '#0d0d10', frame: '#16171b', dark: '#121216', trim: '#2a2a2e', glass: '#a9c2cc', silver: '#c3c6ca', chrome: '#d4d6d9', rubber: '#242328', lens: '#f2d9a8', red: '#e3281c', amber: '#e8a040', seat: '#b8763a', seat2: '#8e5a2c', seam: '#5a4300', white: '#e8e6de', metal: '#dfe1e4' },
  top: { shares: [0.2, 0.4, 0.558, 0.7, 0.84, 0.94, 1], noseCols: [0.17, 0.34, 0.523, 0.545, 0.72, 0.9], capRows: [0, 0.33, 0.66], capTo: 200, rows: [160, 310, 460, 580], lead: 30, blend: [300, 1350], screenHalf: 'screen',
    bow: { depth: 282, pow: 1.5, edge: 1.76 }, crown: 18, crownAt: [560, 900], roll: 40 },
  // below the shut line the bumper's lines: under the top's edge, the lamp slots' foot, the mouth's and the fog lamps', the
  // splitter's lip, the tuck; the openings cut as outlines
  nose: { kind: 'pointed', levels: [462, 420, 375, 290, 215, 175, 158, 145], reach: [18, 8, 4, 6, 30, 56, 81, 150], lampRise: 0, turn: 0.93, spread: 1.25, pow: 2.4,
    holes: [
      // the oval mouth across the centre line: black mesh, slats, the horse
      { name: 'grille', centre: true, rows: 3, pts: [4, 7], at: [0, 375], size: [380, 72], pow: 2.6, seg: 24, depth: 70, wall: 'dark', back: 'grille',
        bars: { z: [330, 357, 384, 411, 438], at: 0.6, t: 8, colour: 'frame' },
        emblem: { pts: [[-30, 0], [-10, 35], [12, 33], [22, -5], [8, -33], [-14, -35]], colour: 'silver', gloss: 0.8 } },
      // the lamp slots: a clear lens and an amber one
      { name: 'turnLamp', rows: [3, 6], pts: [4, 6], at: [615, 427], size: [148, 28], pow: 4, seg: 16, depth: 18, wall: 'frame', back: 'plain',
        lenses: [{ at: [-55, 0], size: [80, 20], pow: 4, seg: 12, colour: 'lens', gloss: 0.75, kind: 'lens', name: 'turnLamp' }, { at: [85, 0], size: [44, 18], pow: 4, seg: 10, colour: 'amber', gloss: 0.7, kind: 'lens', name: 'sideLamp' }] },
      // the round fog lamps
      { name: 'fogLamp', rows: [3, 5], pts: [6, 8], at: [480, 290], size: [50, 50], pow: 2, seg: 14, depth: 26, wall: 'frame', back: 'plain',
        lenses: [{ at: [0, 0], size: [38, 38], pow: 2, seg: 12, colour: 'trim', gloss: 0.8, kind: 'lens', name: 'fogLamp' }] },
    ] },
  bonnet: { cowl: 1360, cowlCols: 6 },
  bonnetBadge: { x: [222, 262], y: 20, lift: 3 },
  popup: { kind: 'popup', from: 160, to: 460, open: 24, depth: 70, lens: [[0.08, 0.46], [0.54, 0.92]], lensV: [0.15, 0.8, 4] },
  canopy: { kind: 'canopy', pillars: 'body',
    // behind the roof: the cover's columns (a raised panel's edge, the slots' edges, the cover's edge), the gutter, the buttress's inner top
    buttress: { cols: [[160, 2], [230, 4], [450, 9], ['cover', 12], ['bFoot', 20], ['bInner', 'bInnerZ']], ease: 'XG', glassCols: 5, foot: 5 },
    roof: { from: 'XR0', to: 'XR1', half: 'YD', crown: 40, pow: 3, bow: -89 }, screen: { rows: [0, 0.07, 0.3, 0.55, 0.8, 0.94, 1], bow: 14 },
    side: { pillar: 30, railAt: [2000, 2150], rail: [26, -26], railEnd: 2840, edge: 16, blow: 6, blowIn: ['XA', 1700], blowOut: [2450, 2600], to: 'XQ', taper: [2840, 3250] },
    slantFoot: 'XQ', rear: ['XR1', 2780, 2840, 'XG'], bPillar: 2600, quarter: 2680, rearGloss: 0.3, rearBlackRows: 0, rearBlackCols: 0, screenBand: { foot: 1, top: 6, cols: 1 } },
  door: { from: 'XD', to: 2680, frontSeam: [[1500, 785], [1500, 600], [1500, 300], [1500, 150]],
    rearSeam: [[[2700, 822], [2704, 700], [2690, 560]], [[2690, 300], [2672, 250], [2655, 150]]],
    handle: { pull: [2572, 2604, 716, 716, 694, 694], lock: [2584, 2592, 711, 711, 699, 699] } },
  // the long scoop from the door's front third back to the dark intake ahead of the rear wheel
  intake: { kind: 'scoop', from: 1560, to: 2600, full: 2400, depth: 110, lip: 8, paintRows: 11, profile: [0.7, 1, 1, 0.75], close: [2450, 0.3],
    fillets: [['to', 4, -1, 1], ['to', 7, -1, -1]], fillet: 0.55, fins: 0, fin: [0, 0, 0, 0] },
  deck: { kind: 'louvre', from: 'XG', edge: { y0: [0, 0], y1: [0, 0], blend: [3000, 3500] }, lidCols: 0, shut: 'XT1',
    louvre: { cols: [2, 3], x: 3085, pitch: 77, width: 35, count: 12, depth: 420, panel: { cols: 2, from: 3200, to: 3580, ease: 60, rise: 16 }, coverCols: 4, shelf: ['XG', 2930] } },
  tail: { kind: 'ducktail', shares: [1, 0.985, 0.955, 0.738, 0.54, 0.34, 0.16, 0], reach: [4048, 4108, 4094, 4104, 4172, 4180, 4248, 4256, 4232, 4205, 4185, 4140], pow: [3, 4], split: 5,
    duck: { bands: ['deck', 'deck', 'tailPanel', 'tailPanel', 'tailPanel', 'bumperR', 'bumperR', 'bumperR', 'bumperR', 'bumperR', 'valance'], slot: [2, 648], grille: [9, 516], valance: 10, line: [8, 760],
      holes: [{ name: 'bumperR', centre: true, rows: 5, pts: [7, 8], at: [0, 485], size: [280, 62], pow: 5, seg: 20, depth: 24, wall: 'shade', back: 'plain' }] } },
  // four round lamps each sunk in its recess: the outer bright red, the inner darker; the horse between, the script in the slot
  tailLamps: { round: { y: [745, 555], z: 707, r: 55, rim: 10, lift: [2, 3], seg: 16, names: ['tailLamp', 'fogLampR'], colours: ['red', 'smoke'], depth: 28, rows: [[2, 3], [3, 4]], pts: [3, 4] },
    badge: { bright: [22, 672, 738, 3] }, script: [380, 560, 818, 834, 3] },
  under: { axle: [50, 60] },
  cabin: { floor: 215, x: [1480, 2680], floorHalf: 700, cards: { x: [1500, 1800, 2200, 2680], inset: [16, 6] },
    dash: { reach: 200, sweep: 60, narrow: 0.97, z: 800, drop: 40, foot: [14, 0.985, 12], face: [80, 470] }, tunnel: [1560, 110, 360],
    wheel: { y: 370, side: -1, z: 700, rim: [[1700, 150], [1692, 174], [1712, 174], [1706, 150]], column: [[1600, 690], [1700, 700], 34] },
    seats: { x: [2080, 2470], y: [130, 600], cushion: 330, inset: 20, back: [[2420, 330], [2510, 600], [2580, 860], [2620, 945]], piping: { y: [150, 320], cushion: [2100, 2410, 332], back: [[2514, 602], [2580, 858]], w: 8 } },
    bulkhead: { dx: 6, at: 0.27, inset: [0.985, 7], col: 5, window: [860, 1050], hub: 955 } },
  bay: { x: [2935, 3985], y: [520, 560], z: [190, 600, 840] },
  repeater: [1405, 1455, 586, 610],
  sillSlot: [1880, 2600, 8],
  plate: [4230, 4236, -255, 255, 435, 535],
  // two round tips a side in the lower grille
  exhaust: { x: [4150, 4240, 4200], r: [40, 33], y: [-490, -360, 360, 490], z: 272, seg: 10, cap: 2 },
  // the longitudinal V8: bellhousing back at 3800, pulleys forward
  engine: { spec: ENGINES.f355!, at: [3800, 0, 400], opts: { dir: '-x', box: { len: 600, wid: 900, hgt: 560 }, detail: 2 } },
  mirror: { at: [1760, 930, 905], head: [[1660, 880], [1700, 846], [1800, 838], [1838, 900], [1830, 962], [1730, 972]], loft: [[850, 0.55, -30], [880, 0.95, -8], [985, 1, 0], [1008, 0.8, 0]], stalk: [[1540, 760, 800], [1720, 860, 880], 30, 18], glass: [[1836, 885, 860], [1840, 985, 948]] },
  wiper: { row: 1, arms: [[-600, -80], [20, 520]], lift: [12, 14], bar: [14, 10] },
  // the deep five-spoke star: a dark dish, five tapering spokes standing proud, a cap with five nuts
  wheel: { kind: 'star', seg: 20, tyre: { shoulder: 34, tread: 0.74, bulge: 0.95, roll: 12 }, lip: [6, 8, 9, 30, 14], back: [0.6, 20, 10], dish: { f: 72, r: 82 }, face: [40, 120, 50], faceMid: 0.4, faceGloss: 0.45,
    spokes: 5, phase: 0.05, openings: { lift: 2.5, rim: 10, r: [104, 116, 12], a: [0.17, 0.36, 0.3] }, vents: { r: 120, size: 26, seg: 8, lift: 2.5 },
    star: { a: [0.32, 0.12, 0.16], mid: 125, proud: 16, ridge: 7 }, hub: { cap: [6, 62, 10], nuts: 5, nut: [42, 9, 9, 5] } },
};
