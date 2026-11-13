// M109A3 155 mm self-propelled howitzer. Geometry from assets/ref/m109a3_sheet.jpg (right-facing side drawing)
// at 98 px/m (hull 6.19 m), origin px (2100, 262) (tools/cut_m109.py). Running gear as on the real vehicle:
// seven small road wheels (0.61 m) a side, no return rollers — the drawing's six larger wheels are not used.
// Ranges and shell data: user data (docs/DATA_SOURCES.md); the rest are public estimates, provisional.
// Two ways to shoot: direct (telescope, range scale set by hand) and indirect (src/core/Artillery.js: target
// picked on the map, charge and elevation computed, gun laid by hand or automatically).
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 98, OX = 2100, OY = 262;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [1902, 1967, 2032, 2097, 2162, 2227, 2292].map(x => L(x, 362.5));
  DS.VEHICLES.m109a3 = {
    id: 'm109a3', name: 'M109A3', side: 'US', ammo: ['M107', 'M549A1'], howitzer: true,
    mass: 24900, inertia: 9.0e4, frontDrive: true,
    signature: 0.9,
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/m109a3/' },
    sprites: {
      hull: { x: 1798, y: 228 }, turret: { x: 1789, y: 64 }, barrel: { x: 2169, y: 149 },
      roadwheel: { r: 256, file: 'roadwheel' }, idler: { file: 'idler' },
      sprocket: { file: 'sprocket', R: 0.27, tooth0: 24 },         // 14 teeth
    },
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.305, topRunOnWheels: true,                             // no return rollers: the top run rides on the wheels
    suspension: { k: 2.3e5, c: 1.8e4, bump: 0.20, droop: 0.10, bumpK: 4e6, bumpC: 1.0e5 },
    sprocket: { x: L(2365, 330)[0], y: L(2365, 330)[1], teeth: 14 },
    idler: { x: L(1840, 336)[0], y: L(1840, 336)[1], r: 0.25 },
    returnRollers: [],
    track: { pitch: 0.118, thick: 0.065, width: 0.38, mass: 1700 },
    belly: { y: -0.8, x0: L(1840, 0)[0], x1: L(2380, 0)[0] },
    contactArea: 0.47,
    underside: { x0: -3.0, x1: 3.1, y0: -0.38, y1: -1.1,
      poly: [[L(1800, 0)[0], -0.38], [L(2408, 0)[0], -0.38], [L(2402, 0)[0], -0.62], [L(2330, 0)[0], -1.1], [L(1880, 0)[0], -1.1], [L(1806, 0)[0], -0.72]] },
    engine: { type: 'diesel', power: 3.02e5, eff: 0.72, maxTractive: 1.7e5, spool: 0.4,       // 8V71T, 405 hp
      vmaxF: 56 / 3.6, vmaxR: 10 / 3.6, brake: 2.6e5, engineBrake: 2.0e4 },
    exhaust: { x: L(2290, 232)[0], y: L(2290, 232)[1] },
    gun: { name: 'M185 155mm', trunnion: L(2150, 180), muzzle: (2560 - 2150) / PPM,
      elevMax: 75, elevMin: -3, rate: 0.19, recoilLen: 0.9, recoilMass: 2600, reload: 18, stabilized: false,
      // bagged charges → muzzle velocity (m/s); maximum ranges with the M107 come out at about
      // 4.0 / 4.9 / 6.4 / 7.9 / 9.9 / 12.4 / 15.1 / 18.1 km (tools/artybench.js)
      charges: [{ n: '1호', v0: 210 }, { n: '2호', v0: 235 }, { n: '3호', v0: 275 }, { n: '4호', v0: 315 }, { n: '5호', v0: 375 }, { n: '6호', v0: 465 }, { n: '7호', v0: 565 }, { n: '8호', v0: 684 }],
      directCharge: 6 },
    turretRing: L(2000, 228),
    antennas: [{ x: L(1813, 130)[0], y: L(1813, 130)[1], len: 1.3 }, { x: L(1912, 115)[0], y: L(1912, 115)[1], len: 1.2 }],
    sight: { laser: false, manual: true, name: 'M118C', crew: 0.9, rangeErr: 0.10, aimErr: 3.0, layTime: 8, detectMax: 2200, engageMax: 1500 },
    // aluminium armour all round, about 32 mm: proof against splinters and small arms only
    armor: [
      { name: '포탑 전면', part: 'turret', a: L(2172, 128), b: L(2172, 228), t: 32, mat: 'alu', n: 0, h: 0 },
      { name: '포탑 상면', part: 'turret', a: L(1800, 130), b: L(2172, 128), t: 32, mat: 'alu', n: 90, h: 0 },
      { name: '포탑 후면', part: 'turret', a: L(1792, 132), b: L(1792, 228), t: 32, mat: 'alu', n: 180, h: 0 },
      { name: '차체 전면 상부', part: 'hull', a: L(2172, 230), b: L(2408, 292), t: 32, mat: 'alu', n: 62, h: 0 },
      { name: '차체 전면 하부', part: 'hull', a: L(2408, 292), b: L(2382, 330), t: 32, mat: 'alu', n: -50, h: 0 },
      { name: '차체 후면', part: 'hull', a: L(1800, 230), b: L(1800, 302), t: 32, mat: 'alu', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(2396, 330), b: L(2330, 398), t: 20, mat: 'track', n: -45, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(2330, 398), b: L(1870, 398), t: 20, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(1870, 398), b: L(1808, 330), t: 20, mat: 'track', n: -140, h: 0, track: true },
    ],
    sideArmor: { hull: '약 32 mm (알루미늄)' },
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(2250, 262), r: 0.35 },
      { id: 'gunner', name: '포수', type: 'crew', p: L(2085, 190), r: 0.30 },
      { id: 'commander', name: '포반장', type: 'crew', p: L(2010, 150), r: 0.30 },
      { id: 'loader', name: '탄약수', type: 'crew', p: L(1950, 195), r: 0.30 },
      { id: 'gun', name: '포 약실', type: 'gun', p: L(2110, 180), r: 0.30 },
      { id: 'turretammo', name: '포탑 후부 탄약·장약', type: 'ammo', p: L(1860, 190), r: 0.45 },
      { id: 'fuel', name: '연료탱크', type: 'fuel', p: L(1850, 268), r: 0.36 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(2320, 268), r: 0.50 },
      { id: 'trans', name: '변속기', type: 'engine', p: L(2385, 292), r: 0.30 },
    ],
  };
})();
