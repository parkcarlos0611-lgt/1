// Detail-scale streamline replicas (debadged): 1934 airflow-type sedan, 1937 prow-grille fastback coupe.
// Measured from user-supplied 4-views (docs/REFERENCE_ANALYSIS_3.md). x mm from front bumper tip, z mm up.
import { fillet, arc } from './geom.mjs';

// ---- 1934 airflow-type sedan: WB 3251, 6.50-16, integrated front fenders, rear skirts, triple-bar bumpers ----
const A = (x, y) => [(x - 5) * 13.6, (143 - y) * 13.6];           // blueprint px -> mm
const pt = (x, y, r = 0) => [...A(x, y), r];
const FA = 721, RA = FA + 3251;
export const airflow34 = {
  id: 'sil_E1_sedan4d_airflow_D', len: 4950, height: 1560, paint: 'paint.airflow', grad: [3.1, 1.4], glassStyle: 'period', smooth: 0, glassSmooth: 0,
  body: fillet([pt(30, 125), pt(20, 112, 60), pt(17, 95, 160), pt(25, 74, 260), pt(48, 62, 200), pt(120, 55), pt(141, 33, 140), pt(165, 31, 320),
    pt(268, 33, 420), pt(302, 52, 300), pt(338, 92, 160), pt(350, 108, 80), pt(346, 125)]),
  arches: [{ x: FA, z: 365, r: 420 }, { x: RA, z: 365, r: 420 }],
  wheels: [{ x: FA }, { x: RA }], tire: '6.50-16', wheel: { style: 'steel', paint: 'paint.airflow', whitewall: 0.32 },
  fenders: [{ paint: 'paint.airflow', wx: RA, wz: 365, wr: 1, smooth: 2, pts: [[RA - 560, 330, 0], [RA - 520, 700, 0], [RA - 250, 880, 0], [RA + 250, 880, 0], [RA + 560, 700, 0], [RA + 640, 420, 0], [RA + 600, 330, 0]] }],
  glass: [fillet([[...A(131, 61), 40], [...A(148, 41), 70], [...A(195, 41), 60], [...A(195, 61), 40]]), fillet([[...A(203, 61), 40], [...A(203, 41), 60], [...A(240, 41), 120], [...A(250, 61), 40]])],
  frame: 'chrome',
  interior: [{ pts: [A(140, 52), A(150, 47), A(151, 48), A(141, 53)] }, { e: [A(220, 50)[0], A(220, 50)[1], 90, 110] }],
  doors: [[A(122, 58), A(124, 124)], [A(199, 58), A(199, 124)], [A(252, 58), A(256, 90), A(248, 112)]],
  trim: [{ pts: [A(120, 63), A(300, 63), A(325, 80)], w: 1, lv: 4 }, { pts: [A(122, 66), A(298, 66), A(322, 84)], w: 1, lv: 3 },
    ...[0, 1, 2, 3, 4].map(k => ({ pts: [A(84 + k * 2, 71 + k * 4), A(120, 71 + k * 4)], w: 1, lv: 4 })),
    { pts: [A(312, 58), A(345, 100)], w: 2, lv: 4, lv2: 2 },                                   // trunk spear
    { pts: [[RA - 300, 420], [RA + 480, 420]], w: 1, lv: 4 }],                               // skirt moulding
  under: [{ pts: [[1300, 200], [3300, 200], [3300, 250], [1300, 250]], ramp: 'black', lv: 1 }],
  parts: [{ pts: [A(17, 92), A(23, 76), A(26, 77), A(21, 93)], chrome: 1 }],                  // grille wrap edge
  lamps: [{ e: [A(24, 82)[0], A(24, 82)[1], 30, 55], ramp: 'lensW', bezel: 'chrome' }, { e: [A(347, 104)[0], A(347, 104)[1], 25, 30], ramp: 'lensR', bezel: 'chrome' }],
  bumperSets: [{ x0: 60, x1: 240, zs: [380, 450, 520], h: 30, clamp: 120, iron: [[200, 450], [420, 420]] }, { x0: 4600, x1: 4800, zs: [380, 450, 520], h: 30, clamp: 4740, iron: [[4450, 420], [4640, 450]] }],
  handles: [[A(190, 64)[0], A(190, 64)[1]], [A(208, 64)[0], A(208, 64)[1]]],
};

