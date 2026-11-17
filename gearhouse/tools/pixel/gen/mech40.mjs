// 1940s MechDefs (= VehicleDef mechanical half), aligned to the measured bodies (same mm frame: x from front tip, z up, y lateral).
// Values are layout positions for rendering + the spec block the simulation reads (see docs/ENGINE_DRIVETRAIN_SYSTEM_PLAN.md).
export const mech4x4 = { id: 'e2_mil_4x4', len: 3450, width: 1580, track: 1245, tire: '6.00-16', springY: 380, floor: [1100, 3100], exhaustY: -260, tankY: [80, 560],
  frame: { type: 'ladder', line: [[40, 440], [260, 390], [3240, 390]], depth: 95, width: 760, cross: [120, 920, 1500, 2050, 3200] },
  axles: [{ x: 505, drive: 1, steer: 1, spring: 'leaf', springLen: 920, diffDx: 120, diffR: 120, diffDy: 110 }, { x: 2536, drive: 1, spring: 'leaf', springLen: 1060, diffDx: -60, diffR: 130 }],
  engine: { kind: 'sv_i4', x: 400, z: 560, len: 520, w: 470, color: 'paint.enginegreen', opts: { cyl: 4, bore: 79.4, stroke: 111.1, color: 'paint.enginegreen' } },
  radiator: [270, 420, 330, 980], gearbox: { x0: 920, x1: 1130, z: 520, speeds: 3, lever: [1440, 900] },
  transfer: { x0: 1130, x1: 1420, z: 430, ranges: 2, levers: [[1600, 840], [1665, 820]] },
  shafts: [[[1150, 330], [625, 356]], [[1420, 360], [2476, 356]]], exhaust: [[700, 640], [820, 300], [1700, 240], [3200, 280]], muffler: [1780, 2200, 240],
  tank: [1560, 430, 1900, 680], steering: [[420, 520], [1700, 1190]], mounts: [300, 1100, 1900, 2900],
  spec: { layout: 'F4', frame: 'ladder_channel', engine: { type: 'L-head I4', cid: 134.2, bore: 79.4, stroke: 111.1, hp: 60, rpm: 4000, torqueNm: 142 },
    gearbox: { type: 'manual', speeds: 3, ratios: [2.665, 1.564, 1.0], rev: 3.554 }, transfer: { ranges: 2, ratios: [1.0, 1.97] }, finalDrive: 4.88, massKg: 1040, tyre: '6.00-16' } };

export const mech6x6 = { id: 'e2_mil_6x6', len: 6700, width: 2240, track: 1590, tire: '7.50-20', springY: 430, exhaustY: -320, tankY: [420, 800],
  frame: { type: 'ladder', line: [[30, 860], [6360, 860]], depth: 170, width: 860, taper: 1, cross: [150, 1300, 2600, 3500, 4754, 6300] },
  axles: [{ x: 588, drive: 1, steer: 1, spring: 'leaf', springLen: 1000, diffDx: 150, diffR: 160, diffDy: 120 }, { x: 4150, drive: 1, dual: 1, diffR: 160 }, { x: 5358, drive: 1, dual: 1, diffR: 160 },
    { x: 4754, virtual: 1, spring: 'inverted', springLen: 1500 }],
  engine: { kind: 'ohv_i6', x: 470, z: 820, len: 760, w: 560, color: 'paint.engineGrey', opts: { bore: 96.0, stroke: 101.6, color: 'paint.engineGrey' } },
  radiator: [270, 650, 340, 1500], gearbox: { x0: 1290, x1: 1680, z: 770, speeds: 5, lever: [1800, 1650] },
  transfer: { x0: 2150, x1: 2500, z: 650, ranges: 2, levers: [[2050, 1500], [2110, 1480]] },
  shafts: [[[1680, 740], [2150, 660]], [[2150, 560], [740, 440]], [[2500, 600], [4100, 450]], [[4210, 450], [5300, 450]]],
  exhaust: [[900, 900], [1100, 600], [3000, 560], [6000, 600]], muffler: [3100, 3800, 540], tank: [1670, 670, 2270, 810], steering: [[500, 760], [2010, 1800]], mounts: [600, 1900, 2800, 4200, 5600],
  spec: { layout: 'F6', frame: 'ladder_channel_heavy', engine: { type: 'OHV I6', cid: 269.5, bore: 96.0, stroke: 101.6, hp: 91.5, rpm: 2750, torqueNm: 293 },
    gearbox: { type: 'manual', speeds: 5, ratios: [6.06, 3.50, 1.80, 1.00, 0.79], rev: 6.00 }, transfer: { ranges: 2, ratios: [1.0, 2.63] }, finalDrive: 6.6, rearSusp: 'walking_beam_tandem', massKg: 4800, tyre: '7.50-20 dual' } };

export const mechSedan42 = { id: 'e2_sedan42', len: 4900, width: 1850, track: 1450, tire: '6.00-16', springY: 0, floor: [1200, 3900], exhaustY: -300, tankY: [-500, 500],
  frame: { type: 'x_member', line: [[300, 520], [1100, 430], [3000, 430], [3350, 620], [4200, 620], [4600, 540]], depth: 110, width: 900, cross: [330, 4500] },
  axles: [{ x: 788, steer: 1, spring: 'transverse', radius: 900 }, { x: 3685, drive: 1, spring: 'transverse', radius: -1400, diffR: 150 }],
  engine: { kind: 'flathead_v8', x: 520, z: 560, len: 600, w: 650, color: 'iron', opts: { bore: 77.8, stroke: 95.25 } },
  radiator: [330, 420, 400, 1000], gearbox: { x0: 1180, x1: 1440, z: 520, speeds: 3 },
  shafts: [Object.assign([[1440, 500], [3540, 370]], { th: 85 })], exhaust: [[900, 520], [1050, 300], [2600, 260], [4600, 300]], muffler: [2700, 3300, 280],
  tank: [4150, 470, 4620, 700], steering: [[700, 600], [1900, 1250]], mounts: [400, 1200, 2400, 3500, 4400],
  spec: { layout: 'FR', frame: 'ladder_x_member', engine: { type: 'L-head V8', cid: 221, bore: 77.8, stroke: 95.25, hp: 90, rpm: 3800, torqueNm: 212 },
    gearbox: { type: 'manual_column', speeds: 3, ratios: [2.82, 1.60, 1.0], rev: 3.62 }, drive: 'torque_tube', finalDrive: 3.78, massKg: 1440, tyre: '6.00-16' } };
