// Gearbox + driveline + vehicle performance model. Gearbox types are era-gated; ratios auto-proposed then player-tunable.
import { engineStats } from './engine.mjs';

export const GEARBOX = {        // efficiency, mass kg, unit cost $, comfort 0..1, shift time s, max torque factor, available year
  crash3:  { name: '3-SPD CRASH BOX',          eff: 0.94, mass: 45, cost: 40, comfort: 0.25, shift: 1.2, year: 1900, gears: [3, 4] },
  sync3:   { name: '3-SPD SYNCHROMESH',        eff: 0.94, mass: 48, cost: 55, comfort: 0.55, shift: 0.8, year: 1929, gears: [3, 4] },
  sync4:   { name: '4-SPD SYNCHROMESH',        eff: 0.93, mass: 60, cost: 75, comfort: 0.60, shift: 0.8, year: 1934, gears: [4, 5] },
  od3:     { name: '3-SPD + OVERDRIVE',        eff: 0.935, mass: 62, cost: 85, comfort: 0.62, shift: 0.9, year: 1934, gears: [4, 4] },
  fluid:   { name: 'FLUID CLUTCH SEMI-AUTO',   eff: 0.90, mass: 70, cost: 110, comfort: 0.75, shift: 1.0, year: 1939, gears: [4, 4] },
  hydra4:  { name: 'FLUID COUPLING 4-SPD AUTO', eff: 0.86, mass: 95, cost: 160, comfort: 0.92, shift: 0.6, year: 1940, gears: [4, 4] },
  tc2:     { name: 'TORQUE CONVERTER 2-SPD AUTO', eff: 0.84, mass: 90, cost: 150, comfort: 0.95, shift: 0.5, year: 1950, gears: [2, 2] } };

// geometric ratio ladder from `first` down to `top` (top < 1 = overdrive)
export function proposeRatios(n, first = 2.8, top = 1.0) { const k = Math.pow(top / first, 1 / Math.max(1, n - 1)); return Array.from({ length: n }, (_, i) => +(first * Math.pow(k, i)).toFixed(2)); }

// car = { engine (design), gearbox: { type, ratios }, final, tyreR (m), mass (kg), cda (m^2), crr, driveFrac, mu }
export function simulate(car) {
  const es = car.es || engineStats(car.engine), G = GEARBOX[car.gearbox.type], R = car.gearbox.ratios, fd = car.final, r = car.tyreR;
  const m = car.mass + (es.mass - 200) + G.mass, g = 9.81, rho = 1.2, crr = car.crr ?? 0.018, cda = car.cda ?? 2.1;
  const tq = rpm => { const c = es.curve; if (rpm <= c[0].rpm) return c[0].T * 0.85; if (rpm >= c.at(-1).rpm) return 0; const i = Math.floor((rpm - c[0].rpm) / 100); return c[i].T + (c[i + 1] ? (c[i + 1].T - c[i].T) * ((rpm - c[i].rpm) / 100) : 0); };
  const rpmAt = (v, gi) => v / r * R[gi] * fd * 60 / (2 * Math.PI), resist = v => crr * m * g + 0.5 * rho * cda * v * v;
  const force = (v, gi) => { const rpm = Math.max(rpmAt(v, gi), 900); return rpm > es.redline ? 0 : Math.min(tq(rpm) * R[gi] * fd * G.eff / r, (car.mu ?? 0.75) * m * g * (car.driveFrac ?? 0.55)); };
  // top speed: highest v where some gear still out-pulls resistance
  let vmax = 0; for (let v = 1; v < 70; v += 0.25) if (R.some((_, gi) => force(v, gi) > resist(v))) vmax = v;
  // 0-60 mph with shift pauses
  let v = 0, t = 0, gi = 0, pause = 0; const dt = 0.05;
  while (v < 26.8 && t < 99) { if (pause > 0) pause -= dt; else { let f = force(v, gi); if (gi + 1 < R.length && (rpmAt(v, gi) > es.redline * 0.97 || force(v, gi + 1) > f)) { gi++; pause = G.shift; } else v += (f - resist(v)) / m * dt; }
    if (pause > 0) v = Math.max(0, v - resist(v) / m * dt); t += dt; }
  // grade-ability in first gear at peak torque
  const f1 = Math.min(es.torque * R[0] * fd * G.eff / r, (car.mu ?? 0.75) * m * g * (car.driveFrac ?? 0.55)), grade = Math.max(0, Math.min(0.9, (f1 - crr * m * g) / (m * g)));
  // cruise economy at 45 mph in top gear (part-load BSFC penalty)
  const vc = 20.1, rc = rpmAt(vc, R.length - 1), pNeed = resist(vc) * vc / G.eff, pAvail = Math.max(1, tq(Math.max(900, rc)) * Math.max(900, rc) * Math.PI / 30), load = Math.min(1, pNeed / pAvail);
  const bsfc = es.bsfc * (1 + 1.6 * Math.pow(1 - load, 2)) * (rc > es.redline * 0.75 ? 1.15 : 1), kgph = bsfc * pNeed / 1000, lp100 = kgph / 0.74 / (vc * 3.6) * 100;
  return { topKmh: vmax * 3.6, topMph: vmax * 2.237, zeroSixty: t >= 99 ? null : t, grade, mpg: 235.2 / lp100, lp100, mass: Math.round(m), cruiseRpm: Math.round(rc), comfort: G.comfort };
}
