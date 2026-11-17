// 1934 V12 town car (Fleetwood-type, debadged) - measured from user 4-view. Detail scale.
import { fillet, arc } from './geom.mjs';
const S = (x, y) => [(x - 225) * 9.89, (192 - y) * 9.89];
const p = (x, y, r = 0) => [...S(x, y), r];
const F = 643, R = F + 3708, r = 402;

export const townCar34 = {
  id: 'sil_E1_towncar_V12_D', len: 5320, height: 1840, paint: 'paint.cadmaroon', grad: [3.0, 1.3], glassStyle: 'period', smooth: 0, glassSmooth: 0,
  body: fillet([p(272, 140), p(270, 100, 30), p(274, 67, 60), p(300, 60, 40), p(462, 55), p(480, 62), p(553, 62), p(555, 10, 20), p(562, 7, 40),
    p(718, 7, 160), p(734, 26, 200), p(737, 62), p(742, 92, 40), p(744, 132, 100), p(736, 140)]),
  tone: [{ paint: 'black', pts: [S(540, 66), S(540, -20), S(760, -20), S(760, 66)], smooth: 0 }],
  arches: [{ x: F, z: r, r: 432 }, { x: R, z: r, r: 432 }],
  wheels: [{ x: F }, { x: R }], tire: '7.50-17', wheel: { style: 'hubcap', whitewall: 0 },
  fenders: [
    { paint: 'black', wx: F, wz: r, wr: 430, smooth: 1, pts: [p(242, 150), p(243, 132), p(256, 112), p(290, 102), p(330, 109), p(380, 127), p(425, 139), p(462, 148), p(470, 153), p(338, 150), ...arc(F, r, 432, 432, 14, 166, 12), p(244, 152)] },
    { paint: 'black', wx: R, wz: r, wr: 430, smooth: 1, pts: [p(610, 152), p(628, 124), p(662, 102), p(700, 110), p(738, 130), p(757, 150), p(752, 155), ...arc(R, r, 432, 432, 10, 168, 12)] }],
  boards: [{ paint: 'rubber', pts: [[S(460, 0)[0], 336], [S(612, 0)[0], 336], [S(612, 0)[0], 405], [S(460, 0)[0], 405]] }],
  aprons: [[[S(462, 0)[0], 405], [S(612, 0)[0], 405], [S(612, 0)[0], 515], [S(462, 0)[0], 515]]],
  spares: [{ x: S(415, 0)[0], z: (192 - 115) * 9.89, style: 'hubcap' }],
  glass: [fillet([[...S(570, 63), 30], [...S(570, 22), 50], [...S(618, 22), 40], [...S(618, 63), 30]]), fillet([[...S(624, 63), 30], [...S(624, 22), 40], [...S(642, 22), 40], [...S(642, 63), 30]])],
  frame: 'chrome',
  interior: [{ e: [...S(600, 45), 80, 110] }],
  doors: [[S(510, 64), S(510, 140)], [S(553, 64), S(553, 140)], [S(648, 64), S(650, 120)]],
  trim: [{ pts: [S(300, 72), S(738, 72)], w: 1, lv: 4 },                                           // belt moulding
    { pts: [S(690, 30), S(700, 32), S(712, 45), S(722, 50), S(735, 58)], w: 2, lv: 4, lv2: 2 },    // landau bar
    ...[0, 1].map(k => ({ pts: [S(312, 92 + k * 5), S(360, 92 + k * 5)], w: 1, lv: 4 })),            // hood vent spears
    { pts: [[S(460, 0)[0], 412], [S(612, 0)[0], 412]], w: 1, lv: 4, free: 1 }],
  louvres: [{ x0: S(320, 0)[0], x1: S(450, 0)[0], step: 45, z0: (192 - 108) * 9.89, z1: (192 - 84) * 9.89 }],
  parts: [
    { pts: fillet([[...S(268, 140), 0], [...S(266, 100), 30], [...S(272, 66), 50], [...S(282, 64), 0], [...S(282, 140), 0]]), chrome: 1 },     // V shell edge
    { pts: [S(466, 61), S(472, 61), S(486, 20), S(480, 19)], chrome: 1 },                                                                         // chauffeur screen frame
    { pts: [S(520, 62), S(545, 62), S(548, 34), S(524, 36)], ramp: 'black', base: 1 },                                                            // chauffeur seat back
    { pts: [S(492, 52), S(505, 46), S(507, 48), S(494, 54)], ramp: 'black', base: 2 },                                                            // steering wheel
    { pts: [S(270, 64), S(280, 50), S(290, 47), S(284, 54), S(278, 64)], chrome: 1 },                                                            // generic swan mascot
    { pts: [[...S(266, 96)], [...S(300, 96)], [...S(300, 99)], [...S(266, 99)]], ramp: 'black', base: 1 },                                        // lamp bar
    { e: [...S(279, 88), 118, 125], chrome: 1 },                                                                                                  // headlamp bucket
    { pts: fillet([[...S(738, 102), 30], [...S(760, 102), 30], [...S(760, 138), 20], [...S(738, 138), 20]]), ramp: 'black', base: 2 },          // luggage trunk
    { pts: [[...S(744, 108)], [...S(758, 108)], [...S(758, 110)], [...S(744, 110)]], chrome: 1 }],
  lamps: [{ e: [S(268, 88)[0], S(268, 88)[1], 22, 120], ramp: 'lensW' }, { e: [S(749, 118)[0], S(749, 118)[1], 30, 30], ramp: 'lensR', bezel: 'chrome' }],
  bumperSets: [{ x0: 0, x1: 200, zs: [420, 480], h: 40, clamp: 140, iron: [[160, 450], [460, 470]] }, { x0: 5150, x1: 5320, zs: [430, 490], h: 40, clamp: 5180, iron: [[4950, 460], [5200, 460]] }],
  handles: [[...S(548, 70)], [...S(612, 70)]],
};

