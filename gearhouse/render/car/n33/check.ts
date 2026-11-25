// The N33's panels for the surface rules of docs/systems/108 (render/car/p959/check.ts measures them): patches of its
// cage's main grid, bounded by its creases, seams and arches' rows. As for the 959, the cells where one panel turns into
// another (the bonnet's lift into the screen's foot, the quarter glass's point, the arches' rows) are in no panel.
import type { Panel } from '../p959/check';

export const N33_PANELS: Panel[] = [
  { name: 'bonnet', rows: [2, 8], cols: [0, 3] },
  { name: 'wingF top', rows: [3, 8], cols: [3, 6], across: 1, why: 'the wing\'s crest rises out of the bonnet\'s shut line, which lies in a shallow valley' },
  { name: 'wingF nose', rows: [2, 4], cols: [5, 8], along: 1, why: 'the wing ahead of the arch; along its foot the bumper seam bends a degree as it reaches the arch' },
  { name: 'roof', rows: [14, 19], cols: [0, 3], along: 2, why: 'the drip rail turns in at the screen\'s top corner (in plan) before it runs back' },
  { name: 'door', rows: [10, 17], cols: [5, 8] },
  { name: 'sill', rows: [10, 18], cols: [9, 11], across: 1, why: 'the side skirt stands out from the door\'s foot (hollow at the step, round over the skirt)' },
  { name: 'haunch', rows: [17, 19], cols: [5, 7] },
  { name: 'C pillar', rows: [21, 23], cols: [2, 4], along: 1, why: 'the pillar\'s flank turns into the deck at its foot' },
  { name: 'boot deck', rows: [24, 26], cols: [0, 4], along: 1, why: 'the deck leaves the back window\'s foot in a shallow hollow' },
  { name: 'wingR side', rows: [24, 26], cols: [5, 7] },
];
