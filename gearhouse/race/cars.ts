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
  tech?: { drive?: { front: number; visc: number }; rearLsd?: number; /** a viscous-coupling rear differential instead (Nm per rad/s between the wheels) */ rearVisc?: number;
    /** ground effect (review 126): the underbody's venturis, a lift area pressing the car down more the lower it rides (its share on the front) */ ground?: { clA: number; front: number }; abs?: boolean; turbo?: { n: number; boost: number; full: number; spool: number };
    wing?: { up: number; down: number; clA: number; cdA: number; body: number }; power?: boolean; tyreWF?: number; tyreWR?: number };
  cdA: number; crr: number; steerLock: number;          // drag area m², rolling resistance, front wheels' lock (deg)
  topKmh: number; check: boolean;
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
  tech: { drive: { front: 0.27, visc: 60 }, rearLsd: 2.5, abs: true, turbo: { n: 4, boost: 1.1, full: 3800, spool: 0.45 }, wing: { up: 120, down: 90, clA: 0.32, cdA: 0.06, body: 0.12 }, power: true, tyreWF: 0.245, tyreWR: 0.325 } };
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
  tech: { rearVisc: 40, turbo: { n: 2, boost: 1.0, full: 4000, spool: 0.5 }, ground: { clA: 0.55, front: 0.38 }, tyreWF: 0.255, tyreWR: 0.345 } };
Object.assign(EXP, NEW);
/** the new 3D-first cars, offered beside the period ones */
export const NEW_CARS: string[] = Object.keys(NEW);
export const EXP_CARS: string[] = Object.keys(EXP).filter(id => !NEW[id]);
/** the engine for the sound: cylinders, valves, blower (the experimental cars are not in the game's data) */
export const EXP_ENGINE: Record<string, { kind: string; layout: string; supercharged?: boolean }> = { napier33: { kind: 'ohv', layout: 'W12' }, jagD55: { kind: 'ohv', layout: 'I6' }, auburn851: { kind: 'sv', layout: 'I8', supercharged: true }, mb540k: { kind: 'ohv', layout: 'I8', supercharged: true }, eb110: { kind: 'ohv', layout: 'V12' }, xj220: { kind: 'ohv', layout: 'V6' } };
export function raceSpec(id: string): RaceSpec {
  if (EXP[id]) return EXP[id]!;
  const s = (specs as { cars: Record<string, { car: string; engine: { hp: number }; wheelbase: number; track: number; tyre: string }> }).cars[id]!, p = PERIOD[id]!, t = tyre(s.tyre), hpRpm = p[0];
  return { id, name: s.car, mass: KG[id]! + 75, wheelbase: s.wheelbase / 1000, track: s.track / 1000, tyreR: t.r, tyreW: t.w, cgH: p[6], frontShare: p[7],
    hp: s.engine.hp, hpRpm, torqueRpm: hpRpm * 0.55, idle: Math.max(350, hpRpm * 0.18), redline: hpRpm * 1.12, gears: p[1], final: p[2], eff: 0.88,
    brakes: p[3], hydraulic: p[4], brakeG: p[3] === 'rear' ? 0.32 : p[4] ? 0.62 : 0.5, cdA: p[5], crr: 0.018, steerLock: p[8], topKmh: p[9], check: true, cooling: COOL[id] ?? { siphon: false, margin: 1.1 } }; }

/** engine torque (Nm) at revs, full throttle: a hump peaking at torqueRpm, its power peaking at hpRpm, falling past it */
export function torqueAt(c: RaceSpec, rpm: number): number {
  const P = c.hp * 745.7, wP = c.hpRpm * Math.PI / 30, Tp = P / wP;          // torque at the power peak
  const Tmax = Math.max(Tp, c.torquePeak ?? Tp * 1.22), x = rpm / c.torqueRpm;                            // the peak torque, a little above
  let T = rpm <= c.torqueRpm ? Tmax * (0.62 + 0.38 * (1 - (1 - x) ** 2)) : Tmax - (Tmax - Tp) * ((rpm - c.torqueRpm) / (c.hpRpm - c.torqueRpm)) ** 1.6;
  if (rpm > c.hpRpm) T = Tp * Math.max(0, 1 - ((rpm - c.hpRpm) / (c.redline * 1.15 - c.hpRpm)) ** 1.5 * 0.9);
  return Math.max(0, T); }

/** the suspension (review 120): what each axle is. A beam axle on leaf springs (nearly every car of the period, and the
 *  D-type's rear on trailing links); independent wheels on wishbones (the 540K's and the 315's front, the D-type's on
 *  torsion bars); a swing axle (the 540K's rear). Leaf springs rub, leaf on leaf (their friction damps small motions). */
export type AxleKind = 'beam' | 'wishbone' | 'swing';
export interface Suspension { front: AxleKind; rear: AxleKind; leafF: boolean; leafR: boolean }
const SUSP: Record<string, Partial<Suspension>> = {
  mb540k: { front: 'wishbone', rear: 'swing', leafF: false, leafR: false },
  bmw315: { front: 'wishbone', leafF: true },
  jagD55: { front: 'wishbone', leafF: false, leafR: false }, eb110: { front: 'wishbone', rear: 'wishbone', leafF: false, leafR: false }, xj220: { front: 'wishbone', rear: 'wishbone', leafF: false, leafR: false } };
export function suspension(c: RaceSpec): Suspension { return { front: 'beam', rear: 'beam', leafF: true, leafR: true, ...SUSP[c.id] }; }
