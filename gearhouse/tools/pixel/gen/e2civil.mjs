// E2 civilian replicas (debadged), measured from user 4-views. Detail scale. x mm from front bumper tip.
import { fillet, arc, rrect } from './geom.mjs';
import { chassisUnder } from './chassis.mjs';
const mk = (fx, fy, k, flip = false) => (x, y) => [flip ? (fx - x) * k : (x - fx) * k, (fy - y) * k];
const P = conv => (x, y, r = 0) => [...conv(x, y), r];
const realism = { grad: [3.1, 1.4], glassStyle: 'period', smooth: 0, glassSmooth: 0 };
const W1 = (z) => ({ style: 'steel', paint: z });

// ---- 1946 woody station wagon (WB 2896, 6.00-16) ----
{ }
const Wd = mk(13, 151.7, 14.55), wd = P(Wd); const FW = Wd(73, 0)[0], RW = Wd(272, 0)[0];
export const woody46 = { ...realism, id: 'e2_woody46', len: 5050, height: 1800, paint: 'paint.w46', lowZ: 400,
  body: fillet([wd(24, 126), wd(20, 95, 80), wd(25, 70, 120), wd(40, 66, 80), wd(127, 64), wd(147, 38), wd(153, 27, 60), wd(330, 27, 120), wd(344, 45, 60), wd(346, 124, 40), wd(340, 127)]),
  arches: [{ x: FW, z: 365, r: 430 }, { x: RW, z: 365, r: 430 }], wheels: [{ x: FW }, { x: RW }], tire: '6.00-16', wheel: W1('paint.w46'),
  fenders: [{ paint: 'paint.w46', wx: FW, wz: 365, wr: 430, smooth: 2, pts: [wd(22, 118), wd(26, 92), wd(45, 82), wd(73, 80), wd(105, 86), wd(125, 100), wd(132, 120), wd(130, 127), wd(110, 127), ...arc(FW, 365, 432, 432, 15, 165, 12), wd(24, 126)] },
            { paint: 'paint.w46', wx: RW, wz: 365, wr: 430, smooth: 2, pts: [wd(236, 127), wd(240, 103), wd(258, 86), wd(285, 85), wd(310, 92), wd(334, 110), wd(338, 125), ...arc(RW, 365, 432, 432, 12, 168, 12)] }],
  tone: [...[[136, 196], [203, 247], [254, 334]].flatMap(([a, b]) => [{ paint: 'woodDark', pts: [Wd(a, 78), Wd(b, 78), Wd(b, 95), Wd(a, 95)], smooth: 0 }, { paint: 'woodDark', pts: [Wd(a, 99), Wd(b, 99), Wd(b, 116), Wd(a, 116)], smooth: 0 }]),
    { paint: 'paint.w46', pts: [Wd(125, 20), Wd(350, 20), Wd(350, 33), Wd(125, 33)], smooth: 0 }, { paint: 'woodLight', pts: [Wd(131, 30), Wd(343, 30), Wd(343, 126), Wd(131, 126)], smooth: 0 }],
  glass: [rrect(...Wd(145, 68.3), ...Wd(191.7, 41.7), 40), rrect(...Wd(203, 68.3), ...Wd(248, 41.7), 40), rrect(...Wd(255, 68.3), ...Wd(286, 41.7), 40), fillet([[...Wd(291, 68.3), 30], [...Wd(291, 41.7), 40], [...Wd(330, 41.7), 120], [...Wd(337, 68.3), 30]])],
  frame: 'reveal', doors: [[Wd(198, 70), Wd(198, 126)], [Wd(250, 70), Wd(250, 126)]],
  trim: [{ pts: [Wd(40, 74), Wd(127, 72)], w: 2 }, { pts: [Wd(30, 100), Wd(110, 100)], w: 1, onFender: 1 }],
  parts: [{ pts: [Wd(20, 75), Wd(28, 75), Wd(28, 120), Wd(20, 120)], chrome: 1, behind: 1 }, { pts: [Wd(345, 55), Wd(358, 55), Wd(358, 121), Wd(345, 121)], ramp: 'rubber', base: 1 },
    { pts: [Wd(356, 82), Wd(361, 82), Wd(361, 94), Wd(356, 94)], chrome: 1 }],
  lamps: [{ e: [...Wd(30, 85), 25, 50], ramp: 'lensW', bezel: 'chrome' }, { e: [...Wd(339, 90), 25, 35], ramp: 'lensR', bezel: 'chrome' }],
  bumperSets: [{ x0: 0, x1: 260, zs: [440], h: 90, clamp: 120, iron: [[200, 440], [420, 430]] }, { x0: 4820, x1: 5050, zs: [440], h: 90, clamp: 4900, iron: [[4700, 430], [4880, 440]] }],
  handles: [[...Wd(190, 74)], [...Wd(246, 74)]], under: chassisUnder({ F: FW, R: RW, r: 365, frameZ: 450, front: 300, rear: 4800, exhaustZ: 300, tank: false }) };

