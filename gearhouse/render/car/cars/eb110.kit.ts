// The 1991 Bugatti EB110 GT as an assembly spec for the car kit (render/car/kit, docs/systems/96_kit_conversion_plan.md):
// its sheet's lines (data/cars/spec/eb110.json, docs/systems/80_eb110_spec_sheet.md; the tables are those of the
// panel-built render/car/mesh_eb110.ts, which the kit build is checked against), the standard section's levels, the
// panels' kinds and shapes, the parts and their places, the colours. Data only.
// Axes: x from the nose back, y across, z up; mm. Axles at 1040 and 3590.
// Kinds used: nose 'mass' (the bumper a volume standing ahead of the bonnet's front edge), head lamps 'pocket' (fixed
// units sunk in the bonnet's corners under flush glass), the shelf (the scooped trough beside the lamps, then the ledge
// round the cabin), canopy 'bubble' (a narrow cabin on its own belt line, its roof running on as a fastback with a glass
// engine cover and sunk ports), deck 'lid' (the wing's bed), tail 'capsule', the active rear wing, wheel 'disc'.
import { ENGINES } from '../enginemesh';
import type { CarKit } from '../kit/spec';
import { NSX_KIT } from './nsx.kit';
import { F355_KIT } from './f355.kit';
import sheet from '../../../data/cars/spec/eb110.json';

const O = sheet.overall;
/** the top's front edge in plan, [x, y]: the bonnet's tongue (y 0-181), the lamps' front edge (to 612), the indicator's
 *  (to its tip at 440, 729), then back along the wing's crest to the front arch */
