// A car's design (core/design.ts) made into the driving game's physics (RaceSpec, race/cars.ts): the parts builder's
// figures worked out from simple physical rules instead of written by hand (docs/systems/98, B2). The two cars the kit
// was made from are the check: designSpec(DESIGN_NSX) and designSpec(DESIGN_F355) land on the NSX's and the F355's own
// specs (race/cars.ts, with their sources), and each rule below is set by those two cars where a figure has to be chosen.
//   mass:   the base's platform (its structure in steel or aluminium, sized by the wheelbase and the width; the rest of
//           the car: the trim, the glass, the suspension, the fluids, the wiring) + the engine (by layout, cc, valves,
//           turbos) + the gearbox and the drive + the wheels + the equipment + a 75 kg driver, as the other specs carry.
//           The rest of each base is what is left of its real car's kerb weight once its own parts are counted.
//   engine: the power at its peak is cc x revs x a mean effective pressure set by the valves (more valve area, better
//           breathing), less when the pistons' mean speed passes about 21 m/s, more with a second cam profile (VTEC),
//           times the boost's density gain (intercooled, a lower compression); the curve's peaks follow from it.
//   balance: each mass at its place along the wheelbase (the driver ahead of the mid engine, the transaxle at the rear
//           axle); the base's rest placed so its real car's front share comes out.
//   drag:   the base's drag area, scaled by the frontal area (the width), the nose's and the tail's shapes; a wing and an
//           undertray with a diffuser as tech.wing and tech.underbody (their downforce, and the drag they add).
//   gears:  a five- or six-speed box (the NSX's and the F355's ratios); a final drive of 0 is chosen so the top speed,
//           where the power meets the drag and the rolling resistance, comes at the power peak in top gear.
import type { Design, BaseId, Layout } from '../core/design';
import { DESIGN_NSX, DESIGN_F355 } from '../core/design';
import { type RaceSpec, torqueAt, EPS_SPEED_SENSITIVE } from './cars';

const G = 9.81, RHO = 1.2, HP = 745.7, DRIVER = 75;
/** the bases: the real car's figures (race/cars.ts) the platform is set by. kerb: its kerb weight without the driver;
 *  front: its front share with the driver; cdA: its body's drag area without a wing or an undertray; overhangs: the body's
 *  length beyond the wheelbase (m); width: overall (m), steel: its structure's mass were it of steel (a body in white and
 *  its panels of this size, about 320 kg; the NSX's aluminium one about 190 kg, its makers' 40 % saving) */
interface Base { ref: Design; kerb: number; front: number; wheelbase: number; track: number; width: number; overhangs: number; cgH: number; cdA: number; steel: number }
const BASES: Record<BaseId, Base> = {
  nsx: { ref: DESIGN_NSX, kerb: 1365, front: 0.42, wheelbase: 2.53, track: 1.52, width: 1.81, overhangs: 1.9, cgH: 0.44, cdA: 0.63, steel: 320 },
  f355: { ref: DESIGN_F355, kerb: 1450, front: 0.42, wheelbase: 2.45, track: 1.565, width: 1.9, overhangs: 1.8, cgH: 0.44, cdA: 0.66, steel: 315 } };
/** aluminium's structure against steel's, for the same stiffness */
const ALU = 0.6;
/** the gearboxes' ratios: the NSX's five-speed (Acura 1991) and the F355's six-speed */
export const GEARSETS: Record<5 | 6, number[]> = { 5: [3.071, 1.727, 1.23, 0.967, 0.771], 6: [3.07, 2.16, 1.61, 1.27, 1.03, 0.84] };
const CYL: Record<Layout, number> = { V6: 6, V8: 8, V12: 12 };

// ---- the engine ----
/** the power peak's revs against the red line: the NSX's four valves 7,100 of 8,000, the F355's five 8,250 of 8,500 (its
 *  valve area keeps it breathing to the top); two and three valves fall away earlier */
const PEAK_AT: Record<2 | 3 | 4 | 5, number> = { 2: 0.84, 3: 0.865, 4: 0.8875, 5: 0.97 };
/** hp a litre a thousand revs at the power peak (a brake mean effective pressure: 12.4 is about 12.5 bar): the NSX's
 *  four valves with VTEC (x 1.03 for its high cam) make 270 hp from 2,977 cc at 7,100, the F355's five 375 from 3,496 at
 *  8,250 */
