// E2 military v2 (debadged): 1/4-ton 4x4 utility and 2-1/2-ton 6x6, re-measured on the dimensioned references.
// 4x4: L 3330, WB 2032 (ref side view: 10.31 mm/px). 6x6: long WB 4166 to bogie centre, bogie 1118-1208 (ref: 15.9 mm/px).
// Layers: chassis (frame, springs, axles, shafts, exhaust) -> wheels -> interior (seats, dash, levers, far wall) -> body panels
// -> canvas -> glass (shared period glass) -> hardware -> stencils.  Materials: painted steel / canvas / rubber / wood / glass.

// ---------------- 1/4-ton 4x4 ----------------
const J = (x, y) => [(x - 2) * 10.31, (135 - y) * 10.31];
const jp = (x, y, r = 0) => [...J(x, y), r];
const FJ = J(51, 0)[0], RJ = J(248, 0)[0];
const jeepBase = {
  len: 3450, height: 1900, paint: 'paint.od',
  wheels: [{ x: FJ, tire: '6.00-16' }, { x: RJ, tire: '6.00-16' }],
  chassis: [
    { band: [J(6, 92), J(26, 98), J(316, 98)], th: 95, ramp: 'black', base: 1 },                                          // frame rail (front horn up to bumper)
    { band: [J(27, 103), J(51, 108), J(75, 103)], th: 42, ramp: 'black', base: 2 }, { band: [J(222, 103), J(248, 108), J(274, 103)], th: 42, ramp: 'black', base: 2 },   // leaf springs
    { band: [J(27, 103), J(25, 96)], th: 25, ramp: 'iron' }, { band: [J(274, 103), J(277, 96)], th: 25, ramp: 'iron' },        // shackles
    { e: [...J(60, 104), 95, 80], ramp: 'OD', base: 1 }, { e: [...J(257, 104), 105, 85], ramp: 'OD', base: 1 },             // axle housings / diffs (offset)
    { pts: [J(62, 88), J(108, 88), J(110, 102), J(64, 102)], ramp: 'OD', base: 1, r: 40 },                                 // engine sump + bell housing below the fender
    { pts: [J(112, 96), J(140, 96), J(140, 106), J(112, 106)], ramp: 'OD', base: 1 },                                       // gearbox
    { pts: [J(140, 98), J(168, 98), J(168, 112), J(140, 112)], ramp: 'OD', base: 2 },                                       // 2-speed transfer case
    { band: [J(140, 108), J(62, 105)], th: 35, ramp: 'iron', base: 2 }, { band: [J(168, 108), J(250, 104)], th: 35, ramp: 'iron', base: 2 },   // front / rear prop shafts
    { band: [J(100, 100), J(170, 113), J(300, 111), J(318, 104)], th: 38, ramp: 'iron', base: 1 },                          // exhaust
    { pts: [J(176, 108), J(214, 108), J(214, 116), J(176, 116)], ramp: 'iron', base: 1, r: 30 }],                           // muffler
  inner: [
    { pts: [J(176, 40), J(189, 40), J(191, 58), J(178, 58)], ramp: 'canvasOD', base: 2, r: 30 },                            // front seat back (canvas)
    { pts: [J(258, 33), J(272, 33), J(273, 48), J(259, 48)], ramp: 'canvasOD', base: 2, r: 30 },                            // rear seat back
    { pts: [J(126, 30), J(133, 30), J(133, 60), J(126, 60)], ramp: 'OD', base: 1 },                                         // dash panel (edge-on)
    { band: [J(148, 62), J(144, 50)], th: 22, ramp: 'black' }, { e: [...J(144, 49), 28, 28], ramp: 'black', base: 2 },    // gear lever + knob
    { band: [J(156, 62), J(158, 53)], th: 18, ramp: 'black' }, { band: [J(161, 62), J(164, 55)], th: 18, ramp: 'black' }, // transfer levers
    { band: [J(216, 30), J(298, 30)], th: 60, ramp: 'canvasOD', base: 1 }],                                                 // folded top + bows on the rear deck
  panels: [
    // tub: cowl side, lowered entry edge, rear quarter, flat-topped trapezoid rear arch
    { pts: [jp(88, 50), jp(130, 50), jp(130, 57), jp(197, 57, 40), jp(213, 47, 40), jp(300, 47, 20), jp(300, 93), jp(110, 93)],
      cut: [[J(203, 94), J(206, 74), J(221, 56), J(277, 56), J(292, 74), J(295, 94)]], base: 2, rivets: 2 },
    { pts: [jp(110, 93), jp(200, 93), jp(200, 97), jp(110, 97)], ramp: 'OD', base: 1 },                                     // floor pan edge / sill
    // flat front fender: horizontal shelf, short vertical lip, sloped rear apron down to the floor
    { pts: [jp(25, 47, 20), jp(89, 47), jp(113, 92), jp(103, 92), jp(85, 58), jp(30, 58, 20), jp(25, 54)], base: 2 },
    { pts: [jp(26, 46), jp(89, 46), jp(89, 49), jp(26, 49)], base: 3 },                                                     // fender top face (lit)
    { pts: [jp(26, 31), jp(131, 31), jp(131, 50), jp(26, 50)], base: 2, rivets: 0 },                                        // hood side
    { pts: [jp(26, 29), jp(131, 29), jp(131, 32), jp(26, 32)], base: 3 },                                                   // hood top face
    { pts: [jp(22, 30), jp(27, 30), jp(27, 92), jp(22, 92)], base: 1 }],                                                    // grille shell edge
  details: [
    { band: [J(129.5, 31), J(133, -26)], th: 48, ramp: 'OD', base: 2 }, { band: [J(131, -26), J(138, -26)], th: 40, ramp: 'OD', base: 2 },   // windshield frame (up) seen edge-on
    { pts: [J(127, 33), J(134, 33), J(134, 37), J(127, 37)], ramp: 'iron', base: 2 },                                        // screen hinge/clamp
    { band: [J(166, 21), J(136, 56)], th: 40, ramp: 'black', base: 1 }, { band: [J(153, 5), J(181, 35)], th: 34, ramp: 'black', base: 2 },   // steering column + rim (raked)
    { pts: [J(33, 39), J(45, 39), J(45, 47), J(33, 47)], ramp: 'OD', base: 2, r: 30 }, { pts: [J(43, 41), J(46, 41), J(46, 45), J(43, 45)], ramp: 'lensW', base: 1 },   // blackout marker on the fender
    { pts: [J(2, 80), J(26, 80), J(26, 90), J(2, 90)], ramp: 'OD', base: 2 }, { band: [J(8, 86), J(3, 95)], th: 30, ramp: 'black' },          // C-channel bumper + tow hook
    { pts: [J(302, 12), J(326, 12), J(326, 88), J(302, 88)], ramp: 'rubber', base: 1, r: 120 }, { pts: [J(306, 46), J(322, 46), J(322, 54), J(306, 54)], ramp: 'OD', base: 2 },   // spare (edge-on) + carrier
    { pts: [J(296, 66), J(301, 66), J(301, 72), J(296, 72)], ramp: 'lensR', base: 2 }, { pts: [J(296, 74), J(301, 74), J(301, 78), J(296, 78)], ramp: 'black', base: 1 },   // tail + blackout tail
    { pts: [J(300, 98), J(312, 98), J(312, 106), J(300, 106)], ramp: 'black', base: 1 },                                     // pintle hook
    { band: [J(228, 51), J(254, 51)], th: 22, ramp: 'OD', base: 2 },                                                         // grab handle
    { band: [J(116, 66), J(186, 66)], th: 26, ramp: 'wood' }, { pts: [J(186, 62), J(196, 62), J(196, 72), J(186, 72)], ramp: 'iron', base: 2 },   // shovel
    { band: [J(122, 77), J(178, 77)], th: 22, ramp: 'wood' }, { pts: [J(178, 73), J(184, 73), J(184, 82), J(178, 82)], ramp: 'iron', base: 2 },  // axe
    { pts: [J(120, 60), J(126, 60), J(126, 64), J(120, 64)], ramp: 'black', base: 1 }],                                      // tool clamp
  stencils: [{ type: 'text', x: J(40, 40)[0], z: J(40, 40)[1], n: 7 }, { type: 'star', x: J(250, 72)[0], z: J(250, 72)[1], r: 110 }],
};
export const jeepSide = { ...jeepBase };
// canvas top up: windshield header -> bows -> rear tub; rear curtain window (celluloid) shows in side view as a sliver
export const jeepTop = { ...jeepBase, inner: jeepBase.inner.filter(d => d.ramp !== 'canvasOD' || d.band == null),
  canvas: [{ pts: [J(133, -27), J(140, -37), J(290, -37), J(302, -28), J(304, 47), J(214, 47), J(197, 57), J(178, 57), J(178, 10), J(150, -2), J(136, -2)], r: 80, bow: 520 }],
  celluloid: [[J(292, -22), J(300, -22), J(300, 8), J(293, 8)]] };

