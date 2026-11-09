// T-55 (Iraqi) rig. Geometry from assets/ref/iraqi_t55_t62_t72_side.png (right-hand drawing, facing right)
// at 80 px/m, origin px (1277, 190). Layers: tools/cut_iraqi.py; wheels: tools/cut_wheels_iraqi.py.
// Armour: user data (docs/DATA_SOURCES.md). No side skirts, no return rollers: the top run rests on the wheels.
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 80, OX = 1277, OY = 190;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [1123.5, 1196, 1266, 1338.5, 1430].map(x => L(x, 242.5));
  DS.VEHICLES.t55 = {
    id: 't55', name: 'T-55', side: 'IQ', ammo: ['3BM8', 'BR412D'],
    mass: 36000, inertia: 1.35e5,
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/t55/' },
    sprites: {
      hull: { x: 994, y: 164 }, turret: { x: 1001, y: 30 }, barrel: { x: 1432, y: 125 },
      flag: { x: 1274, y: 119, file: 'flag' },
      roadwheel: { r: 256, file: 'roadwheel' }, idler: { file: 'roadwheel', tint: 0.15 },
      sprocket: { file: 'sprocket', R: 0.337, tooth0: 24 },        // 14 teeth (art: 240 : 258 of the road wheel)
    },
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.3625, topRunOnWheels: true,
    suspension: { k: 2.4e5, c: 1.8e4, bump: 0.16, droop: 0.08, bumpK: 4e6, bumpC: 1.0e5 },
    sprocket: { x: L(1067.5, 222.5)[0], y: L(1067.5, 222.5)[1], teeth: 14 },
    idler: { x: L(1507.5, 220)[0], y: L(1507.5, 220)[1], r: 0.275 },
    returnRollers: [],
    track: { pitch: 0.1405, thick: 0.08, width: 0.58, mass: 3000 },
    belly: { y: -0.70, x0: -3.1, x1: 3.3 },
    contactArea: 0.87,
    underside: { x0: -2.55, x1: 2.6, y0: -0.12, y1: -0.80 },
    engine: { type: 'diesel', power: 4.32e5, eff: 0.70, maxTractive: 2.4e5, spool: 0.4,
      vmaxF: 50 / 3.6, vmaxR: 8 / 3.6, brake: 3.6e5, engineBrake: 2.6e4 },
    exhaust: { x: -2.9, y: -0.15 },
    gun: { name: 'D-10T2S 100mm', trunnion: L(1410, 135), muzzle: (1740 - 1410) / PPM,
      elevMax: 17, elevMin: -5, rate: 0.20, recoilLen: 0.55, recoilMass: 1950, reload: 8.5, stabilized: true },
    turretRing: L(1300, 164),
    antennas: [{ x: L(1185, 96)[0], y: L(1185, 96)[1], len: 1.18 }],
    sight: { laser: false, rangeErr: 0.10, aimErr: 0.6, layTime: 5.5 },
    armor: [
      { name: '포탑 전면 상부', part: 'turret', a: L(1380, 100), b: L(1432, 128), t: 200, mat: 'cast', n: 65, h: 0 },
      { name: '포 방패', part: 'turret', a: L(1432, 128), b: L(1432, 148), t: 200, mat: 'cast', n: 0, h: 0 },
      { name: '포탑 전면 하부', part: 'turret', a: L(1432, 148), b: L(1410, 163), t: 200, mat: 'cast', n: -52, h: 0 },
      { name: '포탑 상면', part: 'turret', a: L(1200, 92), b: L(1380, 100), t: 30, mat: 'rha', n: 90, h: 0 },
      { name: '포탑 후면', part: 'turret', a: L(1170, 110), b: L(1165, 163), t: 60, mat: 'cast', n: 180, h: 0 },
      { name: '차체 전면 상부', part: 'hull', a: L(1440, 167), b: L(1552, 200), t: 100, mat: 'rha', n: 60, h: 0 },
      { name: '차체 전면 하부', part: 'hull', a: L(1552, 202), b: L(1525, 225), t: 100, mat: 'rha', n: -55, h: 0 },
      { name: '차체 상면', part: 'hull', a: L(1020, 166), b: L(1440, 167), t: 20, mat: 'rha', n: 90, h: 0 },
      { name: '차체 후면 상부', part: 'hull', a: L(1005, 166), b: L(1005, 200), t: 45, mat: 'rha', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(1525, 225), b: L(1505, 280), t: 20, mat: 'track', n: -45, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(1505, 280), b: L(1065, 280), t: 20, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(1065, 280), b: L(1005, 205), t: 20, mat: 'track', n: -140, h: 0, track: true },
    ],
    sideArmor: { hull: '80 mm', turret: '160 mm', rear: '상부 45 mm, 하부 20 mm' },
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(1480, 185), r: 0.35 },
      { id: 'gunner', name: '포수', type: 'crew', p: L(1300, 138), r: 0.30 },
      { id: 'commander', name: '전차장', type: 'crew', p: L(1240, 125), r: 0.30 },
      { id: 'loader', name: '탄약수', type: 'crew', p: L(1335, 145), r: 0.30 },
      { id: 'gun', name: '주포 약실', type: 'gun', p: L(1365, 135), r: 0.28 },
      { id: 'rack', name: '전방 연료탱크·탄약 랙', type: 'fuel_ammo', p: L(1460, 195), r: 0.40 },
      { id: 'hullammo', name: '차체 탄약', type: 'ammo', p: L(1300, 200), r: 0.45 },
      { id: 'turretammo', name: '포탑 후부 탄약', type: 'ammo', p: L(1185, 138), r: 0.25 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(1085, 182), r: 0.55 },
      { id: 'trans', name: '변속기', type: 'engine', p: L(1030, 190), r: 0.35 },
    ],
  };
})();