const BMEP: Record<2 | 3 | 4 | 5, number> = { 2: 11.3, 3: 11.9, 4: 12.37, 5: 13.0 };
const VTEC_GAIN = 1.03;
/** the turbos: one at 0.8 bar, two (smaller, quicker) at 1.0; an intercooled engine gains about 0.65 of its boost in
 *  power (the XJ220's twin-turbo 3.5 V6: 542 hp, 1.73 times a naturally aspirated four-valve engine's figure) */
const BOOST = [0, 0.8, 1.0], BOOST_GAIN = 0.65;
/** a cylinder's stroke (m), from its volume at a bore 1.12 times the stroke (the NSX's 90 x 78, the F355's 85 x 77) */
const stroke = (cc: number, n: number) => Math.cbrt(cc / n / (Math.PI / 4 * 1.12 ** 2)) / 100;
/** the mean piston speed (m/s) at revs */
export const pistonSpeed = (d: Design, rpm: number) => 2 * stroke(d.engine.cc, CYL[d.engine.layout]) * rpm / 60;
/** the breathing past about 21 m/s of mean piston speed (the F355's 21 at its peak): the flow chokes in the ports, the
 *  friction climbs; 2.5 % a m/s (slow enough that more cc still makes more power), at most 40 % */
const pistonLoss = (ps: number) => Math.max(0.6, 1 - 0.025 * Math.max(0, ps - 21));

/** the engine's figures: rated power (hp) and its revs, the torque peak (Nm) and its revs, its VTEC and turbo fields */
function engine(d: Design) {
  const E = d.engine, hpRpm = Math.round(E.redline * PEAK_AT[E.valves] / 10) * 10, boost = BOOST[E.turbo]!;
  const hp = E.cc / 1000 * hpRpm / 1000 * BMEP[E.valves] * (E.vtec ? VTEC_GAIN : 1) * pistonLoss(pistonSpeed(d, hpRpm)) * (1 + BOOST_GAIN * boost);
  const Tp = hp * HP / (hpRpm * Math.PI / 30);   // the torque at the power peak
  // the torque peak: a turbo's comes early and high (its boost is full by then; the XJ220's 644 Nm at 4,500 of a 7,200
  // power peak, 1.2 times the torque there); an unblown one's late, flatter with more valves (the F355's 1.12 times at
  // 0.73 of its power peak's revs)
  const ratio = E.turbo ? 1.2 : ({ 2: 1.22, 3: 1.17, 4: 1.13, 5: 1.12 } as const)[E.valves], torqueRpm = Math.round(hpRpm * (E.turbo ? 0.6 : 0.73) / 10) * 10;
  // VTEC as the NSX's: the low cam's peak (284 Nm at 5,300, 1.049 times the torque at 7,100), the switch-over at 0.817
  // of the power peak's revs, the high cam peaking at 0.915 of them
  const vtec = E.vtec ? { rpm: Math.round(hpRpm * 0.817 / 10) * 10, hyst: 200, low: { torque: Tp * (E.turbo ? 1.2 : 1.049), rpm: Math.round(hpRpm * (E.turbo ? 0.6 : 0.746) / 10) * 10 }, high: { rpm: Math.round(hpRpm * 0.915 / 10) * 10 } } : undefined;
  const turbo = E.turbo ? { n: E.turbo, boost, full: Math.round(hpRpm * 0.5 / 10) * 10, spool: E.turbo === 1 ? 0.6 : 0.45 } : undefined;
  return { hp, hpRpm, torqueRpm: vtec ? vtec.low.rpm : torqueRpm, torquePeak: vtec ? vtec.low.torque : Tp * ratio, vtec, turbo };
}