// ---------------- 2-1/2-ton 6x6 ----------------
const G = (x, y) => [(x - 15) * 15.9, (163 - y) * 15.9];
const gp = (x, y, r = 0) => [...G(x, y), r];
const FK = G(52, 0)[0], R1 = G(276, 0)[0], R2 = G(352, 0)[0], BX0 = G(172, 0)[0], BX1 = G(415, 0)[0];
const chassis6 = [
  { band: [G(17, 112), G(30, 112), G(415, 112)], th: 170, ramp: 'black', base: 1 },                                             // channel frame
  { band: [G(28, 117), G(52, 122), G(76, 117)], th: 70, ramp: 'black', base: 2 },                                               // front leaf
  { band: [G(262, 115), G(314, 121), G(366, 115)], th: 95, ramp: 'black', base: 2 }, { pts: [G(306, 112), G(322, 112), G(322, 126), G(306, 126)], ramp: 'black', base: 2 },   // inverted spring + trunnion (walking beam)
  { band: [G(276, 128), G(352, 128)], th: 45, ramp: 'black', base: 1 },                                                         // torque rods
  { e: [FK + 120, ...G(0, 133).slice(1), 150, 120], ramp: 'OD', base: 1 }, { e: [R1, ...G(0, 133).slice(1), 160, 125], ramp: 'OD', base: 1 }, { e: [R2, ...G(0, 133).slice(1), 160, 125], ramp: 'OD', base: 1 },
  { pts: [G(60, 104), G(104, 104), G(106, 120), G(62, 120)], ramp: 'OD', base: 1, r: 60 },                                       // engine sump + bell housing
  { pts: [G(118, 112), G(140, 112), G(140, 124), G(118, 124)], ramp: 'OD', base: 1 }, { pts: [G(160, 116), G(180, 116), G(180, 128), G(160, 128)], ramp: 'OD', base: 2 },   // gearbox, transfer
  { band: [G(160, 124), G(76, 126)], th: 50, ramp: 'iron', base: 2 }, { band: [G(180, 124), G(276, 128)], th: 50, ramp: 'iron', base: 2 }, { band: [G(282, 128), G(352, 128)], th: 45, ramp: 'iron', base: 1 },   // 3 prop shafts
  { band: [G(105, 118), G(200, 126), G(270, 124)], th: 55, ramp: 'iron', base: 1 }, { pts: [G(196, 120), G(240, 120), G(240, 129), G(196, 129)], ramp: 'iron', base: 1, r: 40 }];   // exhaust + muffler
