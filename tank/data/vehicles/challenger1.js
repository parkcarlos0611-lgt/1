// Challenger 1 Mk.3 (British Army, Op Granby): Gulf War up-armoured fit (add-on hull and side armour packs).
// Geometry from assets/ref/challenger1_sheet.png (right-side profile, facing right) at 79 px/m (hull 8.3 m),
// origin px (384, 487) at the turret ring (tools/cut_new4.py). Figures are public estimates, provisional.
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 79, OX = 384, OY = 487;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [211.7, 291.7, 371.7, 451.3, 531.3, 606].map(x => L(x, 576));
  DS.VEHICLES.challenger1 = {
    id: 'challenger1', name: '챌린저 1 Mk.3', side: 'US', nation: 'UK', ammo: ['L26', 'L31'],
    mass: 62500, inertia: 3.3e5, signature: 1.15,
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/challenger1/' },
    sprites: {
      hull: { x: 36, y: 470 }, turret: { x: 118, y: 380 }, barrel: { x: 572, y: 448 }, under: { x: 126, y: 551 },
      roadwheel: { r: 256, file: 'roadwheel' }, idler: { file: 'idler' },
      sprocket: { file: 'sprocket', R: 0.3, tooth0: 0 },
    },
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.38, topRunOnWheels: true,
    suspension: { k: 4.6e5, c: 3.6e4, bump: 0.25, droop: 0.12, bumpK: 6e6, bumpC: 1.5e5 },     // hydrogas
    sprocket: { x: L(125, 552)[0], y: L(125, 552)[1], teeth: 11 },
    idler: { x: L(690, 551)[0], y: L(690, 551)[1], r: 0.27 },
    returnRollers: [],
    track: { pitch: 0.16, thick: 0.08, width: 0.65, mass: 5500 },
    belly: { y: -1.0, x0: L(70, 0)[0], x1: L(690, 0)[0] },
    contactArea: 1.0, footHalf: 0.53,          // wheels about 1.1 m apart: each presses the ground to the next
    // dark hull side behind the running gear, down to the bottom track run (as on the sheet)
    underside: { x0: -3.9, x1: 3.9, y0: -0.6, y1: -1.41,
      poly: [[L(60, 0)[0], -0.55], [L(700, 0)[0], -0.55], [L(695, 0)[0], -0.8], [L(670, 0)[0], -1.1], [L(625, 0)[0], -1.41], [L(175, 0)[0], -1.41], [L(115, 0)[0], -1.1], [L(70, 0)[0], -0.8]] },
    engine: { type: 'diesel', power: 8.95e5, eff: 0.72, maxTractive: 4.6e5, spool: 0.5,     // Rolls-Royce CV12, 1,200 hp
      vmaxF: 56 / 3.6, vmaxR: 13 / 3.6, brake: 6.4e5, engineBrake: 3.2e4 },
    exhaust: { x: L(60, 500)[0], y: L(60, 500)[1] },
    gun: { name: 'L11A5 120mm', trunnion: L(548, 467), muzzle: (905 - 548) / PPM,
      elevMax: 20, elevMin: -10, rate: 0.32, recoilLen: 0.37, recoilMass: 2600, reload: 7.5, stabilized: true, stab: 0.9 },
    coax: { name: 'L8A2 7.62mm 동축', ammo: 'M240_762', muzzle: L(560, 476), rate: 750 / 60, rounds: 4000, spread: 0.7 },
    turretRing: L(380, 487),
    sight: { laser: true, thermal: true, tis: [500, 300], name: 'TOGS', crew: 1.0, rangeErr: 0.006, aimErr: 0.2, layTime: 2.5, detectMax: 4000, identMax: 2800, engageMax: 3000 },
    armor: [
      { name: '포탑 전면 상부 (초밤)', part: 'turret', a: L(470, 412), b: L(548, 440), t: 600, mat: 'm1_comp', n: 65, h: 0 },
      { name: '포탑 전면 (포 방패)', part: 'turret', a: L(548, 440), b: L(548, 487), t: 600, mat: 'm1_comp', n: 0, h: 0 },
      { name: '포탑 상면', part: 'turret', a: L(200, 405), b: L(470, 412), t: 40, mat: 'rha', n: 90, h: 0 },
      { name: '포탑 후면', part: 'turret', a: L(118, 410), b: L(118, 487), t: 60, mat: 'rha', n: 180, h: 0 },
      { name: '차체 전면 상부 (초밤)', part: 'hull', a: L(600, 490), b: L(712, 525), t: 500, mat: 'm1_comp', n: 70, h: 0 },
      { name: '차체 전면 하부', part: 'hull', a: L(712, 525), b: L(690, 560), t: 120, mat: 'rha', n: -50, h: 0 },
      { name: '차체 상면', part: 'hull', a: L(150, 490), b: L(600, 490), t: 30, mat: 'rha', n: 90, h: 0 },
      { name: '차체 후면', part: 'hull', a: L(40, 495), b: L(40, 545), t: 40, mat: 'rha', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(700, 556), b: L(640, 608), t: 20, mat: 'track', n: -45, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(640, 610), b: L(150, 610), t: 20, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(150, 610), b: L(60, 545), t: 20, mat: 'track', n: -140, h: 0, track: true },
    ],
    sideArmor: { hull: '추가 장갑 팩 (걸프전)' },
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(640, 515), r: 0.35 },
      { id: 'gunner', name: '포수', type: 'crew', p: L(470, 450), r: 0.30 },
      { id: 'commander', name: '전차장', type: 'crew', p: L(400, 430), r: 0.30 },
      { id: 'loader', name: '탄약수', type: 'crew', p: L(320, 450), r: 0.30 },
      { id: 'gun', name: '주포 약실', type: 'gun', p: L(490, 467), r: 0.28 },
      { id: 'hullammo', name: '차체 탄약 (장약 수납고)', type: 'ammo', p: L(470, 525), r: 0.4 },
      { id: 'fuel', name: '연료탱크', type: 'fuel', p: L(560, 525), r: 0.35 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(150, 520), r: 0.6 },
      { id: 'trans', name: '변속기', type: 'engine', p: L(80, 530), r: 0.35 },
    ],
  };
})();
