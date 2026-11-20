// The drive from engine to wheels for the test drive (review 24): engine torque by revs, a slipping clutch from
// rest, a four-speed gearbox that changes up and down by itself, a two-speed transfer box (high and low), the axle
// ratio. The first build's full chain (legacy/sim/dyn.mjs) replaces this once the design's real figures feed it.
export interface PowertrainSpec { peakTorque: number; peakRpm: number; width: number; idle: number; redline: number; gears: number[]; reverse: number; final: number; high: number; low: number; eff: number }
/** a 1.6 litre four of 1948: about 50 hp, 108 Nm at 2000 rpm; transfer 1.148 high, 2.52 low; axles 4.7 */
export const UTILITY48_DRIVE: PowertrainSpec = { peakTorque: 108, peakRpm: 2000, width: 3500, idle: 600, redline: 4300, gears: [2.99, 2.04, 1.38, 1.0], reverse: 2.64, final: 4.7, high: 1.148, low: 2.52, eff: 0.85 };

export class Powertrain {
  gear = 1; range: 'high' | 'low' = 'high'; rpm: number; reversing = false; clutch = 1;
  constructor(public s: PowertrainSpec) { this.rpm = s.idle; }
  torqueAt(rpm: number) { const s = this.s; if (rpm > s.redline) return Math.max(0, s.peakTorque * 0.6 * (1 - (rpm - s.redline) / 300)); return s.peakTorque * Math.max(0.35, 1 - ((rpm - s.peakRpm) / s.width) ** 2); }
  ratio() { const s = this.s; return (this.reversing ? s.reverse : s.gears[this.gear - 1]!) * s.final * (this.range === 'high' ? s.high : s.low); }
  /** wheel speed (rad/s, forward positive) and the driver's pedal (-1 back .. 1 forward) -> total torque at the wheels (N m) */
  update(dt: number, wheelW: number, pedal: number, groundW = wheelW): number {
    const s = this.s;
    if (pedal < 0 && wheelW < 0.5) this.reversing = true; else if (pedal > 0 && wheelW > -0.5) this.reversing = false;
    const dir = this.reversing ? -1 : 1, shaftRpm = Math.abs(wheelW) * this.ratio() * 60 / (Math.PI * 2);
    // a clutch let in by the revs: below 1100 rpm at the wheels it slips and the engine holds its own revs
    const want = Math.abs(pedal) > 0.05 && Math.sign(pedal) === dir ? 1000 + 900 * Math.abs(pedal) : s.idle;
    this.clutch = Math.min(1, shaftRpm / 1100); const target = Math.max(shaftRpm, want * (1 - this.clutch) + shaftRpm * this.clutch, s.idle);
    this.rpm += (Math.min(target, s.redline + 250) - this.rpm) * Math.min(1, dt * 12);
    const groundRpm = Math.abs(groundW) * this.ratio() * 60 / (Math.PI * 2);
    if (!this.reversing) { if (groundRpm > 3400 && this.gear < s.gears.length) this.gear++; else if (groundRpm < 1250 && this.gear > 1 && Math.abs(pedal) > 0.3) this.gear--; }   // by road speed, so wheelspin does not change up
    if (Math.abs(pedal) < 0.05 || Math.sign(pedal) !== dir) return 0;
    const gov = Math.max(0, Math.min(1, (s.redline - shaftRpm) / 400));                  // the wheels cannot run the engine past its governed revs
    return dir * this.torqueAt(this.rpm) * this.ratio() * s.eff * Math.abs(pedal) * gov;
  }
  /** km/h at which this gear reaches the given revs, for the readout */
  speedAt(rpm: number, wheelR: number) { return rpm / this.ratio() * Math.PI * 2 / 60 * wheelR * 3.6; }
}
