// M270 MLRS (US Army, Gulf War). Geometry from assets/ref/m270_sheet.png (right-facing side drawing) at 90 px/m
// (6.9 m long), origin px (1085, 600) (tools/cut_m270.py). Weight, size, engine and speed: user data.
// Running gear as on the real vehicle (Bradley-derived chassis): six road wheels a side, front drive.
// The "gun" is the launcher box: twelve M26 rockets, laid in elevation only (the launcher cannot traverse in
// this side view), fired from the indirect-fire map (src/core/Artillery.js). No direct-fire mode.
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 90, OX = 1085, OY = 600;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [885, 964, 1042, 1121, 1199, 1278].map(x => L(x, 680));
  const RR = (x, y) => ({ x: L(x, y)[0], y: L(x, y)[1], r: 0.09 });
  DS.VEHICLES.m270 = {
    id: 'm270', name: 'M270 MLRS', side: 'US', ammo: ['M26'], howitzer: true, indirectOnly: true,
    mass: 24950, inertia: 9.5e4, frontDrive: true,
    signature: 0.9,
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/m270/' },
    sprites: {
      hull: { x: 759, y: 485 }, turret: { x: 880, y: 600 }, barrel: { x: 760, y: 473 },
      roadwheel: { r: 256, file: 'roadwheel' }, idler: { file: 'idler' },
      sprocket: { file: 'sprocket', R: 0.29, tooth0: 17.75 },       // 13 teeth
    },
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.30,
    suspension: { k: 2.4e5, c: 1.9e4, bump: 0.25, droop: 0.10, bumpK: 4e6, bumpC: 1.0e5 },
    sprocket: { x: L(1338, 658)[0], y: L(1338, 658)[1], teeth: 13 },
    idler: { x: L(826, 658)[0], y: L(826, 658)[1], r: 0.24 },
    returnRollers: [RR(960, 648), RR(1120, 648), RR(1240, 648)],
    track: { pitch: 0.125, thick: 0.07, width: 0.53, mass: 2400 },
    belly: { y: -0.72, x0: L(800, 0)[0], x1: L(1370, 0)[0] },
    contactArea: 0.6,
    underside: { x0: -3.2, x1: 3.2, y0: -0.44, y1: -0.92,
      poly: [[L(772, 0)[0], -0.44], [L(1392, 0)[0], -0.44], [L(1388, 0)[0], -0.6], [L(1320, 0)[0], -0.92], [L(850, 0)[0], -0.92], [L(778, 0)[0], -0.62]] },
    engine: { type: 'diesel', power: 3.73e5, eff: 0.72, maxTractive: 1.9e5, spool: 0.35,      // Cummins VTA-903T, 500 hp
      vmaxF: 64 / 3.6, vmaxR: 12 / 3.6, brake: 2.8e5, engineBrake: 2.0e4 },
    exhaust: { x: L(1180, 560)[0], y: L(1180, 560)[1] },
    gun: { name: 'M269 발사기', trunnion: L(800, 590), muzzle: (1068 - 800) / PPM,
      elevMax: 60, elevMin: 0, rate: 0.14, recoilLen: 0.1, recoilMass: 5000, reload: 4.5, stabilized: false,
      pod: 12, podReload: 90, launcher: true },             // twelve rockets, then the pods are changed
    turretRing: L(940, 600),
    antennas: [{ x: L(1135, 537)[0], y: L(1135, 537)[1], len: 0.95 }, { x: L(1198, 520)[0], y: L(1198, 520)[1], len: 0.75 }],
    sight: { laser: false, manual: true, name: 'FCS', crew: 0.8, rangeErr: 0.1, aimErr: 3, layTime: 8, detectMax: 2000, engageMax: 0 },
    armor: [
      { name: '운전실 전면', part: 'hull', a: L(1300, 490), b: L(1396, 600), t: 25, mat: 'alu', n: 35, h: 0 },
      { name: '운전실 상면', part: 'hull', a: L(1090, 488), b: L(1300, 490), t: 20, mat: 'alu', n: 90, h: 0 },
      { name: '차체 전면 하부', part: 'hull', a: L(1396, 600), b: L(1372, 648), t: 25, mat: 'alu', n: -45, h: 0 },
      { name: '발사기 상면', part: 'turret', a: L(770, 476), b: L(1090, 480), t: 12, mat: 'alu', n: 90, h: 0 },
      { name: '발사기 후면', part: 'hull', a: L(764, 478), b: L(764, 640), t: 12, mat: 'alu', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(1384, 648), b: L(1320, 712), t: 20, mat: 'track', n: -45, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(1320, 712), b: L(850, 712), t: 20, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(850, 712), b: L(790, 648), t: 20, mat: 'track', n: -140, h: 0, track: true },
    ],
    sideArmor: { hull: '알루미늄 (소화기·파편 방호)' },
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(1320, 560), r: 0.32 },
      { id: 'gunner', name: '사수', type: 'crew', p: L(1270, 555), r: 0.30 },
      { id: 'commander', name: '사격반장', type: 'crew', p: L(1225, 555), r: 0.30 },
      { id: 'gun', name: '발사기 구동부', type: 'gun', p: L(1080, 560), r: 0.30 },
      { id: 'rockets', name: '로켓 포드', type: 'ammo', p: L(920, 530), r: 0.7 },
      { id: 'fuel', name: '연료탱크', type: 'fuel', p: L(900, 625), r: 0.30 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(1160, 590), r: 0.50 },
      { id: 'trans', name: '변속기', type: 'engine', p: L(1340, 625), r: 0.30 },
    ],
  };
})();
