// Headless balance check: `node motorworks/tools/simcheck.js [years]`
// 1) the player's starter car in a simple 1946 company run, 2) the rival economy to 2035.
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => { } };
const path = require('path');
const R = path.join(__dirname, '..', 'src') + '/';
for (const f of ['util', 'data/world', 'data/tech', 'data/bodies', 'sim/engine', 'sim/powertrain', 'sim/car', 'sim/platform', 'sim/autodesign', 'sim/market', 'sim/rivals', 'sim/company']) require(R + f + '.js');
const { sim: S, U, data: D } = window.MW;
const years = +(process.argv[2] || 89);
const t0 = Date.now();
const G = S.newGame({ seed: 42 });
const c = G.cars[0], pf = G.platforms[0];
console.log('engine', S.startEngineDev(G, G.engines[0]), 'car', S.startCarDev(G, c));
c.price = S.suggestPrice(G, c);
S.buildFactory(G, 'na', 1, { stamping: 'press', welding: 'spot', paint: 'enamel', assembly: 'line', qa: 'visual' });
S.recruitDealers(G, 'na', 350); G.marketing.na = 25000;
for (let i = 0; i < years * 12 && !G.over; i++) {
  if (process.argv[3] === 'rich') G.cash = Math.max(G.cash, 1e9);
  S.step(G);
  if (c.status === 'ready' && !G.factories[0].lines[0].modelId) console.log('assign', S.assignLine(G, G.factories[0], 0, c.id));
  if (G.month === 0 && (Math.floor(G.t) % 5 === 1 || i < 24)) {
    const L = G.lastL;
    const mk = G.lastMarket, tot = U.sum(Object.values(mk.regions).map(r => r.total));
    const rv = G.rivals.filter(r => r.alive).map(r => `${r.id}:${(r.salesM / tot * 100).toFixed(1)}%${r.models.some(m => m.pt === 'bev') ? '⚡' : ''}`).join(' ');
    const unmet = U.sum(Object.values(mk.regions).flatMap(r => Object.values(r.segs).map(s => s.unmet || 0))) / tot;
    console.log(S.ym(G.t), 'cash', U.money(G.cash), 'sold', L.units, 'price', c.price, 'unit', U.money(c.unitCost || 0), '| unmet', (unmet * 100).toFixed(0) + '%', '|', rv);
  }
}
console.log(G.over || 'ok', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log(G.log.filter(l => l.kind === 'rival' || /올해의|신뢰성|파산|인수|CAFE|CO₂/.test(l.msg)).slice(0, 30).map(l => S.ym(l.t) + ' ' + l.msg).join('\n'));
