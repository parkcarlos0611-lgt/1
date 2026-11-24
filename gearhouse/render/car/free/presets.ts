// The four silhouettes harvested from the cars we built (docs/systems/106): the numbers are read off their kit sheets
// and hand-built meshes (render/car/cars/*.kit.ts, render/car/mesh_diablo.ts) as the curves of render/car/free/curves.ts,
// in mm along the car (mmTab turns them into stations). They are shapes, not the cars: a wedge, a cab-forward canopy, a
// coke-bottle with buttresses and a smooth long tail.
import { mmTab, sOf, type Chassis, type Silhouette } from './curves';

function sil(name: string, c: Chassis, t: { top: [number, number][]; crest: [number, number][]; floor: [number, number][]; half: [number, number][]; shoulder: [number, number][]; roof: [number, number][]; sail?: [number, number][]; round: [number, number][]; tuck: [number, number][] },
  m: { screen: number; roofF: number; roofB: number; glass: number; sideEnd: number; door: [number, number] }, roofBlack = false, wheel: Silhouette['wheel'] = 'nsx'): Silhouette {
  const T = (v: [number, number][]) => mmTab(c, v), S = (x: number) => sOf(c, x);
  return { name, chassis: c, roofBlack, wheel, curves: { top: T(t.top), crest: T(t.crest), floor: T(t.floor), half: T(t.half), shoulder: T(t.shoulder), roof: T(t.roof), sail: T(t.sail ?? [[0, 0], [4000, 0]]), round: T(t.round), tuck: T(t.tuck) },
    marks: { screen: S(m.screen), roofF: S(m.roofF), roofB: S(m.roofB), glass: S(m.glass), sideEnd: S(m.sideEnd), door: [S(m.door[0]), S(m.door[1])] } }; }

/** the wedge (after the Diablo): a very low sharp nose, flat panels and crisp creases (square sections), one long
 *  raked screen, a flat engine cover rising to a tall, wide, tapering tail */
export const WEDGE = sil('쐐기', { front: 1100, wheelbase: 2650, rear: 760, r: 335, tyreW: 300, rim: 250 }, {
  top: [[0, 380], [60, 470], [500, 560], [1000, 650], [1500, 760], [1900, 945], [2300, 1085], [2500, 1100], [2800, 1092], [3100, 1050], [3500, 1010], [4250, 1025], [4510, 1030]],
  crest: [[0, 440], [300, 545], [900, 665], [1500, 765], [2200, 790], [2800, 850], [3400, 935], [4250, 985], [4510, 990]],
  floor: [[0, 210], [400, 140], [1000, 125], [3800, 125], [4300, 190], [4510, 330]],
  half: [[0, 640], [150, 830], [500, 935], [1100, 980], [2100, 965], [2900, 1010], [3700, 1025], [4300, 985], [4510, 915]],
  shoulder: [[0, 0.5], [4510, 0.62]], roof: [[1500, 0.9], [2300, 0.6], [2900, 0.56], [3200, 0.7]], round: [[0, 9], [4510, 8]], tuck: [[0, 25], [4510, 30]],
}, { screen: 1500, roofF: 2300, roofB: 2850, glass: 3150, sideEnd: 2950, door: [1600, 2850] }, false, 'eb110');

/** the cab-forward canopy (after the NSX): the cabin far forward under a long glasshouse with a black roof band that runs
 *  down to a flat, long, square-cut tail */
export const CANOPY = sil('캡포워드', { front: 1040, wheelbase: 2530, rear: 835, r: 310, tyreW: 225, rim: 215 }, {
  top: [[0, 470], [120, 585], [400, 675], [900, 735], [1300, 790], [1600, 950], [1900, 1110], [2100, 1170], [2550, 1172], [2900, 1115], [3300, 1010], [3600, 960], [4150, 962], [4405, 958]],
  crest: [[0, 560], [200, 675], [700, 765], [1100, 790], [1300, 795], [2000, 815], [2600, 850], [3000, 875], [3600, 905], [4150, 935], [4405, 930]],
  floor: [[0, 260], [300, 180], [1000, 140], [3600, 140], [4200, 220], [4405, 320]],
  half: [[0, 640], [150, 790], [500, 870], [1000, 895], [2000, 885], [2900, 905], [3600, 905], [4150, 885], [4405, 845]],
  shoulder: [[0, 0.6], [4405, 0.62]], roof: [[1300, 0.95], [2100, 0.6], [2900, 0.58], [3500, 0.76]], round: [[0, 4.2], [4405, 5]], tuck: [[0, 55], [4405, 60]],
}, { screen: 1300, roofF: 2050, roofB: 2650, glass: 3560, sideEnd: 3050, door: [1400, 2650] }, true, 'nsx');