// ---- 1937 prow-grille fastback coupe: WB 3099, 7.00-16 wide whitewalls ----
const Z = (x, y) => [(x - 20) * 9.48, (240 - y) * 9.48];
const q = (x, y, r = 0) => [...Z(x, y), r];
const FZ = 711, RZ = FZ + 3099;
export const zephyr37 = {
  id: 'sil_E1_coupe3w_prow_D', len: 4950, height: 1720, paint: 'paint.zephyr', grad: [3.2, 1.2], glassStyle: 'period', smooth: 0, glassSmooth: 0,
  body: fillet([q(42, 207), q(40, 200, 40), q(37, 172, 120), q(47, 126, 200), q(70, 112, 160), q(190, 112), q(214, 73, 120), q(250, 62, 320), q(300, 66, 320),
    q(340, 90, 320), q(380, 120, 320), q(440, 155, 300), q(494, 176, 200), q(506, 200, 100), q(495, 207)]),
  arches: [{ x: FZ, z: 378, r: 430 }, { x: RZ, z: 378, r: 430 }],
  wheels: [{ x: FZ }, { x: RZ }], tire: '7.00-16', wheel: { style: 'hubcap', whitewall: 0.46 },
  fenders: [
    { paint: 'paint.zephyr', wx: FZ, wz: 378, wr: 430, smooth: 2, pts: [q(35, 202), q(38, 175), q(60, 140), q(110, 124), q(160, 134), q(210, 165), q(268, 199), q(272, 207), q(150, 207), ...arc(FZ, 378, 432, 432, 12, 168, 12), q(36, 207)] },
    { paint: 'paint.zephyr', wx: RZ, wz: 378, wr: 430, smooth: 2, pts: [q(352, 207), q(362, 168), q(398, 143), q(440, 139), q(480, 154), q(504, 188), q(505, 207), q(465, 207), ...arc(RZ, 378, 432, 432, 12, 168, 12)] }],
  boards: [{ paint: 'rubber', pts: [[1400, 270], [3200, 270], [3200, 320], [1400, 320]] }],
  glass: [fillet([[...Z(206, 117), 40], [...Z(216, 80), 90], [...Z(250, 72), 160], [...Z(277, 84), 200], [...Z(280, 117), 60]])],
  frame: 'chrome',
  interior: [{ pts: [Z(212, 100), Z(226, 92), Z(227, 94), Z(213, 102)] }],
  doors: [[Z(196, 116), Z(198, 205)], [Z(290, 116), Z(300, 160), Z(300, 205)]],
  trim: [{ pts: [Z(70, 116), Z(195, 116), Z(300, 118), Z(420, 140)], w: 1, lv: 4 },
    ...[0, 1, 2, 3, 4, 5, 6].map(k => ({ pts: [Z(39 + k * 0.4, 132 + k * 9), Z(56, 132 + k * 9)], w: 1, lv: 4 })),     // prow grille bars (side)
    { pts: [[1400, 330], [3200, 330]], w: 1, lv: 4, free: 1 },                                                               // board moulding
    ...[0, 1, 2].map(k => ({ pts: [Z(120 + k * 6, 140), Z(135 + k * 6, 140)], w: 1, lv: 4 }))],                             // cowl vent spears
  parts: [{ pts: [Z(52, 124), Z(70, 118), Z(72, 121), Z(54, 127)], chrome: 1 }],                                             // hood ornament
  lamps: [{ e: [Z(46, 158)[0], Z(46, 158)[1], 35, 60], ramp: 'lensW', bezel: 'chrome' }, { e: [Z(498, 180)[0], Z(498, 180)[1], 25, 40], ramp: 'lensR', bezel: 'chrome' }],
  bumperSets: [{ x0: 20, x1: 250, zs: [430], h: 70, clamp: 170, iron: [[200, 420], [420, 400]] }, { x0: 4380, x1: 4620, zs: [440], h: 70, clamp: 4450, iron: [[4250, 420], [4450, 430]] }],
  handles: [[Z(280, 125)[0], Z(280, 125)[1]]],
};

