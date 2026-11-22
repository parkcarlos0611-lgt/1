# 75 · Ray tracing and smoke for the live renderer (plan, review 106)

The user asked for ray tracing and better smoke, with notes on real smoke: turbulence and curl noise over the large
motion, density against temperature (buoyancy while hot, cooling, dissipation), and volumetric light (multiple
scattering, back light and rim). The live renderer is WebGL2 on phones as well as desktops: no hardware ray tracing.
What can be traced, and how:

## 1. Rays in the picture (screen space), every frame
The scene pass gains a third layer: each pixel's normal, roughness and metalness. Then, in the post pass:
- **Reflections (SSR)**: for a glossy pixel (chrome, glass, clear-coated paint, the wet-looking shine of fresh paint)
  the eye's ray is bounced off its normal and marched across the picture against the depth layer until it passes
  behind something; what is there is mirrored, blended by Fresnel and blurred by roughness; where the ray leaves the
  picture or finds nothing, the sky light already in the shading stays. Chrome then shows the track, the stands, the
  other cars; paint shows the wing over the wheel.
- **Ambient occlusion (SSAO)**: a few short rays in the hemisphere over each pixel against the depth layer; corners,
  wheel arches, the cockpit and the ground under a car darken as light from the sky cannot reach them.
- **Contact shadows**: a short ray toward the sun over the depth layer, for the fine shadows the shadow map is too
  coarse to give (a spoke on the hub, a handle on the door).
The orthographic camera makes these simple: the eye's ray is the same direction everywhere.

## 2. Smoke as a fluid in miniature, lit as a volume
Sources: tyre smoke (the skid strength already measured), wheelspin, grass dust, a boiling radiator's steam, exhaust.
- **Simulation (each particle a parcel of gas)**: temperature T and density; buoyancy proportional to T above the air;
  cooling toward the air (fast at first, then slowly); drag toward the wind; turbulence from curl noise at two scales
  (a large swirl and finer break-up; curl noise is free of divergence, so it stirs without bunching); dissipation:
  density fades and the parcel spreads as it ages. Tyre smoke starts hot and fast, dust cold and heavy, steam hot.
- **Drawing (volumetric)**: each parcel a sphere of density shaped by moving 3D noise, ray-marched in its fragment
  (a few steps along the eye's ray through it), each step lit by a short march toward the sun through the density
  (self-shadow), multiple scattering approximated by summing octaves of weaker extinction and wider phase (so the
  smoke is soft and milky, not a grey blob), a two-lobed phase function (strong forward scattering: bright rims and
  glow when the sun is behind the smoke; a weak back lobe), and the sky's light from above. Sorted far to near,
  blended over the scene, depth-tested against it.

## 3. A traced photo mode (later)
When the car stands still: a path tracer over the meshes (a bounding volume hierarchy in textures, a few bounces, the
sun and sky, accumulated over many frames into a converged picture). Heavy, so only for stills; the screen-space
rays of §1 carry the live picture.

## Steps
1. G-buffer layer, SSAO and contact shadows (cheap, visible everywhere).
2. SSR on chrome, glass and paint.
3. Smoke simulation and volumetric drawing; the 2D puffs and steam retired in the live picture.
4. (later) The traced photo mode.
Each with a switch on the page to compare, and checked for its cost.