// ---- 1940 half-ton pickup (WB 2845, 6.00-16) ----
const Pk = mk(31.7, 138.3, 13.95), pk = P(Pk); const FP = Pk(70, 0)[0], RP = Pk(274, 0)[0];
export const pickup40 = { ...realism, id: 'e2_pickup40', len: 3900, height: 1700, paint: 'paint.p40', lowZ: 400,
  body: fillet([pk(36, 118), pk(33, 80, 60), pk(42, 52, 100), pk(131.7, 50), pk(141, 24), pk(148, 21.7, 40), pk(196, 21.7, 60), pk(201.7, 28), pk(201.7, 120), pk(190, 122)]),
  arches: [{ x: FP, z: 340, r: 410 }], wheels: [{ x: FP }, { x: RP }], tire: '6.00-16', wheel: { style: 'steel', paint: 'paint.p40', whitewall: 0.28 },
  fenders: [{ paint: 'paint.p40', wx: FP, wz: 340, wr: 410, smooth: 2, pts: [pk(32, 108), pk(36, 86), pk(52, 74), pk(70, 71.7), pk(92, 76), pk(110, 90), pk(126, 106), pk(133, 112), pk(133, 117), pk(100, 115), ...arc(FP, 340, 412, 412, 15, 168, 12), pk(32, 114)] },
            { paint: 'paint.p40', wx: RP, wz: 340, wr: 410, smooth: 2, pts: [pk(236, 118), pk(240, 100), pk(255, 87), pk(274, 85), pk(293, 87), pk(308, 100), pk(312, 118), ...arc(RP, 340, 412, 412, 12, 168, 12)] }],
  boards: [{ paint: 'rubber', pts: [Pk(131, 111), Pk(238, 111), Pk(238, 115), Pk(131, 115)] }],
  aprons: [[Pk(131, 115), Pk(238, 115), Pk(238, 120), Pk(131, 120)]],
  glass: [rrect(...Pk(141.7, 50), ...Pk(183.3, 25), 40), [Pk(136, 48), Pk(142, 25), Pk(144, 25), Pk(138, 48)]], frame: 'reveal',
  doors: [[Pk(133, 52), Pk(133, 112)], [Pk(188, 26), Pk(188, 112)]],
  parts: [{ pts: fillet([[...Pk(202, 53), 0], [...Pk(335, 53), 20], [...Pk(335, 120), 20], [...Pk(202, 120), 0]]), ramp: 'paint.p40', base: 2, behind: 1 },          // bed box
    { pts: [Pk(202, 53), Pk(335, 53), Pk(335, 56), Pk(202, 56)], ramp: 'paint.p40', base: 3, behind: 1 }, { pts: [Pk(33, 60), Pk(40, 60), Pk(40, 116), Pk(33, 116)], chrome: 1, behind: 1 },
    { pts: [Pk(330, 85), Pk(336, 85), Pk(336, 92), Pk(330, 92)], ramp: 'lensR', base: 2 }],
  lamps: [{ e: [...Pk(45, 78), 30, 55], ramp: 'lensW', bezel: 'chrome' }],
  bumperSets: [{ x0: 0, x1: 150, zs: [360], h: 70, clamp: 80, iron: [[120, 360], [380, 380]] }, { x0: 3700, x1: 3830, zs: [380], h: 70, iron: [[3550, 390], [3720, 380]] }],
  louvres: [{ x0: Pk(55, 0)[0], x1: Pk(110, 0)[0], step: 60, z0: Pk(0, 78)[1], z1: Pk(0, 70)[1] }],
  handles: [[...Pk(175, 57)]], under: chassisUnder({ F: FP, R: RP, r: 340, frameZ: 480, front: 200, rear: 3700, exhaustZ: 320, tank: false }) };

