import { chassisStats } from '../sim/chassis.mjs';
import { FRAME_TYPES } from '../tools/pixel/gen/v3/platform.mjs';
// World data + monthly simulation for the 1930-1949 test build.
import { engineStats } from '../sim/engine.mjs';
import { simulate, GEARBOX } from '../sim/drive.mjs';

// new-car market size per year (thousands of units) - shape follows the depression, the war stop and the post-war boom
const US = { 1930: 2780, 1931: 1970, 1932: 1100, 1933: 1560, 1934: 2160, 1935: 3250, 1936: 3670, 1937: 3920, 1938: 2000, 1939: 2870, 1940: 3720, 1941: 3780, 1942: 220, 1943: 0, 1944: 1, 1945: 70, 1946: 2150, 1947: 3560, 1948: 3910, 1949: 5120 };
const scale = (f, war) => Object.fromEntries(Object.entries(US).map(([y, v]) => [y, Math.round(v * f * (war && +y >= war[0] && +y <= war[1] ? 0.05 : 1) * (+y > 1945 && war ? 0.5 : 1))]));
export const COUNTRIES = {
  USA:     { name: 'UNITED STATES', wealth: 1.0, fuel: 0.6, roads: 0.9, wage: 1.0, market: US, war: [1942, 1945], civStop: [1942.1, 1945.8], col: '#3b5b8c' },
  GERMANY: { name: 'GERMANY', wealth: 0.55, fuel: 1.4, roads: 0.8, wage: 0.6, market: scale(0.07, [1940, 1946]), war: [1939, 1945], civStop: [1940, 1946.5], col: '#4a4a4a' },
  UK:      { name: 'BRITAIN', wealth: 0.7, fuel: 1.3, roads: 0.7, wage: 0.7, market: scale(0.09, [1940, 1945]), war: [1939, 1945], civStop: [1940, 1945.5], col: '#7a2a24' },
  FRANCE:  { name: 'FRANCE', wealth: 0.6, fuel: 1.5, roads: 0.75, wage: 0.6, market: scale(0.065, [1940, 1945]), war: [1939, 1945], civStop: [1940, 1946], col: '#2f4f8c' },
  ITALY:   { name: 'ITALY', wealth: 0.45, fuel: 1.7, roads: 0.6, wage: 0.45, market: scale(0.018, [1940, 1945]), war: [1940, 1945], civStop: [1941, 1946], col: '#3f6b3a' },
  JAPAN:   { name: 'JAPAN', wealth: 0.3, fuel: 1.8, roads: 0.4, wage: 0.3, market: scale(0.004, [1938, 1945]), war: [1937, 1945], civStop: [1938, 1947], col: '#a8342a' } };
export const SEGS = {   // share of the market, price band ($ 1935), what buyers weigh
  economy: { share: 0.42, price: [450, 750], w: { price: 0.35, econ: 0.25, rel: 0.2, perf: 0.05, comfort: 0.05, design: 0.05, modern: 0.05 } },
  family:  { share: 0.33, price: [700, 1200], w: { price: 0.2, econ: 0.15, rel: 0.2, perf: 0.1, comfort: 0.15, design: 0.1, modern: 0.1 } },
  luxury:  { share: 0.08, price: [1600, 4500], w: { price: 0.05, econ: 0.02, rel: 0.15, perf: 0.15, comfort: 0.3, design: 0.18, modern: 0.15 } },
  sport:   { share: 0.04, price: [900, 2500], w: { price: 0.08, econ: 0.02, rel: 0.1, perf: 0.45, comfort: 0.05, design: 0.2, modern: 0.1 } },
  utility: { share: 0.13, price: [500, 1100], w: { price: 0.3, econ: 0.15, rel: 0.35, perf: 0.1, comfort: 0.02, design: 0.03, modern: 0.05 } } };

