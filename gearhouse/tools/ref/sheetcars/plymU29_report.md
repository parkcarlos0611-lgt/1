# plymU29 — "1929 light four sedan", made by the direct method

Sheet 624bbd1c, the right-hand car. Model: `plymU29.json` (89 parts: 69 body-layer, 20 chassis-layer), written by
`plymU29.py`. Rebuild: `./run.sh shade` (script, `modelviews.ts`, `modelshade.py`, `modelviews.ts` again,
`partsheet.py`, `autocmp.py`, and my check pictures in `work/`). The JSON is the script's output plus the `shade`
entries `modelshade.py` adds; nothing is edited by hand.

## Start: from scratch
The body-layer parts are written new in the structure of `sedan29_model.py` (its `part()` and box rules; `S/F/B/T`
for the four views), with positions read off gridded 4x and 8x enlargements and off measured profiles (silhouette
extents per row and column, the bright areas of glass, nickel and hub caps). No outline uses `fit`: the read
positions already lay on the drawing. Only the chassis-layer parts come from the draft, moved onto this car's wheel
centres and width by the script. The under view was not used.

## Scale and size
The hub caps are 1294 units apart on the 4x side view (x 260 and 1554); with the 2788 mm wheelbase that is 8.62 mm a
pixel (the draft had 8.63, so its wheels were the true ones): length 4051, height 1810, wheels at x 560 and 3348,
tyre radius 384. Width 1700, the mean of what the front view (1736) and the rear view (1667) give at the side
view's scale. The plan view is drawn narrower (1527 at the same scale); it keeps its own proportions.

## Scores (autocmp.py; cmp.png, cmp.json)
| view | draft silhouette | direct silhouette | draft edges on lines | direct edges on lines |
|---|---|---|---|---|
| side  | 0.876 | 0.988 | 0.686 | 0.813 |
| front | 0.863 | 0.971 | 0.638 | 0.770 |
| rear  | 0.916 | 0.990 | 0.537 | 0.684 |
| top   | 0.916 | 0.977 | 0.615 | 0.682 |

## What was built (and how it differs from the draft)
- **Body in two for the side view**: `body` (green) and a new `bodyTop`, the black window band above the belt, as the
  side view paints it. `bodyTop` has a side outline only, because the front and rear views paint the same panels
  green up to the roof; so each view shows the sheet's own colour. The body's lower edge follows the rear wing.
- **Roof**: black cloth cap with its real profile (low at the front, rounded down at the back, drip moulding);
  new **`visor`** (the peak over the screen).
- **Radiator**: nickel shell with a low arch (side, front, plan); `core` in it, a dark name `plate` across its head
  with a bright `badge` bar (lettering left out on purpose), `shellFoot` (crank hole cover); `cap` with the winged
  figure in side and front outline. `lip` removed.
- **Lamps**: bullet lamps: `lamp` (dark bowl, side), `lampRim` (nickel rim; side, front, plan), `lens`, new
  `lampTop` (the bowl is bright from above on the sheet), `lampStand`, and the `lampBar` tie bar running from wing
  to wing in front of the core. `lampGap` removed.
- **Wings**: redrawn as the sheet's lit blades over black wheel houses: front wing from its tip over the crown and
  down the S to the board; rear wing with its tail. `house0/1` are the black under the blades (not half circles).
  Front, rear and plan outlines from the sheet; the light on them comes from `modelshade.py`.
- **Board**: `board` with a bright edge strip `boardTrim`; a new `sill` moulding along the body's bottom edge;
  the black `apron` valance between them. `step0/1` removed (the sheet has no step plates).
- **Windows**: three a side at the measured glass (`glass0-2`), each in a dark moulding (`wframe0-2`) with a new thin
  wood garnish (`wgarnish0-2`); one-piece screen in a dark frame with a `wiper` and the steering wheel's rim seen
  through it (`steerRim`); `rearFrame` + `rearGlass`. `screenBar`, `rearBar`, `pillar` removed.
- **Doors**: front door hinged at the front post, both handles by the centre post, the rear door's edge running
  down and forward round the wing (seams), hinges, belt bead, creases; handles are small nickel parts
  (`handle0/1`, `handleBoss0/1`) because the handle feature draws as a thin line.
