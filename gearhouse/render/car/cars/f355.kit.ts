// The 1994 Ferrari F355 Berlinetta as an assembly spec for the car kit (render/car/kit,
// docs/systems/95_nsx_kit_breakdown.md, docs/systems/97_model_benchmark.md): its sheet's lines (data/cars/spec/f355.json,
// docs/systems/88_f355_sheet.md), the standard section's levels, the panels' kinds and shapes, the parts and their
// places, the colours. Data only. Axes: x from the nose back, y across, z up; mm. Axles at 1032 and 3482.
// Kinds used: nose 'pointed', head lamps 'popup', canopy 'buttress', deck 'louvre', tail 'ducktail' (sunk round
// lamps), wheel 'star'; the long side scoop is the kit's side intake let into the door between its two door points.
import { ENGINES } from '../enginemesh';
import type { CarKit } from '../kit/spec';
import sheet from '../../../data/cars/spec/f355.json';

const O = sheet.overall;
export const F355_KIT: CarKit = {
  id: 'f355',
  lines: {
    length: O.length,
    wheels: { f: { x: O.axleF, r: 319, y: O.trackF / 2, w: 225, rim: 235 }, r: { x: O.axleR, r: 335, y: O.trackR / 2, w: 265, rim: 235 } },
    arches: { f: { r: sheet.arches.front.radius, yin: 600 }, r: { r: sheet.arches.rear.radius, yin: 630 } },
    // the top's front edge on the centre line, the screen's foot at the pillar, the roof's front corner and back edge, the
    // rear glass's foot (the deck's first row), the buttresses' tips, the last station (the tail's corner)
    x: { X0: 50, XA: 1442, XR0: 1971, XR1: 2730, XG: 2900, XQ: 3580, XT1: 4010 },
    // half the roof (the buttresses' inner top edge starts there), half the top at the screen's foot
    y: { YD: 500, screen: 745 },
    z: {
      /** the front top's centre line: the nose rolling over into the long straight bonnet, the cowl */
      bonnet: [[0, 450], [60, 490], [160, 545], [300, 604], [450, 655], [600, 700], [800, 748], [1000, 785], [1100, 805], [1160, 812], [1500, 812]],
      /** the flank's top edge from the screen's foot: the belt, the quarter glass's foot, the rear wing's top edge, the lip's end */
      crest: [[1442, 790], [2000, 805], [2650, 825], [2800, 846], [3000, 862], [3150, 869], [3400, 867], [3580, 862], [3750, 858], [3910, 852], [3970, 856], [4010, 872]],
      /** the crease (the widest line): the bumper's top line carried along the door to the rear wing */
      shoulder: [[687, 503], [1000, 505], [1450, 528], [2000, 558], [2650, 594], [3000, 600], [4010, 605]],
      /** the roof's centre line (its front edge bows back at the centre) */
      roof: [[1971, 1138], [2060, 1160], [2200, 1168], [2350, 1170], [2500, 1166], [2620, 1157], [2730, 1140]],
      /** the louvred cover's centre line falling back from the rear glass's foot, rising into the ducktail */
      deck: [[2900, 898], [3200, 883], [3500, 866], [3650, 856], [3800, 846], [3910, 840], [3970, 848], [4010, 866]],
      /** the buttresses' inner top edge, from the roof's back corner (joined there) to the tip (joined to the deck there) */
      slant: [[2730, 1112], [2850, 1080], [3000, 1036], [3200, 976], [3400, 912], [3580, 866]],
    },
    w: {
      /** half the width at the crease (the plan) */
      half: [[687, 898], [930, 906], [1076, 913], [1266, 921], [1450, 932], [1880, 939], [2660, 943], [3000, 947], [3230, 949], [3460, 943], [3570, 933], [3735, 922], [3925, 910], [4010, 896]],
      /** the crest's half-width: the front wing's top edge, the belt under the side glass, the rear wing's top edge */
      crest: [[687, 850], [1032, 862], [1300, 842], [1442, 765], [2000, 768], [2650, 775], [3100, 798], [3580, 795], [3910, 782], [4010, 770]],
      slant: [[2730, 500], [3100, 540], [3580, 600]],
      /** the buttresses' inner foot, then the gutter beside the louvred cover (the deck's rail column) */
      gutter: [[2900, 495], [3100, 520], [3580, 585], [3800, 580], [4010, 566]],
    },
    centre: { screen: 'XA', glassFoot: 'XG' }, belt: ['XA', 3150],
    // the prow's plan: a nearly flat front, a tight corner, long straight sides tapering forward from the front wheels
    nose: { kind: 'pointed', tip: 'X0', pow: 3, plan: [[0, 0], [0.016, 0.353], [0.039, 0.565], [0.078, 0.706], [0.1, 0.8], [0.15, 0.86], [0.22, 0.895], [0.39, 0.93], [0.58, 0.96], [0.785, 0.982], [1, 1]] },
    levels: { sill: 250, foot: 118 },
    stations: { arcDeg: 18, front: [], mid: ['XA', 1560, 1680, 1800, 1900, 'XR0', 2090, 2210, 2330, 2450, 2530, 2600, 2640, 2680, 'XR1', 2815, 'XG', 2975, 3050], rear: [3910, 3970, 'XT1'], pins: ['XQ'], snap: 20 },
  },
  section: {
    // the door's two points are the side scoop's top and foot edges
    shoulder: { reach: 0.6, drop: 0.12, lift: 0.45 }, door: [0.12, 0.8], step: 238, face: 190, tuck: 108,
    inset: [[250, 14], [238, 26], [190, 36], [118, 46], [108, 90]],
    // the tail's lines: the lip's top edge, its trailing roll and under-edge, the lamp panel's top, middle and foot, the
    // bumper's top edge, the plate's top and foot, the lower grille's top, its foot, the tuck
    tail: { from: 3842, to: 'XT1', levels: [872, 846, 805, 788, 707, 622, 596, 551, 418, 335, 228, 200], pow: 1.5 },
  },
  // Giallo Modena; tan leather
  colours: { paint: '#f5c300', gloss: 0.6, smoke: '#4a1214', shade: '#2a2008', black: '#0d0d10', frame: '#16171b', dark: '#121216', trim: '#2a2a2e', glass: '#a9c2cc', silver: '#c3c6ca', chrome: '#d4d6d9', rubber: '#242328', lens: '#eef0f2', red: '#e3281c', amber: '#e8a040', seat: '#b8763a', seat2: '#8e5a2c', seam: '#5a4300', white: '#e8e6de', metal: '#d2d4d8' },
  // columns: the bonnet's shut line at y 427 (column 3), the pop-up covers between columns 4 and 6 (445-735)
  top: { shares: [0.19, 0.383, 0.573, 0.6, 0.79, 0.965, 1], noseCols: [0.165, 0.335, 0.502, 0.524, 0.694, 0.865], capRows: [0, 0.33, 0.66], capTo: 240, rows: [200, 330, 460, 570], lead: 40, blend: [700, 1300], screenHalf: 'screen', bow: { depth: 282, pow: 1.3, edge: 1.75 }, crown: 16, crownAt: [500, 850], roll: 22 },
  // below the crease the bumper's lines: the grille's and the turn lamps' top 462, the lamps' foot 394, the grille's foot 308, the fog lamps' foot 228, the splitter
  nose: { kind: 'pointed', levels: [480, 462, 394, 308, 228, 205, 158, 148], reach: [34, 16, 4, 2, 30, 48, 82, 125], lampRise: 0, turn: 0.93, spread: 1, pow: 3, seam: true },
  bonnet: { cowl: 1360, cowlCols: 6, vents: { from: 1235, to: 1311, cols: [1, 3] } },
  bonnetBadge: { x: [380, 420], y: 22, lift: 3 },
  popup: { kind: 'popup', from: 200, to: 460, open: 24, depth: 70, lens: [[0.08, 0.46], [0.54, 0.92]], lensV: [0.15, 0.8, 5] },
  canopy: { kind: 'buttress', roof: { from: 'XR0', to: 'XR1', half: 'YD', crown: 22, pow: 2.4, bow: -89 }, screen: { rows: [0, 0.07, 0.3, 0.55, 0.8, 0.94, 1], bow: 14 },
    // the roof rail 88 out and 34 down from the roof's edge; behind the roof it is the buttress's top, narrowing to the tip
    side: { pillar: 60, railAt: [1800, 2000], rail: [88, -34], railEnd: 'XQ', edge: 20, blow: 8, blowIn: ['XA', 1700], blowOut: [2800, 3050], to: 'XQ' },
    slantFoot: 'XQ', rear: ['XR1', 2815, 'XG'], bPillar: 2600, quarter: 2680, rearGloss: 0.35, rearBlackRows: 0, rearBlackCols: 1, screenBand: { foot: 1, top: 5, cols: 1 },
    buttress: { header: [14, 16], quarterTip: 3191, taper: 3 } },
  door: { from: 'XA', to: 2680, lowerTo: 2680, frontSeam: [[1487, 788], [1487, 600], [1487, 400], [1487, 150]],
    rearSeam: [[[2700, 822], [2716, 600], [2700, 400], [2668, 250], [2655, 150]]],
    // the round push button high on the door's rear, the lock under it
    handle: { pull: [2566, 2594, 734, 734, 706, 706], lock: [2604, 2616, 726, 726, 714, 714] } },
  // the long side scoop: from the door's front third, deepening back to the dark intake ahead of the rear wheel; a sharp top edge under the crease, its foot a ramp
  intake: { from: 1560, to: 2640, full: 2450, depth: 105, lip: 14, footLip: 80, span: [5, 6], paintRows: 9, fillets: [['to', 5, -1, 1], ['to', 6, -1, -1]], fillet: 0.5, fins: 2, fin: [8, -6, 12, 6] },
  deck: { kind: 'louvre', from: 'XG', edge: { y0: [700, 700], y1: [770, 760], blend: [3900, 4010] }, lidCols: 4, shut: 3970, rail: { col: 5, line: 'gutter', until: 'XQ', ease: 'XT1' },
    // 12 slots a side at a pitch of 77, the long ones clear of the raised centre panel; the V8 under them
    louvre: { open: [2975, 3970], depth: 620, slots: { from: 3085, pitch: 77, n: 12, width: 35, y: [190, 450], long: 60, wall: 26 }, panel: { x: [3200, 3580], half: 205, rise: 22, inset: 30 } } },
  // rows across: the corner, the opening's slanting end (3 rows), the lamps' blocks (0.92-0.735, 0.735-0.545), the band's end 0.69, the plate 0.33
  tail: { kind: 'ducktail', shares: [1, 0.985, 0.96, 0.92, 0.735, 0.69, 0.545, 0.33, 0.2, 0], reach: [4075, 4118, 4137, 4140, 4184, 4199, 4250, 4255, 4225, 4205, 4183, 4150],
    pow: [5, 3.8], split: 5, frameRows: 6, opening: [3, 2, 1], lampIn: 22, valIn: 30, plateRows: [7, 9], plateDepth: 14, band: [5, 9], cutouts: [6, 7] },
  // two round lamps a side sunk in the panel (the outer bright red, the inner dark), the horse between
  tailLamps: { badge: { dark: [0, 690, 760, 3], bright: [17, 690, 752, 4] },
    sunk: { blocks: [[3, 4], [4, 6]], y: [730, 565], z: 707, r: 64, depth: 30, seg: 14, rim: 8, names: ['tailLamp', 'stopLamp'], colours: ['red', 'smoke'] } },
  under: { axle: [50, 60] },
  cabin: { floor: 215, x: [1500, 2700], floorHalf: 700, cards: { x: [1500, 1800, 2250, 2700], inset: [16, 6] },
    dash: { reach: 190, sweep: 50, narrow: 0.97, z: 800, drop: 30, foot: [14, 0.985, 12], face: [70, 470] }, tunnel: [1560, 110, 340],
    wheel: { y: 360, side: -1, z: 690, rim: [[1700, 150], [1692, 176], [1714, 176], [1708, 150]], column: [[1570, 705], [1702, 690], 36] },
    seats: { x: [2090, 2520], y: [150, 590], cushion: 380, inset: 20, back: [[2470, 380], [2560, 640], [2640, 880], [2680, 940]], piping: { y: [150, 290], cushion: [2110, 2470, 382], back: [[2564, 642], [2640, 878]], w: 8 } },
    bulkhead: { dx: 6, at: 0.3, inset: [0.985, 7], col: 6, window: [905, 1090], hub: 955, shelf: 190 } },
  repeater: [1396, 1426, 598, 628],
  // the dark sill slot under the scoop
  flankPatches: [['sillSlot', 'seam', 0.2, 1900, 2600, 202, 236]],
  // the oval grille (rows 0-3, lines 462-308) with its bars and the horse, the round fog lamps under the turn lamps' slots
  intakes: { centre: { rows: 3, cols: [5, 7], depth: 90, bars: [-285, -140, 0, 140, 285], barX: 46, barZ: [314, 456], slats: { z: [348, 386, 424], half: 400 }, badge: [15, 356, 416], fillets: [[3, 7, -1, -1]], fillet: 0.92 },
    fog: { rows: [3, 5], cols: [6, 8], y: 505, z: 292, r: 50, depth: 28, seg: 12 } },
  bumperLamps: { from: 4, split: 5, to: 6, col: 5, depth: 32, amberFirst: true },
  plate: [4243, 4249, -255, 255, 432, 540],
  exhaust: { x: [4150, 4242, 4192], r: [40, 33], y: [-490, -360, 360, 490], z: 268, seg: 10, cap: 2 },
  // the longitudinal V8: bellhousing at 3800, pulleys forward, the red intakes under the slats
  engine: { spec: ENGINES.f355!, at: [3800, 0, 418], opts: { dir: '-x', box: { len: 600, wid: 880, hgt: 560 }, detail: 2 } },
  mirror: { at: [1745, 890, 905], head: [[1660, 870], [1700, 838], [1810, 832], [1846, 900], [1836, 968], [1740, 978]], loft: [[830, 0.55, -20], [870, 0.95, -6], [985, 1, 0], [1005, 0.8, 0]], stalk: [[1640, 770, 800], [1720, 835, 870], 50, 24], glass: [[1847, 870, 846], [1850, 990, 962]] },
  wiper: { row: 1, arms: [[-560, -60], [-20, 480]], lift: [12, 14], bar: [14, 10] },
  // the 18 in five-spoke star: spokes broad at the hub, waisted, over a deep well with the brake disc in it
  wheel: { kind: 'star', seg: 24, tyre: { shoulder: 26, tread: 0.74, bulge: 0.95, roll: 9 }, lip: [3, 7, 5, 22, 12], back: [0.6, 28, 10], dish: { f: 34, r: 52 }, face: [58, 110, 44], faceMid: 0.35, faceGloss: 0.45,
    spokes: 5, phase: 0.05, openings: { lift: 2.5, rim: 10, r: [104, 116, 12], a: [0.17, 0.36, 0.3] }, vents: { r: 120, size: 26, seg: 8, lift: 2.5 }, star: { r: [78, 135], a: [0.2, 0.13], well: 95, thick: 30, brake: 150 },
    hub: { cap: [6, 40, 10], nuts: 5, nut: [58, 8, 9, 6] } },
};

