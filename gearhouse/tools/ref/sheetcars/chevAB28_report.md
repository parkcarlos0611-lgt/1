# chevAB28 — "1928 light sedan", made by the direct method

Sheet 624bbd1c, the left-hand car. Model: `chevAB28.json` (85 parts: 65 body-layer, 20 chassis-layer), written by
`chevAB28.py`. Rebuild everything: `./run.sh shade` (script, `modelviews.ts`, `modelshade.py`, `modelviews.ts` again,
`partsheet.py`, `autocmp.py`). The JSON is the script's output plus the `shade` entries of `modelshade.py`; nothing
is edited by hand.

## Start: from scratch
The body-layer parts are written new in the structure of `sedan29_model.py` (`part()`, `half()`, box rules, names),
read point by point off gridded 8x crops of each view (`work/grid.py`, `work/g_*.png`). From the draft only the
chassis layer (20 parts) is taken, moved onto this car's wheel centres and width by the script. The line-fitting
(`fit=`) is not used: every outline is the point reading, checked by laying the model's outlines over the sheet
(`work/over.py`, `work/over_*.png`).

## Scale
Wheel centres at 264 and 1502 on the 4x side view = 1238 units = the 2718 mm wheelbase: 8.78 mm a pixel.
Length 4101, height 1844, wheels at x 580 and 3298, tyre radius 389 (the true road wheels; the spare was not taken
for one). Width 1700: the mean of what the front view (1731) and the rear view (1674) give at the side view's
scale; the plan view would give only 1533 (it is drawn narrower), so it was not used for the width.

## Scores (autocmp.py; cmp.png, cmp.json)
| view | draft silhouette | direct silhouette | draft edges on lines | direct edges on lines |
|---|---|---|---|---|
| side  | 0.934 | 0.982 | 0.720 | 0.851 |
| front | 0.934 | 0.968 | 0.645 | 0.730 |
| rear  | 0.955 | 0.980 | 0.535 | 0.689 |
| top   | 0.913 | 0.957 | 0.646 | 0.726 |

## What was built (against the draft / template)
- **Body in two**: `body` (blue, to the belt; its lower edge follows the rear wing so the wheel house shows dark)
  and **`bodyTop`** (black `paint2` with its own colour) over the window band, the pillars and the rear quarter,
  with the belt moulding as trim, the door and quarter seams, the upper hinges.
- **Roof**: low black cloth cap with the sheet's profile (rising from the screen, rolled over the back); **`visor`**.
- **Radiator**: tall narrow nickel `shell` with square shoulders, `core` straight in it (no `lip`), a plain blue
  enamel **`badge`** (no lettering), `cap` with the mascot's outline.
- **Hood**: 18 louvres in their panel, hinge seam, highlight; its lower edge hidden along the wing. `cowl` with the
  belt line and the bright band at its front edge (plan).
- **Lamps**: bullet lamps: `lamp` (dark-blue painted bowl), **`lampRim`** (nickel), `lens`, on a black `lampBar`
  (kept: this car has the tie bar; from the side it is the dark bracket ahead of the shell), short `lampStand`s.
- **Wings**: thin sweeping blades with a skirt (side), pod and inner sweep down to the frame (front), pods (rear),
  plan outlines with the front wing's tail running into the board. Crown highlights and a skirt seam.
- **Board**: black board with a bright **`boardTrim`** strip; no step plates (the sheet shows none).
  **`sill`**: the grey strip along the valance top under the doors.
- **Windows**: three a side: `wframe0-2` (black raised surround), **`wood0-2`** (varnished wood garnish), `glass0-2`;
  **`wframeQ`/`glassQ`** the narrow dark corner lights of the front view; one-piece `screen` in `screenFrame`
  (no `screenBar`), with **`wiper`** and **`steerRim`** (the steering wheel seen through the glass, left-hand drive);
  **`rearFrame`** + `rearGlass`.
- **Door handles** as nickel parts **`handle0/1`** either side of the centre pillar (side; ends in front/rear/plan).
- **Bumpers**: front two bars with one clamp a side; rear two-bar bumperettes a side (`bumperR0/1` pairs, `clampR0`).
- **Tail lamp**: one, on a stalk at the left of the back panel (`tailRim`, `tail`, **`tailStem`**).
- **Spare** on the back at the sheet's height and size, `spareCarrier`.
- **Colours** from the sheet: paint #223249, paint2 #2b2c2e, canvas #3a3b3d, nickel #a9a396, glass #b3b3b4;
  valances and wheel houses a neutral black.
- **Wheels**: artillery, 12 spokes painted blue, blue rim (0.64), small nickel hub cap (0.13).

Parts added: bodyTop, visor, badge, lampRim, sill, boardTrim, wood0-2, wframeQ, glassQ, steerRim, wiper,
handle0, handle1, rearFrame, tailStem, clampR0.
Parts removed (template/draft had them, this car has not): lip, lampGap, pillar, screenBar, step0, step1,
plateLamp, handleR, rearBar, clampF1, spareHub; tail lamps are one, not a pair.
All other parts keep the template's ids, elements, materials and slots.

## What is still wrong
- The sheet's views disagree, each keeps its own place (`sheet`), the common box is the mean (`work/build.log` lists
  all over 50 mm): the plan draws the nose 45–75 mm further forward than the side view (shell, cap, hood, cowl) and
  the whole car ~10 % narrower; the plan's roof is drawn ~30 mm off the centre line (the model's is centred); the
  body is ~90 mm wider in the rear view than in the front view; the spare sits ~40 mm further back in the plan.
- The lamp bowls are dark blue in the side view but nickel-grey in the plan; the model follows the side view.
- The game draws the shell cream rather than nickel, the bumper bars and the wings' lit crowns thinner than the
  sheet, and the glass with streaks; chrome and glass take no own colour, so the corner lights are a dark flat
  panel rather than glass. The screen is all pale glass; the sheet shows it dark outside the central reflection.
- Wings: blades over a black wheel house; the sheet's wing section is thicker and rounder at the front tip.
  In the rear view the wing pods are a little narrow at the top.
- Not modelled: interior, the mascot's detail, the cowl's small fitting, hinges as parts (they are features, 1–2
  pixels), the frame horns and the V of the bumper irons in the plan (thin straight irons only), brake drums.
- The chassis layer is the draft's (template engine moved onto this car); `v_under.png` was not traced.
  `v_right.png` was not checked separately (the model is symmetric but for the tail lamp, wiper and steering wheel).

## With another hour
Chassis from the under view; rounder wing sections and tips; a dark surround part in the screen; the plan's irons and
bumper curls; check the right-hand view.

## Time and rounds
About 1 h: ~35 min reading the views and writing the first script, then 5 build-and-look rounds
(`work/look_*.png` sheet beside model, `work/over_*.png` outlines over the sheet). Nothing in the repository changed.

Files: chevAB28.py, chevAB28.json, run.sh, cmp.png, cmp.json, parts.png (parts_1..4.png singly), report.md, mv/, work/.
