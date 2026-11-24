// The four silhouettes harvested from the cars we built (docs/systems/106): the numbers are read off their kit sheets
// and hand-built meshes (render/car/cars/*.kit.ts, render/car/mesh_diablo.ts) as the curves of render/car/free/curves.ts,
// in mm along the car (mmTab turns them into stations). They are shapes, not the cars: a wedge, a cab-forward canopy, a
// coke-bottle with buttresses and a smooth long tail.
import { mmTab, sOf, type Chassis, type Silhouette } from './curves';

function sil(name: string, c: Chassis, t: { top: [number, number][]; crest: [number, number][]; floor: [number, number][]; half: [number, number][]; shoulder: [number, number][]; roof: [number, number][]; sail?: [number, number][]; round: [number, number][]; tuck: [number, number][] },
  m: { screen: number; roofF: number; roofB: number; glass: number; sideEnd: number; door: [number, number] }, roofBlack = false): Silhouette {
  const T = (v: [number, number][]) => mmTab(c, v), S = (x: number) => sOf(c, x);
  return { name, chassis: c, roofBlack, curves: { top: T(t.top), crest: T(t.crest), floor: T(t.floor), half: T(t.half), shoulder: T(t.shoulder), roof: T(t.roof), sail: T(t.sail ?? [[0, 0], [4000, 0]]), round: T(t.round), tuck: T(t.tuck) },
    marks: { screen: S(m.screen), roofF: S(m.roofF), roofB: S(m.roofB), glass: S(m.glass), sideEnd: S(m.sideEnd), door: [S(m.door[0]), S(m.door[1])] } }; }

/** the wedge (after the Diablo): a low sharp nose, one long raked screen, a flat engine cover, boxy sections */
export const WEDGE = sil('쐐기', { front: 1100, wheelbase: 2650, rear: 710, r: 330, tyreW: 300, rim: 235 }, {
  top: [[0, 430], [80, 515], [500, 600], [1000, 690], [1500, 785], [1900, 955], [2300, 1090], [2500, 1105], [2800, 1095], [3100, 1035], [3500, 985], [4200, 975], [4460, 955]],
  crest: [[0, 500], [300, 590], [900, 700], [1500, 785], [2200, 800], [2800, 845], [3400, 905], [4200, 945], [4460, 925]],
  floor: [[0, 230], [400, 150], [1000, 130], [3800, 130], [4300, 200], [4460, 290]],
  half: [[0, 690], [120, 850], [500, 945], [1100, 985], [2100, 975], [2900, 1010], [3700, 1020], [4300, 980], [4460, 925]],
  shoulder: [[0, 0.55], [4460, 0.5]], roof: [[1500, 0.9], [2300, 0.64], [2900, 0.6], [3200, 0.72]], round: [[0, 6], [4460, 6]], tuck: [[0, 35], [4460, 40]],
}, { screen: 1500, roofF: 2300, roofB: 2850, glass: 3150, sideEnd: 2950, door: [1600, 2850] });

/** the cab-forward canopy (after the NSX): the cabin far forward under a long glasshouse that runs down to the deck */
export const CANOPY = sil('캡포워드', { front: 1040, wheelbase: 2530, rear: 835, r: 305, tyreW: 225, rim: 205 }, {
  top: [[0, 470], [120, 585], [400, 675], [900, 740], [1420, 810], [1700, 960], [2000, 1110], [2200, 1165], [2600, 1170], [2900, 1120], [3300, 1010], [3600, 962], [4100, 965], [4330, 975], [4405, 958]],
  crest: [[0, 560], [200, 675], [700, 770], [1100, 798], [1420, 810], [2000, 828], [2600, 858], [3000, 880], [3600, 900], [4100, 932], [4405, 925]],
  floor: [[0, 260], [300, 180], [1000, 140], [3600, 140], [4200, 220], [4405, 320]],
  half: [[0, 640], [150, 790], [500, 870], [1000, 895], [2000, 890], [2900, 905], [3600, 905], [4100, 870], [4405, 800]],
  shoulder: [[0, 0.6], [4405, 0.6]], roof: [[1420, 0.95], [2200, 0.63], [2900, 0.6], [3500, 0.76]], round: [[0, 3.5], [4405, 3.5]], tuck: [[0, 55], [4405, 60]],
}, { screen: 1420, roofF: 2150, roofB: 2700, glass: 3560, sideEnd: 3000, door: [1500, 2650] }, true);

/** the coke-bottle (after the F355): a waist between the wheels, the rear wings swelling, the roof run back as sails
 *  (buttresses) beside a sunk upright rear window, a ducktail */
export const COKE = sil('코크보틀', { front: 1000, wheelbase: 2450, rear: 800, r: 320, tyreW: 245, rim: 235 }, {
  top: [[0, 480], [100, 575], [500, 675], [1000, 742], [1440, 798], [1700, 950], [1950, 1115], [2150, 1168], [2500, 1168], [2700, 1115], [2850, 1000], [3000, 942], [3500, 935], [3950, 952], [4150, 990], [4250, 962]],
  crest: [[0, 560], [200, 690], [800, 788], [1440, 798], [2000, 805], [2650, 832], [3100, 872], [3600, 882], [4000, 895], [4250, 880]],
  floor: [[0, 250], [300, 170], [1000, 140], [3500, 140], [4100, 230], [4250, 330]],
  half: [[0, 650], [150, 800], [500, 890], [1000, 925], [1700, 925], [2300, 895], [3000, 958], [3450, 958], [3900, 920], [4250, 860]],
  shoulder: [[0, 0.58], [4250, 0.58]], roof: [[1440, 0.95], [2150, 0.6], [2650, 0.62], [3000, 0.9], [3500, 0.92]],
  sail: [[0, 0], [2400, 0], [2500, 1165], [2750, 1120], [3100, 1040], [3450, 975], [3700, 950], [4000, 820]],
  round: [[0, 3], [4250, 3]], tuck: [[0, 70], [4250, 70]],
}, { screen: 1440, roofF: 2100, roofB: 2650, glass: 2960, sideEnd: 2650, door: [1480, 2550] });

/** the smooth long tail (after the EB110): a long raked screen, the glass running far back, a long falling tail, soft sections */
export const LONGTAIL = sil('롱테일', { front: 1000, wheelbase: 2550, rear: 850, r: 326, tyreW: 270, rim: 240 }, {
  top: [[0, 500], [150, 600], [500, 690], [1000, 760], [1350, 800], [1700, 975], [2150, 1112], [2600, 1108], [2900, 1060], [3300, 985], [3650, 945], [4100, 905], [4400, 848]],
  crest: [[0, 560], [250, 700], [800, 800], [1350, 818], [2000, 800], [2600, 840], [3200, 880], [3700, 880], [4100, 858], [4400, 800]],
  floor: [[0, 250], [350, 160], [1000, 130], [3600, 130], [4200, 200], [4400, 300]],
  half: [[0, 600], [200, 790], [600, 890], [1100, 905], [2000, 925], [2900, 970], [3600, 965], [4100, 930], [4400, 820]],
  shoulder: [[0, 0.62], [4400, 0.62]], roof: [[1350, 0.95], [2150, 0.6], [2650, 0.62], [3300, 0.8]], round: [[0, 2.6], [4400, 2.6]], tuck: [[0, 80], [4400, 80]],
}, { screen: 1350, roofF: 2150, roofB: 2650, glass: 3350, sideEnd: 2900, door: [1450, 2600] });

export const PRESETS: Silhouette[] = [WEDGE, CANOPY, COKE, LONGTAIL];
