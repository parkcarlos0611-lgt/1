// E2 military: 1/4-ton 4x4 utility (MB-type) and 2-1/2-ton 6x6 cargo (CCKW-type), debadged. Side + front.
// Measured from user 4-views; specs: 4x4 WB 2032, 6.00-16, L 3360; 6x6 short WB 3683 (+1118 tandem), 7.50-20 duals.
const J = (x, y) => [(x - 5) * 7.26, (942 - y) * 7.26];
const jp = (x, y, r = 0) => [...J(x, y), r];
const FJ = J(80, 0)[0], RJ = J(360, 0)[0];
export const jeepSide = {
  len: 3450, height: 1800, paint: 'paint.od',
  wheels: [{ x: FJ, tire: '6.00-16' }, { x: RJ, tire: '6.00-16' }],
  chassis: [
    { band: [J(40, 880), J(452, 880)], th: 70, ramp: 'black', base: 1 },                                   // frame rail
    { band: [J(48, 893), J(80, 903), J(112, 893)], th: 45, ramp: 'black', base: 2 },                       // front leaf
    { band: [J(322, 893), J(360, 903), J(398, 893)], th: 45, ramp: 'black', base: 2 },                     // rear leaf
    { e: [J(92, 915)[0], J(92, 915)[1], 80, 70], ramp: 'OD', base: 1 }, { e: [J(360, 915)[0], J(360, 915)[1], 90, 75], ramp: 'OD', base: 1 },  // diffs
    { pts: [J(215, 885), J(260, 885), J(260, 905), J(215, 905)], ramp: 'OD', base: 1 },                   // transfer case
    { band: [J(150, 895), J(330, 898), J(440, 893)], th: 40, ramp: 'iron', base: 1 },                     // exhaust
    { pts: [J(250, 888), J(320, 888), J(320, 900), J(250, 900)], ramp: 'iron', base: 1 }],               // muffler
  panels: [
    { pts: [jp(197, 812), jp(445, 812), jp(447, 876), jp(200, 876)], cut: [[J(206, 811), J(296, 811), J(296, 836, 40), J(214, 836, 40)], { circle: [RJ, J(0, 915)[1], 470] }], base: 2, rivets: 2 },  // tub with side cut-out
    { pts: [jp(40, 860), jp(46, 820), jp(192, 821), jp(197, 860), jp(130, 860), jp(120, 840), jp(70, 840), jp(55, 860)], base: 2 },     // flat front fender
    { pts: [jp(42, 792), jp(197, 795), jp(197, 812), jp(42, 812)], base: 3 },                            // hood (top face lit)
    { pts: [jp(42, 812), jp(197, 812), jp(197, 822), jp(42, 822)], base: 2 },                            // hood side
    { pts: [jp(38, 792), jp(43, 792), jp(43, 870), jp(38, 870)], base: 1 }],                             // grille face edge
  glass: [[J(205, 793), J(222, 730), J(226, 730), J(209, 793)]],
  details: [
    { pts: [J(198, 796), J(203, 796), J(224, 718), J(219, 718)], ramp: 'OD', base: 2 },                  // windshield frame (folded up)
    { pts: [J(214, 718), J(232, 718), J(232, 724), J(214, 724)], ramp: 'OD', base: 2 },
    { band: [J(233, 805), J(245, 778)], th: 30, ramp: 'black' }, { e: [J(247, 776)[0], J(247, 776)[1], 22, 120], ramp: 'black', base: 1 },   // steering
    { pts: [J(300, 812), J(304, 786), J(322, 786), J(322, 812)], ramp: 'canvasOD', base: 2, r: 20 },  // seat back
    { pts: [J(448, 762), J(472, 762), J(472, 872), J(448, 872)], ramp: 'rubber', base: 1, r: 60 },     // spare (edge-on)
    { pts: [J(472, 805), J(478, 805), J(478, 830), J(472, 830)], ramp: 'OD', base: 2 },
    { pts: [J(3, 862), J(45, 862), J(45, 876), J(3, 876)], ramp: 'OD', base: 2 },                        // C-channel bumper
    { band: [J(8, 868), J(2, 878)], th: 30, ramp: 'black' },                                              // tow shackle
    { pts: [J(447, 866), J(462, 866), J(462, 878), J(447, 878)], ramp: 'black', base: 1 },               // pintle hook
    { e: [J(41, 822)[0], J(41, 822)[1], 25, 45], ramp: 'black', base: 1 }, { e: [J(64, 816)[0], J(64, 816)[1], 25, 18], ramp: 'black', base: 1 },   // headlamp lip, blackout lamp
    { band: [J(222, 852), J(296, 852)], th: 26, ramp: 'wood' }, { pts: [J(296, 846), J(306, 846), J(306, 860), J(296, 860)], ramp: 'iron', base: 2 },  // shovel
    { band: [J(226, 860), J(286, 860)], th: 22, ramp: 'wood' }, { pts: [J(286, 856), J(292, 856), J(292, 866), J(286, 866)], ramp: 'iron', base: 2 }, // axe
    { e: [J(446, 845)[0], J(446, 845)[1], 22, 22], ramp: 'lensR', base: 1 }],
  stencils: [{ type: 'text', x: J(80, 806)[0], z: J(80, 806)[1], n: 7 }],
};

