// The 1990 NSX (NA1: pop-up head lamps, the black roof) as an assembly spec for the car kit (render/car/kit; the same data as nsx.kit.ts,
// docs/systems/95_nsx_kit_breakdown.md): its sheet's lines (data/cars/spec/nsx.json, docs/systems/85_nsx_sheet.md),
// the standard section's levels, the panels' kinds and shapes, the parts and their places, the colours. Data only.
// Axes: x from the nose back, y across, z up; mm. Axles at 930 and 3460.
import { ENGINES } from '../enginemesh';
import type { CarKit } from '../kit/spec';
import sheet from '../../../data/cars/spec/nsx.json';

const O = sheet.overall;
export const NSX_KIT: CarKit = {
  id: 'nsx',
  lines: {
    length: O.length,
    wheels: { f: { x: O.axleF, r: 293, y: O.trackF / 2, w: 205, rim: 196 }, r: { x: O.axleR, r: 316, y: O.trackR / 2, w: 225, rim: 209 } },
    arches: { f: { r: sheet.arches.front.radius, yin: 560 }, r: { r: sheet.arches.rear.radius, yin: 630 } },
    // the top's front edge, the front arch's front edge (the nose's last row), the screen's foot (the A pillar's), the roof's
    // front corner and back edge, the quarter glass's tip, the rear glass's foot, the last station
    x: { X0: 45, XJ: 575, XA: 1410, XR0: 2050, XR1: 2690, XQ: 2960, XG: 3520, XT1: 4250 },
    // half the nose's top at the front arch, half the roof, half the top at the screen's foot
    y: { KW: 790, YD: 490, screen: 760 },
    z: {
      /** the front top's centre line: the nose, the long bonnet, the cowl, carried on to the pillars' feet */
      bonnet: [[0, 440], [25, 475], [50, 493], [100, 516], [200, 563], [300, 604], [400, 639], [500, 669], [600, 698], [700, 721], [800, 739], [900, 751], [1000, 762], [1110, 776], [1250, 776], [1410, 760]],
      /** the flank's top edge from the screen's foot (joined there to the front top's surface): the belt, the rear wing's ridge */
      crest: [[1410, 742], [1500, 734], [1750, 748], [2000, 757], [2250, 772], [2500, 790], [2750, 805], [2890, 826], [2960, 858], [3040, 870], [3108, 877], [3175, 880], [3520, 880], [3700, 868], [3850, 862], [3950, 870], [4050, 888], [4150, 897], [4250, 897]],
      /** the widest line's height (the shoulder, then the door's soft crease that runs into the intake) */
      shoulder: [[575, 500], [700, 520], [930, 540], [1450, 590], [2000, 597], [2500, 610], [2690, 614], [2960, 618], [3460, 610], [3900, 596], [4250, 580]],
      /** the roof's and the rear glass's centre line */
      roof: [[1975, 1136], [2050, 1152], [2100, 1160], [2250, 1169], [2400, 1170], [2550, 1165], [2650, 1156], [2700, 1149], [2800, 1126], [2900, 1102], [3000, 1073], [3200, 1003], [3400, 930], [3470, 902], [3520, 882]],
      /** the deck: the boot lid sinking a little toward the tail */
      deck: [[3520, 880], [3600, 875], [3700, 866], [3850, 855], [4000, 845], [4150, 838], [4300, 828]],
      /** the slanting edge between the quarter glass and the rear glass (from the roof's back corner, joined there), eased into the belt at its foot */
      slant: [[2690, 1132], [2750, 1092], [2820, 1018], [2890, 940], [2935, 888], [2960, 858]],
    },
    w: {
      /** half the width at the widest line (the plan) */
      half: [[575, 860], [636, 876], [698, 882], [1200, 882], [1383, 866], [1632, 866], [1900, 869], [2500, 873], [2700, 878], [2950, 881], [3100, 893], [3250, 903], [3350, 905], [3600, 898], [3700, 892], [3750, 884], [3813, 870], [3875, 860], [3937, 852], [4000, 842], [4062, 834], [4124, 825], [4187, 812], [4250, 799]],
      /** the crest's half-width: the front wing's crest, the belt under the side glass, the rear wing's ridge */
      crest: [[575, 790], [700, 812], [1217, 812], [1300, 796], [1410, 760], [2000, 762], [2690, 765], [2960, 752], [3040, 768], [3175, 785], [3351, 792], [3600, 790], [3900, 776], [4100, 765], [4250, 758]],
      slant: [[2690, 490], [2750, 600], [2820, 672], [2890, 722], [2960, 752]],
      /** the rear glass's edge behind the quarter glass: along the wing's ridge, then round its foot (the tongue) */
      glass: [[2960, 752], [3040, 712], [3108, 694], [3200, 675], [3300, 645], [3400, 590], [3460, 520], [3495, 440], [3512, 350], [3520, 230]],
    },
    centre: { screen: 'XA', glassFoot: 'XG' }, belt: ['XA', 'XQ'],
    nose: { kind: 'round', tip: 'X0', pow: 3 },
    levels: { sill: 355, foot: 125 },
    stations: { arcDeg: 18, front: [], mid: [1350, 'XA', 1500, 1620, 1750, 1900, 'XR0', 2200, 2350, 2500, 2600, 'XR1', 2750, 2820, 2890, 'XQ', 3040], rear: [3880, 3950, 4050, 4150, 'XT1'], pins: [630], snap: 20 },
  },
  section: {
    shoulder: { reach: 0.6, drop: 0.12, lift: 0.45 }, door: [0.38, 0.72], step: 338, face: 230, tuck: 118,
    inset: [[355, 14], [338, 30], [230, 36], [125, 46], [118, 90]],
    // the tail's lines: the spoiler's top edge, its trailing roll, its under-edge, the lamp panel's top, middle and foot, the
    // bumper's top edge, the plate's top and foot, the valance's top, middle and foot
    tail: { from: 3700, to: 'XT1', levels: [897, 890, 872, 820, 745, 668, 655, 550, 425, 395, 290, 210], pow: 1.5 },
  },
  colours: { paint: '#c8141e', gloss: 0.6, smoke: '#5a0c10', shade: '#1e0508', black: '#0c0c0f', frame: '#14151a', dark: '#131318', trim: '#25272d', glass: '#a9c2cc', silver: '#c9ccd0', chrome: '#d4d6d9', rubber: '#26242b', lens: '#eef0f2', red: '#c9221f', amber: '#e8901c', seat: '#3a3a40', seat2: '#63636b', seam: '#3d070b', white: '#e6e4dc', metal: '#dcdee1' },
  top: { shares: [0.2, 0.4, 0.6, 0.72, 0.84, 0.94, 1], noseCols: [0.15, 0.3, 0.452, 0.557, 0.72, 0.886], capRows: [0, 0.33, 0.66], capTo: 300, rows: [250, 330, 440], lead: 50, blend: [630, 1350], screenHalf: 'screen', bow: { depth: 300, pow: 1.3, edge: 1.6 }, crown: 10, crownAt: [400, 800], roll: 28 },
  // below the shut line the bumper's lines: the lamp strip 458-390, the centre intake 355-199, the outer ones 312-227, the lip
  nose: { kind: 'round', levels: [458, 390, 355, 312, 227, 199, 130, 108], reach: [8, 0, 0, 2, 13, 20, 34, 46], lampRise: 10, turn: 0.93, spread: 1.15, pow: 2.4 },
  bonnet: { cowl: 1285, cowlCols: 6 },
  bonnetBadge: { x: [78, 128], y: 34, lift: 3 },
  popup: { kind: 'popup', from: 250, to: 630, open: 23, depth: 75, lens: [[0.06, 0.48], [0.52, 0.94]], lensV: [0.12, 0.8, 5] },
  canopy: { kind: 'canopy', roof: { from: 'XR0', to: 'XR1', half: 'YD', crown: 18, pow: 2.4, bow: 75 }, screen: { rows: [0, 0.07, 0.3, 0.55, 0.8, 0.94, 1], bow: 12 },
    side: { pillar: 52, railAt: [1750, 2100], rail: [108, -42], railEnd: 2820, edge: 16, blow: 10, blowIn: ['XA', 1700], blowOut: [2750, 'XQ'], to: 'XQ' },
    slantFoot: 'XQ', rear: ['XR1', 2750, 2820, 2890, 'XQ', 3040, 3108, 3200, 3300, 3400, 3460, 3495, 3512, 'XG'],
    // the B pillar a broad black sail behind the door glass (about 200 mm), the quarter glass behind it; a clearer rear pane so the engine shows
    bPillar: 'XR1', quarter: 2890, rearGloss: 0.2, rearBlackRows: 2, rearBlackCols: 1, screenBand: { foot: 1, top: 5, cols: 1 } },
  door: { from: 'XA', to: 2750, frontSeam: [[1410, 735], [1414, 600], [1416, 420], [1418, 212]],
    // its rear edge: upright to the intake, then sweeping forward under it to the sill
    rearSeam: [[[2748, 803], [2740, 740], [2728, 680], [2712, 622]], [[2655, 350], [2600, 318], [2540, 266], [2480, 232], [2422, 210]]],
    handle: { pull: [2540, 2640, 726, 730, 704, 700], lock: [2655, 2677, 726, 727, 707, 706] } },
  intake: { from: 'XR1', to: 'XQ', full: 2890, depth: 150, lip: 12, paintRows: 2, fillets: [['to', 4, -1, 1], ['to', 7, -1, -1], ['from', 7, 1, -1]], fillet: 0.55, fins: 2, fin: [10, -6, 14, 8] },
  deck: { kind: 'lid', from: 3569, edge: { y0: [600, 590], y1: [715, 604], blend: [3900, 4150] }, lidCols: 5, shut: 3950 },
  tail: { kind: 'frame', shares: [1, 0.985, 0.95, 0.88, 0.8, 0.78, 0.6, 0.45, 0.33, 0.24, 0], reach: [4300, 4308, 4298, 4296, 4302, 4310, 4390, 4402, 4403, 4398, 4370, 4320],
    pow: [7, 3.4], split: 5, frameRows: 5, opening: [3, 2, 1], lampIn: 22, valIn: 35, blade: { from: 4150, cols: 7, under: 878, lead: [7, 888] }, plateRows: [9, 10], plateDepth: 26 },
  // in the smoked red panel: a round amber indicator at each end, the red run, a square clear reversing lamp either side of the badge's dark square
  tailLamps: { indicator: { y: 662, z: 748, rim: 56, lens: 49, lift: [4, 6], seg: 14 },
    patches: [['tailLamp', 'red', 0.7, 'lens', 398, 598, 690, 806, 3], ['stopLamp', 'red', 0.7, 'lens', 194, 394, 690, 806, 3], ['reverseLamp', 'white', 0.7, 'plain', 98, 184, 700, 796, 4]],
    badge: { dark: [88, 690, 806, 3], bright: [34, 716, 780, 5] } },
  under: { axle: [50, 60] },
  cabin: { floor: 160, x: [1230, 2700], floorHalf: 740, cards: { x: [1300, 'XA', 1750, 2250, 2700], inset: [16, 6] },
    dash: { reach: 210, sweep: 60, narrow: 0.97, z: 800, drop: 40, foot: [14, 0.985, 12], face: [70, 430] }, tunnel: [1450, 110, 350],
    wheel: { y: 375, side: -1, z: 690, rim: [[1612, 150], [1604, 176], [1626, 176], [1620, 150]], column: [[1480, 705], [1614, 690], 36] },
    seats: { x: [2010, 2480], y: [160, 600], cushion: 335, inset: 20, back: [[2430, 335], [2520, 620], [2600, 870], [2650, 940]], piping: { y: [150, 290], cushion: [2030, 2430, 337], back: [[2524, 622], [2600, 868]], w: 8 } },
    bulkhead: { dx: 6, at: 0.27, inset: [0.985, 7], col: 5, window: [860, 1050], hub: 955 } },
  bay: { x: [2708, 3545], y: [625, 708], z: [200, 700, 872] },
  fuelFlap: { pts: [[2992, 652], [3080, 648], [3162, 652], [3166, 712], [3160, 772], [3075, 776], [2992, 770], [2988, 712], [2992, 652]], side: -1 },
  marker: [3990, 4080, 462, 498], repeater: [1300, 1372, 568, 598],
  intakes: { centre: { rows: 3, cols: [6, 9], depth: 120, bars: [-190, 0, 190], barX: 70, barZ: [205, 350] }, outer: { rows: [4, 6], cols: [7, 8], depth: 90, fog: [5, 0, 0.85, 0.1, 0.9, 45] } },
  bumperLamps: { from: 4, split: 6, to: 9 },
  plate: [4383, 4390, -165, 165, 436, 538],
  exhaust: { x: [4270, 4392, 4326], r: [42, 35], y: [-515, 515], z: 268, seg: 10, cap: 2 },
  engine: { spec: ENGINES.nsx!, at: [3150, -260, 400], opts: { dir: 'y', box: { len: 620, wid: 680, hgt: 620 }, detail: 2 } },
  // the door mirrors: a body-coloured head on a short stalk from the door's top front corner
  mirror: { at: [1790, 880, 780], head: [[1668, 742], [1712, 702], [1806, 694], [1822, 776], [1816, 852], [1736, 866]], loft: [[808, 0.6, -30], [850, 0.96, -8], [965, 1, 0], [988, 0.8, 0]], stalk: [[1668, 762, 738], [1730, 815, 752], 56, 26], glass: [[1823, 852, 712], [1827, 972, 842]] },
  wiper: { row: 1, arms: [[-640, -120], [-30, 500]], lift: [12, 14], bar: [14, 10] },
  // the 1990 cast five-spoke wheel: a bright lip, a flat face of five broad spokes, a cap with five nuts
  wheel: { kind: 'fiveSpoke', seg: 24, tyre: { shoulder: 30, tread: 0.72, bulge: 0.94, roll: 10 }, lip: [3, 7, 5, 26, 14], back: [0.6, 28, 10], dish: { f: 30, r: 40 }, face: [60, 110, 44], faceMid: 0.35, faceGloss: 0.35,
    spokes: 5, phase: 0.1, openings: { lift: 2.5, rim: 10, r: [104, 116, 12], a: [0.17, 0.36, 0.3] }, vents: { r: 120, size: 26, seg: 8, lift: 2.5 }, hub: { cap: [8, 52, 10], nuts: 5, nut: [34, 10, 8, 5] } },
};

