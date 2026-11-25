// The ignition (docs/systems/110 part 1, G1): the engine's own state, apart from its physics. Off; the ignition on (the
// power: the gauges' needles sweep to their stops and back, the warning lamps lit); the starter cranking it (0.6 to
// 1.5 s, longer the colder its water); the first catch (firing); the idle, the revs flaring and settling; running.
// A manual gearbox's driver can stall it: the clutch let in too fast with the car hardly moving and too few revs to carry
// it (a dump), or the revs dragged below the stall threshold with the clutch in (lugging); it then stands stalled, the
// ignition still on and the lamps lit, until it is cranked again. The driver switches it off by a fresh press of the
// start control while it runs. Pure: the car's physics (race/vehicle.ts) reads `fuelled` (the engine makes torque),
// `starter` (the starter's torque on the engine) and `flare` (the idle control's raised aim), and feeds the revs, the
// clutch and the water back each step; the page reads `gaugeSweep` and `lamps` for its dials (the drive's HUD, the
// interior's needles through `sweepValue`) and `events` for its sounds and notes.
//
// Controls: the start control is held (the touch HUD's 시동 button, the I or Enter key, a gamepad's Y): from off, the
// ignition comes on at once and the starter turns once it has been held POWER_HOLD seconds; from the ignition on (or a
// stall), it turns at once; let go while cranking, the starter stops (the ignition stays on). The automatic start
// (setting "자동 시동") latches the hold, so one press runs the whole sequence, and never stalls.
export type EnginePhase = 'off' | 'power' | 'cranking' | 'firing' | 'idle' | 'running' | 'stalled';
export type IgnitionEvent = 'power' | 'crank' | 'crankStop' | 'catch' | 'settled' | 'stall' | 'off';
/** what the car tells the ignition each step */
export interface IgnitionFeed { /** the engine's revs, and its idle (rpm) */ rpm: number; idle: number;
  /** a manual gearbox worked by the driver (not the automatic, not the automated manual) with a gear in */ manual: boolean;
  /** the clutch pedal (0 out, 1 down), if the driver works one */ clutch?: number; /** the clutch's engagement as it acts (0 open, 1 locked) */ engaged: number;
  /** the gearbox's input shaft's speed from the wheels (rpm) */ shaftRpm: number; /** the engine's water (deg C), if known */ water?: number }
/** the timings and thresholds (s, shares of idle) */
export const IGN = { powerHold: 0.35, sweepUp: 0.5, sweepHold: 0.15, sweepDown: 0.55, crankMin: 0.6, crankMax: 1.5, crankRpm: 100,
  firing: 0.3, flareT: 1.2, flareK: 0.7, stalledT: 1.0,
  /** a dump: the pedal from at least `down` to at most `up` within `dumpT` s, the shaft under `dumpShaft` x idle and the engine under `dumpRevs` x idle */
  down: 0.7, up: 0.15, dumpT: 0.3, dumpShaft: 0.5, dumpRevs: 2,
  /** lugging: the revs under `lugRevs` x idle with the clutch engaged at least `lugEngaged` for `lugT` s */ lugRevs: 0.6, lugEngaged: 0.6, lugT: 0.25 } as const;
/** the whole sweep's time (s) */
export const SWEEP_T = IGN.sweepUp + IGN.sweepHold + IGN.sweepDown;
/** the needles' sweep at t s after the ignition came on: 0 to 1 (eased), held at the stops, back to 0; 0 after */
export function sweepAt(t: number): number { if (t < 0 || t >= SWEEP_T) return 0; const e = (x: number) => x * x * (3 - 2 * x);
  if (t < IGN.sweepUp) return e(t / IGN.sweepUp); if (t < IGN.sweepUp + IGN.sweepHold) return 1; return e(1 - (t - IGN.sweepUp - IGN.sweepHold) / IGN.sweepDown); }
/** a needle's value with the sweep laid over it: never below the sweep's share of its scale (for the HUD's dials and the interior's, render/car/interior) */
export function sweepValue(v: number, sweep: number, min: number, max: number): number { return Math.max(v, min + (max - min) * Math.max(0, Math.min(1, sweep))); }
/** how long the starter must turn it (s): 0.6 warm (water 70 C or more), 1.5 at -10 C, a little either way by `jitter` (0..1) */
export function crankTime(water: number | undefined, jitter = 0.5): number { const cold = Math.max(0, Math.min(1, (70 - (water ?? 20)) / 80)), j = (jitter - 0.5) * 0.2;
  return Math.max(IGN.crankMin, Math.min(IGN.crankMax, IGN.crankMin + (IGN.crankMax - IGN.crankMin) * cold + j)); }
const NAMES: Record<EnginePhase, string> = { off: '꺼짐', power: '전원 켜짐', cranking: '크랭킹', firing: '시동 걸리는 중', idle: '공회전', running: '작동 중', stalled: '시동 꺼뜨림' };

