# buick28 — "1928 four-door sedan", made by the direct method

Sheet d5f881aa, the left-hand car. Model: `buick28.json` (100 parts: 80 body-layer, 20 chassis-layer), written by
`buick28.py`. Rebuild: `./run.sh shade` (script, `modelviews.ts`, `modelshade.py`, `modelviews.ts` again,
`partsheet.py`, `autocmp.py`, look sheets in `work/look_*.png`). The JSON is the script's output plus the `shade`
entries `modelshade.py` adds; nothing is edited by hand.

## Start: from scratch
All body-layer parts are written new from 7x/8x gridded crops of each view (`S()` side, `F()` front, `B()` rear, `T()`
plan, in 4x-view units). Only the 20 chassis-layer parts come from the draft, moved onto this car's wheel centres.

## Scale
Hub centres measured at 270 and 1588.4 on the 4x side view (the true road wheels; the spare hangs behind the body and
was not mistaken) = 1318.4 units for the 2908 mm wheelbase: 8.82 mm a pixel. Length 4288, height 1853, wheels at
x 596 and 3504, tyre radius 419. Width 1950 as the draft measured it (the front and rear views give 2002 and 1951 by
their own proportions, the plan only about 1700). Length and height are inside the brief's band.

## Scores (autocmp.py; cmp.png, cmp.json)
| view | draft silhouette | direct silhouette | draft edges on lines | direct edges on lines |
|---|---|---|---|---|
| side  | 0.941 | 0.975 | 0.720 | 0.839 |
| front | 0.883 | 0.952 | 0.668 | 0.758 |
| rear  | 0.909 | 0.968 | 0.657 | 0.764 |
| top   | 0.893 | 0.946 | 0.591 | 0.712 |

## What was built
- **Body**: green body to the belt with the black upper `bodyTop` lying on it (side, rear, plan; from in front the
  pillars are green on the sheet, so the upper has no front outline). Front-hinged front doors and rear-hinged rear
  doors: seams, door panel lines, sill creases, eight hinges. The belt's two pale gold pin lines are `trim` features
  along the side, round the back and across the cowl; a lit band between them.
- **Roof**: black fabric top with its rolled edge and front peak; back panel seam in the plan. New **visor** under the peak.
- **Hood, cowl**: straight hood with the bright hinge line, 26 louvres, lower panel seam, catch; bright band where
  hood meets cowl (two trim lines, side and plan); centre hinge in the plan. Cowl with new **cowl lamps** (`cowlLamp`).
- **Radiator**: tall nickel shell with peaked crown and shoulders, cell core down to the frame, red enamel `badge`
  in a nickel `badgeRim`, winged `cap`. The maker's script on the core is left out on purpose.
- **Windscreen**: frame, one pane, `cabinSeen` (the dark cabin trim round the back window's light), `wheelSeen`
  (steering wheel rim), `wiper`. In the plan `dashSeen` (the wood seen through the screen).
- **Side windows**: three a side, each `wframe`, `wreveal` (black), `wwood` (wood surround), `glass`; through them
  `columnSeen` and two `seatSeen`.
- **Back**: `rearFrame`, `rearWood`, `rearGlass`; spare on the back (`spare`, `spareCarrier`) drawn as a wheel from
  behind; one tail lamp on the left (`tailRim`, `tail`) over a framed number plate (`plateRim`, `plate`, no lettering).
- **Wings**: thin sweeping bands read point by point over dark wheel houses (`house0/1`, `houseF`), rounded noses
  and the inner skirt `sweepF` in the front view, boxed rear wings from behind, plan outlines.
- **Running board**: grey board, full-length nickel edge strip `boardTrim`, tread `step0`; black valance `apron`
  with its lit rolled edge `sill`.
- **Lamps**: big nickel drum headlamps (`lamp`, `lampGap`, `lens`) on a `lampBar` across the radiator with
  `lampStand`; from the side their lower half is behind the wing, as on the sheet.
- **Bumpers**: front two flat bars right across with three clamps (`clampF0` pair, `clampFC`), irons and the two
  bright stays of the plan (`stayF`); back a pair of two-bar bumperettes either side of the spare (`bumperR0/1`,
  `clampR0`, `ironR`).
- **Door handles** as nickel parts (`handle0`, `handle1`), with knobs in the front and rear views.
- **Running gear**: axle beam, spring lumps, hub caps (`hubF`) in the front view; rear axle with its differential bulge.
- **Wheels**: artillery, 16 spokes (counted on the sheet; the draft guessed 14), painted the body's green, bright rim
  edge, nickel cap, rim 0.66.
- **Colours**: paint #22301f, paint2 #222225 (wings), canvas #2c2c2f, nickel #b4b1b1, glass #b8bdc5.

Parts added (not in the template): bodyTop, visor, cowlLamp, badge, badgeRim, sweepF, houseF, sill, boardTrim, hubF,
cabinSeen, wheelSeen, wiper, dashSeen, wreveal0-2, wwood0-2, columnSeen, seatSeen0/1, handle0/1, rearFrame, rearWood,
plateRim, plate, clampFC, clampR0, stayF.
Parts removed (the car has none, or they are done another way): lip, pillar, screenBar, rearBar, plateLamp, handleR,
crossF, step1, clampF1, spareHub, one of the two tail lamps.
All other parts keep the template's ids, elements, materials and slots.

## What is still wrong
- The sheet's views disagree; each keeps its own place, the common box is the mean (`work/build.log` lists 49 cases
  over 50 mm). The large ones: the plan is drawn shorter at the front and narrower in the body (wing nose 90 mm
  further back, board 170 mm shorter, rear wing starting 190 mm further forward than in the side view); the front view
  draws the body 90 mm narrower than the rear view; lamp bar and bumpers sit 80-130 mm lower in the front and rear
  views than in the side view; the spare's centre is 65 mm lower from behind than from the side. The plan view is cut
  at its lower edge and its centre line wanders 15-30 units, so plan parts are fitted to the upper half.
- The pin lines are nickel `trim` features (thin gold parts are eaten by their outlines), so they draw whiter than the
  sheet's pale gold. The lighter green band between them is only a highlight.
- Headlamp and cowl lamp from the side are blocky at game size; the mascot is a blob. The shell draws whiter and
  heavier than the sheet's; the lens grey instead of cream.
- From in front the upper pillars are green (as the sheet) but the black upper is black from the side: a break if the
  car is ever turned.
- The spare has no side hub; the plate has no lettering; no hub caps in the rear view; the door hinge bumps and
  window-frame gold lines of the front view are left out.
- Plan: the bumperettes are thinner than drawn; the wings' inner edges are guessed (black on black).
- The spokes draw thinner and darker than the sheet (the known renderer limit).
- The chassis layer is the draft's (the template's engine moved); the under view was not used.

## With another hour
Tile-by-tile check with `tiles.py` of lamps, shell and wings; a proper bullet shape for the cowl lamps; the lighter
belt band as its own painted part; the chassis from `v_under.png`; a check against `v_right.png`.

## Time and rounds
About 50 minutes: ~25 min reading the views and writing the script, then 6 build-and-look rounds. Nothing in the
repository was changed.

Files: buick28.py, buick28.json, run.sh, cmp.png, cmp.json, parts.png (parts_1..7.png singly), report.md, notes.md, mv/, work/.
