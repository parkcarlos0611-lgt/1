// A car's design (core/design.ts) made into the driving game's physics (RaceSpec, race/cars.ts): the parts builder's
// figures worked out from simple physical rules instead of written by hand (docs/systems/98, B2; the second pass, doc
// 99 1-8 and 6-1: C1). The two cars the kit was made from are the check: designSpec(DESIGN_NSX) and
// designSpec(DESIGN_F355) land on the NSX's and the F355's own specs (race/cars.ts, with their sources) within 3 %, and
// each rule below is set by those two cars where a figure has to be chosen; four more (the Diablo, the EB110, the XJ220,
// the McLaren F1: core/design.ts) come within 7 % without being used to set them (tests/race_design.test.ts).
//   mass:   the base's platform (its structure and its panels, each of its material, sized by the wheelbase and the
//           width; the rest of the car: the trim, the glass, the suspension, the fluids, the wiring, a share of it the
//           secondary structure that follows the structure's material) + the engine (race/designparts.ts) + the gearbox
//           and the drive + the wheels + the equipment + the fit's work (race/fit.ts) + a 75 kg driver, as the other
//           specs carry. The rest of each base is what is left of its real car's kerb weight once its own parts are counted.
//   engine: race/designparts.ts (the grade, the compression, the intake, the boost).
//   balance: each mass at its place along the wheelbase (the driver ahead of the mid engine, the transaxle at the rear
//           axle) and at its height (the engine by its height and its sump, the panels high, the structure low); the
//           base's rest placed so its real car's front share and centre of gravity come out.
//   drag:   the base's drag coefficient (its real car's drag area over its frontal area) on the design's frontal area (its
//           width; its height is the base's: the kit's lines do not stretch it), the nose's and the tail's shapes; a
//           wing and an undertray with a diffuser as tech.wing and tech.underbody; the fit's flares and scoops.
//   gears:  a five- or six-speed box (the NSX's and the F355's ratios); a final drive of 0 is chosen so the top speed,
//           where the power meets the drag and the rolling resistance, comes at the power peak in top gear.
//   class, cost, reliability: designFigures (the class from the figures, doc 99 6-2; cost and reliability placeholders
//           until B5).
import type { Design, BaseId, Structure, Panels, Grade } from '../core/design';
import { DESIGN_NSX, DESIGN_F355 } from '../core/design';
import { type RaceSpec, torqueAt, EPS_SPEED_SENSITIVE } from './cars';
import { HP, CYL, engineFigures, engineMass, enginePackage, pistonSpeed, tyreR } from './designparts';
import { fit, fitPenalty, type FitResult } from './fit';
export { pistonSpeed } from './designparts';

const G = 9.81, RHO = 1.2, DRIVER = 75;
/** the bases: the real car's figures (race/cars.ts) the platform is set by. kerb: its kerb weight without the driver;
 *  front: its front share with the driver; cdA: its body's drag area without a wing or an undertray; overhangs: the body's
 *  length beyond the wheelbase (m); width, height: overall (m, the sheets); cgH: its centre of gravity's height (m);
 *  structure, panels: their masses were they of steel (a body in white with its subframes, about 360 kg at the NSX's
 *  size, and its doors, lids and wings, about 120: Honda's aluminium body saved some 200 kg against steel, 0.42 of
 *  these at the factors below); floor: the engine bay's floor (m, the sheets) */
interface Base { ref: Design; kerb: number; front: number; wheelbase: number; track: number; width: number; height: number; overhangs: number; cgH: number; cdA: number; structure: number; panels: number; floor: number }
const BASES: Record<BaseId, Base> = {
  nsx: { ref: DESIGN_NSX, kerb: 1365, front: 0.42, wheelbase: 2.53, track: 1.52, width: 1.81, height: 1.17, overhangs: 1.9, cgH: 0.44, cdA: 0.63, structure: 360, panels: 120, floor: 0.18 },
  f355: { ref: DESIGN_F355, kerb: 1450, front: 0.42, wheelbase: 2.45, track: 1.565, width: 1.9, height: 1.17, overhangs: 1.8, cgH: 0.44, cdA: 0.66, structure: 355, panels: 118, floor: 0.15 } };
