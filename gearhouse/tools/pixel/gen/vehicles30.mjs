// E1 replica vehicles: blueprint-measured bodies + period chassis / engine / drivetrain data.
// Trademarks (names, badges, mascots, script lettering) are intentionally omitted.
import { fillet, arc, rrect } from './geom.mjs';
import { sedan30front, sedan30rear } from './specs30.mjs';

// ===== shared 1930 small-car platform (WB 2629, 4.75-19, transverse leaf, torque tube) =====
const F = 610, R = F + 2629, r = 360;
const frontClip = {   // radiator, hood, front fenders, lamps: shared by sedan & coupe like the real cars
  fenders: [
    { paint: 'black', wx: F, wz: r, wr: 425, smooth: 1, pts: [...arc(F, r, 545, 545, 140, 30, 12), [1750, 420, 0], [1750, 352, 0], [1060, 500, 0], ...arc(F, r, 430, 430, 24, 150, 12), [205, 670, 0]] },
    { paint: 'black', wx: R, wz: r, wr: 425, smooth: 1, pts: [...arc(R, r, 545, 515, 168, 24, 12), [3850, 330, 0], [3800, 290, 0], ...arc(R, r, 432, 432, 14, 166, 12), [2700, 390, 0]] }],
  boards: [{ paint: 'rubber', pts: [[1700, 340], [2800, 340], [2800, 400], [1700, 400]] }],
  aprons: [[[1070, 652], [1745, 652], [1745, 425]], [[1745, 398], [2770, 398], [2770, 482], [1745, 482]]],
  arches: [{ x: F, z: r, r: 430 }, { x: R, z: r, r: 430 }],
  wheels: [{ x: F }, { x: R }], tire: '4.75-19', wheel: { style: 'wire', spokes: 24 },
  louvres: [{ x0: 960, x1: 1520, step: 55, z0: 850, z1: 1080 }],
};
const frontParts = (paint) => [
  { pts: fillet([[445, 650, 0], [445, 1175, 40], [480, 1238, 30], [578, 1245, 0], [578, 650, 0]]), chrome: 1 },
  { pts: [[480, 1245], [540, 1245], [535, 1300], [485, 1300]], chrome: 1 },
  { pts: [[300, 840], [640, 840], [640, 872], [300, 872]], ramp: 'black', base: 1 },
  { pts: [[355, 872], [385, 872], [385, 905], [355, 905]], ramp: 'black', base: 1 },
  { e: [385, 1010, 115, 120], chrome: 1 },
  { pts: [[40, 465], [560, 465], [560, 492], [40, 492]], ramp: 'black', base: 1 }];
const smallPlatform = {
  wheelbase: 2629, track: [1422, 1422], frame: { type: 'ladder_channel', line: [[420, 560], [2900, 540], [3150, 700], [3400, 700], [3720, 600]], depth: 100, cross: [600, 1700, 2900, 3700] },
  front: { type: 'beam_transverse_leaf', x: F }, rear: { type: 'beam_transverse_leaf', x: R }, brakes: 'mech_drum', steering: 'worm_sector', tire: '4.75-19',
};
const smallEngine = { layout: 'inline', cyl: 4, bore: 98.4, stroke: 108, head: 'sv', cover: 'paint.engineblue', hp: 40, litres: 3.3, x: 700, z: 640, mount: 'front_long' };