const Y = x => (x - 105) * 9.86, Zf = y => (190 - y) * 9.86;
export const townCarFront = {
  width: 1900, height: 1840, paint: 'paint.cadmaroon', tonePaint: 'black', lowZ: 700, frame: 'chrome', glassStyle: 'period', tire: '7.50-17', track: 1480, hub: 50,
  body: fillet([[0, 470, 0], [700, 470, 0], [790, 560, 60], [790, 1290, 0], [790, 1700, 150], [740, 1820, 80], [0, 1822, 0]]),
  tone: [[0, 1290], [900, 1290], [900, 1900], [0, 1900]],
  glass: [fillet([[0, 1330, 0], [540, 1330, 30], [540, 1650, 40], [0, 1650, 0]])],
  under: [
    { half: 1, pts: [[0, 470], [300, 470], [300, 1262], [0, 1262]], ramp: 'paint.cadmaroon', base: 2 },
    { half: 0, pts: fillet([[600, 470, 0], [600, 900, 140], [740, 990, 80], [955, 905, 60], [975, 470, 0]]), ramp: 'black', base: 2 },
    { half: 0, pts: fillet([[-600, 470, 0], [-600, 900, 140], [-740, 990, 80], [-955, 905, 60], [-975, 470, 0]]), ramp: 'black', base: 2 },
    { half: 1, pts: [[0, 300], [420, 330], [620, 390], [0, 390]], ramp: 'black', base: 1 }],
  grilles: [{ half: 1, pattern: 'hbar', bars: 'chrome', surround: 'chrome', pts: fillet([[0, 345, 0], [140, 430, 60], [250, 700, 120], [258, 1080, 80], [190, 1205, 80], [0, 1215, 0]]) }],
  bumpers: [{ half: 1, pts: [[0, 360], [930, 375], [955, 400], [930, 425], [0, 410]], smooth: 0 }, { half: 1, pts: [[0, 425], [930, 435], [955, 455], [930, 475], [0, 465]], smooth: 0 }],
  lamps: [{ y: 345, z: 1009, r: 128, ramp: 'lensW', bezel: 'chrome' }, { y: 440, z: 820, r: 40, ramp: 'lensW', bezel: 'chrome' }],
  parts: [{ pts: [[-14, 345], [14, 345], [14, 1215], [-14, 1215]], chrome: 1 },
          { pts: [[-30, 1262], [30, 1262], [12, 1400], [-12, 1400]], chrome: 1 },
          { pts: [[-60, 1395], [60, 1395], [25, 1430], [-25, 1430]], chrome: 1 }],
};
export const townCarRear = {
  width: 1900, height: 1840, paint: 'paint.cadmaroon', tonePaint: 'black', lowZ: 700, frame: 'chrome', glassStyle: 'period', tire: '7.50-17', track: 1480, hub: 50,
  body: fillet([[0, 470, 0], [700, 470, 0], [790, 560, 60], [790, 1290, 0], [790, 1700, 150], [740, 1820, 80], [0, 1822, 0]]),
  tone: [[0, 1290], [900, 1290], [900, 1900], [0, 1900]],
  glass: [fillet([[0, 1440, 0], [230, 1440, 70], [230, 1580, 70], [0, 1580, 0]])],
  under: [
    { half: 0, pts: fillet([[600, 470, 0], [600, 860, 140], [740, 950, 80], [955, 870, 60], [975, 470, 0]]), ramp: 'black', base: 2 },
    { half: 0, pts: fillet([[-600, 470, 0], [-600, 860, 140], [-740, 950, 80], [-955, 870, 60], [-975, 470, 0]]), ramp: 'black', base: 2 },
    { half: 1, pts: fillet([[0, 540, 0], [510, 540, 30], [510, 880, 30], [0, 880, 0]]), ramp: 'black', base: 2 }],
  grilles: [{ half: 1, pattern: 'hbar', bars: 'black', surround: 'chrome', pts: [[0, 560], [490, 560], [490, 860], [0, 860]] }],
  bumpers: [{ half: 1, pts: [[0, 375], [930, 375], [955, 400], [930, 425], [0, 425]], smooth: 0 }, { half: 1, pts: [[0, 435], [930, 435], [955, 455], [930, 475], [0, 475]], smooth: 0 }],
  lamps: [{ y: 860, z: 710, r: 55, ramp: 'lensR', bezel: 'chrome' }],
  parts: [{ pts: [[-140, 600], [-60, 600], [-60, 640], [-140, 640]], chrome: 1 }, { pts: [[60, 600], [140, 600], [140, 640], [60, 640]], chrome: 1 }],
};