// ---- 1942 four-door sedan (WB 2896, 6.00-16) ----
const F4 = mk(225, 202.5, 9.27), f4 = P(F4); const FF = F4(310, 0)[0], RF = F4(622.5, 0)[0];
export const sedan42 = { ...realism, id: 'e2_sedan42', len: 4900, height: 1740, paint: 'paint.s42', lowZ: 400,
  body: fillet([f4(230, 168), f4(226, 120, 80), f4(242, 65, 150), f4(395, 62), f4(426, 22), f4(434, 5, 80), f4(600, 5, 200), f4(690, 40, 260), f4(745, 100, 200), f4(750, 140, 80), f4(745, 168)]),
  arches: [{ x: FF, z: 365, r: 420 }, { x: RF, z: 365, r: 420 }], wheels: [{ x: FF }, { x: RF }], tire: '6.00-16', wheel: W1('paint.s42'),
  fenders: [{ paint: 'paint.s42', wx: FF, wz: 365, wr: 420, smooth: 2, pts: [f4(228, 160), f4(232, 120), f4(262, 105), f4(310, 102), f4(350, 112), f4(385, 140), f4(405, 166), f4(380, 168), ...arc(FF, 365, 422, 422, 14, 166, 12), f4(230, 165)] },
            { paint: 'paint.s42', wx: RF, wz: 365, wr: 420, smooth: 2, pts: [f4(570, 168), f4(578, 135), f4(605, 112), f4(645, 108), f4(690, 118), f4(735, 145), f4(742, 165), ...arc(RF, 365, 422, 422, 12, 168, 12)] }],
  glass: [fillet([[...F4(420, 67.5), 30], [...F4(432, 27.5), 60], [...F4(497.5, 27.5), 40], [...F4(497.5, 67.5), 30]]), rrect(...F4(510, 67.5), ...F4(582, 27.5), 40), fillet([[...F4(592, 67.5), 30], [...F4(592, 27.5), 40], [...F4(640, 30), 160], [...F4(660, 67.5), 30]])],
  frame: 'chrome', doors: [[F4(400, 72), F4(402, 166)], [F4(504, 72), F4(504, 166)], [F4(588, 72), F4(588, 140)]],
  trim: [{ pts: [F4(242, 72), F4(600, 72), F4(700, 80)], w: 2 }, { pts: [F4(245, 85), F4(390, 85)], w: 1 }],
  parts: [{ pts: [F4(225, 95), F4(234, 95), F4(234, 140), F4(225, 140)], chrome: 1, behind: 1 }],
  lamps: [{ e: [...F4(236, 118), 30, 60], ramp: 'lensW', bezel: 'chrome' }, { e: [...F4(744, 120), 25, 40], ramp: 'lensR', bezel: 'chrome' }],
  bumperSets: [{ x0: 0, x1: 240, zs: [420], h: 90, clamp: 110, iron: [[200, 420], [430, 410]] }, { x0: 4650, x1: 4900, zs: [420], h: 90, clamp: 4780, iron: [[4550, 410], [4700, 420]] }],
  handles: [[...F4(490, 78)], [...F4(578, 78)]], under: chassisUnder({ F: FF, R: RF, r: 365, frameZ: 430, front: 300, rear: 4650, exhaustZ: 280 }) };