export const townSedan = {
  id: 'v30_town_sedan', year: 1930, replica: true, name: '1930 TOWN SEDAN', bp: 'BP2',
  platform: smallPlatform, engine: smallEngine,
  drivetrain: { layout: 'FR', gearbox: 'manual3_sliding', gbX: [1240, 1560], drive: 'torque_tube', diff: 'open' },
  fuel: { litres: 38, tank: 'cowl', box: [1430, 1080, 1700, 1290] }, radiator: [470, 640, 560, 1200],
  exhaust: [[900, 560], [1300, 430], [2700, 400], [3300, 400], [3900, 380]], muffler: [2600, 3250],
  steering: [[1150, 700], [1960, 1440]], battery: [2150, 420, 2350, 560],
  spec: 'I4 3.3L SIDEVALVE 40HP / 3-SPEED SLIDING / TORQUE TUBE / 4.75-19',
  body: {
    id: 'sil_E1_sedan4d_town', len: 4200, height: 1720, paint: 'paint.niagara', lowZ: 600, smooth: 0, glassSmooth: 0, ...frontClip,
    body: fillet([[565, 650, 0], [565, 1230, 20], [1700, 1250, 0], [1712, 1645, 0], [1615, 1655, 0], [1650, 1698, 40], [1790, 1716, 60],
      [3470, 1716, 180], [3790, 1580, 200], [3830, 1300, 0], [3830, 640, 80], [3770, 480, 0], [1740, 480, 0], [1700, 650, 0]]),
    tone: [{ paint: 'black', pts: [[1600, 1662], [1600, 1800], [3950, 1800], [3950, 1662]], smooth: 0 }],
    glass: [rrect(1765, 1300, 2375, 1605, 45), rrect(2525, 1300, 3110, 1605, 45), fillet([[3195, 1300, 30], [3195, 1605, 40], [3470, 1605, 150], [3540, 1440, 60], [3540, 1300, 30]])],
    frame: 'reveal',
    interior: [{ pts: [[1800, 1430], [1980, 1525], [1990, 1505], [1810, 1410]] }, { pts: [[2140, 1300], [2140, 1430], [2330, 1450], [2330, 1300]] }, { pts: [[2850, 1300], [2850, 1440], [3110, 1450], [3110, 1300]] }],
    doors: [[[1742, 1285], [1742, 485]], [[2442, 1285], [2442, 485]], [[2498, 1285], [2498, 485]], [[3155, 1285], [3155, 830]]],
    trim: [{ pts: [[1700, 1290], [3830, 1290]], w: 2, ramp: 'paint.niagara', lv: 4, lv2: 0 }, { pts: [[575, 1160], [1700, 1172]], w: 2, ramp: 'paint.niagara', lv: 4, lv2: 0 }],
    parts: [...frontParts(), { pts: fillet([[3840, 505, 60], [3840, 1225, 60], [3975, 1225, 60], [3975, 505, 60]]), ramp: 'rubber', base: 1 },
      { pts: [[3975, 820], [4020, 820], [4020, 910], [3975, 910]], chrome: 1 }, { pts: [[3800, 465], [4140, 465], [4140, 492], [3800, 492]], ramp: 'black', base: 1 }],
    lamps: [{ e: [278, 1010, 22, 100], ramp: 'lensW' }, { e: [3890, 560, 45, 45], ramp: 'lensR', bezel: 'chrome' }],
    bumpers: [{ pts: [[0, 430], [75, 430], [75, 530], [0, 530]], smooth: 1 }, { pts: [[4130, 430], [4200, 430], [4200, 530], [4130, 530]], smooth: 1 }],
    handles: [[2385, 1235], [3085, 1235]],
  },
  front: { ...sedan30front, tyre: [[715, 0], [835, 0], [840, 650], [710, 650]] },
  rear: { ...sedan30rear, tyre: [[715, 0], [835, 0], [840, 560], [710, 560]], spare: { z: 870, r: 360, style: 'wire', spokes: 24, tireFrac: 0.33 } },
};

