// Market: monthly demand per region × segment, logit choice between your models and
// rival brands, dealer coverage, brand awareness, regulations, tariffs, press reviews.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim;

  D.RIVALS = [
    { id: 'col', name: 'Columbia Motors', home: 'na', from: 1946, color: '#3a6ea5', bias: { comfort: 6, utility: 6, prestige: 3, economy: -6, drivability: 2 }, segs: ['family', 'lux', 'truck', 'muscle', 'suv', 'wagon'], skill: [[1946, 4], [1970, 3], [1985, -2], [2000, 0], [2035, 1]] },
    { id: 'hal', name: 'Halvorsen Auto', home: 'na', from: 1946, color: '#8a5a2b', bias: { utility: 8, reliability: 3, comfort: 2 }, segs: ['truck', 'family', 'econ', 'suv', 'wagon'], skill: [[1946, 3], [1980, 0], [2035, 2]] },
    { id: 'bra', name: 'Brandt Werke', home: 'eu', from: 1946, color: '#444c5c', bias: { prestige: 9, performance: 5, drivability: 5, safety: 4, price: -8 }, segs: ['lux', 'sport', 'family', 'super'], skill: [[1946, 1], [1970, 5], [2035, 6]] },
    { id: 'vol', name: 'Volkstrom', home: 'eu', from: 1946, color: '#2e7d5b', bias: { economy: 5, reliability: 4, practicality: 4, price: 4 }, segs: ['econ', 'family', 'wagon', 'suv'], skill: [[1946, -2], [1960, 3], [2035, 4]] },
    { id: 'fer', name: 'Ferrano', home: 'eu', from: 1947, color: '#b3262e', bias: { performance: 14, sportiness: 14, prestige: 10, reliability: -10, practicality: -15, price: -20 }, segs: ['super', 'sport'], skill: [[1946, 3], [2035, 6]] },
    { id: 'kit', name: 'Kitamura', home: 'ea', from: 1955, color: '#c9831c', bias: { reliability: 10, economy: 7, price: 4, prestige: -4 }, segs: ['econ', 'family', 'truck', 'suv', 'lux', 'sport'], skill: [[1955, -12], [1970, 0], [1985, 6], [2035, 6]] },
    { id: 'sgj', name: 'Sungjin Motor', home: 'ea', from: 1975, color: '#4b4ba8', bias: { price: 8, comfort: 3, safety: 2 }, segs: ['econ', 'family', 'suv'], skill: [[1975, -16], [1990, -6], [2005, 2], [2035, 5]] },
    { id: 'tat', name: 'Tarun Motors', home: 'em', from: 1960, color: '#6b8e23', bias: { price: 12, utility: 4, comfort: -6, safety: -8 }, segs: ['econ', 'truck', 'suv'], skill: [[1960, -18], [2000, -8], [2035, 0]] }
  ];
  const RATING_KEYS = ['performance', 'drivability', 'sportiness', 'comfort', 'practicality', 'utility', 'safety', 'economy', 'reliability', 'prestige'];
  D.RATING_KEYS = RATING_KEYS;
  D.RATING_NAME = { performance: '성능', drivability: '주행 편의', sportiness: '스포티함', comfort: '승차감', practicality: '실용성', utility: '적재/험로', safety: '안전', economy: '연비', reliability: '신뢰성', prestige: '고급감', price: '가격' };
  // segment fit: how a generic rival model of a segment rates (beyond the company skill)
  const SEG_PROFILE = {
    econ: { performance: -10, comfort: -8, prestige: -15, economy: 12, practicality: -4, sportiness: -8, utility: -6 },
    family: { comfort: 4, practicality: 6, prestige: -2 },
    wagon: { practicality: 14, utility: 8, sportiness: -10 },
    lux: { comfort: 18, prestige: 22, performance: 8, economy: -12, safety: 6 },
    sport: { performance: 16, sportiness: 22, practicality: -18, comfort: -6, utility: -20 },
    muscle: { performance: 18, sportiness: 8, economy: -18, prestige: 4 },
    truck: { utility: 26, comfort: -12, sportiness: -18, practicality: 4, economy: -8, prestige: -12 },
    suv: { utility: 16, practicality: 10, economy: -8, sportiness: -8, prestige: 4 },
    super: { performance: 34, sportiness: 32, prestige: 30, practicality: -30, utility: -30, economy: -30, reliability: -10 }
  };

  S.initRivals = (G) => {
    const rng = U.rng(G.seed + 7);
    G.rivals = D.RIVALS.map(R => ({ id: R.id, name: R.name, color: R.color, home: R.home, from: R.from, rep: 50 + rng() * 10, models: [], sales: 0, share: {} }));
    for (const r of G.rivals) S.rivalRefresh(G, r, true);
  };
  S.rivalRefresh = (G, r, initial) => {
    const R = D.RIVALS.find(x => x.id === r.id), y = Math.floor(G.t), rng = U.rng((G.seed + y * 13 + r.id.charCodeAt(0) * 7) | 0);
    if (G.t < R.from) return;
    const skill = U.table(R.skill, y);
    for (const seg of R.segs) {
      let m = r.models.find(x => x.seg === seg);
      const due = !m || (G.t - m.launched) > 5 + rng() * 3;
      if (!due) continue;
      if (seg === 'suv' && y < 1984 && !['hal', 'col'].includes(r.id)) continue;
      const ratings = {};
      for (const k of RATING_KEYS) ratings[k] = U.clamp(50 + skill + (R.bias[k] || 0) + (SEG_PROFILE[seg][k] || 0) + (rng() - .5) * 16, 2, 98);
      const segD = D.SEGMENTS.find(s => s.id === seg);
      const inc = D.income(y, D.REGIONS.find(x => x.id === R.home));
      const price = segD.price * inc * (1 - (R.bias.price || 0) / 60) * (.92 + rng() * .16);
      const name = r.name.split(' ')[0] + ' ' + ['Aurora', 'Comet', 'Meridian', 'Vista', 'Ranger', 'Atlas', 'Sierra', 'Nova', 'Orion', 'Pulse', 'Strada', 'Corsa', 'Titan', 'Kestrel'][Math.floor(rng() * 14)];
      const mm = { seg, ratings, price, launched: G.t, name, gen: (m ? m.gen + 1 : 1) };
      if (m) Object.assign(m, mm); else r.models.push(mm);
    }
  };

  // price score: how attractive a price is vs. what the segment buyer can pay
  S.priceScore = (price, target) => U.clamp(50 + (1 - price / target) * 85, 0, 100);

  // Utility of a product for a segment buyer
  S.utility = (ratings, priceS, seg, brandRep) => {
    let u = 0; const w = seg.w;
    for (const k in w) u += w[k] * (k === 'price' ? priceS : (ratings[k] ?? 30));
    return u + (brandRep - 50) * .12;
  };

  // regulations: can model m be sold in region in year?
  S.legalIn = (G, car, ev, er, rid) => {
    const y = G.t, iss = [];
    const lim = U.table(D.EMISSION_LIMIT[rid], y);
    if (er.emissions > lim) iss.push(`배출가스 ${er.emissions.toFixed(0)} > 기준 ${lim.toFixed(0)}`);
    for (const m of D.MANDATES) {
      const at = m.at[rid]; if (y < at) continue;
      if (m.key === 'cat') { if (!G.engines.find(e => e.id === car.engineId) || D.byId(D.E.cat, G.engines.find(e => e.id === car.engineId).cat).lvl < m.min) iss.push(m.name); continue; }
      if ((car.features[m.key] || 0) < m.min) iss.push(m.name);
    }
    return iss;
  };

  // monthly market simulation
  S.marketMonth = (G, perModel) => {
    const y = G.t, ev = D.eventsAt(y);
    const out = { regions: {}, sales: {} };
    const fuelShock = ev.some(e => e.fuelShock);
    for (const R of D.REGIONS) {
      let mult = 1; for (const e of ev) if (!e.region || e.region === R.id) mult *= (e.demand || 1);
      const season = 1 + .12 * Math.sin((G.month - 2) / 12 * 2 * Math.PI);
      const total = U.table(R.market, y) * 1e6 / 12 * mult * season;
      const share = D.segShare(y, R.id);
      const inc = D.income(y, R);
      const fuel = U.table(D.FUEL, y) * R.fuelTax;
      const fuelW = U.clamp(fuel / (inc / 5000), .5, 3) * (fuelShock ? 1.5 : 1); // fuel price burden scales economy weight
      const reg = out.regions[R.id] = { total, segs: {} };
      const dealers = G.dealers[R.id];
      const needDealers = Math.max(20, U.table(R.market, y) * 1e6 / 1500);
      const coverage = U.clamp(dealers.count / needDealers, 0, 1);
      const aware = G.aware[R.id] / 100;
      D.SEGMENTS.forEach((seg, si) => {
        const segSize = total * share[si];
        if (segSize < 1) return;
        const target = seg.price * inc;
        const w = Object.assign({}, seg.w); if (w.economy) w.economy *= fuelW;
        const segW = { ...seg, w };
        const offers = [];
        for (const r of G.rivals) for (const m of r.models) {
          if (m.seg !== seg.id) continue;
          const imp = r.home === R.id ? 1 : U.table(R.tariff, y) * 2 + .25; // foreign brands weaker
          const presence = r.home === R.id ? 1 : U.clamp((y - (r.from + 8)) / 25, 0, .8) * (1 - imp * .5);
          if (presence <= 0) continue;
          offers.push({ rival: r, m, u: S.utility(m.ratings, S.priceScore(m.price, target), segW, r.rep), presence });
        }
        // the rest of the industry (brands not modelled individually): average product for the era
        const others = Math.max(.6, 4 - G.rivals.filter(r => r.home === R.id && G.t >= r.from).length * .5);
        const avgR = {}; for (const kk of RATING_KEYS) avgR[kk] = 48 + (SEG_PROFILE[seg.id][kk] || 0) * .8;
        offers.push({ others: 1, u: S.utility(avgR, S.priceScore(target, target), segW, 50), presence: others });
        for (const pm of perModel) {
          if (!pm.regions.includes(R.id) || pm.illegal[R.id]?.length) continue;
          const landed = pm.price * (1 + (pm.localFab[R.id] ? 0 : U.table(R.tariff, y)));
          const rat = pm.ratingsFor(R);
          offers.push({ player: pm, u: S.utility(rat, S.priceScore(landed, target), segW, G.rep), presence: coverage * (.15 + .85 * Math.pow(aware, .8)) });
        }
        // logit choice; a weak outside option (used car / keep old car) absorbs demand only when every offer is poor
        const k = .09;
        let den = Math.exp(k * 30);
        for (const o of offers) { o.e = Math.exp(k * o.u) * o.presence; den += o.e; }
        for (const o of offers) {
          const q = segSize * o.e / den;
          if (o.player) { o.player.demand[R.id] = (o.player.demand[R.id] || 0) + q; o.player.segDemand[seg.id] = (o.player.segDemand[seg.id] || 0) + q; }
          else if (o.rival) { o.rival.sales += q; o.rival.share[R.id] = (o.rival.share[R.id] || 0) + q; }
        }
        reg.segs[seg.id] = { size: segSize, target, offers: offers.length };
      });
    }
    return out;
  };

  // ── press reviews ──
  D.MAGAZINES = [
    { id: 'mq', name: 'Motor Quarterly', region: 'na', bias: { performance: 1.3, comfort: 1.2, prestige: 1.1, price: 1.2 } },
    { id: 'ar', name: 'Autobahn Revue', region: 'eu', bias: { drivability: 1.4, sportiness: 1.3, safety: 1.2, economy: 1.1 } },
    { id: 'dc', name: 'Drive Consumer', region: 'ea', bias: { reliability: 1.5, economy: 1.3, practicality: 1.2, price: 1.3 } }
  ];
  S.reviewCar = (G, car, ev, rng) => {
    const r = ev.r, seg = D.SEGMENTS.find(s => s.id === car.segment) || D.SEGMENTS[1];
    const inc = D.income(G.t, D.REGIONS[0]);
    const ps = S.priceScore(car.price, seg.price * inc);
    return D.MAGAZINES.map(M => {
      let sw = 0, sv = 0;
      for (const k in seg.w) { const wt = seg.w[k] * (M.bias[k] || 1); sw += wt; sv += wt * (k === 'price' ? ps : r[k]); }
      const score = U.clamp((sv / sw) / 10 + (rng() - .5) * .8 + (G.rep - 50) / 100, 1, 10);
      const ranked = D.RATING_KEYS.map(k => [k, r[k] * (M.bias[k] || 1) * (seg.w[k] ? 1.4 : 1)]).sort((a, b) => b[1] - a[1]);
      const pros = ranked.slice(0, 2).map(([k]) => D.RATING_NAME[k]);
      const cons = D.RATING_KEYS.filter(k => seg.w[k]).sort((a, b) => r[a] - r[b]).slice(0, 2).map(k => D.RATING_NAME[k]);
      if (ps < 35) cons.unshift('비싼 가격'); else if (ps > 70) pros.push('뛰어난 가성비');
      const line = score >= 8.5 ? '동급 최고. 경쟁사가 긴장해야 할 차.' : score >= 7 ? '완성도 높은 한 대. 추천할 만하다.' : score >= 5.5 ? '무난하지만 결정적 한 방이 부족하다.' : score >= 4 ? '여러 면에서 경쟁차에 뒤처진다.' : '시장에 나오지 말았어야 할 차.';
      return { mag: M.name, score: Math.round(score * 10) / 10, pros, cons: cons.slice(0, 3), line, t: G.t };
    });
  };
})(window.MW);
