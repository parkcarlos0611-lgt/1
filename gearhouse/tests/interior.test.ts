import { describe, it, expect } from 'vitest';
import { interiorMesh, interiorBudget, INTERIORS, P959_CABIN, TRIMS, REGIONS, SHEET, interiorSheet, gaugeSet, dialAngle, dialState, stepDials, poseDials, inputFromVehicle, DIAL_BONES, P959_GAUGES, type CabinAnchors } from '../render/car/interior';
import { makeAtlas, ATLAS_CELLS, outlineShare } from '../render/live/style';
import { BONE_SLOTS } from '../render/live/renderer';
import type { Mesh } from '../render/car/mesh';

const names = (M: Mesh) => new Set(Array.from(M.part).map(p => M.names![p]!));
/** the box of the parts whose names match */
function box(M: Mesh, re: RegExp) { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let t = 0; t < M.n; t++) if (re.test(M.names![M.part[t]!]!)) for (let k = 0; k < 9; k++) { lo[k % 3] = Math.min(lo[k % 3]!, M.pos[t * 9 + k]!); hi[k % 3] = Math.max(hi[k % 3]!, M.pos[t * 9 + k]!); } return { lo, hi, mid: lo.map((v, i) => (v + hi[i]!) / 2) }; }
/** a part's volume by its faces (above 0: wound outward) */
function volume(M: Mesh, re: RegExp) { let v = 0; for (let t = 0; t < M.n; t++) if (re.test(M.names![M.part[t]!]!)) { const p = M.pos, q = t * 9; v += p[q]! * (p[q + 4]! * p[q + 8]! - p[q + 5]! * p[q + 7]!) + p[q + 1]! * (p[q + 5]! * p[q + 6]! - p[q + 3]! * p[q + 8]!) + p[q + 2]! * (p[q + 3]! * p[q + 7]! - p[q + 4]! * p[q + 6]!); } return v / 6; }

