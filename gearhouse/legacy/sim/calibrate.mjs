// node sim/calibrate.mjs -> calibration report: model vs historical engines (target |err| <= 10 %)
import { engineStats } from './engine.mjs';
export const REF = [
  ['1932 L-head V8 221', { layout: 'V8', head: 'sv', bore: 77.8, stroke: 95.25, cr: 5.5, cam: 0.3, carbs: 1, year: 1932 }, 65, 3400, 176],
  ['1941 4x4 L-head I4 134', { layout: 'I4', head: 'sv', bore: 79.4, stroke: 111.1, cr: 6.5, cam: 0.35, carbs: 1, year: 1941 }, 60, 4000, 142],
  ['1942 L-head V8 221', { layout: 'V8', head: 'sv', bore: 77.8, stroke: 95.25, cr: 6.2, cam: 0.35, carbs: 1, year: 1942 }, 90, 3800, 212],
  ['1946 L-head V8 239', { layout: 'V8', head: 'sv', bore: 81, stroke: 95.25, cr: 6.8, cam: 0.35, carbs: 1, year: 1946 }, 100, 3800, 244],
  ['1941 OHV I6 216', { layout: 'I6', head: 'ohv', bore: 88.9, stroke: 95.25, cr: 6.5, cam: 0.25, carbs: 1, carbSize: 0.8, year: 1941 }, 90, 3300, 236],
  ['1941 OHV I6 270 (truck)', { layout: 'I6', head: 'ohv', bore: 96, stroke: 101.6, cr: 6.75, cam: 0.05, carbs: 1, carbSize: 0.7, year: 1941 }, 91.5, 2750, 293],
  ['1940 L-head V12 292', { layout: 'V12', head: 'sv', bore: 73, stroke: 95.25, cr: 7.2, cam: 0.3, carbs: 1, year: 1940 }, 120, 3500, 298],
  ['1941 L-head V8 346', { layout: 'V8', head: 'sv', bore: 88.9, stroke: 114.3, cr: 7.25, cam: 0.3, carbs: 1, carbSize: 1.2, year: 1941 }, 150, 3400, 384],
  ['1948 L-head I8 254', { layout: 'I8', head: 'sv', bore: 76.2, stroke: 114.3, cr: 6.5, cam: 0.35, carbs: 1, year: 1948 }, 128, 4200, 305],
  ['1949 OHV V8 303', { layout: 'V8', head: 'ohv', bore: 95.25, stroke: 87.3, cr: 7.25, cam: 0.25, carbs: 1, carbSize: 0.9, year: 1949 }, 135, 3600, 359]];
if (import.meta.url === `file://${process.argv[1]}`) {
  let worst = 0; console.log('engine'.padEnd(28), 'hp model/ref', 'rpm', 'Nm model/ref', 'redline');
  for (const [n, e, hp, rpm, nm] of REF) { const s = engineStats(e), eh = (s.hp - hp) / hp, et = (s.torque - nm) / nm; worst = Math.max(worst, Math.abs(eh), Math.abs(et));
    console.log(n.padEnd(28), `${s.hp.toFixed(0)}/${hp}`.padEnd(12), `${s.hpRpm}/${rpm}`.padEnd(10), `${s.torque.toFixed(0)}/${nm}`.padEnd(12), s.redline, `err ${(eh * 100).toFixed(0)}% ${(et * 100).toFixed(0)}%`); }
  console.log('worst', (worst * 100).toFixed(1) + '%');
}