// ---- 1940 V8 coupe (WB 2845, 6.00-16 whitewall) ----
const C4 = mk(3.3, 155, 11.16), c4 = P(C4); const FC = C4(60, 0)[0], RC = C4(315, 0)[0];
export const coupe40 = { ...realism, id: 'e2_coupe40', len: 4450, height: 1720, paint: 'paint.c40', lowZ: 400,
  body: fillet([c4(10, 117), c4(5, 75, 60), c4(13, 50, 120), c4(130, 45), c4(147, 18), c4(155, 3, 80), c4(230, 3, 200), c4(300, 40, 260), c4(370, 80, 200), c4(393, 100, 80), c4(390, 117)]),
  arches: [{ x: FC, z: 365, r: 420 }, { x: RC, z: 365, r: 420 }], wheels: [{ x: FC }, { x: RC }], tire: '6.00-16', wheel: { style: 'steel', paint: 'paint.c40', whitewall: 0.32 },
  fenders: [{ paint: 'paint.c40', wx: FC, wz: 365, wr: 420, smooth: 2, pts: [c4(6, 110), c4(12, 92), c4(35, 82), c4(62, 80), c4(90, 86), c4(112, 100), c4(126, 116), c4(128, 120), c4(100, 120), ...arc(FC, 365, 422, 422, 15, 165, 12), c4(8, 116)] },
            { paint: 'paint.c40', wx: RC, wz: 365, wr: 420, smooth: 2, pts: [c4(270, 120), c4(276, 100), c4(298, 86), c4(330, 84), c4(360, 92), c4(385, 110), c4(388, 120), ...arc(RC, 365, 422, 422, 12, 168, 12)] }],
  boards: [{ paint: 'rubber', pts: [C4(120, 116), C4(276, 116), C4(276, 121), C4(120, 121)] }],
  glass: [fillet([[...C4(150, 45), 30], [...C4(158, 18), 60], [...C4(210, 18), 40], [...C4(210, 45), 30]]), fillet([[...C4(217, 45), 30], [...C4(217, 18), 40], [...C4(240, 22), 120], [...C4(252, 45), 30]])],
  frame: 'chrome', doors: [[C4(132, 50), C4(134, 116)], [C4(214, 50), C4(214, 116)]],
  trim: [{ pts: [C4(13, 57), C4(300, 57), C4(370, 85)], w: 1 }],
  parts: [{ pts: [C4(4, 60), C4(12, 52), C4(14, 110), C4(5, 112)], chrome: 1, behind: 1 }],
  lamps: [{ e: [...C4(10, 88), 30, 60], ramp: 'lensW', bezel: 'chrome' }, { e: [...C4(386, 102), 25, 40], ramp: 'lensR', bezel: 'chrome' }],
  bumperSets: [{ x0: 0, x1: 220, zs: [430], h: 80, clamp: 100, iron: [[180, 430], [420, 420]] }, { x0: 4230, x1: 4450, zs: [430], h: 80, clamp: 4350, iron: [[4100, 420], [4280, 430]] }],
  handles: [[...C4(205, 52)]], under: chassisUnder({ F: FC, R: RC, r: 365, frameZ: 460, front: 250, rear: 4250, exhaustZ: 300 }) };

