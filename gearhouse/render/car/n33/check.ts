// The N33's panels for the surface rules of docs/systems/108 (render/car/p959/check.ts measures them): patches of its
// cage's main grid, bounded by its creases, seams and arches' rows.
import type { Panel } from '../p959/check';

export const N33_PANELS: Panel[] = [
  { name: 'bonnet', rows: [2, 10], cols: [0, 3] },
  { name: 'wingF top', rows: [3, 8], cols: [3, 6] },
  { name: 'wingF nose', rows: [2, 4], cols: [5, 8], why: 'the wing ahead of the arch, down to the bumper seam' },
  { name: 'roof', rows: [14, 19], cols: [0, 3] },
  { name: 'door', rows: [10, 17], cols: [5, 8] },
  { name: 'sill', rows: [10, 18], cols: [9, 11] },
  { name: 'haunch', rows: [17, 19], cols: [5, 7] },
  { name: 'C pillar', rows: [19, 23], cols: [2, 4] },
  { name: 'boot deck', rows: [23, 26], cols: [0, 4] },
  { name: 'wingR side', rows: [23, 26], cols: [5, 8] },
];