/** swap tests: the kit's other tail on this car (one frame round a smoked lamp band, a blade over an open slot) */
export const F355_FRAME_TAIL: Pick<CarKit, 'tail' | 'tailLamps' | 'deck'> = {
  // the deck's edge rises to the wings' ridges ahead of the blade (the gutter beside the lid runs under it)
  deck: { ...F355_KIT.deck, edge: { y0: [700, 515], y1: [770, 560], blend: [3800, 3960] } },
  tail: { ...F355_KIT.tail, kind: 'frame', frameRows: 5, blade: { from: 3970, cols: 6, under: 850, lead: [7, 862] }, plateRows: [8, 9] },
  tailLamps: { indicator: { y: 700, z: 707, rim: 56, lens: 49, lift: [4, 6], seg: 14 }, patches: [['tailLamp', 'red', 0.7, 'lens', 420, 630, 650, 765, 3], ['stopLamp', 'red', 0.7, 'lens', 200, 410, 650, 765, 3]], badge: { dark: [88, 650, 765, 3], bright: [34, 676, 740, 5] } },
};
/** swap tests: the kit's flat cast five-spoke wheel on this car */
export const F355_FIVE_SPOKE: Pick<CarKit, 'wheel'> = { wheel: { ...F355_KIT.wheel, kind: 'fiveSpoke', dish: { f: 30, r: 40 } } };

