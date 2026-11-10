// T-62 (Iraqi) rig. Geometry from assets/ref/iraqi_t55_t62_t72_side.png (right-hand drawing, facing right)
// at 81 px/m (9.34 m with gun, hull 6.63 m), origin px (1281, 490). Road wheel tyre r = 32 px. Armour: user data (docs/DATA_SOURCES.md).
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 81, OX = 1281, OY = 490;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [1122.5, 1205, 1287.5, 1365, 1440].map(x => L(x, 545));
  DS.VEHICLES.t62 = {
    id: 't62', name: 'T-62', side: 'IQ', ammo: ['3BM4', '3BK4'],
    mass: 37500, inertia: 1.45e5,
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/t62/' },
    sprites: {
      hull: { x: 987, y: 463 }, turret: { x: 988, y: 338 }, barrel: { x: 1412, y: 428 },
      flag: { x: 1246, y: 418, file: 'flag' },
      roadwheel: { r: 256, file: 'roadwheel' }, idler: { file: 'roadwheel', tint: 0.15 },
      sprocket: { file: 'sprocket', R: 0.367, tooth0: 10 },         // 16 teeth
    },
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.395, topRunOnWheels: true,
    suspension: { k: 2.5e5, c: 1.9e4, bump: 0.17, droop: 0.08, bumpK: 4e6, bumpC: 1.0e5 },
    sprocket: { x: L(1055, 525)[0], y: L(1055, 525)[1], teeth: 16 },
    idler: { x: L(1500, 522.5)[0], y: L(1500, 522.5)[1], r: 0.272 },
    returnRollers: [],
    track: { pitch: 0.134, thick: 0.075, width: 0.58, mass: 3100 },
    belly: { y: -0.72, x0: -3.15, x1: 3.25 },
    contactArea: 0.9,
    underside: { x0: -2.72, x1: 2.47, y0: -0.128, y1: -0.80,
      poly: [[-3.4, -0.13], [3.25, -0.13], [3.15, -0.33], [2.88, -0.62], [2.3, -0.82], [-2.3, -0.82], [-3.05, -0.66], [-3.42, -0.36]] },
    engine: { type: 'diesel', power: 4.32e5, eff: 0.70, maxTractive: 2.4e5, spool: 0.4,
      vmaxF: 50 / 3.6, vmaxR: 8 / 3.6, brake: 3.7e5, engineBrake: 2.6e4 },
    exhaust: { x: -2.96, y: -0.15 },
    gun: { name: 'U-5TS 115mm', trunnion: L(1395, 438), muzzle: (1740 - 1395) / PPM,
      elevMax: 16, elevMin: -6, rate: 0.22, recoilLen: 0.42, recoilMass: 2100, reload: 8.0, stabilized: true },
    turretRing: L(1280, 463),
    antennas: [{ x: L(1184, 398)[0], y: L(1184, 398)[1], len: 1.2 }],
    sight: { laser: false, rangeErr: 0.13, aimErr: 4.8, layTime: 7, detectMax: 2200, engageMax: 1500 },
    armor: [
      { name: '포탑 전면 상부', part: 'turret', a: L(1370, 400), b: L(1412, 422), t: 230, mat: 'cast', n: 60, h: 0 },
      { name: '포 방패', part: 'turret', a: L(1412, 422), b: L(1412, 450), t: 230, mat: 'cast', n: 0, h: 0 },
      { name: '포탑 전면 하부', part: 'turret', a: L(1412, 450), b: L(1395, 462), t: 230, mat: 'cast', n: -45, h: 0 },
      { name: '포탑 상면', part: 'turret', a: L(1200, 385), b: L(1370, 400), t: 40, mat: 'rha', n: 90, h: 0 },
      { name: '포탑 후면', part: 'turret', a: L(1150, 410), b: L(1150, 462), t: 60, mat: 'cast', n: 180, h: 0 },
      { name: '차체 전면 상부', part: 'hull', a: L(1440, 465), b: L(1545, 500), t: 100, mat: 'rha', n: 60, h: 0 },
      { name: '차체 전면 하부', part: 'hull', a: L(1545, 502), b: L(1515, 525), t: 100, mat: 'rha', n: -55, h: 0 },
      { name: '차체 상면', part: 'hull', a: L(1010, 465), b: L(1440, 466), t: 20, mat: 'rha', n: 90, h: 0 },
      { name: '차체 후면', part: 'hull', a: L(1000, 465), b: L(1000, 505), t: 45, mat: 'rha', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(1515, 525), b: L(1495, 582), t: 20, mat: 'track', n: -45, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(1495, 582), b: L(1050, 582), t: 20, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(1050, 582), b: L(1000, 505), t: 20, mat: 'track', n: -140, h: 0, track: true },
    ],
    sideArmor: { hull: '약 80 mm' },
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(1475, 485), r: 0.35 },
      { id: 'gunner', name: '포수', type: 'crew', p: L(1295, 435), r: 0.30 },
      { id: 'commander', name: '전차장', type: 'crew', p: L(1235, 425), r: 0.30 },
      { id: 'loader', name: '탄약수', type: 'crew', p: L(1330, 440), r: 0.30 },
      { id: 'gun', name: '주포 약실', type: 'gun', p: L(1345, 438), r: 0.28 },
      { id: 'rack', name: '전방 연료탱크·탄약 랙', type: 'fuel_ammo', p: L(1455, 495), r: 0.40 },
      { id: 'hullammo', name: '차체 탄약', type: 'ammo', p: L(1290, 500), r: 0.45 },
      { id: 'turretammo', name: '포탑 후부 탄약', type: 'ammo', p: L(1180, 440), r: 0.25 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(1070, 480), r: 0.55 },
      { id: 'trans', name: '변속기', type: 'engine', p: L(1020, 490), r: 0.35 },
    ],
  };
})();
