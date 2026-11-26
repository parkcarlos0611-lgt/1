# 68. The car as a solid for the track game — rules and know-how (review 73, 2026-11-22)

The track game draws each car from above at a slant (40 degrees), pre-rendered for every heading (method A). The
picture comes from a solid built out of the car's part model. This note keeps what was learned making it, so the next
change starts from here. Code: render/car/voxel.ts. Check: tools/ref/solidshot.ts. Preview page: ui/voxview.ts.

## The way of working (keep to it)
1. Change one rule in voxel.ts.
2. `npx tsx tools/ref/solidshot.ts <out.png> cars=... yaws=30,150,250 zoom=2 scale=1` — one command, straight to a PNG.
   Always include one open car, one flowing body, one cycle-winged car, one closed car, one sedan with boards.
3. Look at the sheet. Name each fault by its cause in the model's data, not by its look ("a black block" was a
   wheel-well backdrop part; "a floating strip" was a part drawn in one view only).
4. Fix the cause as a rule that holds for every car (by element, material, which views a part has), never per car.
5. Add the rule below. Rebuild the preview page when the look changes.

## Rules of the solid (solidOf)
- **Cells** of 15 mm for work; 10 mm for the final bake if steps show.
- **A part's cell** is one that lies inside the part's outline in every view it has, each view set into the part's own
  common box (the sheets' views disagree by 50–200 mm; using the box keeps holes out).
- **Stand-ins stay out**: tyres drawn as parts, wheel-well backs (`house`), dark backdrops drawn across the car in a
  front, rear or plan view only. They are 2D devices and become blocks.
- **A dark mass drawn from the side as a slab from the centre line out** is the same on both sides (mirrored).
- **A part drawn in one view only** has no depth: it is laid a few cells thick on whatever solid lies just behind it
  along that view's line (within 250 mm).
- **A part lying on another (`on`)** is held inside that part's box: glass and lenses sit flush.
- **Screens**: panes and posts drawn only from in front follow the rake of the screen part that has a side outline.
- **Open cars**: the cockpit is hollowed to a floor about 330 mm below its rim; cushions stand 150 mm above the floor,
  seat backs up to just under the rim.
- **Boards and sill strips** left standing off the body (the plan drawn wider than the front view) are carried in to the
  car: a broad board is widened inward, a thin strip is moved whole.
- **Corners** are rounded for every part at least 150 mm thick each way, whatever it is made of (glass too: an
  un-rounded pane in a rounded body looked swollen).
- **Wheels** are made, not taken from parts: a tyre with rounded shoulders, a rim face each side.
- **Symmetry** (review 74): a car is the same on both sides. Every cell of a part that is paired or drawn from the
  centre line out gets its mirror image; only parts carried on one side (exhaust, one-sided spare, single mirror) keep
  one side. Side-only parts whose box starts at the centre line are laid on both sides. Measured mirror mismatch after
  this: 0.0–0.7 % of cells, all of it one-sided fittings (before: up to 8.4 %, the Model A's apron on one side only).
- **Why bodies looked collapsed**: the solid is the intersection of the views, so wherever the sheet's views disagree
  (the plan narrower than the front view by 100–300 mm, a wing's crown lower in the front view) the smaller wins and
  the body thins. Professional car modelling meets the same problem and settles it the same way: pick one view as the
  authority for each region, model one half and mirror it. Next step for us: per element, a chosen authority view for
  width (the front view for bodies, the plan for wings) instead of the plain intersection.

## Rules of the colour (texOf, surfaceOf)
- The car's own drawings are made **plain** for this (no gloss, no light read off the sheet): the solid gives the light,
  the drawings give the marks.
- A face takes its colour from the drawing that looks straight at it, where that drawing shows the cell's own part or
  one lying on the same face; never a part standing in front of it along that view.
- **Broad painted or cloth faces** take only the drawing's marks (lighter or darker than their surroundings within a
  hand's breadth: louvres, seams, straps) on the part's own flat colour. Everything else (glass, grilles, lamps, wheels,
  leather) takes the drawing's colour.
- Crevices get less of the sky (from the blurred solid).

## Rules of the picture (drawSurface)
- Two steps: which cell shows at each pixel; then each pixel lit.
- The outward direction comes from the slope of the blurred solid and is averaged again on screen with its neighbours
  on the same surface (not across a depth jump or a real edge). This removes the cells' steps and keeps the form's edges.
- Light in nine steps (flat tones). Paint and glass get a small hard highlight; dark paint gets a little sky laid on it
  so black cars keep their form; bright metal gives back sky above, a dark horizon, the ground below.
- A dark line round the car and where one surface stands well before another.

## Review 78: B (stacked slices) is the track's way
- The planner judged stacked slices better, above all small and from a distance. B now draws the same solid as A with
  every rule above (texture, crevices, smoothed light, seams, outline, shadow): each pixel looks down through the level
  slices and the first surface cell it meets shows, so every pixel is exactly filled with its nearest cell (crisp, no
  splat holes). A and B share the lighting and finishing steps; only the step that decides which cell shows differs.
- A ray at the 40-degree slant moves more than a cell across for each cell down: it is sampled three times a cell, or it
  slips through thin walls (dark speckle). A ray that lands inside the solid shows the nearest surface cell.
- Depth for outlines comes from the cell's smoothed position, not the slice, and stacked mode uses looser outline
  thresholds; otherwise walls read as a lattice.
- Defaults: B, 0.75–0.85 of the base scale, 2-pixel outline. About 0.4 s a heading on the CPU; baked once per car.

## Review 77: the staircase
- Surface cells are moved along their outward direction to where the blurred solid crosses one half (at most 0.7 of a
  cell): the surface lies on a smooth sheet, so silhouettes and shading lose most of the cells' steps. No cost at run time.
- 10 mm cells halve what is left, at about twice the build time (8 s a car): use them for the final bake.
- A screen drawn as panes from in front drops the side-only glass slab that stood for it (it made a block).
- What still reads as steps on broad panels is mostly the drawings' own vertical banding laid on as marks.

## Review 76: whole-car silhouettes, windows set in
- The 2D models were made to look right from the side; their parts' boxes across the car are loose, so built one by one
  they leave gaps a solid shows (the first sedans most). The gaps are now closed from the whole car's silhouettes, which
  the sheets draw surely: a cell inside the side, front (or rear) and plan silhouettes, within 120 mm of a part and clear
  of the wheels, takes the nearest part (not glass, chrome or lenses).
- Glass and the frames round windows are set into the surface, not laid on it: a frame takes the surface's own cells,
  glass the cells one further in with the outer one cleared, so a window sits back in its frame (they stood out).
- The game-size wheel face keeps the wheel's own pattern: two thirds of its spokes, drawn at 9 mm a pixel (a stock
  16-spoke face changed how the grand roadster's wheels looked).

## Review 75: nothing floats, no colour bleeds
- Corners are rounded before the thin parts are laid on, so glass, lamps and strips sit on the rounded surface (laid on
  the square hull first, they stood a cell or two proud of it: floating windows).
- A part that touches no other part is moved the shortest way along one axis, up to 300 mm, until it touches (tail lamps
  drawn behind wings that end short of them).
- A face borrows another part's colour from a drawing only when that part lies on it (`on` chain: glass in its body, a
  lens in its lamp), or a spare's face from the wheel drawing; never a neighbour drawn behind or beside it.
- Sprite stacking (15 flat slices) was tried for cars and rejected: tall 1930s bodies need a slice every 13 cm, so the
  sides turn to stripes. It suits flat track props (tyre stacks, hay bales, flags).

## Picture, review 74
- Wheels at game size take a face drawn for small size (wire wheels with 16 bold spokes at 11 mm a pixel).
- A thin dark seam where a bright part meets another part in front of it (small fittings stand apart).
- Lone pixels take their neighbours' colour.
- A soft ground shadow: each cell dropped along the sun's ray.

## Known gaps (next)
- Small bright parts at the nose (lamp stays, bumper irons) crowd together at game size.
- Authority view per element for width (above).
- A bake step: a fixed palette per material.
