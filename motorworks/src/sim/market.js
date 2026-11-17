// Market: monthly demand per region × segment, shared by the player and every rival
// company. Each offer is a real evaluated car (ratings from the physics model), with
// its trims, landed price (tariffs, EV incentives), residual value, EV range anxiety
// against local charging infrastructure, and the brand's presence (dealers, awareness).
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim;

  D.RIVALS = [
    { id: 'col', name: 'Columbia Motors', home: 'na', from: 1946, color: '#3a6ea5', size: 1.6, traits: { price: 0, quality: 0, tech: .45, ev: .2 }, segs: ['family', 'lux', 'truck', 'muscle', 'wagon', 'suv'] },
    { id: 'hal', name: 'Halvorsen Auto', home: 'na', from: 1946, color: '#8a5a2b', size: 1.2, traits: { price: .2, quality: -.1, tech: .35, ev: .1 }, segs: ['truck', 'family', 'econ', 'suv', 'wagon'] },
    { id: 'bra', name: 'Brandt Werke', home: 'eu', from: 1946, color: '#444c5c', size: .6, traits: { price: -.4, quality: .4, tech: .8, ev: .4 }, segs: ['lux', 'sport', 'family'] },
    { id: 'vol', name: 'Volkstrom', home: 'eu', from: 1946, color: '#2e7d5b', size: 1.0, traits: { price: .3, quality: .2, tech: .55, ev: .5 }, segs: ['econ', 'family', 'wagon', 'suv'] },
    { id: 'fer', name: 'Ferrano', home: 'eu', from: 1947, color: '#b3262e', size: .05, traits: { price: -1, quality: -.2, tech: .9, ev: 0 }, segs: ['super', 'sport'] },
    { id: 'kit', name: 'Kitamura', home: 'ea', from: 1955, color: '#c9831c', size: .5, traits: { price: .35, quality: .6, tech: .6, ev: .3 }, segs: ['econ', 'family', 'truck', 'suv', 'lux'] },
    { id: 'sgj', name: 'Sungjin Motor', home: 'ea', from: 1975, color: '#4b4ba8', size: .3, traits: { price: .55, quality: .1, tech: .5, ev: .5 }, segs: ['econ', 'family', 'suv'] },
    { id: 'tat', name: 'Tarun Motors', home: 'em', from: 1960, color: '#6b8e23', size: .25, traits: { price: .8, quality: -.3, tech: .25, ev: .2 }, segs: ['econ', 'truck', 'suv'] }
  ];
  D.RATING_KEYS = ['performance', 'drivability', 'sportiness', 'comfort', 'practicality', 'utility', 'safety', 'economy', 'reliability', 'prestige'];
  D.RATING_NAME = { performance: '성능', drivability: '주행 편의', sportiness: '스포티함', comfort: '승차감', practicality: '실용성', utility: '적재/험로', safety: '안전', economy: '연비', reliability: '신뢰성', prestige: '고급감', price: '가격', value: '잔존가치' };

  S.priceScore = (price, target) => U.clamp(50 + (1 - price / target) * 85, 0, 100);
  S.utility = (r, priceS, seg, rep) => {
    let u = 0; const w = seg.w;
    for (const k in w) u += w[k] * (k === 'price' ? priceS : (r[k] ?? 30));
    u += .06 * (r.value ?? 50);                      // every buyer cares a little about resale
    return u + (rep - 50) * .12;
  };
  // three-year residual value as a share of list price
  S.residual = (r, rep, corrosion = .5, incentive = 0, fleet = 0, pt = 'ice', y = 2000) =>
    U.clamp(.34 + (r.reliability - 50) * .004 + (corrosion - .5) * .12 + (rep - 50) * .003 + (r.prestige - 50) * .002 - incentive * 1.2 - fleet * .25 - (pt === 'bev' && y < 2030 ? .06 : 0), .15, .78);

  S.legalIn = (G, car, ev, er, rid) => {
    const y = G.t, iss = [];
    const lim = U.table(D.EMISSION_LIMIT[rid], y);
    const em = car.powertrain === 'bev' ? 0 : (er?.emissions ?? 0) * (car.powertrain === 'hev' ? .7 : car.powertrain === 'phev' ? .45 : 1);
    if (em > lim) iss.push(`배출가스 ${em.toFixed(0)} > 기준 ${lim.toFixed(0)}`);
    for (const m of D.MANDATES) {
      if (y < m.at[rid]) continue;
      if (m.key === 'cat') { if (car.powertrain !== 'bev' && (!er || D.byId(D.E.cat, er.catId || 'none').lvl < m.min)) iss.push(m.name); continue; }
      if ((car.features[m.key] || 0) < m.min) iss.push(m.name);
    }
    return iss;
  };

  // EV acceptance: range anxiety vs. charging infrastructure; early-adopter limit
  S.evPenalty = (offer, R, y) => {
    if (offer.pt !== 'bev') return offer.pt === 'phev' ? -2 : 0;
    const infra = U.table(D.CHARGE_INFRA[R.id], y);
    const range = offer.range || 200;
    return Math.max(0, (420 - range) / 420 * 22) * (1 - infra * .6) + (1 - infra) * 16;
  };

  // offers: [{owner, car, trims:[{r, price, mix}], pt, range, corrosion, presence:{rid}, local:{rid}, segFit}]
  S.marketMonth = (G, offers) => {
    const y = G.t, ev = D.eventsAt(y);
    const fuelShock = ev.some(e => e.fuelShock);
    const out = { regions: {} };
    for (const o of offers) { o.demand = {}; o.segDemand = {}; o.trimDemand = o.trims.map(() => 0); }
    for (const R of D.REGIONS) {
      let mult = 1; for (const e of ev) if (!e.region || e.region === R.id) mult *= (e.demand || 1);
      const season = 1 + .12 * Math.sin((G.month - 2) / 12 * 2 * Math.PI);
      const total = U.table(R.market, y) * 1e6 / 12 * mult * season;
      const share = D.segShare(y, R.id), inc = D.income(y, R);
      const fuel = U.table(D.FUEL, y) * R.fuelTax;
      const fuelW = U.clamp(fuel / (inc / 5000), .5, 3) * (fuelShock ? 1.5 : 1);
      const tariff = U.table(R.tariff, y), incentive = U.table(D.EV_INCENTIVE[R.id], y);
      const reg = out.regions[R.id] = { total, segs: {} };
      D.SEGMENTS.forEach((seg, si) => {
        const segSize = total * share[si];
        if (segSize < 1) return;
        const target = seg.price * inc;
        const w = Object.assign({}, seg.w); if (w.economy) w.economy *= fuelW;
        const segW = { ...seg, w };
        const k = .09;
        let den = Math.exp(k * 30) * (1 + Math.max(0, y - 1946) * .004); // weak outside option: used cars / keep old car
        const live = [];
        for (const o of offers) {
          const pres = o.presence[R.id] || 0; if (pres <= 0) continue;
          const fit = o.segFit ? o.segFit[seg.id] ?? 1 : 1; if (fit <= 0) continue;
          let es = 0; const eu = [];
          o.trims.forEach((t, ti) => {
            let landed = t.price * (o.local[R.id] ? 1 : 1 + tariff);
            if (o.pt === 'bev' && incentive && landed < target * 2.5) landed -= incentive;
            const r = { ...t.r, value: t.value * 100 };
            const u = S.utility(r, S.priceScore(landed, target), segW, o.rep) - S.evPenalty(o, R, y);
            const e = Math.exp(k * u); eu.push(e); es += e;
          });
          const n = o.trims.length;
          const eModel = es / n * (1 + .12 * (n - 1)) * pres * fit;
          live.push({ o, eModel, eu, es }); den += eModel;
        }
        let segOffers = 0;
        for (const L of live) {
          const q = segSize * L.eModel / den;
          L.o.demand[R.id] = (L.o.demand[R.id] || 0) + q;
          L.o.segDemand[seg.id] = (L.o.segDemand[seg.id] || 0) + q;
          L.eu.forEach((e, ti) => L.o.trimDemand[ti] += q * e / L.es);
          if (q > segSize * .01) segOffers++;
        }
        reg.segs[seg.id] = { size: segSize, target, offers: segOffers, unmet: segSize * Math.exp(k * 30) / den };
      });
    }
    return out;
  };

  // ── press: reviews, comparison tests, awards ──
  D.MAGAZINES = [
    { id: 'mq', name: 'Motor Quarterly', region: 'na', bias: { performance: 1.3, comfort: 1.2, prestige: 1.1, price: 1.2 } },
    { id: 'ar', name: 'Autobahn Revue', region: 'eu', bias: { drivability: 1.4, sportiness: 1.3, safety: 1.2, economy: 1.1 } },
    { id: 'dc', name: 'Drive Consumer', region: 'ea', bias: { reliability: 1.5, economy: 1.3, practicality: 1.2, price: 1.3 } }
  ];
  S.magScore = (M, r, price, seg, y) => {
    const inc = D.income(y, D.REGIONS.find(x => x.id === M.region));
    const ps = S.priceScore(price, seg.price * inc);
    let sw = 0, sv = 0;
    for (const k in seg.w) { const wt = seg.w[k] * (M.bias[k] || 1); sw += wt; sv += wt * (k === 'price' ? ps : r[k]); }
    return { score: sv / sw / 10, ps };
  };
  S.reviewCar = (G, car, r, price, rng, rivals = []) => {
    const seg = D.SEGMENTS.find(s => s.id === car.segment) || D.SEGMENTS[1];
    return D.MAGAZINES.map(M => {
      const { score: base, ps } = S.magScore(M, r, price, seg, G.t);
      const score = U.clamp(base + (rng() - .5) * .8 + (G.rep - 50) / 100, 1, 10);
      const ranked = D.RATING_KEYS.map(k => [k, r[k] * (M.bias[k] || 1) * (seg.w[k] ? 1.4 : 1)]).sort((a, b) => b[1] - a[1]);
      const pros = ranked.slice(0, 2).map(([k]) => D.RATING_NAME[k]);
      const cons = D.RATING_KEYS.filter(k => seg.w[k]).sort((a, b) => r[a] - r[b]).slice(0, 2).map(k => D.RATING_NAME[k]);
      if (ps < 35) cons.unshift('비싼 가격'); else if (ps > 70) pros.push('뛰어난 가성비');
      // comparison test against the best-selling rival models in the segment
      const field = [{ name: car.name, s: score, me: 1 }, ...rivals.map(x => ({ name: x.name, s: U.clamp(S.magScore(M, x.r, x.price, seg, G.t).score + (rng() - .5) * .6, 1, 10) }))].sort((a, b) => b.s - a.s);
      const rank = field.findIndex(f => f.me) + 1;
      const line = score >= 8.5 ? '동급 최고. 경쟁사가 긴장해야 할 차.' : score >= 7 ? '완성도 높은 한 대. 추천할 만하다.' : score >= 5.5 ? '무난하지만 결정적 한 방이 부족하다.' : score >= 4 ? '여러 면에서 경쟁차에 뒤처진다.' : '시장에 나오지 말았어야 할 차.';
      return { mag: M.name, score: Math.round(score * 10) / 10, pros, cons: cons.slice(0, 3), line, t: G.t, comparison: field.length > 1 ? { rank, of: field.length, field: field.map(f => `${f.name} ${f.s.toFixed(1)}`) } : null };
    });
  };
})(window.MW);
