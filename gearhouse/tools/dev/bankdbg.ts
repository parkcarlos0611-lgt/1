import { raceSpec } from '../../race/cars';
import { Vehicle } from '../../race/vehicle';
import { VehicleFlat } from '../../race/vehicle_flat';
import { Driver } from '../../race/driver';
import { millbrook } from '../../race/millbrook';
const id = process.argv[2] ?? 'jagD55', dt = 1 / 200, T = millbrook(), W2 = T.spec.width / 2;
for (const C of [Vehicle, VehicleFlat] as const) { const e = new (C as typeof Vehicle)(raceSpec(id), T).place(T.spec.landmarks.find(l => l.kind === 'line')!.s - 4, 0, 0), dr = new Driver(T); let shown = 0;
  for (let k = 0; k < 200 * 120; k++) { const u = dr.drive(e); e.step(dt, u); if (k % 200 === 0 || (Math.abs(e.off) > W2 - 0.5 && shown < 30 && k % 20 === 0)) { if (Math.abs(e.off) > W2 - 0.5) shown++;
      console.log(C.name, (k * dt).toFixed(1), 's', e.s.toFixed(0), T.pieceAt(e.s), 'off', e.off.toFixed(1), 'v', (e.speed * 3.6).toFixed(0), 'steer', u.steer.toFixed(2), 'thr', u.throttle.toFixed(1), 'br', u.brake.toFixed(1), 'tay', (e.tay / 9.81).toFixed(2), 'slipA', e.slipA.map(a => (a * 57.3).toFixed(0)).join('/'), 'load', e.load.map(x => Math.round(x / 100)).join('/'), 'roll', (e.roll * 57.3).toFixed(1), 'tilt', (e.tilt * 57.3).toFixed(0)); }
    if (shown >= 30 || Math.abs(e.off) > W2 + 6) break; } }
