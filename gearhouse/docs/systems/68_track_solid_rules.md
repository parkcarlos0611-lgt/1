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

## Known gaps (next)
- Small bright parts at the nose (lamp stays, bumper irons) crowd together at game size.
- Wire wheels read as grey discs at 1x; the wheel face needs its own small-size drawing.
- No shadow under the car yet (the track scene will draw it).
- A bake step is still to come: a fixed palette per material, lone pixels removed.
