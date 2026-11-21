# pontiac29 — "1929 six-cylinder sedan", made by the direct method

Sheet 998b3ae3, the left-hand car. Model: `pontiac29.json` (87 parts: 67 body-layer, 20 chassis-layer), written by
`pontiac29.py`. Rebuild: `./run.sh shade` (script, `modelviews.ts`, `modelshade.py`, `modelviews.ts` again,
`autocmp.py`, `partsheet.py`). The JSON is the script's output plus the `shade` entries `modelshade.py` adds
(hood, cowl, body, bodyTop, wframe0-2, fenderF, fenderR); nothing is edited by hand.

## Start: from scratch
Body-layer parts are written new in the structure of `sedan29_model.py` (its `part()`/`snap()`), outlines read point
by point off gridded 6x-10x enlargements of each view (`S()` side, `F()` front, `B()` rear, `T()` plan, all in
4x-view units). The draft was used only for its 20 chassis-layer parts, moved onto this car's wheel centres.

## Scale
Wheel centres measured on the cream rims of the side view: 227 and 1536 (4x units), 1309 apart; with the 2794 mm
wheelbase that is 2.134 mm a unit (8.54 mm a pixel): length 4030, height 1767, wheels at x 485 and 3279, tyre radius
375. The spare was not mistaken for a wheel; the size is plausible, so the given wheelbase was kept.
Width 1660 (the draft's): the plan view says about 1530, the front and rear views 1700-1750.

## Scores (autocmp.py; cmp.png, cmp.json)
| view | draft silhouette | direct silhouette | draft edges on lines | direct edges on lines |
|---|---|---|---|---|
| side  | 0.952 | 0.969 | 0.752 | 0.795 |
| front | 0.903 | 0.974 | 0.601 | 0.722 |
| rear  | 0.929 | 0.977 | 0.589 | 0.734 |
| top   | 0.903 | 0.960 | 0.614 | 0.724 |

## What was built (against the draft, which is the 1929 template stretched)
- **Body in two**: `body` (olive, to the belt) and `bodyTop` (black, above the belt, with the padded rear quarter's
  welt, the drip moulding, pillar seams in the front view). The body side follows the rear wheel arch behind the wing.
- **Roof**: low black cloth cap with its real profile; plan outline is the body's, with the inner panel's welt.
  New **`visor`**.
- **Radiator**: narrow shell with a thick arched top, `core` directly in it (no `lip`), `badge` + `badgeGem` in the
  arch, `crankCover` at the bottom; `cap` is the gilt mascot. The maker's lettering on the core is left out.
- **Hood / cowl**: 13 louvres, the bright hinge strip along the hood's side, latch, new bright `hoodBand` between
  hood and cowl, cowl ventilator lid in the plan, new `cowlLamp`s at the belt (front view).
- **Lamps**: bullet lamps (`lamp` in the sheet's steel grey, new `lampRim`, `lampGap`, `lens`) on black
  `lampStand`s; no tie bar (`lampBar` removed). New `fenderLamp`s on the front wings' crowns (front and plan).
- **Wings**: both redrawn as the sheet's blades over black wheel houses (side), the bulbous nose with the inner
  sweep to the frame (front), the rear wing following the body's curve (rear), and the plan outlines.
- **Board**: `board` with a full-length bright `boardTrim`; one `step0` plate at the front (plan), no second step.
- **Windows**: three a side in dark rounded surrounds with the thin stripe (`wframe0-2`, `glass0-2`); one-pane
  `screen` with a `wiper`; `rearFrame` + `rearGlass`.
- **Door handles** as small bright parts (`doorHandle0/1`, also standing out in the rear view); doors hinged at the
  A and C posts (seams, hinges), belt stripe as a thin bright line from the cowl to the back, sill crease.
- **Bumpers**: front two bars with a clamp a side and end clamps (`clampF0/1`); rear two split bumperettes a side
  (`bumperR0/1` as pairs, `clampR0/1`).
- **Tail**: two tail lamps on the rear wings (`tailRim`, `tail`), a blank number plate under the left one
  (`plateRim`, `plate`; lettering left out).
- **Spare** at the sheet's place and size, a wire wheel from behind.
- **Colours** from the sheet: paint #3c3c2e, paint2 #27282b, canvas #333338, chrome #a6a4a2, glass #969a9e;
  bodyTop #222224, valances and wheel houses #1e1e20.
- **Wheels**: wire, 36 spokes, rim 0.64, large bright hub cap (0.32, two rings).

Parts added: bodyTop, visor, badge, badgeGem, crankCover, hoodBand, wiper, cowlLamp, fenderLamp, doorHandle0,
doorHandle1, rearFrame, boardTrim, lampRim, clampF1, clampR0, clampR1, plateRim, plate.
Parts removed (template parts this car has not): lip, lampBar, pillar, screenBar, step1, plateLamp, handleR, rearBar,
spareHub. All others keep the template's ids, elements, materials and slots.

## What is still wrong
- **Wheel colour**: the sheet's wire wheels are cream. The wheel spec only takes paint, paint2 or bright for a wire
  rim, so they are bright (silver); a cream rim needs a colour field in the game's wheel spec.
- The sheet's views disagree, so the boxes cannot agree (each view keeps its own place; `work/build.log` lists 45
  differences over 50 mm). The main ones: the plan draws the whole nose 140-170 mm further forward than the side
  view (shell, cap, hood, cowl, lamps) and the rear end about 110-170 mm further forward (rear wing, bumperettes);
  the front view's wing sits about 165 mm lower than the side view's; the front bumper is 290 mm wider in the front
  view than in the plan; the widths differ as said under Scale.
- The wings read thinner than the sheet's lit crowns (the game's bevel leaves a narrow lit band), and the front
  wing's nose in the front view is less full than the sheet's round bulb.
- The roof in the plan draws lighter than the sheet's charcoal; the screen glass draws light where the sheet's is
  dark with a pale reflection.
- Not modelled: the interior (steering wheel seen through the glass), the blind behind the rear quarter window,
  frame horns and bumper stays in the plan, the twisted look of the bumper bars, brake drums from behind. The side
  view shows no cowl lamp, so `cowlLamp` is only in the front view; `fenderLamp` has no side outline (hidden by the
  headlamp). The chassis layer is the draft's (template engine moved); the under view was not used.
- `v_right.png` was not checked against the mirrored model.

## With another hour
Chassis layer from `v_under.png`; thicker lit wing sections; `tiles.py` round on every part; interior feature;
check the right-hand view.

## Time and rounds
About 55 minutes: ~30 min reading the views and writing the first script, then 5 build-and-look rounds
(`work/look.py` overlays, `work/pairs.py` side-by-sides; `work/all.png` is the last look). Nothing in the repository
was changed.

Files: pontiac29.py, pontiac29.json, run.sh, cmp.png, cmp.json, parts.png (parts_1..5.png singly), report.md,
mv/ (the game's drawings), work/ (helpers, build.log, shade.log, check pictures).
