// Global tuning. Every number the game balances on lives here (overridable from the console:
// DS.T.physicsHz = 360 etc.).
window.DS = window.DS || {};
DS.T = {
  g: 9.81,
  rho: 1.2,                 // air density kg/m³ (hot desert air ~1.1–1.2)
  sound: 343,
  physicsHz: 240,
  maxSubsteps: 16,
  terrain: { dx: 0.1, length: 10000, repose: 33 },
  camera: { zoomMin: 1.5, zoomMax: 90, presets: [40, 14, 3], lookAhead: 0.9 },
  traction: { vref: 0.06, vrefSlip: 0.035 },     // slip-velocity scale for tanh traction curve
  particles: { max: 6000 },
};
// Soil types. Bekker: z = (p / (kc/b + kphi))^(1/n), p in kPa → z in m.
// Mohr–Coulomb shear: Fmax = A·c + N·tanφ.
DS.SOILS = [
  { id: 0, name: '다져진 사막', n: 0.80, kc: 30, kphi: 5000, c: 5.0e3, phi: 34, crr: 0.035,
    col: ['#d9b77f', '#c49a5e'], dust: 0.5 },
  { id: 1, name: '연사 (부드러운 모래)', n: 1.10, kc: 1, kphi: 1530, c: 1.0e3, phi: 30, crr: 0.070,
    col: ['#e6c48c', '#cfa66c'], dust: 1.0 },
  { id: 2, name: '사브카 (염습지)', n: 0.90, kc: 10, kphi: 900, c: 3.0e3, phi: 24, crr: 0.080,
    col: ['#cbb592', '#a8916d'], dust: 0.35 },
];
