// AH-64A Apache (US Army, Gulf War). Geometry from assets/ref/ah64a_sheet.png (armed side drawing, mirrored to
// face right) at 70.6 px/m, origin px (680, 190) (tools/cut_ah64.py). Engines and armament: user data; flight
// figures are public estimates, provisional. Flown by src/vehicle/Heli.js (not a tracked vehicle): the fields
// a ground vehicle needs (wheels, track …) are placeholders so the shared systems (sensors, armour, effects)
// can treat it like any other vehicle.
window.DS = window.DS || {};
DS.VEHICLES = DS.VEHICLES || {};
(function () {
  const PPM = 70.6, OX = 680, OY = 190;
  const L = (px, py) => [-(px - OX) / PPM, -(py - OY) / PPM];     // drawing faces left; local x forward
  DS.VEHICLES.ah64a = {
    id: 'ah64a', name: 'AH-64A 아파치', side: 'US', heli: true, ammo: ['M789'],
    mass: 8000, inertia: 6e4, signature: 1.2, thin: 3,
    // protection: rounds up to this calibre (m) do no damage — 12.7 mm anti-aircraft machine guns cannot hurt it.
    // Planned for when such weapons exist: 14.5 mm slight damage from the side and rear only; the front proof
    // against most hits up to 20 mm.
    proofD: 0.0135,
    // boxes of the cut pieces in the sheet [x, y, w, h] (tools/cut_ah64.py → cut.json)
    src: { ppm: PPM, ox: 316, oy: 59, w: 1061, h: 237, dir: 'assets/sprites/ah64a/', rotor: [259, 15, 900, 81], rotorAxis: 673, tailrotor: [1243, 8, 188, 201],
      // the near launcher's two visible Hellfires (upper, lower rail), cut off the airframe: each is drawn on its
      // rail until fired and then flies as that drawing
      hf: { up: [649, 243, 133, 19], lo: [645, 267, 137, 24] } },
    flight: {
      vmax: 81, tilt: 26, climb: 12, sink: 9, gearH: 1.66,          // 293 km/h; max lean (deg); rates m/s; origin above the wheels
      hub: L(673, 66), rotorR: 7.3, tail: L(1336, 100), tailR: 1.4,
      wheels: [[L(590, 283), 0.345], [L(1336, 284), 0.2]],          // main and tail wheel: centre, radius (m)
    },
    // chin gun M230 30 mm: follows the sight within its arc (deg relative to the nose)
    gun: { name: 'M230 30mm', trunnion: L(470, 268), muzzle: 1.25, elevMax: 11, elevMin: -60, rate: 1.4, reload: 60 / 625,
      recoilLen: 0.05, recoilMass: 60, rounds: 1200, spread: 2.2 },
    rockets: { ammo: 'HYDRA', n: 38, at: L(640, 236), interval: 0.16 },          // two M261 pods
    hellfire: { ammo: 'HELLFIRE', n: 16, at: L(700, 262), interval: 1.2, range: 8000 },
    sightAt: L(332, 214),                                                         // TADS turret in the nose
    turretRing: L(640, 150), exhaust: { x: L(905, 150)[0], y: L(905, 150)[1] },
    // TADS fields of view (user data): day TV 50° / 4.0° / 0.9°, FLIR 50° / 10° / 3.1° / 0.45° — V steps through
    sightFov: {
      day: [{ n: 'W', fov: 50, mag: 0.9 }, { n: 'N', fov: 4.0, mag: 4.5 }, { n: 'Z', fov: 0.9, mag: 125 }],
      flir: [{ n: 'W', fov: 50, mag: 0.9 }, { n: 'M', fov: 10, mag: 4.5 }, { n: 'N', fov: 3.1, mag: 14.3 }, { n: 'Z', fov: 0.45, mag: 143 }],
    },
    sight: { laser: true, thermal: true, name: 'TADS', rangeErr: 0.005, aimErr: 0.15, layTime: 2, detectMax: 6000, identMax: 4000, engageMax: 6000 },
    armor: [
      { name: '기수', part: 'hull', a: L(318, 170), b: L(318, 250), t: 12, mat: 'alu', n: 0, h: 0 },
      { name: '조종석 캐노피', part: 'hull', a: L(600, 108), b: L(400, 160), t: 20, mat: 'alu', n: 70, h: 0 },
      { name: '조종석 하부 (붕소 장갑)', part: 'hull', a: L(380, 262), b: L(640, 262), t: 25, mat: 'rha', n: -90, h: 0 },
      { name: '동체 상면·엔진', part: 'hull', a: L(960, 110), b: L(600, 105), t: 10, mat: 'alu', n: 90, h: 0 },
      { name: '동체 하면', part: 'hull', a: L(640, 262), b: L(960, 250), t: 10, mat: 'alu', n: -90, h: 0 },
      { name: '후방 동체', part: 'hull', a: L(960, 110), b: L(960, 250), t: 8, mat: 'alu', n: 180, h: 0 },
    ],
    sideArmor: { hull: '23 mm 탄 방호 (주요부)' },
    modules: [
      { id: 'gunner', name: '부조종사·사수', type: 'crew', p: L(478, 165), r: 0.35 },
      { id: 'pilot', name: '조종사', type: 'crew', p: L(560, 150), r: 0.35 },
      { id: 'engine', name: '엔진 (T700 ×2)', type: 'engine', p: L(820, 148), r: 0.55 },
      { id: 'rotor', name: '주 로터 변속기', type: 'rotor', p: L(680, 112), r: 0.4 },
      { id: 'fuel', name: '연료탱크', type: 'fuel', p: L(700, 205), r: 0.45 },
      { id: 'ammo', name: '30 mm 탄약', type: 'fuel', p: L(600, 235), r: 0.3 },
    ],
    // placeholders for the shared vehicle systems
    roadWheels: [{ x: L(590, 285)[0], y: L(590, 285)[1] }], wheelR: 0.05, suspension: { k: 1, c: 1, bump: 0.1, droop: 0.1, bumpK: 1, bumpC: 1 },
    sprocket: { x: -4.5, y: -1, teeth: 10 }, idler: { x: 4.5, y: -1, r: 0.2 }, returnRollers: [],
    track: { pitch: 0.15, thick: 0.05, width: 0.3, mass: 1 }, belly: { y: -1.5, x0: -4, x1: 4 }, contactArea: 1,
    engine: { type: 'turbine', power: 2.5e6, eff: 0.7, maxTractive: 1, spool: 1.2, vmaxF: 81, vmaxR: 20, brake: 1, engineBrake: 1 },
    antennas: [],
  };
})();