const EDGE: [number, number][] = [[352, 0], [352.3, 70], [353, 140], [355, 181], [358, 290], [362, 400], [368, 510], [378, 612], [396, 680], [440, 729], [490, 748], [545, 763], [600, 775], [645, 784], [690, 792.4]];
/** the roof's and the deck's centre line */
const SPINE: [number, number][] = [[1990, 1094], [2060, 1104], [2124, 1108], [2266, 1115], [2361, 1118], [2502, 1115], [2644, 1110], [2786, 1097], [2928, 1082], [3070, 1066], [3211, 1048], [3353, 1027], [3495, 1003], [3637, 975], [3778, 949], [3950, 925], [4150, 898], [4300, 872], [4400, 852]];
export const EB110_KIT: CarKit = {
  id: 'eb110',
  lines: {
    length: O.length,
    wheels: { f: { x: O.axleF, r: 326, y: O.trackF / 2, w: 245, rim: 240 }, r: { x: O.axleR, r: 326, y: O.trackR / 2, w: 310, rim: 240 } },
    // the arches are half-ellipses, taller than they are long
    arches: { f: { r: 350, yin: 600, rz: 362 }, r: { r: 362, yin: 610, rz: 392 } },
    // the top's front edge on the centre line, the screen's corners, the roof's front edge, the cabin's back (the B pillar),
    // the fastback's end (the deck's first row a station on), the last station (the tail's corner)
    x: { X0: 352, XA: 1246, XR0: 1990, XR1: 2530, XG: 4050, XT1: 4330 },
    // half the bonnet at the screen's foot
    y: { screen: 652 },
    z: {
      /** the bonnet's centre line from the bumper's shut line to the screen's foot (the plateau is level across at the lamps) */
      bonnet: [[105, 405], [142, 428], [236, 478], [331, 524], [425, 565], [520, 607], [614, 648], [709, 692], [803, 730], [898, 758], [990, 776], [1085, 789], [1246, 795]],
      /** the crest from the indicator's tip (joined there to the bonnet's plane): the wing's crest, lower than the bonnet's edge
       *  beside the lamps, the door's shoulder, the rear wing's top */
      crest: [[440, 571], [490, 560], [545, 576], [600, 592], [645, 608], [688, 625], [767, 662], [858, 702], [949, 730], [1040, 745], [1148, 752], [1246, 757], [1392, 768], [1546, 783], [2000, 782], [2530, 795], [2800, 840], [3200, 872], [3600, 880], [4000, 850], [4330, 760]],
      /** the widest line's height */
      shoulder: [[688, 450], [1040, 500], [2000, 520], [3000, 590], [3590, 620], [4100, 600], [4330, 560]],
      roof: SPINE, deck: SPINE,
      /** the belt behind the screen's corners (joined there to the bonnet's edge): the side glass's foot, then the foot of the fastback's flank */
      belt: [[1246, 780], [1392, 781], [1546, 791], [2000, 792], [2530, 806], [2800, 850], [3200, 885], [3600, 895], [4000, 872], [4330, 800]],
      /** the drop from the roof's edge to the side glass's top */
      rail: [[1990, 44], [2530, 44], [3600, 40], [4330, 26]],
      /** the wall that drops from the bonnet's edge into the trough beside the lamps: its height */
      wall: [[440, 0], [490, 18], [545, 38], [600, 54], [688, 52], [767, 40], [858, 24], [949, 10], [1040, 0]],
      /** the skirt's recess: its crisp upper shelf, its foot (the sill's top) */
      recessTop: [[690, 368], [1040, 400], [1392, 412], [4330, 412]], recessFoot: [[690, 285], [1392, 300], [2200, 300], [2700, 232], [4330, 232]],
    },
    w: {
      /** half the width at the widest line (the sheet's plan) */
      half: [[688, 880], [800, 888], [1000, 896], [1200, 908], [1500, 908], [2100, 925], [2400, 934], [2600, 954], [2800, 963], [3000, 975], [3200, 970], [3600, 965], [3800, 960], [4000, 950], [4100, 930], [4200, 890], [4300, 838], [4330, 826]],
      /** the crest's half-width */
      crest: [[440, 729], [490, 748], [545, 763], [600, 775], [645, 784], [688, 792], [767, 804], [858, 812], [949, 818], [1040, 824], [1148, 830], [1246, 833], [1392, 822], [1546, 800], [2000, 790], [2530, 800], [2800, 840], [3200, 880], [3600, 885], [4000, 860], [4330, 818]],
      /** the bonnet's edge (straight back from the lamps' outer corners), then the belt */
      belt: [[440, 616], [600, 616], [1246, 652], [1392, 672], [1546, 688], [2000, 695], [2530, 700], [2800, 745], [3200, 790], [3600, 800], [4000, 800], [4330, 808]],
      /** the tongue's edge: the lamps' inner edge, then a line on the bonnet */
      tongue: [[355, 181], [440, 213], [520, 244], [600, 274], [900, 281], [1246, 290]],
      /** the roof's edge, widening into the fastback's */
      roofEdge: [[1990, 405], [2530, 418], [2800, 450], [3200, 530], [3600, 640], [3900, 710], [4330, 740]],
      /** the glass engine cover's edge */
      cover: [[1990, 316], [2530, 326], [2800, 351], [3200, 413], [3370, 450], [4330, 450]],
    },
    centre: { screen: 'XA', glassFoot: 'XG' }, belt: ['XA', 'XG'],
    nose: { kind: 'pointed', tip: 'X0', pow: 2.6, plan: EDGE.map(([x, y], i) => [i === 1 ? 0.001 : (x - 352) / 338, y / 792.4] as [number, number]) },
    levels: { sill: 200, foot: 128 },
    stations: { arcDeg: 18, front: [], mid: [1470, 1546, 1700, 1845, 'XR0', 2100, 2210, 2320, 2430, 'XR1', 2620, 2710, 2800, 2890, 2980, 3120], rear: ['XG', 4130, 4200, 4260, 4300, 'XT1'] },
  },
  section: {
    // the door's two points are the skirt recess's upper shelf and its foot
    shoulder: { reach: 0.6, drop: 0.12, lift: 0.45 }, door: [0.3, 0.7], doorZ: ['recessTop', 'recessFoot'], step: 160, face: 138, tuck: 122,
    inset: [[200, 33], [160, 41], [138, 47], [128, 50], [122, 60]],
    // behind the rear wheel the body's lower edge rises to the tail panel's foot (the diffuser): the panel from its top edge
    // down to its foot line at 560, the shallow black valance under it
    tail: { from: 3883, to: 'XT1', levels: [760, 710, 660, 610, 560, 556, 552, 548, 544, 540, 536, 535], pow: 2, run: 1.3 },
  },
  // Bugatti blue; grey leather
  colours: { paint: '#1b3a8a', gloss: 0.6, smoke: '#8e1a1a', shade: '#0f2562', black: '#0d0d10', frame: '#14151a', dark: '#131318', trim: '#25272d', glass: '#a9c2cc', silver: '#c4c7cc', chrome: '#d4d6d9', rubber: '#26242b', lens: '#eef0f2', red: '#c9221f', amber: '#e8901c', seat: '#8d8e94', seat2: '#6c6d73', seam: '#0c1a45', white: '#e9e4dc', metal: '#a9adb2' },
  // columns: the tongue's edge (column 3, y 181 at the front running out to 290), the bonnet's edge (column 6); the lamps between
  top: { shares: [0.1074, 0.2147, 0.2776, 0.4985, 0.7178, 0.9387, 1], noseCols: [0.0883, 0.1767, 0.2284, 0.4101, 0.5906, 0.7723], capRows: [0], capTo: 396, rows: [396, 440, 520, 600, 645], lead: 0, blend: [600, 1246], screenHalf: 'screen',
    bow: { depth: 161, pow: 1.5, edge: 2.2 }, bowFrom: 600, bowCol: 6, crown: -24, crownAt: [640, 1000], crownOver: 630, roll: 0, crestFrom: 440, rails: [{ col: 3, line: 'tongue' }, { col: 6, line: 'belt' }] },
  // the bumper: its shut line 405 on the centre line (rising 45 to the arches), then 368, the intakes 285-130, the lip
  nose: { kind: 'mass', levels: [405, 368, 285, 235, 185, 130, 108, 100], reach: [105, 82, 48, 26, 16, 14, 24, 42], lampRise: 45, turn: 0.93, spread: 0.85, pow: 2.6, seam: true, apron: { y: [420, 760], min: 0.1 } },
  // one plateau out to its edge, which is a real step (no shut line)
  bonnet: { cowl: 'XA', cowlCols: 0, cols: 6, seam: false },
  bonnetBadge: { x: [154, 176], y: 40, lift: 6, colour: 'red' },
  // the lamps cut into the bonnet's front corners: 14 deep at the front edge, 72 at the back; the fluted unit inboard, the projector outboard
  popup: { kind: 'pocket', from: '@front', to: 600, cols: [3, 6], open: 0, depth: 72, shallow: 14, faceFrom: 0.72, lens: [[0.28, 0.58], [0.66, 0.94]], lensV: [0.16, 0.86, 4], round: [1], ramp: { share: 0.2, fins: 6 } },
  // the trough beside each lamp (the amber indicator at its mouth), dying out toward the screen's corner; then the ledge round the cabin
  shelf: { from: 440, lamp: 'amber', wall: 'wall', out: [10, 6], sag: 12, sagAt: [440, 520, 900, 1300], slot: { x: [2560, 2790], n: 3 } },
  canopy: { kind: 'bubble', roof: { from: 'XR0', to: 'XR1', half: 0, crown: 14, pow: 2, bow: 0 }, screen: { rows: [0, 0.06, 0.3, 0.55, 0.8, 0.95, 1], bow: 22 },
    // the pillar's frame takes the whole side ahead of the door glass (1546), narrowing to the band under the rail
    side: { pillar: 999, railAt: [1546, 'XR0'], rail: [45, -44], railEnd: 'XG', edge: 22, blow: 0, blowIn: ['XA', 1700], blowOut: [2300, 'XR1'], to: 'XG' },
    slantFoot: 'XG', rear: [], bPillar: 'XR1', quarter: 'XR1', rearGloss: 0.5, rearBlackRows: 0, rearBlackCols: 0, screenBand: { foot: 1, top: 5, cols: 1 },
    // six oval ports in each flank of the fastback (two blocks of three), the glass cover between 2710 and 3702 with six ribs
    bubble: { edge: 'roofEdge', belt: 'belt', rail: 'rail', cols: [0, 0.26, 0.52, 0.78, 0.85, 0.93, 1], follow: { col: 3, line: 'cover' }, glassFrom: 1546,
      ports: { rows: [[2620, 2800], [2800, 2980]], r: [0.36, 0.36], depth: 38, seg: 8 }, cover: { from: 2710, to: 3702, cols: 3, ribs: { from: 2775, pitch: 150, n: 6, width: 64, span: 0.9 } } } },
  // the scissor door: its back edge sweeps down and forward to the recess's shelf; no handle on the skin
  door: { from: 1470, to: 'XR1', lowerTo: 'XR1', noHandle: true, frontSeam: [[1520, 772], [1500, 650], [1462, 450], [1425, 305]],
    rearSeam: [[[2518, 786], [2500, 700], [2469, 561], [2425, 470], [2396, 418]], [[1425, 302], [1700, 300], [2000, 300], [2264, 302]]], handle: { pull: [0, 0, 0, 0, 0, 0], lock: [0, 0, 0, 0, 0, 0] } },
  // the skirt's recess under a crisp shelf, deepening to the intake's mouth ahead of the rear wheel
  intake: { from: 1470, to: 2890, full: 2600, depth: 85, span: [5, 6], lip: 10, paintRows: 99, paintWalls: true, fillets: [], fillet: 0.5, fins: 0, fin: [0, 0, 0, 0] },
  // the wing's bed: the deck's last rows, falling to the wings' tops at its edges
  deck: { kind: 'lid', from: 4130, edge: { y0: [735, 745], y1: [800, 818], blend: [4130, 'XT1'] }, lidCols: 6, shut: 'XT1', noSeam: true },
  // the tail panel leans back to its foot line (round in plan, 70 behind the corners on the centre line)
  tail: { kind: 'capsule', shares: [1, 0.985, 0.96, 0.9, 0.8, 0.65, 0.45, 0.25, 0], reach: [4360, 4370, 4380, 4390, 4400, 4396, 4390, 4384, 4378, 4372, 4366, 4350], pow: [1.65, 1.65], split: 4,
    frameRows: 8, opening: [3, 2, 1], lampIn: 0, valIn: 0, plateRows: [0, 0], plateDepth: 0,
    // six mesh slots across the top, two more each side below; the wing's dark bed along the top
    slots: [[12, 134, 742, 770], [158, 280, 742, 770], [304, 426, 742, 770], [304, 426, 690, 716], [304, 426, 638, 664]], bed: [690, 806, 842] },
  // a capsule each side: clear inboard, red, amber outboard; a dark red block low in it
  tailLamps: { badge: { dark: [0, 0, 0, 0], bright: [0, 0, 0, 0] },
    capsule: { y: [512, 724], z: 700, h: 60, grow: 9, lift: [3, 7], lenses: [['reverseLamp', 'white', 0.7, 'plain', 512, 566], ['tailLamp', 'red', 0.5, 'lens', 566, 672], ['indicatorR', 'amber', 0.7, 'plain', 672, 724]], block: ['smoke', 566, 660, 636, 668] } },
  // the GT's retracting wing: it lies in the tail, and rises 110 on two struts, tilted 10 degrees
  wing: { kind: 'active', from: 4085, back: 12, half: 725, sit: 700, across: [0, 0.207, 0.414, 0.621, 0.828, 1], section: [[0, 0, -4], [0, 28, 6], [0.5, 0, 9], [1, -26, 8], [1, 0, 2], [0.5, 0, -12]],
    rise: 110, tilt: 10, pivot: 4240, struts: { y: [576], w: 54, t: 16 }, bed: { from: 4040, half: 690, n: 8 } },
  under: { axle: [50, 70] },
  cabin: { floor: 150, x: [1396, 2524], floorHalf: 700, cards: { x: [1396, 1700, 2100, 2524], inset: [118, 4] },
    dash: { reach: 150, sweep: 40, narrow: 0.985, z: 812, drop: 40, foot: [12, 0.985, 10], face: [50, 430] }, tunnel: [1500, 105, 355],
    wheel: { y: 335, side: -1, z: 680, rim: [[1640, 150], [1632, 176], [1654, 176], [1648, 150]], column: [[1500, 700], [1642, 680], 36] },
    seats: { x: [1890, 2340], y: [150, 520], cushion: 335, inset: 15, back: [[2270, 335], [2330, 620], [2400, 850], [2460, 880]], piping: { y: [125, 250], cushion: [1910, 2270, 337], back: [[2334, 624], [2402, 846]], w: 8 } },
    bulkhead: { dx: 6, at: 0, inset: [0.985, 5], col: 6, window: [880, 1040], hub: 930 } },
  // the engine's tub under the glass cover
  bay: { x: [2700, 3720], y: [440, 440], z: [370, 700, 850] },
  repeater: [1130, 1154, 702, 724],
  // the vent at the tail's corner
  flankPatches: [['tailVent', 'dark', 0.05, 4195, 4250, 440, 500]],
  archVent: { r: [384, 412], deg: [2, 66], n: 6 },
  // no centre mouth: the horseshoe on the bumper's middle, a barred intake each side (285-130), the corner ducts, the splitter
  splitter: { reach: 4, half: 852, z: [92, 84], until: 0.9 },
  intakes: { shield: { pts: [[-34, 150], [-50, 225], [-48, 262], [-32, 284], [0, 292], [32, 284], [48, 262], [50, 225], [34, 150]], grow: 1.14 }, patches: [[700, 772, 152, 280]],
    centre: { rows: 0, cols: [6, 9], depth: 75, bars: [], barX: 0, barZ: [0, 0] }, outer: { rows: [1, 5], cols: [6, 9], depth: 75, slats: [7, 8] } },
  bumperLamps: { from: 0, split: 0, to: 0 },
  plate: [4388, 4402, -235, 235, 580, 660],
  // the GT's two pairs of pipes through the diffuser
  exhaust: { x: [4112, 4274, 4122], r: [44, 36], y: [-320, -225, 225, 320], z: 372, seg: 8, cap: 2 },
  // the 3.5 litre V12 with its four turbochargers, lengthways ahead of the rear axle
  engine: { spec: ENGINES.eb110!, at: [3640, 0, 392], opts: { dir: '-x', box: { len: 800, wid: 760, hgt: 440 }, detail: 2 } },
  mirror: { at: [1714, 873, 914], head: [[1640, 890], [1640, 938], [1676, 960], [1750, 964], [1787, 960], [1787, 868], [1750, 864], [1676, 868]], loft: [[807, 0.6, 0], [828, 1, 0], [918, 1, 0], [939, 0.7, 0]], stalk: [[1700, 790, 775], [1712, 826, 880], 52, 26], glass: [[1789, 822, 878], [1789, 924, 950]] },
  wiper: { row: 1, arms: [[-400, 220]], lift: [12, 16], bar: [16, 10] },
  // the GT's pressed light-alloy disc with its ring of twelve holes
  wheel: { kind: 'disc', seg: 20, tyre: { shoulder: 28, tread: 0.79, bulge: 0.92, roll: 10 }, lip: [4, 10, 10, 34, 24], back: [0.7, 86, 12], dish: { f: 20, r: 20 }, face: [62, 150, 46], faceMid: 0.71, faceGloss: 0.5,
    spokes: 12, phase: 0, openings: { lift: 2.5, rim: 10, r: [104, 116, 12], a: [0.17, 0.36, 0.3] }, vents: { r: 172, size: 19, seg: 6, lift: 2.5 }, hub: { cap: [5, 24, 8], nuts: 0, nut: [58, 8, 9, 6] } },
};

