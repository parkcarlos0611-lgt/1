// Ammunition data (game starting values — cross-check, see docs/PLAN.md §4).
// cd: drag coefficient table vs Mach [[M, Cd], ...] referenced to area of diameter d.
window.DS = window.DS || {};
DS.AMMO = {
  M829A1: {
    name: 'M829A1 APFSDS-T', type: 'APFSDS', v0: 1575, mass: 4.6, d: 0.027,
    cd: [[0, 0.35], [1, 0.60], [2, 0.58], [3, 0.55], [5, 0.52]],
    launchMass: 9.0, sabot: true, tracer: '#ffcc66',
  },
  M830: {
    name: 'M830 HEAT-MP-T', type: 'HEAT', v0: 1140, mass: 13.5, d: 0.12,
    cd: [[0, 0.18], [1, 0.42], [2, 0.36], [3, 0.31], [5, 0.27]],
    launchMass: 13.5, sabot: false, tracer: '#ff9a4a',
  },
};
