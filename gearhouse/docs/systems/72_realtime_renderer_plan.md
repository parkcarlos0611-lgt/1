# 72 · A real-time renderer for the track (plan, review 90)

Today every car and prop is drawn by a software rasteriser (render/car/mesh.ts) into pictures baked per heading, roll,
steering and spoke step, then laid on a 2D canvas. The user asked for a plan of a version that draws everything live,
with all the lighting, reflection and gloss of review 90, while the baked version carries on. This is that plan.

## What drawing live buys
- Any camera: height and angle changed freely and smoothly, true perspective for a chase or TV camera, continuous
  turning without heading steps; the cinematic view gets real camera moves (dolly, crane, zoom).
- The car as it is at each moment: wheels steered and turning at their real angle, body roll and pitch on the springs,
  dents and dirt as they happen, no picture cache, no memory limit, no baking pauses.
- Light that moves: the sun across the day, real shadows (a shadow map: stands shading the track, cars shading each
  other), headlamps at dusk, reflections of the sky and of nearby things in chrome and glass.
- Effects in 3D: dust, smoke, steam and spray as particles in the scene, true per-object motion blur.

## How (keeping the look)
- **WebGL2** through three.js (bundled; orthographic and perspective cameras, shader materials, render targets).
  Raw WebGL2 is the fallback option if the bundle size matters (three.js adds about 600 KB minified).
- **Same data**: the meshes' arrays (positions, colours, gloss, material kind, part, tread) become vertex buffers with
  flat face normals; the track becomes a mesh (the banked surface, earth banks, grass, ground features); props as now.
- **Passes**, all at the game's low internal resolution and enlarged by whole pixels:
  1. Scene pass into several targets: colour, normal, depth, part id, material kind, motion vector.
  2. Shading pass: warm sun, sky and ground light, stepped (cel-like) so the faces keep their few tones; specular in
     two steps by gloss; metal and glass mirror an environment map (a sky gradient to start, later a cube captured
     around the car); Fresnel on glass; the shadow map.
  3. Age in the shader: the wear system's noise, rust, fading and crazing ported to GLSL, by object-space position.
  4. Lines: thin part lines and the thick outline found from part id and depth jumps, as today, in screen space.
  5. Post: motion blur from the motion vectors (the player's car kept sharp), vignette, colour grading, film grain if
     wanted; glass drawn in a transparent pass between 2 and 4.
- **Stability**: camera snapped to whole pixels, integer enlargement, the outline width fixed in pixels, so turning
  does not shimmer.

## Steps
1. One car live beside its baked picture on a test page: flat shading, stepped light, outlines, pixel enlargement.
   Pass: the user cannot tell them apart at the game's scale, and it runs at 60 fps on a phone.
2. The track and props as meshes; camera modes (fixed, chase, cinematic, free height).
3. Sun, sky and ground light, shadows, environment reflections, gloss.
4. Age (wear) in the shader; dirt and dents.
5. Particles and motion blur; then the test drive switches over, the baked renderer kept for the house scenes and as a
   fallback on devices without WebGL2.

## Risks
- Matching the hand-tuned pixel look exactly: step 1 exists to find out before anything else is moved.
- Phones: the passes are cheap at the low resolution, but shadow maps and several targets need checking on a mid-range
  phone early.
- Two renderers to keep alike while both live: the material rules (kinds, gloss, wear) stay in one place and both read them.

## Done (review 99): the test drive switched over
Raw WebGL2 (no three.js: the passes are few and custom, the page stays small), in `render/live/`:
- `gpu.ts`: a mesh's buffers (body, each road wheel apart about its hub, glass apart, decals as pictures), matrices.
  The files' +y is put on the left of the heading, as the baked renderer's mirror draws it (checked side by side).
- `ground.ts`: the fields, the gravel and mown areas, the railway (ballast, sleepers, rails), the river, the concrete
  a metre at a time in nine strips (lighter where it climbs), joints, dark edges, the earth banks, the start line;
  the fence, built again when a stretch breaks.
- `renderer.ts`: an orthographic camera matching the baked projection (any heading, any height 15-85 degrees, any
  scale, snapped to whole pixels); a shadow map from the sun (cars and props on everything, snapped to its texels);
  the scene into colour, thing-and-part and depth; the baked light ported (stepped sun, sky and ground light, metal
  and glass mirroring the simple world, paint's two-step highlight, glass with Fresnel, decals in object space);
  the outlines from those layers (the dark edge inside each thing, the thinner lines between parts and at depth
  steps); a car hidden by anything shows its light outline over the hidden part only (a stencilled pass against
  what stands before it). Skid marks on the concrete.
- The page: the live renderer on by default where WebGL2 is, the baked pictures otherwise (a switch to compare);
  no baking at all when live, so the free camera's height and zoom change at once and smoothly.

Not yet live (next): motion blur (step 5), the materials' textures (tyre tread, cloth, leather, wood, the
radiator's honeycomb) and age (step 4), smooth shading for close views, perspective and the sun moving.
