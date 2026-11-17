// Rival companies run on the same simulation as the player. Each one has cash,
// production capacity, reputation, export reach and a line-up of real cars designed
// by S.autoDesign and evaluated with the same physics. Every January they decide:
// replace ageing models, enter attractive segments, go electric, add or cut capacity,
// start exporting, build local plants. Weak companies go bankrupt and are absorbed
// by a stronger rival — or the player — and new companies enter over time.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim;
  const regionOf = id => D.REGIONS.find(r => r.id === id);

  S.designRivalModel = (G, r, seg, y, rng, pt) => {
    const { engine, car } = S.autoDesign({ seg, year: y, region: r.home, traits: r.traits, rng, name: r.name.split(' ')[0], pt });
    const er = engine ? S.evalEngine(engine, y) : null;
    if (er) er.catId = engine.cat;
    const ev = S.evalCar(car, engine, er, y);
    const { price, unit } = S.autoPrice(G, car, ev, er || {}, r.home, r.traits);
    const names = ['Aurora', 'Comet', 'Meridian', 'Vista', 'Ranger', 'Atlas', 'Sierra', 'Nova', 'Orion', 'Pulse', 'Strada', 'Corsa', 'Titan', 'Kestrel', 'Sabre', 'Lumen', 'Arc', 'Volta', 'Halo', 'Vector'];
    car.name = `${r.name.split(' ')[0]} ${names[Math.floor(rng() * names.length)]}${pt === 'bev' || car.powertrain === 'bev' ? ' e' : ''}`;
    car.price = price;
    return {
      id: U.uid('rm'), seg, name: car.name, car, engine, r: ev.r, stars: ev.stars, price, unit, cpi0: D.cpi(y), launchT: G.t, pt: car.powertrain,
      range: ev.range, co2: ev.co2, corrosion: U.clamp(ev.corr * .6 + .25 + r.traits.quality * .1, 0, 1), sold: 0, last: 0,
      spec: { hp: Math.round(ev.er.peakHp), t100: ev.t100, lpk: ev.lpk, mass: ev.mass, kwh100: ev.kwh100 }
    };
  };

  S.spawnRival = (G, def, small) => {
    const y = Math.floor(G.t), rng = U.rng((G.seed + def.id.charCodeAt(0) * 131 + y) | 0);
    const R = regionOf(def.home);
    const size = small ? .08 : (def.size || .5);
    const r = {
      id: def.id, name: def.name, home: def.home, color: def.color, traits: { ...def.traits }, segs: def.segs.slice(),
      cash: S.nominal(G, 3e6) * size * 10, capacity: Math.max(800, U.table(R.market, y) * 1e6 / 12 * (y < 1950 ? .11 : .16) * size), rep: 50 + (def.traits.quality || 0) * 15,
      aware: { na: 4, eu: 4, ea: 2, em: 2, [def.home]: small ? 15 : 70 }, local: { [def.home]: 1 }, models: [], pending: [], alive: true,
      founded: G.t, hist: [], salesY: 0, revY: 0, profitY: 0, value: 0, util: [], dealers: 0
    };
    // first line-up: biggest home segments among the company's specialities
    const shares = D.segShare(y, def.home);
    const segs = r.segs.filter(s => !(s === 'suv' && y < 1984)).sort((a, b) => shares[D.SEGMENTS.findIndex(x => x.id === b)] - shares[D.SEGMENTS.findIndex(x => x.id === a)]).slice(0, small ? 1 : 3);
    for (const s of segs) { const m = S.designRivalModel(G, r, s, y, rng); m.launchT = G.t - rng() * 4; r.models.push(m); }
    return r;
  };

  S.initRivals = (G) => {
    G.rivals = [];
    for (const def of D.RIVALS) if (def.from <= G.t) G.rivals.push(S.spawnRival(G, def));
  };

  // presence of a rival brand in a region (dealer network + awareness, imports weaker)
  S.rivalPresence = (G, r, rid) => {
    const aw = (r.aware[rid] || 0) / 100;
    if (rid === r.home) return .35 + .65 * aw;
    const t = U.table(regionOf(rid).tariff, G.t);
    return Math.pow(aw, 1.2) * (r.local[rid] ? 1 : U.clamp(1 - t * 1.6, .1, 1));
  };

  // a model competes fully in its own segment and partly in neighbouring ones
  const NEAR = { econ: { family: .5, wagon: .3 }, family: { econ: .4, wagon: .5, lux: .25, suv: .3 }, wagon: { family: .5, suv: .4 }, lux: { family: .3, sport: .2 }, sport: { muscle: .5, super: .15, lux: .2 }, muscle: { sport: .5, family: .2 }, truck: { suv: .3 }, suv: { wagon: .4, family: .3, truck: .25 }, super: { sport: .3 } };
  S.segFitFor = seg => ({ ...Object.fromEntries(D.SEGMENTS.map(s => [s.id, 0])), ...NEAR[seg], [seg]: 1 });
  S.rivalOffers = (G) => {
    const out = [];
    for (const r of G.rivals) if (r.alive) for (const m of r.models) {
      const presence = {}; for (const R of D.REGIONS) presence[R.id] = S.rivalPresence(G, r, R.id);
      out.push({ owner: r, model: m, car: m.car, pt: m.pt, range: m.range, rep: r.rep, presence, local: r.local, segFit: S.segFitFor(m.seg),
        trims: [{ r: m.r, price: m.price, value: S.residual(m.r, r.rep, m.corrosion, 0, .1, m.pt, G.t) }] });
    }
    return out;
  };

  // local makers not modelled individually: one offer per region × segment, equal to the
  // average of the cars actually on sale (slightly behind), priced at the local target
  const FRINGE = { na: [[1946, 2.2], [1960, 1.1], [1980, .8], [2035, .6]], eu: [[1946, 4], [1970, 2.5], [2000, 1.4], [2035, 1]], ea: [[1946, 4], [1980, 2.5], [2005, 2.5], [2020, 2], [2035, 1.5]], em: [[1946, 4], [2000, 3], [2035, 2]] };
  S.fringeOffers = (G) => {
    const out = [], y = G.t;
    const live = G.rivals.filter(r => r.alive).flatMap(r => r.models);
    for (const seg of D.SEGMENTS) {
      const ms = live.filter(m => m.seg === seg.id);
      const r = {}; for (const k of D.RATING_KEYS) r[k] = ms.length ? U.sum(ms.map(m => m.r[k])) / ms.length - 4 : 46;
      for (const R of D.REGIONS) {
        const target = seg.price * D.income(y, R);
        const presence = { [R.id]: U.table(FRINGE[R.id], y) };
        out.push({ owner: { fringe: 1, name: '기타 업체' }, fringe: 1, pt: 'ice', rep: 50, presence, local: { [R.id]: 1 }, segFit: { [seg.id]: 1 },
          trims: [{ r, price: target, value: .4 }] });
      }
    }
    return out;
  };
  // after the market ran: book sales, money, history
  S.rivalsMonth = (G) => {
    const cpi = D.cpi(G.t);
    for (const r of G.rivals) {
      if (!r.alive) continue;
      const offers = G._rivalOffers.filter(o => o.owner === r);
      const demand = U.sum(offers.map(o => U.sum(Object.values(o.demand))));
      const fill = demand > 0 ? Math.min(1, r.capacity / demand) : 0;
      r.fill = fill; (r.fills = r.fills || []).push(fill); if (r.fills.length > 12) r.fills.shift();
      let rev = 0, cost = 0, units = 0;
      for (const o of offers) {
        const q = U.sum(Object.values(o.demand)) * fill;
        o.model.last = q; o.model.sold += q;
        o.model.regDemand = o.demand;
        rev += q * o.model.price * (1 - D.DEALER_MARGIN);
        cost += q * o.model.unit * cpi / o.model.cpi0;
        for (const rid in o.demand) if (!r.local[rid]) cost += o.demand[rid] * fill * o.model.price * U.table(regionOf(rid).tariff, G.t);
        units += q;
      }
      // SG&A + R&D + depreciation ≈ 13% of revenue, plus plant fixed cost per unit of capacity
      const fixed = rev * .17 + r.capacity * 10 * cpi + r.models.length * 9000 * cpi;
      const profit = rev - cost - fixed;
      r.cash += profit > 0 ? profit * .7 * .6 : profit;   // 30% tax, 40% of net paid out as dividends
      const cap = Math.max(5e6 * cpi, r.revY * .35); if (r.cash > cap && G.month === 11) r.cash = cap;   // surplus returned via buybacks
      r.salesM = units; r.revM = rev; r.profitM = profit;
      r.salesY += units; r.revY += rev; r.profitY += profit;
      r.util.push(r.capacity ? units / r.capacity : 0); if (r.util.length > 12) r.util.shift();
      r.dealers = Math.round(units / 25);
      // pending developments
      for (const p of r.pending.slice()) if (G.t >= p.readyT) {
        const old = r.models.findIndex(m => m.seg === p.model.seg && m.pt === p.model.pt);
        p.model.launchT = G.t;
        if (old >= 0) r.models[old] = p.model; else r.models.push(p.model);
        r.pending.splice(r.pending.indexOf(p), 1);
        S.log(G, `${r.name}: 신모델 ${p.model.name} 출시 (${D.SEGMENTS.find(s => s.id === p.model.seg).name}${p.model.pt === 'bev' ? ', 전기차' : p.model.pt === 'hev' ? ', 하이브리드' : ''})`, 'rival');
      }
    }
  };

  // annual strategy (January)
  S.rivalsYear = (G) => {
    const y = Math.floor(G.t), cpi = D.cpi(G.t);
    for (const def of D.ENTRANTS) if (y === def.y && !G.rivals.find(r => r.id === def.id)) {
      const base = D.RIVALS.find(r => r.id === def.id) || def;
      const r = S.spawnRival(G, base, !D.RIVALS.find(x => x.id === def.id) || base.size < .3);
      G.rivals.push(r); S.log(G, `신규 경쟁사 등장: ${r.name} (${regionOf(r.home).name})`, 'rival');
    }
    for (const r of G.rivals) {
      if (!r.alive) continue;
      const rng = U.rng((G.seed + y * 977 + r.id.charCodeAt(0) * 31 + r.id.charCodeAt(1)) | 0);
      const devCost = 600000 * cpi;
      // 1. model replacement
      for (const m of r.models) {
        const age = G.t - m.launchT;
        if (age > 5 + rng() * 3 && !r.pending.some(p => p.model.seg === m.seg) && r.cash > devCost * .3) {
          const nm = S.designRivalModel(G, r, m.seg, y + 2, rng, m.pt === 'bev' ? 'bev' : undefined);
          r.pending.push({ model: nm, readyT: G.t + 1.5 + rng() * 1.5 }); r.cash -= devCost;
        }
      }
      // 2. segment entry: biggest home segment not yet covered, when cash allows
      const shares = D.segShare(y, r.home);
      const missing = r.segs.filter(s => !r.models.some(m => m.seg === s) && !r.pending.some(p => p.model.seg === s) && !(s === 'suv' && y < 1984));
      if (missing.length && r.cash > devCost * 2.5 && rng() < .45) {
        const s = missing.sort((a, b) => shares[D.SEGMENTS.findIndex(x => x.id === b)] - shares[D.SEGMENTS.findIndex(x => x.id === a)])[0];
        r.pending.push({ model: S.designRivalModel(G, r, s, y + 2, rng), readyT: G.t + 2 + rng() }); r.cash -= devCost * 1.4;
      }
      // 3. electrification push
      const evShare = U.clamp((y - 2012) / 20, 0, 1) * (.4 + r.traits.ev);
      const hasEV = r.models.concat(r.pending.map(p => p.model)).some(m => m.pt === 'bev');
      if (y >= 2010 && !hasEV && rng() < evShare && r.cash > devCost * 2) {
        const s = r.segs.includes('suv') && y > 2016 ? 'suv' : r.segs.includes('lux') ? 'lux' : 'family';
        r.pending.push({ model: S.designRivalModel(G, r, s, y + 2, rng, 'bev'), readyT: G.t + 2.2 }); r.cash -= devCost * 1.6;
        S.log(G, `${r.name}: 전기차 개발 착수 발표`, 'rival');
      }
      // 4. capacity
      const u = U.sum(r.util) / Math.max(1, r.util.length);
      const fillAvg = r.fills && r.fills.length ? U.sum(r.fills) / r.fills.length : 1;
      if (fillAvg < .85) for (const m of r.models) m.price *= 1 + Math.min(.08, (1 - fillAvg) * .1);   // excess demand → price up
      else if (u < .5) for (const m of r.models) m.price *= .97;
      if ((u > .92 || fillAvg < .8) && r.cash > -r.revY * .1 && (r.profitY > 0 || fillAvg < .6)) { const add = r.capacity * (fillAvg < .5 ? .35 : .2); r.capacity += add; r.cash -= add * 12 * 55 * cpi; }
      else if (u < .5 && r.capacity > 1500) r.capacity *= .85;
      // 5. exports & local plants
      for (const R of D.REGIONS) if (R.id !== r.home) {
        const open = U.clamp(1 - U.table(R.tariff, G.t) * 2, 0, 1);
        if (r.rep > 48 && r.cash > 0) r.aware[R.id] = U.clamp((r.aware[R.id] || 0) + (2 + r.traits.tech * 3) * open * (y > 1955 ? 1 : .3), 0, 70);
        const regSales = U.sum(r.models.map(m => (m.regDemand || {})[R.id] || 0));
        if (!r.local[R.id] && r.salesY > 0 && regSales > r.salesY / 12 * .2 && regSales > 1500 && U.table(R.tariff, G.t) > .05 && r.cash > devCost * 3) { r.local[R.id] = 1; r.cash -= devCost * 2.5; S.log(G, `${r.name}: ${R.name} 현지 공장 건설`, 'rival'); }
      }
      // 6. reputation follows product quality
      const q = r.models.length ? U.sum(r.models.map(m => m.r.reliability * .6 + m.r.safety * .2 + m.r.prestige * .2)) / r.models.length : 50;
      r.rep = U.lerp(r.rep, q, .12);
      // 7. valuation & solvency
      const pe = U.table(D.PE, y);
      r.value = Math.max(r.capacity * 12 * 25 * cpi, r.cash + r.capacity * 12 * 40 * cpi + Math.max(0, r.profitY) * pe);
      r.hist.push({ y, sales: r.salesY, rev: r.revY, profit: r.profitY, cash: r.cash, value: r.value });
      if (r.cash < -Math.max(r.revY * .35, 5e6 * cpi) && !r.forSale) {
        r.forSale = { until: G.t + 1, price: Math.max(r.value * .5, r.capacity * 12 * 15 * cpi) };
        S.log(G, `${r.name} 경영 위기 — 매각 공고 (인수가 ${U.money(r.forSale.price)}). 시장·경쟁 화면에서 인수할 수 있습니다.`, 'bad');
      } else if (r.forSale && G.t >= r.forSale.until) {
        const buyer = G.rivals.filter(x => x.alive && x !== r && x.cash > r.forSale.price).sort((a, b) => b.cash - a.cash)[0];
        if (buyer) { S.mergeRival(G, buyer, r); }
        else { r.alive = false; S.log(G, `${r.name} 파산·청산`, 'rival'); }
      } else if (r.forSale && r.cash > 0) r.forSale = null;
      r.salesY = 0; r.revY = 0; r.profitY = 0;
    }
  };
  S.mergeRival = (G, buyer, r) => {
    buyer.cash -= r.forSale ? r.forSale.price : r.value;
    for (const m of r.models) { m.name = m.name.replace(r.name.split(' ')[0], buyer.name.split(' ')[0]); buyer.models.push(m); }
    buyer.capacity += r.capacity * .7; for (const k in r.local) buyer.local[k] = 1;
    for (const k in r.aware) buyer.aware[k] = Math.max(buyer.aware[k] || 0, r.aware[k] * .8);
    r.alive = false; r.mergedInto = buyer.name;
    S.log(G, `${buyer.name}, ${r.name} 인수 합병`, 'rival');
  };
})(window.MW);
