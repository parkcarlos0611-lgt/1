// The cars' figures for the driving game (review 84). Mass, engine size and power, gearbox count, drive, wheelbase,
// track and tyres come from the game's data (data/cars/specs.json, the sheets' kerb weights). Checked against sources
// on 2026-11-22 (review 85), each line's notes below: [v] verified by a source, [~] a secondary or estimated figure,
// [?] none found, as remembered. Top speeds are what the physics is tuned against.
//   fordT23   20 hp @ 1600 [v], 113 Nm @ 900 [v], axle 3.63-3.64 [v], top 42 mph / 68 km/h [v]; brakes rear only [v]
//   chevAB28  35 hp @ 2200 [v], four-wheel mechanical [v], top 50-55 mph [~]
//   plymU29   45 hp @ 2800 [v], top [?] (about 60 mph assumed); brakes: hydraulic as Chrysler's Lockheed [?] (one
//             estimated source says mechanical)
//   pontiac29 60 hp @ 3000 [v], top 60 mph [~]
//   dodgeV28  58 hp @ 3000 [v], hydraulic brakes [v], top about 60 mph [~]
//   willys27  53 hp [v], revs [?], top 60-65 mph [~]
//   buick28   63 hp @ 2800 [v], four-wheel mechanical (contracting) [v], top [?]
//   fnTT33    four speeds, chain [v]; a period test: 57 hp, 85 mph flat out [~] (the game's data keeps 62 hp)
//   bmw315    40 PS [v], top 120 km/h [v], about 750 kg [~], revs [?]
//   dueSSJ35  SJ: 320 hp at 4200 rpm [v] (the game's data keeps the SSJ's claimed 400), three speeds [v], top 130-140
//             mph [~], axle [?]: a high one, as some 1935 SJ chassis had [~] (3.3 here)
//   dueA21    88 hp @ 3600 [v], 170 lb-ft @ 1500 [v], the first production four-wheel hydraulic brakes [v], top 71 mph
//             (Wikipedia) to 75 mph [v]
//   Gear ratios other than the Model T's, drag areas, centres of gravity: [?]. The tyres' grip on dry concrete (0.78)
//   [?]: period tests found about 0.4 sliding on wet concrete.
import specs from '../data/cars/specs.json';

export interface RaceSpec {
  id: string; name: string; mass: number; wheelbase: number; track: number; tyreR: number; tyreW: number;
  cgH: number; frontShare: number;                     // centre of gravity: height (m), share of weight on the front axle
  hp: number; hpRpm: number; torqueRpm: number; idle: number; redline: number;
  gears: number[]; final: number; eff: number;
  brakes: 'rear' | 'four' | 'disc'; hydraulic: boolean; brakeG: number;   // the deceleration the brakes manage when new and cold
  /** era features (review 94), absent on the period cars: the tyres' make, a gear change's time (a crash box about 0.5 s,
   *  synchromesh about 0.25), the era the car comes from (the page marks cars from outside the game's period) */
  tyreKind?: 'crossply' | 'racing30' | 'racing50' | 'radial'; shiftT?: number; era?: string;
  /** the revs a standing start is made at (the clutch slipped until then; by default a gentle start from idle), and
   *  the engine's peak torque in Nm where a source gives it (by default about 1.22 times the torque at peak power) */
  launchRpm?: number; torquePeak?: number;
  /** the steering (review 100): the overall ratio (steering-wheel degrees to road-wheel degrees), how much of true
   *  Ackermann the linkage gives (the inner wheel turned more), a rack and pinion rather than a box (lighter, quicker) */
  steer?: { ratio: number; ackermann: number; rack?: boolean };
  /** the turning masses (kg m²) where known: the engine with its flywheel, one wheel with its tyre and brake */
  inertia?: { engine: number; wheel: number };
  /** later technology (review 125), for the cars that had it: all-wheel drive through a centre differential (the front's
   *  share of the torque, and a viscous coupling across it: Nm per rad/s between the axles); a torque-sensing limited-slip
   *  rear differential (its bias ratio); anti-lock brakes; turbochargers (how many, the boost at full in bar, the revs
   *  where it comes fully, the spool's time in s); a speed-sensitive rear wing (up and down in km/h, its lift area
   *  pressing the rear, its drag area; the body's own downforce area); power steering; the tyres' widths front and rear (m) */
  tech?: { drive?: { front: number; visc: number;
      /** a variable centre clutch instead of a fixed split (docs/systems/117 R4): the front's share rises from `front` to
       *  `max` as the rear axle's slip over the front grows from slip0 to slip1, followed over tau s */
      vary?: { max: number; slip0: number; slip1: number; tau: number } }; rearLsd?: number; /** a viscous-coupling rear differential instead (Nm per rad/s between the wheels) */ rearVisc?: number;
    /** ground effect (review 126): the underbody's venturis, a lift area pressing the car down more the lower it rides (its share on the front) */ ground?: { clA: number; front: number }; abs?: boolean; turbo?: { n: number; boost: number; full: number; spool: number };
    wing?: { up: number; down: number; clA: number; cdA: number; body: number }; power?: boolean; tyreWF?: number; tyreWR?: number;
    /** review 147: the front axle's share of the roll stiffness (an anti-roll bar added at the front to reach it); unset: the springs' own */ rollF?: number;
    /** review 149: the car's own traction control: the driven wheels' slip against the undriven ones' speed; above `slip`
     *  a second throttle closes (up to `cut` of the driver's opening) over `tau` s, and opens again over 1.5 tau */
    tcs?: { slip: number; tau: number; cut: number };
    /** review 149: variable valve timing and lift: two cam profiles, the low one below `rpm` (with `hyst` rpm of hysteresis
     *  coming back down), the high one above. The low cam's torque peak (Nm, rpm); the high cam's torque peak revs (its
     *  peak torque follows from the rated power at hpRpm, its power peaking there) */
    vtec?: { rpm: number; hyst: number; low: { torque: number; rpm: number }; high: { rpm: number } };
    /** review 149: electric power steering, speed-sensitive: the steering's effort times `low` at a standstill, rising to
     *  `high` well above `fade` km/h (the hydraulic `power` is a fixed 0.3) */
    eps?: { low: number; high: number; fade: number };
    /** review 158: how the gearbox is worked. 'manual' (the default): the driver's clutch and lever, the drive cut for the
     *  whole of shiftT. 'f1': an electro-hydraulic automated manual (the same gears, a robotised single-plate clutch and
     *  shift, paddles, no clutch pedal): a shift of shiftT cuts the torque as the clutch opens, swaps the gear with it open,
     *  and refills it as the clutch closes; downshifts blip the throttle to the new gear's revs; the control unit refuses a
     *  downshift that would over-rev, steps one gear a pull, and makes the standing start on its own launch-clutch curve */
    gearbox?: 'manual' | 'f1';
    /** review 158: electronically controlled dampers: multipliers on the damping coefficient. 'sport' fixed; 'comfort'
     *  softer at low speed, firming by speedK of itself per 100 km/h (up to the sport setting) */
    damp?: { comfort: number; sport: number; speedK?: number };
    /** review 158: a flat floor and a rear diffuser: a lift area pressing the car down (q clA, a little more the lower it
     *  rides, much less sensitive to it than venturis), its share on the front axle, and the drag it adds (m²) */
    underbody?: { clA: number; front: number; cdA?: number } };
  /** the body mesh's id where a spec shares another's body (a variant: another gearbox in the same car) */
  body?: string;
  /** alpha 0.13 (M4): the suspension's makings for the kinematic physics (race/kin.ts): a design's (race/design.ts);
   *  the kit's own cars find their base's (kinOf) */
  kin?: import('./kin').KinSpec;
  cdA: number; crr: number; steerLock: number;          // drag area m², rolling resistance, front wheels' lock (deg)
  topKmh: number; check: boolean;
  /** a top-speed limiter (km/h; docs/systems/115 §3, the class's cap): the fuel is cut over its last 2 km/h. Unset: none */
  limiter?: number;
  cooling: { siphon: boolean; margin: number } }   // the water's circulation (no pump on the Model T [v]), the radiator against the engine's heat [?]