describe('the interior (docs/systems/109 section 4)', () => {
  const stock = interiorMesh(INTERIORS.stock), drift = interiorMesh(INTERIORS.drift);
  it('keeps to the budget: 4,000 to 5,000 triangles with the driver and the cage, each group within its share', () => {
    const d = interiorBudget(drift), s = interiorBudget(stock);
    expect(d.total).toBeGreaterThanOrEqual(4000); expect(d.total).toBeLessThanOrEqual(5000); expect(s.total).toBeLessThanOrEqual(5000); expect(s.total).toBeGreaterThanOrEqual(3200);
    for (const [g, max] of [['dash', 1100], ['wheel', 540], ['seats', 1000], ['driver', 1000], ['controls', 800], ['cage', 600], ['floor', 300]] as const) expect(d[g] ?? 0, g).toBeLessThanOrEqual(max);
    expect(d.cage).toBeGreaterThan(300); expect(s.cage).toBeUndefined();
  });
  it('has its parts by name, each with the cabin\'s thin share of the outline', () => {
    const N = names(stock); for (const n of ['dash', 'dashBinnacle', 'gaugeBezel2', 'gaugeFace2', 'gaugeNeedle_tach', 'gaugeNeedle_speedo', 'gaugeNeedle_boost', 'steerWheelRim', 'steerWheelPad', 'steerWheelColumn', 'seatL', 'seatR', 'shifterKnob', 'handbrakeLever', 'pedalBrake', 'tunnel', 'driver', 'driverHelmet', 'doorCardL', 'cabinFloor']) expect(N.has(n), n).toBe(true);
    for (const n of N) if (!/Rail$|^body|^windscreen/.test(n)) expect(outlineShare(n, 0), n).toBe(0.5);
    expect(names(drift).has('cage')).toBe(true); expect(names(drift).has('gaugePod0')).toBe(true);
  });
  it('winds every solid outward (a seat, the dash, the rim, the cage), whatever frame it was built in', () => {
    for (const re of [/^seatL$/, /^seatR$/, /^dash$/, /^steerWheelRim$/, /^driverHelmet$/, /^tunnel$/]) expect(volume(stock, re), String(re)).toBeGreaterThan(0);
    expect(volume(drift, /^cage$/)).toBeGreaterThan(0);
  });
  it('places its parts by the anchors: the wheel about its centre, the seats about the hip points, the dash on its front plane', () => {
    const A = P959_CABIN, rim = box(stock, /^steerWheelRim$/).mid; for (let i = 0; i < 3; i++) expect(rim[i]).toBeCloseTo(A.wheel[i]!, 0);
    const sl = box(stock, /^seatL$/), sr = box(stock, /^seatR$/); expect(sl.mid[1]).toBeCloseTo(A.hip[1], 0); expect(sr.mid[1]).toBeCloseTo(-A.hip[1], 0); expect(sl.lo[0]).toBeLessThan(A.hip[0]); expect(sl.hi[0]).toBeGreaterThan(A.hip[0]); expect(sl.hi[2]).toBeLessThan(A.roofZ);
    expect(box(stock, /^dash$/).lo[0]).toBeCloseTo(A.screenFoot[0], 0); expect(box(stock, /^driverHelmet$/).hi[2]).toBeLessThan(A.roofZ); expect(box(stock, /^cabinFloor$/).hi[2]).toBeCloseTo(A.floorZ, 3);
    // another cabin: longer, wider, the driver on the right
    const B: CabinAnchors = { ...A, side: -1, wheel: [A.wheel[0] + 200, -400, A.wheel[2] + 40], hip: [A.hip[0] + 200, -400, A.hip[2] + 40], half: 780, dashX: A.dashX + 200, screenFoot: [A.screenFoot[0] + 200, A.screenFoot[1]] };
    const other = interiorMesh({ ...INTERIORS.stock, cabin: B }), rim2 = box(other, /^steerWheelRim$/).mid; expect(rim2[0]).toBeCloseTo(B.wheel[0], 0); expect(rim2[1]).toBeCloseTo(-400, 0);
    expect(box(other, /^driver$/).mid[1]).toBeLessThan(0); expect(box(other, /^doorCardL$/).lo[1]).toBeCloseTo(780, 0); expect(box(other, /^gaugeFace2$/).mid[1]).toBeCloseTo(-400, 0);
  });
  it('swaps parts without touching the rest: wheel, seats, lever, cage, trim', () => {
    const w = interiorMesh({ ...INTERIORS.stock, wheel: 'drift' }); expect(names(w).has('steerWheelHorn')).toBe(true); expect(names(w).has('steerWheelPad')).toBe(false); expect(box(w, /^seatL$/)).toEqual(box(stock, /^seatL$/));
    const s = interiorMesh({ ...INTERIORS.stock, seats: 'bucket' }); expect(box(s, /^seatL$/).hi[2]!).toBeGreaterThan(box(stock, /^seatL$/).hi[2]!); expect(box(s, /^steerWheelRim$/)).toEqual(box(stock, /^steerWheelRim$/));
    const c = interiorMesh({ ...INTERIORS.stock, cage: true }); expect(c.n - stock.n).toBe(interiorBudget(c).cage);
    const tan = interiorMesh({ ...INTERIORS.stock, trim: 'tan' }); expect(tan.n).toBe(stock.n); expect(Array.from(tan.pos)).toEqual(Array.from(stock.pos)); expect(Array.from(tan.col)).not.toEqual(Array.from(stock.col));
    expect(Object.keys(TRIMS)).toEqual(['black', 'brown', 'tan']);
    expect(interiorMesh({ ...INTERIORS.stock, driver: false }).n).toBeLessThan(stock.n); expect(names(interiorMesh({ ...INTERIORS.stock, passengerSeat: false })).has('seatR')).toBe(false);
  });
  it('lays the sheet\'s pictures on the flat detail: every picture inside its own region of the interior cell', () => {
    const cell = ATLAS_CELLS.indexOf('interior') + 1, uv = drift.uv!; expect(uv.length).toBe(drift.n * 9); let painted = 0; const R = Object.values(REGIONS);
    for (let t = 0; t < drift.n; t++) { if (!uv[t * 9 + 2]) continue; painted++; const mx = (uv[t * 9]! + uv[t * 9 + 3]! + uv[t * 9 + 6]!) / 3 * SHEET.W, my = (uv[t * 9 + 1]! + uv[t * 9 + 4]! + uv[t * 9 + 7]!) / 3 * SHEET.H, r = R.find(([x, y, w, h]) => mx >= x && mx <= x + w && my >= y && my <= y + h)!;
      expect(r).toBeDefined(); for (let k = 0; k < 3; k++) { expect(uv[t * 9 + k * 3 + 2]).toBe(cell); expect(uv[t * 9 + k * 3]! * SHEET.W).toBeGreaterThanOrEqual(r[0]); expect(uv[t * 9 + k * 3]! * SHEET.W).toBeLessThanOrEqual(r[0] + r[2]); expect(uv[t * 9 + k * 3 + 1]! * SHEET.H).toBeGreaterThanOrEqual(r[1]); expect(uv[t * 9 + k * 3 + 1]! * SHEET.H).toBeLessThanOrEqual(r[1] + r[3]); } }
    expect(painted).toBeGreaterThan(120);
    const regs = Object.entries(REGIONS); for (const [n, [x, y, w, h]] of regs) { expect(x + w, n).toBeLessThanOrEqual(SHEET.W); expect(y + h, n).toBeLessThanOrEqual(SHEET.H); for (const [m, [x2, y2, w2, h2]] of regs) if (m !== n) expect(x < x2 + w2 && x2 < x + w && y < y2 + h2 && y2 < y + h, `${n} over ${m}`).toBe(false); }
  });
});