export const coupe = {
  id: 'v30_coupe', year: 1930, replica: true, name: '1930 COUPE (RUMBLE SEAT)', bp: 'BP5',
  platform: smallPlatform, engine: smallEngine,
  drivetrain: townSedan.drivetrain, fuel: townSedan.fuel, radiator: townSedan.radiator,
  exhaust: townSedan.exhaust, muffler: townSedan.muffler, steering: townSedan.steering, battery: townSedan.battery,
  spec: 'I4 3.3L SIDEVALVE 40HP / 3-SPEED SLIDING / SHARED PLATFORM',
  body: {
    id: 'sil_E1_coupe2d_rumble', len: 4100, height: 1720, paint: 'paint.copra', lowZ: 600, smooth: 0, glassSmooth: 0, ...frontClip,
    body: fillet([[565, 650, 0], [565, 1230, 20], [1700, 1250, 0], [1712, 1645, 0], [1615, 1655, 0], [1650, 1698, 40], [1790, 1716, 60],
      [2800, 1716, 200], [2955, 1580, 140], [2965, 1262, 0], [3380, 1170, 320], [3700, 930, 260], [3830, 600, 80], [3770, 480, 0], [1740, 480, 0], [1700, 650, 0]]),
    tone: [{ paint: 'black', pts: [[1600, 1662], [1600, 1800], [3000, 1800], [3000, 1662]], smooth: 0 }],
    glass: [rrect(1765, 1300, 2400, 1610, 45), fillet([[2465, 1300, 40], [2465, 1590, 50], [2770, 1590, 110], [2800, 1300, 40]])],
    frame: 'reveal',
    interior: [{ pts: [[1800, 1430], [1980, 1525], [1990, 1505], [1810, 1410]] }, { pts: [[2180, 1300], [2180, 1450], [2400, 1460], [2400, 1300]] }],
    doors: [[[1742, 1285], [1742, 485]], [[2445, 1285], [2445, 485]], [[2985, 1250], [3380, 1150], [3640, 960]]],
    trim: [{ pts: [[1700, 1290], [2965, 1290]], w: 2, ramp: 'paint.copra', lv: 4, lv2: 0 }, { pts: [[575, 1160], [1700, 1172]], w: 2, ramp: 'paint.copra', lv: 4, lv2: 0 }],
    parts: [...frontParts(), { pts: fillet([[3830, 470, 60], [3830, 1190, 60], [3965, 1190, 60], [3965, 470, 60]]), ramp: 'rubber', base: 1 },
      { pts: [[3965, 790], [4010, 790], [4010, 880], [3965, 880]], chrome: 1 }, { pts: [[3790, 455], [4040, 455], [4040, 482], [3790, 482]], ramp: 'black', base: 1 },
      { pts: [[3230, 1120], [3290, 1120], [3290, 1150], [3230, 1150]], chrome: 1 }, { pts: [[3720, 760], [3760, 760], [3760, 860], [3720, 860]], ramp: 'black', base: 1 }],
    lamps: [{ e: [278, 1010, 22, 100], ramp: 'lensW' }, { e: [3880, 545, 45, 45], ramp: 'lensR', bezel: 'chrome' }],
    bumpers: [{ pts: [[0, 430], [75, 430], [75, 530], [0, 530]], smooth: 1 }, { pts: [[4030, 420], [4100, 420], [4100, 520], [4030, 520]], smooth: 1 }],
    handles: [[2390, 1235]],
  },
};