/** tyre sizes: 30x3.5 (overall diameter x section, inches), 4.50-20 (section - rim), 33x5 */
export function tyre(size: string): { r: number; w: number } { const a = size.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/), b = size.match(/^(\d+(?:\.\d+)?)-(\d+)$/), inch = 0.0254;
  if (a) return { r: +a[1]! * inch / 2, w: +a[2]! * inch }; if (b) return { r: (+b[2]! + 2 * +b[1]!) * inch / 2, w: +b[1]! * inch }; return { r: 0.36, w: 0.12 }; }
// per car: [peak-power revs, gear ratios, axle ratio, brakes, hydraulic, drag area, cg height, front share, lock, top speed km/h]
const PERIOD: Record<string, [number, number[], number, 'rear' | 'four', boolean, number, number, number, number, number]> = {
  fordT23:   [1600, [2.75, 1.0], 3.64, 'rear', false, 1.95, 0.78, 0.44, 32, 68],
  chevAB28:  [2200, [3.32, 1.69, 1.0], 3.82, 'four', false, 1.9, 0.72, 0.46, 32, 85],
  plymU29:   [2800, [3.06, 1.68, 1.0], 4.3, 'four', true, 1.85, 0.7, 0.47, 32, 97],
  pontiac29: [3000, [3.0, 1.7, 1.0], 4.4, 'four', false, 1.9, 0.72, 0.47, 32, 97],
  dodgeV28:  [3000, [3.0, 1.73, 1.0], 4.3, 'four', true, 1.85, 0.7, 0.47, 32, 100],
  willys27:  [2600, [3.18, 1.73, 1.0], 4.73, 'four', false, 1.95, 0.73, 0.47, 32, 97],
  buick28:   [2800, [3.0, 1.75, 1.0], 4.27, 'four', false, 1.95, 0.72, 0.48, 32, 105],
  fnTT33:    [4500, [3.6, 2.13, 1.43, 1.0], 4.0, 'four', false, 0.95, 0.5, 0.45, 36, 137],
  bmw315:    [4300, [3.62, 2.1, 1.44, 1.0], 4.75, 'four', false, 1.0, 0.52, 0.48, 36, 120],
  dueSSJ35:  [4200, [2.48, 1.53, 1.0], 3.3, 'four', true, 1.35, 0.62, 0.53, 34, 217],
  dueA21:    [3600, [2.9, 1.66, 1.0], 3.8, 'four', true, 1.8, 0.7, 0.5, 33, 117] };
