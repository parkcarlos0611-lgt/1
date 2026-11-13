// AMX-30B2 (French Army, Op Daguet). Geometry from assets/ref/amx30b2_sheet.png (right-side profile, facing
// right) at 95 px/m (hull 6.8 m), origin px (374, 494) at the turret ring (tools/cut_new4.py). COTAC fire
// control with laser rangefinder, first-generation thermal sight (500 × 300, the class of the M1A1's and
// Challenger's), 20 mm M693 coaxial cannon.
// Figures are public estimates, provisional.
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 95, OX = 374, OY = 494;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [189.6, 280.4, 369, 458.9, 550].map(x => L(x, 593));
  DS.VEHICLES.amx30b2 = {
    id: 'amx30b2', name: 'AMX-30B2', side: 'US', nation: 'FR', ammo: ['OFL105', 'OCC105'],
    mass: 37000, inertia: 1.5e5, signature: 1.0,
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/amx30b2/' },
    sprites: {
      hull: { x: 49, y: 486 }, turret: { x: 95, y: 392 }, barrel: { x: 548, y: 452 }, under: { x: 122, y: 545 },
      roadwheel: { r: 256, file: 'roadwheel' }, idler: { file: 'idler' },
      sprocket: { file: 'sprocket', R: 0.33, tooth0: 0 },
    },
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.376, topRunOnWheels: true,
    suspension: { k: 2.6e5, c: 2.0e4, bump: 0.22, droop: 0.10, bumpK: 4e6, bumpC: 1.0e5 },     // torsion bars
    sprocket: { x: L(110, 571)[0], y: L(110, 571)[1], teeth: 14 },
    idler: { x: L(650, 568)[0], y: L(650, 568)[1], r: 0.31 },
    returnRollers: [],
    track: { pitch: 0.135, thick: 0.07, width: 0.57, mass: 3200 },
    belly: { y: -0.97, x0: L(80, 0)[0], x1: L(680, 0)[0] },
    contactArea: 0.85, footHalf: 0.5,          // wheels about 1.0 m apart: each presses the ground to the next
    // dark hull side behind the running gear, down to the bottom track run (as on the sheet)
    underside: { x0: -3.2, x1: 3.3, y0: -0.6, y1: -1.32,
      poly: [[L(60, 0)[0], -0.6], [L(690, 0)[0], -0.6], [L(682, 0)[0], -0.8], [L(655, 0)[0], -1.05], [L(595, 0)[0], -1.32], [L(150, 0)[0], -1.32], [L(100, 0)[0], -1.05], [L(70, 0)[0], -0.8]] },
    engine: { type: 'diesel', power: 5.37e5, eff: 0.72, maxTractive: 2.9e5, spool: 0.45,     // Hispano-Suiza HS-110, 720 hp
      vmaxF: 65 / 3.6, vmaxR: 12 / 3.6, brake: 4.0e5, engineBrake: 2.6e4 },
    exhaust: { x: L(60, 505)[0], y: L(60, 505)[1] },
    gun: { name: 'CN-105-F1 105mm', trunnion: L(515, 470), muzzle: (922 - 515) / PPM,
      elevMax: 20, elevMin: -8, rate: 0.30, recoilLen: 0.3, recoilMass: 1800, reload: 7.5, stabilized: true, stab: 0.5 },
    // 20 mm M693 dual-feed cannon, left of the main gun: light armour, soft targets and helicopters
    coax: { name: 'M693 20mm 동축 기관포', ammo: 'M693', muzzle: L(540, 478), rate: 740 / 60, rounds: 480, spread: 1.0 },
    turretRing: L(370, 494),
    sight: { laser: true, thermal: true, tis: [500, 300], name: 'COTAC', crew: 1.0, rangeErr: 0.008, aimErr: 0.35, layTime: 3, detectMax: 4000, identMax: 2800, engageMax: 2500 },
    armor: [
      { name: '포탑 전면 상부', part: 'turret', a: L(480, 440), b: L(545, 455), t: 80, mat: 'cast', n: 60, h: 0 },
      { name: '포탑 전면 (포 방패)', part: 'turret', a: L(545, 455), b: L(545, 494), t: 80, mat: 'cast', n: 0, h: 0 },
      { name: '포탑 상면', part: 'turret', a: L(200, 415), b: L(480, 440), t: 20, mat: 'cast', n: 90, h: 0 },
      { name: '포탑 후면', part: 'turret', a: L(95, 440), b: L(95, 494), t: 30, mat: 'cast', n: 180, h: 0 },
      { name: '차체 전면 상부', part: 'hull', a: L(560, 500), b: L(698, 530), t: 79, mat: 'rha', n: 68, h: 0 },
      { name: '차체 전면 하부', part: 'hull', a: L(698, 530), b: L(660, 556), t: 56, mat: 'rha', n: -45, h: 0 },
      { name: '차체 상면', part: 'hull', a: L(80, 495), b: L(560, 500), t: 15, mat: 'rha', n: 90, h: 0 },
      { name: '차체 후면', part: 'hull', a: L(50, 500), b: L(50, 550), t: 30, mat: 'rha', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(690, 556), b: L(630, 620), t: 20, mat: 'track', n: -45, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(630, 622), b: L(140, 622), t: 20, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(140, 622), b: L(60, 550), t: 20, mat: 'track', n: -140, h: 0, track: true },
    ],
    sideArmor: { hull: '약 35 mm' },
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(610, 520), r: 0.35 },
      { id: 'gunner', name: '포수', type: 'crew', p: L(460, 465), r: 0.30 },
      { id: 'commander', name: '전차장', type: 'crew', p: L(380, 440), r: 0.30 },
      { id: 'loader', name: '탄약수', type: 'crew', p: L(300, 465), r: 0.30 },
      { id: 'gun', name: '주포 약실', type: 'gun', p: L(470, 470), r: 0.28 },
      { id: 'hullammo', name: '차체 전방 탄약', type: 'ammo', p: L(560, 525), r: 0.36 },
      { id: 'turretammo', name: '포탑 탄약', type: 'ammo', p: L(260, 470), r: 0.30 },
      { id: 'fuel', name: '연료탱크', type: 'fuel', p: L(420, 530), r: 0.35 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(150, 525), r: 0.55 },
      { id: 'trans', name: '변속기', type: 'engine', p: L(80, 530), r: 0.33 },
    ],
  };
})();