const front6 = [
  { pts: [gp(30, 62, 40), gp(108, 55), gp(108, 100), gp(30, 101)], base: 2 },                                                  // hood side
  { pts: [gp(30, 60, 40), gp(108, 53), gp(108, 57), gp(30, 64)], base: 3 },                                                    // hood top face
  { pts: [gp(24, 62), gp(31, 62), gp(31, 106), gp(24, 106)], base: 1 },
  { pts: [gp(14, 116), gp(18, 104, 30), gp(30, 97, 60), gp(84, 97, 60), gp(98, 103, 40), gp(108, 121), gp(92, 125), gp(20, 125)], cut: [{ circle: [FK, 435, 470] }], base: 2 }];   // crowned front fender (civil-type, matte) drawn over the hood skirt
const hood6 = [{ pts: [G(60, 70), G(102, 66), G(102, 92), G(60, 94)], ramp: 'OD', base: 1, louvres: true }];
const det6 = [
  { pts: [G(12, 104), G(28, 104), G(28, 118), G(12, 118)], ramp: 'OD', base: 2 }, { band: [G(14, 112), G(9, 120)], th: 60, ramp: 'black' },   // C-channel bumper + tow hook
  { band: [G(19, 60), G(19, 104)], th: 45, ramp: 'OD', base: 1 },                                                              // brush guard post
  { e: [...G(31, 93), 115, 110], ramp: 'OD', base: 2 }, { e: [...G(27, 93), 40, 95], ramp: 'lensW', base: 1 },                // headlamp pod on the fender
  ...[66, 72, 78, 84, 90, 96].map(x => ({ band: [G(x, 70), G(x, 92)], th: 22, ramp: 'black', base: 0 })),                      // hood side louvres
  { pts: [G(102, 120), G(172, 120), G(172, 124), G(102, 124)], ramp: 'black', base: 1 },                                       // running board
  { pts: [G(120, 112), G(158, 112), G(158, 121), G(120, 121)], ramp: 'OD', base: 1, r: 80 },                                   // fuel tank under the cab
  { pts: [G(405, 112), G(415, 112), G(415, 118), G(405, 118)], ramp: 'black', base: 1 }, { e: [...G(412, 100), 45, 45], ramp: 'lensR', base: 1 }];   // pintle, tail lamp