// ---- front / rear views (half outlines, y mm from centreline) ----
const circ = (cy, cz, rr, n = 20) => Array.from({ length: n }, (_, k) => [cy + Math.cos(k / n * Math.PI * 2) * rr, cz + Math.sin(k / n * Math.PI * 2) * rr]);
const tri = (zs) => zs.map(z => ({ half: 1, pts: [[0, z - 15], [820, z - 15], [845, z], [820, z + 15], [0, z + 15]], smooth: 0 }));
export const airflow34Front = {
  width: 1760, height: 1520, paint: 'paint.airflow', lowZ: 500, frame: 'chrome', glassStyle: 'period', tire: '6.50-16', track: 1420, hub: 40,
  hood: { half: 360, top: 1110, bottom: 430, round: 1, pts: [[0, 420, 0], [330, 420, 60], [365, 760, 160], [300, 1020, 160], [170, 1110, 80], [0, 1115, 0]] }, cowlZ: 1135, wiper: [-400, 1370, -150, 1300], wheelIn: [240, 1240, 180],
  body: fillet([[0, 300, 0], [700, 300, 0], [830, 420, 80], [830, 900, 220], [760, 1050, 160], [620, 1110, 0], [600, 1380, 150], [520, 1495, 90], [0, 1497, 0]]),
  glass: [fillet([[22, 1135, 0], [470, 1135, 30], [460, 1385, 60], [22, 1395, 0]])],
  under: [{ half: 1, pts: [[0, 270], [640, 290], [640, 420], [0, 420]], ramp: 'black', base: 1 }],
  grilles: [{ half: 1, pattern: 'vbar', bars: 'chrome', surround: 'chrome', pts: fillet([[0, 435, 0], [220, 435, 40], [220, 960, 120], [120, 1115, 100], [0, 1120, 0]]) }],
  bumpers: tri([460, 505, 550]),
  lamps: [{ y: 380, z: 750, r: 95, ramp: 'lensW', bezel: 'chrome' }, { y: 380, z: 590, r: 42, ramp: 'lensW', bezel: 'chrome' }],
  parts: [{ pts: [[-12, 1135], [12, 1135], [12, 1395], [-12, 1395]], ramp: 'paint.airflow', base: 2 }],
};
export const airflow34Rear = {
  width: 1760, height: 1520, paint: 'paint.airflow', lowZ: 500, frame: 'chrome', glassStyle: 'period', tire: '6.50-16', track: 1420, hub: 40,
  body: fillet([[0, 300, 0], [700, 300, 0], [830, 420, 80], [830, 850, 220], [700, 1050, 160], [600, 1120, 0], [600, 1380, 150], [520, 1495, 90], [0, 1497, 0]]),
  glass: [fillet([[30, 1190, 0], [300, 1190, 50], [300, 1340, 60], [30, 1340, 0]])],
  under: [{ half: 1, pts: [[0, 270], [640, 290], [640, 420], [0, 420]], ramp: 'black', base: 1 }],
  bumpers: tri([460, 505, 550]),
  lamps: [{ y: 470, z: 640, r: 40, ramp: 'lensR', bezel: 'chrome' }],
  parts: [{ pts: circ(0, 860, 360), chrome: 1 }, { pts: circ(0, 860, 325), ramp: 'paint.airflow', base: 3 }, { pts: circ(0, 860, 90), chrome: 1 },
    { pts: [[-560, 610], [-330, 610], [-330, 720], [-560, 720]], ramp: 'white', base: 2 }],
};
const blade = { half: 1, pts: [[0, 410], [880, 420], [905, 455], [880, 520], [0, 515]], smooth: 0 };
const overriders = [-1, 1].map(s => ({ pts: fillet([[s * 420, 370, 0], [s * 460, 370, 0], [s * 460, 600, 20], [s * 420, 600, 20]]), chrome: 1 }));
export const zephyr37Front = {
  width: 1880, height: 1730, paint: 'paint.zephyr', lowZ: 520, frame: 'chrome', glassStyle: 'period', tire: '7.00-16', track: 1450, hub: 40,
  hood: { half: 420, top: 1215, bottom: 400, round: 1, pts: [[0, 390, 0], [400, 400, 80], [420, 760, 200], [300, 1080, 200], [110, 1210, 60], [0, 1215, 0]] }, cowlZ: 1300, wiper: [-450, 1590, -180, 1500], wheelIn: [260, 1420, 190],
  body: fillet([[0, 330, 0], [760, 330, 0], [880, 450, 80], [880, 900, 220], [800, 1150, 150], [660, 1180, 0], [640, 1300, 0], [600, 1640, 160], [480, 1720, 80], [0, 1722, 0]]),
  glass: [fillet([[20, 1310, 0], [600, 1310, 30], [565, 1600, 70], [20, 1612, 0]])],
  under: [{ half: 1, pts: [[0, 300], [700, 320], [700, 450], [0, 450]], ramp: 'black', base: 1 }],
  grilles: [{ half: 1, pattern: 'hbar', bars: 'chrome', surround: 'chrome', pts: fillet([[0, 380, 0], [230, 420, 60], [200, 800, 140], [60, 1150, 60], [0, 1195, 0]]) }],
  bumpers: [blade],
  lamps: [{ y: 610, z: 820, r: 105, ramp: 'lensW', bezel: 'chrome' }],
  parts: [...overriders, { pts: [[-10, 1310], [10, 1310], [10, 1612], [-10, 1612]], ramp: 'paint.zephyr', base: 2 }, { pts: [[-14, 1195], [14, 1195], [8, 1290], [-8, 1290]], chrome: 1 }],
};
export const zephyr37Rear = {
  width: 1880, height: 1730, paint: 'paint.zephyr', lowZ: 520, frame: 'chrome', glassStyle: 'period', tire: '7.00-16', track: 1450, hub: 40,
  body: fillet([[0, 330, 0], [760, 330, 0], [880, 450, 80], [880, 880, 220], [780, 1100, 150], [620, 1180, 0], [600, 1500, 200], [420, 1640, 120], [0, 1650, 0]]),
  glass: [fillet([[0, 1360, 0], [260, 1360, 40], [220, 1520, 80], [0, 1530, 0]])],
  under: [{ half: 1, pts: [[0, 300], [700, 320], [700, 450], [0, 450]], ramp: 'black', base: 1 }],
  bumpers: [blade],
  lamps: [{ y: 0, z: 0, pts: [[730, 820], [800, 820], [800, 1010], [730, 1010]], ramp: 'lensR', bezel: 'chrome' }],
  parts: [...overriders, { pts: [[-150, 560], [150, 560], [150, 680], [-150, 680]], ramp: 'white', base: 2 }, { pts: [[-60, 980], [60, 980], [60, 1010], [-60, 1010]], chrome: 1 }],
};
