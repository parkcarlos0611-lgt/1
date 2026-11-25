# 73 · High-quality textures for the 3D cars and the track (plan, review 91)

The user finds the 3D track scenes a little apart from the game's own pictures: the garage scenes and the part builder
draw cars from detailed 2D part models (render/car/flat.ts) with painted detail (badges, pinstripes, louvres, pleats,
grain, wear), while the meshes have flat colours per part. This plan brings the two together. It works for the baked
renderer now and carries over to the real-time one (brief 72) as GPU textures.

## 1. One palette and one light (quick, first)
- Take the game's colour ramps from the 2D renderer (each material's shadow, base, light and highlight tones, and the
  hue shift in them: shadows toward blue-violet, lights toward warm yellow) and shade the meshes onto the same ramps
  instead of multiplying the base colour. The 3D cars then sit in the same colour world as the garage pictures.
- The outline colour and weight, and the ground shadow's tint, matched to the 2D scenes.

## 2. The 2D art projected onto the meshes (the main step)
- Each car's part model (data/cars/sheet/<id>.json) already draws its side, front, rear and plan at any size. Draw
  them at 4x the track's scale and project them onto the mesh: every face samples the view its normal faces most
  (side faces the side view, the bonnet's top the plan, the grille the front), blended across the seams.
- Only the painted detail comes from the 2D art (badges, pinstripes, door shut lines, louvres, the grille's mesh,
  upholstery pleats, wheel spokes' paint); the 3D light (brief 90) shades it, so it turns with the car.
- The meshes were built to the same real sizes as the part models, so they line up; where they do not (the plan views
  read narrow, review 81), a per-car fit (scale and offset per view) is solved once by matching silhouettes.
- Wear from the existing system (render/car/wear.ts) applied in the same projected space, so rust and fading look as
  they do in the garage.

## 3. Detail textures by material, drawn fine and reduced
- Painted steel: panel seams and rivets; chrome: soft streaks; glass: faint smears; tyres: tread blocks and a sidewall
  ring; wood: grain and joins; canvas: weave and stitching; leather: creases and buttons.
- Drawn at 2-4x the game's scale and reduced by averaging, so they read as texture, not noise, and do not shimmer.

## 4. The track and the buildings
- Concrete: slab joints, patches, tyre rubber on the racing line, oil drips at the start line, cracks on the bankings.
- Grass: mown stripes, worn patches, daisies; the earth banks' rougher grass.
- Buildings: brick bond, corrugated iron ribs, weatherboarding, slate, posters (fictional), all as small tiles in an
  atlas, varied per building.

## Order and checks
1. Palette and light (1); compare one car beside its garage picture.
2. Projection on one car (the SSJ), with the fit tool; the user compares it with the 2D art before the other ten.
3. Material details (3), then the track and buildings (4).
Each step is shown on the test pages side by side with the current look before it replaces it.