const K = (x, y) => [(x - 15) * 21.4, (106 - y) * 21.4];
const kp = (x, y, r = 0) => [...K(x, y), r];
const FK = K(67, 0)[0], R1 = K(213.75, 0)[0], R2 = K(265, 0)[0];
const cckwBase = {
  len: 6450, height: 2900, paint: 'paint.od',
  wheels: [{ x: FK, tire: '7.50-20' }, { x: R1, tire: '7.50-20', dual: 1 }, { x: R2, tire: '7.50-20', dual: 1 }],
  chassis: [
    { band: [K(18, 72), K(304, 72)], th: 190, ramp: 'black', base: 1 },
    { band: [K(46, 69), K(67, 74), K(88, 69)], th: 70, ramp: 'black', base: 2 },
    { band: [K(204, 72), K(239.4, 77), K(274, 72)], th: 90, ramp: 'black', base: 2 },                  // walking-beam spring
    { e: [FK, K(0, 86)[1], 150, 120], ramp: 'OD', base: 1 }, { e: [R1, K(0, 86)[1], 150, 120], ramp: 'OD', base: 1 }, { e: [R2, K(0, 86)[1], 150, 120], ramp: 'OD', base: 1 },
    { pts: [K(116, 63), K(142, 63), K(142, 73), K(116, 73)], ramp: 'OD', base: 1, r: 100 },             // fuel tank
    { band: [K(95, 80), K(200, 82), K(300, 80)], th: 60, ramp: 'iron', base: 1 }],
  panels: [
    { pts: [kp(30, 72), kp(37, 55, 120), kp(52, 46, 160), kp(82, 47, 160), kp(96, 56, 100), kp(104, 72), kp(104, 80), kp(30, 80)], cut: [{ circle: [FK, K(0, 85.4)[1], 520] }], base: 2 },  // front fender
    { pts: [kp(40, 36, 60), kp(102.5, 30), kp(102.5, 72), kp(40, 75)], base: 2, rivets: 2 },            // hood side
    { pts: [kp(40, 34, 40), kp(102.5, 28), kp(102.5, 31), kp(40, 37)], base: 3 },                      // hood top
    { pts: [kp(102.5, 75), kp(102.5, 30), kp(107, 10), kp(112, 4, 40), kp(150, 4, 60), kp(153.75, 10), kp(153.75, 75)], base: 2, rivets: 2 },   // cab
    { pts: [kp(105, 80), kp(153.75, 80), kp(153.75, 84), kp(105, 84)], ramp: 'black', base: 1 },      // running board
    { pts: [kp(173.75, 57.5), kp(303.75, 57.5), kp(303.75, 63), kp(173.75, 63)], base: 1 },            // bed floor
    { pts: [kp(196, 63), kp(232, 63), kp(232, 66), kp(196, 66)], base: 1 }, { pts: [kp(246, 63), kp(282, 63), kp(282, 66), kp(246, 66)], base: 1 }],
  glass: [[K(112, 11), K(150, 11), K(150, 29), K(112, 29)], [K(104, 30), K(108, 11), K(110, 11), K(106, 30)]],
  details: [
    { pts: [K(14, 68), K(28, 68), K(28, 80), K(14, 80)], ramp: 'OD', base: 2 }, { band: [K(15, 74), K(10, 80)], th: 60, ramp: 'black' },   // bumper + tow hook
    { pts: [K(36, 36), K(40, 36), K(40, 76), K(36, 76)], ramp: 'OD', base: 1 },                         // brush guard
    { e: [K(46, 46)[0], K(46, 46)[1], 90, 100], ramp: 'OD', base: 2 }, { e: [K(43, 46)[0], K(43, 46)[1], 35, 85], ramp: 'black', base: 1 },   // headlamp on fender
    { pts: [K(160, 3), K(172, 3), K(172, 62), K(160, 62)], ramp: 'rubber', base: 1, r: 120 },           // spare behind cab
    { pts: [K(155, 2), K(160, 2), K(160, 72), K(155, 72)], ramp: 'OD', base: 1 },
    { pts: [K(126, 60), K(140, 60), K(140, 64), K(126, 64)], ramp: 'OD', base: 3 },                     // step
    { pts: [K(300, 66), K(306, 66), K(306, 72), K(300, 72)], ramp: 'black', base: 1 },                  // pintle
    { e: [K(301, 50)[0], K(301, 50)[1], 40, 40], ramp: 'lensR', base: 1 },
    { band: [K(104, 34), K(104, 6)], th: 30, ramp: 'black' }, { pts: [K(95, 4), K(104, 4), K(104, 8), K(95, 8)], ramp: 'black', base: 2 }],  // mirror arm
  stencils: [{ type: 'star', x: K(127, 47)[0], z: K(127, 47)[1], r: 190 }, { type: 'text', x: K(55, 40)[0], z: K(55, 40)[1], n: 8 }],
};
export const cckwCargo = { ...cckwBase, slats: [{ x0: K(174, 0)[0], x1: K(303.75, 0)[0], z0: K(0, 57.5)[1], z1: K(0, 7.5)[1], n: 6, stakes: [176, 205, 240, 270, 301].map(x => K(x, 0)[0]) }] };
export const cckwCanvas = { ...cckwBase, slats: [{ x0: K(174, 0)[0], x1: K(303.75, 0)[0], z0: K(0, 57.5)[1], z1: K(0, 38)[1], n: 3, stakes: [176, 240, 301].map(x => K(x, 0)[0]) }],
  canvas: [{ pts: [K(172, 38), K(172, -6), K(178, -12), K(300, -12), K(306, -6), K(306, 38)], r: 120 }], height: 3050 };