// research: points, year it becomes researchable, era mainstream (for modernity), what it unlocks
export const TECH = [
  { id: 'sync3', name: 'SYNCHROMESH 3-SPD', pts: 40, year: 1929, main: 1933, unlock: 'gb:sync3' },
  { id: 'ohv', name: 'OHV PUSHROD HEAD', pts: 60, year: 1930, main: 1950, unlock: 'head:ohv' },
  { id: 'alhead', name: 'ALUMINIUM HEAD', pts: 50, year: 1932, main: 1950, unlock: 'mat:alHead' },
  { id: 'hydbrake', name: 'HYDRAULIC BRAKES', pts: 50, year: 1930, main: 1936, unlock: 'feat:hydbrake' },
  { id: 'stream', name: 'STREAMLINE BODY', pts: 70, year: 1933, main: 1938, unlock: 'style:stream' },
  { id: 'steelroof', name: 'ALL-STEEL ROOF', pts: 45, year: 1934, main: 1937, unlock: 'feat:steelroof' },
  { id: 'ifs', name: 'INDEPENDENT FRONT', pts: 70, year: 1934, main: 1939, unlock: 'feat:ifs' },
  { id: 'sync4', name: '4-SPD SYNCHROMESH', pts: 50, year: 1934, main: 1950, unlock: 'gb:sync4' },
  { id: 'od', name: 'OVERDRIVE', pts: 55, year: 1934, main: 1950, unlock: 'gb:od3' },
  { id: 'twincarb', name: 'TWIN CARBURETTORS', pts: 45, year: 1932, main: 1955, unlock: 'feat:twincarb' },
  { id: 'fluid', name: 'FLUID CLUTCH', pts: 70, year: 1939, main: 1955, unlock: 'gb:fluid' },
  { id: 'hydra', name: 'FLUID COUPLING AUTO', pts: 110, year: 1940, main: 1953, unlock: 'gb:hydra4' },
  { id: 'unibody', name: 'UNIT BODY', pts: 120, year: 1941, main: 1960, unlock: 'feat:unibody' },
  { id: 'fourwd', name: '4WD + TRANSFER', pts: 80, year: 1940, main: 1960, unlock: 'feat:4wd' },
  { id: 'pontoon', name: 'PONTOON SLAB BODY', pts: 90, year: 1946, main: 1950, unlock: 'style:pontoon' },
  { id: 'hicomp', name: 'HIGH-COMPRESSION OHV V8', pts: 120, year: 1948, main: 1953, unlock: 'feat:hicomp' } ];
export const RES_SCALE = { small: { pts: 6, cost: 1500 }, medium: { pts: 12, cost: 3500 }, large: { pts: 22, cost: 7000 } };
export const STYLE_MAIN = { box: 1925, stream: 1938, pontoon: 1950 };

// modernity (TECH_PROGRESSION_PLAN): lag behind the mainstream frontier, era grace & span
const GRACE = y => (y < 1940 ? 6 : 5), SPAN = y => (y < 1940 ? 14 : 12), WMOD = y => (y < 1940 ? 0.10 : 0.12);
export function modernity(year, items) { if (!items.length) return 1; let s = 0;
  for (const main of items) { const lag = Math.max(0, year - main) ; s += 1 - Math.min(1, Math.max(0, lag - GRACE(year)) / SPAN(year)); } return s / items.length; }

