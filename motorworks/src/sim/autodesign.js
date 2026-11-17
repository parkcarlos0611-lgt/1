// Automatic designer: produces a complete engine + platform + car for a segment, year,
// home market and company character, using exactly the same parts catalogue and
// physics as the player. Rival companies design every model this way; the player can
// use it as a "design proposal" starting point.
(function (MW) {
  const U = MW.U, D = MW.data, E = D.E, C = D.C, S = MW.sim;

  // typical exterior dimensions by segment, era and market (mm)
  const DIM = {
    econ: { L: [[1946, 4000], [1975, 3850], [1995, 4050], [2020, 4250]], H: [[1946, 1500], [1980, 1380], [2020, 1460]], W: [[1946, 1540], [1980, 1620], [2020, 1790]] },
    family: { L: [[1946, 4950], [1960, 5250], [1977, 4900], [1990, 4750], [2020, 4880]], H: [[1946, 1600], [1960, 1420], [1990, 1400], [2020, 1445]], W: [[1946, 1850], [1960, 1980], [1980, 1780], [2020, 1840]], eu: .9 },
    wagon: { L: [[1946, 5000], [1975, 4800], [2000, 4900], [2020, 5100]], H: [[1946, 1550], [1980, 1460], [2000, 1700], [2020, 1735]], W: [[1946, 1850], [1980, 1750], [2020, 1990]] },
    lux: { L: [[1946, 5400], [1960, 5700], [1978, 5300], [1995, 5050], [2020, 5150]], H: [[1946, 1650], [1960, 1400], [2020, 1470]], W: [[1946, 1950], [1960, 2030], [1990, 1860], [2020, 1900]] },
    sport: { L: [[1946, 4000], [1970, 4250], [2000, 4430], [2020, 4520]], H: [[1946, 1300], [1970, 1250], [2020, 1300]], W: [[1946, 1600], [1980, 1700], [2020, 1850]] },
    muscle: { L: [[1946, 4900], [1965, 4760], [1980, 4700], [2020, 4790]], H: [[1946, 1450], [1965, 1290], [2020, 1380]], W: [[1946, 1850], [1970, 1830], [2020, 1915]] },
    truck: { L: [[1946, 4900], [1975, 5290], [2000, 5550], [2020, 5900]], H: [[1946, 1800], [2020, 1960]], W: [[1946, 1900], [1980, 2010], [2020, 2030]] },
    suv: { L: [[1946, 4200], [1984, 4300], [2000, 4600], [2020, 4650]], H: [[1946, 1750], [2020, 1690]], W: [[1946, 1700], [2000, 1820], [2020, 1860]] },
    super: { L: [[1946, 4200], [1985, 4485], [2020, 4600]], H: [[1946, 1200], [1985, 1130], [2020, 1200]], W: [[1946, 1700], [1985, 1976], [2020, 2030]] }
  };
  const PRESET = (seg, y, ev) => {
    if (ev) return seg === 'suv' ? 'rav4' : seg === 'econ' ? 'golf7' : 'ev3';
    switch (seg) {
      case 'econ': return y < 1975 ? 'beetle' : y < 1990 ? 'box80' : 'golf7';
      case 'family': return y < 1953 ? 'us49' : y < 1958 ? 'eu55' : y < 1975 ? 'w123' : y < 1993 ? 'box80' : 'camry18';
      case 'wagon': return y < 1995 ? 'volvo240' : 'odyssey';
      case 'lux': return y < 1955 ? 'us49' : y < 1966 ? 'fin59' : y < 1993 ? 'w123' : 'camry18';
      case 'sport': return 'p996';
      case 'muscle': return 'muscle69';
      case 'truck': return 'f150';
      case 'suv': return y < 1990 ? 'volvo240' : 'rav4';
      case 'super': return 'tr84';
    }
    return 'camry18';
  };
  // displacement (L) & cylinders by segment/era/market
  const ENG = {
    econ: { d: [[1946, 1.1], [1970, 1.3], [1995, 1.5], [2015, 1.2]], c: y => y >= 2014 ? 3 : 4 },
    family: { d: [[1946, 3.6], [1958, 4.6], [1975, 4.1], [1985, 2.5], [2000, 2.4], [2020, 2.0]], c: (y, r) => (r === 'na' && y < 1983) ? (y > 1955 ? 8 : 6) : 4, eu: [[1946, 1.6], [1975, 2.0], [2020, 1.6]] },
    wagon: { d: [[1946, 3.6], [1975, 4.1], [1985, 2.3], [2020, 2.4]], c: (y, r) => (r === 'na' && y < 1983) ? 8 : y > 1995 ? 6 : 4 },
    lux: { d: [[1946, 5.4], [1960, 6.4], [1977, 6.0], [1985, 4.5], [2005, 4.5], [2020, 3.0]], c: y => y >= 2015 ? 6 : 8 },
    sport: { d: [[1946, 2.0], [1970, 2.4], [1990, 3.2], [2020, 3.0]], c: y => 6 },
    muscle: { d: [[1946, 4.0], [1960, 5.7], [1970, 7.0], [1975, 5.0], [2020, 5.0]], c: y => 8 },
    truck: { d: [[1946, 3.7], [1970, 5.0], [2000, 5.4], [2020, 3.5]], c: y => y < 1960 ? 6 : 8 },
    suv: { d: [[1946, 2.2], [1990, 2.5], [2005, 3.5], [2020, 2.5]], c: y => y >= 2000 && y < 2015 ? 6 : 4 },
    super: { d: [[1946, 3.0], [1970, 4.4], [1985, 4.9], [2005, 6.2], [2020, 6.5]], c: y => 12 }
  };
  // pick the most sophisticated option whose maturity meets the company's appetite
  const best = (list, y, th, filter = () => true) => {
    const ok = list.filter(o => D.avail(o, y) && D.maturity(o, y) >= th && filter(o));
    return (ok.length ? ok[ok.length - 1] : D.list(list, y)[0]).id;
  };

  S.autoDesign = ({ seg, year, region = 'na', traits = {}, rng = Math.random, name, pt }) => {
    const y = Math.floor(year), tech = traits.tech ?? .5, th = U.clamp(.92 - tech * .45, .35, 1);
    const prem = seg === 'lux' || seg === 'super' ? 1 : seg === 'sport' ? .6 : 0;
    // powertrain choice
    let powertrain = pt || 'ice';
    if (!pt) {
      const evApp = (traits.ev || 0) * U.clamp((y - 2008) / 10, 0, 1) + U.clamp((y - 2018) / 14, 0, .7) * .6;
      if (y >= 2010 && rng() < evApp && seg !== 'truck' && seg !== 'super') powertrain = 'bev';
      else if (y >= 2000 && rng() < U.clamp((y - 2000) / 25, 0, .5) * (.4 + tech) && ['family', 'suv', 'econ', 'wagon', 'lux'].includes(seg)) powertrain = 'hev';
    }
    // engine
    let engine = null;
    if (powertrain !== 'bev') {
      const spec = ENG[seg];
      const dTab = (region !== 'na' && spec.eu) ? spec.eu : spec.d;
      let disp = U.table(dTab, y) * (region === 'na' ? 1 : seg === 'lux' || seg === 'super' ? .85 : .8) * (.92 + rng() * .16);
      let cyl = spec.c(y, region);
      if (region !== 'na' && cyl === 8 && !['lux', 'muscle', 'truck', 'super'].includes(seg)) cyl = 6;
      const e = S.defaultEngine(y);
      const layout = cyl === 12 ? 'V' : cyl === 8 ? 'V' : cyl === 6 ? (y < 1975 || seg === 'truck' || seg === 'sport' && rng() < .4 ? 'I' : 'V') : 'I';
      const turbo = (seg === 'super' ? y >= 2015 : y >= 2010) && (tech > .3 || region !== 'na') && seg !== 'truck' && rng() < U.clamp((y - 2008) / 10, 0, .9);
      if (turbo) disp *= .78;
      const ratio = seg === 'sport' || seg === 'super' ? 1.12 : seg === 'truck' ? .9 : 1.0;
      const vcyl = disp / cyl * 1e6; // mm³
      const stroke = Math.cbrt(vcyl * 4 / (Math.PI * ratio * ratio));
      Object.assign(e, {
        name: (name || '') + ` ${layout}${cyl} ${disp.toFixed(1)}`, layout, cyl, vAngle: cyl === 6 ? 60 : cyl === 12 ? 60 : 90,
        bore: Math.round(stroke * ratio * 2) / 2, stroke: Math.round(stroke * 2) / 2,
        blockMat: best(E.blockMat, y, th + (prem ? 0 : .15)), headMat: best(E.headMat, y, th),
        head: best(E.heads, y, th), fuelSys: best(E.fuelSys, y, th, o => o.fuel === 'gas' && !o.perCyl), vvt: best(E.vvt, y, th),
        ignition: best(E.ignition, y, th), cat: best(E.cat, y, th), exhaust: prem || seg === 'muscle' ? best(E.exhaust, y, th) : 'log',
        crank: prem || seg === 'muscle' ? 'forged' : 'cast', rods: prem ? 'forged' : 'cast', pistons: best(E.pistons, y, th, o => o.id !== 'forged' || prem),
        cam: seg === 'sport' || seg === 'super' ? 65 : seg === 'muscle' ? 55 : seg === 'truck' ? 25 : 40,
        asp: turbo ? (y >= 2012 && tech > .7 && prem ? 'twin' : 'turbo') : 'na', boost: turbo ? 8 + tech * 4 + (prem ? 2 : 0) : 0, intercooler: turbo,
        balanceShaft: cyl === 4 && disp > 2.2 && y > 1980, quality: Math.round((traits.quality || 0) * 3)
      });
      e.valves = D.byId(E.heads, e.head).valves.includes(4) && D.maturity(D.byId(E.valves, 4), y) >= th ? 4 : 2;
      e.compression = 0; S.fixEngine(e, y);
      // compression: highest that stays clear of knock
      e.compression = 12; let er = S.evalEngine(e, y);
      e.compression = Math.max(5.6, Math.min(y >= 1971 && y < 1986 ? 8.6 : 12.5, er.knockCR - .4 - (turbo ? 2 : 0)));
      S.fixEngine(e, y);
      engine = e;
    }
    // body
    const preset = PRESET(seg, y, powertrain === 'bev');
    const car = S.defaultCar(y, engine?.id);
    car.body = S.bodyFromPreset(preset);
    const dm = DIM[seg], f = region === 'na' ? 1 : (dm.eu || .94);
    const b = car.body;
    const L0 = b.L;
    b.L = Math.round(U.table(dm.L, y) * (seg === 'family' || seg === 'lux' || seg === 'wagon' ? f : 1) * (.97 + rng() * .06) / 10) * 10;
    b.H = Math.round(U.table(dm.H, y) / 10) * 10; b.W = Math.round(U.table(dm.W, y) * (region === 'na' ? 1 : .96) / 10) * 10;
    b.wb = Math.round(b.wb * b.L / L0 / 10) * 10;
    if (seg === 'suv' && preset === 'volvo240') { b.clr = 220; b.H = 1720; }
    S.applyPresetTyre(car);
    car.tireW = Math.round(car.tireW * (b.W / D.BODY_REF[preset].W) / 5) * 5;
    b.paint = traits.palette ? traits.palette[Math.floor(rng() * traits.palette.length)] : ['#7d1f22', '#1f3550', '#c9c3b6', '#2b2d31', '#5a6a7a', '#e8e8e6', '#3a5a3a'][Math.floor(rng() * 7)];
    b.metallic = y >= 1965; b.chrome = y < 1975 ? (prem ? .9 : .5) : y < 1990 ? .25 : .05;
    b.sheet = best(C.sheet, y, th + .1, o => !['alu', 'cfrp', 'frp', 'uhss'].includes(o.id) || (prem && o.id === 'alu' && tech > .7));
    b.grade = prem ? 'C' : (traits.quality || 0) > .3 ? 'B' : (traits.price || 0) > .4 ? 'A' : 'B';
    // chassis & running gear
    const ladder = seg === 'truck' || (seg === 'suv' && y < 1995) || (y < 1958 && region === 'na');
    car.chassis = ladder ? 'ladder' : seg === 'super' && y >= 1995 && tech > .5 ? 'carbon' : 'unibody';
    if (!D.avail(D.byId(C.chassis, car.chassis), y)) car.chassis = 'ladder';
    car.drive = seg === 'super' ? 'MR' : preset === 'beetle' ? 'RR' : preset === 'p996' && rng() < .5 ? 'RR' : seg === 'truck' ? (rng() < .4 ? '4WD' : 'FR') : seg === 'suv' ? (y > 1995 ? 'AWD' : '4WD') :
      (['econ', 'family', 'wagon'].includes(seg) && y >= (region === 'na' ? 1982 : 1975)) ? 'FF' : 'FR';
    if (!D.avail(D.byId(C.drive, car.drive), y)) car.drive = 'FR';
    if (powertrain === 'bev') car.drive = rng() < .5 ? 'FR' : 'FF';
    car.suspF = car.chassis === 'ladder' && seg === 'truck' ? (y < 1965 ? 'solid' : 'dwb') : best(C.suspF, y, th, o => o.id !== 'air' || prem);
    car.suspR = seg === 'truck' ? 'leaf' : car.drive === 'FF' && y > 1975 ? (prem ? best(C.suspR, y, th) : 'beam') : best(C.suspR, y, th, o => !o.ffOnly && (o.id !== 'air' || prem) && o.id !== 'swing');
    if (!D.avail(D.byId(C.suspR, car.suspR), y) || (D.byId(C.suspR, car.suspR).ffOnly && car.drive !== 'FF')) car.suspR = 'coil';
    car.brakes = best(C.brakes, y, th, o => o.id !== 'ccb' || (seg === 'super' && tech > .6));
    car.tires = seg === 'sport' || seg === 'super' ? best(C.tires, y, th, o => o.id !== 'semi' && o.id !== 'eco' && o.id !== 'offroad') : seg === 'truck' && rng() < .3 ? 'offroad' : best(C.tires, y, th, o => ['bias', 'radial', 'eco'].includes(o.id));
    const auto = (region === 'na' && y >= 1955 && seg !== 'sport') || (y >= 2005 && seg !== 'sport') || prem;
    car.gearbox = auto ? best(C.gearbox, y, th, o => o.auto && o.id !== 'dct' && o.id !== 'cvt') : best(C.gearbox, y, th, o => !o.auto);
    if (seg === 'econ' && y >= 2005 && rng() < .4) car.gearbox = best(C.gearbox, y, th, o => o.id === 'cvt' || !o.auto);
    car.gearing = seg === 'sport' || seg === 'super' || seg === 'muscle' ? 65 : seg === 'econ' ? 35 : 45;
    car.springs = seg === 'sport' || seg === 'super' ? 72 : seg === 'lux' ? 25 : 45;
    car.interior = seg === 'super' ? 'prem' : seg === 'lux' ? (y > 1990 && tech > .6 ? 'lux' : 'lux') : seg === 'econ' ? (y < 1970 ? 'basic' : 'std') : seg === 'truck' ? 'basic' : 'std';
    const feats = {};
    for (const k in C.features) {
      const list = C.features[k];
      let lvl = 0;
      for (const o of list) if (D.avail(o, y) && D.maturity(o, y) >= th + (prem ? -.25 : 0)) lvl = o.id;
      if (k === 'adas' && !prem && y < 2018) lvl = 0;
      if (k === 'ac' && seg === 'econ' && y < 1985) lvl = Math.min(lvl, 1);
      if (k === 'radio' && seg === 'econ' && y < 1970) lvl = Math.min(lvl, 1);
      feats[k] = lvl;
    }
    // satisfy mandates in home region
    for (const m of D.MANDATES) if (m.key !== 'cat' && y >= m.at[region]) feats[m.key] = Math.max(feats[m.key] || 0, m.min);
    car.features = feats;
    car.quality = Math.round((traits.quality || 0) * 3);
    car.powertrain = powertrain;
    if (powertrain !== 'ice') { car.ev = S.evDefaults(y, powertrain); if (powertrain === 'bev') { car.ev.kWh = seg === 'econ' ? 50 : seg === 'lux' ? 95 : 72; car.ev.kw = seg === 'lux' || seg === 'sport' ? 300 : seg === 'econ' ? 110 : 190; car.ev.motors = seg === 'lux' || seg === 'suv' ? 2 : 1; } }
    // tailored blanks: deep-drawn panels get a more formable steel
    const A = S.analyseBody(car.body, y);
    for (const p of S.panelMaterials(car.body, A)) if (p.scrap > 0) {
      const alt = C.sheet.filter(o => D.avail(o, y) && D.maturity(o, y) > .5 && (D.FORM[o.id] || 0) + .08 >= p.depth && !['frp', 'cfrp', 'alu'].includes(o.id)).sort((a, b) => b.crash - a.crash)[0];
      if (alt) (car.body.panels = car.body.panels || {})[p.id] = { sheet: alt.id, grade: 'C' };
    }
    car.segment = seg; car.name = name || seg;
    car.body.seats = seg === 'super' ? 2 : seg === 'truck' ? 3 : seg === 'wagon' && preset === 'odyssey' ? 8 : car.body.seats;
    return { engine, car };
  };

  // cost-plus pricing for an evaluated design
  S.autoPrice = (G, car, ev, er, region, traits = {}) => {
    const y = G.t, cpi = D.cpi(y);
    const unit = ev.partsCost * cpi * 1.04 * (region === 'ea' || region === 'em' ? .9 : 1) + (60 * ev.laborBody + 30 * ev.laborAsm + (er.hours || 8)) * D.wage(y, D.REGIONS.find(r => r.id === region)) * .55;
    const seg = D.SEGMENTS.find(s => s.id === car.segment) || D.SEGMENTS[1];
    const target = seg.price * D.income(y, D.REGIONS.find(r => r.id === region));
    const markup = 1.38 + (ev.r.prestige - 50) / 200 - (traits.price || 0) * .1;
    let p = unit * markup / (1 - D.DEALER_MARGIN);
    p = Math.max(U.clamp(p, target * .65, target * 2.2), unit * 1.32 / (1 - D.DEALER_MARGIN));
    return { price: Math.round(p / 10) * 10, unit };
  };
})(window.MW);
