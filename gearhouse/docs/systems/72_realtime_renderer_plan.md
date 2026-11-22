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

## PBR, step 1 (review 102): the light only, no textures yet, to compare
`uLook` in the live renderer: 0 the baked pictures' stepped light; 1 and 2 metallic-roughness shading (GGX, Smith,
Schlick), the sun with its shadow, the sky as an analytic light (irradiance from ground to zenith, its reflection
blurred by roughness, the split-sum curve), a clear coat on paint, a filmic curve and gamma; 1 steps the brightness into
seven bands (the pixel look kept), 2 leaves it smooth. Each material kind has its metalness and roughness (paint by its
gloss, chrome 0.12, rubber 0.9, canvas 0.95...). The page has a selector and a side-by-side view of all three.

## PBR, step 2 (review 103): the look chosen (PBR, smooth) and detail textures
- The test drive opens in PBR (smooth). In it the outline goes round each thing only: no lines over the shading inside
  it (the part lines and depth steps are left to the light).
- Seven CC0 texture sets from Poly Haven (assets/textures/pbr, credits in pbr.json and on the page): brushed concrete 03
  (the track and plain surfaces), sparse grass (the fields), blue metal plate (paint's and metal's fine roughness and
  dents), rubberized track (tyres), brown leather, waffle pique cotton (canvas), oak wood planks. 512 px each, stacked
  into three texture arrays (albedo, normal, roughness), mipmapped.
- Laid three ways along the surface's main axes (triplanar): in the thing's own axes on cars and props (the texture
  moves with them), in the world's on the ground; each at its real tile size. The albedo is used for its light and dark
  only, so the game keeps its own colours; roughness and normals as drawn. Each material its strength (paint and chrome
  barely; wood, leather and canvas fully).

## PBR, step 3 (review 104): age in the material's terms
Per car, rust, fading and dirt (0..1), in the live shader, by noise in the car's own axes (it stays put on the car):
- Fading: most on what faces the sky; the clear coat goes, the paint pales and greys, roughness rises; a fine net of
  cracks when far gone.
- Rust on paint: low on the car (by its own height) and in patches; the scale rough, not metallic, its surface bumpy;
  primer round its edge; streaks running down below it on the sides.
- Bright metal: a milky film, then pitting through the plate (the nickel, then rust).
- Dirt: thrown up low on the body and the wheels, dust settling on what faces up; dull and rough.
The page sets the player's car's age; its dirt grows as it is driven (fast on the grass), a wash takes it off; the
others in a race carry a mixed, fixed age.