export class Ignition {
  phase: EnginePhase; /** time in the phase (s) */ t = 0; /** since the ignition came on (s; -1 off) */ private onT = -1;
  /** the automatic start (the hold latched, no stalling) and whether a stall can happen at all (off on the easy settings) */ auto = false; stallable = false;
  /** what happened, oldest first, for the page to take (its sounds and notes) */ readonly events: IgnitionEvent[] = [];
  private need = IGN.crankMin; private held = false; private firstHold = false; private holdT = 0; private latch = false;
  private pedal = 0; private sinceDown = Infinity; private lugT = 0; private rnd: () => number;
  constructor(start: 'off' | 'running' = 'running', seed = 1) { this.phase = start; let r = (seed * 2654435761) % 2147483647 || 1; this.rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; }; }
  /** the engine makes its torque (fuel and spark) */ get fuelled(): boolean { return this.phase === 'firing' || this.phase === 'idle' || this.phase === 'running'; }
  /** the starter turns it */ get starter(): boolean { return this.phase === 'cranking'; }
  /** the ignition on (the dials lit) */ get ignition(): boolean { return this.phase !== 'off'; }
  /** the needles' sweep now, 0..1 */ get gaugeSweep(): number { return this.onT < 0 ? 0 : sweepAt(this.onT); }
  /** the warning lamps: lit through the sweep (the bulb check), and while the ignition is on with the engine not running, out a moment after it catches (the oil and charge lamps) */
  get lamps(): boolean { return this.phase !== 'off' && (this.gaugeSweep > 0 || !this.fuelled || this.phase === 'firing'); }
  /** the idle control's raised aim over idle (a share of it): the flare after the catch, settling to 0 */
  get flare(): number { if (this.phase === 'firing') return IGN.flareK; if (this.phase === 'idle') { const x = Math.min(1, this.t / IGN.flareT); return IGN.flareK * (1 - x) * (1 - x); } return 0; }
  /** the cranking this start needs (s) */ get crankNeed(): number { return this.need; }
  /** the phase as the screens write it */ get label(): string { return NAMES[this.phase]; }
  private go(p: EnginePhase, ev?: IgnitionEvent): void { this.phase = p; this.t = 0; if (ev) { this.events.push(ev); if (this.events.length > 16) this.events.shift(); } }
  /** switched off (the key turned back) */
  switchOff(): void { if (this.phase === 'off') return; this.onT = -1; this.latch = false; this.go('off', 'off'); }
  /** running at once (the automatic start's car on the grid, a driver handed the car) */
  startNow(): void { this.onT = -1; this.latch = false; this.go('running'); }
  take(): IgnitionEvent[] { return this.events.splice(0); }
  /** one step: dt s, the start control held, what the car tells */
  step(dt: number, hold: boolean, f: IgnitionFeed): void {
    const press = hold && !this.held; this.held = hold; if (!hold) this.firstHold = false;
    if (this.onT >= 0) this.onT += dt; this.t += dt;
    if (press && this.fuelled && !this.latch) { this.switchOff(); this.trackPedal(dt, f); return; }   // a fresh press while it runs: off
    if (this.auto && press && !this.fuelled) this.latch = true;
    const want = hold || this.latch;
    switch (this.phase) {
      case 'off': if (want) { this.onT = 0; this.firstHold = hold; this.holdT = 0; this.go('power', 'power'); } break;
      case 'power': case 'stalled':
        if (this.phase === 'stalled' && this.t >= IGN.stalledT && !want) this.go('power');
        if (want) { this.holdT += dt; if (!(this.firstHold || this.latch) || this.holdT >= IGN.powerHold) { this.need = crankTime(f.water, this.rnd()); this.go('cranking', 'crank'); } } break;
      case 'cranking': if (!want) { this.go('power', 'crankStop'); break; } if (this.t >= this.need && f.rpm >= IGN.crankRpm) { this.latch = false; this.go('firing', 'catch'); } break;
      case 'firing': if (this.t >= IGN.firing) this.go('idle'); break;
      case 'idle': if (this.t >= IGN.flareT) this.go('running', 'settled'); break;
      case 'running': break; }
    if (this.trackPedal(dt, f) && this.stallable && !this.auto && (this.phase === 'idle' || this.phase === 'running')) this.go('stalled', 'stall');
  }
  /** the stall rule's state kept up each step: true when this step would stall it */
  private trackPedal(dt: number, f: IgnitionFeed): boolean { const p = f.clutch ?? 0, was = this.pedal; this.pedal = p;
    if (p >= IGN.down) this.sinceDown = 0; else this.sinceDown += dt;
    if (!f.manual) { this.lugT = 0; return false; }
    const dump = was > IGN.up && p <= IGN.up && this.sinceDown <= IGN.dumpT && f.shaftRpm < f.idle * IGN.dumpShaft && f.rpm < f.idle * IGN.dumpRevs;
    this.lugT = f.rpm < f.idle * IGN.lugRevs && f.engaged >= IGN.lugEngaged ? this.lugT + dt : 0;
    return dump || this.lugT >= IGN.lugT; }
}