// evaluate a car design (engine + gearbox + body params) - shared by the designer screen and the monthly market
export function evaluate(g, car) {
  const e = g.engines.find(x => x.id === car.engineId), gb = g.gearboxes.find(x => x.id === car.gbId); if (!e || !gb) return null;
  const es = engineStats({ ...e, year: g.year }), body = car.body, wb = body.wb, len = car.dims?.len ?? wb + 1500, width = car.dims?.width ?? 1720;
  const Cd = { box: 0.68, stream: 0.54, pontoon: 0.5 }[body.style] ?? 0.68, area = width / 1000 * ((car.dims?.height ?? wb * body.height) - 180) / 1000 * 0.82;
  const bodyKg = 520 + (wb - 2500) * 0.28 + (width - 1700) * 0.35 + (car.type === 'sedan4d' ? 60 : 0) + (car.feats?.steelroof ? 25 : 0) - (car.feats?.unibody ? 90 : 0) + (car.platStats ? car.platStats.kg - 95 : 0);   // frame / shell mass from the platform design
  const kerb = bodyKg + 250 + (es.mass - 200) + GEARBOX[gb.type].mass, ch = car.ch ? chassisStats(car.ch, { mass: kerb, engineKg: es.mass, wb, track: width * 0.82, cgH: 0.5 + ((car.dims?.height ?? 1600) - 1500) / 3000, hyd: !!car.feats?.hydbrake }) : null;
  const sim = simulate({ es, engine: e, gearbox: gb, final: car.final, tyreR: ch ? ch.tyreR : 0.36, crr: ch ? ch.crr : undefined, mass: bodyKg + 250, cda: Cd * area, driveFrac: 0.52 });
  const fit = es.len <= body.hood * wb + 320 && es.height <= 900;
  const unit = Math.round(es.cost + GEARBOX[gb.type].cost + 210 + (wb - 2500) * 0.15 + (body.style !== 'box' ? 45 : 0) + (car.trim ?? 1) * 55 + (ch ? ch.cost : (car.feats?.ifs ? 25 : 0) + (car.feats?.hydbrake ? 12 : 0)) + (car.platStats ? car.platStats.cost - 40 : 0)) * (COUNTRIES[g.country].wage * 0.4 + 0.6);
  const techMain = [STYLE_MAIN[body.style], e.head === 'sv' ? 1910 : e.head === 'ohv' ? 1950 : 1960, GEARBOX[gb.type].year + 4, car.feats?.hydbrake ? 1936 : 1925, car.feats?.ifs ? 1939 : 1928, ...(car.plat ? [FRAME_TYPES[car.plat.type]?.main ?? 1925] : [])];
  const modern = modernity(g.year, techMain);
  const perf = Math.min(1, es.hp / sim.mass * 1000 / (55 + (g.year - 1930) * 1.6) + (ch ? (ch.latG - 0.63) * 0.6 + (ch.decel - 0.55) * 0.3 : 0)), econ = Math.min(1, sim.mpg / 26 / COUNTRIES[g.country].fuel ** 0.3);
  const comfort = Math.min(1, 0.25 + sim.comfort * 0.35 + es.smooth * 0.25 + (ch ? (ch.ride - 0.3) * 0.3 + (ch.control - 0.8) * 0.1 : car.feats?.ifs ? 0.1 : 0) + (car.trim || 1) * 0.05 + (car.platStats ? (car.platStats.stiff - 0.6) * 0.12 + (car.platStats.comfort || 0) : 0));   // stiffer platform: less shake and squeak
  const rel = Math.min(1, es.reliability * (1 + (car.relMod || 0))) * (e.quality >= 0 ? 1 : 0.95) * (car.platStats && car.platStats.margin < 1 ? 0.7 + 0.3 * car.platStats.margin : 1), design = Math.min(1, (car.designScore ?? 0.6) * (0.85 + (body.style === 'box' ? 0 : 0.15)));
  return { es, sim, ch, fit, unit, modern, perf, econ, comfort, rel, design, wMod: WMOD(g.year) };
}
export function appeal(ev, seg, price) { const S = SEGS[seg], [lo, hi] = S.price, mid = (lo + hi) / 2, inf = 1;
  const pv = Math.max(0, Math.min(1, 1 - (price - lo) / (hi - lo) * 0.8)), fitBand = price < lo * 0.7 || price > hi * 1.6 ? 0.5 : 1;
  const st = { price: pv, econ: ev.econ, rel: ev.rel, perf: ev.perf, comfort: ev.comfort, design: ev.design, modern: ev.modern };
  return Object.entries(S.w).reduce((a, [k, w]) => a + w * st[k], 0) * fitBand * (ev.fit ? 1 : 0.4) * inf; }

