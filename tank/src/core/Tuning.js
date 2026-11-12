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
  flora: false,          // vegetation sprites (src/render/Flora.js) switched off for now
  camera: { zoomMin: 1.5, zoomMax: 90, presets: [40, 14, 3], lookAhead: 0.9, ground: 0.12, maxWidth: 250 },
  traction: { vref: 0.06, vrefSlip: 0.035 },     // slip-velocity scale for tanh traction curve
  particles: { max: 9000 },
  ai: { detect: 0.55 },                          // Iraqi detection multiplier (1 = earlier behaviour)
};
// Soil types. Bekker: z = (p / (kc/b + kphi))^(1/n), p in kPa → z in m.
// Mohr–Coulomb shear: Fmax = A·c + N·tanφ.
DS.SOILS = [
  { id: 0, name: '다져진 사막', n: 0.80, kc: 30, kphi: 5000, c: 5.0e3, phi: 34, crr: 0.035, crust: 95,
    col: ['#d9b77f', '#c49a5e'], dust: 0.5 },
  { id: 1, name: '연사 (부드러운 모래)', n: 1.10, kc: 1, kphi: 1530, c: 1.0e3, phi: 30, crr: 0.070,
    col: ['#e6c48c', '#cfa66c'], dust: 1.0 },
  { id: 2, name: '사브카 (염습지)', n: 0.90, kc: 10, kphi: 900, c: 3.0e3, phi: 24, crr: 0.080, crust: 75,
    col: ['#cbb592', '#a8916d'], dust: 0.35 },
  { id: 3, name: '도로 (다진 자갈 포장)', n: 1.0, kc: 100, kphi: 60000, c: 3.0e4, phi: 38, crr: 0.020,
    col: ['#a89d88', '#8b816e'], dust: 0.12, road: true },
  { id: 4, name: '자갈 평원', n: 0.90, kc: 50, kphi: 20000, c: 2.0e3, phi: 38, crr: 0.030,
    col: ['#b8a58a', '#9a876b'], dust: 0.25, mobile: 0.3 },
  { id: 5, name: '젖은 모래 (와디 바닥)', n: 0.80, kc: 15, kphi: 700, c: 6.0e3, phi: 27, crr: 0.095,
    col: ['#a8875a', '#8a6c44'], dust: 0.05, mobile: 0.05 },
  { id: 6, name: '아스팔트 포장', n: 1.0, kc: 200, kphi: 2.0e5, c: 8.0e4, phi: 40, crr: 0.015,
    col: ['#5f5c57', '#4b4945'], dust: 0.03, road: true, mobile: 0 },
];
