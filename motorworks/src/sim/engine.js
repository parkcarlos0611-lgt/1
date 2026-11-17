// Engine simulation: geometry → breathing (VE curve) → torque/power curve,
// friction, knock, fuel use, emissions, balance, mass, cost, reliability.
(function (MW) {
  const U = MW.U, D = MW.data, E = D.E;
  const S = MW.sim;

  S.defaultEngine = (year) => ({
    id: U.uid('eng'), name: '신형 엔진', year,
    fuel: 'gas', layout: 'I', cyl: year < 1960 ? 6 : 4, vAngle: 60, bore: year < 1960 ? 84 : 80, stroke: year < 1960 ? 90 : 88,
    blockMat: 'iron', headMat: year >= 1965 ? 'alu' : 'iron',
    head: year >= 1985 ? 'dohc' : year >= 1965 ? 'sohc' : year >= 1950 ? 'ohv' : 'flat', valves: year >= 1990 ? 4 : 2,
    crank: 'cast', rods: 'cast', pistons: 'cast',
    cam: 45, compression: year >= 1990 ? 10 : year >= 1960 ? 8.5 : 6.8, redline: 0,
    fuelSys: year >= 1992 ? 'mpfi' : year >= 1950 ? 'carb2' : 'carb1', mixture: 50,
    asp: 'na', boost: 0, intercooler: false,
    vvt: 'none', ignition: year >= 1980 ? 'elec' : 'points', exhaust: 'log', cat: year >= 1985 ? '3way' : 'none',
    balanceShaft: false, quality: 0, ...(year >= 1975 ? {} : {})
  });

  const cyl = (e) => { const L = D.byId(E.layouts, e.layout); return L.cyls.includes(e.cyl) ? e.cyl : L.cyls[0]; };
  S.engineBanks = e => e.layout === 'I' ? 1 : e.layout === 'W' ? 4 : 2;

  // validate & clamp design to era. returns array of issue strings
  S.fixEngine = (e, y) => {
    const iss = [];
    const pick = (list, key) => { const o = D.byId(list, e[key]); if (!D.avail(o, y)) { const alt = D.list(list, y)[0]; iss.push(`${o.name} — ${y}년에는 사용할 수 없음`); e[key] = alt.id; } };
    pick(E.layouts, 'layout'); pick(E.blockMat, 'blockMat'); pick(E.headMat, 'headMat'); pick(E.heads, 'head');
    pick(E.fuelSys, 'fuelSys'); pick(E.asp, 'asp'); pick(E.vvt, 'vvt'); pick(E.ignition, 'ignition');
    pick(E.crank, 'crank'); pick(E.rods, 'rods'); pick(E.pistons, 'pistons'); pick(E.exhaust, 'exhaust'); pick(E.cat, 'cat');
    e.cyl = cyl(e);
    const H = D.byId(E.heads, e.head); if (!H.valves.includes(+e.valves)) e.valves = H.valves[0];
    const V = D.byId(E.valves, +e.valves); if (!D.avail(V, y)) e.valves = 2;
    const F = D.byId(E.fuelSys, e.fuelSys); if (F.fuel !== e.fuel) { e.fuelSys = D.list(E.fuelSys, y).filter(f => f.fuel === e.fuel)[0]?.id || 'carb1'; if (e.fuel === 'diesel' && D.byId(E.fuelSys, e.fuelSys).fuel !== 'diesel') e.fuel = 'gas'; }
    const VV = D.byId(E.vvt, e.vvt); if (VV.needOHC && (e.head === 'flat' || e.head === 'ohv')) { e.vvt = 'none'; iss.push('가변 밸브 타이밍은 OHC 헤드가 필요'); }
    const C = D.byId(E.cat, e.cat); const efi = ['tbi', 'mpfi', 'gdi', 'crdi'].includes(e.fuelSys);
    if (C.needEFI && !efi) iss.push('3원 촉매는 전자식 분사 없이 공연비 제어가 어려워 효율이 떨어짐');
    if (e.head === 'flat' && e.fuel === 'diesel') { e.head = 'ohv'; iss.push('디젤은 사이드밸브 불가'); }
    if (e.asp === 'na') e.boost = 0; else if (!e.boost) e.boost = 6;
    e.bore = U.clamp(+e.bore, 50, 140); e.stroke = U.clamp(+e.stroke, 45, 140);
    e.compression = U.clamp(+e.compression, e.fuel === 'diesel' ? 14 : 5.5, e.fuel === 'diesel' ? 24 : 14.5);
    if (e.layout === 'W' && e.cyl < 8) e.cyl = 12;
    return iss;
  };

  // full evaluation
  S.evalEngine = (e, y) => {
    const n = cyl(e), banks = S.engineBanks(e);
    const H = D.byId(E.heads, e.head), V = D.byId(E.valves, +e.valves), F = D.byId(E.fuelSys, e.fuelSys);
    const A = D.byId(E.asp, e.asp), VV = D.byId(E.vvt, e.vvt), IG = D.byId(E.ignition, e.ignition);
    const CR = D.byId(E.crank, e.crank), RO = D.byId(E.rods, e.rods), PI = D.byId(E.pistons, e.pistons);
    const EX = D.byId(E.exhaust, e.exhaust), CT = D.byId(E.cat, e.cat), BM = D.byId(E.blockMat, e.blockMat), HM = D.byId(E.headMat, e.headMat);
    const diesel = e.fuel === 'diesel';
    const bore = e.bore / 1000, stroke = e.stroke / 1000;
    const dispL = Math.PI / 4 * bore * bore * stroke * n * 1000; // litres
    const cc = dispL * 1000;
    const warnings = [];
    const q = (e.quality || 0) / 5; // -1..+1 engineering quality

    // ── RPM limits ──
    const pistonSpeedLim = (diesel ? 14 : 19) + (PI.id === 'forged' ? 2.5 : PI.id === 'hyper' ? 1 : 0) + (RO.id === 'ti' ? 2.5 : RO.id === 'forged' ? 1.2 : 0) + q;
    const rpmPiston = pistonSpeedLim * 30 / stroke;
    const rpmValve = H.rpm + V.rpm + IG.rpm + (VV.id !== 'none' ? 300 : 0) - (diesel ? 1800 : 0) - (bore > .095 ? (bore - .095) * 30000 : 0);
    const rpmBottom = 5200 + CR.rpm + RO.rpm + PI.rpm - Math.max(0, (stroke - .08) * 20000);
    const rpmMax = Math.max(2400, Math.min(rpmPiston, rpmValve, rpmBottom + 2000));
    const redline = Math.round((e.redline > 0 ? Math.min(e.redline, rpmMax + 600) : rpmMax * .95) / 100) * 100;
    const idle = Math.round((diesel ? 750 : 650) + e.cam * 6 + (n <= 2 ? 150 : 0));

    // ── breathing ──
    const veBase = H.ve + V.ve + EX.ve + CT.ve + (F.ve - 1) * .5;
    // cam: 0 = mild (torque low), 100 = wild (peak high). peak VE position as fraction of redline
    const camF = e.cam / 100;
    const peakFrac = .5 + camF * .38 + V.ve * .8;
    const vWidth = .46 - camF * .18 + VV.width + (diesel ? .05 : 0);
    const veAt = (rpm) => {
      const x = rpm / redline - peakFrac;
      let ve = veBase * (1 + camF * .06) * Math.exp(-(x * x) / (2 * vWidth * vWidth));
      ve = Math.max(ve, veBase * (.55 + VV.low)) ; // low-end floor
      if (rpm < redline * .3) ve *= .9 + (VV.low * 1.2);
      if (x > 0) ve *= 1 - Math.max(0, x) * .25;
      return ve;
    };
    // flow capacity: carburettor/manifold choke
    const capRating = F.cap * (F.perCyl ? Math.max(1, n / 2) : banks > 1 && F.id.startsWith('carb') ? 1.4 : 1) * (1 + (V.id - 2) * .12);
    // turbo boost curve
    const boostBar = (e.asp === 'na' ? 0 : e.boost * 0.0689);
    const spool = A.lag ? redline * (.28 + A.lag * .22) * Math.pow(Math.max(.4, 1.2 - dispL / 6), .3) : 0;
    const boostAt = rpm => {
      if (e.asp === 'na') return 0;
      if (e.asp === 'sc') return boostBar * U.clamp(.35 + .65 * rpm / redline, 0, 1);
      return boostBar * U.smooth((rpm - spool * .45) / (spool * .9));
    };

    // ── knock ──
    const octane = U.table(D.OCTANE, y);
    const ic = e.intercooler && e.asp !== 'na';
    const knockCR = diesel ? 99 : 7.2 + (octane - 80) * .19 + H.knock + HM.knock + (F.knock || 0) + PI.heat * .5 + (V.id >= 4 ? .4 : 0) + q * .4;
    const effCR = e.compression * Math.pow(1 + boostAt(redline * .7) * (ic ? .55 : .85), .55);
    const knockOver = Math.max(0, effCR - knockCR);
    if (knockOver > 0.05) warnings.push(`노킹 위험: 유효압축비 ${effCR.toFixed(1)} > 한계 ${knockCR.toFixed(1)} (옥탄가 ${octane.toFixed(0)}) — 점화시기 지각으로 출력 손실`);
    // thermal efficiency (Otto/Diesel ideal × real factor)
    const otto = 1 - Math.pow(e.compression, -.3);
    const effRel = otto / (1 - Math.pow(10, -.3));
    const knockLoss = 1 - Math.min(.35, knockOver * .09);
    // mixture: 0 = rich (power, cool, dirty) .. 100 = lean (economy, hot, NOx)
    const mixF = (e.mixture - 50) / 50;
    const mixPower = 1 - Math.abs(mixF + .2) * .08 * (1.2 - F.prec);
    const mixEcon = 1 - mixF * .07 * (.4 + F.prec);

    // ── torque curve ──
    const bmepK = diesel ? .95 : 1.42; // MPa at VE=1, CR10
    const curve = [];
    const fric = rpm => (diesel ? .12 : .09) + .00002 * rpm + 1.1e-9 * rpm * rpm * (stroke / .085); // FMEP MPa
    let peakTq = 0, peakTqRpm = 0, peakHp = 0, peakHpRpm = 0;
    for (let rpm = 1000; rpm <= redline + 1; rpm += 250) {
      const b = boostAt(rpm);
      const pr = 1 + b * (ic ? .98 : .88);
      let ve = veAt(rpm);
      const flowNeed = dispL / 1000 * rpm / 120 * ve * pr; // m³/s
      if (flowNeed > capRating) ve *= Math.pow(capRating / flowNeed, .55);
      let bmep = bmepK * ve * pr * effRel * knockLoss * mixPower * (diesel ? 1 : 1);
      if (e.asp === 'sc') bmep -= A.parasitic * b * 1.2;
      const fmep = fric(rpm) * (1 - q * .05);
      const tq = Math.max(0, (bmep - fmep) * 1e6 * dispL / 1000 / (4 * Math.PI)); // Nm
      const kw = tq * rpm * 2 * Math.PI / 60 / 1000;
      const hp = kw * 1.341;
      curve.push({ rpm, tq, kw, hp, boost: b, ve });
      if (tq > peakTq) { peakTq = tq; peakTqRpm = rpm; }
      if (hp > peakHp) { peakHp = hp; peakHpRpm = rpm; }
    }
    const tqAt = rpm => { if (rpm <= curve[0].rpm) return curve[0].tq * (rpm / curve[0].rpm) ** .3; const i = Math.min(curve.length - 2, Math.floor((rpm - 1000) / 250)); const a = curve[i], b = curve[i + 1]; return rpm > redline ? 0 : U.lerp(a.tq, b.tq, (rpm - a.rpm) / 250); };

    // ── fuel: BSFC g/kWh at best point ──
    const bsfc = 255 / Math.pow(effRel, .9) * F.bsfc * mixEcon * (1 + knockOver * .02) * (1 + (V.id >= 4 ? -.02 : 0)) * (VV.id !== 'none' ? .96 : 1) * (1 - q * .02) * (diesel ? .95 : 1);

    // ── emissions index (1946 unregulated engine ≈ 200) ──
    const emisRaw = 200 * H.emis * F.emis * IG.emis * (1 + Math.max(0, -mixF) * .6 + Math.max(0, mixF) * .3) * (diesel ? 1.15 : 1);
    const catEff = CT.needEFI && !['tbi', 'mpfi', 'gdi', 'crdi'].includes(e.fuelSys) ? Math.sqrt(CT.emis) : CT.emis;
    const emissions = emisRaw * catEff * (D.maturity(CT, y) < .5 ? 1.3 : 1);

    // ── smoothness / NVH ──
    let smooth = E.balance(e.layout, n, +e.vAngle);
    if (e.balanceShaft && [3, 4, 5].includes(n) && e.layout === 'I' || e.balanceShaft && e.layout === 'V' && n === 6) smooth = Math.min(.95, smooth + .14);
    smooth -= Math.max(0, dispL / n - .6) * .12; // big pistons shake
    if (diesel) smooth -= .15;
    smooth -= camF * .12;
    smooth = U.clamp(smooth, .05, 1);

    // ── geometry (mm) ──
    const boreSpacing = e.bore * 1.18 + 8;
    const perBank = e.layout === 'I' ? n : Math.ceil(n / (e.layout === 'W' ? 4 : 2)) * (e.layout === 'W' ? 2 : 1);
    const length = Math.round(perBank * boreSpacing + 140 + (e.layout === 'B' ? 40 : 0));
    const deckH = e.stroke * 1.7 + e.bore * .4 + 60;
    const headH = H.id === 'flat' ? 40 : H.id === 'dohc' ? 150 : H.id === 'sohc' ? 120 : 110;
    const ang = (+e.vAngle) * Math.PI / 180;
    let width, height;
    if (e.layout === 'I') { width = 380 + e.bore * .6; height = deckH + headH + 180; }
    else if (e.layout === 'B') { width = 2 * (deckH + headH) * .9 + 120; height = 330 + e.stroke; }
    else { width = 2 * Math.sin(ang / 2) * (deckH + headH) + e.bore * 1.4 + 120; height = Math.cos(ang / 2) * (deckH + headH) + 230; }
    if (e.asp !== 'na') height += e.asp === 'sc' ? 120 : 30;

    // ── mass (kg) ──
    const blockK = BM.dens * (24 + cc * .028) * (banks > 1 ? 1.0 : 1) * (diesel ? 1.35 : 1);
    const headK = HM.dens * H.mass * (6 + cc * .009) * banks * (V.id >= 4 ? 1.1 : 1);
    const rot = (6 + cc * .009) * (CR.mass + RO.mass) / 2;
    const ancillary = 18 + A.mass + (ic ? 7 : 0) + (CT.lvl ? 6 + CT.lvl * 2 : 0) + (e.balanceShaft ? 6 : 0);
    const mass = Math.round(blockK + headK + rot + ancillary);

    // ── cost (1946$) & production hours ──
    const parts = [BM, HM, H, V, F, A, VV, IG, CR, RO, PI, EX, CT];
    const scale = .45 + cc / 2500;
    let cost = 0;
    cost += D.techCost(BM, y) * scale + D.techCost(HM, y) * scale * banks * .6 + D.techCost(H, y) * banks * (.7 + n * .08);
    cost += D.techCost(V, y) * n * .25 + D.techCost(F, y) * (F.perCyl ? n / 2 : 1) + D.techCost(A, y) * (e.asp === 'twin' ? 1 : 1) + D.techCost(VV, y) * banks;
    cost += D.techCost(IG, y) + (D.techCost(CR, y) + D.techCost(RO, y) * n * .25 + D.techCost(PI, y) * n * .25) * scale + D.techCost(EX, y) * banks + D.techCost(CT, y) * banks * .7;
    cost += n * 4 + (ic ? 8 : 0) + (e.balanceShaft ? 5 : 0);
    cost *= 1 + q * .18;
    const hours = (4 + n * .9 + banks * 1.2 + (H.id === 'dohc' ? 1.5 : 0) + (e.asp !== 'na' ? 1 : 0)) * (1 + q * .12);

    // ── reliability 0..100 ──
    const pspd = stroke * redline / 30;
    let rel = 78;
    rel -= Math.max(0, pspd - pistonSpeedLim * .8) * 6;
    rel -= Math.max(0, redline / rpmMax - .9) * 60;
    const tqPerL = peakTq / dispL;
    const bottomTqLim = 170 * Math.min(CR.tq, RO.tq, PI.tq) * (diesel ? 1.6 : 1);
    rel -= Math.max(0, tqPerL - bottomTqLim) * .45;
    rel -= knockOver * 7;
    rel -= boostBar * 8 * (ic ? .7 : 1);
    rel += BM.rel + IG.rel + (q * 10);
    rel -= (n - 6) * .6;
    for (const p of parts) rel += D.techRel(p, y) * .35;
    if (Math.abs(mixF) > .6) rel -= 4;
    rel = U.clamp(rel, 5, 99);

    // ── engineering time / dev cost ──
    const complexity = (n / 4) * .6 + banks * .2 + (H.id === 'dohc' ? .5 : H.id === 'sohc' ? .3 : .1) + (e.asp !== 'na' ? .4 : 0) + (VV.id !== 'none' ? .3 : 0) + (F.id === 'gdi' || F.id === 'crdi' ? .4 : 0) + Math.max(0, q) * .6;
    const devMonths = Math.round(6 + complexity * 4);
    const devCost = (90000 + complexity * 110000) * (1 + Math.max(0, q) * .5); // 1946 $

    const ps = peakHp * 1.0139;
    return {
      dispL, cc, n, banks, perBank, redline, rpmMax, idle, curve, tqAt, peakTq, peakTqRpm, peakHp, peakHpRpm, ps,
      bsfc, emissions, smooth, mass, length, width, height, cost, hours, rel, warnings, knockCR, effCR, octane,
      pistonSpeed: pspd, boostBar, spool, devMonths, devCost, complexity, fuel: e.fuel,
      hpPerL: peakHp / dispL, specific: peakHp / mass
    };
  };
})(window.MW);