// cab variants
const cabClosed = {
  panels: [{ pts: [gp(108, 100), gp(108, 55), gp(113, 24, 50), gp(118, 18, 80), gp(166, 18, 80), gp(170, 26, 40), gp(170, 120), gp(106, 120)], base: 2, rivets: 2 }],
  glass: [[G(116, 25), G(160, 25), G(160, 52), G(116, 52)], [G(109, 52), G(112, 26), G(114, 26), G(111, 52)]],
  inner: [], det: [{ band: [G(113, 30), G(113, 118)], th: 18, ramp: 'black', base: 0 }, { band: [G(162, 30), G(162, 118)], th: 18, ramp: 'black', base: 0 }, { pts: [G(150, 60), G(157, 60), G(157, 62), G(150, 62)], ramp: 'iron', base: 3 }, { band: [G(108, 50), G(100, 20)], th: 30, ramp: 'black' }, { pts: [G(96, 18), G(104, 18), G(104, 28), G(96, 28)], ramp: 'black', base: 2 },   // mirror
    { pts: [G(172, 20), G(184, 20), G(184, 100), G(172, 100)], ramp: 'rubber', base: 1, r: 160 }, { pts: [G(170, 55), G(173, 55), G(173, 65), G(170, 65)], ramp: 'OD', base: 2 }],   // spare behind the cab
  wiG: { belt: 52 } };
const cabOpen = {
  panels: [{ pts: [gp(108, 100), gp(108, 56), gp(112, 75, 40), gp(166, 75, 40), gp(170, 66), gp(170, 120), gp(106, 120)], base: 2, rivets: 2 }],   // cut-down doors
  glass: [], inner: [{ pts: [G(136, 50), G(149, 50), G(150, 76), G(137, 76)], ramp: 'canvasOD', base: 2, r: 40 }, { pts: [G(112, 70), G(170, 70), G(170, 76), G(112, 76)], ramp: 'OD', base: 1 }, { pts: [G(108, 55), G(114, 55), G(114, 80), G(108, 80)], ramp: 'OD', base: 1 },
    { band: [G(124, 70), G(118, 52)], th: 30, ramp: 'black' }],
  canvas: [{ pts: [G(109, 18), G(171, 18), G(171, 23), G(109, 23)], r: 20, bow: 2000 }, { pts: [G(150, 23), G(171, 23), G(171, 58), G(152, 58)], r: 30, bow: 2000 }],   // soft roof + rear-quarter curtain
  celluloid: [[G(155, 30), G(167, 30), G(167, 44), G(156, 44)]],
  det: [{ band: [G(108.5, 56), G(110.5, 19)], th: 45, ramp: 'OD', base: 2 }, { band: [G(170, 22), G(170, 66)], th: 40, ramp: 'OD', base: 1 },   // windshield post, rear bow post
    { band: [G(138, 47), G(128, 60)], th: 26, ramp: 'black', base: 2 }, { band: [G(132, 64), G(112, 72)], th: 40, ramp: 'black', base: 1 },    // wheel rim (raked), column
    { band: [G(108, 50), G(100, 22)], th: 30, ramp: 'black' }, { pts: [G(96, 20), G(104, 20), G(104, 30), G(96, 30)], ramp: 'black', base: 2 }] };
