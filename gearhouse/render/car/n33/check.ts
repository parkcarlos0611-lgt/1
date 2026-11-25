// The N33's panels for the surface rules of docs/systems/108 (render/car/p959/check.ts measures them): patches of its
// (third) cage's main grid, bounded by its creases, seams and arches' rows. As for the 959, the cells where one panel turns into
// another (the bonnet's brow behind its leading edge, which dips over the grille; its lift into the screen's foot; the quarter
// glass's point; the arches' rows) are in no panel.
import type { Panel } from '../p959/check';

export const N33_PANELS: Panel[] = [
  { name: 'bonnet middle', rows: [5, 12], cols: [0, 1] },
  { name: 'bonnet flank', rows: [5, 12], cols: [2, 4], across: 1, why: 'the foot of the ramp down from the raised middle (a drawn line)' },
  { name: 'wingF top', rows: [5, 11], cols: [6, 8] },
  { name: 'wingF side', rows: [6, 11], cols: [9, 11] },
  { name: 'roof', rows: [18, 23], cols: [0, 5] },
  { name: 'door', rows: [14, 21], cols: [9, 14] },
  { name: 'sill', rows: [14, 22], cols: [15, 17], across: 1, why: 'the side skirt stands out from the door\'s foot (hollow at the step, round over the skirt)' },
  { name: 'haunch', rows: [20, 22], cols: [9, 11] },
  { name: 'C pillar', rows: [25, 27], cols: [6, 8], across: 1, along: 1, why: 'the pillar\'s flank rounds off its crest and turns into the deck at its foot' },
  { name: 'boot deck', rows: [28, 30], cols: [0, 6], along: 1, why: 'the deck leaves the back window\'s foot in a shallow hollow' },
  { name: 'wingR top', rows: [25, 30], cols: [8, 10] },
  { name: 'wingR side', rows: [25, 28], cols: [9, 11] },
];