export const DIFF = { easy: { demand: 1.35, over: 0.8, cap: 1.5 }, normal: { demand: 1, over: 1, cap: 1 }, hard: { demand: 0.8, over: 1.15, cap: 0.8 } };
export function newGame({ country = 'USA', year = 1930, capital = 250000, research = 'medium', name = 'GEARHOUSE MOTOR CO.', diff = 'normal' }) {
  capital = Math.round(capital * DIFF[diff].cap);
  return { v: 2, name, country, year, month: 1, startYear: year, cash: capital, diff, loan: 0, distress: 0, meeting: false, ach: [], rep: 0.3, research, resPts: 0, resCur: null, known: TECH.filter(t => t.year + 8 < year).map(t => t.id).concat(['sync3'].filter(() => year >= 1934)),
    engines: [{ id: 'E1', name: 'SV-4 STARTER', layout: 'I4', head: 'sv', material: 'iron', bore: 85, stroke: 105, cr: 5.4, cam: 0.3, carbs: 1, carbSize: 1, quality: 0, readyAt: 0, tooling: 0 }],
    gearboxes: [{ id: 'G1', name: '3-SPD BASIC', type: 'crash3', gears: 3, ratios: [2.9, 1.65, 1], readyAt: 0 }], models: [], factory: 1500, news: [{ t: `${year}: ${name} FOUNDED IN ${COUNTRIES[country].name}.`, d: 0 }],
    hist: { cash: [capital], sales: [0] }, serial: 2, over: false };
}
export const dateNum = g => g.year * 12 + g.month - 1;
// one month of business
export function stepMonth(g) {
  const C = COUNTRIES[g.country], yearF = g.year + (g.month - 1) / 12, R = RES_SCALE[g.research]; let pl = { rev: 0, cost: 0, sales: 0 };
  const civStop = yearF >= C.civStop[0] && yearF < C.civStop[1], war = g.year >= C.war[0] && g.year <= C.war[1];
  // research
  g.cash -= R.cost; pl.cost += R.cost;
  if (g.resCur) { const t = TECH.find(x => x.id === g.resCur); g.resPts += R.pts * (war ? 1.3 : 1); if (g.resPts >= t.pts) { g.known.push(t.id); g.resPts = 0; g.resCur = null; g.news.unshift({ t: `RESEARCH DONE: ${t.name}`, d: dateNum(g) }); } }
  // fixed overhead (+ difficulty), stock storage 1%/month of its cost
  const D = DIFF[g.diff || 'normal'], over = (4000 + g.factory * 3.2) * D.over; g.cash -= over; pl.cost += over;
  const marketY = (C.market[g.year] ?? Math.round((C.market[1949] || 0) * Math.pow(1.03, g.year - 1949))) * 1000 / 12 * D.demand;
  if (civStop) { const contract = g.factory * 9 * (1 + g.rep);                      // war production contract replaces civil sales
    g.cash += contract; pl.rev += contract; if (g.month === 1 || !g._warNote) { g._warNote = 1; g.news.unshift({ t: 'CIVIL PRODUCTION HALTED - FACTORY ON WAR CONTRACTS', d: dateNum(g) }); } }
  else { g._warNote = 0; let capLeft = g.factory;
    for (const m of g.models.filter(m => m.readyAt <= dateNum(g) && !m.dead)) {
      const ev = evaluate(g, m); if (!ev) continue;
      const a = appeal(ev, m.seg, m.price), base = 0.70 + (g.year - 1930) * 0.008;                        // competitor appeal rises with time
      const share = Math.exp((a - base) * 12) / (150 + Math.exp((a - base) * 12)), rep = 0.6 + g.rep;
      const demand = marketY * SEGS[m.seg].share * share * rep * (C.wealth ** 0.3) * Math.max(0.2, 1.5 - m.price / SEGS[m.seg].price[1]);
      const made = Math.min(m.plan, capLeft); capLeft -= made; m.stock = (m.stock || 0) + made; m.unit = ev.unit;
      const stale = Math.min(1, (m.stockAge || 0) / 6);                                                       // shop-worn stock sells slower until the price comes down
      const sold = Math.min(Math.round(demand * (1 - 0.15 * stale)), m.stock); m.stock -= sold; m.sold = (m.sold || 0) + sold; m.lastSold = sold; m.appeal = a;
      m.demandHist = [...(m.demandHist || []), Math.round(demand)].slice(-3);
      const age0 = m.stockAge || 0; m.stockAge = m.stock > Math.max(40, sold * 1.5) ? age0 + 1 : Math.max(0, age0 - 2); if (m.lastPrice != null && m.price < m.lastPrice) m.stockAge = Math.max(0, m.stockAge - 3); m.lastPrice = m.price;
      if (age0 < 6 && m.stockAge >= 6) g.news.unshift({ t: 'UNSOLD ' + m.name + ' GATHERING DUST ON THE LOTS - CUT OUTPUT OR PRICE', d: dateNum(g) });
      const storage = m.stock * ev.unit * 0.01;
      g.cash += sold * m.price - made * ev.unit - storage; pl.rev += sold * m.price; pl.cost += made * ev.unit + storage; pl.sales += sold;
      g.rep = Math.min(1, Math.max(0, g.rep + (sold > 0 ? (ev.rel - 0.75) * 0.004 + 0.001 : -0.001))); } }
  // bank: credit line against factory, stock and live models; automatic draw, interest, repayment from surplus
  const inv = g.models.reduce((a, m) => a + (m.stock || 0) * (m.unit || 0), 0); g.credit = Math.round(g.factory * 40 + Math.min(inv * 0.3, 100000) + g.models.filter(m => !m.dead).length * 10000);
  if (g.loan > 0) { const i = g.loan * 0.006; g.cash -= i; pl.cost += i; }
  if (g.cash < 0 && g.loan < g.credit) { const d = Math.min(g.credit - g.loan, -g.cash + 5000); g.loan += d; g.cash += d; if (d > 0) g.news.unshift({ t: `BANK CREDIT DRAWN: ${Math.round(d)}`, d: dateNum(g) }); }
  else if (g.loan > 0 && g.cash > over * 4) { const r = Math.min(g.loan, (g.cash - over * 4) * 0.3); g.loan -= r; g.cash -= r; }
  if (g.cash < 0) { g.distress = (g.distress || 0) + 1;
    if (g.distress === 1) g.news.unshift({ t: 'WARNING: CREDIT EXHAUSTED - CASH NEGATIVE', d: dateNum(g) });
    if (g.distress === 3 && (g.meetings || 0) < 3) { g.meeting = true; g.news.unshift({ t: 'THE BANK CALLS A MEETING', d: dateNum(g) }); } }
  else g.distress = Math.max(0, (g.distress || 0) - 1);
  // achievements
  const total = g.models.reduce((a, m) => a + (m.sold || 0), 0), ach = (id, t) => { if (!g.ach.includes(id)) { g.ach.push(id); g.news.unshift({ t: 'MILESTONE: ' + t, d: dateNum(g) }); } };
  if (total >= 1) ach('first', 'FIRST CAR SOLD'); if (total >= 10000) ach('10k', '10,000 CARS SOLD'); if (total >= 100000) ach('100k', '100,000 CARS SOLD');
  if (g.year === 1934 && g.startYear <= 1931) ach('depr', 'SURVIVED THE DEPRESSION'); if (civStop) ach('war', 'WAR PRODUCTION');
  // events
  const ev = { '1931-1': 'BANK FAILURES: DEMAND COLLAPSES', '1933-3': 'BANK HOLIDAY - RECOVERY BEGINS', '1937-9': 'RECESSION OF 1937-38', '1939-9': 'WAR IN EUROPE', '1941-12': 'WAR DECLARED: CIVIL OUTPUT TO STOP',
    '1945-9': 'WAR ENDS - RECONVERSION', '1946-6': 'PENT-UP DEMAND: SELLERS MARKET', '1948-1': 'NEW-GENERATION BODIES ARRIVE' }[`${g.year}-${g.month}`];
  if (ev) g.news.unshift({ t: ev, d: dateNum(g) });
  for (const t of TECH) if (t.year === g.year && g.month === 1) g.news.unshift({ t: `NEW IDEA AVAILABLE: ${t.name}`, d: dateNum(g) });
  g.last = pl; g.hist.cash.push(Math.round(g.cash)); g.hist.sales.push(pl.sales); if (g.hist.cash.length > 240) { g.hist.cash.shift(); g.hist.sales.shift(); }
  g.month++; if (g.month > 12) { g.month = 1; g.year++; }
  if ((g.distress || 0) >= 6) g.over = 'BANKRUPT'; if (g.year >= 1950 && !g.sandbox) g.over = 'END OF TEST PERIOD (1949)';
  g.news = g.news.slice(0, 30);
}
export const has = (g, id) => g.known.includes(id);