// equipment modules on the common chassis (bed x 172..415)
const bedBox = [{ pts: [gp(172, 75), gp(415, 75), gp(415, 104), gp(172, 104)], base: 2, rivets: 2 }, { pts: [gp(172, 103), gp(415, 103), gp(415, 108), gp(172, 108)], ramp: 'OD', base: 1 },
  ...[190, 222, 254, 286, 318, 350, 382].map(x => ({ pts: [gp(x, 76), gp(x + 3, 76), gp(x + 3, 103), gp(x, 103)], base: 3 }))];       // pressed side + stake pockets
const stakes = [174, 212, 252, 292, 332, 372, 412];
const MOD = {
  cargo: { panels: bedBox, slats: [{ x0: BX0, x1: BX1, z0: G(0, 76)[1], z1: G(0, 28)[1], n: 3, ramp: 'wood', stakes: stakes.map(x => G(x, 0)[0]) }],
    inner: [{ pts: [G(176, 60), G(410, 60), G(410, 76), G(176, 76)], ramp: 'woodDark', base: 1 }] },                        // folded troop seat backs (inside rack)
  canvas: { panels: bedBox, slats: [{ x0: BX0, x1: BX1, z0: G(0, 76)[1], z1: G(0, 50)[1], n: 2, ramp: 'wood', stakes: stakes.map(x => G(x, 0)[0]) }],
    canvas: [{ pts: [G(170, 62), G(170, 2), G(178, -8), G(410, -8), G(418, 2), G(418, 62)], r: 140, bow: 760, seams: [G(0, 30)[1]] }] },
  launcher: { panels: bedBox, inner: [],
    det: [      ...[0, 1, 2, 3].map(k => ({ band: [G(395, 40 - k * 5), G(160, 8 - k * 5)], th: 45, ramp: k % 2 ? 'iron' : 'OD', base: 2 })),           // launch rails (stowed over the cab)
      ...[250, 330].map(x => ({ band: [G(x, 75), G(x, 22 - (x - 160) * 0.136)], th: 55, ramp: 'OD', base: 1 })), { band: [G(250, 60), G(330, 60)], th: 40, ramp: 'OD', base: 1 },   // rail supports on the bed
      { pts: [G(386, 20), G(404, 20), G(404, 74), G(386, 74)], ramp: 'OD', base: 2 }] },                                      // blast shield
  tanker: { panels: [{ pts: [gp(176, 50, 220), gp(410, 50, 220), gp(410, 104, 120), gp(176, 104, 120)], base: 2 }, ...[230, 300, 370].map(x => ({ pts: [gp(x, 48), gp(x + 6, 48), gp(x + 6, 106), gp(x, 106)], base: 1 }))],
    det: [{ pts: [G(280, 42), G(300, 42), G(300, 50), G(280, 50)], ramp: 'OD', base: 3 }, { pts: [G(395, 98), G(420, 98), G(420, 106), G(395, 106)], ramp: 'black', base: 1 }] },
};
export function cckw({ cab = 'closed', module = 'cargo' } = {}) {
  const C = cab === 'open' ? cabOpen : cabClosed, Mo = MOD[module];
  return { len: 6700, height: module === 'canvas' || module === 'launcher' ? 2950 : 2750, ox: 160, paint: 'paint.od',
    wheels: [{ x: FK, tire: '7.50-20' }, { x: R1, tire: '7.50-20', dual: 1 }, { x: R2, tire: '7.50-20', dual: 1 }],
    chassis: chassis6, inner: [...C.inner, ...(Mo.inner || [])], panels: [...front6, ...C.panels, ...Mo.panels], slats: Mo.slats || [], canvas: [...(C.canvas || []), ...(Mo.canvas || [])],
    glass: C.glass, celluloid: C.celluloid || [], details: [...det6, ...C.det, ...(Mo.det || [])],
    stencils: [{ type: 'star', x: G(140, 92)[0], z: G(140, 92)[1], r: 190 }, { type: 'text', x: G(40, 80)[0], z: G(40, 80)[1], n: 8 }] };
}
export const cckwCargo = cckw({ cab: 'closed', module: 'cargo' });
export const cckwCanvas = cckw({ cab: 'open', module: 'canvas' });

