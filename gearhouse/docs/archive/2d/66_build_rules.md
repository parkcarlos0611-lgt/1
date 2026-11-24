# 66. Rules for building a car model (2026-11-22, from the reviews of the open and luxury cars)

What the reviews of the last six cars taught, for every car built from now on. It adds to briefs 62–65; where they
differ, this holds.

## Views and scale
- **Each view keeps the sheet's proportions.** Front and rear views use one scale both ways, taken from their height
  against the side view's (F = dx * H / FG, z = (FG - py) * H / FG); never squeeze them to a width chosen elsewhere. The
  model's width is the front view's. The plan keeps its own scale too. A real width that disagrees is reported, not forced.
- **Plan facing.** tools/ref/autocar.py turns the plan and the under view half round when the sheet draws them with the
  front to the right (it compares where the tyres stand in the under view with the side view's overhangs).
- **Scale** from the wheelbase found in sources (two that agree where possible); length, width, height and track are
  compared with the sheet and the differences reported.

## Parts
- **Screens.** From the front and rear, a screen is its frame's pieces and its panes as separate parts: the posts, the
  top rail (with its V where the screen is split), a centre post, a foot rail, and each pane as glass. Never one opaque
  slab. In the plan only the frame's top edge (a V where the screen is split).
- **Head lamps.** The glass is `material: chrome` with `detail: {kind: 'bowl'}`: the renderer draws the rim seam, the
  flutes, the lens bar, the glint and the bulb's shield. The rim is its own bright part.
- **Grilles and radiator cores.** `detail: {kind: 'core', pattern, pitch, metal?}` with the pattern the sheet shows:
  `square` (square wire), `honeycomb`, `diamond` (diamond wire), `woven` (fine gauze), `slats` (upright bars; `metal: true`
  for bright slats or shutters), `tubes` (a tube-and-fin core). Pitch in mm, as the sheet's spacing.
- **Running gear seen from outside** (`vis_` parts) is drawn off the sheet with its own shapes (axle beam, spring packs,
  dumb irons, crank, dampers, tank), not one black block. In the front and rear views the renderer puts it behind the
  body's own parts; in the chassis views it is left out.
- **One flank only.** A part on one side only (an outside exhaust, a filler) keeps its true y; the renderer draws it
  behind the near side in the other side's view.
- **Seamless joins** with `join`, wings kept as their own parts (brief 64).
- **Spares** via tools/ref/sparegen.py; a tail spare can lean back (`tilt`, degrees) and sit into the tail (`into`, mm).
- **Seats** in open cars via tools/ref/seatgen.py (brief 64). Folded hoods and covers are only what the sheet shows past
  the screen and body.

## Model settings
- `gloss`: 0.7 when not given; 0.85 for a polished show car, lower for a working car.
- Weight: add the car to tools/ref/kgset.ts with its real weight (period figure) and run it; the game then shows the real
  weight and moves it by the parts' estimate when parts or the engine change. Add the car to data/cars/specs.json (engine,
  gears, drive, springs, wheelbase, track, tyre) and give the model `running.engine` from it.