const KG: Record<string, number> = { fordT23: 990, chevAB28: 1160, plymU29: 1155, pontiac29: 1250, dodgeV28: 1300, willys27: 1225, buick28: 1590, fnTT33: 770, bmw315: 750, dueSSJ35: 2270, dueA21: 1750 };

// cooling: the Model T's thermosiphon boiled on long pulls; a supercharged eight runs hot; big luxury radiators had room
const COOL: Record<string, { siphon: boolean; margin: number }> = { fordT23: { siphon: true, margin: 1.0 }, dueSSJ35: { siphon: false, margin: 0.92 }, dueA21: { siphon: false, margin: 1.2 }, fnTT33: { siphon: false, margin: 1.0 }, bmw315: { siphon: false, margin: 1.0 }, buick28: { siphon: false, margin: 1.15 } };
export const RACE_CARS: string[] = Object.keys(PERIOD);
// The steering (review 100): overall ratio and Ackermann share. Sources thin: [~] from the period's descriptions (turns
// lock to lock), [?] typical of the class. Lock to lock = 2 x lock x ratio / 360 turns.
//   fordT23 5:1 [~]: its planetary reduction made it quick (about a turn lock to lock) and heavy; chevAB28-buick28
//   12-15:1 [?] worm and sector boxes, 2.5-3 turns; fnTT33 9:1 [~] (about 1.8 turns, known as quick); bmw315 13:1, rack
//   and pinion [~] (BMW's 303 line had it); dueSSJ35 17:1 [?] (a heavy car, about 3.2 turns); dueA21 16:1 [?];
//   napier33 12:1 [?]; jagD55 12:1, rack and pinion [~] (about 2 turns).
const STEER: Record<string, { ratio: number; ackermann: number; rack?: boolean }> = {
  fordT23: { ratio: 5, ackermann: 0.6 }, chevAB28: { ratio: 12, ackermann: 0.7 }, plymU29: { ratio: 14, ackermann: 0.75 }, pontiac29: { ratio: 14, ackermann: 0.75 },
  dodgeV28: { ratio: 14, ackermann: 0.75 }, willys27: { ratio: 14, ackermann: 0.7 }, buick28: { ratio: 15, ackermann: 0.75 }, fnTT33: { ratio: 9, ackermann: 0.8 },
  bmw315: { ratio: 13, ackermann: 0.8, rack: true }, dueSSJ35: { ratio: 17, ackermann: 0.8 }, dueA21: { ratio: 16, ackermann: 0.75 },
  napier33: { ratio: 12, ackermann: 0.6 }, jagD55: { ratio: 12, ackermann: 0.9, rack: true }, auburn851: { ratio: 16, ackermann: 0.8 }, mb540k: { ratio: 18, ackermann: 0.8 } };
/** a car's steering, its own or the class's */
export const steering = (c: RaceSpec) => c.steer ?? STEER[c.id] ?? { ratio: 15, ackermann: 0.75 };

// ---- experimental cars (review 94): outside the game's period, to try the features cars gained over the years ----
//   napier33  1933 Napier-Railton, the Brooklands outer-circuit record car: Napier Lion W12, 23.944 L, 580 bhp at 2585
//             rpm [v] (another source: 600 at 2200 [~]); about 2049 kg [v]; wheelbase 3302 [v], length 4724 [~]; Moss
//             three-speed box, no reverse, no synchromesh [v]; drums [v] (one table: no front brakes [?], four kept);
//             the outer-circuit lap record 143.44 mph (1935) [~, not confirmed by the sources read]; track 1500 [?];
//             axle and gears [?]: set for about 270 km/h at the power peak. Racing cross-plies of the 1930s. Centre of
//             gravity 0.55 m [?] (review 100: at 0.66 the test driver could not hold it on the banking).
//   jagD55    1955 Jaguar D-type, long-nose works car (review 97, set against the sources):
//             engine 3442 cc six, dry sump, three Webers: 270 hp at 6000 [v Revs Institute, a 1955 car] (250 bhp at
//             6000 [v Carfolio]); torque 328 Nm (242 lb-ft) at 4000 [v Carfolio]; 4470 x 1638 x 1118, wheelbase 2286
//             [v Encycarpedia]; 1930 lb = 875 kg [v Revs] (864 kerb [v Carfolio]); Dunlop discs all round [v];
//             four speeds, synchromesh [v], ratios [?] (2.14 / 1.39 / 1.10 / 1.00 assumed); axle [?]: 2.79 for Le Mans
//             [~]; red line [?] 6300; tyres Dunlop racing cross-plies 6.50-16 [~]; turning masses [~].
//             Checked against: Le Mans 1955, 172.8 mph (278 km/h) on the Mulsanne [v Wikipedia] -> 279 km/h here
//             (the drag area set by it); Road & Track, May 1956 (XKD 528, a production car, its axle unknown):
//             0-60 mph 4.7 s, 0-100 mph 12.0 s, quarter mile 13.7 s at 106 mph, timed 162.16 mph [v] -> here, on the
//             Le Mans axle: 5.8 s, 11.6 s, 14.0 s at 112 mph, 173 mph (the tall axle slows the start: first gear
//             runs to about 85 mph; on a 3.31 axle 5.0 s, 10.5 s, 13.3 s). Le Mans 1955 fastest lap Hawthorn 4:06.6,
//             122.39 mph [v racingsportscars.com].
const CDA_D = 0.6;   // set below against the Le Mans speed (see the D-type's notes)
const EXP: Record<string, RaceSpec> = {
  napier33: { id: 'napier33', name: '1933 Napier-Railton (실험)', mass: 2049 + 75, wheelbase: 3.302, track: 1.5, tyreR: 0.45, tyreW: 0.18, cgH: 0.55, frontShare: 0.52,
    hp: 580, hpRpm: 2585, torqueRpm: 1700, idle: 500, redline: 2900, gears: [2.2, 1.45, 1.0], final: 1.62, eff: 0.9,
    brakes: 'four', hydraulic: false, brakeG: 0.42, cdA: 1.2, crr: 0.016, steerLock: 24, topKmh: 270, check: false,
    cooling: { siphon: false, margin: 1.35 }, tyreKind: 'racing30', shiftT: 0.6, era: '1933 · 항공 엔진 기록차' },
  jagD55: { id: 'jagD55', name: '1955 Jaguar D-type (실험)', mass: 875 + 75, wheelbase: 2.286, track: 1.27, tyreR: 0.36, tyreW: 0.165, cgH: 0.4, frontShare: 0.49,
    hp: 270, hpRpm: 6000, torqueRpm: 4000, torquePeak: 328, idle: 800, redline: 6300, launchRpm: 4000, inertia: { engine: 0.2, wheel: 1.1 }, gears: [2.14, 1.39, 1.1, 1.0], final: 2.79, eff: 0.92,
    brakes: 'disc', hydraulic: true, brakeG: 0.95, cdA: CDA_D, crr: 0.014, steerLock: 30, topKmh: 278, check: false,
    cooling: { siphon: false, margin: 1.25 }, tyreKind: 'racing50', shiftT: 0.25, era: '1955 · 후대 (디스크 브레이크, 모노코크)' } };