/** the structures' and the panels' masses against steel's, for the same stiffness (doc 99 6-1) */
export const STRUCTURE_K: Record<Structure, number> = { steel: 1, hss: 0.9, aluminium: 0.6, honeycomb: 0.5, cfrp: 0.45 };
export const PANEL_K: Record<Panels, number> = { steel: 1, aluminium: 0.55, frp: 0.6, cfrp: 0.4 };
/** the share of a base's rest that is secondary structure (subframes, crash beams, brackets, seat frames) and follows the
 *  structure's material */
const SECONDARY = 0.15;
/** the gearboxes' ratios: the NSX's five-speed (Acura 1991) and the F355's six-speed */
export const GEARSETS: Record<5 | 6, number[]> = { 5: [3.071, 1.727, 1.23, 0.967, 0.771], 6: [3.07, 2.16, 1.61, 1.27, 1.03, 0.84] };

/** the engine's centre of mass above the ground (m): the bay's floor, the sump under the crank (a wet sump's pan 0.22
 *  deep, a dry sump's 0.16: the engine sits lower), the heads and the intake above it */
const engineZ = (d: Design) => BASES[d.body.base].floor + (d.engine.sump === 'dry' ? 0.16 : 0.22) + 0.1 * enginePackage(d).height / 0.6;

// ---- the masses (kg) and where they sit (m behind the front axle) ----
/** the parts' masses, each with its place along the wheelbase L (m behind the front axle) and its height z (m); the
 *  rest of the platform not counted */
function parts(d: Design, L: number): { m: number; x: number; z: number }[] {
  const K = d.kit, D = d.drive, B = BASES[d.body.base];
  // the transaxle: 52 kg as a five-speed, 60 as a six; the F1's hydraulics 10; a limited-slip differential 4;
  // four-wheel drive 65 (a centre differential and its coupling, a propeller shaft, the front differential and shafts)
  const box = (D.gears === 5 ? 52 : 60) + (D.gearbox === 'f1' ? 10 : 0) + (D.lsd ? 4 : 0);
  // a wheel with its tyre: about 0.0055 kg per mm of width per inch of rim (the NSX's 225/50 R16 about 20 kg)
  const wheel = (w: number) => w * K.rim * 0.0055, rF = tyreR(K.tyres[0], K.rim), rR = tyreR(K.tyres[1], K.rim);
  const steer = K.steering === 'hydraulic' ? 9 : K.steering === 'electric' ? 7 : 0;
  const out = [{ m: DRIVER, x: 1.15, z: 0.42 }, { m: engineMass(d), x: L - 0.75, z: engineZ(d) }, { m: box, x: L - 0.05, z: 0.33 }, { m: 2 * wheel(K.tyres[0]), x: 0, z: rF }, { m: 2 * wheel(K.tyres[1]), x: L, z: rR },
    { m: K.abs ? 9 : 0, x: 0.4, z: 0.5 }, { m: K.tcs ? 3 : 0, x: L - 0.75, z: 0.5 }, { m: steer, x: 0.1, z: 0.45 }, { m: K.dampers === 'adaptive' ? 5 : 0, x: L / 2, z: 0.45 },
    { m: K.wing ? 14 : 0, x: L + 0.6, z: 1.05 }, { m: K.diffuser ? 9 : 0, x: L * 0.6, z: 0.15 }];
  if (D.awd) out.push({ m: 30, x: 0.05, z: 0.3 }, { m: 35, x: L * 0.6, z: 0.3 });   // the front differential at the front axle; the rest along the tunnel
  // the structure and the panels, sized by their length and width against the base's, centred between the axles
  const size = sizeOf(d, L);
  out.push({ m: B.structure * STRUCTURE_K[d.body.structure] * size, x: L / 2, z: 0.4 }, { m: B.panels * PANEL_K[d.body.panels] * size, x: L / 2, z: 0.7 });
  return out;
}
/** the body's size against its base's (its length and width) */
const sizeOf = (d: Design, L: number) => { const B = BASES[d.body.base]; return (L + B.overhangs) / (B.wheelbase + B.overhangs) * (B.width + 2 * d.body.width / 1000) / B.width; };
const wheelbase = (d: Design) => BASES[d.body.base].wheelbase + d.body.wheelbase / 1000;
/** each base's rest of the car (kg, the trim, the glass, the suspension, the fluids: it grows a little with the body's
 *  size, and its secondary structure follows the structure's material) and its place as a share of the wheelbase and
 *  its height: what its real car's kerb weight, front share and centre of gravity leave */
