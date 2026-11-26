# hudson26 — "1926 large sedan", made by the direct method

Sheet: the right-hand car. Model: `hudson26.json` (80 parts: 60 body-layer, 20 chassis-layer), written by `hudson26.py`.
Rebuild: `./run.sh shade` (= `python3 hudson26.py <folder> hudson26.json`, `modelviews.ts`, `modelshade.py`, `modelviews.ts`
again, `autocmp.py`). The JSON is the script's output plus the `shade` entries `modelshade.py` adds; nothing edited by hand.

## Start: from scratch, not from the draft
The draft is the 1929 template stretched onto this car, and it keeps the template's build: a rounded radiator shell,
bullet lamps on a bar, a body painted to the roof, a full-width rear bumper, two tail lamps, wire-looking wheels, no
visor. Almost every outline would have had to be redrawn, so I wrote the body-layer parts new, reading positions off
4x enlargements of each view (same `S()/F()` scheme as `sedan29_model.py`, plus `B()` rear and `T()` plan), and kept
the template's `part()`/`snap()` code. Only the chassis-layer parts (engine, gearbox, exhaust, tank, steering: nothing
the body views show) are taken from the draft, moved onto this car's wheel centres and width by the script.

## Scale and size
Wheel centres are 1322 units apart on the 4x side view; with the 3235 mm wheelbase that is 9.79 mm a pixel:
length 4718, height 1958, wheels at x 592 and 3827, tyre radius 438. Width 1720 (plan view's width/length; it also
gives a 1.42 m track on the front view). The draft had 1870 wide, which made the tyres and track too broad.

## Scores (autocmp.py; cmp.png, cmp.json)
| view | draft silhouette | direct silhouette | draft edges on lines | direct edges on lines |
|---|---|---|---|---|
| side  | 0.932 | 0.976 | 0.695 | 0.808 |
| front | 0.892 | 0.983 | 0.660 | 0.673 |
| rear  | 0.915 | 0.984 | 0.632 | 0.756 |
| top   | 0.919 | 0.970 | 0.626 | 0.773 |

## What changed from the draft, and why
- **Body in two**: `body` (maroon, to the belt) and a new `bodyTop` (black, `paint2` with its own colour) above the
  belt moulding, as the sheet paints it. Windows, screen and rear window lie on `bodyTop`.
- **Body side follows the rear wheel arch**, so the dark of the wheel house shows under the rear wing as drawn
  (the draft and my first build painted body colour inside the arch).
- **Roof**: a low black cloth cap with its real profile (flat, rounded at the back, drip edge); new **`visor`**.
- **Radiator**: tall flat-sided shell with a low arch, read off the front view; `core` directly in it (no `lip`);
  new `badge` + `badgeGem` (the enamel emblem). The maker's lettering on the core is left out on purpose.
- **Cap** with the meter on top (stem and head) instead of the template's plain cap.
- **Lamps**: drum lamps: `lamp` (black bowl) + new `lampRim` (nickel rim; carries the front view) + `lens`,
  on `lampStand`s. `lampBar` and `lampGap` removed (this car has no tie bar).
- **Wings**: both redrawn as the sheet's thin sweeping blades (side), a crown with its inner sweep down to the frame
  (front), square-ended blades (rear), and the plan outline. The front wing runs into the board.
- **Board**: thin board with a new nickel `boardTrim`; `step0/1` at the sheet's places.
- **Windows**: three a side at the sheet's openings (`wframe0-2` maroon reveal, `glass0-2`); new `wframeQ`/`glassQ`
  (the narrow corner lights the front view shows); screen in two panes (`screenBar` is horizontal); `rearFrame` +
  `rearGlass` at the sheet's size.
- **Bumpers**: front two thin bars with one clamp a side (`clampF0`); rear is two short bumperettes a side
  (`bumperR0/1` as a pair, `clampR0`), not a full-width bar.
- **Tail lamp**: one, on the left of the back panel (`tailRim`, `tail` are no longer pairs).
- **Spare**: at the sheet's height and size; `spareCarrier` now also fills the gap to the body in the plan.
- **Features**: 12 hood louvres at their place, hood seam and highlight, centre-opening doors (seams at the A post,
  the B post and the rear door's dog-leg edge, handles either side of the B post, three hinges), belt bead, sill
  crease, back-panel seams.
- **Colours** from the sheet: paint #431d23, paint2 #2b2c2e, canvas #28282a, chrome (nickel) #9a9185, glass #9ca6b0;
  valances/splash/board given a neutral black (#1d1d1e, #232325) because the stock 'black' draws blue-black.
- **Wheels**: artillery, 12 spokes, painted spokes, rim 0.69, hub cap 0.2, bright rim ring (`trim`).

Parts added: bodyTop, visor, badge, badgeGem, lampRim, wframeQ, glassQ, doorHandle (front view), rearFrame, boardTrim,
clampR0. Parts removed: lip, lampGap, lampBar, pillar, plateLamp, handleR, rearBar, clampF1, spareHub.
All other parts keep the template's ids, elements, materials and slots.

## What is still wrong
- The sheet's views do not agree with each other, so the boxes cannot: the plan draws the nose about 65-140 mm
  further forward than the side view (shell, hood, cowl, board, step0), the rear view draws the body ~80 mm wider than
  the front view, and the spare's centre is 75 mm higher in the side view than in the rear view. Each view keeps the
  sheet's place (`sheet`), the common box is the mean; `work/build.log` lists every difference over 50 mm.
- The wings are drawn as thin blades over a black wheel house, so they read darker and thinner than the sheet's lit
  wings; the rear wing's front leg is a little thin.
- Door handles (features) draw as thin lines; the sheet's are heavy nickel handles. The game draws the wood spokes
  thinner than the sheet and the shell brighter (cream) than the sheet's nickel.
- Front "edges on lines" stays low (0.67): the core's cell pattern, the game's glass streaks and the missing
  interior (wheel, dashboard) count against it; the outlines themselves sit on the drawing (tiles: shell front 76%,
  cap 84-88%).
- Not modelled: interior, lamp irons and frame horns in the plan, the bumper's curled ends, the brake drums/axle
  detail from behind, the blind in the rear quarter window. The chassis layer is still the draft's (template engine
  moved, not this car's six); the under view was not used.
- Plan view: the roof draws with a lighter edge band (the 'roof' surface), and the rear bumperettes show only as
  the small ends the sheet shows, though the rear view says they are longer.

## With another hour
Chassis layer from `v_under.png`; handles and hinges as small nickel parts; a thicker lit wing section; fit the wing
plan outlines; check the right-hand view against `v_right.png`.

## Time and iterations
About 1 h 20 min: ~35 min reading the views and writing the first script, then 8 build-and-look rounds
(look sheets in `work/look_*.png`, part tiles in `work/tiles_*.png`). Nothing in the repository was changed.

Files: hudson26.py, hudson26.json, cmp.png, cmp.json, parts.png (all five sheets side by side; parts_1..5.png singly),
run.sh, mv/ (the game's drawings), work/ (helpers and check pictures).
