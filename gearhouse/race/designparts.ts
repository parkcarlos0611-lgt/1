// A design's machinery worked out part by part (docs/systems/99, 1-8 and 6-1): the engine's figures (its power and
// torque from its size, revs, valves, development grade, compression, intake and boost), its package (how long, wide
// and tall it is, its gearbox with it: what the fit check, race/fit.ts, sets against a base's engine bay), its dressed
// mass, and a tyre's radius. Shared by race/design.ts (the physics) and race/fit.ts (the fit); pure.
// The rules are set by the NSX's and the F355's engines (race/cars.ts: 270 hp at 7,100 and 284 Nm at 5,300 from the
// C30A's 2,977 cc; 375 hp at 8,250 and 363 Nm at 6,000 from the F129B's 3,496 cc) where a figure has to be chosen,
// and checked against four more (the Diablo's, the EB110's, the XJ220's and the McLaren F1's: tests/race_design.test.ts).
// Alpha 0.12 (M2, the engine designer): the bore against the stroke (the family's), in-line and flat layouts, each part's
// quality over the grade (-3..+3: a little power, reliability, cost), and the engine's own cost, reliability, fuel use,
// emissions class and development time (placeholders until the company's economy, 0.20). At quality 0 and the old
// bore/stroke every figure is what it was (the six cars' check stands).
import { CYLINDERS, BANKS, BS_DEFAULT, QUALITY_PARTS, type Design, type Grade, type QualityPart, type Valves } from '../core/design';

export const HP = 745.7;
export const CYL = CYLINDERS;

// ---- the engine's breathing ----
/** the power peak's revs against the red line: the NSX's four valves 7,100 of 8,000, the F355's five 8,250 of 8,500 (its
 *  valve area keeps it breathing to the top); two and three valves fall away earlier */
const PEAK_AT: Record<Valves, number> = { 2: 0.84, 3: 0.865, 4: 0.8875, 5: 0.97 };
/** hp a litre a thousand revs at the power peak, at grade 2, a middle compression and one throttle (a brake mean
 *  effective pressure: 12.4 is about 12.5 bar): the NSX's four valves with VTEC (x 1.03 for its high cam) make 270 hp
 *  from 2,977 cc at 7,100; the F355's five, at its 11:1 (x 1.03), 375 from 3,496 at 8,250 */
const BMEP: Record<Valves, number> = { 2: 11.3, 3: 11.9, 4: 12.37, 5: 12.62 };
/** the mean effective pressure at the torque peak (bar), the same footing: the NSX's 284 Nm (with its variable intake,
 *  x 1.04 low down), the F355's 363 (x 1.03 for its compression). Two valves less than four: a two-valve head makes
 *  less torque as well as less power (doc 99 1-8 F5: the old torque ratio gave the two-valve engine the most torque) */
const LOW_BMEP: Record<Valves, number> = { 2: 10.6, 3: 11.1, 4: 11.53, 5: 12.67 };
const VTEC_GAIN = 1.03;
/** the development grade (doc 99 6-1): its pressure at the power peak, the power peak's revs moved toward the red line,
 *  the pressure low down (rising less: a racing engine's cams, ports and runners are made for the top end), the torque
 *  peak's revs as a share of the power peak's (later: weaker low down), the mean piston speed it breathes to (m/s:
 *  lighter, stronger parts and better ports; the F355's 21 at grade 2), its dressed mass (thin-wall castings, light
 *  internals). Set by the Diablo's V12 (grade 3), the McLaren F1's S70/2 and the XJ220's JRV-6 (grade 4) */
const GRADE: Record<Grade, { bmep: number; peak: number; low: number; torqueAt: number; piston: number; mass: number }> = {
  1: { bmep: 0.88, peak: -0.03, low: 0.95, torqueAt: 0.66, piston: 19.5, mass: 1.03 },
  2: { bmep: 1, peak: 0, low: 1, torqueAt: 0.73, piston: 21, mass: 1 },
  3: { bmep: 1.06, peak: 0.025, low: 1.03, torqueAt: 0.76, piston: 22, mass: 0.98 },
  4: { bmep: 1.13, peak: 0.05, low: 1.05, torqueAt: 0.79, piston: 23.5, mass: 0.93 },
  5: { bmep: 1.22, peak: 0.07, low: 1.06, torqueAt: 0.83, piston: 25, mass: 0.88 } };
/** the compression (about 8.5, 10 and 11:1): a little more from every bang the higher it is; the boost a charge takes
 *  before it knocks (bar, intercooled: a cooler charge takes more; without, 0.7 of it) */
