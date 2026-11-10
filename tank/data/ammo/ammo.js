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

// Armour materials: RHA-equivalence multipliers on line-of-sight thickness, vs KE and vs CE (HEAT).
DS.MATERIALS = {
  rha:        { name: '압연강(RHA)', ke: 1.00, ce: 1.00 },
  cast:       { name: '주조강', ke: 0.92, ce: 0.92 },
  m1_comp:    { name: '복합장갑(HA·DU)', ke: 0.70, ce: 1.40 },   // turret/hull front special armour
  t72_turret: { name: '주조강 포탑', ke: 0.65, ce: 0.70 },       // → turret front KE ≈380 / CE ≈410 on the LOS (user data)
  t72_glacis: { name: '적층 경사판', ke: 0.61, ce: 0.82 },       // → hull front KE ≈335 / CE ≈450 on the LOS (user data)
  track:      { name: '궤도·주행장치', ke: 1.00, ce: 1.00 },
};
