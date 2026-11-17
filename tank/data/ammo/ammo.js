// Ammunition data. Penetration figures from the user's reference sheet (docs/DATA_SOURCES.md).
// cd: drag coefficient vs Mach [[M, Cd], ...] referenced to the area of diameter d.
// pen.ke: RHA mm at pen.at metres; KE penetration scales with impact velocity
//   P(v) = P_ref · exp(−s·(1/v² − 1/v_ref²))   (Lanz–Odermatt velocity term; v_ref solved at load)
// pen.ce: shaped-charge jet RHA mm, independent of range.
window.DS = window.DS || {};
DS.AMMO = {
  M829A1: {
    name: 'M829A1 APFSDS-T', short: 'M829A1', type: 'APFSDS', v0: 1575, mass: 4.6, d: 0.027,
    cd: [[0, 0.35], [1, 0.60], [2, 0.58], [3, 0.55], [5, 0.52]],
    launchMass: 9.0, sabot: true, tracer: '#ffcc66',
    pen: { ke: 590, at: 2000, s: 1.36e6 },            // 570–610 mm @ 2 km
    crit: 76,                                         // ricochet critical obliquity (deg)
  },
  M829: {
    name: 'M829 APFSDS-T', short: 'M829', type: 'APFSDS', v0: 1670, mass: 3.9, d: 0.027,
    cd: [[0, 0.35], [1, 0.60], [2, 0.58], [3, 0.55], [5, 0.52]],
    launchMass: 8.0, sabot: true, tracer: '#ffd27a',
    pen: { ke: 540, at: 2000, s: 1.36e6 },            // ≈540 mm @ 2 km
    crit: 76,
  },
  M830: {
    name: 'M830 HEAT-MP-T', short: 'M830', type: 'HEAT', v0: 1140, mass: 13.5, d: 0.12,
    cd: [[0, 0.18], [1, 0.42], [2, 0.36], [3, 0.31], [5, 0.27]],
    launchMass: 13.5, sabot: false, tracer: '#ff9a4a',
    pen: { ce: 490 },                                 // 480–500 mm at any range
    crit: 80,                                         // fuze graze angle
  },
  // ---- M60A1 RISE, 105 mm M68 (user data: M833 420–450 mm, M456 about 400 mm) ----
  M833: {
    name: 'M833 APFSDS-T', short: 'M833', type: 'APFSDS', v0: 1493, mass: 3.7, d: 0.024,
    cd: [[0, 0.35], [1, 0.60], [2, 0.58], [3, 0.55], [5, 0.52]],
    launchMass: 5.8, sabot: true, tracer: '#ffcc66',
    pen: { ke: 435, at: 2000, s: 1.36e6 },
    crit: 76,
  },
  M456A2: {
    name: 'M456A2 HEAT-T', short: 'M456A2', type: 'HEAT', v0: 1173, mass: 10.2, d: 0.105,
    cd: [[0, 0.18], [1, 0.42], [2, 0.36], [3, 0.31], [5, 0.27]],
    launchMass: 10.2, sabot: false, tracer: '#ff9a4a',
    pen: { ce: 400 },
    crit: 80,
  },
  // ---- M109A3, 155 mm M185 (user data): bagged charges set the muzzle velocity (data/vehicles/m109a3.js);
  // drag scaled so charge 8 reaches 18.1 km, rocket thrust so the M549A1 reaches 23.5 km (tools/artybench.js).
  // blast: r = radius of the overpressure / fragment zone against vehicles (m), kill = inside this even a tank
  // is likely knocked out. Direct penetration is only a few tens of mm.
  M107: {
    name: 'M107 HE', short: 'M107', sight: 'HE', type: 'HE', bag: true, v0: 684, mass: 43.2, d: 0.155,
    cd: [[0, 0.129], [0.8, 0.135], [0.95, 0.193], [1.05, 0.27], [1.3, 0.257], [2, 0.212], [3, 0.18]],
    launchMass: 50, sabot: false, tracer: '#ffb060',
    pen: { ce: 45 }, crit: 85, blast: { r: 9, kill: 3, tnt: 6.8 },
  },
  M549A1: {
    name: 'M549A1 HERA (로켓보조)', short: 'M549A1', sight: 'RAP', type: 'HE', bag: true, v0: 684, mass: 43.6, d: 0.155,
    cd: [[0, 0.129], [0.8, 0.135], [0.95, 0.193], [1.05, 0.27], [1.3, 0.257], [2, 0.212], [3, 0.18]],
    launchMass: 50, sabot: false, tracer: '#ffb060',
    rocket: { at: 7, burn: 3, acc: 73.3 },
    pen: { ce: 45 }, crit: 85, blast: { r: 9, kill: 3, tnt: 6.8 },
  },
  // ---- M270 MLRS: M26 rocket, 227 mm, 644 M77 dual-purpose bomblets. Launched slow, the motor burns 1.9 s
  // (thrust set so the longest shot is 32 km); the warhead opens over the target and the bomblets fall over a
  // strip about 200 m long. Bomblets pierce about 100 mm of top armour.
  M26: {
    name: 'M26 로켓 (M77 자탄 644발)', short: 'M26', sight: 'M26', type: 'ROCKET', v0: 45, mass: 250, d: 0.227,
    cd: [[0, 0.3], [0.9, 0.32], [1.1, 0.5], [2, 0.4], [3, 0.33]],
    launchMass: 0, sabot: false, tracer: '#ffd9a0',
    rocket: { at: 0, burn: 1.9, acc: 520 },
    cluster: { n: 644, alt: 550, half: 100, pen: 100, r: 2.5 },
    pen: { ce: 100 }, crit: 85, blast: { r: 4, kill: 1.5, tnt: 20 },
  },
  // ---- AH-64A: 30 mm M789 HEDP (chain gun), Hydra 70 rocket with M151 warhead, AGM-114 Hellfire ----
  M789: { name: 'M789 HEDP 30mm', short: 'M789', sight: 'HEDP', type: 'HEDP', small: true, v0: 805, mass: 0.236, d: 0.03,
    cd: [[0, 0.25], [1, 0.5], [2, 0.44], [3, 0.4]], launchMass: 0.35, sabot: false, tracer: '#ffb060', tracerEvery: 3,
    pen: { ce: 50 }, crit: 75 },
  // ---- Challenger 1 (L11A5 120 mm rifled): L26 DU APFSDS, L31 HESH ----
  L26: { name: 'L26 APFSDS (열화우라늄)', short: 'L26', type: 'APFSDS', v0: 1534, mass: 4.6, d: 0.026,
    cd: [[0, 0.35], [1, 0.60], [2, 0.58], [3, 0.55], [5, 0.52]], launchMass: 8.5, sabot: true, tracer: '#ffcc66',
    pen: { ke: 520, at: 2000, s: 1.36e6 }, crit: 76 },
  // HESH (squash head): the plastic charge flattens on the plate and blasts a scab off its inside. Modelled as a
  // weak shaped charge against the plate's CE value (poor against composite and reactive armour, deadly to
  // thin steel), plus a small burst.
  L31: { name: 'L31 HESH (점착유탄)', short: 'L31', sight: 'HESH', type: 'HESH', v0: 670, mass: 17.1, d: 0.12,
    cd: [[0, 0.2], [1, 0.45], [2, 0.38], [3, 0.33], [5, 0.29]], launchMass: 17.1, sabot: false, tracer: '#ff9a4a',
    pen: { ce: 160, hesh: true }, crit: 82 },
  // ---- AMX-30B2 (CN-105-F1): OFL 105 F1 APFSDS, OCC 105 F1 HEAT (spin-stabilised on a ball-bearing band); M693 20 mm ----
  OFL105: { name: 'OFL 105 F1 APFSDS', short: 'OFL F1', type: 'APFSDS', v0: 1525, mass: 3.8, d: 0.026,
    cd: [[0, 0.35], [1, 0.60], [2, 0.58], [3, 0.55], [5, 0.52]], launchMass: 5.8, sabot: true, tracer: '#ffcc66',
    pen: { ke: 380, at: 2000, s: 1.36e6 }, crit: 76 },
  OCC105: { name: 'OCC 105 F1 HEAT', short: 'OCC F1', type: 'HEAT', v0: 1000, mass: 10.95, d: 0.105,
    cd: [[0, 0.18], [1, 0.42], [2, 0.36], [3, 0.31], [5, 0.27]], launchMass: 10.95, sabot: false, tracer: '#ff9a4a',
    pen: { ce: 360 }, crit: 80 },
  M693: { name: 'M693 20mm HEI', short: '20mm', sight: 'HE', type: 'HEI', small: true, v0: 1050, mass: 0.1, d: 0.02,
    cd: [[0, 0.25], [1, 0.5], [2, 0.44], [3, 0.4]], launchMass: 0.14, sabot: false, tracer: '#ffb060', tracerEvery: 4,
    pen: { ce: 25 }, crit: 75 },
  // ---- BMP-1: PG-15V (73 mm, leaves the low-pressure gun at 400 m/s, a rocket takes it to about 665 m/s; drifts
  // in wind), 9M14 Malyutka (manual command guidance, ~115 m/s) ----
  PG15V: { name: 'PG-15V 대전차고폭 (로켓보조)', short: 'PG-15V', sight: 'HEAT', type: 'HEAT', v0: 400, mass: 2.6, d: 0.073,
    cd: [[0, 0.3], [0.9, 0.32], [1.1, 0.5], [2, 0.4], [3, 0.33]], launchMass: 2.6, sabot: false, tracer: '#ffb060',
    rocket: { at: 0.05, burn: 0.5, acc: 530 }, pen: { ce: 300 }, crit: 84 },
  AT3: { name: '9M14 말륫카', short: 'AT-3', type: 'HEAT', d: 0.125, tracer: '#ffb060', pen: { ce: 400 }, crit: 84,
    missile: { vmax: 120, vmin: 105, accel: 90 } },
  // ---- 2S1 (2A31 122 mm): OF-462 HE, charges set the muzzle velocity ----
  OF462: { name: 'OF-462 고폭탄', short: 'OF-462', sight: 'HE', type: 'HE', bag: true, v0: 690, mass: 21.76, d: 0.122,
    cd: [[0, 0.152], [0.8, 0.159], [0.95, 0.228], [1.05, 0.319], [1.3, 0.303], [2, 0.25], [3, 0.212]],     // scaled: 15.3 km at full charge
    launchMass: 26, sabot: false, tracer: '#ffb060', pen: { ce: 35 }, crit: 85, blast: { r: 7, kill: 2.4, tnt: 3.6 } },
  // ---- AH-1W: 20 mm M197 (M56 HEI / M53 API mixed belt) ----
  M56: { name: 'M56A3 HEI 20mm', short: 'M56', sight: 'HEI', type: 'HEI', small: true, v0: 1030, mass: 0.1, d: 0.02,
    cd: [[0, 0.25], [1, 0.5], [2, 0.44], [3, 0.4]], launchMass: 0.14, sabot: false, tracer: '#ffb060', tracerEvery: 4,
    pen: { ce: 30 }, crit: 75 },
  HYDRA: { name: 'Hydra 70 (M151 고폭)', short: 'Hydra 70', type: 'HEAT', v0: 45, mass: 10, d: 0.07,
    cd: [[0, 0.3], [0.9, 0.32], [1.1, 0.5], [2, 0.4], [3, 0.33]], launchMass: 0, sabot: false, tracer: '#ffd9a0',
    rocket: { at: 0, burn: 1.1, acc: 620 },
    pen: { ce: 20 }, crit: 85, blast: { r: 5, kill: 1, tnt: 1, small: true, tank: 0.06 } },
  HELLFIRE: { name: 'AGM-114 헬파이어', short: 'Hellfire', type: 'HEAT', d: 0.178, tracer: '#ffb060', pen: { ce: 1000 }, crit: 86 },
  // ---- M2A2 Bradley (user data): 25 mm M242 and TOW 2 ----
  M791: { name: 'M791 APDS-T', short: 'M791', sight: 'AP', type: 'APDS', small: true, v0: 1345, mass: 0.134, d: 0.0115,
    cd: [[0, 0.3], [1, 0.55], [2, 0.5], [3, 0.46], [5, 0.43]], launchMass: 0.46, sabot: false, tracer: '#ff7848', tracerEvery: 1,
    pen: { ke: 62, at: 1000, s: 1.0e6 }, crit: 68 },                // ≥ 60 mm RHA @ 1,000 m
  M792: { name: 'M792 HEI-T', short: 'M792', sight: 'HE', type: 'HEI', small: true, v0: 1100, mass: 0.184, d: 0.025,
    cd: [[0, 0.25], [1, 0.5], [2, 0.44], [3, 0.4]], launchMass: 0.5, sabot: false, tracer: '#ff7848', tracerEvery: 1,
    pen: { ce: 12 }, crit: 75 },
  TOW2: { name: 'BGM-71D TOW 2', short: 'TOW 2', type: 'HEAT', d: 0.152, tracer: '#ffb060', pen: { ce: 900 }, crit: 84 },   // ≈ 900 mm RHA
  // ---- machine-gun rounds (game values) ----
  M2_50: { name: '12.7mm M8 API / M33', short: '12.7mm', type: 'MG', small: true, v0: 887, mass: 0.046, d: 0.0127,
    cd: [[0, 0.22], [1, 0.48], [2, 0.40], [3, 0.35]], launchMass: 0.046, sabot: false, tracer: '#ff6040', tracerEvery: 5,
    pen: { ke: 25, at: 100, s: 1.0e6 }, crit: 60 },
  DSHK: { name: '12.7×108mm B-32 / BZT', short: '12.7mm', type: 'MG', small: true, v0: 850, mass: 0.048, d: 0.0127,
    cd: [[0, 0.22], [1, 0.48], [2, 0.40], [3, 0.35]], launchMass: 0.048, sabot: false, tracer: '#7dff8a', tracerEvery: 5,
    pen: { ke: 20, at: 500, s: 1.0e6 }, crit: 60 },
  M240_762: { name: '7.62mm M80 / M62', short: '7.62mm', type: 'MG', small: true, v0: 853, mass: 0.0095, d: 0.00762,
    cd: [[0, 0.24], [1, 0.5], [2, 0.42], [3, 0.37]], launchMass: 0.0095, sabot: false, tracer: '#ff6040', tracerEvery: 5,
    pen: { ke: 8, at: 100, s: 1.0e6 }, crit: 55 },
  // ---- Iraqi rounds: PROVISIONAL (typical published figures; replace with supplied data) ----
  '3BM9': { name: '3BM9 APFSDS', short: '3BM9', type: 'APFSDS', v0: 1800, mass: 3.6, d: 0.04,
    cd: [[0, 0.35], [1, 0.62], [2, 0.6], [3, 0.57], [5, 0.54]], launchMass: 5.7, sabot: true, tracer: '#ffe08a',
    pen: { ke: 245, at: 2000, s: 1.36e6 }, crit: 74 },
  '3BK12': { name: '3BK12 HEAT', short: '3BK12', type: 'HEAT', v0: 905, mass: 19, d: 0.125,
    cd: [[0, 0.2], [1, 0.45], [2, 0.38], [3, 0.33], [5, 0.29]], launchMass: 19, sabot: false, tracer: '#ffb070',
    pen: { ce: 420 }, crit: 80 },
  '3BM4': { name: '3BM4 APFSDS', short: '3BM4', type: 'APFSDS', v0: 1615, mass: 4.0, d: 0.04,
    cd: [[0, 0.35], [1, 0.62], [2, 0.6], [3, 0.57], [5, 0.54]], launchMass: 5.5, sabot: true, tracer: '#ffe08a',
    pen: { ke: 240, at: 2000, s: 1.36e6 }, crit: 74 },
  '3BK4': { name: '3BK4 HEAT', short: '3BK4', type: 'HEAT', v0: 950, mass: 12, d: 0.115,
    cd: [[0, 0.2], [1, 0.45], [2, 0.38], [3, 0.33], [5, 0.29]], launchMass: 12, sabot: false, tracer: '#ffb070',
    pen: { ce: 420 }, crit: 80 },
  '3BM8': { name: '3BM8 APDS', short: '3BM8', type: 'APDS', v0: 1415, mass: 3.5, d: 0.045,
    cd: [[0, 0.3], [1, 0.55], [2, 0.5], [3, 0.47], [5, 0.44]], launchMass: 5.7, sabot: true, tracer: '#ffe08a',
    pen: { ke: 260, at: 2000, s: 1.36e6 }, crit: 70 },
  BR412D: { name: 'BR-412D APHE', short: 'BR-412D', type: 'APHE', v0: 887, mass: 15.9, d: 0.1,
    cd: [[0, 0.22], [1, 0.48], [2, 0.42], [3, 0.38], [5, 0.33]], launchMass: 15.9, sabot: false, tracer: '#ffc080',
    pen: { ke: 150, at: 1000, s: 1.0e6 }, crit: 64 },
};
DS.AMMO_ORDER = ['M829A1', 'M829', 'M830'];