const REST: Record<BaseId, { m: number; x: number; z: number }> = Object.fromEntries((Object.keys(BASES) as BaseId[]).map(b => {
  const B = BASES[b], L = B.wheelbase, p = parts(B.ref, L), M = B.kerb + DRIVER, m = M - p.reduce((s, q) => s + q.m, 0);
  const x = ((1 - B.front) * M * L - p.reduce((s, q) => s + q.m * q.x, 0)) / m / L, z = (B.cgH * M - p.reduce((s, q) => s + q.m * q.z, 0)) / m; return [b, { m, x, z }]; })) as Record<BaseId, { m: number; x: number; z: number }>;
export const _REST = () => REST;
function massing(d: Design) {
  const B = BASES[d.body.base], L = wheelbase(d), p = parts(d, L), area = sizeOf(d, L), rest = REST[d.body.base];
  const restM = rest.m * area ** 0.3 * (1 - SECONDARY + SECONDARY * STRUCTURE_K[d.body.structure] / STRUCTURE_K[B.ref.body.structure]);
  // the fit's work: at the engine (its bay, its mounts, its gearbox) or at an axle (the arches)
  const mods = fitPenalty(d).mass.map(q => ({ m: q.m, x: q.at === 'front' ? 0 : q.at === 'rear' ? L : L - 0.75, z: q.at === 'engine' ? engineZ(d) : 0.5 }));
  const all = [...p, ...mods, { m: restM, x: rest.x * L, z: rest.z }];
  const mass = all.reduce((s, q) => s + q.m, 0), front = 1 - all.reduce((s, q) => s + q.m * q.x, 0) / mass / L, cgH = all.reduce((s, q) => s + q.m * q.z, 0) / mass;
  return { mass, front, cgH, L, area };
}

// ---- the shape's drag ----
/** the nose's and the tail's drag against each other (a pointed nose parts the air a little more cleanly; the ducktail's
 *  lip holds the flow off the deck at a little drag); a base's own shapes give its real car's figure */
const NOSE_K = { round: 1, pointed: 0.985 }, TAIL_K = { frame: 1, roundLamps: 1.005, ducktail: 1.01 };
const shapeK = (d: Design) => NOSE_K[d.body.nose] * TAIL_K[d.body.tail];

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

/** the base's drag coefficient (its real car's drag area over its frontal area: about 0.81 of its width times its
 *  height, the roof's and the sills' taper), and the design's frontal area (m²) */
const frontal = (B: Base, width: number) => 0.81 * width * B.height;
export function frontalArea(d: Design): number { const B = BASES[d.body.base]; return frontal(B, B.width + 2 * d.body.width / 1000); }

/** the design's physics for the driving game */
export function designSpec(d: Design): RaceSpec {
  const B = BASES[d.body.base], E = d.engine, D = d.drive, K = d.kit, en = engineFigures(d), M = massing(d), F = fitPenalty(d);
  const cd = B.cdA / frontal(B, B.width), shape = shapeK(d) / shapeK(B.ref);
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
    cgH: M.cgH, frontShare: M.front, hp: en.hp, hpRpm: en.hpRpm, torqueRpm: en.torqueRpm, torquePeak: en.torquePeak, idle: E.layout === 'V6' ? 800 : 1000, redline: E.redline,
    gears, final: D.final || 3.5, eff, brakes: 'disc', hydraulic: true, brakeG: 1.0, cdA: cd * frontalArea(d) * shape + F.cdA, crr: 0.012, steerLock: 30, topKmh: 0, check: false,
    cooling: { siphon: false, margin: E.turbo ? 1.1 : 1.15 }, tyreKind: 'radial', era: '1990s', shiftT: D.gearbox === 'f1' ? 0.2 : D.gears === 5 ? 0.22 : 0.27, launchRpm: launch,
    steer: { ratio: K.steering === 'manual' ? 19.5 : 19, ackermann: 0.6, rack: true },
    // the engine's turning mass: its size, a V12's longer crank, a racing engine's lighter flywheel and internals
    inertia: { engine: (0.06 + E.cc * 0.00002 + (E.layout === 'V12' ? 0.02 : 0)) * (E.grade >= 4 ? 0.85 : 1), wheel: 1.3 + 0.0025 * (rearW - 225) + 0.02 * (K.rim - 16) },
    // the base's wishbones all round (race/cars.ts suspension(), found by the body's id)
    body: d.body.base, tech };
  if (!D.final) {   // the final drive for the top speed: the power peak in top gear where the power meets the resistance
    const P = s.hp * HP * s.eff, cd = dragArea(s); let v = 50; for (let k = 0; k < 60; k++) v = Math.cbrt(Math.max(1, P - s.crr * s.mass * G * v) / (0.5 * RHO * cd));
    s.final = Math.min(4.8, Math.max(2.8, s.hpRpm * Math.PI / 30 * R / (v * gears[gears.length - 1]!))); }
  s.topKmh = Math.round(topSpeed(s) * 3.6);
  return s; }