// ---- the 3D-first cars (review 115), of the period, with their figures:
//   auburn851 1935 Auburn 851 Supercharged Speedster: Lycoming straight eight, 4.6 L (280 cu in), Schwitzer-Cummins
//             blower, 150 hp at 4000 [~]; about 1700 kg [~]; three speeds and Columbia's two-speed axle [~] (here its high
//             ratio); every Speedster certified over 100 mph [~] (top about 165 km/h); hydraulic drums [~]; 6.50-16 [~];
//             wheelbase 127 in (3226) [~], track 1470 [?].
//   mb540k    1936 Mercedes-Benz 540 K Special Roadster: straight eight, 5.4 L, 115 PS, 180 PS with the blower engaged [~]
//             (here: the blower's figure); about 2600 kg [~]; four speeds [~]; top about 170 km/h [~]; hydraulic drums,
//             swing-axle independent suspension [~]; 7.00-17 [~]; wheelbase 3290 [~], track 1510 [~].
const NEW: Record<string, RaceSpec> = {
  auburn851: { id: 'auburn851', name: '1935 Auburn 851 Speedster', mass: 1700 + 75, wheelbase: 3.226, track: 1.47, tyreR: 0.365, tyreW: 0.165, cgH: 0.58, frontShare: 0.5,
    hp: 150, hpRpm: 4000, torqueRpm: 2400, idle: 450, redline: 4400, gears: [2.47, 1.6, 1.0], final: 3.0, eff: 0.88,
    brakes: 'four', hydraulic: true, brakeG: 0.6, cdA: 1.3, crr: 0.016, steerLock: 34, topKmh: 167, check: false, cooling: { siphon: false, margin: 1.05 }, tyreKind: 'crossply', era: '1935' },
  mb540k: { id: 'mb540k', name: '1936 Mercedes-Benz 540 K', mass: 2600 + 75, wheelbase: 3.29, track: 1.51, tyreR: 0.392, tyreW: 0.18, cgH: 0.62, frontShare: 0.5,
    hp: 177, hpRpm: 3400, torqueRpm: 2200, idle: 450, redline: 3700, gears: [3.4, 2.1, 1.4, 1.0], final: 3.08, eff: 0.88,
    brakes: 'four', hydraulic: true, brakeG: 0.6, cdA: 1.15, crr: 0.016, steerLock: 33, topKmh: 170, check: false, cooling: { siphon: false, margin: 1.1 }, tyreKind: 'crossply', era: '1936' } };