// ===== 1936 streamline FF sedan (WB 3175, 6.50-16, V8 sidevalve ahead-of-axle gearbox) =====
const F2 = 650, R2 = F2 + 3175, r2 = 365;
export const streamFF = {
  id: 'v36_streamline_ff', year: 1936, replica: true, name: '1936 STREAMLINE SEDAN (FWD)', bp: 'BP1',
  platform: { wheelbase: 3175, track: [1422, 1549], frame: { type: 'semi_unit', line: [[150, 460], [1850, 460]], depth: 90, sill: [[1800, 360], [3700, 360]], cross: [300, 1500] },
    front: { type: 'trailing_arm_transverse_leaf', x: F2 }, rear: { type: 'dead_beam_semi_elliptic', x: R2 }, brakes: 'hyd_drum', steering: 'worm_roller', tire: '6.50-16' },
  engine: { layout: 'V', cyl: 8, bore: 88.9, stroke: 95.3, head: 'sv', cover: 'paint.crinkle', hp: 125, litres: 4.7, x: F2 + 80, z: 520, flip: true, mount: 'front_long_behind_axle' },
  drivetrain: { layout: 'FF', gearbox: 'preselector4', gbX: [F2 - 470, F2 - 60], drive: 'cv_halfshaft', diff: 'open' },
  fuel: { litres: 76, tank: 'rear', box: [4180, 420, 4620, 640] }, radiator: [300, 600, 380, 1050],
  exhaust: [[1100, 380], [1700, 340], [3300, 340], [3900, 360], [4720, 380]], muffler: [3200, 3800],
  steering: [[F2 + 150, 650], [2250, 1260]], battery: [1500, 600, 1700, 760],
  spec: 'V8 4.7L SIDEVALVE 125HP / 4-SPEED PRESELECTOR / FRONT DRIVE / 6.50-16',
  body: {
    id: 'sil_E1_sedan4d_streamFF', len: 4830, height: 1540, paint: 'paint.cream', lowZ: 520, smooth: 0, glassSmooth: 0,
    body: fillet([[300, 520, 0], [250, 800, 120], [300, 1060, 150], [420, 1110, 60], [1850, 1150, 0], [2300, 1495, 260], [2650, 1528, 300], [3120, 1520, 300],
      [3650, 1390, 300], [4250, 980, 320], [4700, 560, 200], [4650, 360, 0], [1800, 340, 0], [1760, 520, 0]]),
    arches: [{ x: F2, z: r2, r: 430 }, { x: R2, z: r2, r: 430 }],
    wheels: [{ x: F2 }, { x: R2 }], tire: '6.50-16', wheel: { style: 'steel', paint: 'paint.cream' },
    fenders: [
      { paint: 'paint.cream', wx: F2, wz: r2, wr: 430, smooth: 2, pts: [[84, 460, 0], [100, 700, 0], [300, 880, 0], [650, 940, 0], [1000, 905, 0], [1400, 740, 0], [1750, 500, 0], [1880, 350, 0], [1250, 350, 0], ...arc(F2, r2, 432, 432, 20, 165, 12), [150, 420, 0]] },
      { paint: 'paint.cream', wx: R2, wz: r2, wr: 430, smooth: 2, pts: [[3330, 360, 0], [3360, 640, 0], [3560, 850, 0], [3860, 935, 0], [4200, 865, 0], [4500, 660, 0], [4690, 420, 0], [4660, 350, 0], [4300, 360, 0], ...arc(R2, r2, 432, 432, 15, 165, 12)] }],
    glass: [fillet([[2090, 1050, 30], [2290, 1357, 60], [2774, 1357, 50], [2774, 1050, 30]]), fillet([[2892, 1050, 30], [2892, 1357, 50], [3506, 1357, 140], [3624, 1050, 30]])],
    frame: 'chrome',
    interior: [{ pts: [[2150, 1180], [2300, 1260], [2310, 1240], [2160, 1160]] }],
    doors: [[[1840, 1140], [1840, 360]], [[2830, 1140], [2830, 360]], [[2860, 1140], [2860, 360]], [[3360, 1140], [3420, 900], [3330, 640]]],
    louvres: [],
    trim: [...[0, 1, 2, 3, 4, 5, 6, 7].map(k => { const z = 850 - k * 40; const x0 = 1150 + k * 55; return { pts: [[x0, z], [1790, z]], w: 1, lv: 4 }; }),
      { pts: [[1850, 1150], [3650, 1150], [4250, 900]], w: 1, lv: 3 }],
    spec: [{ z: x => 1110 + (x - 420) * 0.028, x0: 450, x1: 1800, lv: 4 }],
    parts: [{ pts: [[160, 820], [230, 860], [230, 880], [150, 850]], chrome: 1 }],
    lamps: [{ e: [4640, 520, 25, 45], ramp: 'lensR', bezel: 'chrome' }],
    bumpers: [{ pts: [[0, 380], [80, 380], [90, 480], [0, 490]], smooth: 1 }, { pts: [[4750, 380], [4830, 380], [4830, 480], [4745, 490]], smooth: 1 }],
    handles: [[2700, 1100], [3000, 1100]],
  },
};