// ---- the class (doc 99 6-2, axis 1): performance grades as soft memberships from the figures ----
export type PerfClass = 'normal' | 'high' | 'sports' | 'super' | 'hyper';
export const PERF_CLASSES: PerfClass[] = ['normal', 'high', 'sports', 'super', 'hyper'];
export const PERF_NAME: Record<PerfClass, string> = { normal: '일반', high: '고성능', sports: '스포츠', super: '슈퍼', hyper: '하이퍼' };
/** the bounds between the grades (the 1990s'): hp a tonne (the driver aboard) 100, 150, 230, 330; the top speed 200,
 *  240, 280, 335 km/h (the doc's 330 and 340 split). Each figure is placed on a scale where the bounds are 1, 2, 3, 4
 *  (straight between them, carried on past the ends), the two places averaged, and the grades' shares are soft steps
 *  0.25 wide at the bounds: they sum to 1, and a car near a bound belongs to both */
const HPT = [100, 150, 230, 330], TOP = [200, 240, 280, 335], SOFT = 0.25;
const place = (v: number, b: number[]) => { if (v <= b[0]!) return 1 - (b[0]! - v) / (b[1]! - b[0]!);
  for (let i = 1; i < b.length; i++) if (v <= b[i]!) return i + (v - b[i - 1]!) / (b[i]! - b[i - 1]!);
  const n = b.length; return n + (v - b[n - 1]!) / (b[n - 1]! - b[n - 2]!); };
const step = (x: number) => 1 / (1 + Math.exp(-x / SOFT));
export function perfClass(hpPerTonne: number, topKmh: number): Record<PerfClass, number> {
  const x = (place(hpPerTonne, HPT) + place(topKmh, TOP)) / 2, s = [1, 2, 3, 4].map(b => step(x - b));
  return { normal: 1 - s[0]!, high: s[0]! - s[1]!, sports: s[1]! - s[2]!, super: s[2]! - s[3]!, hyper: s[3]! }; }
/** the shares as the builder writes them: the larger ones, rounded to 5 %, as "스포츠 75 % · 슈퍼 25 %" */
export function perfLabel(p: Record<PerfClass, number>): string {
  const top = PERF_CLASSES.map(k => [k, Math.round(p[k] * 20) * 5] as const).filter(([, v]) => v >= 5).sort((a, b) => b[1] - a[1]).slice(0, 2);
  return top.map(([k, v]) => `${PERF_NAME[k]} ${v} %`).join(' · '); }
/** the body's form (doc 99 6-2, axis 2): every base of the kit is a mid-engined two-door coupé for now */
export const BODY_FORM = '2도어 쿠페';