// review 125: a 1990s technology test (docs/systems/78): the Bugatti EB110 GT. Bugatti: 3.5 V12, four IHI turbos with
// intercoolers at 1.05-1.2 bar, 560 hp at 8,000 rpm, 611 Nm; six speeds; permanent four-wheel drive, a viscous-locking
// centre differential, 27:73; a rear limited-slip differential (Torsen in one source); ABS; a speed-sensitive rear wing;
// double wishbones; 245/40 ZR18 and 325/30 ZR18; 0-100 km/h 3.5 s; 342 km/h. [~]: the gear ratios (fitted to 342 km/h at
// the power peak), the coupling's and the differential's figures, the wing's speeds and areas, the drag area (fitted).
NEW.eb110 = { id: 'eb110', name: '1991 Bugatti EB110 GT (실험)', mass: 1620 + 75, wheelbase: 2.55, track: 1.575, tyreR: 0.326, tyreW: 0.285, cgH: 0.44, frontShare: 0.4,
  hp: 553, hpRpm: 8000, torqueRpm: 3750, torquePeak: 611, idle: 900, redline: 8250, gears: [3.4, 2.25, 1.65, 1.27, 1.03, 0.84], final: 3.4, eff: 0.85,
  brakes: 'disc', hydraulic: true, brakeG: 1.1, cdA: 0.58, crr: 0.012, steerLock: 30, topKmh: 342, check: false, cooling: { siphon: false, margin: 1.2 }, tyreKind: 'radial', era: '1991',
  shiftT: 0.22, launchRpm: 6000, steer: { ratio: 15, ackermann: 0.6, rack: true }, inertia: { engine: 0.22, wheel: 1.7 },
  tech: { rollF: 0.47, drive: { front: 0.27, visc: 60 }, rearLsd: 2.5, abs: true, turbo: { n: 4, boost: 1.1, full: 3800, spool: 0.45 }, wing: { up: 120, down: 90, clA: 0.32, cdA: 0.06, body: 0.12 }, power: true, tyreWF: 0.245, tyreWR: 0.325 } };
// review 126: the Jaguar XJ220 (1992), from the period's and later sources (Wikipedia, Supercars.net, PistonHeads,
// Classic & Sports Car, Car & Classic): 3.5 twin-turbo V6 (JRV-6) 542 bhp at 7,200, 475 lb ft (644 Nm) at 4,500; an FF
// Developments five-speed transaxle with a viscous limited-slip differential (3.00 1.95 1.42 1.09 0.85, final 2.88); rear
// drive; AP Racing brakes, no ABS, no power steering (the prototype's both dropped), 2.6 turns lock to lock (ratio 15 [~]); double
// wishbones; underbody venturis (318 kg at 200 mph in C&SC; Wikipedia's larger figure not used); 1,470 kg; 255/45 ZR17
// and 345/35 ZR18; 0-62 mph 3.6 s; 212.3 mph (341.7 km/h) at Nardo in 1992. [~]: the drag area (fitted), the boost's
// figures, the coupling's, the centre of gravity and the weight's split.
NEW.xj220 = { id: 'xj220', name: '1992 Jaguar XJ220 (실험)', mass: 1470 + 75, wheelbase: 2.64, track: 1.65, tyreR: 0.345, tyreW: 0.3, cgH: 0.45, frontShare: 0.42,
  hp: 542, hpRpm: 7200, torqueRpm: 4500, torquePeak: 644, idle: 900, redline: 7800, gears: [3.0, 1.95, 1.42, 1.09, 0.85], final: 2.88, eff: 0.88,
  brakes: 'disc', hydraulic: true, brakeG: 1.05, cdA: 0.62, crr: 0.012, steerLock: 30, topKmh: 342, check: false, cooling: { siphon: false, margin: 1.15 }, tyreKind: 'radial', era: '1992',
  shiftT: 0.32, launchRpm: 5000, steer: { ratio: 15, ackermann: 0.6, rack: true }, inertia: { engine: 0.2, wheel: 1.8 },
  tech: { rollF: 0.47, rearVisc: 40, turbo: { n: 2, boost: 1.0, full: 4000, spool: 0.5 }, ground: { clA: 0.55, front: 0.38 }, tyreWF: 0.255, tyreWR: 0.345 } };
// review 141: the Lamborghini Diablo (1990), the original rear-drive car (lambocars.com, supercars.net, auto-data.net):
// 5.7 L V12 (four valves a cylinder), 492 hp at 7,000 rpm, 580 Nm at 5,200; five speeds; rear drive, a limited-slip
// differential; no ABS, no power steering (both came later: ABS with the SV/VT updates, power steering on the VT);
// double wishbones; 245/40 ZR17 and 335/35 ZR17; about 1,576 kg; 0-100 km/h about 4.5 s; 325 km/h.
// [~]: the steering ratio (15: at 16 the handicap driver weaved off at 170 km/h, as the XJ220 did), the gear ratios (2.31 1.52 1.12 0.88 0.71, final 3.83: fitted to 325 km/h near the power peak), the drag area
// (fitted to 325 km/h with the power), the centre of gravity and the weight's split, the differential's locking.
NEW.diablo = { id: 'diablo', name: '1990 Lamborghini Diablo (실험)', mass: 1576 + 75, wheelbase: 2.65, track: 1.59, tyreR: 0.333, tyreW: 0.29, cgH: 0.46, frontShare: 0.41,
  hp: 492, hpRpm: 7000, torqueRpm: 5200, torquePeak: 580, idle: 900, redline: 7300, gears: [2.31, 1.52, 1.12, 0.88, 0.71], final: 3.83, eff: 0.86,
  brakes: 'disc', hydraulic: true, brakeG: 1.0, cdA: 0.66, crr: 0.012, steerLock: 30, topKmh: 325, check: false, cooling: { siphon: false, margin: 1.1 }, tyreKind: 'radial', era: '1990',
  shiftT: 0.32, launchRpm: 4500, steer: { ratio: 15, ackermann: 0.6, rack: true }, inertia: { engine: 0.24, wheel: 1.8 },
  tech: { rollF: 0.47, rearLsd: 1.6, tyreWF: 0.245, tyreWR: 0.335 } };
