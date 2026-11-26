// Five years of ordinary play, many times over, to see whether the slice's numbers hold together.
// npx tsx tools/fiveYears.ts [runs] [key=value ...]   e.g. chances=0 cash=1800 pleasedAt=50 reputationPull=1 qualityMid=42 defectBelow=68 breakdown=0.004
import { newWorld, DATA } from '../core/world';
import { runBot, type BotLog } from '../core/bot';
const args = process.argv.slice(2), runs = +(args.find(a => !a.includes('=')) ?? 30), set = Object.fromEntries(args.filter(a => a.includes('=')).map(a => a.split('=')));
if (set.cash) for (const b of Object.values(DATA.people.founderBackgrounds)) b.cash = Math.round(b.cash * +set.cash / 900);
if (set.pleasedAt) DATA.sales.pleasedAt = +set.pleasedAt; if (set.reputationPull) DATA.sales.reputationPull = +set.reputationPull; if (set.qualityMid) DATA.sales.satisfaction.qualityMid = +set.qualityMid;
if (set.defectBelow) DATA.build.defect.below = +set.defectBelow; if (set.breakdown) DATA.sales.breakdownPerDayPerDefect = +set.breakdown;
const rows: BotLog[] = []; let cashEnd = 0, rep = 0, town = 0, defects = 0, cars = 0;
for (let seed = 1; seed <= runs; seed++) { const w = newWorld(seed, { background: 'coachbuilder', age: 31 }), log = runBot(w, 1826, { deposit: set.deposit ? +set.deposit : undefined, chances: set.chances !== '0', bank: set.bank != null ? +set.bank : undefined }); rows.push(log); cashEnd += w.sim.g.ledger.cash + w.sim.g.bank.deposit; rep += Object.values(w.sim.g.market.reputation).reduce((a, b) => a + b, 0) / 5; town += w.sim.g.market.awareness.town; for (const c of w.sim.g.shop.cars) { cars++; defects += c.defects.length; } }
const avg = (f: (r: BotLog) => number) => (rows.reduce((t, r) => t + f(r), 0) / rows.length).toFixed(1), sat = rows.flatMap(r => r.satisfaction), pct = (n: number) => (n / Math.max(1, sat.length) * 100).toFixed(0) + '%';
console.log(`${Object.entries(set).map(e => e.join('=')).join(' ') || 'as in the data files'}`);
console.log(`  bankrupt ${rows.filter(r => r.bankruptDate).length}/${runs} | per run: inquiries ${avg(r => r.inquiries)}, orders ${avg(r => r.orders)}, delivered ${avg(r => r.delivered)} | satisfaction mean ${(sat.reduce((a, b) => a + b, 0) / Math.max(1, sat.length)).toFixed(0)}, pleased ${pct(sat.filter(s => s >= DATA.sales.pleasedAt).length)}, unhappy ${pct(sat.filter(s => s < 0).length)} | defects/car ${(defects / Math.max(1, cars)).toFixed(1)} | end: cash ${(cashEnd / runs).toFixed(0)}, reputation ${(rep / runs).toFixed(0)}, town ${(town / runs).toFixed(0)}`);
const ch: Record<string, number> = {}; for (const r of rows) for (const [k, v] of Object.entries(r.chances ?? {})) ch[k] = (ch[k] ?? 0) + v;
console.log(`  chances per run: ${Object.entries(ch).map(([k, v]) => `${k} ${(v / runs).toFixed(2)}`).join(', ') || 'none taken'} | delays asked ${avg(r => r.delaysAsked ?? 0)}`);
if (set.bank != null) console.log(`  bank: loans granted ${avg(r => r.loans ?? 0)}, refused ${avg(r => r.loansRefused ?? 0)}, locked in failed banks ${avg(r => r.lostAtBank ?? 0)} per run`);