// ---- 1946 small four-door (WB 2340, 5.00-16) - front at right in the reference ----
const Sm = mk(570, 175, 9.36, true), sm = P(Sm); const FS = Sm(505, 0)[0], RS = Sm(255, 0)[0];
export const small46 = { ...realism, id: 'e2_small46', len: 3900, height: 1640, paint: 'paint.sm46', lowZ: 330,
  body: fillet([sm(565, 145), sm(563, 100, 60), sm(560, 60, 80), sm(552, 55, 60), sm(427.5, 50), sm(407.5, 20), sm(398, 2.5, 80), sm(250, 2.5, 160), sm(185, 40, 200), sm(172, 100, 120), sm(170, 140, 60), sm(178, 145)]),
  arches: [{ x: FS, z: 330, r: 390 }, { x: RS, z: 330, r: 390 }], wheels: [{ x: FS }, { x: RS }], tire: '5.00-16', wheel: { style: 'discperf', paint: 'paint.sm46' },
  fenders: [{ paint: 'paint.sm46', wx: FS, wz: 330, wr: 390, smooth: 2, pts: [sm(566, 130), sm(562, 100), sm(540, 90), sm(505, 98), sm(470, 108), sm(440, 132), sm(424, 148), sm(450, 148), ...arc(FS, 330, 392, 392, 15, 165, 12), sm(566, 140)] },
            { paint: 'paint.sm46', wx: RS, wz: 330, wr: 390, smooth: 2, pts: [sm(290, 148), sm(282, 118), sm(260, 100), sm(230, 102), sm(205, 115), sm(190, 140), sm(192, 148), ...arc(RS, 330, 392, 392, 12, 168, 12)] }],
  boards: [{ paint: 'rubber', pts: [Sm(424, 146), Sm(285, 146), Sm(285, 150), Sm(424, 150)] }],
  glass: [fillet([[...Sm(405, 57.5), 30], [...Sm(400, 22), 60], [...Sm(337.5, 20), 40], [...Sm(337.5, 57.5), 30]]), fillet([[...Sm(327.5, 57.5), 30], [...Sm(327.5, 20), 40], [...Sm(262, 22), 120], [...Sm(252.5, 57.5), 30]])],
  frame: 'reveal', doors: [[Sm(420, 60), Sm(420, 146)], [Sm(332.5, 60), Sm(332.5, 146)], [Sm(250, 60), Sm(255, 120)]],
  trim: [{ pts: [Sm(520, 72), Sm(450, 72)], w: 1 }, { pts: [Sm(520, 78), Sm(450, 78)], w: 1 }, { pts: [Sm(520, 84), Sm(450, 84)], w: 1 }],
  parts: [{ pts: [Sm(564, 62), Sm(570, 62), Sm(570, 128), Sm(564, 128)], chrome: 1, behind: 1 }],
  lamps: [{ e: [...Sm(540, 92), 30, 50], ramp: 'lensW', bezel: 'chrome' }, { e: [...Sm(178, 100), 22, 30], ramp: 'lensR', bezel: 'chrome' }],
  bumperSets: [{ x0: 0, x1: 160, zs: [390], h: 50, iron: [[120, 390], [300, 400]] }, { x0: 3700, x1: 3870, zs: [390], h: 50, iron: [[3550, 400], [3720, 390]] }],
  handles: [[...Sm(345, 64)], [...Sm(262, 64)]], under: chassisUnder({ F: FS, R: RS, r: 330, frameZ: 380, front: 200, rear: 3700, exhaustZ: 260, tank: false }) };