// What each round looks like in flight (src/render/Renderer.js, projectiles): drawn at its true size at the
// head of its streak. spr = a sprite cut from a photo (tools/cut_munitions.py), else drawn in code:
//   dart   long-rod penetrator with tail fins (APFSDS)        shell   ogive body with a driving band
//   heat   fin-stabilised HEAT: thin nose probe, body, fins     rocket  small rocket with tail fins
// len, dia in metres; fin = fin span; col = body paint; notr = no tracer (seen only as a motion smear);
// whistle = heard coming down (artillery).
(function (L) {
  for (const [id, v] of Object.entries(L)) if (DS.AMMO[id]) DS.AMMO[id].look = v;
})({
  M829A1: { k: 'dart', len: 0.78, dia: 0.027, fin: 0.085, col: '#4b4a46' },
  M829:   { k: 'dart', len: 0.78, dia: 0.027, fin: 0.085, col: '#4b4a46' },
  M833:   { k: 'dart', len: 0.60, dia: 0.024, fin: 0.075, col: '#4b4a46' },
  '3BM9': { k: 'dart', len: 0.55, dia: 0.040, fin: 0.12, col: '#55534c' },
  '3BM4': { k: 'dart', len: 0.50, dia: 0.040, fin: 0.11, col: '#55534c' },
  M830:   { k: 'heat', len: 0.98, dia: 0.120, fin: 0.12, col: '#2f3324', band: '#e0c000' },
  M456A2: { k: 'heat', len: 0.62, dia: 0.105, fin: 0.105, col: '#2f3324', band: '#e0c000' },
  '3BK12':{ k: 'heat', len: 0.68, dia: 0.125, fin: 0.36, col: '#3b3f2c' },
  '3BK4': { k: 'heat', len: 0.66, dia: 0.115, fin: 0.33, col: '#3b3f2c' },
  '3BM8': { k: 'dart', len: 0.32, dia: 0.045, fin: 0, col: '#3d3d3a' },
  BR412D: { k: 'shell', len: 0.42, dia: 0.100, col: '#3d3f37' },
  M107:   { spr: 'munitions/s155', len: 0.70, dia: 0.155, notr: true, whistle: true },
  M549A1: { spr: 'munitions/s155', len: 0.87, dia: 0.155, notr: true, whistle: true },
  M26:    { spr: 'munitions/m26', len: 3.94, dia: 0.30, notr: true },
  HYDRA:  { k: 'rocket', len: 1.06, dia: 0.070, fin: 0.17, col: '#4b5236', notr: true },
  L26:    { k: 'dart', len: 0.6, dia: 0.026, fin: 0.08, col: '#4b4a46' },
  OFL105: { k: 'dart', len: 0.55, dia: 0.026, fin: 0.075, col: '#4b4a46' },
  L31:    { k: 'shell', len: 0.5, dia: 0.120, col: '#3a3f2f' },
  OCC105: { k: 'shell', len: 0.62, dia: 0.105, col: '#2f3324' },
  PG15V:  { k: 'heat', len: 0.38, dia: 0.073, fin: 0.12, col: '#3b3f2c' },
  OF462:  { k: 'shell', len: 0.55, dia: 0.122, col: '#3d3f37', notr: true, whistle: true },
});

// Armour materials: RHA-equivalence multipliers on line-of-sight thickness, vs KE and vs CE (HEAT).
DS.MATERIALS = {
  rha:        { name: '압연강(RHA)', ke: 1.00, ce: 1.00 },
  cast:       { name: '주조강', ke: 0.92, ce: 0.92 },
  m1_comp:    { name: '복합장갑(HA·DU)', ke: 0.70, ce: 1.40 },   // turret/hull front special armour
  t72_turret: { name: '주조강 포탑', ke: 0.65, ce: 0.70 },       // → turret front KE ≈380 / CE ≈410 on the LOS (user data)
  t72_glacis: { name: '적층 경사판', ke: 0.61, ce: 0.82 },       // → hull front KE ≈335 / CE ≈450 on the LOS (user data)
  alu:        { name: '알루미늄 장갑', ke: 0.38, ce: 0.40 },
  track:      { name: '궤도·주행장치', ke: 1.00, ce: 1.00 },
};
