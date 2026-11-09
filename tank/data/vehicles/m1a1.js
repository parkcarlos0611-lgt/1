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
    name: 'M1A1', side: 'US',
    mass: 57200, inertia: 3.3e5,
    src: { ppm: PPM, ox: OX, oy: OY, dir: 'assets/sprites/m1a1/' },
    sprites: {                       // top-left px in the source drawing
      hull:   { x: 14,  y: 838 },
      turret: { x: 38,  y: 626 },
      barrel: { x: 952, y: 766 },
      // running gear sheet (tools/cut_wheels.py): 512 px squares, radius 256 px
      roadwheel: { r: 256, file: 'roadwheel' }, roadwheelFront: { r: 256, file: 'roadwheel_front' },
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
    underside: { x0: -3.05, x1: 3.35, y0: -0.52, y1: -0.98 },  // dark hull side behind the wheels
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
    antennas: [{ px: 217, py: 724, len: 1.15 }, { px: 397, py: 727, len: 1.10 }].map(a =>
      ({ x: L(a.px, a.py)[0], y: L(a.px, a.py)[1], len: a.len })),
  };
})();