// ---------- front views (x = lateral position + half width) ----------
const sym = (half, w) => { const L = half.map(([y, z, r]) => [w / 2 + y, z, r]); const Rr = half.slice().reverse().map(([y, z, r]) => [w / 2 - y, z, r]); return L.concat(Rr); };
const both = (pts, w) => [pts.map(([y, z, r]) => [w / 2 + y, z, r]), pts.map(([y, z, r]) => [w / 2 - y, z, r])];
const WJ = 1700;
export const jeepFront = { len: WJ, height: 1800, paint: 'paint.od',
  wheels: [], chassis: [{ band: [[WJ / 2 - 560, 380], [WJ / 2 + 560, 380]], th: 80, ramp: 'black' }, { e: [WJ / 2 + 140, 380, 130, 120], ramp: 'OD', base: 1 }, { band: [[WJ / 2 - 500, 470], [WJ / 2 + 500, 470]], th: 40, ramp: 'iron' }],
  inner: [{ pts: [[WJ / 2 - 600, 1140], [WJ / 2 + 600, 1140], [WJ / 2 + 600, 1300], [WJ / 2 - 600, 1300]], ramp: 'OD', base: 1 },                // dash seen through the screen
    { pts: [[WJ / 2 - 520, 1150], [WJ / 2 - 80, 1150], [WJ / 2 - 80, 1420], [WJ / 2 - 520, 1420]], ramp: 'canvasOD', base: 1, r: 60 }, { pts: [[WJ / 2 + 80, 1150], [WJ / 2 + 520, 1150], [WJ / 2 + 520, 1420], [WJ / 2 + 80, 1420]], ramp: 'canvasOD', base: 1, r: 60 }],
  panels: [
    ...both([[560, 0, 40], [760, 0, 40], [760, 700, 60], [560, 700, 60]], WJ).map(pts => ({ pts, ramp: 'rubber', base: 1 })),
    ...both([[330, 860], [790, 860], [790, 925], [330, 925]], WJ).map(pts => ({ pts, base: 3 })),
    ...both([[330, 700], [780, 700], [790, 860], [330, 860]], WJ).map(pts => ({ pts, base: 1 })),
    { pts: sym([[0, 480], [330, 480], [330, 1090], [0, 1090]], WJ), base: 2 },
    { pts: sym([[0, 1090], [330, 1090], [330, 1110], [0, 1110]], WJ), base: 3 },
    { pts: sym([[0, 440], [800, 440], [820, 540], [0, 540]], WJ), base: 2 },
    { pts: [[WJ / 2 - 640, 1100], [WJ / 2 + 640, 1100], [WJ / 2 + 640, 1140], [WJ / 2 - 640, 1140]], base: 2 }, { pts: [[WJ / 2 - 640, 1600], [WJ / 2 + 640, 1600], [WJ / 2 + 640, 1660], [WJ / 2 - 640, 1660]], base: 2 },
    ...[-640, -30, 600].map(x => ({ pts: [[WJ / 2 + x, 1100], [WJ / 2 + x + 40, 1100], [WJ / 2 + x + 40, 1660], [WJ / 2 + x, 1660]], base: 2 }))],
  glass: [[[WJ / 2 - 600, 1140], [WJ / 2 - 30, 1140], [WJ / 2 - 30, 1600], [WJ / 2 - 600, 1600]], [[WJ / 2 + 30, 1140], [WJ / 2 + 600, 1140], [WJ / 2 + 600, 1600], [WJ / 2 + 30, 1600]]],
  details: [
    ...Array.from({ length: 9 }, (_, k) => ({ pts: (y => [[WJ / 2 + y - 20, 560], [WJ / 2 + y + 20, 560], [WJ / 2 + y + 20, 1030], [WJ / 2 + y - 20, 1030]])(-280 + k * 70), ramp: 'black', base: 0, r: 20 })),
    ...both([[150, 790], [250, 790], [250, 890], [150, 890]], WJ).map(pts => ({ pts, ramp: 'lensW', base: 1, r: 50 })),
    ...both([[540, 925], [600, 925], [600, 965], [540, 965]], WJ).map(pts => ({ pts, ramp: 'black', base: 1 })),
    ...both([[740, 470], [800, 470], [800, 530], [740, 530]], WJ).map(pts => ({ pts, ramp: 'black', base: 1 })),
    { band: [[WJ / 2 - 560, 1160], [WJ / 2 - 120, 1560]], th: 20, ramp: 'black' }, { band: [[WJ / 2 + 120, 1590], [WJ / 2 + 520, 1590]], th: 20, ramp: 'black' }],   // wipers
  stencils: [{ type: 'text', x: WJ / 2 - 120, z: 500, n: 6 }] };