/** the swap test's second tail: the same frame, the lamp panel in the body's colour with two round lamps each side */
export const NSX_ROUND_TAIL: Pick<CarKit, 'tail' | 'tailLamps'> = {
  tail: { ...NSX_KIT.tail, kind: 'roundLamps' },
  tailLamps: { ...NSX_KIT.tailLamps, round: { y: [560, 330], z: 744, r: 62, rim: 9, lift: [4, 6], seg: 16, names: ['tailLamp', 'stopLamp'], colours: ['red', 'red'] } },
};
/** the swap test's second wheel: a dished plate with eight round vents */
export const NSX_DISC_WHEEL: Pick<CarKit, 'wheel'> = { wheel: { ...NSX_KIT.wheel, kind: 'disc', spokes: 8 } };

// ---- swaps with the kinds added for the F355 (docs/systems/97_model_benchmark.md): each must assemble and close on this car too ----
/** a ducktail in place of the frame and blade, two round lamps a side sunk in the panel */
export const NSX_DUCKTAIL: Pick<CarKit, 'tail' | 'tailLamps'> = {
  tail: { ...NSX_KIT.tail, kind: 'ducktail', band: [5, 10] },
  tailLamps: { badge: NSX_KIT.tailLamps.badge, sunk: { blocks: [[3, 6], [6, 8]], y: [588, 370], z: 744, r: 55, depth: 28, seg: 14, rim: 8, names: ['tailLamp', 'stopLamp'], colours: ['red', 'red'] } },
};
/** the star wheel: spokes over a deep well */
export const NSX_STAR_WHEEL: Pick<CarKit, 'wheel'> = { wheel: { ...NSX_KIT.wheel, kind: 'star', star: { r: [70, 120], a: [0.2, 0.13], well: 80, thick: 26, brake: 125 } } };
/** a pointed prow: the nose's plan from a table (a blunt tip, a tight corner, straight tapering sides) */
export const NSX_POINTED_NOSE: Pick<CarKit, 'lines' | 'nose'> = {
  lines: { ...NSX_KIT.lines, nose: { kind: 'pointed', tip: 'X0', pow: 3, plan: [[0, 0], [0.03, 0.4], [0.08, 0.66], [0.16, 0.8], [0.3, 0.88], [0.6, 0.95], [1, 1]] } },
  nose: { ...NSX_KIT.nose, kind: 'pointed', seam: true },
};
/** a fog lamp sunk in a round recess, the turn lamps' strip sunk as a slot, the intake's corner rounded */
export const NSX_SUNK_FRONT: Pick<CarKit, 'intakes' | 'bumperLamps'> = {
  intakes: { centre: { ...NSX_KIT.intakes.centre, fillets: [[3, 9, -1, -1]], fillet: 0.6, badge: [20, 250, 300] }, fog: { rows: [4, 6], cols: [7, 9], y: 520, z: 262, r: 40, depth: 30, seg: 10 } },
  bumperLamps: { ...NSX_KIT.bumperLamps, depth: 25, amberFirst: true },
};