// ---------- front views (x = lateral position + half width) ----------
const sym = (half, w) => { const L = half.map(([y, z, r]) => [w / 2 + y, z, r]); const Rr = half.slice().reverse().map(([y, z, r]) => [w / 2 - y, z, r]); return L.concat(Rr); };
const both = (pts, w) => [pts.map(([y, z, r]) => [w / 2 + y, z, r]), pts.map(([y, z, r]) => [w / 2 - y, z, r])];
const WJ = 1700;
export const jeepFront = { len: WJ, height: 1800, paint: 'paint.od',
  wheels: [], chassis: [{ band: [[WJ / 2 - 560, 380], [WJ / 2 + 560, 380]], th: 80, ramp: 'black' }, { e: [WJ / 2 + 140, 380, 130, 120], ramp: 'OD', base: 1 }, { band: [[WJ / 2 - 500, 470], [WJ / 2 + 500, 470]], th: 40, ramp: 'iron' }],
  panels: [
    ...both([[560, 0, 40], [760, 0, 40], [760, 700, 60], [560, 700, 60]], WJ).map(pts => ({ pts, ramp: 'rubber', base: 1 })),                // NDT tyres seen head-on
    ...both([[330, 860], [790, 860], [790, 925], [330, 925]], WJ).map(pts => ({ pts, base: 3 })),            // flat fender tops
    ...both([[330, 700], [780, 700], [790, 860], [330, 860]], WJ).map(pts => ({ pts, base: 1 })),            // fender front faces
    { pts: sym([[0, 480], [330, 480], [330, 1090], [0, 1090]], WJ), base: 2 },                                   // grille face
    { pts: sym([[0, 1090], [330, 1090], [330, 1110], [0, 1110]], WJ), base: 3 },                                 // hood front edge
    { pts: sym([[0, 440], [800, 440], [820, 540], [0, 540]], WJ), base: 2 },                                     // bumper channel
    { pts: [[WJ / 2 - 640, 1100], [WJ / 2 + 640, 1100], [WJ / 2 + 640, 1660], [WJ / 2 - 640, 1660]], base: 2 }],   // windscreen frame (glass drawn on top)
  glass: [[[WJ / 2 - 600, 1140], [WJ / 2 - 30, 1140], [WJ / 2 - 30, 1600], [WJ / 2 - 600, 1600]], [[WJ / 2 + 30, 1140], [WJ / 2 + 600, 1140], [WJ / 2 + 600, 1600], [WJ / 2 + 30, 1600]]],
  details: [
    ...Array.from({ length: 8 }, (_, k) => ({ pts: (y => [[WJ / 2 + y - 22, 560], [WJ / 2 + y + 22, 560], [WJ / 2 + y + 22, 1020], [WJ / 2 + y - 22, 1020]])(-280 + k * 80), ramp: 'black', base: 0, r: 20 })),  // stamped slots
    ...both([[150, 790], [250, 790], [250, 890], [150, 890]], WJ).map(pts => ({ pts, ramp: 'lensW', base: 1, r: 50 })),                       // inset headlamps
    ...both([[540, 925], [600, 925], [600, 965], [540, 965]], WJ).map(pts => ({ pts, ramp: 'black', base: 1 })),                            // blackout lamps
    ...both([[740, 470], [800, 470], [800, 530], [740, 530]], WJ).map(pts => ({ pts, ramp: 'black', base: 1 }))],
  stencils: [{ type: 'text', x: WJ / 2 - 120, z: 500, n: 6 }] };