// ---- the masses (kg) and where they sit (m behind the front axle) ----
/** the parts' masses, each with its place along the wheelbase L (the rest of the platform not counted) */
function parts(d: Design, L: number): { m: number; x: number }[] {
  const E = d.engine, K = d.kit, D = d.drive, B = BASES[d.body.base];
  // a dressed engine (its exhaust, its ancillaries, its cooling's share): the V6's block and heads 95 kg, more for each
  // cylinder bank's length, 35 kg a litre; each turbo with its intercooler and pipes 22; five valves' heads 6 more, three
  // or two less; the second cam profile 4 (the NSX's C30A about 200 kg, the F355's V8 about 240)
  const eng = { V6: 95, V8: 115, V12: 150 }[E.layout] + 0.035 * E.cc + 22 * E.turbo + { 2: -8, 3: -4, 4: 0, 5: 6 }[E.valves] + (E.vtec ? 4 : 0);
  // the transaxle: 52 kg as a five-speed, 60 as a six; the F1's hydraulics 10; a limited-slip differential 4;
  // four-wheel drive 65 (a centre differential and its coupling, a propeller shaft, the front differential and shafts)
  const box = (D.gears === 5 ? 52 : 60) + (D.gearbox === 'f1' ? 10 : 0) + (D.lsd ? 4 : 0);
  // a wheel with its tyre: about 0.0055 kg per mm of width per inch of rim (the NSX's 225/50 R16 about 20 kg)
  const wheel = (w: number) => w * K.rim * 0.0055;
  const steer = K.steering === 'hydraulic' ? 9 : K.steering === 'electric' ? 7 : 0;
  const out = [{ m: DRIVER, x: 1.15 }, { m: eng, x: L - 0.75 }, { m: box, x: L - 0.05 }, { m: 2 * wheel(K.tyres[0]), x: 0 }, { m: 2 * wheel(K.tyres[1]), x: L },
    { m: K.abs ? 9 : 0, x: 0.4 }, { m: K.tcs ? 3 : 0, x: L - 0.75 }, { m: steer, x: 0.1 }, { m: K.dampers === 'adaptive' ? 5 : 0, x: L / 2 },
    { m: K.wing ? 14 : 0, x: L + 0.6 }, { m: K.diffuser ? 9 : 0, x: L * 0.6 }];
  if (D.awd) out.push({ m: 30, x: 0.05 }, { m: 35, x: L * 0.6 });   // the front differential at the front axle; the rest along the tunnel
  // the structure, sized by its length and width against the base's, and centred between the axles
  const size = (L + B.overhangs) / (B.wheelbase + B.overhangs) * (B.width + 2 * d.body.width / 1000) / B.width;
  out.push({ m: B.steel * (d.body.material === 'aluminium' ? ALU : 1) * size, x: L / 2 });
  return out;
}
const wheelbase = (d: Design) => BASES[d.body.base].wheelbase + d.body.wheelbase / 1000;
/** each base's rest of the car (kg, the trim, the glass, the suspension, the fluids: it grows a little with the body's
 *  size) and its place as a share of the wheelbase: what its real car's kerb weight and front share leave */
const REST: Record<BaseId, { m: number; x: number }> = Object.fromEntries((Object.keys(BASES) as BaseId[]).map(b => {
  const B = BASES[b], L = B.wheelbase, p = parts(B.ref, L), m = B.kerb + DRIVER - p.reduce((s, q) => s + q.m, 0);
  const x = ((1 - B.front) * (B.kerb + DRIVER) * L - p.reduce((s, q) => s + q.m * q.x, 0)) / m / L; return [b, { m, x }]; })) as Record<BaseId, { m: number; x: number }>;
function massing(d: Design) {
  const B = BASES[d.body.base], L = wheelbase(d), p = parts(d, L), area = (L + B.overhangs) / (B.wheelbase + B.overhangs) * (B.width + 2 * d.body.width / 1000) / B.width;
  const rest = REST[d.body.base], restM = rest.m * area ** 0.3, all = [...p, { m: restM, x: rest.x * L }];
  const mass = all.reduce((s, q) => s + q.m, 0), front = 1 - all.reduce((s, q) => s + q.m * q.x, 0) / mass / L;
  return { mass, front, L, area };
}

// ---- the shape's drag ----
/** the nose's and the tail's drag against each other (a pointed nose parts the air a little more cleanly; the ducktail's
 *  lip holds the flow off the deck at a little drag); a base's own shapes give its real car's figure */
const NOSE_K = { round: 1, pointed: 0.985 }, TAIL_K = { frame: 1, roundLamps: 1.005, ducktail: 1.01 };
const shapeK = (d: Design) => NOSE_K[d.body.nose] * TAIL_K[d.body.tail];