/** the coke-bottle (after the F355): a pinched waist between the wheels, rear haunches swelling over the rear wheels,
 *  the roof run back as sails (buttresses) beside a sunk upright rear window, a ducktail */
export const COKE = sil('코크보틀', { front: 1000, wheelbase: 2450, rear: 800, r: 320, tyreW: 255, rim: 235 }, {
  top: [[0, 470], [100, 570], [500, 670], [1000, 738], [1440, 795], [1700, 950], [1950, 1115], [2150, 1168], [2500, 1168], [2700, 1115], [2850, 1000], [3000, 945], [3500, 935], [3950, 958], [4150, 1000], [4250, 975]],
  crest: [[0, 555], [200, 690], [800, 800], [1300, 790], [1440, 790], [2000, 795], [2500, 815], [3000, 880], [3350, 905], [3700, 900], [4000, 905], [4250, 890]],
  floor: [[0, 250], [300, 170], [1000, 140], [3500, 140], [4100, 230], [4250, 330]],
  half: [[0, 650], [150, 800], [500, 895], [1000, 935], [1600, 925], [2250, 868], [2700, 900], [3050, 985], [3450, 990], [3900, 935], [4250, 860]],
  shoulder: [[0, 0.58], [2200, 0.6], [3200, 0.72], [4250, 0.66]], roof: [[1440, 0.95], [2150, 0.58], [2650, 0.6], [3000, 0.9], [3500, 0.92]],
  sail: [[0, 0], [2400, 0], [2500, 1165], [2750, 1120], [3100, 1040], [3450, 975], [3700, 950], [4000, 820]],
  round: [[0, 3.2], [4250, 3.2]], tuck: [[0, 70], [2300, 45], [3300, 95], [4250, 80]],
}, { screen: 1440, roofF: 2100, roofB: 2650, glass: 2960, sideEnd: 2650, door: [1480, 2550] }, false, 'f355');

/** the smooth long tail (after the EB110): soft round sections, a long raked screen, the glass running far back, a long
 *  falling tail ending in a rounded capsule */
export const LONGTAIL = sil('롱테일', { front: 1000, wheelbase: 2550, rear: 800, r: 326, tyreW: 270, rim: 240 }, {
  top: [[0, 480], [150, 590], [500, 685], [1000, 755], [1350, 795], [1700, 975], [2150, 1112], [2600, 1108], [2900, 1060], [3300, 985], [3650, 940], [4050, 890], [4350, 820]],
  crest: [[0, 545], [250, 690], [800, 795], [1350, 815], [2000, 800], [2600, 840], [3200, 878], [3700, 872], [4050, 845], [4350, 780]],
  floor: [[0, 250], [350, 160], [1000, 130], [3600, 130], [4200, 210], [4350, 310]],
  half: [[0, 580], [200, 780], [600, 885], [1100, 905], [2000, 925], [2900, 968], [3500, 962], [4000, 920], [4350, 790]],
  shoulder: [[0, 0.62], [4350, 0.62]], roof: [[1350, 0.95], [2150, 0.58], [2650, 0.6], [3300, 0.8]], round: [[0, 2.3], [4350, 2.2]], tuck: [[0, 95], [4350, 100]],
}, { screen: 1350, roofF: 2150, roofB: 2650, glass: 3350, sideEnd: 2900, door: [1450, 2600] }, false, 'eb110');

export const PRESETS: Silhouette[] = [WEDGE, CANOPY, COKE, LONGTAIL];
