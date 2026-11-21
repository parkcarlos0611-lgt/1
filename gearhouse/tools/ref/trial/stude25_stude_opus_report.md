# stude25: 1925 six-cylinder sedan, the hand-made model (direct method)

This is the right-hand car on the sheet (based on the 1925 Studebaker Big Six sedan). Model id `stude25`, name "1925 six-cylinder sedan".
- Script: `stude25.py`. Run it with `python3 stude25.py <views dir> stude25.json`. The views dir is this folder.
- Output: `stude25.json` (78 parts).
- Checks: `cmp.png` / `cmp.json` (autocmp, `draft=` and `direct=`), `parts.png` (the parts check sheet; the six pages from
  partsheet.py are placed side by side at half size, and the full-size pages are `parts_1..6.png`), and `mv/` (modelviews output).

## Method
I wrote the script from scratch in the structure of `tools/ref/sedan29_model.py`: the same `part()`, `snap()`, `half()`
and `halfT()` helpers, the same box and sheet rules and the same part names. I did not edit the draft. Every outline is read
off this car's four views. I used 4x pixel coordinates with one helper per view: `S` side, `F` front, `B` rear and `T` plan. Each
helper uses that view's own scale, because the sheet's views do not share one scale (the plan is stretched across). I read
the points off gridded 4x/8x crops of each view. The main panels were then snapped with `fit=` (2-2.5 px; mean move 1-9 mm).
I kept the draft's chassis layer (engine, gearbox, driveline, tank and the rest) and rewrote it in the script, setting the
axle-bound parts on this car's wheel centres.

Scale: L 4215, W 1879, H 1776 (the same as the draft). The wheel centres are at x 398 / 3452, a wheelbase of 3054 mm
against about 3048 on the real car. Tyre radius is 404 mm.

## What changed from the draft, and why
- **Colours**: the draft's olive-brown paint was wrong. Paint is now the sheet's dark green `#2a3d2e`. paint2 is black
  `#262728` (wings, upper body, visor). Canvas is `#3a393d` (cap) and chrome is nickel `#9c9693`.
- **Two-tone body**: on the sheet the body above the belt is black. A new part `upper` (body / paint2, on `body`) covers belt to
  cap in the side and rear views and the rim round the cap in the plan. In the rear view the belt dips at the corners,
  as the sheet draws it.
- **Visor**: new part `visor` (roof element), seen in the side, front and plan views.
- **Windows**: three side windows, re-read from the sheet. Each now has a varnished wooden frame (`wframe*`, material wood, colour
  `#4a3726`, the sheet's brown) and its glass inside. The rear window is one pane with a wooden frame (`rearFrame`). The
  centre bar is removed (`rearBar`).
- **Windscreen**: one pane, so `screenBar` is removed. The A-pillars (`pillar`) and the header (`screenFrame`) are now black.
- **Radiator**: a tall nickel shell with an arched top, a fine mesh core (`cells`, 22 mm) and a mascot on the cap. The draft's
  shell was too low and its core too coarse.
- **Headlamps**: they stand on their own posts (`lampStand`, front view). There is no tie bar, so `lampBar` is removed.
- **Cowl lamps**: new part `cowlLamp` (pair), the small nickel lamps at the belt beside the windscreen.
- **Wings**: the front wing is re-traced with its long, low sweep to the board. In the front view it has the sheet's
  crown, skirt and inner apron. The rear wing is re-traced in all three views. The arch cut is 460 mm.
- **Wheel houses**: placed in front of the body (y to 800), so no green shows inside the arches.
- **Running board**: there are no step plates, so `step0`/`step1` are removed. A new part `boardEdge` is the full-length metal edge strip the
  side view shows. The board is grey as on the sheet.
- **Rear**: the spare stands on end behind the body (side, rear and plan views; `spareHub` removed because the sheet does not show it). The two
  bumper bars run the full width behind the spare (the draft had split halves). There is one rear clamp part per side (`clampR`) and
  one tail lamp on the left only (`tailRim`/`tail`, no longer a pair) with its stay (`tailStay`). The number plate is
  below it (`plateRim` + `plate`). `plateLamp` and `handleR` are removed because the sheet shows neither.
- **Front bumper**: two bars, 899 mm half-width with rounded ends. The two draft clamps became one pair part, `clampF`.
- **Doors**: the shut lines are at the sheet's places (front door from the windscreen pillar, the B-pillar line, the rear door).
  Both handles sit at the B-pillar. There are a belt bead, a sill trim and hood louvres (24).
- **Wheels**: artillery, **12** spokes (the draft detected 13) painted the body green (`rimMaterial: paint`), a nickel trim ring, hub cap 0.2.

Parts removed (10): clampF0, clampF1, handleR, lampBar, plateLamp, rearBar, screenBar, spareHub, step0, step1.
Parts added (10): upper, visor, cowlLamp, boardEdge, clampF, clampR, rearFrame, plate, plateRim, tailStay. Total 78 parts.

## Scores (autocmp: silhouette agreement / share of the model's edges on drawn lines)

| view  | draft         | direct        |
|-------|---------------|---------------|
| side  | 0.910 / 0.690 | 0.953 / 0.722 |
| front | 0.877 / 0.737 | 0.957 / 0.763 |
| rear  | 0.916 / 0.632 | 0.967 / 0.780 |
| top   | 0.929 / 0.674 | 0.956 / 0.792 |

## What is still wrong
- The sheet's views do not agree with each other. The plan is stretched across, so the body is +-828 mm wide in the plan
  against +-638 mm in front. Each view keeps its own sheet box, as in the template, and the common box is their mean. The
  script prints the differences over 50 mm, and the large ones are body, roof and hood across.
- The headlamp reads a little bigger and whiter in the side view than the sheet's dark-bowled lamp.
- The roof's front slope in the side view sits a few mm high near the visor.
- The plan is simplified: the front wings are solid dark shapes, the board shows only as a strip, and the rear bumper's end loops are approximate.
- The number plate is a plain black panel with no lettering. The wiper, door hinges and hood catch are left out.
- The chassis layer is the draft's (template-derived), set on this car's wheel centres. I did not check it against `v_under`.
- `modelshade.py` was not run.

## Time
About 1.5 hours and 4 build iterations: one first full build, then fixes for colours (wood, board), the plan rim of the upper body,
and the tiles and parts checks.

With another hour I would check the chassis against the underside view, refine the headlamp's side shape, and add the plate
lettering and the wiper as features.
