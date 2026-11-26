# fordT23 — "1923 small sedan", made by the direct method

Sheet 358adfbc, the left-hand car. Model: `fordT23.json` (79 parts: 59 body-layer, 20 chassis-layer), written by
`fordT23.py`. Rebuild: `./run.sh shade` (script, `modelviews.ts`, `modelshade.py`, `modelviews.ts` again, `partsheet.py`,
`autocmp.py`, look sheets). The JSON is the script's output plus the `shade` entries `modelshade.py` adds; nothing is
edited by hand.

## Start: from scratch
The draft is the 1929 template stretched onto this car (rounded shell, bullet lamps on a bar, bumpers, a spare, two
tail lamps, wire wheels, 350 mm tyres, 1823 wide). The body-layer parts are all written new from 8x gridded crops of
each view (`S()` side, `F()` front, `B()` rear, `T()` plan, in 4x-view units). Only the 20 chassis-layer parts come
from the draft, moved onto this car's wheel centres and width by the script.

## Scale
Wheel centres at 180 and 1250 on the 4x side view (the true wheels; this car carries no spare) = 1070 units for the
2540 mm wheelbase: 9.50 mm a pixel. Length 3475, height 2146, wheels at x 427 and 2967, tyre radius 423. Width 1740
from the plan view (half the length), which gives a 1.40 m track on the front view. The length is right for this car;
the height (2.15 m) is above the brief's 1.70-1.95 m band because the sheet draws the body tall and the wheels large
for the wheelbase (scaled by a 30 in wheel instead, the car would be 1.98 m high but only 2.34 m in wheelbase). I kept
the wheelbase scale, as given.

## Scores (autocmp.py; cmp.png, cmp.json)
| view | draft silhouette | direct silhouette | draft edges on lines | direct edges on lines |
|---|---|---|---|---|
| side  | 0.829 | 0.959 | 0.623 | 0.831 |
| front | 0.887 | 0.920 | 0.697 | 0.848 |
| rear  | 0.913 | 0.953 | 0.466 | 0.787 |
| top   | 0.915 | 0.985 | 0.604 | 0.783 |

## What was built
- **Body**: one tall square black body to the roof rail (no separate upper: the sheet paints it all one black); four
  doors (seams at the front pillar, the centre pillar, the rear door edge and the rear quarter), five hinges, belt
  bead, sill crease; back panel with its two seams, curved belt moulding and lower moulding; front corner panels.
- **Roof**: flat cloth top with its rail, slightly wider and longer than the body; the cloth insert's seam in the plan.
  New **visor** hinged at the roof's front edge.
- **Hood, cowl**: low straight hood with the hinge seam, the lower panel's frame, 6 louvres; the plan's tapering hood
  with its centre hinge; short cowl rising to the screen.
- **Radiator**: low arched nickel shell, plain header, cell core, small `badge` plate (the maker's script on the core is
  left out on purpose); `cap` with its cross handle.
- **Windscreen**: `screenFrame`, wood surround `screenWood`, glass, horizontal `screenBar` and centre `screenPost`
  (four panes). The steering wheel shows through the glass as the sheet draws it (`wheelSeen`, `wheelHub`: front and side).
- **Side windows**: three a side, each `wframe` (raised reveal), `wwood` (wood surround) and `glass`.
- **Back window**: `rearFrame`, `rearGlass`, centre `rearBar`, and the `seatBack` showing through its lower part.
- **Wings**: thin sweeping blades (side) over a dark wheel house shaped so daylight shows where the sheet shows it;
  rounded noses and the inner skirt `sweepF` running in to the frame (front); rounded-box rear wings (rear); plan outlines.
- **Running board**: grey pressed board with a bright edge (`boardTrim`), a ribbed tread `step0` in the plan; the
  valance (`apron`) above it with its lit rolled edge (`sill`).
- **Lamps**: drum headlamps low between the wings: black bowl `lamp`, nickel `lampRim`, `lens`; hidden behind the wing
  in the side view exactly as on the sheet; the bright post in front of the shell's foot is kept as `lampStand`.
  One tail lamp on the left of the back panel (`tailRim`, `tail`).
- **Door handles** as nickel parts (`handle0`, `handle1`; knob in the front view, dot in the plan), not thin features.
- **Running gear**: forged front axle with king pins, transverse springs front and rear, starting handle (`crank`),
  rear axle with its banjo and brake plates, bright hub caps (`hubF`, `hubR`), fat tyres as drawn.
- **Wheels**: artillery, 12 spokes, natural wood, rim 0.72, small bright cap.
- **Colours**: paint #1d1d1e, canvas #2b2b2e, nickel #8f8873, glass #acacac. `paint2` is #8a6944, the wheels' wood:
  the game's artillery wheel takes its spoke colour only from paint or paint2, so the wings (material paint2, as the
  template) carry black as their own `color`.

Parts added: visor, sweepF, sill, boardTrim, badge, crank, hubF, hubR, screenWood, screenPost, wheelSeen, wheelHub,
wwood0-2, handle0, handle1, rearFrame, seatBack, lampRim.
Parts removed (the car has none): bumperF0/1, bumperR0/1, clampF0/1, ironF, ironR, spare, spareHub, spareCarrier,
lampBar, lampGap, lip, pillar, plateLamp, handleR, crossF, step1 (one tread a side).
All other parts keep the template's ids, elements, materials and slots.

## What is still wrong
- The sheet's views disagree; each keeps its own place, the common box is the mean (`work/build.log` lists 28 cases
  over 50 mm). The large ones: the plan draws the hood ending about 200 mm further forward than the side view
  (hood 64/80 mm, cowl 100 mm, board 92 mm from the mean), and the shell 78 mm narrower than the front view does; the
  plan's roof ends 80 mm short of the side view's; the front wing's nose sits 128 mm lower in the front view than
  the wing's crown in the side view (they are different sections of it).
- Height 2146 mm (see Scale): tall for the game's lot if the cars stand side by side.
- paint2 holds the wood colour; repainting "paint2" in the game would recolour the spokes, not the wings.
- The game draws the shell cream-bright (the sheet's is dull nickel), the cap and hinges nearly black (small parts
  are eaten by their outline), the wood spokes thin and the hub bright where the sheet's hub is black.
- The steering wheel is only the rim arc, a three-arm hub and the rim edge-on; no seats or dashboard.
- Front view: silhouette 0.92; the axle, spring and radius rods are simpler than drawn, the tyres' bulge is not exact.
- Plan: the front wings' inner edges are guessed (black on black on the sheet); the lamps' bowls draw flat black.
- The rear body edge in the side view was pulled slightly wavy by the line fit.
- The chassis layer is the draft's (the template's engine moved); the under view was not used.

## With another hour
Chassis from `v_under.png` (this car's transverse springs and torque tube show well there); a proper steering wheel
with its four spokes; tile-by-tile check of the plan's wings; a darker header on the shell; check against `v_right.png`.

## Time and rounds
About 55 minutes: ~30 min reading the views and writing the script, then 5 build-and-look rounds (look sheets in
`work/look_*.png`, `work/final.png`). Nothing in the repository was changed.

Files: fordT23.py, fordT23.json, run.sh, cmp.png, cmp.json, parts.png (parts_1..6.png singly), report.md, mv/, work/.