// ---- the builder's swaps (core/design.ts, render/car/design.ts): the kinds native to the NSX, sized for this car ----
/** a round nose: the plan a super-ellipse from the tip to the front arch (full enough, power 4, that the crest is clear
 *  ahead of the top's first row at 200 out to the lamp covers' edge), the bumper's lines round it, one piece with the top */
export const F355_ROUND_NOSE: Pick<CarKit, 'lines' | 'nose'> = {
  lines: { ...F355_KIT.lines, nose: { kind: 'round', tip: 'X0', pow: 4 } },
  nose: { ...F355_KIT.nose, kind: 'round', seam: false },
};
/** a plain front: the turn lamps' strip flush on the bumper (clear lens outboard), the fog lamps behind the outer grilles
 *  (under the strip, a row clear of the oval grille so their pockets' walls do not meet) */
export const F355_PLAIN_FRONT: Pick<CarKit, 'intakes' | 'bumperLamps'> = {
  intakes: { centre: F355_KIT.intakes.centre, outer: { rows: [4, 6], cols: [6, 8], depth: 80, fog: [5, 0, 0.85, 0.1, 0.9, 40] } },
  bumperLamps: { from: 4, split: 5, to: 6, col: 5 },
};
/** the frame tail with the lamp panel in the body's colour, two round lamps a side */
export const F355_ROUND_TAIL: Pick<CarKit, 'tail' | 'tailLamps' | 'deck'> = {
  deck: F355_FRAME_TAIL.deck,
  tail: { ...F355_FRAME_TAIL.tail, kind: 'roundLamps' },
  tailLamps: { ...F355_FRAME_TAIL.tailLamps, round: { y: [640, 410], z: 707, r: 64, rim: 9, lift: [4, 6], seg: 16, names: ['tailLamp', 'stopLamp'], colours: ['red', 'red'] } },
};
/** a dished plate with eight round vents (the face sits as the five-spoke's; the vents on the 18 in rim's larger circle) */
export const F355_DISC_WHEEL: Pick<CarKit, 'wheel'> = { wheel: { ...F355_KIT.wheel, kind: 'disc', spokes: 8, dish: { f: 30, r: 40 }, vents: { r: 145, size: 30, seg: 8, lift: 2.5 } } };