// ---- 1941 V8 luxury sedan (WB 3200, 7.00-15 whitewall, rear skirts) ----
const Cd = mk(345, 305, 5.45), cd = P(Cd); const FD = Cd(480, 0)[0], RD = Cd(1067, 0)[0];
export const lux41 = { ...realism, id: 'e2_lux41', len: 5100, height: 1700, paint: 'paint.l41', lowZ: 380,
  body: fillet([cd(352, 255), cd(348, 165, 80), cd(360, 100, 200), cd(400, 85, 150), cd(670, 75), cd(740, 12), cd(752, 2, 120), cd(1130, 2, 300), cd(1200, 70, 300), cd(1240, 130, 200), cd(1262, 170, 120), cd(1262, 240, 60), cd(1250, 255)]),
  arches: [{ x: FD, z: 365, r: 440 }], wheels: [{ x: FD }, { x: RD }], tire: '7.00-15', wheel: { style: 'hubcap', whitewall: 0.4 },
  fenders: [{ paint: 'paint.l41', wx: FD, wz: 365, wr: 440, smooth: 2, pts: [cd(352, 240), cd(355, 175), cd(380, 150), cd(430, 140), cd(500, 142), cd(570, 160), cd(630, 200), cd(660, 245), cd(662, 256), cd(560, 256), ...arc(FD, 365, 442, 442, 14, 166, 12), cd(354, 250)] },
            { paint: 'paint.l41', wx: RD, wz: 365, wr: 1, smooth: 2, pts: [cd(940, 256), cd(955, 210), cd(1000, 185), cd(1080, 175), cd(1170, 185), cd(1230, 210), cd(1248, 245), cd(1240, 252)] }],
  glass: [fillet([[...Cd(712, 92), 30], [...Cd(735, 30), 80], [...Cd(835, 30), 40], [...Cd(835, 92), 30]]), rrect(...Cd(855, 92), ...Cd(980, 30), 40), fillet([[...Cd(990, 92), 30], [...Cd(990, 30), 40], [...Cd(1050, 40), 200], [...Cd(1085, 92), 30]])],
  frame: 'chrome', doors: [[Cd(700, 96), Cd(702, 250)], [Cd(845, 96), Cd(845, 250)], [Cd(988, 96), Cd(990, 190)]],
  trim: [{ pts: [Cd(400, 96), Cd(1130, 96), Cd(1200, 110)], w: 2 }, ...[200, 207, 214].map(y => ({ pts: [Cd(560, y), Cd(655, y)], w: 1, onFender: 1 })), ...[196, 203, 210].map(y => ({ pts: [Cd(1180, y), Cd(1240, y)], w: 1, onFender: 1 })),
    { pts: [Cd(540, 122), Cd(660, 122)], w: 2 }, { pts: [Cd(700, 252), Cd(960, 252)], w: 2 }],
  parts: [{ pts: [Cd(346, 150), Cd(356, 150), Cd(356, 235), Cd(346, 235)], chrome: 1, behind: 1 }, { pts: [Cd(415, 85), Cd(445, 72), Cd(450, 76), Cd(422, 86)], chrome: 1 }],
  lamps: [{ e: [...Cd(362, 180), 30, 70], ramp: 'lensW', bezel: 'chrome' }, { e: [...Cd(1255, 185), 25, 45], ramp: 'lensR', bezel: 'chrome' }],
  bumperSets: [{ x0: -10, x1: 260, zs: [480], h: 110, clamp: 120, iron: [[200, 470], [430, 460]] }, { x0: 4870, x1: 5100, zs: [480], h: 110, clamp: 4980, iron: [[4750, 460], [4900, 470]] }],
  handles: [[...Cd(830, 98)], [...Cd(975, 98)]], under: chassisUnder({ F: FD, R: RD, r: 365, frameZ: 420, front: 300, rear: 4850, exhaustZ: 270 }) };

