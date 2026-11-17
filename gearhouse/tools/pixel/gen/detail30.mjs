// Detail-scale (12.5 mm/px) 1930 coupe & town sedan rebuilt from the measured references (Model-A-type, debadged).
// Measurements: docs/REFERENCE_ANALYSIS_2.md (horizontal by wheelbase, vertical by overall height).
import { fillet, arc, rrect } from './geom.mjs';
const F = 610, R = F + 2629, r = 360;

const front = {   // shared front clip, bumper, under-chassis
  arches: [{ x: F, z: r, r: 425 }, { x: R, z: r, r: 425 }],
  wheels: [{ x: F }, { x: R }], tire: '4.75-19', wheel: { style: 'wire', spokes: 30 },
  fenders: [
    { paint: 'black', wx: F, wz: r, wr: 420, smooth: 1, pts: [...arc(F, r, 540, 505, 148, 32, 14), [1760, 412, 0], [1760, 330, 0], [1080, 470, 0], ...arc(F, r, 428, 428, 28, 152, 12), [170, 640, 0]] },
    { paint: 'black', wx: R, wz: r, wr: 420, smooth: 1, pts: [...arc(R, r, 540, 505, 168, 24, 14), [3830, 340, 0], [3790, 290, 0], ...arc(R, r, 430, 430, 12, 166, 12), [2700, 380, 0]] }],
  boards: [{ paint: 'rubber', pts: [[1720, 325], [2790, 325], [2790, 406], [1720, 406]] }],
  aprons: [[[1060, 650], [1745, 650], [1745, 420]], [[1745, 406], [2780, 406], [2780, 552], [1745, 552]]],
  under: [
    { band: [[220, 470], [560, 520], [1000, 520]], th: 90, ramp: 'black', lv: 1 },            // frame horn + rail
    { pts: [[300, 530], [570, 530], [570, 650], [330, 650]], ramp: 'black', lv: 0 },            // radiator splash apron
    { band: [[F - 60, 560], [F + 60, 560]], th: 70, ramp: 'iron', lv: 2 },                      // transverse spring (end-on)
    { band: [[F, r], [F, 540]], th: 45, ramp: 'iron', lv: 1 },                                   // spring shackle / perch
    { band: [[F - 220, 480], [F - 20, 400]], th: 34, ramp: 'iron', lv: 2 },                     // lever shock + link
    { pts: [[F - 300, 455], [F - 200, 455], [F - 200, 520], [F - 300, 520]], ramp: 'iron', lv: 2 },
    { band: [[F + 80, 330], [1700, 450]], th: 30, ramp: 'iron', lv: 1 },                         // radius rod
    { band: [[2950, 520], [3500, 650], [3950, 600]], th: 90, ramp: 'black', lv: 1 },            // rear frame kick-up + horn
    { band: [[R - 60, 640], [R + 60, 640]], th: 70, ramp: 'iron', lv: 2 },                      // rear spring end-on
    { band: [[2900, 300], [3000, 330], [3990, 330]], th: 40, ramp: 'iron', lv: 1 },             // exhaust + tail pipe
    { pts: [[2500, 280], [2950, 280], [2950, 360], [2500, 360]], ramp: 'iron', lv: 1 },          // muffler
  ],
  bumperSets: [
    { x0: 60, x1: 230, zs: [455, 545], h: 44, clamp: 95, iron: [[200, 500], [300, 495], [360, 480]] },
    { x0: 3930, x1: 4040, zs: [440], h: 42, iron: [[3860, 560], [3930, 470], [3960, 440]] }],
};
const frontParts = paint => [
  { pts: fillet([[450, 640, 0], [450, 1170, 40], [480, 1236, 30], [575, 1242, 0], [575, 640, 0]]), chrome: 1 },   // radiator shell
  { pts: [[490, 1242], [545, 1242], [540, 1290], [495, 1290]], chrome: 1 },                                         // cap
  { pts: [[500, 1290], [560, 1305], [545, 1325], [505, 1315]], chrome: 1 },                                         // mascot wing (generic)
  { pts: [[310, 835], [600, 835], [600, 865], [310, 865]], ramp: 'black', base: 1 },                                 // lamp bar
  { pts: [[375, 865], [400, 865], [400, 915], [375, 915]], ramp: 'black', base: 1 },                                 // lamp stem
  { e: [405, 1020, 108, 112], chrome: 1 },                                                                            // lamp bucket
  { pts: [[1650, 1150], [1712, 1150], [1712, 1200], [1650, 1200]], chrome: 1 },                                       // cowl lamp
];
const louvres = [{ x0: 850, x1: 1420, step: 28, z0: 760, z1: 1100 }];