// ---- the kinds added for the EB110 (docs/systems/96_kit_conversion_plan.md), sized for this car ----
/** fixed head lamps sunk in scooped pockets under flush glass, where the pop-up covers lie */
export const NSX_POCKET_LAMPS: Pick<CarKit, 'popup'> = { popup: { ...NSX_KIT.popup, kind: 'pocket', depth: 70, shallow: 12, faceFrom: 0.7, lens: [[0.2, 0.52], [0.6, 0.92]], lensV: [0.16, 0.86, 4], round: [1], ramp: { share: 0.14, fins: 4 } } };
/** lenses flush in the skin in the same place */
export const NSX_FIXED_LAMPS: Pick<CarKit, 'popup'> = { popup: { ...NSX_KIT.popup, kind: 'fixed' } };
/** a rear wing over the spoiler's blade: 'active' (it lies on the tail and rises with `wing`) */
export const NSX_ACTIVE_WING: Pick<CarKit, 'wing'> = { wing: { kind: 'active', from: 4040, back: 10, half: 690, sit: 560, across: [0, 0.25, 0.5, 0.75, 1], section: [[0, 0, -2], [0, 26, 8], [0.5, 0, 11], [1, -24, 9], [1, 0, 3], [0.5, 0, -8]], rise: 130, tilt: 8, pivot: 4160, struts: { y: [430], w: 50, t: 16 } } };