// ---- 1940 V12 continental-type coupe (WB 3175, 7.00-16 whitewall, rear-mounted spare) - front at right ----
const Ct = mk(540, 360, 9.92, true), ct = P(Ct); const FN = Ct(452.5, 0)[0], RN = Ct(132.5, 0)[0];
export const cont40 = { ...realism, id: 'e2_cont40', len: 5500, height: 1620, paint: 'paint.ct40', lowZ: 380,
  body: fillet([ct(532, 332), ct(530, 300, 80), ct(527, 255, 160), ct(515, 243, 80), ct(340, 247.5), ct(310, 217.5), ct(300, 203, 100), ct(195, 203, 220), ct(125, 232, 200), ct(70, 245, 150), ct(42, 280, 120), ct(36, 330, 60), ct(45, 333)]),
  arches: [{ x: FN, z: 385, r: 450 }], wheels: [{ x: FN }, { x: RN }], tire: '7.00-16', wheel: { style: 'hubcap', whitewall: 0.36 },
  fenders: [{ paint: 'paint.ct40', wx: FN, wz: 385, wr: 450, smooth: 2, pts: [ct(535, 315), ct(530, 270), ct(505, 255), ct(470, 252), ct(430, 258), ct(390, 272), ct(355, 300), ct(345, 332), ct(400, 333), ...arc(FN, 385, 452, 452, 14, 166, 12), ct(533, 325)] },
            { paint: 'paint.ct40', wx: RN, wz: 385, wr: 1, smooth: 2, pts: [ct(190, 333), ct(192, 290), ct(165, 272), ct(120, 268), ct(80, 278), ct(55, 300), ct(50, 330)] }],
  glass: [fillet([[...Ct(302.5, 252), 30], [...Ct(296, 215), 60], [...Ct(235, 212), 40], [...Ct(230, 252), 30]]), fillet([[...Ct(222, 252), 30], [...Ct(222, 220), 60], [...Ct(195, 222), 100], [...Ct(185, 252), 30]])],
  frame: 'chrome', doors: [[Ct(342, 255), Ct(345, 330)], [Ct(228, 255), Ct(225, 330)]],
  trim: [{ pts: [Ct(520, 258), Ct(340, 258)], w: 1 }, { pts: [Ct(340, 333), Ct(190, 333)], w: 2 }],
  parts: [{ pts: [Ct(527, 268), Ct(537, 268), Ct(537, 320), Ct(527, 320)], chrome: 1, behind: 1 }, { pts: fillet([[...Ct(52, 240), 60], [...Ct(30, 240), 60], [...Ct(30, 328), 60], [...Ct(52, 328), 60]]), ramp: 'rubber', base: 1 },
    { pts: fillet([[...Ct(50, 250), 40], [...Ct(33, 250), 40], [...Ct(33, 318), 40], [...Ct(50, 318), 40]]), chrome: 1 }],
  lamps: [{ e: [...Ct(528, 285), 30, 60], ramp: 'lensW', bezel: 'chrome' }, { e: [...Ct(62, 300), 22, 35], ramp: 'lensR', bezel: 'chrome' }],
  bumperSets: [{ x0: -10, x1: 220, zs: [460], h: 90, clamp: 100, iron: [[180, 450], [440, 440]] }, { x0: 5280, x1: 5500, zs: [460], h: 90, clamp: 5380, iron: [[5150, 440], [5300, 450]] }],
  handles: [[...Ct(318, 262)]], under: chassisUnder({ F: FN, R: RN, r: 385, frameZ: 440, front: 300, rear: 5250, exhaustZ: 270 }) };

