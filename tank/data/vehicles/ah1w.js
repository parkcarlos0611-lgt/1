// AH-1W SuperCobra (US Marine Corps, Gulf War). Geometry from assets/ref/ah1w_sheet.png ("PYLONS INSTALLED"
// side drawing, mirrored to face right) at 81.7 px/m (rotor radius 7.32 m), origin px (652, 690) under the mast
// (tools/cut_ah1w.py). Armament: user data — M197 20 mm three-barrel gun, 750 rounds; two 19-tube Hydra pods;
// eight Hellfires, four on each stub wing. Flight figures are public estimates, provisional. Flown by
// src/vehicle/Heli.js like the AH-64A; skids instead of wheels.
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 81.7, OX = 652, OY = 690;
  const L = (px, py) => [-(px - OX) / PPM, -(py - OY) / PPM];     // drawing faces left; local x forward
  DS.VEHICLES.ah1w = {
    id: 'ah1w', name: 'AH-1W 슈퍼코브라', side: 'US', heli: true, ammo: ['M56'],
    mass: 6690, inertia: 4.5e4, signature: 1.0, thin: 3,
    // protection by side (user decision): from ahead 12.7 mm does nothing and 20 mm gets through half the time;
    // from behind or below 12.7 mm gets through half the time (src/ballistics/Armor.js)
    proof: { front: 0.0135, frontPart: 0.0205, rearPart: 0.0135 },
    // boxes of the cut pieces in the sheet [x, y, w, h] (tools/cut_ah1w.py → cut.json)
    src: { ppm: PPM, origin: [OX, OY], ox: 222, oy: 529, w: 1160, h: 312, dir: 'assets/sprites/ah1w/',
      rotor: [52, 490, 1198, 82], rotorAxis: 652, tailrotor: [1269, 432, 157, 225], tailHub: [1350, 545],
      gun: [176, 757, 110, 29], gunPivot: [296, 768],
      hf: { up: [659, 748, 123, 23], lo: [657, 776, 126, 20] } },
    flight: {
      vmax: 78, tilt: 26, climb: 11, sink: 9, gearH: 1.66,          // 282 km/h; origin above the skids
      hub: L(652, 512), rotorR: 7.32, tail: L(1350, 545), tailR: 1.49,
      wheels: [], blades: 2, beat: 0.12,                            // two-blade rotor: the slower, heavier "whop"
    },
    gun: { name: 'M197 20mm', short: '20mm', trunnion: L(296, 768), muzzle: 1.47, elevMax: 18, elevMin: -50, rate: 1.4, reload: 60 / 650,
      recoilLen: 0.05, recoilMass: 60, rounds: 750, spread: 2.6 },
    rockets: { ammo: 'HYDRA', n: 38, at: L(572, 765), interval: 0.16 },           // two 19-tube pods
    hellfire: { ammo: 'HELLFIRE', n: 8, at: L(720, 770), interval: 1.2, range: 8000 },
    sightAt: L(240, 715),                                                         // nose sight turret
    turretRing: L(640, 640), exhaust: { x: L(900, 640)[0], y: L(900, 640)[1] },
    // telescopic sight unit, day only (no thermal sight in 1991): ×2 wide, ×13 narrow — V steps through
    sightFov: { day: [{ n: 'W', fov: 30, mag: 2 }, { n: 'N', fov: 4.6, mag: 13 }] },
    sight: { laser: true, thermal: false, night: false, name: 'TSU', rangeErr: 0.008, aimErr: 0.2, layTime: 2.5, detectMax: 5000, identMax: 3500, engageMax: 6000 },
    armor: [
      { name: '기수', part: 'hull', a: L(225, 690), b: L(225, 760), t: 8, mat: 'alu', n: 0, h: 0 },
      { name: '조종석 캐노피', part: 'hull', a: L(560, 600), b: L(300, 670), t: 15, mat: 'alu', n: 70, h: 0 },
      { name: '조종석 하부', part: 'hull', a: L(290, 785), b: L(560, 790), t: 15, mat: 'rha', n: -90, h: 0 },
      { name: '동체 상면·엔진', part: 'hull', a: L(880, 600), b: L(560, 575), t: 8, mat: 'alu', n: 90, h: 0 },
      { name: '동체 하면', part: 'hull', a: L(560, 790), b: L(900, 770), t: 8, mat: 'alu', n: -90, h: 0 },
      { name: '후방 동체', part: 'hull', a: L(900, 620), b: L(900, 770), t: 6, mat: 'alu', n: 180, h: 0 },
    ],
    sideArmor: { hull: '전면 12.7 mm 방호 · 20 mm 일부' },
    modules: [
      { id: 'gunner', name: '전방석 사수', type: 'crew', p: L(360, 655), r: 0.33 },
      { id: 'pilot', name: '후방석 조종사', type: 'crew', p: L(490, 640), r: 0.33 },
      { id: 'engine', name: '엔진 (T700 ×2)', type: 'engine', p: L(760, 640), r: 0.5 },
      { id: 'rotor', name: '주 로터 변속기', type: 'rotor', p: L(652, 590), r: 0.4 },
      { id: 'fuel', name: '연료탱크', type: 'fuel', p: L(650, 720), r: 0.45 },
      { id: 'ammo', name: '20 mm 탄약', type: 'fuel', p: L(480, 740), r: 0.3 },
    ],
    // placeholders for the shared vehicle systems
    roadWheels: [{ x: L(500, 826)[0], y: L(500, 826)[1] }], wheelR: 0.05, suspension: { k: 1, c: 1, bump: 0.1, droop: 0.1, bumpK: 1, bumpC: 1 },
    sprocket: { x: -4.5, y: -1, teeth: 10 }, idler: { x: 4.5, y: -1, r: 0.2 }, returnRollers: [],
    track: { pitch: 0.15, thick: 0.05, width: 0.3, mass: 1 }, belly: { y: -1.5, x0: -4, x1: 4 }, contactArea: 1,
    engine: { type: 'turbine', power: 2.5e6, eff: 0.7, maxTractive: 1, spool: 1.2, vmaxF: 78, vmaxR: 20, brake: 1, engineBrake: 1 },
    antennas: [],
  };
})();
