// The real cars' weights into their models (review 71): m.kg the period figure (approximate, from the catalogue's
// sources; check), m.kgModel the parts' own estimate of the car as built, so render/car/stats.ts weightOf gives the
// real weight for the car as it is and moves it by the estimate's difference when parts or the engine change.
//   npx tsx tools/ref/kgset.ts
import { estimate } from '../../render/car/stats';
import { readFileSync, writeFileSync } from 'fs';
const KG: Record<string, number> = { fordT23: 990, chevAB28: 1160, plymU29: 1155, pontiac29: 1250, dodgeV28: 1300, willys27: 1225, buick28: 1590,
  fnTT33: 770, bmw315: 750, dueSSJ35: 2270, dueA21: 1750 };
for (const [c, kg] of Object.entries(KG)) { const f = `data/cars/sheet/${c}.json`, m = JSON.parse(readFileSync(f, 'utf8')); m.kg = kg; m.kgModel = estimate(m);
  writeFileSync(f, JSON.stringify(m, null, 1)); console.log(c, 'real', kg, 'estimate', m.kgModel); }
