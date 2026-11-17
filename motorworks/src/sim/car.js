// Vehicle: body shape (side + top profiles), parts, mass build-up, aerodynamics,
// longitudinal simulation (0-100, top speed, gearing), braking, handling,
// fuel economy, cost/labour build-up and era-normalised ratings.
(function (MW) {
  const U = MW.U, D = MW.data, C = D.C, S = MW.sim;

  // ── body archetypes. side: upper outline front-bottom → rear-bottom (x 0..1 of length, y 0..1 of height)
  // glass: greenhouse polygon. top: half-width plan profile front → rear (y = fraction of half width)
  // presets are authored in real mm (data/bodies.js); stored normalised so sliders rescale them
  S.tyreFromSpec = (spec, Dmm) => {
    let m = /^(\d+)\/(\d+)\s*[A-Z]*R?\s*(\d+)/i.exec(spec);
    if (m) return { tireW: +m[1], tireAR: +m[2], rim: +m[3] };
    m = /^(\d+(?:\.\d+)?)-(\d+)/.exec(spec);
    if (m) return { tireW: Math.round(+m[1] * 25.4 / 5) * 5, tireAR: 92, rim: +m[2] };
    const rim = +(/(\d+)$/.exec(spec) || [0, 14])[1]; const w = 185; return { tireW: w, tireAR: Math.round(((Dmm || 640) - rim * 25.4) / 2 / w * 100 / 5) * 5, rim };
  };
  S.bodyFromPreset = (id) => {
    const p = D.BODY_REF[id] || D.BODY_REF.camry18;
    const n = (arr) => arr.map(([x, y, sh]) => ({ x: x / p.L, y: y / p.H, ...(sh ? { s: 1 } : {}) }));
    return { preset: id, L: p.L, W: p.W, H: p.H, wb: p.wb, clr: p.clr, foh: p.foh / (p.L - p.wb), doors: p.doors, seats: p.seats,
      side: n(p.side), glass: n(p.glass), top: p.top.map(([x, y]) => ({ x: x / p.L, y })), chrome: p.ev ? 0 : .5, bed: p.bed || 0, hatch: p.hatch || 0,
      sheet: 'mild', grade: 'B', paint: '#6e1f22', charLine: .5, rawSheet: false, customTex: null, tyre: p.tyre, tyreD: p.tyreD };
  };
  S.applyPresetTyre = (car) => { const b = car.body; Object.assign(car, S.tyreFromSpec(b.tyre || '205/60R15', b.tyreD)); };
  S.defaultCar = (year, engineId) => {
    const body = S.bodyFromPreset(D.defaultPreset(year));
    if (year >= 1990) body.sheet = 'hsla'; else if (year >= 1980) body.sheet = 'galv';
    const c = {
      id: U.uid('car'), name: '신형 모델', year, engineId, body,
      chassis: year >= 1960 ? 'unibody' : 'ladder', suspF: year >= 1975 ? 'mac' : 'kingpin', suspR: year >= 1975 ? 'coil' : 'leaf',
      springs: 50, brakes: year >= 1975 ? 'disc' : 'drum', tires: year >= 1972 ? 'radial' : 'bias', tireW: 185, tireAR: year >= 1975 ? 70 : 85, rim: year >= 1985 ? 15 : 14,
      gearbox: year >= 1985 ? 'm5' : year >= 1965 ? 'm4' : 'm3', gearing: 50, drive: year >= 1980 ? 'FF' : 'FR',
      interior: 'std', features: { radio: 1, ac: 1, steer: 0, belts: year >= 1970 ? 2 : 0, airbag: year >= 1995 ? 1 : 0, abs: 0, esc: 0, adas: 0, crumple: year >= 1965 ? 1 : 0 },
      quality: 0
    };
    S.applyPresetTyre(c);
    return c;
  };

  // geometry helpers in real mm
  S.bodyGeom = (b) => {
    const side = U.spline(b.side.map(p => ({ x: p.x * b.L, y: p.y * b.H, s: p.s })), 10, false);
    const glass = U.spline(b.glass.map(p => ({ x: p.x * b.L, y: p.y * b.H })), 8, true);
    const top = U.spline(b.top.map(p => ({ x: p.x * b.L, y: p.y * b.W / 2 })), 10, false);
    const fohMM = (b.L - b.wb) * b.foh;
    const fx = fohMM, rx = fohMM + b.wb;
    return { side, glass, top, fx, rx };
  };

  // aero & packaging analysis of the profile
  S.analyseBody = (b, year, opt0 = {}) => {
    const g = S.bodyGeom(b);
    const H = b.H, L = b.L, W = b.W;
    const s = b.side.map(p => ({ x: p.x, y: p.y })); // normalized
    // locate roof peak and pillars
    let roofI = 0; s.forEach((p, i) => { if (p.y > s[roofI].y) roofI = i; });
    const gl = b.glass;
    const A0 = gl[0], A1 = gl[1], C1 = gl[gl.length - 2], C0 = gl[gl.length - 1];
    const wsAngle = Math.atan2((A1.y - A0.y) * H, (A1.x - A0.x) * L) * 180 / Math.PI; // windshield rake from horizontal
    const rearAngle = Math.atan2((C1.y - C0.y) * H, (C0.x - C1.x) * L) * 180 / Math.PI;
    const noseH = s[1].y; const tailH = s[s.length - 2].y;
    // curvature roughness (sum of turning angles) → panel complexity and drag
    let turn = 0; for (let i = 1; i < g.side.length - 1; i++) { const a = g.side[i - 1], c = g.side[i], d = g.side[i + 1]; const a1 = Math.atan2(c.y - a.y, c.x - a.x), a2 = Math.atan2(d.y - c.y, d.x - c.x); let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da; turn += da; }
    let topTurn = 0; for (let i = 1; i < g.top.length - 1; i++) { const a = g.top[i - 1], c = g.top[i], d = g.top[i + 1]; const a1 = Math.atan2(c.y - a.y, c.x - a.x), a2 = Math.atan2(d.y - c.y, d.x - c.x); let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da; topTurn += da; }
    const frontRound = 1 - b.top[0].y; // plan-view nose taper
    const rearTaper = 1 - b.top[b.top.length - 1].y;
    // drag coefficient
    let cd = .25;
    cd += U.clamp((wsAngle - 25) / 45, 0, 1) * .12;         // upright windshield
    cd += U.clamp((noseH - .3) / .4, 0, 1) * .07;            // tall blunt nose
    cd += U.clamp(1 - frontRound / .3, 0, 1) * .04;          // square plan nose
    const step = Math.max(0, C0.y - tailH);
    cd += U.clamp(rearAngle / 80, 0, 1) * .03 + step * .05;  // notchback / bluff rear
    cd -= U.clamp(rearTaper / .3, 0, 1) * .02;                // boat-tail
    cd += b.chrome * .02 + (b.bed ? .06 : 0);
    cd += U.clamp((turn - 4.6) / 8, 0, .05);                    // fussy surfaces
    cd += year < 1975 ? .04 : year < 1990 ? .02 : 0;            // gaps, gutters, non-flush glass
    cd += b.clr > 190 ? .04 : 0;
    cd = U.clamp(cd, .2, .75); const cdRaw = cd;
    // anchor: the untouched reference outline must give the reference car's measured Cd
    const ref = D.BODY_REF[b.preset];
    if (ref && !opt0.noAnchor) { const base = S.analyseBody(S.bodyFromPreset(b.preset), ref.ev ? 2020 : year, { noAnchor: 1 }).cdRaw; cd = U.clamp(ref.cd + (cd - base) + (year < 1975 && !(ref.cd > .4) ? .03 : 0), .19, .75); }
    const frontal = (W / 1000) * ((H - b.clr) / 1000) * .84 + .1; // m²
    // packaging
    const glassArea = U.polyArea(g.glass) / 1e6;          // m² in side view
    const cabinLen = (C0.x - A0.x) * L;
    const cabinH = (s[roofI].y * H - (b.clr + 250));
    const cabinVol = cabinLen / 1000 * W / 1000 * .78 * cabinH / 1000;   // m³
    // trunk: area of side profile behind the C pillar, above bumper line
    const trunkLen = (1 - C0.x) * L;
    const trunkH = Math.max(0, tailH * H - b.clr - 180);
    let cargo = trunkLen / 1000 * trunkH / 1000 * W / 1000 * .55; // m³
    if (b.hatch) cargo += .15 + (C1.x - C0.x < 0 ? .1 : 0);
    if (b.bed) cargo = trunkLen / 1000 * .5 * W / 1000 * .9;
    const skin = (2 * U.polyArea(g.side.concat([{ x: L, y: b.clr }, { x: 0, y: b.clr }])) / 1e6 + (L * W) / 1e6 * 1.5) * .9; // m² of panels
    let complexity = U.clamp(.6 + (turn - 3) * .12 + topTurn * .15 + (b.chrome || 0) * .25, .5, 2.4);
    const refB = D.BODY_REF[b.preset];
    if (refB && !opt0.noAnchor) complexity = U.clamp((refB.cx || 1) + complexity - S.analyseBody(S.bodyFromPreset(b.preset), year, { noAnchor: 1 }).complexity, .5, 2.2);
    const visibility = U.clamp(glassArea / (L * H / 1e6) * 6, 0, 1);
    const cg = (b.clr + (H - b.clr) * .38) / 1000;
    return { cd, cdRaw, frontal, cda: cd * frontal, wsAngle, rearAngle, cabinVol, cargo, skin, complexity, visibility, glassArea, cg, cabinLen };
  };

  // panel materials: per-panel override of the body sheet (tailored blanks)
  S.panelMaterials = (b, A) => {
    const out = [];
    for (const P of D.PANELS) {
      if (P.id === 'rdoor' && b.doors < 4) continue;
      const m = (b.panels && b.panels[P.id]) || { sheet: b.sheet, grade: b.grade };
      const SH = D.byId(C.sheet, m.sheet), GR = SH.grades.find(g => g.id === m.grade) || SH.grades[1];
      const depth = P.depth * U.clamp(A.complexity, .6, 1.8) * (P.id === 'quarter' && b.bed ? .7 : 1);
      const form = (D.FORM[SH.id] ?? .8) + (GR.id === 'C' ? .08 : GR.id === 'A' ? -.05 : 0);
      const scrap = Math.max(0, depth - form) * .9;
      out.push({ ...P, share: P.share * (b.doors < 4 && P.id === 'door' ? 1.85 : 1), SH, GR, depth, form, scrap });
    }
    const tot = U.sum(out.map(p => p.share)); out.forEach(p => p.share /= tot);
    return out;
  };

  // car evaluation. opt: { platform, noHot }
  S.evalCar = (car0, eng, er0, year, opt = {}) => {
    const pf = opt.platform;
    const car = pf ? { ...car0, chassis: pf.chassis, suspF: pf.suspF, suspR: pf.suspR, drive: pf.drive } : car0;
    const pt = car.powertrain || 'ice';
    const er = pt === 'ice' ? er0 : S.electrify(car, er0, year);
    const b = car.body, A = S.analyseBody(b, year);
    const CH = D.byId(C.chassis, car.chassis);
    const SF = D.byId(C.suspF, car.suspF), SR = D.byId(C.suspR, car.suspR), BR = D.byId(C.brakes, car.brakes), TI = D.byId(C.tires, car.tires);
    const GB = pt === 'bev' ? { id: 'ev1', g: 1, eff: .97, mass: 25, shift: 0, comfort: .95, sport: .6, auto: 1, cost: 20 } : D.byId(C.gearbox, car.gearbox);
    const DR = D.byId(C.drive, car.drive), IN = D.byId(C.interior, car.interior);
    const F = car.features, feat = k => D.byId(C.features[k], F[k] || 0);
    const q = (car.quality || 0) / 5;
    const warn = [];
    // panels (tailored blanks)
    const panels = S.panelMaterials(b, A);
    const pw_ = k => U.sum(panels.map(p => p.share * k(p)));
    const SH = D.byId(C.sheet, b.sheet), GR = SH.grades.find(g => g.id === b.grade) || SH.grades[1];
    const thick = pw_(p => p.GR.t * p.SH.dens / 7.85);
    for (const p of panels) if (p.scrap > .02) warn.push(`${p.name}: 성형 깊이 ${p.depth.toFixed(2)} > ${p.SH.name} ${p.GR.id}등급 성형한계 ${p.form.toFixed(2)} — 스크랩 ${Math.round(p.scrap * 100)}%`);
    // ── platform constraints ──
    if (pf) {
      if (b.wb < pf.wbMin || b.wb > pf.wbMax) warn.push(`휠베이스 ${b.wb}mm가 플랫폼 범위(${pf.wbMin}–${pf.wbMax})를 벗어남`);
      if (b.W < pf.wMin || b.W > pf.wMax) warn.push(`전폭 ${b.W}mm가 플랫폼 트랙 범위(${pf.wMin}–${pf.wMax})를 벗어남`);
      if (pf.ev && pt !== 'bev') warn.push('전용 EV 스케이트보드 플랫폼은 BEV만 가능');
    }
    // ── mass build-up (kg) ──
    const sizeF = (b.L * b.W) / (4.7e6 * 1.78);
    const chassisKg = 300 * CH.mass * sizeF * (b.bed ? 1.15 : 1) * (pf?.ev ? 1.08 : 1);
    const panelKg = A.skin * thick / 1000 * 7.85 * 1000 * 1.25;
    const glassKg = A.glassArea * 2 * 12 + 18;
    const suspKg = SF.mass + SR.mass, brakeKg = BR.mass;
    const wheelKg = 4 * (8 + car.tireW * .03 + car.rim * .5);
    const featKg = Object.keys(C.features).reduce((s, k) => s + (feat(k).mass || feat(k).cost * .15 || 0), 0);
    const intKg = IN.mass * (b.seats / 5) ** .5;
    const fuelKg = pt === 'bev' ? 0 : 45;
    const misc = 60 * sizeF + 25 + Math.max(0, year - 1946) * 2.2 * sizeF; // wiring, insulation, crash structure grow with the era
    const chromeKg = (b.chrome || 0) * 40;
    const driveKg = GB.mass + (DR.id === '4WD' || DR.id === 'AWD' || (car.ev?.motors > 1) ? 70 : 25);
    const curb = Math.round(chassisKg + panelKg + glassKg + suspKg + brakeKg + wheelKg + featKg + intKg + fuelKg + misc + chromeKg + driveKg + er.mass);
    const test = curb + 150;
    // packaging
    const g = S.bodyGeom(b);
    if (pt !== 'bev') {
      const bayLen = pf?.bayLen || (DR.id === 'MR' ? b.wb * .32 : DR.id === 'RR' ? (b.L - g.rx) + 250 : g.fx + 450 + (car.drive === 'FF' ? 0 : 120));
      const engLen = car.drive === 'FF' ? er0.width : er0.length;
      const hoodH = (U.yAt(g.side, g.fx + 250, 'max') || b.H * .55) - b.clr;
      if (engLen > bayLen + 50) warn.push(`엔진(${Math.round(engLen)}mm)이 엔진룸(${Math.round(bayLen)}mm)에 들어가지 않음`);
      if (DR.id === 'FF' && er0.width > b.W * .62) warn.push('횡치 FF에는 엔진 폭이 너무 큼');
      if (er0.height > hoodH + 120 && DR.id !== 'MR') warn.push('엔진 높이가 보닛보다 높음 (후드 스쿠프 필요)');
    }
    if (SR.ffOnly && DR.id !== 'FF') warn.push('토션빔은 FF 전용');
    if (panels.some(p => p.SH.needProc === 'hot') && opt.noHot) warn.push('핫스탬핑 설비(서보 프레스)가 있는 공장이 필요');
    if (pt === 'bev' && !pf?.ev) { A.cargo *= .85; }
    // ── tyres & driveline ──
    const tireD = (car.rim * 25.4 + 2 * car.tireW * car.tireAR / 100) / 1000, rW = tireD / 2;
    const tireGrip = TI.grip * (1 + (car.tireW - 185) / 600) * (1 - (car.tireAR - 65) / 400);
    const eff = GB.eff * DR.eff;
    const rearFrac = U.clamp(DR.rear + (b.bed ? -.05 : 0) + (pt === 'bev' ? .03 : 0), .3, .65);
    const awd = DR.id === 'AWD' || DR.id === '4WD' || (pt === 'bev' && car.ev?.motors > 1);
    const driveFrac = awd ? 1 : DR.id === 'FF' ? 1 - rearFrac : rearFrac;
    const rho = 1.2, gN = 9.81;
    const Crr = .012 * TI.rr * (TI.id === 'bias' ? 1.15 : 1);
    const resist = v => .5 * rho * A.cda * v * v + Crr * test * gN;
    const pk = er.peakHpRpm;
    let vMaxTh = 10; for (let v = 10; v < 140; v += .25) { if (resist(v) * v / eff > er.peakHp / 1.341 * 1000) break; vMaxTh = v; }
    const gearingF = (car.gearing - 50) / 50;
    const nG = GB.g || 6;
    let ratios, topRatio, firstRatio;
    if (pt === 'bev') { const vT = Math.min(vMaxTh, (car.ev?.vmax || 200) / 3.6); topRatio = firstRatio = er.redline * 2 * Math.PI / 60 * rW / vT; ratios = [topRatio]; }
    else {
      topRatio = (pk * (1.02 + gearingF * .12)) / 60 * 2 * Math.PI * rW / vMaxTh;
      firstRatio = topRatio * U.clamp(3.0 + nG * .35 + gearingF * .4, 2.6, 7.5) * (GB.g === 0 ? .9 : 1);
      ratios = GB.g === 0 ? [firstRatio, topRatio * .85] : Array.from({ length: nG }, (_, i) => firstRatio * Math.pow(topRatio * (nG >= 5 ? .82 : .92) / firstRatio, i / (nG - 1)));
    }
    // ── longitudinal sim ──
    let v = 0, t = 0, gi = 0, x = 0, t100 = null, t400 = null, t60mph = null, shiftT = 0, vmax = 0;
    const isCVT = GB.g === 0, launch = pt === 'bev' ? 0 : Math.min(er.peakTqRpm, er.redline * .55);
    const muDrive = tireGrip * (opt.surface || 1) * (feat('esc').id ? 1.02 : 1);
    for (let k = 0; k < 9000; k++) {
      const dt = .02;
      let force = 0;
      if (shiftT > 0) shiftT -= dt;
      else {
        let ratio = isCVT ? U.clamp((pk * 2 * Math.PI / 60 * rW) / Math.max(v, .5), topRatio * .85, firstRatio) : ratios[gi];
        let rpm = v / rW * ratio * 60 / (2 * Math.PI);
        if (!isCVT && rpm > er.redline * .995 && gi < ratios.length - 1) { gi++; shiftT = GB.shift * (GB.auto ? .5 : 1); continue; }
        if (pt === 'bev' && rpm > er.redline) rpm = er.redline + 1;
        const conv = GB.auto && !isCVT && GB.id !== 'dct' && pt !== 'bev' ? (rpm < er.peakTqRpm * .8 ? 1.6 - .6 * rpm / (er.peakTqRpm * .8) : 1) : 1;
        rpm = isCVT ? Math.max(rpm, pk * .95) : Math.max(rpm, gi === 0 ? launch : er.idle);
        force = er.tqAt(Math.min(rpm, er.redline + (pt === 'bev' ? 1 : 0))) * ratio * eff * conv / rW;
      }
      const hl = A.cg / (b.wb / 1000);
      const sgn = awd ? 0 : DR.id === 'FF' ? 1 : -1;
      force = Math.min(force, muDrive * gN * driveFrac / Math.max(.3, 1 + sgn * muDrive * hl) * test);
      const acc = (force - resist(v)) / test;
      v = Math.max(0, v + acc * dt); x += v * dt; t += dt;
      if (v > vmax) vmax = v;
      if (t60mph == null && v >= 26.82) t60mph = t;
      if (t100 == null && v >= 27.78) t100 = t;
      if (t400 == null && x >= 402) t400 = t;
      if (t > 40 && acc < .005) break;
    }
    const topSpeed = vmax * 3.6;
    if (t100 == null) t100 = 99;
    // ── braking & handling ──
    const brakeMu = Math.min(BR.mu * (1 + (feat('abs').brake || 0)), 1) * tireGrip * 1.05 * (pt !== 'ice' ? 1.02 : 1);
    const brake100 = 27.78 * 27.78 / (2 * brakeMu * gN) + .3;
    const stiff = CH.stiff * (opt.weldStiff || 1) * (pf?.stiffBonus || 1);
    const springF = (car.springs - 50) / 50;
    const handSusp = (SF.handling + SR.handling) / 2;
    const cg = A.cg - (pt === 'bev' ? .06 : 0);
    const latG = U.clamp(tireGrip * (.72 + handSusp * .25 + springF * .05 + stiff * .06) * (1 - (cg - .5) * .5) * (1 - Math.abs(rearFrac - .5) * .3), .4, 1.7);
    // ── energy use ──
    const fuelUS = U.table(D.FUEL, year) / 3.785; // $/L
    let lpk, lpkCity, lpkHwy, kwh100 = null, range = null, co2;
    const cityStops = .5 * test * 13.9 * 13.9 * 1.3;
    if (pt === 'bev') {
      const de = er.ev.eff;
      const hwy = resist(27.8) * 1000 / de, city = (cityStops * .45 + Crr * test * gN * 1000 + .5 * rho * A.cda * 100 * 1000) / de;
      kwh100 = (hwy * .45 + city * .55) / 3.6e6 * 100 * 1.1 + (F.ac >= 2 ? .8 : 0);
      range = car.ev.kWh * .93 / kwh100 * 100;
      const elec = U.table(D.ELEC_PRICE, Math.max(2000, year)) * Math.max(.4, D.cpi(year) / D.cpi(2020));
      lpk = lpkCity = lpkHwy = kwh100 * elec / fuelUS; co2 = 0;
      if (range < 150) warn.push(`주행거리 ${Math.round(range)}km — 실사용이 어려움`);
    } else {
      const LHV = er.fuel === 'diesel' ? 42.8 : 43.4, dens = er.fuel === 'diesel' ? .835 : .745;
      const etaPeak = 3600 / (er.bsfc * LHV / 1000) / 1000;
      const topRpm110 = 30.6 / rW * ratios[ratios.length - 1] * 60 / (2 * Math.PI);
      const partLoadHwy = U.clamp(.62 - (topRpm110 / er.redline - .4) * .5 - (er0.dispL - 2) * .03, .3, .85) * (er.boostBar && er.asp !== 'sc' ? 1.04 : 1);
      const hwyE = resist(27.8) * 1000 / (eff * etaPeak * partLoadHwy);
      let cityE = (cityStops + Crr * test * gN * 1000 + .5 * rho * A.cda * 100 * 1000) / (eff * etaPeak * U.clamp(.42 - (er0.dispL - 2) * .04, .2, .6));
      if (pt === 'hev' || pt === 'phev') cityE *= .58;
      const toL = E => E / (LHV * 1e6) / dens * 100;
      lpkHwy = toL(hwyE) * (pt === 'ice' ? 1 : .93); lpkCity = toL(cityE);
      lpk = lpkCity * .55 + lpkHwy * .45 + (F.ac >= 2 ? .25 : 0);
      co2 = lpk * (er.fuel === 'diesel' ? 26.4 : 23.9);
      if (pt === 'phev') { const evKm = car.ev.kWh * .85 / .18; const uf = U.clamp(evKm / 80, 0, .75); range = evKm; const elec = U.table(D.ELEC_PRICE, Math.max(2000, year)); lpk = lpk * (1 - uf) + uf * 18 * elec / fuelUS; co2 *= (1 - uf); }
    }
    const mpg = 235.2 / lpk;
    // ── costs (1946$) ──
    const sizeC = .6 + sizeF * .4;
    const bodyCost = panelKg * pw_(p => p.SH.cost * p.GR.cm * (1 + p.scrap)) * (1 + q * .1) + glassKg * .3 + (b.chrome || 0) * 40;
    const parts = {
      engine: pt === 'bev' ? er.ev.motorCost : (pt === 'ice' ? er.cost : er.cost - er.ev.battCost),
      battery: pt === 'ice' ? 0 : er.ev.battCost,
      gearbox: (pt === 'bev' ? 20 : D.techCost(GB, year)) * (er.peakTq > 300 ? 1.2 : 1), drive: D.techCost(DR, year) + 14 + (pt === 'bev' && car.ev?.motors > 1 ? 30 : 0),
      chassis: D.techCost(CH, year) * sizeF * (pf ? .9 : 1), body: bodyCost,
      susp: (D.techCost(SF, year) + D.techCost(SR, year)) * sizeC, brakes: D.techCost(BR, year), tires: D.techCost(TI, year) * 4 * (car.tireW / 185) * (1 + (car.rim - 14) * .06),
      interior: D.techCost(IN, year) * (b.seats / 5) ** .5, features: Object.keys(C.features).reduce((s, k) => s + D.techCost(feat(k), year), 0) + (pt !== 'ice' ? 25 : 0),
      misc: 110 * sizeC + 40
    };
    const partsCost = U.sum(Object.values(parts)) * (1 + q * .12);
    const laborBody = A.complexity * pw_(p => p.SH.labor);
    const laborAsm = 1 + IN.labor / 40 + (Object.values(F).reduce((s, v) => s + (v ? 1 : 0), 0)) * .03 + (awd ? .15 : 0);
    const toolFull = 260000 * A.complexity * pw_(p => p.SH.tool) * (1 + q * .2) * sizeC;
    const tooling = pf ? toolFull * .6 : toolFull;          // top-hat only when the underbody is shared
    const devMonths = Math.round((10 + A.complexity * 5 + q * 3 + (CH.id === 'carbon' ? 6 : 0)) * (pf && pf.status === 'ready' ? .7 : 1));
    const devCost = (220000 + 180000 * A.complexity * (1 + Math.max(0, q) * .5)) * (pf && pf.status === 'ready' ? .55 : 1);
    // ── ratings ──
    const exA = U.table(D.EXPECT.accel, year), exE = U.table(D.EXPECT.economy, year), exS = U.table(D.EXPECT.safety, year), exC = U.table(D.EXPECT.comfort, year);
    const pwr = er.peakHp / curb * 1000;
    const r = {};
    r.performance = U.clamp(50 + (exA / t100 - 1) * 70 + (topSpeed - 100 - (year - 1946) * 1.2) * .12, 0, 100);
    const tqFlat = er.curve.filter(c => c.tq > er.peakTq * .85).length / er.curve.length;
    r.drivability = U.clamp(30 + tqFlat * 30 + (GB.auto ? 10 : 0) + (feat('steer').drv || 0) * 100 + (feat('esc').drv || 0) * 80 + A.visibility * 12 - (er.spool > er.redline * .45 ? 10 : 0) - Math.max(0, curb - 1600) * .01 + q * 5 + (U.clamp(latG - .7, 0, .4)) * 30 + (pt === 'bev' ? 6 : 0), 0, 100);
    r.sportiness = U.clamp(pwr * .25 + (latG - .7) * 90 + GB.sport * 15 + (['MR', 'RR'].includes(DR.id) ? 8 : DR.id === 'FR' ? 4 : 0) - (b.H - 1300) * .02 + (b.seats <= 2 ? 6 : 0), 0, 100);
    const nvh = er.smooth * 30 + GB.comfort * 10;
    const comfortRaw = (SF.comfort + SR.comfort) * 18 * (1 - springF * .15) + IN.comfort * 30 + nvh + TI.comfort * 10 + (car.tireAR - 50) * .15 + (b.wb - 2400) * .006 + (feat('ac').comfort || 0) * 100 + (feat('radio').comfort || 0) * 100 + (feat('steer').comfort || 0) * 100 + (feat('adas').comfort || 0) * 100 + CH.comfort * 8 - 45;
    r.comfort = U.clamp(50 + (comfortRaw - exC) * 1.1, 0, 100);
    r.practicality = U.clamp(A.cabinVol * 9 + b.seats * 4 + A.cargo * 35 + (b.doors >= 4 ? 8 : 0) + (b.hatch ? 6 : 0) - (pt === 'bev' && range != null ? Math.max(0, 350 - range) * .05 : 0), 0, 100);
    r.utility = U.clamp(CH.utility * 25 + (SR.utility || .5) * 15 + (DR.utility || 0) * 80 + (b.bed ? 25 : 0) + Math.min(30, er.peakTq / 15) + (b.clr - 150) * .1 + (TI.utility || 0) * 60 + (b.seats >= 7 ? 8 : 0) - (pt === 'bev' ? 6 : 0), 0, 100);
    const crashRaw = CH.safety * 50 * (pw_(p => p.SH.crash) * .6 + .4) + U.sum(['belts', 'airbag', 'abs', 'esc', 'adas', 'crumple'].map(k => (feat(k).safety || 0) * 100)) + Math.min(15, curb / 120) - (b.seats <= 2 ? 4 : 0);
    r.safety = U.clamp(50 + (crashRaw - exS) * .9 + q * 4, 0, 100);
    r.economy = U.clamp(50 + (exE / lpk - 1) * 90, 0, 100);
    const partsRel = (D.techRel(SF, year) + D.techRel(SR, year) + (GB.intro ? D.techRel(GB, year) : 0) + D.techRel(CH, year) + (SF.rel || 0) + (GB.rel || 0)) * .4 + Object.keys(F).reduce((s, k) => s + (feat(k).rel || 0), 0);
    r.reliability = U.clamp(er.rel * .55 + 35 + partsRel + q * 8 - (awd ? 3 : 0) - (pt === 'hev' || pt === 'phev' ? 3 : 0), 0, 100);
    r.prestige = U.clamp(IN.prestige * 45 + Math.min(20, (pt === 'bev' ? 8 : er.n) * 1.6) + Math.min(15, er.peakHp / 25) + (panels.some(p => p.SH.id === 'alu' || p.SH.id === 'cfrp') ? 8 : 0) + (b.chrome || 0) * (year < 1970 ? 10 : 2) + (b.L - 4500) * .006 + (feat('adas').prestige || 0) * 100 + (feat('radio').prestige || 0) * 100 + pw_(p => p.GR.fin) * 6 + q * 6 - 10 + (pt === 'bev' && year < 2022 ? 6 : 0), 0, 100);
    // crash-test stars (absolute, not era-normalised)
    const stars = U.clamp(Math.round((crashRaw - 20) / 18), 0, 5);
    return {
      mass: curb, A, ratios, topRatio, tireD, t100, t60mph, t400, topSpeed, brake100, latG, lpk, lpkCity, lpkHwy, mpg, pw: pwr, kwh100, range, co2, stars, crashRaw,
      parts, partsCost, laborBody, laborAsm, tooling, toolFull, devMonths, devCost, r, warn, rearFrac, panels, pt,
      corr: pw_(p => p.SH.corr + p.GR.corr), finish: pw_(p => p.GR.fin), sheet: SH, grade: GR, chassis: CH, er
    };
  };
})(window.MW);