// ---- swap tests: the kit's other kinds on this car ----
/** behind the fastback the deck drops to a low lid between the wings (the lines a frame or a ducktail tail needs: they stand over the deck) */
const LOW_DECK = (end: number): CarKit['lines'] => ({ ...EB110_KIT.lines, z: { ...EB110_KIT.lines.z, deck: [[4050, 912], [4130, 792], [4200, 748], [4260, 728], [4330, end]] } });
/** the NSX's tail: one frame round a smoked lamp band, the blade bridging the wings over an open slot, the bumper box under it */
export const EB110_FRAME_TAIL: Pick<CarKit, 'lines' | 'section' | 'deck' | 'tail' | 'tailLamps' | 'wing'> = {
  lines: LOW_DECK(716),
  section: { ...EB110_KIT.section, tail: { from: 3952, to: 'XT1', levels: [760, 753, 738, 716, 668, 620, 606, 560, 478, 450, 380, 350], pow: 1.5 } },
  deck: { kind: 'lid', from: 4130, edge: { y0: [640, 596], y1: [780, 650], blend: [4130, 4300] }, lidCols: 5, shut: 4260 },
  tail: { kind: 'frame', shares: [1, 0.985, 0.95, 0.88, 0.8, 0.72, 0.6, 0.45, 0.33, 0.24, 0], reach: [4352, 4360, 4350, 4348, 4354, 4362, 4392, 4400, 4400, 4396, 4384, 4372],
    pow: [7, 3.4], split: 5, frameRows: 5, opening: [3, 2, 1], lampIn: 22, valIn: 20, blade: { from: 4300, cols: 7, under: 742, lead: [7, 752] }, plateRows: [9, 10], plateDepth: 20 },
  tailLamps: { indicator: { y: 700, z: 668, rim: 44, lens: 38, lift: [4, 6], seg: 14 }, patches: [['tailLamp', 'red', 0.7, 'lens', 430, 640, 626, 710, 3], ['stopLamp', 'red', 0.7, 'lens', 200, 420, 626, 710, 3]], badge: { dark: [88, 626, 710, 3], bright: [34, 644, 692, 5] } },
  wing: undefined,
};
/** the F355's tail: the deck swept up into a lip across the tail, two round lamps a side sunk in the panel under it */
export const EB110_DUCKTAIL: Pick<CarKit, 'lines' | 'section' | 'deck' | 'tail' | 'tailLamps' | 'wing'> = {
  lines: LOW_DECK(760), section: EB110_FRAME_TAIL.section, deck: { ...EB110_FRAME_TAIL.deck, edge: { y0: [640, 700], y1: [780, 800], blend: [4130, 4330] } },
  tail: { ...EB110_FRAME_TAIL.tail, kind: 'ducktail', blade: undefined, band: [5, 10], plateRows: [8, 10] },
  tailLamps: { badge: { dark: [0, 0, 0, 0], bright: [17, 648, 700, 4] }, sunk: { blocks: [[3, 6], [6, 8]], y: [640, 420], z: 668, r: 40, depth: 26, seg: 12, rim: 6, names: ['tailLamp', 'stopLamp'], colours: ['red', 'red'] } },
  wing: undefined,
};
/** the NSX's flat cast five-spoke wheel and the F355's star wheel on this car's rims */
export const EB110_FIVE_SPOKE: Pick<CarKit, 'wheel'> = { wheel: { ...NSX_KIT.wheel, hub: F355_KIT.wheel.hub } };
export const EB110_STAR_WHEEL: Pick<CarKit, 'wheel'> = { wheel: F355_KIT.wheel };
/** pop-up head lamps: the same blocks of the bonnet as hinged covers (behind the front edge's first row) */
export const EB110_POPUP_LAMPS: Pick<CarKit, 'popup'> = { popup: { kind: 'popup', from: 396, to: 600, cols: [3, 6], open: 26, depth: 70, lens: [[0.08, 0.46], [0.54, 0.92]], lensV: [0.15, 0.8, 5] } };