// ---- 1940 3-ton conventional truck (WB ~4025, 7.50-20) ----
const Tk = mk(27.5, 187.5, 13.95), tk = P(Tk); const FT = Tk(79, 0)[0], RT = Tk(367.5, 0)[0];
export const truck40 = { ...realism, id: 'e2_truck40', len: 6750, height: 2450, paint: 'paint.t40', lowZ: 700,
  body: fillet([tk(32, 140), tk(32.5, 95, 80), tk(40, 80, 150), tk(142.5, 75), tk(150, 50), tk(160, 40, 60), tk(200, 40, 80), tk(205, 50), tk(205, 140)]),
  arches: [{ x: FT, z: 470, r: 520 }], wheels: [{ x: FT }, { x: RT }], tire: '7.50-20', wheel: { style: 'truck', paint: 'black' },
  fenders: [{ paint: 'paint.t40', wx: FT, wz: 470, wr: 520, smooth: 2, pts: [tk(30, 132), tk(35, 110), tk(55, 98), tk(79, 96), tk(105, 102), tk(125, 118), tk(145, 140), tk(150, 148), tk(110, 148), ...arc(FT, 470, 522, 522, 15, 165, 12), tk(30, 140)] },
            { paint: 'black', wx: RT, wz: 470, wr: 1, smooth: 1, pts: [tk(325, 120), tk(410, 120), tk(410, 126), tk(325, 126)] }],
  boards: [{ paint: 'rubber', pts: [Tk(145, 145), Tk(205, 145), Tk(205, 150), Tk(145, 150)] }],
  glass: [[Tk(146, 72), Tk(154, 50), Tk(157, 50), Tk(149, 72)], rrect(...Tk(160, 72), ...Tk(200, 50), 40)], frame: 'reveal', doors: [[Tk(156, 75), Tk(156, 145)], [Tk(201, 52), Tk(201, 145)]],
  louvres: [{ x0: Tk(60, 0)[0], x1: Tk(125, 0)[0], step: 70, z0: Tk(0, 100)[1], z1: Tk(0, 92)[1] }],
  parts: [{ pts: [Tk(220, 110), Tk(480, 110), Tk(480, 118), Tk(220, 118)], ramp: 'wood', base: 2 },                                    // bed floor
    ...[0, 1, 2].map(k => ({ pts: [Tk(220, 72 + k * 13), Tk(480, 72 + k * 13), Tk(480, 82 + k * 13), Tk(220, 82 + k * 13)], ramp: 'wood', base: 2 })),     // drop-side planks
    ...[222, 300, 390, 478].map(x => ({ pts: [Tk(x - 2, 70), Tk(x + 2, 70), Tk(x + 2, 112), Tk(x - 2, 112)], ramp: 'black', base: 1 })),
    { pts: [Tk(225, 120), Tk(285, 120), Tk(285, 128), Tk(225, 128)], ramp: 'paint.tank', base: 2, r: 60 },                              // fuel tank
    { pts: [Tk(212, 8), Tk(216, 8), Tk(216, 112), Tk(212, 112)], ramp: 'iron', base: 2 },                                                 // exhaust stack
    { pts: [Tk(31, 82), Tk(36, 82), Tk(36, 138), Tk(31, 138)], ramp: 'black', base: 1, behind: 1 }],
  lamps: [{ e: [...Tk(58, 95), 60, 90], ramp: 'lensW', bezel: 'chrome' }, { e: [...Tk(478, 118), 30, 30], ramp: 'lensR', bezel: 'chrome' }],
  bumperSets: [{ x0: -20, x1: 150, zs: [560], h: 110, iron: [[120, 560], [400, 580]] }],
  under: [{ band: [[200, 860], [6650, 860]], th: 200, ramp: 'black', lv: 1 }, ...[[FT, 720], [RT, 740]].map(([x, h]) => ({ band: [[x - 650, h + 40], [x, h - 20], [x + 650, h + 40]], th: 80, ramp: 'iron', lv: 2 })), { e: [RT, 470, 180, 160], ramp: 'iron', lv: 1 }, ...[3000, 4200, 5400, 6400].map(x => ({ pts: [[x - 40, 955], [x + 40, 955], [x + 40, 990], [x - 40, 990]], ramp: 'black', lv: 1 }))] };

export const CIVIL = [['1941 V8 LUXURY SEDAN', lux41], ['1940 V12 CONTINENTAL-TYPE COUPE', cont40], ['1942 FOUR-DOOR SEDAN', sedan42], ['1940 V8 COUPE', coupe40],
  ['1946 SMALL FOUR-DOOR', small46], ['1946 WOODY STATION WAGON', woody46], ['1940 HALF-TON PICKUP', pickup40], ['1940 3-TON TRUCK', truck40]];
