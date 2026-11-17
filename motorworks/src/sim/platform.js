// Vehicle platforms: a shared underbody (frame/floorpan, suspension, driveline layout,
// wheelbase & track ranges, engine bay). Cars built on a developed platform need only
// a "top hat": ~55% of the development cost, ~60% of the body tooling, 70% of the
// development time. Every unit built on a platform moves it down the learning curve
// (≈5% parts cost per doubling of cumulative volume).
(function (MW) {
  const U = MW.U, D = MW.data, C = D.C, S = MW.sim;
  S.defaultPlatform = (year, opts = {}) => ({
    id: U.uid('pf'), name: opts.name || '플랫폼 ' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + (year % 100),
    year, drive: year >= 1980 ? 'FF' : 'FR', chassis: year >= 1960 ? 'unibody' : 'ladder',
    suspF: year >= 1975 ? 'mac' : year >= 1950 ? 'dwb' : 'kingpin', suspR: year >= 1980 ? 'beam' : year >= 1960 ? 'coil' : 'leaf',
    wbMin: 2500, wbMax: 3000, wMin: 1650, wMax: 1950, bayLen: 900, ev: false, quality: 0, units: 0, ...opts
  });
  S.evalPlatform = (pf, year) => {
    const CH = D.byId(C.chassis, pf.chassis), SF = D.byId(C.suspF, pf.suspF), SR = D.byId(C.suspR, pf.suspR), DR = D.byId(C.drive, pf.drive);
    const span = (pf.wbMax - pf.wbMin) / 500 + (pf.wMax - pf.wMin) / 400;      // flexibility costs engineering
    const complexity = .7 + CH.labor / 40 + (SF.cost + SR.cost) / 60 + (DR.id === 'AWD' ? .3 : 0) + (pf.ev ? .6 : 0) + span * .25 + Math.max(0, pf.quality || 0) * .08;
    const issues = [];
    for (const [o, nm] of [[CH, '프레임'], [SF, '앞 서스펜션'], [SR, '뒤 서스펜션'], [DR, '구동']]) if (!D.avail(o, year)) issues.push(`${nm} ${o.name}: ${o.intro}년부터`);
    if (SR.ffOnly && DR.id !== 'FF') issues.push('토션빔 후륜은 FF 플랫폼 전용');
    if (pf.ev && year < 2008) issues.push('EV 스케이트보드는 2008년 이후');
    if (pf.wbMin >= pf.wbMax || pf.wMin >= pf.wMax) issues.push('범위가 잘못됨');
    return {
      complexity, issues,
      devMonths: Math.round(8 + complexity * 6), devCost: 160000 + 170000 * complexity,
      tooling: 140000 * complexity * (CH.id === 'ladder' ? .8 : 1),   // floor/frame dies + framing jigs, per factory
      stiffness: CH.stiff, learning: S.platformLearning(pf)
    };
  };
  S.platformLearning = (pf) => U.clamp(Math.pow(Math.max(1, (pf.units || 0) / 20000), -.074), .72, 1);
  S.carFitsPlatform = (car, pf) => car.body.wb >= pf.wbMin && car.body.wb <= pf.wbMax && car.body.W >= pf.wMin && car.body.W <= pf.wMax;
})(window.MW);
