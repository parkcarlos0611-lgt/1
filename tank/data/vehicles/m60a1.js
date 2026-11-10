// M60A1 RISE (Passive), USMC, Gulf War. Geometry from assets/ref/m60a1_views.png (right-facing side drawing)
// at 92 px/m (hull 6.95 m = 641 px), origin px (1250, 262) (tools/cut_m60.py). Dimensions, armour and
// ammunition figures: user data (docs/DATA_SOURCES.md); the rest are public estimates, provisional.
// Fire control sits between the T-72 and the M1A1: coincidence optical rangefinder (no laser), mechanical
// ballistic computer, add-on stabiliser, passive (image-intensifier) night sight — no thermal imager.
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 92, OX = 1250, OY = 262;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [1052, 1132, 1212, 1292, 1370, 1449].map(x => L(x, 362));
  const RR = (x, y) => ({ x: L(x, y)[0], y: L(x, y)[1], r: 0.155 });
  DS.VEHICLES.m60a1 = {
    id: 'm60a1', name: 'M60A1 RISE', side: 'US', ammo: ['M833', 'M456A2'],
    mass: 52600, inertia: 2.7e5,
    signature: 1.1,                  // tall (3.27 m): a little easier to pick out than an M1A1
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/m60a1/' },
    sprites: {
      hull: { x: 934, y: 238 }, roller: { file: 'roller' }, turret: { x: 989, y: 85 }, barrel: { x: 1424, y: 175 },
      roadwheel: { r: 256, file: 'roadwheel' }, idler: { file: 'idler' },
      sprocket: { file: 'sprocket', R: 0.36, tooth0: 7.75 },        // 12 teeth in the drawing
    },
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.35,
    suspension: { k: 4.2e5, c: 3.4e4, bump: 0.22, droop: 0.10, bumpK: 6e6, bumpC: 1.5e5 },   // torsion bars
    sprocket: { x: L(985, 310)[0], y: L(985, 310)[1], teeth: 12 },
    idler: { x: L(1530, 315)[0], y: L(1530, 315)[1], r: 0.34 },
    returnRollers: [RR(1095, 292), RR(1227, 292), RR(1382, 292)],
    track: { pitch: 0.168, thick: 0.075, width: 0.71, mass: 4300 },
    belly: { y: -0.85, x0: L(955, 0)[0], x1: L(1555, 0)[0] },
    contactArea: 0.95,
    underside: { x0: -3.2, x1: 3.4, y0: -0.08, y1: -0.85,
      poly: [[L(938, 0)[0], -0.06], [L(1576, 0)[0], -0.06], [L(1572, 0)[0], -0.36], [L(1515, 0)[0], -0.82], [L(1005, 0)[0], -0.82], [L(944, 0)[0], -0.42]] },
    // no side skirts: the hull side is painted and carries the visible suspension (arm pivot and shock top
    // relative to each wheel's rest position, forward / up, m)
    openSide: { col: '#8e7338', dark: '#6e5a2c', lit: '#c8a652', ink: '#2a2110', arm: [0.40, 0.33], shock: [-0.12, 0.62], shocks: [0, 1, 5] },
    engine: { type: 'diesel', power: 5.59e5, eff: 0.72, maxTractive: 3.4e5, spool: 0.45,    // AVDS-1790-2C, 750 hp
      vmaxF: 48 / 3.6, vmaxR: 12 / 3.6, brake: 5.2e5, engineBrake: 2.8e4 },
    exhaust: { x: L(936, 256)[0], y: L(936, 256)[1] },
    gun: { name: 'M68 105mm', trunnion: L(1405, 193), muzzle: (1735 - 1405) / PPM,
      elevMax: 20, elevMin: -10, rate: 0.30, recoilLen: 0.30, recoilMass: 1900, reload: 7.5,
      stabilized: true, stab: 0.6 },           // add-on stabiliser: holds 60 % of the hull's pitching out of the lay
    coax: { name: 'M240 7.62mm 동축', ammo: 'M240_762', muzzle: L(1426, 203), rate: 750 / 60, rounds: 5950, spread: 0.7 },
    turretRing: L(1235, 238),
    antennas: [{ x: L(1085, 143)[0], y: L(1085, 143)[1], len: 1.25 }, { x: L(1118, 150)[0], y: L(1118, 150)[1], len: 1.7 }],
    // optical: coincidence rangefinder (takes a few seconds, error grows with range); passive: image-intensifier
    // night sight; crew: detection quality of a well-drilled crew with good optics (Iraqi crews use DS.T.ai.detect)
    sight: { laser: false, optical: true, passive: true, crew: 1.0, rangeErr: 0.025, aimErr: 0.8, layTime: 4, detectMax: 3200, identMax: 2200, engageMax: 2500 },
    // Armour. Base steel from the user's figures (glacis 109 mm at 65°, turret front 254 mm cast); era: the
    // M19 reactive tiles of the RISE (Passive), for now one flat bonus against shaped charges on the faces
    // that carry them (the tiles are not yet used up one by one).
    armor: [
      { name: '포탑 전면 (포 방패)', part: 'turret', a: L(1420, 168), b: L(1420, 216), t: 254, mat: 'cast', n: 0, h: 0, era: 350 },
      { name: '포탑 전면 상부', part: 'turret', a: L(1325, 150), b: L(1420, 168), t: 150, mat: 'cast', n: 62, h: 0, era: 350 },
      { name: '포탑 전면 하부', part: 'turret', a: L(1420, 216), b: L(1392, 238), t: 200, mat: 'cast', n: -38, h: 0 },
      { name: '포탑 상면', part: 'turret', a: L(1060, 148), b: L(1325, 150), t: 25, mat: 'cast', n: 90, h: 0 },
      { name: '큐폴라', part: 'turret', a: L(1262, 95), b: L(1262, 150), t: 30, mat: 'cast', n: 0, h: 0 },
      { name: '포탑 후면', part: 'turret', a: L(1034, 150), b: L(1034, 238), t: 57, mat: 'cast', n: 180, h: 0 },
      { name: '차체 전면 상부', part: 'hull', a: L(1440, 240), b: L(1578, 272), t: 109, mat: 'cast', n: 65, h: 0, era: 350 },
      { name: '차체 전면 하부', part: 'hull', a: L(1578, 272), b: L(1548, 302), t: 143, mat: 'cast', n: -55, h: 0 },
      { name: '차체 상면', part: 'hull', a: L(945, 240), b: L(1440, 240), t: 36, mat: 'cast', n: 90, h: 0 },
      { name: '차체 후면', part: 'hull', a: L(934, 242), b: L(934, 302), t: 41, mat: 'cast', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(1566, 302), b: L(1500, 402), t: 20, mat: 'track', n: -45, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(1500, 402), b: L(1010, 402), t: 20, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(1010, 402), b: L(940, 302), t: 20, mat: 'track', n: -140, h: 0, track: true },
    ],
    sideArmor: { hull: '약 74 mm' },
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(1492, 268), r: 0.35 },
      { id: 'gunner', name: '포수', type: 'crew', p: L(1305, 205), r: 0.30 },
      { id: 'commander', name: '전차장', type: 'crew', p: L(1235, 165), r: 0.30 },
      { id: 'loader', name: '탄약수', type: 'crew', p: L(1185, 205), r: 0.30 },
      { id: 'gun', name: '주포 약실', type: 'gun', p: L(1345, 193), r: 0.28 },
      { id: 'hullammo', name: '차체 전방 탄약', type: 'ammo', p: L(1435, 275), r: 0.36 },
      { id: 'turretammo', name: '포탑 후부 탄약', type: 'ammo', p: L(1095, 200), r: 0.30 },
      { id: 'fuel', name: '연료탱크', type: 'fuel', p: L(1100, 268), r: 0.36 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(1015, 266), r: 0.55 },
      { id: 'trans', name: '변속기', type: 'engine', p: L(958, 272), r: 0.33 },
    ],
  };
})();