const COMP = { low: { k: 0.92, knock: 1.6 }, mid: { k: 1, knock: 0.9 }, high: { k: 1.03, knock: 0.5 } } as const;
/** the intake: at the power peak, low down, and the power peak's revs. A variable intake (two runner lengths) fills the
 *  middle; a throttle a cylinder (short straight runners, no plenum) breathes best at the top and is weaker low down */
const INTAKE = { single: { top: 1, low: 1, peak: 0 }, variable: { top: 1, low: 1.04, peak: 0 }, itb: { top: 1.04, low: 0.98, peak: 0.01 } } as const;
/** an intercooled engine gains about 0.65 of its boost in power (the XJ220's twin-turbo 3.5 V6: 542 hp from 1.0 bar, at
 *  its 8.3:1), 0.45 without; past the knock limit the timing is pulled back and the extra boost buys a fifth of that */
const BOOST_GAIN = 0.65, BOOST_GAIN_HOT = 0.45, KNOCK_GAIN = 0.2;
/** a turbo flows enough for about 300 hp: one turbo on a big output chokes the exhaust (the reason for two, or four) */
const TURBO_HP = 300;

/** a cylinder's stroke (m), from its volume at a bore `bs` times the stroke (by default 1.12: the NSX's 90 x 78, the
 *  F355's 85 x 77) */
export const stroke = (cc: number, n: number, bs = BS_DEFAULT) => Math.cbrt(cc / n / (Math.PI / 4 * bs ** 2)) / 100;
export const bore = (cc: number, n: number, bs = BS_DEFAULT) => bs * stroke(cc, n, bs);
/** the mean piston speed (m/s) at revs */
export const pistonSpeed = (d: Design, rpm: number) => 2 * stroke(d.engine.cc, CYL[d.engine.layout], d.engine.bs) * rpm / 60;
/** the bore and the stroke of a design's cylinders (mm) */
export const boreStroke = (d: Design): { bore: number; stroke: number } => { const n = CYL[d.engine.layout]; return { bore: bore(d.engine.cc, n, d.engine.bs) * 1000, stroke: stroke(d.engine.cc, n, d.engine.bs) * 1000 }; };

// ---- each part's quality over the grade (docs/systems/101 1-1): -3 a cheap, fragile part .. +3 a hand-finished one ----
/** what a step of each part's quality does: the power (a share a step: the head's ports and valve gear the most, the
 *  intake's and the exhaust's flow a little, the block barely; the turbo's only with turbos), the reliability (points a
 *  step: the block's and the head's castings, the turbo's bearings and its heat the most), and the cost (the part's share
 *  of the engine's cost, moved 12 % a step). At 0 nothing changes */
export const QUALITY: Record<QualityPart, { power: number; reliability: number; cost: number; name: string }> = {
  block: { power: 0.002, reliability: 2.5, cost: 0.3, name: '블록' },
  head: { power: 0.007, reliability: 2, cost: 0.3, name: '헤드·밸브 기구' },
  intake: { power: 0.005, reliability: 0.8, cost: 0.15, name: '흡기' },
  exhaust: { power: 0.005, reliability: 1, cost: 0.12, name: '배기' },
  turbo: { power: 0.008, reliability: 2, cost: 0.13, name: '터보' } };
const qOf = (d: Design, k: QualityPart) => k === 'turbo' && !d.engine.turbo ? 0 : d.engine.quality?.[k] ?? 0;
/** the quality's multiplier on the power and the torque (1 at quality 0) */
export const qualityPower = (d: Design) => 1 + QUALITY_PARTS.reduce((s, k) => s + QUALITY[k].power * qOf(d, k), 0);
/** reliability points the quality adds (0 at quality 0) */
export const qualityReliability = (d: Design) => QUALITY_PARTS.reduce((s, k) => s + QUALITY[k].reliability * qOf(d, k), 0);
/** the quality's multiplier on the engine's cost (1 at quality 0) */
export const qualityCost = (d: Design) => 1 + QUALITY_PARTS.reduce((s, k) => s + QUALITY[k].cost * 0.12 * qOf(d, k), 0);
/** the bore/stroke's effect against the old 1.12: a long stroke a little more torque low down (its longer lever, its
 *  slower gas at the valves), an oversquare bore a little less (1 at 1.12) */
const bsLow = (d: Design) => (BS_DEFAULT / (d.engine.bs ?? BS_DEFAULT)) ** 0.15;
/** the breathing past the grade's mean piston speed: the flow chokes in the ports, the friction climbs; 2.5 % a m/s
 *  (slow enough that more cc still makes more power), at most 40 % */
