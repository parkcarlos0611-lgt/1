import { it } from 'vitest';
import { Smoke } from '../../race/smoke';
it('probe', () => {
    const s = new Smoke(); s.wind = [0, 0]; for (let k = 0; k < 40; k++) s.emit('tyre', 10 + (k % 10) * 0.5, -1.5 + Math.floor(k / 10), 0.6, 0, 0, 0);
    for (let t = 0; t < 1; t += 1 / 60) s.step(1 / 60); const r0 = s.parcels.map(p => p.r);
    const car = { x: 4, y: 0, z: 0, yaw: 0, vx: 15, vy: 0, len: 4.4, width: 1.8, height: 1.3 };
    for (let t = 0; t < 0.8; t += 1 / 60) { car.x += car.vx / 60; s.cars = [car]; s.step(1 / 60); }
    console.log(s.parcels.map((p, i) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} r${r0[i]!.toFixed(2)}->${p.r.toFixed(2)} v${p.vy.toFixed(1)},${p.vz.toFixed(1)}`).join('\n'));
});
