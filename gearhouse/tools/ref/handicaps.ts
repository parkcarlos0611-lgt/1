// The handicapper's book (review 86; per track, review 162): each car's lap times with the test driver, from a
// standing start and flying, for the handicap race's starts. npx tsx tools/ref/handicaps.ts <id> [track] [smooth]
// -> prints one JSON line; run per car and gather into race/handicaps.json under tracks.<track>.cars. The track is a
// TRACKS id (race/tracks.ts; millbrook by default). A lap that ends off the concrete is driven again with a lighter foot.
import { raceSpec } from '../../race/cars';
import { Vehicle } from '../../race/vehicle';
import { Driver } from '../../race/driver';
import { TRACKS, trackDef } from '../../race/tracks';
const id = process.argv[2]!, tk = process.argv.slice(3).find(a => TRACKS.some(t => t.id === a)) ?? 'millbrook', T = trackDef(tk).make(); if (process.argv.includes('smooth')) T.bumpK = 0;   // review 152: 'smooth' times it on the resurfaced track
const START = T.spec.landmarks.find(l => l.kind === 'line')!.s, dt = 1 / 200;
let dare = 0.7;
for (let tries = 0; tries < 5; tries++, dare *= 0.9) { const car = new Vehicle(raceSpec(id), T).place(START - 4, 0, 0), d = new Driver(T, dare); let t = 0, crossings: number[] = [], prev = car.s, bad = false;
  while (t < 1200 && crossings.length < 3) { car.step(dt, d.drive(car)); t += dt; if (T.gap(prev, START) > 0 && T.gap(car.s, START) <= 0 && car.vx > 1) crossings.push(t); prev = car.s; if (car.over || Math.abs(car.off) > T.spec.width / 2 + 1) { bad = true; break; } }
  if (!bad && crossings.length === 3) { console.log(JSON.stringify({ id, standing: +crossings[1]!.toFixed(1), flying: +(crossings[2]! - crossings[1]!).toFixed(1), dare: +dare.toFixed(3) })); process.exit(0); } }   // standing: from rest to the end of the first lap
console.log(JSON.stringify({ id, failed: true }));