const pistonLoss = (ps: number, at: number) => Math.max(0.6, 1 - 0.025 * Math.max(0, ps - at));

/** the boost's effect: the power's multiplier, and how far past the knock limit the boost runs (bar, 0 when inside) */
export function boostGain(d: Design): { k: number; overKnock: number } {
  const E = d.engine; if (!E.turbo) return { k: 1, overKnock: 0 };
  const limit = COMP[E.compression].knock * (E.intercooler ? 1 : 0.7), gain = E.intercooler ? BOOST_GAIN : BOOST_GAIN_HOT;
  const under = Math.min(E.boost, limit), over = Math.max(0, E.boost - limit);
  return { k: 1 + gain * under + KNOCK_GAIN * gain * over, overKnock: over }; }

export interface EngineFigures { hp: number; hpRpm: number; torqueRpm: number; torquePeak: number; overKnock: number;
  vtec?: { rpm: number; hyst: number; low: { torque: number; rpm: number }; high: { rpm: number } };
  turbo?: { n: number; boost: number; full: number; spool: number } }
/** the engine's figures: rated power (hp) and its revs, the torque peak (Nm) and its revs, its VTEC and turbo fields */
export function engineFigures(d: Design): EngineFigures {
  const E = d.engine, Gr = GRADE[E.grade], I = INTAKE[E.intake], C = COMP[E.compression];
  const hpRpm = Math.round(E.redline * Math.min(0.99, PEAK_AT[E.valves] + Gr.peak + I.peak) / 10) * 10, b = boostGain(d);
  let hp = E.cc / 1000 * hpRpm / 1000 * BMEP[E.valves] * Gr.bmep * C.k * I.top * (E.vtec ? VTEC_GAIN : 1) * pistonLoss(pistonSpeed(d, hpRpm), Gr.piston) * b.k;
  if (E.turbo) hp /= 1 + 0.15 * Math.max(0, hp / E.turbo / TURBO_HP - 1);
  hp *= qualityPower(d);
  const Tp = hp * HP / (hpRpm * Math.PI / 30);   // the torque at the power peak
  // the torque peak: a turbo's comes early and high (its boost is full by then; the XJ220's 644 Nm at 4,500 of a 7,200
  // power peak, 1.2 times the torque there; a racing engine's a little less and later); an unblown one's from the
  // pressure low down, at the grade's share of the power peak's revs (the F355's 0.73), never below 1.03 times the
  // torque at the power peak (the curve needs its hump)
  const na = LOW_BMEP[E.valves] * Gr.low * C.k * I.low * E.cc / 1000 * 100 / (4 * Math.PI) * qualityPower(d) * bsLow(d);
  const torquePeak = E.turbo ? Tp * (1.2 - 0.02 * (E.grade - 2)) : Math.max(Tp * 1.03, na);
  const torqueRpm = Math.round(hpRpm * (E.turbo ? 0.6 + 0.02 * (E.grade - 2) : Gr.torqueAt) / 10) * 10;
  // VTEC as the NSX's: the low cam's peak (284 Nm at 5,300), the switch-over at 0.817 of the power peak's revs, the high
  // cam peaking at 0.915 of them
  const vtec = E.vtec ? { rpm: Math.round(hpRpm * 0.817 / 10) * 10, hyst: 200, low: { torque: torquePeak, rpm: Math.round(hpRpm * (E.turbo ? 0.6 : 0.746) / 10) * 10 }, high: { rpm: Math.round(hpRpm * 0.915 / 10) * 10 } } : undefined;
  // sequential turbos (the 959's): the first blows alone low down, so the boost is full sooner and answers quicker
  const seq = !!E.sequential && E.turbo >= 2, turbo = E.turbo ? { n: E.turbo, boost: E.boost, full: Math.round(hpRpm * (seq ? 0.4 : 0.5) / 10) * 10, spool: E.turbo === 1 ? 0.6 : seq ? 0.32 : 0.45 } : undefined;
  return { hp, hpRpm, torqueRpm: vtec ? vtec.low.rpm : torqueRpm, torquePeak, overKnock: b.overKnock, vtec, turbo }; }

// ---- the engine's package (m) and mass (kg) ----
/** the engine's size with its gearbox (m): `length` along the crank (the banks' cylinders at their bore spacing, the
 *  stagger between the banks, the drive belts ahead and the flywheel behind), `width` across the banks (the V: 90
 *  degrees for the V6 and the V8, 60 for the V12; turbos and their pipes beside the banks), `height` from the sump's
 *  foot to the intake's top (a dry sump's flat pan 70 mm lower, a variable intake's runners and the trumpets of a
 *  throttle a cylinder higher); `box`: the gearbox's length behind the engine (a longitudinal transaxle) or at its end
 *  (a transverse one). The NSX's C30A comes out 0.54 x 0.67 x 0.64 with its gearbox 0.36 at its end (its sheet's
 *  engine: 0.54 along the car, 0.6 tall: data/cars/spec/nsx.json engineBay); the F355's V8 0.64 long, 0.45 of
 *  six-speed behind it (the sheet's bay, 1.15 m for both) */