/** a tyre's radius (m): the rim and the sidewall, its aspect by the rim (16 in: 50 %, 17: 45, 18: 40, the period's sizes) */
const tyreR = (w: number, rim: 16 | 17 | 18) => (rim * 25.4 / 2 + w * { 16: 0.5, 17: 0.45, 18: 0.4 }[rim]) / 1000;

/** the drag area all told (m²): the body's, the wing's, the undertray's */
export const dragArea = (s: RaceSpec) => s.cdA + (s.tech?.wing?.cdA ?? 0) + (s.tech?.underbody?.cdA ?? 0);

/** the top speed on the flat (m/s) where full throttle in the best gear just meets the drag and the rolling resistance,
 *  the revs held under the red line (a wing up, the boost full) */
export function topSpeed(s: RaceSpec): number {
  const cd = dragArea(s), clA = (s.tech?.wing?.clA ?? 0) + (s.tech?.wing?.body ?? 0) + (s.tech?.underbody?.clA ?? 0); let best = 0;
  for (const g of s.gears) for (let v = 5; v < 150; v += 0.05) { const rpm = v / s.tyreR * g * s.final * 30 / Math.PI; if (rpm > s.redline) break;
    const q = 0.5 * RHO * v * v, drive = torqueAt(s, rpm) * g * s.final * s.eff / s.tyreR, res = q * cd + s.crr * (s.mass * G + q * clA);
    if (drive >= res) best = Math.max(best, v); else if (v > best) break; }
  return best; }

/** a quick standing start (s to 100 km/h): along the road only, the clutch slipped at the launch revs, the driven
 *  wheels' grip with the weight thrown back, the drive cut for each shift (the builder's readout; the driving game's own
 *  run is the measure) */
export function zeroTo100(s: RaceSpec): number {
  const dt = 0.005, mu = 1.12 * 0.92, Iw = 4 * (s.inertia?.wheel ?? 1.3), Ie = s.inertia?.engine ?? 0.12, awd = !!s.tech?.drive, up = Math.min(s.hpRpm * 1.04, s.redline * 0.92);
  let v = 0, t = 0, gear = 0, shift = 0;
  while (v < 100 / 3.6 && t < 30) {
    const g = s.gears[gear]! * s.final, wheelRpm = v / s.tyreR * g * 30 / Math.PI;
    if (wheelRpm > up && gear < s.gears.length - 1) { gear++; shift = s.shiftT ?? 0.25; continue; }
    const rpm = Math.max(wheelRpm, s.launchRpm ?? s.hpRpm * 0.6), drive = shift > 0 ? 0 : torqueAt(s, rpm) * g * s.eff / s.tyreR;
    const meff = s.mass + (Iw + (wheelRpm >= rpm ? Ie * g * g : 0)) / s.tyreR ** 2, a0 = drive / meff;
    const load = awd ? s.mass * G : s.mass * G * (1 - s.frontShare) + s.mass * a0 * s.cgH / s.wheelbase, grip = mu * load;
    const F = Math.min(drive, grip) - 0.5 * RHO * dragArea(s) * v * v - s.crr * s.mass * G;
    v += Math.max(0, F) / meff * dt; t += dt; shift -= dt; }
  return t; }