// ---- the kinds added for the EB110 (docs/systems/96_kit_conversion_plan.md), sized for this car ----
/** a glass engine cover with six dark ribs in place of the louvres (the same opening and bay) */
export const F355_GLASS_DECK: Pick<CarKit, 'deck'> = { deck: { ...F355_KIT.deck, kind: 'glass', glass: { open: [2975, 3970], depth: 620, ribs: { from: 3090, pitch: 150, n: 6, width: 56, span: 0.86 } } } };
/** a fixed rear wing standing on two struts over the ducktail */
export const F355_FIXED_WING: Pick<CarKit, 'wing'> = { wing: { kind: 'fixed', from: 3820, back: 8, half: 720, sit: 560, across: [0, 0.25, 0.5, 0.75, 1], section: [[0, 0, -2], [0, 26, 8], [0.5, 0, 11], [1, -24, 9], [1, 0, 3], [0.5, 0, -8]], rise: 150, tilt: 7, pivot: 3930, struts: { y: [470], w: 50, t: 16 } } };
/** fixed head lamps sunk in scooped pockets under flush glass, where the pop-up covers lie */
export const F355_POCKET_LAMPS: Pick<CarKit, 'popup'> = { popup: { ...F355_KIT.popup, kind: 'pocket', depth: 66, shallow: 12, faceFrom: 0.7, lens: [[0.2, 0.52], [0.6, 0.92]], lensV: [0.16, 0.86, 4], round: [1], ramp: { share: 0.14, fins: 4 } } };