/** In-line engines (alpha 0.12) are one bank long and narrow and stand tall (the head upright over the crank); flat ones
 *  are two banks lying out, wide and low (about 0.85 m across the heads of a 2.5 l flat four, 0.45 m high) */
export function enginePackage(d: Design): { length: number; width: number; height: number; box: number; boxEnd: number } {
  const E = d.engine, n = CYL[E.layout], B = bore(E.cc, n, E.bs), S = stroke(E.cc, n, E.bs), spacing = B * 1.12 + 0.01, kind = BANKS(E.layout);
  const length = kind === 'I' ? n * spacing + 0.16 : n / 2 * spacing + 0.5 * spacing + 0.16;
  const across = kind === 'I' ? 0.46 : kind === 'flat' ? 0.86 : n === 6 ? 0.66 : 0.7;
  const width = across * Math.sqrt(B / 0.087) + (E.turbo === 0 ? 0 : E.turbo <= 2 ? 0.12 : 0.2);
  const tall = kind === 'I' ? 0.68 : kind === 'flat' ? 0.46 : { 6: 0.58, 8: 0.6, 10: 0.61, 12: 0.62 }[n] ?? 0.6;
  const height = tall * Math.sqrt(S / 0.08) - (E.sump === 'dry' ? 0.07 : 0) + { single: 0, variable: 0.03, itb: 0.05 }[E.intake];
  const box = d.drive.gears === 5 ? 0.42 : 0.46, boxEnd = d.drive.gears === 5 ? 0.36 : 0.4;
  return { length, width, height, box, boxEnd }; }

/** a dressed engine (its exhaust, its ancillaries, its cooling's share): 65 kg, 10 a cylinder, 25 a litre in aluminium
 *  (an iron block 1.2 times, magnesium castings 0.9), the grade's own factor; five valves' heads 6 more, three or two
 *  less; the second cam profile 4; a variable intake 4, a throttle a cylinder 6; a dry sump's pump and tank 6; each
 *  turbo with its pipes 22, an intercooler 10 for each pair. The NSX's C30A about 207 kg, the F355's V8 244, the McLaren
 *  F1's S70/2 about 320 (its own figure 266 dry, without the exhaust and the cooling) */
export function engineMass(d: Design): number {
  // an in-line engine's one head and one set of cams: 12 kg less
  const E = d.engine, core = (65 + 10 * CYL[E.layout] + 25 * E.cc / 1000 - (BANKS(E.layout) === 'I' ? 12 : 0)) * { iron: 1.2, aluminium: 1, magnesium: 0.9 }[E.block] * GRADE[E.grade].mass;
  return core + { 2: -8, 3: -4, 4: 0, 5: 6 }[E.valves] + (E.vtec ? 4 : 0) + { single: 0, variable: 4, itb: 6 }[E.intake] + (E.sump === 'dry' ? 6 : 0)
    + 22 * E.turbo + (E.turbo && E.intercooler ? 10 * Math.ceil(E.turbo / 2) : 0); }

/** a tyre's radius (m): the rim and the sidewall, its aspect by the rim (16 in: 50 %, 17: 45, 18: 40, the period's sizes) */
export const tyreR = (w: number, rim: 16 | 17 | 18) => (rim * 25.4 / 2 + w * { 16: 0.5, 17: 0.45, 18: 0.4 }[rim]) / 1000;