// ---- the builder's other kinds on this car (docs/systems/101, K1) ----
/** the EB110's kind of nose: the bumper a volume under the bonnet's edge, its apron straight across the middle, a shut line on top */
export const NSX_MASS_NOSE: Pick<CarKit, 'nose'> = { nose: { ...NSX_KIT.nose, kind: 'mass', pow: 2.6, seam: true, apron: { y: [380, 700], min: 0.1 } } };
/** the EB110's kind of tail: one plain panel down to the bumper's foot, the dark valance under it, a capsule of lamps each side */
export const NSX_CAPSULE_TAIL: Pick<CarKit, 'tail' | 'tailLamps'> = {
  tail: { ...NSX_KIT.tail, kind: 'capsule', split: 9, blade: undefined, lampIn: 0, valIn: 0, plateRows: [0, 0], plateDepth: 0, slots: [], pow: [1.65, 1.65] },
  tailLamps: { badge: { dark: [0, 0, 0, 0], bright: [0, 0, 0, 0] }, capsule: { y: [400, 640], z: 740, h: 55, grow: 9, lift: [3, 7], lenses: [['reverseLamp', 'white', 0.7, 'plain', 400, 454], ['tailLamp', 'red', 0.5, 'lens', 454, 588], ['indicatorR', 'amber', 0.7, 'plain', 588, 640]], block: ['smoke', 454, 576, 676, 708] } } };