// bank meeting choices (when credit is exhausted for 3 months)
export const BANK_OPTS = [['sell', 'SELL 30% OF FACTORY'], ['cut', 'RETIRE WEAKEST MODEL'], ['gov', 'GOVERNMENT CONTRACT (12 MO)'], ['merge', 'ACCEPT MERGER OFFER']];
export function bankOption(g, k) {
  if (k === 'sell') { const cut = Math.round(g.factory * 0.3); g.factory -= cut; g.cash += cut * 55; }
  if (k === 'cut') { const live = g.models.filter(m => !m.dead && m.readyAt <= dateNum(g)).sort((a, b) => (a.appeal || 0) - (b.appeal || 0)); if (live[0]) { live[0].dead = true; g.cash += (live[0].stock || 0) * (live[0].unit || 0) * 0.6; live[0].stock = 0; } }
  if (k === 'gov') { g.cash += g.factory * 25; g.rep = Math.max(0, g.rep - 0.05); }
  if (k === 'merge') g.over = 'MERGED INTO A LARGER FIRM';
  g.meeting = false; g.distress = 0; g.meetings = (g.meetings || 0) + 1; g.news.unshift({ t: 'BANK AGREEMENT: ' + BANK_OPTS.find(o => o[0] === k)[1], d: dateNum(g) });
}