// ---- the engine's own cost, reliability, fuel use, emissions and development (placeholders, docs/systems/98 4-3) ----
// The cost is in the car's cost index's points (race/design.ts: the NSX's car 100): the grade, the size and the
// cylinders, the details, the parts' quality. Reliability is an index (the NSX's engine 100): the grade, each turbo's
// heat, running past the knock limit, the piston speed past the grade's, magnesium, the parts' quality (the car's fit
// work is taken off by race/design.ts). The service interval follows the grade. None is final: 0.20 sets real costs.
const GRADE_COST: Record<Grade, number> = { 1: 0.6, 2: 1, 3: 1.6, 4: 2.6, 5: 4.2 };
const GRADE_RELIABLE: Record<Grade, number> = { 1: 1.1, 2: 1, 3: 0.85, 4: 0.65, 5: 0.35 };
const GRADE_SERVICE: Record<Grade, number> = { 1: 15000, 2: 10000, 3: 7500, 4: 5000, 5: 1500 };
/** the engine's cost (the car's cost index points) */
export function engineCost(d: Design): number {
  const E = d.engine;
  return (30 * GRADE_COST[E.grade] * Math.sqrt(CYL[E.layout] / 6) * (E.cc / 3000) ** 0.4 * (E.valves === 5 ? 1.08 : 1)
    + { single: 0, variable: 1.5, itb: 4 }[E.intake] + (E.compression === 'high' ? 0.5 : 0) + (E.sump === 'dry' ? 3 : 0) + { iron: -2, aluminium: 0, magnesium: 8 }[E.block]
    + E.turbo * 4 + (E.turbo && E.intercooler ? 1.5 * Math.ceil(E.turbo / 2) : 0) + (E.vtec ? 3 : 0)) * qualityCost(d); }
/** the engine's reliability (5..110, before the car's fit work) and its service interval (km) */
export function engineReliability(d: Design): { reliability: number; serviceKm: number } {
  const E = d.engine, en = engineFigures(d), over = Math.max(0, pistonSpeed(d, en.hpRpm) - 21 - 1.5 * (E.grade - 2));
  const reliability = 100 * GRADE_RELIABLE[E.grade] - 4 * E.turbo - 25 * en.overKnock - 3 * over - (E.block === 'magnesium' ? 5 : 0) + qualityReliability(d);
  const serviceKm = Math.round(GRADE_SERVICE[E.grade] * (E.turbo ? 0.85 : 1) * (en.overKnock > 0 ? 0.7 : 1) * (1 + 0.04 * (qOf(d, 'block') + qOf(d, 'head'))) / 500) * 500;
  return { reliability: Math.max(5, Math.min(110, reliability)), serviceKm }; }

/** the fuel used cruising (L/100 km) at a steady speed, a simple model: the road's power (the car's drag area and rolling
 *  resistance at its mass) and the engine's friction at the revs top gear gives (a friction mean pressure of
 *  0.97 + 0.15 N + 0.05 N² bar, N in thousands of rpm: the Chen-Flynn form), over an indicated efficiency of 0.34 (the
 *  compression's: 0.95, 1, 1.03; a turbo's lower compression and its throttled boost, 0.97; a throttle a cylinder's
 *  pumping 0.98); petrol at 43 MJ/kg and 0.745 kg/l */
export function cruiseFuel(d: Design, car: { mass: number; cdA: number; crr: number; tyreR: number; gears: number[]; final: number; eff: number }, kmh: number): number {
  const v = kmh / 3.6, road = (0.5 * 1.2 * car.cdA * v ** 3 + car.crr * car.mass * 9.81 * v) / car.eff;
  const rpm = Math.max(1200, v / car.tyreR * car.gears[car.gears.length - 1]! * car.final * 30 / Math.PI), N = rpm / 1000;
  const fric = (0.97 + 0.15 * N + 0.05 * N * N) * 1e5 * d.engine.cc * 1e-6 * rpm / 120;
  const eta = 0.34 * { low: 0.95, mid: 1, high: 1.03 }[d.engine.compression] * (d.engine.turbo ? 0.97 : 1) * (d.engine.intake === 'itb' ? 0.98 : 1);
  return (road + fric) / eta / 43e6 / 0.745 / v * 1e5; }
/** an emissions class (a placeholder for the market's rules, 0.30): from the fuel used and how the mixture is made, A
 *  (cleanest) to E */
export function emissionsClass(d: Design, fuel: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  const k = fuel * (d.engine.intake === 'itb' ? 1.15 : 1) * (d.engine.grade >= 4 ? 1.1 : 1) * (d.engine.turbo ? 1.05 : 1);
  return k < 7 ? 'A' : k < 9 ? 'B' : k < 11.5 ? 'C' : k < 14.5 ? 'D' : 'E'; }
/** the engine's development time (months, a placeholder for 0.20's research): the grade, the cylinders, the details, the
 *  parts made better than the grade's */
export function engineDevMonths(d: Design): number {
  const E = d.engine; return Math.round(4 + 3 * E.grade + CYL[E.layout] / 4 + E.turbo * 1.5 + (E.vtec ? 2 : 0) + (E.intake === 'itb' ? 1.5 : E.intake === 'variable' ? 1 : 0) + (E.sump === 'dry' ? 1 : 0)
    + QUALITY_PARTS.reduce((s, k) => s + Math.max(0, qOf(d, k)) * 0.8, 0)); }
