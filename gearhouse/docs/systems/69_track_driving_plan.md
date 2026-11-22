# 69. Driving physics and the test track — plan (review 78, 2026-11-22)

What is settled: the track game views from above at a fixed 40-degree slant; cars are baked from their part models as
stacked slices (render/car/voxel.ts, `drawSurface(..., stacked = true)`, docs/systems/68), at 0.75–0.85 of the base
scale with a 2-pixel outline; backgrounds are 2D art drawn at the same slant; flat props may be stacked sprites.
The physics redesign in docs/REBOOT_PLAN.md §2 holds (planar rigid body + heave, roll, pitch + four wheels, a simplified
Pacejka tyre with a friction ellipse, a fixed 500–1000 Hz step, the pass tests listed there).

## 1. Car sprites for the track
- Bake per car: 64 headings x 3 roll steps (left, level, right) at 0.8 scale, 2-pixel outline, a separate soft shadow.
  About 25 s a car on the CPU today; once per car and paint, kept in the save's cache.
- Wheels baked apart from the body (4 steering angles x 4 spin phases x 3 blur levels), so the body can roll and pitch over
  them and the wheels can turn, spin and blur with speed.
- Body roll and pitch at run time: the body sprite is shifted a pixel or two against the wheels by the physics' roll and
  pitch, and the roll step picked from the 3 baked ones.

## 2. Physics core (physics/track.ts, no screen)
- State: x, y, yaw; vx, vy, yaw rate; heave, roll, pitch and their rates; four wheel spin rates; engine revs, gear, clutch.
- Load transfer: longitudinal and lateral from the centre of gravity's height, wheelbase, track; roll stiffness split
  front/rear from the springs (leaf rate by spring type in data/cars/specs.json).
- Tyres: simplified Pacejka (B, C, D, E) per surface, load sensitivity, combined slip by a friction ellipse; low-speed
  blend to a viscous model (the known divergence below ~2 m/s).
- Drive line: engine torque curve from the engine spec (bore, stroke, valves, cc → peak torque and revs), the gearbox,
  an open differential (the inner wheel spins up), rear, front or four-wheel drive from the specs.
- Brakes: drums on two or four wheels as the car had them, with fade by drum temperature.
- Surfaces: tarmac, packed dirt, loose gravel, mud, wet, wooden boards: grip, rolling resistance, and what they throw up.
- Limits and heat: coolant temperature (heat from power, cooling from speed and radiator size; thermosiphon cars boil on
  long climbs); over-revving and overheating add wear, and past a gauge warning the chance of a head gasket or bearing
  failure rises; tyre wear and punctures.
- Pass tests (from REBOOT_PLAN §2): step steer yaw response, steady-circle understeer gradient, braking in a turn, lift-off
  oversteer, 0–60 / top speed / 60–0 within 10 % of the period figures.

## 3. Test track (first playable)
- One dirt oval with a tarmac straight, at the 40-degree slant: a 2D background in a few big tiles, curbs and hay bales as
  stacked props.
- The player's car from the builder or any of the 12 sheet cars; three opponents driven by a simple line-follower that
  respects the same physics (no cheating on grip).
- Controls: keyboard (smoothed steering with self-centring) and gamepad; a counter-steer assist that can be turned off.
- Camera fixed in angle, following the car with a little look-ahead; the car drawn slightly away (0.8 scale).
- Effects:
  - skid marks per wheel where slip passes a threshold, darker with slip, ruts on soft ground;
  - dust and thrown dirt on dirt, smoke on tarmac, by slip x speed x surface;
  - motion blur: wheel blur levels by spin, body ghosting 2–3 copies by speed;
  - light: the sun's direction drives the car's shading and the shadow's length; a glint follows the sun across the
    bodywork; lamps at dusk.
- A gauge for revs, coolant and speed; a lap timer.

## 4. Order of work
1. Physics core in isolation with its pass tests (no picture): a few days of tuning against the period figures.
2. Track sprite bake (64 headings x 3 roll, wheels apart) and a still scene: car on the background at several headings.
3. The test track: driving, camera, skid marks, dust, smoke, motion blur, shadow.
4. Opponents, laps, heat and failures, gauges.
5. Ties to the game: a race day from the calendar, prize money, damage brought back to the garage, the newspaper.

## Open questions for the planner
1. Is the first track a dirt oval (most period-typical) or a road course with turns both ways?
2. Opponents in the first build: three cars, or the player alone against the clock first?
3. Failures: warning first then chance (recommended), or strictly the gauges and the player's judgement?
