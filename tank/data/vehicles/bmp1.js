// BMP-1 (Iraqi). Geometry from assets/ref/bmp1_sheet.png (right-side profile, facing right) at 118 px/m
// (hull 6.75 m), origin px (474, 448) at the turret ring (tools/cut_new4.py). 73 mm 2A28 low-pressure gun
// (PG-15V rocket-assisted HEAT), 9M14 Malyutka on the rail over it (manual command guidance: the gunner flies
// it onto the target; it uses the wire-guided missile system with its own slow speed), front drive, thin
// steel armour, rear doors that are fuel tanks. Figures are public estimates, provisional.
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 118, OX = 474, OY = 448;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [245, 327.5, 412.5, 495, 580, 662.5].map(x => L(x, 565));
  DS.VEHICLES.bmp1 = {
    id: 'bmp1', name: 'BMP-1', side: 'IQ', ammo: ['PG15V'], frontDrive: true,
    mass: 13300, inertia: 4.6e4, signature: 0.8,
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/bmp1/' },
    sprites: {
      hull: { x: 76, y: 380 }, turret: { x: 312, y: 387 }, barrel: { x: 470, y: 422 },
      roadwheel: { r: 256, file: 'roadwheel' }, idler: { file: 'idler' },
      sprocket: { file: 'sprocket', R: 0.28, tooth0: 0 },
    },
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.275, topRunOnWheels: true,
    suspension: { k: 1.4e5, c: 1.1e4, bump: 0.2, droop: 0.1, bumpK: 2.5e6, bumpC: 6e4 },
    sprocket: { x: L(745, 542)[0], y: L(745, 542)[1], teeth: 12 },
    idler: { x: L(155, 542)[0], y: L(155, 542)[1], r: 0.26 },
    returnRollers: [],
    track: { pitch: 0.14, thick: 0.06, width: 0.3, mass: 1600 },
    belly: { y: -0.88, x0: L(110, 0)[0], x1: L(820, 0)[0] },
    contactArea: 0.6,
    // dark hull side behind the running gear, down to the bottom track run (as on the sheet)
    underside: { x0: -3.3, x1: 3.3, y0: -0.6, y1: -1.19,
      poly: [[L(85, 0)[0], -0.6], [L(840, 0)[0], -0.6], [L(800, 0)[0], -0.8], [L(760, 0)[0], -1.0], [L(700, 0)[0], -1.19], [L(205, 0)[0], -1.19], [L(145, 0)[0], -1.0], [L(100, 0)[0], -0.8]] },
    engine: { type: 'diesel', power: 2.24e5, eff: 0.7, maxTractive: 1.1e5, spool: 0.4,       // UTD-20, 300 hp
      vmaxF: 65 / 3.6, vmaxR: 10 / 3.6, brake: 1.5e5, engineBrake: 1.2e4 },
    exhaust: { x: L(760, 470)[0], y: L(760, 470)[1] },
    gun: { name: '2A28 73mm', trunnion: L(470, 430), muzzle: (710 - 470) / PPM,
      elevMax: 33, elevMin: -4, rate: 0.3, recoilLen: 0.2, recoilMass: 450, reload: 8, stabilized: false, stab: 0 },
    coax: { name: 'PKT 7.62mm 동축', ammo: 'M240_762', muzzle: L(480, 438), rate: 700 / 60, rounds: 2000, spread: 0.8 },
    // 9M14 Malyutka: one on the rail, three more inside (loaded through a hatch, so slowly)
    tow: { ammo: 'AT3', label: '말류트카', c: L(440, 397), pivotPx: [440, 397], len: 0.86, h: 0.12, lift: 0, loaded: 1, reserve: 3, reloadTime: 50, raise: 0.4, range: 3000, minRange: 500, gunFallback: true },
    turretRing: L(390, 448),
    sight: { laser: false, manual: true, name: '1PN22M1', rangeErr: 0.15, aimErr: 5.0, layTime: 7, detectMax: 2000, engageMax: 1300 },
    armor: [
      { name: '포탑 전면', part: 'turret', a: L(450, 405), b: L(470, 445), t: 23, mat: 'rha', n: 40, h: 0 },
      { name: '포탑 상면', part: 'turret', a: L(330, 405), b: L(450, 405), t: 10, mat: 'rha', n: 90, h: 0 },
      { name: '포탑 후면', part: 'turret', a: L(315, 415), b: L(315, 447), t: 13, mat: 'rha', n: 180, h: 0 },
      { name: '차체 전면 상부', part: 'hull', a: L(640, 455), b: L(865, 495), t: 7, mat: 'rha', n: 78, h: 0 },
      { name: '차체 전면 하부', part: 'hull', a: L(865, 497), b: L(800, 528), t: 19, mat: 'rha', n: -55, h: 0 },
      { name: '차체 상면', part: 'hull', a: L(90, 450), b: L(640, 455), t: 6, mat: 'rha', n: 90, h: 0 },
      { name: '차체 후면 (연료탱크 문)', part: 'hull', a: L(78, 455), b: L(78, 525), t: 16, mat: 'rha', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(800, 528), b: L(740, 600), t: 15, mat: 'track', n: -45, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(740, 602), b: L(170, 602), t: 15, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(170, 602), b: L(85, 530), t: 15, mat: 'track', n: -140, h: 0, track: true },
    ],
    sideArmor: { hull: '16–18 mm' },
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(700, 470), r: 0.30 },
      { id: 'commander', name: '차장', type: 'crew', p: L(640, 462), r: 0.30 },
      { id: 'gunner', name: '포수', type: 'crew', p: L(400, 430), r: 0.30 },
      { id: 'gun', name: '73 mm 포', type: 'gun', p: L(455, 430), r: 0.22 },
      { id: 'ammo', name: '73 mm 탄약 (자동장전 고리)', type: 'ammo', p: L(390, 475), r: 0.35 },
      { id: 'fuel', name: '후방 문 연료탱크', type: 'fuel', p: L(110, 490), r: 0.35 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(760, 490), r: 0.40 },
    ],
  };
})();
