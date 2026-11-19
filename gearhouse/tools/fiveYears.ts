// Five years of ordinary play, many times over, to see whether the slice's numbers hold together.
// npx tsx tools/fiveYears.ts [runs]
import { newWorld } from '../core/world';
import { runBot } from '../core/bot';
const runs = +(process.argv[2] ?? 30), rows: ReturnType<typeof runBot>[] = [], t0 = performance.now(); let cashEnd = 0, rep = 0, town = 0;
for (let seed = 1; seed <= runs; seed++) { const w = newWorld(seed, { background: 'coachbuilder', age: 31 }), log = runBot(w, 1826); rows.push(log); cashEnd += w.sim.g.ledger.cash; rep += w.sim.g.market.reputation.quality; town += w.sim.g.market.awareness.town; }
const avg = (f: (r: ReturnType<typeof runBot>) => number) => (rows.reduce((t, r) => t + f(r), 0) / rows.length).toFixed(1), sat = rows.flatMap(r => r.satisfaction);
console.log(`${runs} runs of 5 years in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
console.log(`bankrupt: ${rows.filter(r => r.bankruptDate).length} of ${runs}` + (rows.some(r => r.bankruptDate) ? `  (first: ${rows.filter(r => r.bankruptDate).map(r => r.bankruptDate).sort()[0]})` : ''));
console.log(`per run: inquiries ${avg(r => r.inquiries)}, quoted ${avg(r => r.quoted)}, orders ${avg(r => r.orders)}, delivered ${avg(r => r.delivered)}, could not pay ${avg(r => r.cannotPay)}`);
console.log(`satisfaction: mean ${(sat.reduce((a, b) => a + b, 0) / Math.max(1, sat.length)).toFixed(0)}, pleased (>=60) ${(sat.filter(s => s >= 60).length / Math.max(1, sat.length) * 100).toFixed(0)}%, unhappy (<0) ${(sat.filter(s => s < 0).length / Math.max(1, sat.length) * 100).toFixed(0)}%`);
console.log(`end: cash ${(cashEnd / runs).toFixed(0)}, lowest cash ${avg(r => r.minCash)}, quality reputation ${(rep / runs).toFixed(0)}, town awareness ${(town / runs).toFixed(0)}`);