// review 149: the Honda NSX (1990, NA1), five-speed manual, from Honda's and Acura's figures (Acura's 1991 and 1992
// specification sheets and feature lists, Honda's 1990 and 1995 factbooks, the J-Garage specification table) and the
// period's tests: C30A 3.0 L V6, DOHC VTEC, 280 PS JIS / 274 PS (270 hp) at 7,100 rpm, 284 Nm (210 lb ft; Honda Japan 30.0
// kgm at 5,400) at 5,300 rpm, red line 8,000; gears 3.071 1.727 1.230 0.967 0.771, final 4.062 (Acura 1991); 1,365 kg
// (3,010 lb) kerb, 42:58; wheelbase 2,530, track 1,510 / 1,530; double wishbones all round; 205/50 ZR15 and 225/50 ZR16
// (one secondary table gives 215/45 ZR16 at the rear; Acura's 225/50 kept); a variable-ratio rack, 18.2-20.8:1 and 3.24
// turns lock to lock with the manual, no power assistance (the electric power steering was the automatic's, and came on
// every NSX from the 1995 model year: Acura's 1995 press kit), so the manual car carries no `eps`; ABS, four channels;
// traction control (TCS) standard: a throttle actuator on the throttle body reduces the engine's output when the rears
// spin (Acura's service manual), switchable off; a limited-slip differential (to 1994 a wet multi-plate "torque control
// differential", the torque-reactive one from 1995): here as a torque-sensing one. Period tests: 0-60 mph 5.2 s (Car and
// Driver, quoted), 5.7 s (Road & Track), 5.8 s (Consumer Guide), 0-100 km/h 5.6 s; top 157-163 mph (253-262 km/h; the
// European figure 270 km/h). [~]: the VTEC switch-over (about 5,800: owners' reports, no Honda figure found) and the
// cams' curves, the drag area (fitted to 270 km/h; Cd 0.32 x about 1.8 m² is 0.58 before the cooling and the tyres),
// the centre of gravity, the differential's bias (2.0), the TCS's threshold and time, the roll share.
// Not in NEW: the car has no body mesh yet, and the drive page lists NEW_CARS and EXP_CARS with MESH_CARS.find(..)!.mesh()
// (it would fail on choosing it). raceSpec finds it here; when its mesh is registered in render/car/meshcars.ts, move it
// into NEW (NEW.nsx = ..., and delete it from AWAITING_MESH) and time it into race/handicaps.json.
const NSX: RaceSpec = { id: 'nsx', name: '1990 Honda NSX (실험)', mass: 1365 + 75, wheelbase: 2.53, track: 1.52, tyreR: 0.316, tyreW: 0.215, cgH: 0.44, frontShare: 0.42,
  hp: 270, hpRpm: 7100, torqueRpm: 5300, torquePeak: 284, idle: 800, redline: 8000, gears: [3.071, 1.727, 1.23, 0.967, 0.771], final: 4.062, eff: 0.9,
  brakes: 'disc', hydraulic: true, brakeG: 1.0, cdA: 0.63, crr: 0.012, steerLock: 30, topKmh: 270, check: false, cooling: { siphon: false, margin: 1.2 }, tyreKind: 'radial', era: '1990',
  shiftT: 0.22, launchRpm: 5000, steer: { ratio: 19.5, ackermann: 0.6, rack: true }, inertia: { engine: 0.12, wheel: 1.3 },
  tech: { rollF: 0.47, rearLsd: 2.0, abs: true, tcs: { slip: 0.1, tau: 0.15, cut: 0.7 }, vtec: { rpm: 5800, hyst: 200, low: { torque: 284, rpm: 5300 }, high: { rpm: 6500 } }, tyreWF: 0.205, tyreWR: 0.225 } };
/** review 149: an electric power steering of the NSX's kind (the automatic's, and every NSX's from 1995) [~], for the
 *  cars and the tests that carry one: about a quarter of the effort parking, most of it back by motorway speeds */
