// 2S1 Gvozdika (Iraqi), 122 mm self-propelled howitzer. Geometry from assets/ref/2s1_sheet.png (right-side
// profile, facing right) at 99 px/m (hull 7.3 m), origin px (444, 494) at the turret ring (tools/cut_new4.py).
// 2A31 howitzer, OF-462 HE: charges set the muzzle velocity, full charge about 15 km. Front drive, thin armour.
// In the Kuwait mission a battery fires on what the Iraqi crews report (src/ai/ArtyAI.js).
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 99, OX = 444, OY = 494;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [220, 292.5, 365, 437.5, 509, 579, 650].map(x => L(x, 595));
  DS.VEHICLES['2s1'] = {
    id: '2s1', name: '2S1 그보즈지카', side: 'IQ', ammo: ['OF462'], howitzer: true, frontDrive: true,
    mass: 16000, inertia: 6.5e4, signature: 0.9,
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/2s1/' },
    sprites: {
      hull: { x: 77, y: 486 }, turret: { x: 150, y: 390 }, barrel: { x: 518, y: 452 },
      roadwheel: { r: 256, file: 'roadwheel' }, idler: { file: 'idler' },
      sprocket: { file: 'sprocket', R: 0.34, tooth0: 0 },
    },
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.33, topRunOnWheels: true,
    suspension: { k: 1.6e5, c: 1.3e4, bump: 0.2, droop: 0.1, bumpK: 2.5e6, bumpC: 6e4 },
    sprocket: { x: L(717, 567)[0], y: L(717, 567)[1], teeth: 14 },
    idler: { x: L(140, 570)[0], y: L(140, 570)[1], r: 0.36 },
    returnRollers: [],
    track: { pitch: 0.14, thick: 0.06, width: 0.4, mass: 1900 },
    belly: { y: -0.95, x0: L(110, 0)[0], x1: L(780, 0)[0] },
    contactArea: 0.65,
    underside: { x0: -3.6, x1: 3.6, y0: -0.6, y1: -1.02,
      poly: [[L(85, 0)[0], -0.62], [L(800, 0)[0], -0.62], [L(770, 0)[0], -0.85], [L(700, 0)[0], -1.02], [L(160, 0)[0], -1.02], [L(95, 0)[0], -0.85]] },
    engine: { type: 'diesel', power: 2.24e5, eff: 0.7, maxTractive: 1.2e5, spool: 0.4,       // YaMZ-238N, 300 hp
      vmaxF: 60 / 3.6, vmaxR: 10 / 3.6, brake: 1.7e5, engineBrake: 1.3e4 },
    exhaust: { x: L(720, 500)[0], y: L(720, 500)[1] },
    gun: { name: '2A31 122mm', trunnion: L(470, 470), muzzle: (874 - 470) / PPM,
      elevMax: 70, elevMin: -3, rate: 0.2, recoilLen: 0.7, recoilMass: 1100, reload: 12, stabilized: false, stab: 0,
      // charges → muzzle velocity (m/s); full charge reaches about 15 km
      charges: [{ n: '4호', v0: 276 }, { n: '3호', v0: 338 }, { n: '2호', v0: 405 }, { n: '1호', v0: 472 }, { n: '감장', v0: 565 }, { n: '전장', v0: 690 }],
      directCharge: 5 },
    turretRing: L(330, 494),
    sight: { laser: false, manual: true, name: 'PG-2', crew: 0.8, rangeErr: 0.12, aimErr: 3.5, layTime: 9, detectMax: 2000, engageMax: 1200 },
    armor: [
      { name: '포탑 전면', part: 'turret', a: L(500, 430), b: L(520, 494), t: 20, mat: 'rha', n: 15, h: 0 },
      { name: '포탑 상면', part: 'turret', a: L(170, 410), b: L(500, 425), t: 15, mat: 'rha', n: 90, h: 0 },
      { name: '포탑 후면', part: 'turret', a: L(152, 440), b: L(152, 494), t: 15, mat: 'rha', n: 180, h: 0 },
      { name: '차체 전면 상부', part: 'hull', a: L(700, 500), b: L(810, 530), t: 15, mat: 'rha', n: 70, h: 0 },
      { name: '차체 전면 하부', part: 'hull', a: L(810, 530), b: L(760, 556), t: 20, mat: 'rha', n: -50, h: 0 },
      { name: '차체 상면', part: 'hull', a: L(90, 496), b: L(700, 500), t: 10, mat: 'rha', n: 90, h: 0 },
      { name: '차체 후면', part: 'hull', a: L(80, 500), b: L(80, 556), t: 15, mat: 'rha', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(760, 556), b: L(700, 628), t: 15, mat: 'track', n: -45, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(700, 630), b: L(160, 630), t: 15, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(160, 630), b: L(90, 556), t: 15, mat: 'track', n: -140, h: 0, track: true },
    ],
    sideArmor: { hull: '약 15 mm' },
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(720, 515), r: 0.32 },
      { id: 'gunner', name: '포수', type: 'crew', p: L(420, 460), r: 0.30 },
      { id: 'commander', name: '포반장', type: 'crew', p: L(330, 440), r: 0.30 },
      { id: 'loader', name: '탄약수', type: 'crew', p: L(250, 460), r: 0.30 },
      { id: 'gun', name: '포 약실', type: 'gun', p: L(450, 470), r: 0.28 },
      { id: 'ammo', name: '122 mm 탄약·장약', type: 'ammo', p: L(220, 520), r: 0.40 },
      { id: 'fuel', name: '연료탱크', type: 'fuel', p: L(300, 525), r: 0.32 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(690, 520), r: 0.45 },
    ],
  };
})();
