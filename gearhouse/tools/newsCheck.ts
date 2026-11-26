// How varied is the newspaper? Counts what the data can give in each class (importance x relation, level x relation)
// and what five years of issues actually print. npx tsx tools/newsCheck.ts [runs]
import { DATA, newWorld } from '../core/world';
import { RELATIONS, combosWithTails, tierOf } from '../core/news';
const runs = +(process.argv[2] ?? 10), F = DATA.fiction, R = DATA.real;
console.log('FICTIONAL: different lines the data can give (names of people and suppliers not counted)');
console.log('importance  ' + RELATIONS.map(r => r.padStart(11)).join(''));
for (let imp = 1; imp <= 6; imp++) console.log(String(imp).padStart(10) + '  ' + RELATIONS.map(rel => String(F.topics.filter(t => t.relation === rel).reduce((n, t) => n + (t[tierOf(imp)] ?? []).reduce((m, p) => m + combosWithTails(p, F, imp, rel), 0), 0)).padStart(11)).join(''));
console.log('\nREAL: events and renderings (headline x local angle)');
for (const lv of ['important', 'very_important', 'historic'] as const) console.log(lv.padStart(15) + '  ' + RELATIONS.map(rel => { const ev = R.events.filter(e => e.level === lv && e.relation === rel); return `${rel} ${ev.length} ev / ${ev.reduce((n, e) => n + e.headlines.length, 0) * R.angles[rel].length}`; }).join('   '));
console.log('  total renderings', R.events.reduce((n, e) => n + e.headlines.length * R.angles[e.relation].length, 0));
const seen = new Map<string, Set<string>>(), count = new Map<string, number>(); let issues = 0, items = 0, dupInRun = 0, effects = 0, real = 0;
for (let seed = 1; seed <= runs; seed++) { const w = newWorld(seed, { background: 'coachbuilder', age: 31 }), mine = new Set<string>(); for (let d = 0; d < 1826; d++) w.sim.stepDay();
  for (const is of w.sim.g.media.issues) { issues++; for (const a of is.articles) { items++; if (a.origin === 'real') { real++; continue; } const key = `${a.importance}.${a.relation}`; if (!seen.has(key)) seen.set(key, new Set()); seen.get(key)!.add(a.headline); count.set(key, (count.get(key) ?? 0) + 1); if (mine.has(a.headline)) dupInRun++; mine.add(a.headline); if (a.effect) effects++; } } }
console.log(`\nPRINTED in ${runs} runs of five years: ${issues} issues, ${(items / issues).toFixed(1)} items an issue, ${real} real items, ${effects} items with an effect on the game`);
console.log('different fictional headlines printed / printed in all, by importance and relation');
for (let imp = 1; imp <= 6; imp++) console.log(String(imp).padStart(10) + '  ' + RELATIONS.map(rel => `${seen.get(`${imp}.${rel}`)?.size ?? 0}/${count.get(`${imp}.${rel}`) ?? 0}`.padStart(13)).join(''));
console.log(`a headline seen twice within one five-year game: ${(dupInRun / (items - real) * 100).toFixed(1)}% of fictional items`);
const w = newWorld(4, { background: 'coachbuilder', age: 31 }); for (let d = 0; d < 1170; d++) w.sim.stepDay(); const is = w.sim.g.media.issues.find(i => i.date === '1933-03-09')!;
console.log(`\nSAMPLE ISSUE ${is.date}`); for (const a of is.articles) console.log(`  p${a.page} [${a.origin === 'real' ? a.level : 'imp ' + a.importance} / ${a.relation}] ${a.headline}${a.lead ? '  — ' + a.lead : ''}${a.effect ? `  (effect: ${a.effect.kind} ${a.effect.value ?? ''} due ${a.effect.due ?? ''})` : ''}`);
