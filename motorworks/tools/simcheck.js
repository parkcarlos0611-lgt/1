// Headless balance check: `node motorworks/tools/simcheck.js`
// Prints representative engines/cars per era and a 10-year company run.
global.window = {};
const path = require('path');
const R = path.join(__dirname, '..', 'src') + '/';
for (const f of ['util', 'data/world', 'data/tech', 'sim/engine', 'sim/car', 'sim/market', 'sim/company']) require(R + f + '.js');
const { sim: S, U } = window.MW;

console.log('— era reference cars —');
const cases = [
  [1946, {}], [1955, { layout: 'V', cyl: 8, vAngle: 90, bore: 95, stroke: 86, head: 'ohv', fuelSys: 'carb2' }],
  [1965, { layout: 'V', cyl: 8, vAngle: 90, bore: 105, stroke: 95, head: 'ohv', fuelSys: 'carb4', compression: 10.5, cam: 70 }],
  [1975, {}], [1990, { fuelSys: 'mpfi' }], [2005, {}],
  [2015, { fuelSys: 'gdi', asp: 'turbo', boost: 14, intercooler: true, vvt: 'full', bore: 82, stroke: 93, crank: 'forged' }]
];
for (const [y, mods] of cases) {
  const e = Object.assign(S.defaultEngine(y), mods); S.fixEngine(e, y); const er = S.evalEngine(e, y);
  const c = S.defaultCar(y, e.id); const r = S.evalCar(c, e, er, y);
  console.log(y, `${e.layout}${e.cyl} ${er.dispL.toFixed(2)}L ${Math.round(er.peakHp)}hp ${Math.round(er.peakTq)}Nm`, `${r.mass}kg Cd${r.A.cd.toFixed(2)}`,
    `0-100 ${r.t100.toFixed(1)}s`, `${r.topSpeed.toFixed(0)}km/h`, `${r.lpk.toFixed(1)}L/100`, '|', Object.entries(r.r).map(([k, v]) => k.slice(0, 4) + v.toFixed(0)).join(' '));
}

console.log('\n— company run 1946 → 1956 —');
const G = S.newGame({ seed: 42 });
const c = G.cars[0];
S.startEngineDev(G, G.engines[0]); S.startCarDev(G, c);
c.price = S.suggestPrice(G, c);
S.buildFactory(G, 'na', 1, { stamping: 'press', welding: 'spot', paint: 'enamel', assembly: 'line', qa: 'visual' });
S.recruitDealers(G, 'na', 150); G.marketing.na = 20000;
for (let i = 0; i < 120 && !G.over; i++) {
  S.step(G);
  if (c.status === 'ready' && !G.factories[0].lines[0].modelId) S.assignLine(G, G.factories[0], 0, c.id);
  if (i % 12 === 11) { const L = G.lastL; console.log(S.ym(G.t), 'cash', U.money(G.cash), 'rev/mo', U.money(L.rev), 'sold', L.units, 'demand', Math.round(c.lastDemand || 0), 'unit', U.money(c.unitCost || 0), 'price', c.price, 'rep', G.rep.toFixed(0)); }
}
console.log(G.over ? 'GAME OVER: ' + G.over : 'ok');
