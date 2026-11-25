// The N33's panels for the surface rules of docs/systems/108 (render/car/p959/check.ts measures them): patches of its
// cage's main grid, bounded by its creases, seams and arches' rows. As for the 959, the cells where one panel turns into
// another (the bonnet's lift into the screen's foot, the quarter glass's point, the arches' rows) are in no panel.
import type { Panel } from '../p959/check';

export const N33_PANELS: Panel[] = [
  { name: 'bonnet', rows: [2, 9], cols: [0, 3], along: 1, why: 'at its trailing edge the bonnet meets the cowl\'s ramp to the screen' },
  { name: 'wingF top', rows: [3, 8], cols: [3, 6] },
  { name: 'wingF nose', rows: [2, 4], cols: [4, 7] },
  { name: 'roof', rows: [14, 19], cols: [0, 3] },
  { name: 'door', rows: [10, 17], cols: [5, 9] },
  { name: 'sill', rows: [10, 18], cols: [10, 12], across: 1, why: 'the side skirt stands out from the door\'s foot (hollow at the step, round over the skirt)' },
  { name: 'haunch', rows: [17, 19], cols: [5, 8] },
  { name: 'C pillar', rows: [21, 23], cols: [2, 4], along: 1, why: 'the pillar\'s flank turns into the deck at its foot' },
  { name: 'boot deck', rows: [24, 26], cols: [0, 3], along: 1, why: 'the deck leaves the back window\'s foot in a shallow hollow' },
  { name: 'wingR top', rows: [21, 26], cols: [4, 6] },
  { name: 'wingR side', rows: [21, 24], cols: [5, 7] },
];
