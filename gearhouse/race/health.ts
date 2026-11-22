// The engine's heat and its failures (review 87, step 6). Coolant: the engine rejects about as much heat to its water as
// it gives to the road; the radiator sheds it by the air through it (the speed, the fan with the revs) against the day's
// air. Boiling (100 C, an open system of the period) drives the water off, and with less water it heats faster still.
// Oil: follows the water and the load, thins when hot. Revs past the red line float the valves.
// Failures come after a warning and by chance, as decided (review 85): no failure below the warnings, and past them a
// hazard that grows with how far past and for how long: a blown head gasket (power down, more heat), a burnt valve
// (power down, rough), run bearings (the engine stops), a seized engine (stops).
export type Failure = 'gasket' | 'valve' | 'bearing' | 'seized';
export interface Cooling { siphon: boolean; margin: number }   // siphon: no water pump (thermosiphon); margin: radiator size against the engine's rated heat
export const WARN = { water: 95, boil: 100, oil: 115, over: 1 } as const;
export class Health {
  water = 20; oil = 20; level = 1; failed: Failure | null = null; overRev = 0; rough = 0;
  private C: number; private G0: number; private rnd: () => number;
  constructor(readonly hp: number, readonly cool: Cooling, seed = 1, readonly ambient = 18) { let r = (seed * 2654435761) % 2147483647 || 1; this.rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    this.C = 60000 + hp * 900;                                   // water and iron, J/K
    this.G0 = hp * 745.7 * 0.95 / 72 * cool.margin; this.water = this.oil = ambient; }
  /** the share of its power the engine still makes */
  get power(): number { return this.failed === 'bearing' || this.failed === 'seized' ? 0 : this.failed === 'gasket' ? 0.62 : this.failed === 'valve' ? 0.78 : 1; }
  get running(): boolean { return this.power > 0; }
  /** warnings now showing: water hot / boiling, oil hot, revs over */
  warnings(rpm: number, redline: number): string[] { const w: string[] = []; if (this.water >= WARN.boil) w.push('boil'); else if (this.water >= WARN.water) w.push('water'); if (this.oil >= WARN.oil) w.push('oil'); if (rpm > redline) w.push('revs'); return w; }
  /** dt s; the engine's revs, its output (W, what goes to the road), the car's speed (m/s); returns a failure the moment it happens */
  step(dt: number, rpm: number, redline: number, power: number, speed: number): Failure | null {
    const heat = Math.max(0, power) * 0.95 * (this.failed === 'gasket' ? 1.35 : 1) + 2500 * (rpm / redline) * (this.running ? 1 : 0);
    const air = Math.min(1.05, 0.2 + speed / 40 + (rpm / redline) * 0.25 * (this.cool.siphon ? 0.4 : 1)), flow = this.cool.siphon ? Math.min(1, 0.45 + (this.water - 40) / 80) : 1;   // a thermosiphon only moves water once it is hot
    const shed = this.G0 * air * Math.max(0.15, flow) * (0.35 + 0.65 * this.level) * (this.water - this.ambient);
    this.water += (heat - shed) / (this.C * (0.55 + 0.45 * this.level)) * dt;
    if (this.water > WARN.boil) { this.level = Math.max(0, this.level - (this.water - WARN.boil) * 0.0009 * dt - 0.0006 * dt); this.water = Math.min(this.water, 140); }
    this.oil += ((this.water + 4 + 10 * Math.max(0, power) / (this.hp * 745.7) + 6 * rpm / redline) - this.oil) / 90 * dt;
    this.overRev = rpm > redline ? this.overRev + dt : Math.max(0, this.overRev - dt * 0.5);
    if (this.failed === 'bearing' || this.failed === 'seized') return null;
    // past the warnings: hazards per second, growing with how far past
    const h: [Failure, number][] = [
      ['gasket', this.failed === 'gasket' ? 0 : Math.max(0, this.water - WARN.boil) * 0.004],
      ['seized', Math.max(0, this.water - 118) * 0.02 + (this.level < 0.35 ? (0.35 - this.level) * 0.3 : 0)],
      ['bearing', Math.max(0, this.oil - 125) * 0.006],
      ['valve', this.failed === 'valve' ? 0 : rpm > redline ? ((rpm / redline - 1) / 0.08) ** 2 * 0.08 * Math.min(1, this.overRev / 1.5) : 0]];
    for (const [f, rate] of h) if (rate > 0 && this.rnd() < rate * dt) { this.failed = f === 'gasket' || f === 'valve' ? (this.failed ?? f) : f; return f; }
    return null; }
}
