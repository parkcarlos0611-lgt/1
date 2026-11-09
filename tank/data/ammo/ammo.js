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
};
DS.AMMO_ORDER = ['M829A1', 'M829', 'M830'];

// Armour materials: RHA-equivalence multipliers on line-of-sight thickness, vs KE and vs CE (HEAT).
DS.MATERIALS = {
  rha:        { name: '압연강(RHA)', ke: 1.00, ce: 1.00 },
  cast:       { name: '주조강', ke: 0.92, ce: 0.92 },
  m1_comp:    { name: '복합장갑(HA·DU)', ke: 0.70, ce: 1.40 },   // turret/hull front special armour
  t72_turret: { name: '주조강+충전재', ke: 0.72, ce: 0.85 },     // T-72M1 sand-bar filler (provisional)
  t72_glacis: { name: '적층 경사판', ke: 0.75, ce: 0.85 },       // steel/textolite/steel (provisional)
  track:      { name: '궤도·주행장치', ke: 1.00, ce: 1.00 },
};