const WK = 2400;
export const cckwFront = { len: WK, height: 2400, paint: 'paint.od',
  wheels: [], chassis: [{ band: [[WK / 2 - 760, 440], [WK / 2 + 760, 440]], th: 110, ramp: 'black' }, { e: [WK / 2 - 120, 440, 170, 150], ramp: 'OD', base: 1 }],
  inner: [{ pts: [[WK / 2 - 820, 1660], [WK / 2 + 820, 1660], [WK / 2 + 820, 1760], [WK / 2 - 820, 1760]], ramp: 'OD', base: 1 }],
  panels: [
    ...both([[720, 0, 50], [960, 0, 50], [960, 880, 80], [720, 880, 80]], WK).map(pts => ({ pts, ramp: 'rubber', base: 1 })),
    { pts: sym([[0, 1500], [900, 1500], [900, 2190, 80], [820, 2270, 60], [0, 2270]], WK), base: 2, rivets: 2 },
    ...both([[560, 860], [560, 1060, 140], [740, 1110, 100], [1120, 1080, 60], [1130, 860]], WK).map(pts => ({ pts, base: 2 })),
    { pts: sym([[0, 860], [340, 860], [340, 1600], [0, 1600]], WK), base: 2 },
    { pts: sym([[0, 680], [1110, 680], [1110, 860], [0, 860]], WK), base: 2 }],
  glass: [[[WK / 2 - 820, 1700], [WK / 2 - 50, 1700], [WK / 2 - 50, 2130], [WK / 2 - 820, 2130]], [[WK / 2 + 50, 1700], [WK / 2 + 820, 1700], [WK / 2 + 820, 2130], [WK / 2 + 50, 2130]]],
  details: [
    { pts: [[WK / 2 - 300, 900], [WK / 2 + 300, 900], [WK / 2 + 300, 1560], [WK / 2 - 300, 1560]], ramp: 'black', base: 0 },
    ...Array.from({ length: 6 }, (_, k) => ({ band: [[WK / 2 - 300 + k * 120, 880], [WK / 2 - 300 + k * 120, 1580]], th: 30, ramp: 'OD' })),
    ...both([[620, 1110], [790, 1110], [790, 1280], [620, 1280]], WK).map(pts => ({ pts, ramp: 'lensW', base: 1, r: 80 })),
    ...both([[1000, 700], [1080, 700], [1080, 840], [1000, 840]], WK).map(pts => ({ pts, ramp: 'black', base: 1 })),
    { band: [[WK / 2 - 760, 1720], [WK / 2 - 200, 2100]], th: 25, ramp: 'black' }, { band: [[WK / 2 + 200, 2110], [WK / 2 + 760, 2110]], th: 25, ramp: 'black' }],
  stencils: [{ type: 'text', x: WK / 2 - 200, z: 780, n: 8 }] };
