// Vehicle: body shape (side + top profiles), parts, mass build-up, aerodynamics,
// longitudinal simulation (0-100, top speed, gearing), braking, handling,
// fuel economy, cost/labour build-up and era-normalised ratings.
(function (MW) {
  const U = MW.U, D = MW.data, C = D.C, S = MW.sim;

  // ── body archetypes. side: upper outline front-bottom → rear-bottom (x 0..1 of length, y 0..1 of height)
  // glass: greenhouse polygon. top: half-width plan profile front → rear (y = fraction of half width)
  D.BODY_PRESETS = {
    fender40: { name: '1940s 펜더 세단', L: 4900, W: 1880, H: 1600, wb: 3000, clr: 210, foh: .48, doors: 4, seats: 6,
      side: [[0, .26], [.01, .44], [.06, .55], [.12, .66], [.3, .7], [.36, .73], [.44, .98], [.6, 1], [.72, .93], [.82, .72], [.93, .6], [.99, .48], [1, .3]],
      glass: [[.38, .74], [.455, .95], [.6, .965], [.705, .9], [.75, .76]],
      top: [[0, .55], [.04, .85], [.14, .99], [.3, .92], [.45, .9], [.7, .93], [.85, .99], [.97, .85], [1, .6]], fenders: 1, chrome: .8 },
    fin50: { name: '1950s 테일핀 세단', L: 5300, W: 2000, H: 1450, wb: 3050, clr: 170, foh: .4, doors: 4, seats: 6,
      side: [[0, .3], [.005, .52], [.04, .6], [.28, .63], [.36, .65], [.43, .96], [.62, 1], [.7, .95], [.74, .66], [.93, .7], [1, .74], [.998, .3]],
      glass: [[.375, .665], [.44, .93], [.62, .955], [.69, .9], [.715, .68]],
      top: [[0, .8], [.03, .96], [.2, 1], [.8, 1], [.97, .99], [1, .85]], chrome: 1 },
    box70: { name: '1970s~80s 박스 세단', L: 4700, W: 1760, H: 1400, wb: 2700, clr: 160, foh: .42, doors: 4, seats: 5,
      side: [[0, .25], [.003, .55], [.03, .58], [.3, .62], [.36, .64], [.45, .97], [.65, 1], [.75, .97], [.79, .66], [.98, .66], [1, .6], [.998, .26]],
      glass: [[.375, .66], [.455, .945], [.65, .97], [.74, .93], [.77, .68]],
      top: [[0, .9], [.02, .98], [.5, 1], [.98, .98], [1, .9]], chrome: .4 },
    aero90: { name: '1990s~ 에어로 세단', L: 4750, W: 1800, H: 1430, wb: 2750, clr: 150, foh: .45, doors: 4, seats: 5,
      side: [[0, .26], [.006, .42], [.05, .52], [.25, .6], [.33, .64], [.47, .97], [.62, 1], [.76, .9], [.84, .73], [.97, .7], [1, .6], [.995, .26]],
      glass: [[.35, .655], [.47, .945], [.62, .965], [.75, .88], [.81, .74]],
      top: [[0, .62], [.03, .88], [.15, .98], [.5, 1], [.85, .98], [.97, .88], [1, .7]], chrome: .1 },
    hatch: { name: '해치백', L: 4100, W: 1720, H: 1450, wb: 2550, clr: 150, foh: .52, doors: 4, seats: 5, hatch: 1,
      side: [[0, .26], [.006, .44], [.05, .54], [.2, .6], [.29, .64], [.43, .97], [.7, 1], [.84, .96], [.93, .85], [.99, .7], [1, .3]],
      glass: [[.31, .655], [.43, .945], [.7, .965], [.83, .93], [.9, .78]],
      top: [[0, .65], [.04, .9], [.18, .99], [.6, 1], [.92, .97], [1, .85]], chrome: .1 },
    wagon: { name: '왜건 / 에스테이트', L: 4850, W: 1800, H: 1480, wb: 2800, clr: 160, foh: .45, doors: 4, seats: 5, hatch: 1,
      side: [[0, .26], [.006, .44], [.05, .53], [.25, .6], [.32, .63], [.45, .97], [.62, 1], [.94, .99], [.99, .8], [1, .3]],
      glass: [[.34, .65], [.455, .945], [.62, .965], [.93, .955], [.975, .76]],
      top: [[0, .65], [.04, .9], [.18, .99], [.6, 1], [.96, .98], [1, .88]], chrome: .2 },
    sport: { name: '스포츠 쿠페', L: 4400, W: 1840, H: 1250, wb: 2500, clr: 120, foh: .48, doors: 2, seats: 2,
      side: [[0, .26], [.008, .38], [.06, .46], [.32, .55], [.4, .6], [.54, .96], [.64, 1], [.8, .82], [.94, .66], [1, .55], [.996, .3]],
      glass: [[.42, .61], [.545, .93], [.64, .955], [.77, .82], [.66, .68]],
      top: [[0, .55], [.05, .85], [.25, .95], [.4, .9], [.75, 1], [.95, .95], [1, .78]], chrome: .1 },
    mid: { name: '미드십 슈퍼카', L: 4450, W: 1950, H: 1130, wb: 2650, clr: 105, foh: .4, doors: 2, seats: 2,
      side: [[0, .24], [.01, .36], [.12, .44], [.27, .52], [.42, .95], [.52, 1], [.65, .92], [.85, .74], [.98, .66], [1, .3]],
      glass: [[.3, .55], [.425, .92], [.52, .96], [.6, .9], [.52, .6]],
      top: [[0, .52], [.06, .82], [.25, .9], [.45, .86], [.7, 1], [.95, .97], [1, .85]], chrome: 0 },
    pickup: { name: '픽업 트럭', L: 5300, W: 1950, H: 1800, wb: 3300, clr: 230, foh: .38, doors: 2, seats: 3, bed: 1,
      side: [[0, .3], [.003, .58], [.03, .64], [.28, .67], [.32, .69], [.39, .97], [.5, 1], [.53, .96], [.55, .62], [.998, .62], [1, .32]],
      glass: [[.335, .7], [.39, .94], [.5, .965], [.52, .93], [.535, .72]],
      top: [[0, .9], [.03, .98], [.5, 1], [1, 1]], chrome: .5 },
    suv: { name: 'SUV', L: 4750, W: 1900, H: 1750, wb: 2800, clr: 210, foh: .42, doors: 4, seats: 7, hatch: 1,
      side: [[0, .3], [.004, .52], [.05, .6], [.25, .65], [.32, .68], [.43, .97], [.6, 1], [.95, .985], [.995, .8], [1, .32]],
      glass: [[.34, .69], [.43, .945], [.6, .965], [.935, .95], [.97, .72]],
      top: [[0, .75], [.04, .93], [.2, 1], [.97, .98], [1, .9]], chrome: .2 },
    van: { name: '미니밴 / MPV', L: 4900, W: 1880, H: 1750, wb: 2950, clr: 160, foh: .45, doors: 4, seats: 8, hatch: 1,
      side: [[0, .28], [.006, .48], [.07, .58], [.17, .64], [.33, .97], [.5, 1], [.96, .985], [.995, .8], [1, .3]],
      glass: [[.2, .66], [.33, .945], [.5, .965], [.945, .95], [.975, .72]],
      top: [[0, .7], [.05, .92], [.2, 1], [.97, .98], [1, .9]], chrome: .1 }
  };
  const toPts = a => a.map(([x, y]) => ({ x, y }));
  S.bodyFromPreset = (id) => {
    const p = D.BODY_PRESETS[id];
    return { preset: id, L: p.L, W: p.W, H: p.H, wb: p.wb, clr: p.clr, foh: p.foh, doors: p.doors, seats: p.seats,
      side: toPts(p.side), glass: toPts(p.glass), top: toPts(p.top), chrome: p.chrome ?? .2, fenders: p.fenders || 0, bed: p.bed || 0, hatch: p.hatch || 0,
      sheet: 'mild', grade: 'B', paint: '#7a2a2a', paint2: null, charLine: .55, rawSheet: false, customTex: null };
  };

  S.defaultCar = (year, engineId) => {
    const preset = year < 1950 ? 'fender40' : year < 1962 ? 'fin50' : year < 1988 ? 'box70' : 'aero90';
    const body = S.bodyFromPreset(preset);
    if (year >= 1990) body.sheet = 'hsla'; else if (year >= 1980) body.sheet = 'galv';
    return {
      id: U.uid('car'), name: '신형 모델', year, engineId, body,
      chassis: year >= 1960 ? 'unibody' : 'ladder', suspF: year >= 1975 ? 'mac' : 'kingpin', suspR: year >= 1975 ? 'coil' : 'leaf',
      springs: 50, brakes: year >= 1975 ? 'disc' : 'drum', tires: year >= 1972 ? 'radial' : 'bias', tireW: 185, tireAR: year >= 1975 ? 70 : 85, rim: year >= 1985 ? 15 : 14,
      gearbox: year >= 1985 ? 'm5' : year >= 1965 ? 'm4' : 'm3', gearing: 50, drive: year >= 1980 ? 'FF' : 'FR',
      interior: 'std', features: { radio: 1, ac: 1, steer: 0, belts: year >= 1970 ? 2 : 0, airbag: year >= 1995 ? 1 : 0, abs: 0, esc: 0, adas: 0, crumple: year >= 1965 ? 1 : 0 },
      quality: 0
    };
  };

  // geometry helpers in real mm
  S.bodyGeom = (b) => {
    const side = U.spline(b.side.map(p => ({ x: p.x * b.L, y: p.y * b.H })), 10, false);
    const glass = U.spline(b.glass.map(p => ({ x: p.x * b.L, y: p.y * b.H })), 8, true);
    const top = U.spline(b.top.map(p => ({ x: p.x * b.L, y: p.y * b.W / 2 })), 10, false);
    const fohMM = (b.L - b.wb) * b.foh;
    const fx = fohMM, rx = fohMM + b.wb;
    return { side, glass, top, fx, rx };
  };

  // aero & packaging analysis of the profile
  S.analyseBody = (b, year) => {
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
    cd += (b.fenders ? .07 : 0) + b.chrome * .02 + (b.bed ? .06 : 0);
    cd += U.clamp((turn - 4.6) / 8, 0, .05);                    // fussy surfaces
    cd += year < 1975 ? .04 : year < 1990 ? .02 : 0;            // gaps, gutters, non-flush glass
    cd += b.clr > 190 ? .04 : 0;
    cd = U.clamp(cd, .2, .75);
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
    const complexity = U.clamp(.6 + (turn - 3) * .12 + topTurn * .15 + b.chrome * .25 + (b.fenders ? .3 : 0), .5, 2.2);
    const visibility = U.clamp(glassArea / (L * H / 1e6) * 6, 0, 1);
    const cg = (b.clr + (H - b.clr) * .38) / 1000;
    return { cd, frontal, cda: cd * frontal, wsAngle, rearAngle, cabinVol, cargo, skin, complexity, visibility, glassArea, cg, cabinLen };
  };

  // car evaluation
  S.evalCar = (car, eng, er, year, opt = {}) => {
    const b = car.body, A = S.analyseBody(b, year);
    const CH = D.byId(C.chassis, car.chassis), SH = D.byId(C.sheet, b.sheet), GR = SH.grades.find(g => g.id === b.grade) || SH.grades[1];
    const SF = D.byId(C.suspF, car.suspF), SR = D.byId(C.suspR, car.suspR), BR = D.byId(C.brakes, car.brakes), TI = D.byId(C.tires, car.tires);
    const GB = D.byId(C.gearbox, car.gearbox), DR = D.byId(C.drive, car.drive), IN = D.byId(C.interior, car.interior);
    const F = car.features, feat = k => D.byId(C.features[k], F[k] || 0);
    const q = (car.quality || 0) / 5;
    const warn = [];
    // ── mass build-up (kg) ──
    const sizeF = (b.L * b.W) / (4.7e6 * 1.78); // vs. a midsize car
    const chassisKg = 300 * CH.mass * sizeF * (b.bed ? 1.15 : 1);
    const panelKg = A.skin * GR.t / 1000 * SH.dens * 1000 * 1.25; // 25% overlap, flanges, reinforcements
    const glassKg = A.glassArea * 2 * 12 + 18;
    const suspKg = SF.mass + SR.mass, brakeKg = BR.mass;
    const wheelKg = 4 * (8 + car.tireW * .03 + car.rim * .5);
    const featKg = Object.keys(C.features).reduce((s, k) => s + (feat(k).mass || feat(k).cost * .15 || 0), 0);
    const intKg = IN.mass * (b.seats / 5) ** .5;
    const fuelKg = 45;
    const misc = 60 * sizeF + 25; // wiring, bumpers, lights, exhaust
    const chromeKg = b.chrome * 40;
    const driveKg = GB.mass + (DR.id === '4WD' || DR.id === 'AWD' ? 70 : 25);
    const mass = Math.round(chassisKg + panelKg + glassKg + suspKg + brakeKg + wheelKg + featKg + intKg + fuelKg + misc + chromeKg + driveKg + er.mass);
    const curb = mass, test = mass + 150;

    // engine bay fit (engine must fit in front/rear overhang+bay)
    const g = S.bodyGeom(b);
    const bayLen = DR.id === 'MR' ? b.wb * .32 : DR.id === 'RR' ? (b.L - g.rx) + 250 : g.fx + 450 + (car.drive === 'FF' ? 0 : 120);
    const engLen = car.drive === 'FF' ? er.width : er.length; // transverse FF uses width
    const hoodH = (b.side[2]?.y || .5) * b.H - b.clr;
    if (engLen > bayLen + 50) warn.push(`엔진(${Math.round(engLen)}mm)이 엔진룸(${Math.round(bayLen)}mm)에 들어가지 않음`);
    if (DR.id === 'FF' && er.width > b.W * .62) warn.push('횡치 FF에는 엔진 폭이 너무 큼');
    if (er.height > hoodH + 120 && DR.id !== 'MR') warn.push('엔진 높이가 보닛보다 높음 (후드 스쿠프 필요)');
    if (SR.ffOnly && DR.id !== 'FF') warn.push('토션빔은 FF 전용');
    if (SH.needProc === 'hot' && opt.noHot) warn.push('핫스탬핑 설비가 있는 공장이 필요');

    // ── wheels/tyres ──
    const tireD = (car.rim * 25.4 + 2 * car.tireW * car.tireAR / 100) / 1000; // m
    const rW = tireD / 2;
    const tireGrip = TI.grip * (1 + (car.tireW - 185) / 600) * (1 - (car.tireAR - 65) / 400);
    // ── gearing ──
    const eff = GB.eff * DR.eff;
    const rearFrac = U.clamp(DR.rear + (b.bed ? -.05 : 0), .3, .65);
    const driveFrac = DR.id === 'FF' ? 1 - rearFrac : (DR.id === 'AWD' || DR.id === '4WD') ? 1 : rearFrac;
    const rho = 1.2, gN = 9.81;
    const Crr = .012 * TI.rr * (TI.id === 'bias' ? 1.15 : 1);
    const resist = v => .5 * rho * A.cda * v * v + Crr * test * gN;
    const pk = er.peakHpRpm;
    // theoretical top speed from peak power
    let vMaxTh = 10; for (let v = 10; v < 140; v += .25) { if (resist(v) * v / eff > er.peakHp / 1.341 * 1000) break; vMaxTh = v; }
    const gearingF = (car.gearing - 50) / 50; // -1 tall (economy) .. +1 short (sport)
    const nG = GB.g || 6;
    const topRatio = (pk * (1.02 + gearingF * .12)) / 60 * 2 * Math.PI * rW / vMaxTh; // overall ratio at top speed hits ~ peak power rpm
    const firstRatio = topRatio * U.clamp(3.0 + nG * .35 + gearingF * .4, 2.6, 7.5) * (GB.g === 0 ? .9 : 1);
    const ratios = GB.g === 0 ? [firstRatio, topRatio * .85] : Array.from({ length: nG }, (_, i) => firstRatio * Math.pow(topRatio * (nG >= 5 ? .82 : .92) / firstRatio, i / (nG - 1)));
    // ── longitudinal sim ──
    let v = 0, t = 0, gi = 0, x = 0, t100 = null, t400 = null, t60mph = null, shiftT = 0, vmax = 0;
    const isCVT = GB.g === 0, launch = Math.min(er.peakTqRpm, er.redline * .55);
    const muDrive = tireGrip * (opt.surface || 1);
    for (let k = 0; k < 9000; k++) {
      const dt = .02;
      let force = 0;
      if (shiftT > 0) { shiftT -= dt; }
      else {
        let ratio = isCVT ? U.clamp((pk * 2 * Math.PI / 60 * rW) / Math.max(v, .5), topRatio * .85, firstRatio) : ratios[gi];
        let rpm = v / rW * ratio * 60 / (2 * Math.PI);
        if (!isCVT && rpm > er.redline * .995 && gi < ratios.length - 1) { gi++; shiftT = GB.shift * (GB.auto ? .5 : 1); continue; }
        const conv = GB.auto && !isCVT && GB.id !== 'dct' ? (rpm < er.peakTqRpm * .8 ? 1.6 - .6 * rpm / (er.peakTqRpm * .8) : 1) : 1; // torque converter multiplication
        rpm = isCVT ? Math.max(rpm, pk * .95) : Math.max(rpm, gi === 0 ? launch : er.idle);
        const tq = er.tqAt(Math.min(rpm, er.redline));
        force = tq * ratio * eff * conv / rW;
      }
      const a0 = force / test;
      const wt = test * gN * (driveFrac + (DR.id === 'FF' ? -1 : DR.id === 'AWD' || DR.id === '4WD' ? 0 : 1) * a0 / gN * A.cg / (b.wb / 1000) * (DR.id === 'AWD' || DR.id === '4WD' ? 0 : 1));
      force = Math.min(force, muDrive * Math.max(wt, test * gN * .2));
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
    // ── braking ──
    const brakeMu = Math.min(BR.mu * (1 + (feat('abs').brake || 0)), 1) * tireGrip * 1.05;
    const brake100 = 27.78 * 27.78 / (2 * brakeMu * gN) + .3;
    // ── handling ──
    const stiff = CH.stiff * (1 + (opt.weldStiff || 1) - 1);
    const springF = (car.springs - 50) / 50; // -1 soft .. +1 stiff
    const handSusp = (SF.handling + SR.handling) / 2;
    const latG = U.clamp(tireGrip * (.72 + handSusp * .25 + springF * .05 + stiff * .06) * (1 - (A.cg - .5) * .5) * (1 - Math.abs(rearFrac - .5) * .3), .4, 1.7);
    // ── fuel economy (L/100km) ──
    const LHV = er.fuel === 'diesel' ? 42.8 : 43.4, dens = er.fuel === 'diesel' ? .835 : .745; // MJ/kg, kg/L
    const etaPeak = 3600 / (er.bsfc * LHV / 1000) / 1000;
    const topRpm110 = 30.6 / rW * ratios[ratios.length - 1] * 60 / (2 * Math.PI);
    const partLoadHwy = U.clamp(.62 - (topRpm110 / er.redline - .4) * .5 - (er.dispL - 2) * .03, .3, .85) * (er.boostBar && !['sc'].includes(er.asp) ? 1.04 : 1);
    const hwyE = resist(27.8) * 1000 / (eff * etaPeak * partLoadHwy); // J per km (110km/h → 27.8 m/s rounding)
    const cityE = (.5 * test * 13.9 * 13.9 * 1.3 + Crr * test * gN * 1000 + .5 * rho * A.cda * 100 * 1000) / (eff * etaPeak * U.clamp(.42 - (er.dispL - 2) * .04, .2, .6));
    const toL = E => E / (LHV * 1e6) / dens * 100;
    const lpkHwy = toL(hwyE), lpkCity = toL(cityE);
    const lpk = lpkCity * .55 + lpkHwy * .45 + (F.ac >= 2 ? .25 : 0);
    const mpg = 235.2 / lpk;

    // ── costs (1946$) ──
    const sizeC = .6 + sizeF * .4;
    const parts = {
      engine: er.cost, gearbox: D.techCost(GB, year) * (er.peakTq > 300 ? 1.2 : 1), drive: D.techCost(DR, year) + 14,
      chassis: D.techCost(CH, year) * sizeF, body: panelKg * SH.cost * GR.cm * (1 + q * .1) + glassKg * .3 + b.chrome * 40,
      susp: (D.techCost(SF, year) + D.techCost(SR, year)) * sizeC, brakes: D.techCost(BR, year), tires: D.techCost(TI, year) * 4 * (car.tireW / 185) * (1 + (car.rim - 14) * .06),
      interior: D.techCost(IN, year) * (b.seats / 5) ** .5, features: Object.keys(C.features).reduce((s, k) => s + D.techCost(feat(k), year), 0),
      misc: 110 * sizeC + 40
    };
    let partsCost = U.sum(Object.values(parts)) * (1 + q * .12);
    // design labour hours (before factory process multipliers): body panels hours scale with complexity & material
    const laborBody = A.complexity * SH.labor * (b.fenders ? 1.3 : 1);
    const laborAsm = 1 + IN.labor / 40 + (Object.values(F).reduce((s, v) => s + (v ? 1 : 0), 0)) * .03 + (DR.id === 'AWD' ? .15 : 0);
    const tooling = 260000 * A.complexity * SH.tool * (b.fenders ? 1.2 : 1) * (1 + q * .2) * sizeC; // dies, jigs, fixtures (1946$)
    const devMonths = Math.round(10 + A.complexity * 5 + q * 3 + (CH.id === 'carbon' ? 6 : 0));
    const devCost = 220000 + 180000 * A.complexity * (1 + Math.max(0, q) * .5);

    // ── ratings (0..100, era-normalised) ──
    const exA = U.table(D.EXPECT.accel, year), exE = U.table(D.EXPECT.economy, year), exS = U.table(D.EXPECT.safety, year), exC = U.table(D.EXPECT.comfort, year);
    const pw = er.peakHp / curb * 1000; // hp/tonne
    const r = {};
    r.performance = U.clamp(50 + (exA / t100 - 1) * 70 + (topSpeed - 100 - (year - 1946) * 1.2) * .12, 0, 100);
    const tqFlat = er.curve.filter(c => c.tq > er.peakTq * .85).length / er.curve.length;
    r.drivability = U.clamp(30 + tqFlat * 30 + (GB.auto ? 10 : 0) + (feat('steer').drv || 0) * 100 + (feat('esc').drv || 0) * 80 + A.visibility * 12 - (er.spool > er.redline * .45 ? 10 : 0) - Math.max(0, curb - 1600) * .01 + q * 5 + (U.clamp(latG - .7, 0, .4)) * 30, 0, 100);
    r.sportiness = U.clamp(pw * .25 + (latG - .7) * 90 + GB.sport * 15 + (['MR', 'RR'].includes(DR.id) ? 8 : DR.id === 'FR' ? 4 : 0) - (b.H - 1300) * .02 + (b.seats <= 2 ? 6 : 0), 0, 100);
    const nvh = er.smooth * 30 + (GB.comfort) * 10;
    const comfortRaw = (SF.comfort + SR.comfort) * 18 * (1 - springF * .15) + IN.comfort * 30 + nvh + TI.comfort * 10 + (car.tireAR - 50) * .15 + (b.wb - 2400) * .006 + (feat('ac').comfort || 0) * 100 + (feat('radio').comfort || 0) * 100 + (feat('steer').comfort || 0) * 100 + (feat('adas').comfort || 0) * 100 + CH.comfort * 8 - 45;
    r.comfort = U.clamp(50 + (comfortRaw - exC) * 1.1, 0, 100);
    r.practicality = U.clamp(A.cabinVol * 9 + b.seats * 4 + A.cargo * 35 + (b.doors >= 4 ? 8 : 0) + (b.hatch ? 6 : 0), 0, 100);
    r.utility = U.clamp(CH.utility * 25 + (SR.utility || .5) * 15 + (DR.utility || 0) * 80 + (b.bed ? 25 : 0) + Math.min(30, er.peakTq / 15) + (b.clr - 150) * .1 + (TI.utility || 0) * 60 + (b.seats >= 7 ? 8 : 0), 0, 100);
    const crash = CH.safety * 50 * (SH.crash * .6 + .4) + U.sum(['belts', 'airbag', 'abs', 'esc', 'adas', 'crumple'].map(k => (feat(k).safety || 0) * 100)) + Math.min(15, curb / 120) - (b.seats <= 2 ? 4 : 0);
    r.safety = U.clamp(50 + (crash - exS) * .9 + q * 4, 0, 100);
    r.economy = U.clamp(50 + (exE / lpk - 1) * 90, 0, 100);
    const partsRel = (D.techRel(SF, year) + D.techRel(SR, year) + D.techRel(GB, year) + D.techRel(CH, year) + (SF.rel || 0) + (GB.rel || 0)) * .4 + Object.keys(F).reduce((s, k) => s + (feat(k).rel || 0), 0);
    r.reliability = U.clamp(er.rel * .55 + 35 + partsRel + q * 8 - (DR.id === 'AWD' ? 3 : 0), 0, 100);
    r.prestige = U.clamp(IN.prestige * 45 + Math.min(20, er.n * 1.6) + Math.min(15, er.peakHp / 25) + (SH.id === 'alu' || SH.id === 'cfrp' ? 8 : 0) + b.chrome * (year < 1970 ? 10 : 2) + (b.L - 4500) * .006 + (feat('adas').prestige || 0) * 100 + (feat('radio').prestige || 0) * 100 + GR.fin * 6 + q * 6 - 10, 0, 100);
    return {
      mass: curb, A, ratios, topRatio, tireD, t100, t60mph, t400, topSpeed, brake100, latG, lpk, lpkCity, lpkHwy, mpg, pw,
      parts, partsCost, laborBody, laborAsm, tooling, devMonths, devCost, r, warn, rearFrac, corr: SH.corr + GR.corr, finish: GR.fin,
      sheet: SH, grade: GR, chassis: CH
    };
  };
})(window.MW);