// ---- cost and reliability: placeholders for B5 (docs/systems/98 4-3), so the builder can show the trade-off ----
// The cost is an index (the NSX's design 100): the engine by its grade, its size and its details, the structure and the
// panels by their materials and the body's size, the drivetrain and the equipment, the fit's work. Reliability is an
// index too (the NSX's 100, the period's most dependable supercar): the grade, the boost (each turbo's heat; past the
// knock limit), the piston speed past the grade's, magnesium, the fit's work. The service interval (km) follows the
// grade. None of these is final: B5 sets the real costs, the research and the wear.
const GRADE_COST: Record<Grade, number> = { 1: 0.6, 2: 1, 3: 1.6, 4: 2.6, 5: 4.2 };
const GRADE_RELIABLE: Record<Grade, number> = { 1: 1.1, 2: 1, 3: 0.85, 4: 0.65, 5: 0.35 };
const GRADE_SERVICE: Record<Grade, number> = { 1: 15000, 2: 10000, 3: 7500, 4: 5000, 5: 1500 };
export const STRUCTURE_COST: Record<Structure, number> = { steel: 1, hss: 1.2, aluminium: 2, honeycomb: 3.2, cfrp: 6 };
export const PANEL_COST: Record<Panels, number> = { steel: 1, aluminium: 1.6, frp: 0.8, cfrp: 4 };
function rawCost(d: Design): number {
  const E = d.engine, D = d.drive, K = d.kit, L = wheelbase(d), size = sizeOf(d, L);
  const engine = 30 * GRADE_COST[E.grade] * Math.sqrt(CYL[E.layout] / 6) * (E.cc / 3000) ** 0.4 * (E.valves === 5 ? 1.08 : 1)
    + { single: 0, variable: 1.5, itb: 4 }[E.intake] + (E.compression === 'high' ? 0.5 : 0) + (E.sump === 'dry' ? 3 : 0) + { iron: -2, aluminium: 0, magnesium: 8 }[E.block]
    + E.turbo * 4 + (E.turbo && E.intercooler ? 1.5 * Math.ceil(E.turbo / 2) : 0) + (E.vtec ? 3 : 0);
  const body = 25 * STRUCTURE_COST[d.body.structure] * size + 10 * PANEL_COST[d.body.panels] * size + 10;
  const drive = (D.gears === 5 ? 7 : 8) + (D.gearbox === 'f1' ? 4 : 0) + (D.lsd ? 1.5 : 0) + (D.awd ? 8 : 0);
  const kit = (K.abs ? 3 : 0) + (K.tcs ? 2 : 0) + { manual: 0, hydraulic: 1.5, electric: 2 }[K.steering] + (K.dampers === 'adaptive' ? 3 : 0) + (K.wing ? 1.5 : 0) + (K.diffuser ? 2 : 0)
    + (K.tyres[0] + K.tyres[1]) * K.rim / 8000;
  return engine + body + drive + kit + fitPenalty(d).cost; }
const COST_NSX = rawCost(DESIGN_NSX);
export function designCost(d: Design): { cost: number; reliability: number; serviceKm: number } {
  const E = d.engine, en = engineFigures(d), over = Math.max(0, pistonSpeed(d, en.hpRpm) - 21 - 1.5 * (E.grade - 2));
  const reliability = Math.max(5, Math.min(110, 100 * GRADE_RELIABLE[E.grade] - 4 * E.turbo - 25 * en.overKnock - 3 * over - (E.block === 'magnesium' ? 5 : 0) - fitPenalty(d).reliability));
  const serviceKm = Math.round(GRADE_SERVICE[E.grade] * (E.turbo ? 0.85 : 1) * (en.overKnock > 0 ? 0.7 : 1) / 500) * 500;
  return { cost: rawCost(d) / COST_NSX * 100, reliability, serviceKm }; }

/** what the builder screen shows: the figures, the class's shares and its label, the body's form, the cost and the
 *  reliability (placeholders), the fit (race/fit.ts) */
export interface DesignFigures { mass: number; hp: number; torque: number; /** kg a hp */ kgPerHp: number; /** hp a tonne */ hpPerTonne: number;
  front: number; topKmh: number; zeroTo100: number; cdA: number; /** m */ cgH: number;
  perf: Record<PerfClass, number>; perfLabel: string; form: string; cost: number; reliability: number; serviceKm: number; fit: FitResult[] }
export function designFigures(d: Design): DesignFigures {
  const s = designSpec(d), r = (x: number, n = 0) => Math.round(x * 10 ** n) / 10 ** n, hpt = s.hp / s.mass * 1000, perf = perfClass(hpt, s.topKmh), c = designCost(d);
  return { mass: r(s.mass), hp: r(s.hp), torque: r(s.torquePeak!), kgPerHp: r(s.mass / s.hp, 2), hpPerTonne: r(hpt), front: r(s.frontShare, 3),
    topKmh: s.topKmh, zeroTo100: r(zeroTo100(s), 1), cdA: r(dragArea(s), 3), cgH: r(s.cgH, 3),
    perf, perfLabel: perfLabel(perf), form: BODY_FORM, cost: r(c.cost), reliability: r(c.reliability), serviceKm: c.serviceKm, fit: fit(d) }; }
