// M2A2 Bradley IFV. Geometry from the right-side drawing of assets/ref/m2a2_views.png (crop origin 900,0)
// at 114 px/m (hull 6.55 m), origin px (390, 300). tools/cut_bradley.py cuts the layers.
// Specs and weapon data: user data (docs/DATA_SOURCES.md). Armour plates are game values built on the stated
// protection level (30 mm APDS / RPG-7 all round). Drive sprocket at the FRONT, idler at the rear.
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 114, OX = 390, OY = 300;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [177.5, 259, 340, 441, 524, 605].map(x => L(x, 398.5));
  DS.VEHICLES.m2a2 = {
    id: 'm2a2', name: 'M2A2 브래들리', side: 'US', ammo: ['M791', 'M792'],
    mass: 29000, inertia: 1.0e5, frontDrive: true,
    signature: 0.5,                  // half as easy to pick out as a tank: smaller, lower, kept behind the M1A1
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/m2a2/' },
    sprites: {
      hull: { x: 12, y: 188 }, turret: { x: 173, y: 92 }, barrel: { x: 447, y: 159 },
      tow: { x: 259, y: 144, file: 'tow' },   // from the left-side drawing; sits behind the turret in this view
      roadwheel: { r: 256, file: 'roadwheel' }, idler: { file: 'idler' },
      sprocket: { file: 'sprocket', R: 0.30, tooth0: 7 },          // 13 teeth
    },
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.285,
    suspension: { k: 1.8e5, c: 1.5e4, bump: 0.25, droop: 0.10, bumpK: 3e6, bumpC: 8e4 },
    sprocket: { x: L(718, 368)[0], y: L(718, 368)[1], teeth: 13 },
    idler: { x: L(78, 368)[0], y: L(78, 368)[1], r: 0.22 },
    returnRollers: [{ x: -1.5, y: -0.47, r: 0.08 }, { x: 0, y: -0.47, r: 0.08 }, { x: 1.6, y: -0.47, r: 0.08 }],
    track: { pitch: 0.125, thick: 0.07, width: 0.533, mass: 2400 },
    belly: { y: -0.66, x0: -3.0, x1: 2.9 },
    contactArea: 0.7,
    underside: { x0: -2.9, x1: 3.0, y0: -0.3, y1: -0.9,
      poly: [[-3.0, -0.3], [3.2, -0.3], [3.2, -0.5], [2.8, -0.88], [-2.6, -0.88], [-3.0, -0.55]] },
    engine: { type: 'diesel', power: 4.47e5, eff: 0.72, maxTractive: 2.0e5, spool: 0.35,
      vmaxF: 61 / 3.6, vmaxR: 16 / 3.6, brake: 3.2e5, engineBrake: 2.2e4 },
    exhaust: { x: L(600, 212)[0], y: L(600, 212)[1] },
    gun: { name: 'M242 25mm', trunnion: L(425, 170), muzzle: (614 - 425) / PPM,
      elevMax: 60, elevMin: -10, rate: 1.0, recoilLen: 0.04, recoilMass: 110, reload: 0.3,   // 200 rounds/min
      recoilK: 6400, recoilC: 140, stabilized: true },
    coax: { name: 'M240C 7.62mm 동축', ammo: 'M240_762', muzzle: L(452, 178), rate: 750 / 60, rounds: 2200, spread: 0.7 },
    // twin TOW launcher on the far (left) side of the turret: hidden behind it when stowed; raised, its top
    // shows over the roof and the hidden part is drawn as an X-ray outline. Pivots at its rear lower corner.
    tow: { ammo: 'TOW2', c: L(324, 172), pivotPx: [259, 200], len: 1.25, h: 0.46, lift: 0.42, loaded: 2, reserve: 5, reloadTime: 25, raise: 1.2, range: 3750 },
    turretRing: L(310, 200),
    antennas: [{ x: L(189, 140)[0], y: L(189, 140)[1], len: 1.15 }, { x: L(93, 188)[0], y: L(93, 188)[1], len: 1.3 }],
    sight: { laser: true, thermal: true, rangeErr: 0.005, aimErr: 0.15, layTime: 2.5, detectMax: 4000, engageMax: 3500 },
    armor: [
      { name: '포탑 전면', part: 'turret', a: L(447, 148), b: L(450, 197), t: 55, mat: 'rha', n: 0, h: 20 },
      { name: '포탑 상면', part: 'turret', a: L(176, 132), b: L(447, 146), t: 20, mat: 'rha', n: 90, h: 0 },
      { name: '포탑 후면', part: 'turret', a: L(176, 132), b: L(176, 198), t: 30, mat: 'rha', n: 180, h: 0 },
      { name: '차체 상부 경사판', part: 'hull', a: L(470, 214), b: L(757, 306), t: 30, mat: 'rha', n: 72, h: 0 },
      { name: '차체 하부 전면', part: 'hull', a: L(757, 306), b: L(705, 360), t: 45, mat: 'rha', n: -40, h: 0 },
      { name: '차체 상면', part: 'hull', a: L(16, 196), b: L(470, 214), t: 20, mat: 'rha', n: 90, h: 0 },
      { name: '차체 후면 램프', part: 'hull', a: L(12, 198), b: L(12, 330), t: 30, mat: 'rha', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(705, 360), b: L(690, 438), t: 15, mat: 'track', n: -45, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(690, 438), b: L(95, 438), t: 15, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(95, 438), b: L(12, 330), t: 15, mat: 'track', n: -140, h: 0, track: true },
    ],
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(560, 255), r: 0.35 },
      { id: 'gunner', name: '포수', type: 'crew', p: L(345, 188), r: 0.30 },
      { id: 'commander', name: '차장', type: 'crew', p: L(285, 178), r: 0.30 },
      { id: 'gun', name: '기관포', type: 'gun', p: L(410, 172), r: 0.22 },
      { id: 'towl', name: 'TOW 발사관', type: 'tow', p: L(324, 172), r: 0.32 },
      { id: 'ammo25', name: '25 mm 탄약', type: 'ammo', p: L(320, 255), r: 0.35 },
      { id: 'towstow', name: 'TOW 예비탄', type: 'ammo', p: L(150, 285), r: 0.35 },
      { id: 'fuel', name: '연료탱크', type: 'fuel', p: L(240, 315), r: 0.32 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(645, 285), r: 0.50 },
      { id: 'trans', name: '변속기', type: 'engine', p: L(715, 310), r: 0.28 },
    ],
  };
})();