- **Hood and cowl**: 20 louvres in their pressed panel, hinge seam, highlight; cowl band (trim), the pressed shape
  on the cowl side; the plan's hood hinge and cowl joint.
- **Bumpers**: front two bars with one clamp a side (`clampF0`; `clampF1` removed); rear two short bumperettes a
  side (`bumperR0/1` as pairs, `clampR0`) on body-coloured brackets (`bracketR`), not a full-width bar.
- **Tail lamp**: one, on a stalk at the left of the back (`tailStem`, `tailRim`, `tail`; no longer pairs).
- **Spare**: at the back, at the sheet's height and size (`spare`, `spareCarrier` filling the gap to the body).
  `spareHub`, `plateLamp`, `handleR` removed.
- **Colours** from the sheet: paint #2a382d, paint2 #2d2e2f, canvas #39393b (roof #323234), nickel #a59c8e, glass
  #a9abad; valances and houses a neutral black #1b1b1c.
- **Wheels**: artillery, 14 spokes, painted the body's green, rim 0.65, nickel hub cap 0.2.

Parts added (25): bodyTop, visor, plate, badge, shellFoot, lampRim, lampTop, sill, boardTrim, wgarnish0-2, wiper,
steerRim, handle0/1, handleBoss0/1, rearFrame, clampR0, bracketR, tailStem.
Parts removed (11): lip, pillar, screenBar, plateLamp, handleR, rearBar, step0, step1, lampGap, clampF1, spareHub.
All others keep the template's ids, elements, materials and slots.

## Where the sheet's views disagree (each view keeps its own; full list in work/build.log)
- Body half-width: 628 mm in the front view, 690 in the rear view, 700 in the plan (60-70 mm).
- The plan draws the hood/cowl joint about 80 mm further forward than the side view, and the board and front wing
  100-170 mm further forward and longer.
- The bowl of the lamp is dark in the side view and bright in the plan; the panels above the belt are black in the
  side view and green in the front and rear views; the roof is lighter in the side and rear views than in the plan.
- Front view: the body is drawn about 4 units left of the middle of the wings; the model is symmetric.
- Spare: 86 mm narrower in the rear view than in the plan; rear bumperettes 60 mm longer in the rear view.

## What is still wrong
- Thin bright parts draw darker than the sheet at the game's size: the front bumper in the plan, the rear
  bumperettes in the plan, the door handles and the sill moulding (a pixel or two between outlines).
- The shell draws cream and a little heavier than the sheet's nickel; the lamps' lenses are the stock bowl, not the
  sheet's fluted glass; the spokes draw thinner than the sheet's (known).
- Front wings from the front: the crown reads flatter than the sheet's bulbous crown; the dark piece above it by
  the body is taken into the wing's outline.
- Not modelled: the interior (seats, dashboard), the hinges and handles in the plan and front views, the bumper
  bar's curled ends in the front view, brake drums and springs in detail, number plates. The steering wheel is only
  its rim. The pressed shape on the cowl side is drawn with a square top.
- The spoke count (14) is read off a 45-pixel wheel; it could be 12-16.
- The front "edges on lines" (0.77) and rear (0.68) are held down by the core's cells, the glass streaks and the
  game's tyre tread more than by the outlines.
- The chassis layer is the draft's (the template's engine moved onto this car), not this car's four.
- The right-hand side view (`v_right.png`) was not checked; the model is the left view mirrored.

## With another hour
Chassis from `v_under.png`; the front wing's crown from the front fitted more closely; hinges as small nickel parts;
the lamp lens and the name plate in more detail; check against `v_right.png`.

## Time and rounds
About 1 h: ~35 min reading the views and writing the script, then 4 build-and-look rounds (the first build already
scored 0.98 / 0.96 / 0.99 / 0.98 silhouette). Nothing in the repository was changed.

Files: plymU29.py, plymU29.json, run.sh, cmp.png, cmp.json, parts.png, report.md, mv/ (the game's drawings),
work/ (grid crops `g_*.png`, overlays `ov_*.png`, sheet-beside-model `look_*.png`, `overlay.py`, `grid.py`, build.log).