/** the design's physics for the driving game */
export function designSpec(d: Design): RaceSpec {
  const B = BASES[d.body.base], E = d.engine, D = d.drive, K = d.kit, en = engine(d), M = massing(d);
  const widthK = (B.width + 2 * d.body.width / 1000) / B.width, shape = shapeK(d) / shapeK(B.ref);
  const rearW = K.tyres[1], R = tyreR(rearW, K.rim), gears = GEARSETS[D.gears];
  const eff = (D.gears === 5 ? 0.9 : 0.88) - (D.awd ? 0.03 : 0);   // the NSX's five-speed 0.9, the F355's six 0.88; the front drive's gears
  const launch = Math.round((E.turbo ? Math.max(en.torqueRpm * 0.93, en.turbo!.full * 1.2) : en.torqueRpm * 0.93) / 100) * 100;
  const tech: NonNullable<RaceSpec['tech']> = { rollF: 0.47, tyreWF: K.tyres[0] / 1000, tyreWR: rearW / 1000, gearbox: D.gearbox };
  if (D.lsd) tech.rearLsd = 1.9;                                   // a torque-sensing differential (the NSX's 2.0, the F355's 1.8)
  if (D.awd) tech.drive = { front: 0.3, visc: 60 };              // a viscous centre coupling, 30 % to the front (the EB110's 27)
  if (K.abs) tech.abs = true;
  if (K.tcs) tech.tcs = { slip: 0.1, tau: 0.15, cut: 0.7 };      // the NSX's throttle-actuator system
  if (K.steering === 'hydraulic') tech.power = true; else if (K.steering === 'electric') tech.eps = EPS_SPEED_SENSITIVE;
  if (K.dampers === 'adaptive') tech.damp = { comfort: 0.65, sport: 1.3, speedK: 0.3 };   // the F355's two settings
  // a fixed rear wing of the period, up whenever the car moves (rising at 0 km/h, never stowing): its lift area on the
  // rear, its drag; the body itself makes none
  if (K.wing) tech.wing = { up: 0, down: -1, clA: 0.3, cdA: 0.05, body: 0 };
  if (K.diffuser) tech.underbody = { clA: 0.13, front: 0.5, cdA: 0.01 };   // the F355's undertray
  if (en.vtec) tech.vtec = en.vtec; if (en.turbo) tech.turbo = en.turbo;
  const s: RaceSpec = { id: 'design:' + d.id, name: d.name, mass: M.mass, wheelbase: M.L, track: B.track + 2 * d.body.width / 1000, tyreR: R, tyreW: (K.tyres[0] + rearW) / 2000,
    cgH: B.cgH, frontShare: M.front, hp: en.hp, hpRpm: en.hpRpm, torqueRpm: en.torqueRpm, torquePeak: en.torquePeak, idle: E.layout === 'V6' ? 800 : 1000, redline: E.redline,
    gears, final: D.final || 3.5, eff, brakes: 'disc', hydraulic: true, brakeG: 1.0, cdA: B.cdA * widthK * shape, crr: 0.012, steerLock: 30, topKmh: 0, check: false,
    cooling: { siphon: false, margin: E.turbo ? 1.1 : 1.15 }, tyreKind: 'radial', era: '1990s', shiftT: D.gearbox === 'f1' ? 0.2 : D.gears === 5 ? 0.22 : 0.27, launchRpm: launch,
    steer: { ratio: K.steering === 'manual' ? 19.5 : 19, ackermann: 0.6, rack: true },
    inertia: { engine: 0.06 + E.cc * 0.00002 + (E.layout === 'V12' ? 0.02 : 0), wheel: 1.3 + 0.0025 * (rearW - 225) + 0.02 * (K.rim - 16) },
    // the base's wishbones all round (race/cars.ts suspension(), found by the body's id)
    body: d.body.base, tech };
  if (!D.final) {   // the final drive for the top speed: the power peak in top gear where the power meets the resistance
    const P = s.hp * HP * s.eff, cd = dragArea(s); let v = 50; for (let k = 0; k < 60; k++) v = Math.cbrt(Math.max(1, P - s.crr * s.mass * G * v) / (0.5 * RHO * cd));
    s.final = Math.min(4.8, Math.max(2.8, s.hpRpm * Math.PI / 30 * R / (v * gears[gears.length - 1]!))); }
  s.topKmh = Math.round(topSpeed(s) * 3.6);
  return s; }

/** what the builder screen shows */
export interface DesignFigures { mass: number; hp: number; torque: number; /** kg a hp */ kgPerHp: number; /** hp a tonne */ hpPerTonne: number;
  front: number; topKmh: number; zeroTo100: number; cdA: number }
export function designFigures(d: Design): DesignFigures {
  const s = designSpec(d), r = (x: number, n = 0) => Math.round(x * 10 ** n) / 10 ** n;
  return { mass: r(s.mass), hp: r(s.hp), torque: r(s.torquePeak!), kgPerHp: r(s.mass / s.hp, 2), hpPerTonne: r(s.hp / s.mass * 1000), front: r(s.frontShare, 3),
    topKmh: s.topKmh, zeroTo100: r(zeroTo100(s), 1), cdA: r(dragArea(s), 3) }; }
