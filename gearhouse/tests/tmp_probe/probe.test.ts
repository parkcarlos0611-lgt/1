import { it } from 'vitest';
import { VolumeSim, type VolParams } from '../../race/volume/sim';
it('probe', () => {
  for (const extra of [{ cutSwirl: 0.3 }, { cutHold: 5, cutFade: 0.25, cutSwirl: 0.3 }, { cutHold: 5, cutFade: 0.25, cutSwirl: 0.5 }, { cutHold: 4, cutFade: 0.3, cutSwirl: 0.4 }] as Partial<VolParams>[]) {
  const P: Partial<VolParams> = { nx: 40, ny: 16, nz: 10, h: 0.4, open: true, fade: 0, wind: [0, 0], alpha: 0, betaS: 0, edge: 0, ...extra };
  const bank = () => { const s = new VolumeSim(P), { nx, ny, nz } = s.P; for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) s.S[s.idx(i, j, k)] = i >= 12 && i < 30 && k < 5 ? 0.8 : 0; return s; };
  const s = bank(), ref = bank(), at = (v: VolumeSim) => v.densityAt(8.4, 3.2, 0.6);
  const car = { x: 1, y: 3.2, z: 0.7, hx: 2.0, hy: 0.85, hz: 0.6, yaw: 0, vx: 12, vy: 0, vz: 0 };
  for (; car.x < 15.5; car.x += car.vx / 30) { s.step(1 / 30, [], [car]); ref.step(1 / 30); }
  const out: string[] = []; for (let n = 0; n <= 240; n++) { if (n % 15 === 0) out.push((at(s) / at(ref)).toFixed(2)); s.step(1 / 30); ref.step(1 / 30); }
  console.log(JSON.stringify(extra), out.join(' ')); }
});