describe('the instruments: faces from data, needles on bones', () => {
  it('draws each car its own dials: the red band from the red line, the speedometer past the top speed, boost only when blown', () => {
    const a = gaugeSet({ redline: 7300, topKmh: 317, boostBar: 1 }), b = gaugeSet({ redline: 5500, topKmh: 180 }); expect(a.length).toBe(5);
    const tach = (g: typeof a) => g[2]!.scales.find(s => s.id === 'tach')!, speedo = (g: typeof a) => g[3]!.scales[0]!;
    expect(tach(a).red).toEqual([7300, 8000]); expect(tach(b).red![0]).toBe(5500); expect(tach(b).max).toBe(6000); expect(speedo(a).max).toBeGreaterThanOrEqual(317); expect(speedo(a).max).toBeLessThan(400); expect(speedo(b).max).toBeGreaterThanOrEqual(180); expect(speedo(b).max).toBeLessThanOrEqual(220);
    expect(a[2]!.scales.some(s => s.id === 'boost')).toBe(true); expect(b[2]!.scales.some(s => s.id === 'boost')).toBe(false);
    expect(gaugeSet({ redline: 7000, topKmh: 300, mph: true })[3]!.scales[0]!.unit).toBe('MPH');
    const W = 256, s1 = interiorSheet(W, { redline: 7300, topKmh: 317, boostBar: 1 }), s2 = interiorSheet(W, { redline: 5500, topKmh: 180 }); expect(s1.length).toBe(W * W / 2 * 4);
    const [x, y, w, h] = REGIONS.tach, k = W / SHEET.W; let diff = 0, ink = 0; for (let j = Math.ceil(y * k); j < (y + h) * k; j++) for (let i = Math.ceil(x * k); i < (x + w) * k; i++) { const q = (j * W + i) * 4; if (s1[q + 3]) ink++; if (s1[q] !== s2[q]) diff++; }
    expect(ink).toBeGreaterThan(w * h * k * k * 0.7); expect(diff).toBeGreaterThan(20);
    const A = makeAtlas(256); expect(Array.from(A.rects.subarray((ATLAS_CELLS.length - 1) * 4))).toEqual([0, 0.5, 1, 0.5]); expect(A.data[(200 * 256 + 20) * 4 + 3]).toBe(255);   // the tach's face, in the atlas's lower half
  });
  const M = interiorMesh(INTERIORS.stock), rig = M.dials!;
  it('hangs each needle on its own bone, within the renderer\'s bones', () => {
    expect(rig.dials.map(d => d.id)).toEqual(['oilTemp', 'oilLevel', 'oilPress', 'tach', 'boost', 'speedo', 'fuel', 'water', 'steer']); expect(rig.bones).toBe(DIAL_BONES); expect(DIAL_BONES).toBeLessThanOrEqual(BONE_SLOTS);
    const used = new Set(Array.from(M.dial!)); for (const d of rig.dials) expect(used.has(d.bone), d.id).toBe(true);
    for (let t = 0; t < M.n; t++) { const nm = M.names![M.part[t]!]!, b = M.dial![t]!; if (/^gauge(Needle|Hub)_/.test(nm)) expect(b).toBe(rig.dials.find(d => d.id === nm.split('_')[1])!.bone); else if (/^steerWheel(Rim|Pad|Spokes|Horn|Hub)$/.test(nm)) expect(b).toBe(rig.dials[rig.dials.length - 1]!.bone); else expect(b, nm).toBe(0); }
  });
  it('poses a needle from its reading: built at the scale\'s start, turned to the reading\'s angle about its pivot', () => {
    const d = rig.dials.find(k => k.id === 'tach')!, k = rig.dials.indexOf(d), tip = (v: number[]) => { const B = poseDials(rig, v); let far = 0, out = [0, 0, 0];
      for (let t = 0; t < M.n; t++) if (M.names![M.part[t]!] === 'gaugeNeedle_tach') for (let c = 0; c < 3; c++) { const p = [M.pos[t * 9 + c * 3]!, M.pos[t * 9 + c * 3 + 1]!, M.pos[t * 9 + c * 3 + 2]!], q = [0, 1, 2].map(i => B[d.bone * 12 + i * 4]! * p[0]! + B[d.bone * 12 + i * 4 + 1]! * p[1]! + B[d.bone * 12 + i * 4 + 2]! * p[2]! + B[d.bone * 12 + i * 4 + 3]!), r = Math.hypot(q[0]! - d.pivot[0], q[1]! - d.pivot[1], q[2]! - d.pivot[2]); if (r > far) { far = r; out = q.map((x, i) => (x - d.pivot[i]!) / r); } }
      return out; };
    for (const rpm of [0, 4000, 8000]) { const v = rig.dials.map(q => q.rest); v[k] = rpm; const a = dialAngle(d, rpm) * Math.PI / 180, t = tip(v), want = [0, 1, 2].map(i => Math.sin(a) * d.right[i]! + Math.cos(a) * d.up[i]!); for (let i = 0; i < 3; i++) expect(t[i]).toBeCloseTo(want[i]!, 1); }
    expect(d.right[1]).toBeCloseTo(-1, 5);   // the driver's right is the car's right: a rising reading turns clockwise as the driver sees it
    const B0 = poseDials(rig); expect(Array.from(B0.subarray(0, 12))).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  });
  it('follows the drive with each needle\'s lag, rests with the engine off, stops at the pins', () => {
    const st = dialState(rig), k = rig.dials.findIndex(d => d.id === 'tach'), w = rig.dials.findIndex(d => d.id === 'water'), b = rig.dials.findIndex(d => d.id === 'boost');
    stepDials(st, rig, { on: true, rpm: 3000, kmh: 80 }, 0.016); expect(st.v[k]).toBe(3000);   // the first step sets them
    stepDials(st, rig, { on: true, rpm: 7000, kmh: 80, water: 110, boost: 0.9 }, 0.016); expect(st.v[k]).toBeGreaterThan(3000); expect(st.v[k]).toBeLessThan(7000); expect(st.v[w]).toBeLessThan(90);   // the water's needle is slow
    for (let i = 0; i < 400; i++) stepDials(st, rig, { on: true, rpm: 7000, kmh: 80, water: 110, boost: 0.9 }, 0.016); expect(st.v[k]).toBeCloseTo(7000, 0); expect(st.v[w]).toBeCloseTo(110, 0); expect(st.v[b]).toBeCloseTo(0.9, 2);
    stepDials(st, rig, { on: true, rpm: 99999 }, 10); expect(st.v[k]).toBe(rig.dials[k]!.max);
    for (let i = 0; i < 1500; i++) stepDials(st, rig, { on: false, rpm: 0 }, 0.016); rig.dials.forEach((d, i) => { if (d.id !== 'steer') expect(st.v[i]).toBeCloseTo(d.rest, 1); });
    const inp = inputFromVehicle({ rpm: 6000, speed: 50, boost: 0.5, health: { water: 92, oil: 104 } }, { boostBar: P959_GAUGES.boostBar }); expect(inp).toMatchObject({ on: true, rpm: 6000, kmh: 180, boost: 0.5, water: 92, oilTemp: 104 }); expect(inputFromVehicle({ rpm: 0, speed: 0 }).on).toBe(false);
  });
});
