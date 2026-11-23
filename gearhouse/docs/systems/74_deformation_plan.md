# 74 · Crash damage by deformation (plan, review 93)

The darkened "dent" patch is gone (review 93). The user wants damage as BeamNG.drive does it: the car's body is a
structure of nodes and beams that bends where it is struck, and parts that are knocked hard enough come away. This is
the plan; the work comes after the 3D-first switch (review 92), since it needs the meshes' part names.

## The structure (per car, built from its mesh)
- Nodes: a few hundred points per car, placed on the mesh's parts (a lattice through each panel's stations, more on the
  wings, bumpers, bonnet and screen), each with a mass from the part's weight (the part models' kg).
- Beams between nearby nodes: a spring with damping, a yield length past which it bends for good (plastic), a break
  length past which it parts. Stiff for the frame and the engine, soft for wings and bonnet, brittle for glass and lamps.
- Every mesh vertex is bound to its nearest few nodes (weights by distance); when the nodes move, the skin follows.
- Parts hang on their mounts: a wing on four beams to the body, a bumper on its irons, a lamp on its stand, a door on
  hinges and a latch, a spare on its straps. When a part's mounts all break it comes away as its own body.

## Simulation
- Only while something touches: the car stays a rigid body (the present physics) until a contact (a car, a fence post,
  a wall, the ground in a roll) exceeds a force; then the node structure near the contact runs for a few hundred
  milliseconds at a fine step (2 kHz), the permanent bend is kept, and the rigid body takes the changed mass layout.
- Contacts: node to track surface, node to other cars' node hulls, node to props (simple boxes).
- Loose parts: rigid pieces with their own mesh, bouncing and sliding on the track (as the fence pieces do now), and
  staying where they land until the race ends.

## What damage does to the car
- Bent front axle or a pushed-back wing: the wheel's toe and camber change (the car pulls to one side).
- A crushed radiator: the cooling margin falls (brief 69's heat model), a holed one loses water.
- A broken lamp, a lost bumper, a bent wing: shown at once, carried to the garage after the race as parts to repair or
  replace (the builder's slots), with the part's condition.

## Drawing
- The baked pictures cannot bend: a damaged car is baked again (its own pictures, a few hundred ms in the background).
- In the real-time renderer (brief 72) the deformed skin is simply drawn as it is each frame.

## Steps
1. Node structure from one car's mesh (the SSJ), shown as dots and lines on the model page; static load tests.
2. A crash test page: the car into a wall at set speeds, the bend compared with period photographs of such accidents.
3. Into the race: contacts, loose parts, re-baking, handling changes.
4. Damage to the garage: parts and their condition after a race.

## Done first (review 101): the tyres as node rings
`race/tyre.ts`: each tyre a ring of 32 nodes on radial springs to the rim, tied to its neighbours (the tread band),
damped, four sub-steps a physics step. The road (the bumps' profile along the car under each node) pushes the nodes it
reaches; the load sets the hub's height over it (a standing give of about 5 % of the radius, less on the Model T's
high-pressure clinchers); the side and drive forces shear the patch across and along. The live renderer bends the tyre
by it in the vertex shader (the tread pressed in, the walls bulging, the patch pulled), on tyres cut finer along their
arcs. It shapes the tyres only: grip and springing stay the vehicle's, which already hold the tyre's give.

## Done (review 121): steps 1 to 3
- race/damage.ts: the structure built from a car's mesh at its first blow: nodes in 28 cm cells through its skin, each
  named for the part most there, and (as most meshes are only their outside) a ladder frame and the engine block added
  from the wheels' places; beams to every node within 1.8 cells, of the weaker end's stuff (frame, panel, bright work,
  glass, engine, upholstery), weaker between parts (the mounts). A blow presses a flat impactor into the car along it,
  the structure relaxing (by stiffness) about it, until the beams' elastic and plastic work has taken the blow's energy;
  past yield a beam's rest length follows (the bend kept), past breaking it parts. The skin follows its four nearest
  nodes. A part whose every mount has parted comes away and flies off as a piece of its own (the 540K's lamps).
- The blows: cars meeting (the energy their impact takes out, halved between them), the fence (a share of the speed it
  costs), the body landing on or rolling onto the ground.
- What it does to the car: a wheel's mounting knocked askew sets its toe and camber (the car pulls, the tyre leans); a
  crushed radiator cools less and, past half, leaks.
- The crash test (tools/dev/crash.ts): the SSJ crushes 5 cm at 15 km/h into a wall, about 27 cm at 50; a door struck at
  30 km/h goes in about 35 cm. 40-100 ms a blow.
- The baked pictures do not bend (the live renderer draws the bent skin); the garage's repair of the damage is still to do.
