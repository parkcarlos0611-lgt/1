// T-72M1 (Iraqi "Asad Babil" class) rig. Geometry from assets/ref/iraqi_t55_t62_t72_side.png
// (right-hand drawing, facing right) at 82 px/m, origin px (1288, 760). tools/cut_iraqi.py cuts the layers.
// Armour: user data — early Ural, effective RHA hull front KE 335 / CE 450, turret front KE 380 / CE 410.
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 82, OX = 1288, OY = 760;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [];
  for (let i = 0; i < 6; i++) wheels.push(L(1121 + 67 * i, 832));

  DS.VEHICLES.t72 = {
    id: 't72', name: 'T-72M1', side: 'IQ', ammo: ['3BM9', '3BK12'],
    mass: 41500, inertia: 1.8e5,
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/t72/' },
    sprites: {
      hull: { x: 969, y: 741 }, turret: { x: 1020, y: 623 }, barrel: { x: 1386, y: 702 },
      flag: { x: 1199, y: 696, file: 'flag' },   // drawn unmirrored on left-facing tanks so the script reads correctly
      // running gear sheet (tools/cut_wheels_iraqi.py, assets/ref/iraqi_wheels.png): first road wheel + sprocket
      roadwheel: { r: 256, file: 'roadwheel' }, idler: { file: 'roadwheel', tint: 0.15 },
      sprocket: { file: 'sprocket', R: 0.34, tooth0: 4.5 },   // 12 teeth; sized to the art (sprocket 234 px : road wheel 252 px)
    },
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.366,
    suspension: { k: 2.6e5, c: 2.2e4, bump: 0.24, droop: 0.10, bumpK: 4e6, bumpC: 1.0e5 },
    sprocket: { x: L(1052, 812)[0], y: L(1052, 812)[1], teeth: 12 },
    idler: { x: L(1525, 815)[0], y: L(1525, 815)[1], r: 0.29 },
    returnRollers: [{ x: -1.6, y: -0.40, r: 0.1 }, { x: -0.2, y: -0.40, r: 0.1 }, { x: 1.2, y: -0.40, r: 0.1 }],
    track: { pitch: 0.1526, thick: 0.08, width: 0.58, mass: 3400 },
    belly: { y: -0.83, x0: -3.1, x1: 3.2 },
    contactArea: 0.95,
    underside: { x0: -2.65, x1: 2.85, y0: -0.52, y1: -1.0 },
    sprocketHole: 0.355,             // hull art is cut out round the sprocket (r 29 px); filled dark behind it

    engine: {                        // V-46 diesel, 780 hp
      type: 'diesel', power: 5.82e5, eff: 0.70, maxTractive: 2.9e5, spool: 0.35,
      vmaxF: 60 / 3.6, vmaxR: 4.2 / 3.6,   // the T-72's single 4.2 km/h reverse gear
      brake: 4.2e5, engineBrake: 3.0e4,
    },
    exhaust: { x: -2.4, y: -0.25 },

    gun: {                           // 2A46 125 mm smoothbore, carousel autoloader
      name: '2A46 125mm', trunnion: L(1366, 712),
      muzzle: (1742 - 1366) / PPM,
      elevMax: 14, elevMin: -6, rate: 0.30,
      recoilLen: 0.30, recoilMass: 2400, reload: 7.5, stabilized: true,
    },
    turretRing: L(1250, 741),
    antennas: [{ x: L(1152, 683)[0], y: L(1152, 683)[1], len: 1.0 }],

    // physical t × material factor reproduces the supplied effective values on the line of sight
    sight: { laser: true, rangeErr: 0.02, aimErr: 0.35, layTime: 3.5 },   // TPD-K1 laser rangefinder
    armor: [
      { name: '포탑 전면', part: 'turret', a: L(1372, 690), b: L(1392, 722), t: 500, mat: 't72_turret', n: 10, h: 30 },
      { name: '포탑 전면 하단', part: 'turret', a: L(1392, 722), b: L(1362, 741), t: 500, mat: 't72_turret', n: -30, h: 30 },
      { name: '포탑 상면', part: 'turret', a: L(1130, 668), b: L(1372, 690), t: 45, mat: 'rha', n: 90, h: 0 },
      { name: '포탑 후면', part: 'turret', a: L(1122, 672), b: L(1112, 741), t: 70, mat: 'cast', n: 180, h: 0 },
      { name: '차체 상부 경사판', part: 'hull', a: L(1460, 755), b: L(1557, 782), t: 205, mat: 't72_glacis', n: 68, h: 0 },
      { name: '차체 하부 전면', part: 'hull', a: L(1557, 790), b: L(1520, 818), t: 85, mat: 'rha', n: -60, h: 0 },
      { name: '차체 상면', part: 'hull', a: L(990, 745), b: L(1460, 755), t: 20, mat: 'rha', n: 90, h: 0 },
      { name: '차체 후면', part: 'hull', a: L(985, 745), b: L(985, 805), t: 40, mat: 'rha', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(1520, 818), b: L(1500, 867), t: 20, mat: 'track', n: -45, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(1500, 867), b: L(1060, 867), t: 20, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(1060, 867), b: L(985, 805), t: 20, mat: 'track', n: -140, h: 0, track: true },
    ],
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(1480, 790), r: 0.35 },
      { id: 'gunner', name: '포수', type: 'crew', p: L(1300, 725), r: 0.30 },
      { id: 'commander', name: '전차장', type: 'crew', p: L(1205, 715), r: 0.32 },
      { id: 'gun', name: '주포 약실', type: 'gun', p: L(1310, 708), r: 0.28 },
      { id: 'carousel', name: '자동장전기 탄약 (회전식)', type: 'ammo_carousel', p: L(1262, 808), r: 0.75 },
      { id: 'rack', name: '전방 연료탱크·탄약 랙', type: 'fuel_ammo', p: L(1430, 800), r: 0.40 },
      { id: 'fuel', name: '연료탱크', type: 'fuel', p: L(1120, 765), r: 0.30 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(1060, 780), r: 0.60 },
      { id: 'trans', name: '변속기', type: 'engine', p: L(1000, 790), r: 0.35 },
    ],
  };
})();
