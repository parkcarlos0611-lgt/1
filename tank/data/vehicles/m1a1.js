// M1A1 rig + specs. Units: metres, kg, N, s. Local frame: origin = hull reference (≈ centre of mass),
// x forward, y up. Geometry measured from assets/ref/m1a1_side.png at 149 px/m, origin px (604,900)
// (tools/cut_sprites.py). Spec values are game starting points — see docs/PLAN.md §4.
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 149, OX = 604, OY = 900;
  const L = (px, py) => [(px - OX) / PPM, -(py - OY) / PPM];
  const wheels = [];
  for (let i = 0; i < 7; i++) wheels.push(L(259 + 115 * i, 1020));

  DS.VEHICLES.m1a1 = {
    id: 'm1a1', name: 'M1A1', side: 'US', ammo: ['M829A1', 'M829', 'M830'],
    mass: 57200, inertia: 3.3e5,
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/m1a1/' },
    sprites: {                       // top-left px in the source drawing
      hull:   { x: 14,  y: 838 },
      turret: { x: 38,  y: 626 },
      barrel: { x: 952, y: 766 },
      // running gear sheet (tools/cut_wheels.py): 512 px squares, radius 256 px
      roadwheel: { r: 256, file: 'roadwheel' }, roadwheelFront: { r: 256, file: 'roadwheel_front' },  // front art = idler
      idler: { file: 'roadwheel_front' },
      sprocket: { r: 256, R: 0.38, tooth0: 0 },   // R: tooth-tip radius (m), tooth0: first tooth angle (deg)
    },
    // running gear (per side; physics treats each road-wheel station as the left+right pair)
    roadWheels: wheels.map(p => ({ x: p[0], y: p[1] })),
    wheelR: 0.309,
    suspension: {                    // torsion bar per station (pair of wheels)
      k: 4.0e5,                      // N/m
      c: 3.2e4,                      // N·s/m (rotary dampers)
      bump: 0.30, droop: 0.12,       // jounce / rebound travel from static position (m)
      bumpK: 6e6, bumpC: 1.5e5,      // bump stop
    },
    sprocket: { x: L(135, 970)[0], y: L(135, 970)[1], teeth: 12 },
    idler: { x: L(1100, 965)[0], y: L(1100, 965)[1], r: 0.28 },
    returnRollers: [{ x: -1.75, y: -0.29, r: 0.1 }, { x: 0.55, y: -0.29, r: 0.1 }],
    track: { pitch: 0.181, thick: 0.09, width: 0.635, mass: 7600 },
    belly: { y: -0.70, x0: -3.6, x1: 3.9 },
    contactArea: 0.978,              // m² of track pad per wheel station (both tracks)
    underside: { x0: -3.05, x1: 3.35, y0: -0.52, y1: -0.93 },  // hull side shadow behind the wheels; open gap above the track below it
    rearFill: { x0: -3.42, x1: -2.75, y0: -0.47, y1: -0.06 },  // behind the sprocket (hull art is cut out there)

    engine: {                        // AGT1500 gas turbine
      type: 'turbine', power: 1.119e6, eff: 0.74,
      maxTractive: 4.0e5,            // N, low-gear limit
      spool: 0.9,                    // s, turbine response time constant
      vmaxF: 67 / 3.6, vmaxR: 40 / 3.6,
      brake: 6.0e5, engineBrake: 2.5e4,
    },
    exhaust: { x: -3.98, y: 0.22 },

    gun: {                           // M256 120 mm L/44
      name: 'M256 120mm', trunnion: L(890, 792), boreY: 792,
      muzzle: (1416 - 890) / PPM,    // trunnion → muzzle (m)
      elevMax: 20, elevMin: -10, rate: 0.40,   // deg, deg, rad/s
      recoilLen: 0.30, recoilMass: 2900, reload: 6.5,
      stabilized: true,
    },
    turretRing: L(600, 840),         // turret pivot (also where a tossed turret rotates about)

    // Armour (user data, docs/DATA_SOURCES.md). a/b: plate ends (px in the drawing),
    // t: physical thickness mm, n: outward normal angle in hull frame (deg, 0 = forward, 90 = up),
    // h: built-in horizontal (plan-view) angle, part: hull | turret.
    armor: [
      { name: '포탑 전면', part: 'turret', a: L(905, 752), b: L(950, 812), t: 750, mat: 'm1_comp', n: 0, h: 27 },
      { name: '포탑 전면 하단', part: 'turret', a: L(950, 812), b: L(935, 840), t: 750, mat: 'm1_comp', n: -20, h: 27 },
      { name: '포탑 상면', part: 'turret', a: L(260, 735), b: L(905, 752), t: 50, mat: 'rha', n: 90, h: 0 },
      { name: '포탑 후면(바슬)', part: 'turret', a: L(260, 735), b: L(260, 822), t: 30, mat: 'rha', n: 180, h: 0 },
      { name: '차체 상부 경사판', part: 'hull', a: L(960, 845), b: L(1195, 893), t: 44, mat: 'rha', n: 82, h: 0 },
      { name: '차체 하부 전면', part: 'hull', a: L(1195, 893), b: L(1120, 968), t: 650, mat: 'm1_comp', n: -37, h: 0 },
      { name: '기관실 상면', part: 'hull', a: L(30, 858), b: L(960, 845), t: 30, mat: 'rha', n: 90, h: 0 },
      { name: '차체 후면', part: 'hull', a: L(20, 858), b: L(20, 990), t: 30, mat: 'rha', n: 180, h: 0 },
      { name: '전방 궤도', part: 'hull', a: L(1120, 968), b: L(1095, 1082), t: 25, mat: 'track', n: -50, h: 0, track: true },
      { name: '하부 궤도', part: 'hull', a: L(1095, 1082), b: L(150, 1082), t: 25, mat: 'track', n: -90, h: 0, track: true },
      { name: '후방 궤도', part: 'hull', a: L(150, 1082), b: L(20, 990), t: 25, mat: 'track', n: -140, h: 0, track: true },
    ],
    sideArmor: { hull: '30 mm + 65 mm 스커트', turret: '300–400 mm' },   // recorded; side hits not modelled in 2D yet
    // Internal modules hit by behind-armour debris: x, y (px), r (m)
    modules: [
      { id: 'driver', name: '조종수', type: 'crew', p: L(1040, 885), r: 0.35 },
      { id: 'gunner', name: '포수', type: 'crew', p: L(800, 805), r: 0.30 },
      { id: 'commander', name: '전차장', type: 'crew', p: L(690, 770), r: 0.35 },
      { id: 'loader', name: '탄약수', type: 'crew', p: L(560, 795), r: 0.35 },
      { id: 'gun', name: '주포 약실', type: 'gun', p: L(760, 790), r: 0.30 },
      { id: 'optics', name: '사격통제장치', type: 'optics', p: L(860, 765), r: 0.22 },
      { id: 'bustle', name: '바슬 탄약고', type: 'ammo_bustle', p: L(380, 780), r: 0.55 },
      { id: 'hullammo', name: '차체 탄약', type: 'ammo', p: L(720, 950), r: 0.28 },
      { id: 'fuel', name: '전방 연료탱크', type: 'fuel', p: L(1010, 935), r: 0.40 },
      { id: 'engine', name: '엔진', type: 'engine', p: L(260, 925), r: 0.70 },
      { id: 'trans', name: '변속기', type: 'engine', p: L(100, 935), r: 0.40 },
    ],
    antennas: [{ px: 217, py: 724, len: 1.15 }, { px: 397, py: 727, len: 1.10 }].map(a =>
      ({ x: L(a.px, a.py)[0], y: L(a.px, a.py)[1], len: a.len })),
  };
})();