export const EPS_SPEED_SENSITIVE = { low: 0.25, high: 0.8, fade: 50 };
/** cars whose physics is ready but whose body mesh is not yet built: raceSpec finds them; the drive page does not list them */
export const AWAITING_MESH: Record<string, RaceSpec> = {};
// review 158: the Ferrari F355 Berlinetta (1994), six-speed manual, and the F1 (1997), the same car with the
// electro-hydraulic automated manual (docs/systems/87). Checked 2026-11-24 against: Ferrari's own model pages (as quoted
// in search results: the site itself was not reachable), Wikipedia, auto-data.net, cars-data.com, supercars.net, evo,
// PistonHeads' buying guide, Eurospares' parts catalogue, Automotive News Europe (4 Aug 1997), FerrariChat threads.
//   engine: 3,496 cc 90-degree V8, five valves a cylinder [v]; 380 PS = 375 hp at 8,250 rpm [v], 268 lb ft = 363 Nm at
//   6,000 [v], red line 8,500 (the limiter about 8,750) [v]; dry weight 1,350 kg [v]; kerb 1,483-1,497 (Wikipedia) or
//   about 1,450 with fluids (evo) [~]: 1,450 kept; weight split 42:58 [?] (remembered, no source found); 0-100 km/h
//   4.7 s, top 295 km/h [v]; gears 3.07 2.16 1.61 1.27 1.03 0.84 [~] (a GTS table "identical to the Berlinetta"), final
//   4.35 [~] (forum figures 4.35-4.41, one says 3.56: not used); 225/40 ZR18 and 265/40 ZR18 [v]; double wishbones [v];
//   electronic dampers with two settings (Comfort, Sport), reading road speed, brake pressure, the suspension's load and
//   the steering [v]; a full undertray with a rear diffuser, shaped to share the downforce equally between the axles
//   [v, Ferrari's page] (its amount: a forum figure of about 75 lb at 150 mph [~] -> lift area 0.13); ABS, switchable
//   off [v]; no traction control [~] (none listed; Ferrari's ASR came with the 360); hydraulic power steering standard
//   (a manual rack by special order) [v], about 3.2 turns lock to lock [~] -> ratio 19 at 30 degrees' lock; a limited-
//   slip differential [~] (bias 1.8 [?]). The F1 gearbox (1997): Ferrari's own claim, 150 ms from the clutch fully
//   opening to its closing against 270 ms for a conventional shift [v, Automotive News Europe]; Magneti Marelli's
//   electro-hydraulics on the same six-speed and its single-plate clutch [v]; the throttle blipped on downshifts [~].
//   [~] fitted: the drag area (to 295 km/h; Cx about 0.33 x some 1.9 m² before the cooling and the tyres), the
//   dampers' multipliers, the F1 shift's phases (0.2 s overall: the clutch opening 50 ms, open 80 ms, closing 70 ms),
//   the launch revs, the turning masses, the centre of gravity.
const F355: RaceSpec = { id: 'f355', name: '1994 Ferrari F355 (실험)', mass: 1450 + 75, wheelbase: 2.45, track: 1.565, tyreR: 0.335, tyreW: 0.245, cgH: 0.44, frontShare: 0.42,
  hp: 375, hpRpm: 8250, torqueRpm: 6000, torquePeak: 363, idle: 1000, redline: 8500, gears: [3.07, 2.16, 1.61, 1.27, 1.03, 0.84], final: 4.1, eff: 0.88,
  brakes: 'disc', hydraulic: true, brakeG: 1.0, cdA: 0.66, crr: 0.012, steerLock: 30, topKmh: 295, check: false, cooling: { siphon: false, margin: 1.15 }, tyreKind: 'radial', era: '1994',
  shiftT: 0.27, launchRpm: 5500, steer: { ratio: 19, ackermann: 0.6, rack: true }, inertia: { engine: 0.13, wheel: 1.4 },
  tech: { rollF: 0.47, rearLsd: 1.8, abs: true, power: true, gearbox: 'manual', damp: { comfort: 0.65, sport: 1.3, speedK: 0.3 }, underbody: { clA: 0.13, front: 0.5, cdA: 0.01 }, tyreWF: 0.225, tyreWR: 0.265 } };
/** the F355 with the 1997 F1 gearbox: the same body (mesh 'f355'), the shift of the automated manual */
export function withF1Gearbox(s: RaceSpec): RaceSpec { return { ...s, id: s.id + 'f1', body: s.body ?? s.id, shiftT: 0.2, tech: { ...s.tech, gearbox: 'f1' } }; }
NEW.f355 = F355;   // review 158: its body is built (render/car/mesh_f355.ts) and registered
NEW.f355f1 = { ...withF1Gearbox(F355), name: '1997 Ferrari F355 F1 (실험)', era: '1997' };
// When the F355's mesh is registered (render/car/meshcars.ts), move both into NEW (as the NSX was, review 153), the F1
// on the same mesh id ('f355', its `body`), and time them into race/handicaps.json.
NEW.nsx = NSX;   // review 153: its body mesh is built (render/car/mesh_nsx.ts) and registered
Object.assign(EXP, NEW);
/** the new 3D-first cars, offered beside the period ones */
export const NEW_CARS: string[] = Object.keys(NEW);
export const EXP_CARS: string[] = Object.keys(EXP).filter(id => !NEW[id]);
/** the engine for the sound: cylinders, valves, blower (the experimental cars are not in the game's data) */
export const EXP_ENGINE: Record<string, { kind: string; layout: string; supercharged?: boolean }> = { napier33: { kind: 'ohv', layout: 'W12' }, jagD55: { kind: 'ohv', layout: 'I6' }, auburn851: { kind: 'sv', layout: 'I8', supercharged: true }, mb540k: { kind: 'ohv', layout: 'I8', supercharged: true }, eb110: { kind: 'ohv', layout: 'V12' }, xj220: { kind: 'ohv', layout: 'V6' }, diablo: { kind: 'ohv', layout: 'V12' }, nsx: { kind: 'ohv', layout: 'V6' }, f355: { kind: 'ohv', layout: 'V8' }, f355f1: { kind: 'ohv', layout: 'V8' } };
/** a car made outside this file (the parts builder's design on the drive page, docs/systems/98 B4) offered under its own
 *  id: raceSpec finds it as it finds the experimental cars; the period's and the new cars' lists are not changed */