export const coupeD = {
  id: 'sil_E1_coupe2d_rumble_D', len: 4100, height: 1760, paint: 'paint.copra', grad: [3.1, 1.5], glassStyle: 'period', smooth: 0, glassSmooth: 0, ...front,
  body: fillet([[575, 650, 0], [575, 1230, 20], [1710, 1245, 0], [1722, 1640, 0], [1625, 1652, 0], [1655, 1705, 40], [1800, 1745, 70],
    [2830, 1745, 220], [2980, 1600, 120], [2990, 1258, 0], [3400, 1160, 330], [3720, 920, 260], [3840, 600, 90], [3780, 552, 0], [1745, 552, 0], [1710, 650, 0]]),
  tone: [{ paint: 'black', pts: [[1600, 1185], [1600, 1900], [3020, 1900], [3020, 1185]], smooth: 0 }],
  glass: [rrect(1765, 1205, 2395, 1560, 38), fillet([[2475, 1215, 30], [2475, 1555, 50], [2740, 1555, 70], [2770, 1300, 0], [2700, 1215, 90]])],
  frame: 'reveal',
  interior: [{ pts: [[1790, 1330], [1990, 1440], [2002, 1418], [1802, 1308]] }, { pts: [[2150, 1205], [2150, 1380], [2390, 1395], [2390, 1205]] }, { e: [2600, 1340, 70, 90] }],
  doors: [[[1745, 1240], [1745, 560]], [[2420, 1240], [2420, 560]], [[3010, 1245], [3400, 1150], [3660, 960]]],
  louvres,
  trim: [{ pts: [[575, 1165], [2990, 1165]], w: 2, ramp: 'black', lv: 3, lv2: 0 },                           // belt reveal moulding
         { pts: [[1660, 1700], [2840, 1712]], w: 1, ramp: 'black', lv: 0, free: 1 },                         // drip rail
         { pts: [[2470, 1250], [2470, 1240]], w: 1, ramp: 'chrome', lv: 4 }],
  parts: [...frontParts(),
    { pts: fillet([[3860, 480, 60], [3860, 1210, 60], [3990, 1210, 60], [3990, 480, 60]]), ramp: 'rubber', base: 1 },   // spare (edge-on)
    { pts: [[3990, 800], [4040, 800], [4040, 890], [3990, 890]], chrome: 1 },
    { pts: [[3800, 560], [3880, 600], [3880, 640], [3800, 600]], ramp: 'black', base: 1 },                                 // spare carrier
    { pts: [[3880, 760], [3905, 760], [3905, 900], [3880, 900]], ramp: 'black', base: 1 },                                 // lamp/plate bracket
    { pts: [[3905, 700], [3925, 700], [3925, 830], [3905, 830]], ramp: 'white', base: 2 },                                 // plate edge
    { pts: [[3260, 1120], [3320, 1120], [3320, 1145], [3260, 1145]], chrome: 1 }],                                         // rumble handle
  lamps: [{ e: [298, 1020, 18, 92], ramp: 'lensW' }, { e: [3920, 900, 40, 40], ramp: 'lensR', bezel: 'chrome' }],
  handles: [[2370, 1130]],
};

export const sedanD = {
  ...coupeD, id: 'sil_E1_sedan4d_town_D', len: 4200, paint: 'paint.niagara',
  body: fillet([[575, 650, 0], [575, 1230, 20], [1710, 1245, 0], [1722, 1640, 0], [1625, 1652, 0], [1655, 1705, 40], [1800, 1745, 70],
    [3470, 1745, 200], [3800, 1600, 210], [3840, 1300, 0], [3840, 640, 90], [3780, 552, 0], [1745, 552, 0], [1710, 650, 0]]),
  tone: [{ paint: 'black', pts: [[1600, 1690], [1600, 1900], [3950, 1900], [3950, 1690]], smooth: 0 }],
  glass: [rrect(1765, 1205, 2370, 1560, 38), rrect(2520, 1205, 3110, 1560, 38), fillet([[3195, 1205, 30], [3195, 1560, 40], [3470, 1560, 150], [3550, 1400, 60], [3550, 1205, 30]])],
  interior: [{ pts: [[1790, 1330], [1990, 1440], [2002, 1418], [1802, 1308]] }, { pts: [[2140, 1205], [2140, 1380], [2360, 1395], [2360, 1205]] }, { pts: [[2860, 1205], [2860, 1390], [3110, 1400], [3110, 1205]] }],
  doors: [[[1745, 1240], [1745, 560]], [[2440, 1240], [2440, 560]], [[2495, 1240], [2495, 560]], [[3150, 1240], [3150, 830]]],
  trim: [{ pts: [[575, 1165], [3840, 1165]], w: 2, ramp: 'paint.niagara', lv: 4, lv2: 0 }, { pts: [[1660, 1700], [3480, 1712]], w: 1, ramp: 'black', lv: 0, free: 1 }],
  parts: coupeD.parts.filter((p, i) => i !== coupeD.parts.length - 1),
  handles: [[2380, 1130], [3085, 1130]],
};
