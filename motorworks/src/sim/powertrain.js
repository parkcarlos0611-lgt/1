// Electrified powertrains. Produces an engine-result-compatible object so the
// vehicle simulation (gearing, 0-100, top speed) works unchanged for BEV/HEV/PHEV.
(function (MW) {
  const U = MW.U, D = MW.data, PT = D.PT, S = MW.sim;
  S.evDefaults = (year, pt) => ({
    cell: year >= 2021 ? 'lfp' : year >= 2008 ? 'nmc' : 'nimh',
    kWh: pt === 'bev' ? (year >= 2018 ? 70 : 40) : pt === 'phev' ? 14 : 1.4,
    kw: pt === 'bev' ? 200 : pt === 'phev' ? 80 : 55,
    motor: year >= 2015 ? 'pmsm' : year >= 1997 ? 'pmsm' : 'dc', inverter: year >= 2024 ? 'sic' : 'si', motors: 1
  });
  const packPrice = (cell, y) => U.table(D.PACK_PRICE[cell] || D.PACK_PRICE.nmc, Math.max(y, (D.PACK_PRICE[cell] || D.PACK_PRICE.nmc)[0][0]));
  const packDens = (cell, y) => U.table(D.PACK_DENS[cell] || D.PACK_DENS.nmc, y);
  // battery & motor package (mass kg, cost 1946$, efficiency)
  S.evPackage = (car, year) => {
    const ev = car.ev || S.evDefaults(year, car.powertrain);
    const C = D.byId(PT.cells, ev.cell), M = D.byId(PT.motors, ev.motor), I = D.byId(PT.inverters, ev.inverter);
    const dens = packDens(C.id, year) * (C.id === 'nimh' ? 1 : 1);
    const battKg = ev.kWh * 1000 / dens;
    const battCost = ev.kWh * packPrice(C.id, year) / D.cpi(year) * (1 + 1.2 * (1 - D.maturity(C, year)));
    const kwTot = ev.kw * (ev.motors || 1);
    const motorKg = kwTot / M.kwkg + 12 * (ev.motors || 1);
    const motorCost = (D.techCost(M, year) + D.techCost(I, year)) * kwTot + 40 * (ev.motors || 1);
    const eff = M.eff * (1 + I.eff) * .97 * .95;
    const rel = 88 + (C.life - 1) * 20 - (1 - D.maturity(C, year)) * 30 - (1 - D.maturity(M, year)) * 12 - C.fire * 200;
    return { ev, C, M, I, battKg, battCost, motorKg, motorCost, eff, kwTot, rel, packPrice: packPrice(C.id, year), dens };
  };
  // build an engine-like result
  S.electrify = (car, er, year) => {
    const pt = car.powertrain || 'ice';
    if (pt === 'ice') return er;
    const P = S.evPackage(car, year);
    const kw = P.kwTot;
    if (pt === 'bev') {
      const maxRpm = P.M.id === 'ind' ? 14000 : P.M.id === 'dc' ? 6000 : 16000;
      const base = maxRpm * (P.M.id === 'dc' ? .5 : .32);
      const Tmax = kw * 1000 / (base * 2 * Math.PI / 60);
      const tqAt = r => r <= base ? Tmax : r > maxRpm ? 0 : Tmax * base / r * (1 - (r - base) / maxRpm * .15);
      const curve = []; for (let r = 250; r <= maxRpm; r += 250) { const tq = tqAt(r); curve.push({ rpm: r, tq, kw: tq * r * 2 * Math.PI / 60000, hp: tq * r * 2 * Math.PI / 60000 * 1.341, boost: 0 }); }
      const pk = curve.reduce((a, c) => c.hp > a.hp ? c : a, curve[0]);
      return { ev: P, bev: 1, fuel: 'electric', dispL: 0, cc: 0, n: 0, banks: 0, perBank: 0, redline: maxRpm, rpmMax: maxRpm, idle: 0, curve, tqAt,
        peakTq: Tmax, peakTqRpm: 250, peakHp: pk.hp, peakHpRpm: pk.rpm, ps: pk.hp * 1.0139, bsfc: 0, emissions: 0, smooth: 1, spool: 0, boostBar: 0, asp: 'na',
        mass: Math.round(P.battKg + P.motorKg + 30), length: 600, width: 500, height: 400, cost: P.battCost + P.motorCost, hours: 7 + (car.ev?.motors > 1 ? 2 : 0),
        rel: U.clamp(P.rel, 10, 98), warnings: [], devMonths: 10, devCost: 300000, complexity: 1.5, hpPerL: 0, specific: pk.hp / (P.battKg + P.motorKg), octane: 0, knockCR: 0, effCR: 0, pistonSpeed: 0 };
    }
    // hybrids: engine + motor through a power-split / P2 module
    const base = 1800, Tm = kw * 1000 / (base * 2 * Math.PI / 60);
    const mtq = r => r <= base ? Tm : Tm * base / r;
    const tqAt = r => er.tqAt(r) + (r <= er.redline ? mtq(r) * .85 : 0);
    const curve = er.curve.map(c => { const tq = tqAt(c.rpm); return { ...c, tq, kw: tq * c.rpm * 2 * Math.PI / 60000, hp: tq * c.rpm * 2 * Math.PI / 60000 * 1.341 }; });
    const pk = curve.reduce((a, c) => c.hp > a.hp ? c : a, curve[0]), pt2 = curve.reduce((a, c) => c.tq > a.tq ? c : a, curve[0]);
    return { ...er, ev: P, hybrid: pt, tqAt, curve, peakHp: pk.hp, peakHpRpm: pk.rpm, peakTq: pt2.tq, peakTqRpm: pt2.rpm, ps: pk.hp * 1.0139,
      mass: er.mass + Math.round(P.battKg + P.motorKg + 25), cost: er.cost + P.battCost + P.motorCost + 60, hours: er.hours + 3,
      rel: U.clamp(er.rel * .6 + P.rel * .4 - 3, 5, 99), emissions: er.emissions * (pt === 'phev' ? .45 : .7) };
  };
})(window.MW);