export function addRaceCar(s: RaceSpec): void { EXP[s.id] = s; }
export function raceSpec(id: string): RaceSpec {
  if (EXP[id]) return EXP[id]!; if (AWAITING_MESH[id]) return AWAITING_MESH[id]!;
  const s = (specs as { cars: Record<string, { car: string; engine: { hp: number }; wheelbase: number; track: number; tyre: string }> }).cars[id]!, p = PERIOD[id]!, t = tyre(s.tyre), hpRpm = p[0];
  return { id, name: s.car, mass: KG[id]! + 75, wheelbase: s.wheelbase / 1000, track: s.track / 1000, tyreR: t.r, tyreW: t.w, cgH: p[6], frontShare: p[7],
    hp: s.engine.hp, hpRpm, torqueRpm: hpRpm * 0.55, idle: Math.max(350, hpRpm * 0.18), redline: hpRpm * 1.12, gears: p[1], final: p[2], eff: 0.88,
    brakes: p[3], hydraulic: p[4], brakeG: p[3] === 'rear' ? 0.32 : p[4] ? 0.62 : 0.5, cdA: p[5], crr: 0.018, steerLock: p[8], topKmh: p[9], check: true, cooling: COOL[id] ?? { siphon: false, margin: 1.1 } }; }

/** engine torque (Nm) at revs, full throttle: a hump peaking at torqueRpm, its power peaking at hpRpm, falling past it.
 *  A VTEC engine (tech.vtec) has a curve for each cam; `cam` picks one, by default the one the switch-over revs give */
export function torqueAt(c: RaceSpec, rpm: number, cam?: 'low' | 'high'): number {
  const V = c.tech?.vtec; if (V) return Math.max(0, camTorque(c, V, rpm, cam ?? (rpm < V.rpm ? 'low' : 'high')));
  const P = c.hp * 745.7, wP = c.hpRpm * Math.PI / 30, Tp = P / wP;          // torque at the power peak
  const Tmax = Math.max(Tp, c.torquePeak ?? Tp * 1.22), x = rpm / c.torqueRpm;                            // the peak torque, a little above
  let T = rpm <= c.torqueRpm ? Tmax * (0.62 + 0.38 * (1 - (1 - x) ** 2)) : Tmax - (Tmax - Tp) * ((rpm - c.torqueRpm) / (c.hpRpm - c.torqueRpm)) ** 1.6;
  if (rpm > c.hpRpm) T = Tp * Math.max(0, 1 - ((rpm - c.hpRpm) / (c.redline * 1.15 - c.hpRpm)) ** 1.5 * 0.9);
  return Math.max(0, T); }

/** review 149: the two cams' curves, each a parabola in the revs about its torque peak (flatter below it). The high cam's
 *  is shaped so its power peaks at hpRpm with the rated power: with u = rpm / its peak revs and up = hpRpm / those,
 *  d(u (1 - a (u - 1)^2)) / du = 0 at up gives a = 1 / ((up - 1)^2 + 2 up (up - 1)). The low cam falls past its peak so
 *  that it meets the high cam at the switch-over (where Honda set it: no step in the pull, only a change of slope). */
function camTorque(c: RaceSpec, V: NonNullable<NonNullable<RaceSpec['tech']>['vtec']>, rpm: number, cam: 'low' | 'high'): number {
  const Tp = c.hp * 745.7 / (c.hpRpm * Math.PI / 30), up = c.hpRpm / V.high.rpm, a = 1 / ((up - 1) ** 2 + 2 * up * (up - 1)), Th = Tp / (1 - a * (up - 1) ** 2);
  const high = (r: number) => { const u = r / V.high.rpm; return Th * Math.max(0.3, 1 - (u < 1 ? 1.5 : a) * (u - 1) ** 2); };   /* a long-duration cam: weak low down */
  if (cam === 'high') return high(rpm);
  const L = V.low, us = V.rpm / L.rpm, b = Math.max(0, 1 - high(V.rpm) / L.torque) / Math.max(1e-6, (us - 1) ** 2), u = rpm / L.rpm;
  return L.torque * Math.max(0.3, 1 - (u < 1 ? 0.7 : b) * (u - 1) ** 2); }

/** the suspension (review 120): what each axle is. A beam axle on leaf springs (nearly every car of the period, and the
 *  D-type's rear on trailing links); independent wheels on wishbones (the 540K's and the 315's front, the D-type's on
 *  torsion bars); a swing axle (the 540K's rear). Leaf springs rub, leaf on leaf (their friction damps small motions). */
export type AxleKind = 'beam' | 'wishbone' | 'swing';
export interface Suspension { front: AxleKind; rear: AxleKind; leafF: boolean; leafR: boolean }
const SUSP: Record<string, Partial<Suspension>> = {
  mb540k: { front: 'wishbone', rear: 'swing', leafF: false, leafR: false },
  bmw315: { front: 'wishbone', leafF: true },
  jagD55: { front: 'wishbone', leafF: false, leafR: false }, eb110: { front: 'wishbone', rear: 'wishbone', leafF: false, leafR: false }, xj220: { front: 'wishbone', rear: 'wishbone', leafF: false, leafR: false }, diablo: { front: 'wishbone', rear: 'wishbone', leafF: false, leafR: false },
  nsx: { front: 'wishbone', rear: 'wishbone', leafF: false, leafR: false }, f355: { front: 'wishbone', rear: 'wishbone', leafF: false, leafR: false } };
export function suspension(c: RaceSpec): Suspension { return { front: 'beam', rear: 'beam', leafF: true, leafR: true, ...SUSP[c.id] ?? (c.body ? SUSP[c.body] : undefined) }; }