const WK = 2400;
export const cckwFront = { len: WK, height: 2300, paint: 'paint.od',
  wheels: [], chassis: [{ band: [[WK / 2 - 760, 440], [WK / 2 + 760, 440]], th: 110, ramp: 'black' }, { e: [WK / 2 - 120, 440, 170, 150], ramp: 'OD', base: 1 }],
  panels: [
    ...both([[720, 0, 50], [960, 0, 50], [960, 880, 80], [720, 880, 80]], WK).map(pts => ({ pts, ramp: 'rubber', base: 1 })),
    { pts: sym([[0, 1500], [900, 1500], [900, 2120, 80], [820, 2190, 60], [0, 2190]], WK), base: 2, rivets: 2 },                      // cab front
    ...both([[560, 860], [560, 1180, 160], [760, 1270, 120], [1120, 1230, 80], [1130, 860]], WK).map(pts => ({ pts, base: 2 })),     // fenders
    { pts: sym([[0, 860], [340, 860], [340, 1500], [0, 1500]], WK), base: 2 },                                                      // grille housing
    { pts: sym([[0, 680], [1110, 680], [1110, 860], [0, 860]], WK), base: 2 }],                                                     // bumper
  glass: [[[WK / 2 - 820, 1660], [WK / 2 - 50, 1660], [WK / 2 - 50, 2070], [WK / 2 - 820, 2070]], [[WK / 2 + 50, 1660], [WK / 2 + 820, 1660], [WK / 2 + 820, 2070], [WK / 2 + 50, 2070]]],
  details: [
    { pts: [[WK / 2 - 300, 900], [WK / 2 + 300, 900], [WK / 2 + 300, 1460], [WK / 2 - 300, 1460]], ramp: 'black', base: 0 },        // radiator mesh
    ...Array.from({ length: 6 }, (_, k) => ({ band: [[WK / 2 - 300 + k * 120, 880], [WK / 2 - 300 + k * 120, 1480]], th: 30, ramp: 'OD' })),   // brush-guard bars
    ...both([[620, 1180], [790, 1180], [790, 1350], [620, 1350]], WK).map(pts => ({ pts, ramp: 'lensW', base: 1, r: 80 })),
    ...both([[1000, 700], [1080, 700], [1080, 840], [1000, 840]], WK).map(pts => ({ pts, ramp: 'black', base: 1 }))],
  stencils: [{ type: 'text', x: WK / 2 - 200, z: 780, n: 8 }] };