// ===== 1929 supercharged sports tourer (WB 3400, 6.50-20, I6 SOHC + Roots blower) =====
const F3 = 560, R3 = F3 + 3400, r3 = 416;
export const sportsTourer = {
  id: 'v29_sports_tourer', year: 1929, replica: true, name: '1929 SUPERCHARGED SPORTS TOURER', bp: 'BP4',
  platform: { wheelbase: 3400, track: [1420, 1420], frame: { type: 'ladder_channel', line: [[F3 - 400, 600], [F3 + 3000, 560], [F3 + 3250, 760], [F3 + 3600, 760], [F3 + 4000, 700]], depth: 140, cross: [F3 - 300, F3 + 1500, F3 + 3000, F3 + 3900] },
    front: { type: 'beam_semi_elliptic', x: F3 }, rear: { type: 'beam_semi_elliptic', x: R3 }, brakes: 'mech_drum_servo', steering: 'worm_nut', tire: '6.50-20' },
  engine: { layout: 'inline', cyl: 6, bore: 100, stroke: 150, head: 'ohv', cover: 'paint.crinkle', hp: 225, litres: 7.1, x: F3 + 300, z: 680, blower: true, mount: 'front_long' },
  drivetrain: { layout: 'FR', gearbox: 'manual4', gbX: [F3 + 1330, F3 + 1760], drive: 'hotchkiss', diff: 'open' },
  fuel: { litres: 120, tank: 'tail', box: [F3 + 3700, 620, F3 + 4150, 960] }, radiator: [F3 - 80, 700, F3 + 20, 1290],
  exhaust: [], muffler: null, steering: [[F3 + 1100, 900], [F3 + 2250, 1420]], battery: [F3 + 2400, 500, F3 + 2600, 640],
  spec: 'I6 7.1L SOHC + ROOTS BLOWER 225HP / 4-SPEED / HOTCHKISS / 6.50-20',
  body: {
    id: 'sil_E1_tourer_sports', len: 5300, height: 1780, paint: 'paint.ivory', lowZ: 640, smooth: 0, glassSmooth: 0,
    body: fillet([[F3 - 30, 700, 0], [F3 - 30, 1300, 30], [F3 + 60, 1325, 0], [F3 + 2050, 1330, 0], [F3 + 2250, 1650, 0], [F3 + 2300, 1660, 0], [F3 + 2500, 1730, 60], [F3 + 2950, 1765, 260],
      [F3 + 3550, 1650, 220], [F3 + 3680, 1330, 0], [F3 + 3800, 1300, 120], [F3 + 3920, 1080, 160], [F3 + 3940, 720, 120], [F3 + 3860, 480, 0], [F3 + 750, 480, 0], [F3 + 600, 700, 0]]),
    arches: [{ x: F3, z: r3, r: 480 }, { x: R3, z: r3, r: 480 }],
    wheels: [{ x: F3 }, { x: R3 }], tire: '6.50-20', wheel: { style: 'wire', spokes: 32 },
    fenders: [
      { paint: 'paint.ivory', wx: F3, wz: r3, wr: 478, smooth: 1, pts: [[F3 - 560, 520, 0], ...arc(F3, r3, 620, 640, 168, 20, 14), [F3 + 760, 460, 0], [F3 + 820, 400, 0], [F3 + 760, 380, 0], [F3 + 560, 470, 0], ...arc(F3, r3, 482, 482, 12, 165, 12)] },
      { paint: 'paint.ivory', wx: R3, wz: r3, wr: 478, smooth: 1, pts: [[F3 + 2780, 400, 0], [F3 + 2850, 460, 0], ...arc(R3, r3, 640, 620, 160, 18, 12), [F3 + 4250, 420, 0], [F3 + 4220, 380, 0], ...arc(R3, r3, 482, 482, 12, 168, 12)] }],
    boards: [{ paint: 'rubber', pts: [[F3 + 750, 360], [F3 + 2850, 360], [F3 + 2850, 420], [F3 + 750, 420]] }],
    aprons: [[[F3 + 750, 422], [F3 + 2850, 422], [F3 + 2850, 482], [F3 + 750, 482]]],
    tone: [{ paint: 'canvas', pts: [[F3 + 2260, 1340], [F3 + 2260, 1900], [F3 + 3700, 1900], [F3 + 3700, 1340]], smooth: 0 }],
    glass: [fillet([[F3 + 2420, 1370, 30], [F3 + 2420, 1600, 40], [F3 + 3000, 1640, 60], [F3 + 3000, 1370, 30]]), fillet([[F3 + 3060, 1370, 30], [F3 + 3060, 1630, 60], [F3 + 3400, 1600, 160], [F3 + 3520, 1420, 50], [F3 + 3520, 1370, 30]])],
    frame: 'chrome',
    interior: [{ pts: [[F3 + 2440, 1430], [F3 + 2620, 1520], [F3 + 2630, 1500], [F3 + 2450, 1410]] }],
    doors: [[[F3 + 2050, 1300], [F3 + 2050, 500]], [[F3 + 2900, 1300], [F3 + 2900, 520]]],
    louvres: [{ x0: F3 + 410, x1: F3 + 1620, step: 40, z0: 770, z1: 1100 }],
    trim: [{ pts: [[F3 + 60, 1300], [F3 + 3700, 1300]], w: 1, ramp: 'chrome', lv: 3 }, { pts: [[F3 + 3750, 1420], [F3 + 3550, 1560]], w: 1, lv: 4, free: 1 },
      { pts: [[F3 + 1000, 1330], [F3 + 1000, 700]], w: 1, ramp: 'chrome', lv: 3 }],
    parts: [{ pts: fillet([[F3 - 90, 700, 0], [F3 - 90, 1280, 40], [F3 - 40, 1335, 20], [F3 + 60, 1335, 0], [F3 + 60, 700, 0]]), chrome: 1 },
      { pts: [[F3 - 50, 1335], [F3 + 10, 1335], [F3 + 5, 1400], [F3 - 45, 1400]], chrome: 1 },
      { pts: [[F3 + 2040, 1330], [F3 + 2090, 1330], [F3 + 2300, 1660], [F3 + 2250, 1665]], chrome: 1 },
      { pts: [[F3 - 300, 900], [F3 + 40, 900], [F3 + 40, 935], [F3 - 300, 935]], ramp: 'black', base: 1 },
      { e: [F3 - 150, 1110, 120, 140], chrome: 1 },
      ...[0, 1].map(k => { const x0 = F3 + 3960 + k * 300, sk = 90; return { pts: fillet([[x0, 380, 60], [x0 + sk, 380 + 832, 60], [x0 + sk + 170, 380 + 832, 60], [x0 + 170, 380, 60]]), ramp: 'rubber', base: 1 }; }),
      { pts: [[F3 + 3900, 640], [F3 + 4560, 640], [F3 + 4560, 680], [F3 + 3900, 680]], ramp: 'black', base: 1 }],
    lamps: [{ e: [F3 - 265, 1110, 25, 115], ramp: 'lensW' }, { e: [F3 + 3930, 880, 40, 40], ramp: 'lensR', bezel: 'chrome' }],
    bumpers: [{ pts: [[0, 470], [70, 470], [70, 560], [0, 560]], smooth: 1 }],
    handles: [[F3 + 2800, 1240]],
    asymR: { pipes: [F3 + 1150, F3 + 1260, F3 + 1370].map(x => ({ pts: [[x, 1050], [x + 50, 1050], [x + 170, 560], [x + 120, 560]], ramp: 'chrome', base: 2 })) },
  },
};

export const E1 = [townSedan, coupe, streamFF, sportsTourer];