// ---- the builder's other kinds on this car (docs/systems/101, K1): each assembles and closes, as the swaps above ----
/** a round nose: the bumper's lines on a fuller super-ellipse in plan (the corners rolled off), the bonnet's edge kept */
export const EB110_ROUND_NOSE: Pick<CarKit, 'nose'> = { nose: { ...EB110_KIT.nose, kind: 'round', pow: 1.8 } };
/** a pointed prow: the bumper's lines on a thin super-ellipse, each standing further forward on the centre line */
export const EB110_POINTED_NOSE: Pick<CarKit, 'nose'> = { nose: { ...EB110_KIT.nose, kind: 'round', pow: 1.4, reach: [125, 100, 66, 44, 34, 30, 40, 58] } };
/** a fog lamp sunk in a round recess at each corner of the bumper, where the brake ducts are */
export const EB110_SUNK_FRONT: Pick<CarKit, 'intakes'> = { intakes: { ...EB110_KIT.intakes, patches: [], fog: { rows: [6, 8], cols: [6, 8], y: 735, z: 230, r: 36, depth: 26, seg: 10 } } };
/** the frame tail with the lamp panel in the body's colour, two round lamps a side */
export const EB110_ROUND_TAIL: Pick<CarKit, 'lines' | 'section' | 'deck' | 'tail' | 'tailLamps' | 'wing'> = { ...EB110_FRAME_TAIL, tail: { ...EB110_FRAME_TAIL.tail, kind: 'roundLamps' },
  tailLamps: { ...EB110_FRAME_TAIL.tailLamps, patches: undefined, round: { y: [610, 440], z: 668, r: 40, rim: 7, lift: [4, 6], seg: 16, names: ['tailLamp', 'stopLamp'], colours: ['red', 'red'] } } };
/** the GT's wing standing raised always on the other tails (no bed: they have none for it) */
export const EB110_FIXED_WING: Pick<CarKit, 'wing'> = { wing: { ...EB110_KIT.wing!, kind: 'fixed', from: 4060, sit: 640, bed: undefined } };
