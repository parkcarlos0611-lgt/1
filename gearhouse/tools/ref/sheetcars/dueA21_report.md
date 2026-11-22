# dueA21 — 1921 grand coupe (sheet 94e0a997, right column) — report

Written from scratch (`dueA21.py`), nothing snapped, the draft used only for the chassis layer. 61 parts (41 body
layer + 20 chassis from the draft), 2 rounds (first build, one round of corrections from the outline overlays), about
25 minutes.

## Scale
- Hub caps on the 4x side view at x 234 and 1598: 1364 units = 3404 mm, 2.496 mm a unit. Length 4742 (one source
  gives about 5230 for the real car: the sheet is about 490 mm short at the wheelbase's scale; not stretched),
  height 1996 to the roof (tall: the sheet draws the body and wheels large against the wheelbase), tyre radius 494
  (real about 419). Width kept at the draft's 1890.
- **The sheet draws the plan with the front to the right**, the side view with the front to the left. The repository
  tools read v_top.png as front-left, so the draft's plan fit was against a reversed drawing. `work/mkviews.py` writes
  `views/` with the plan (and under view) turned 180 degrees; every tool is run on `views/`. The cut step should turn
  it for this sheet (the SSJ in the left column is the same).
- The side cut held a piece of the drawing below (between the wheels at the bottom edge); `views/v_left.png` has it
  removed.

## Built (all read off this sheet)
Bonnet with belt pinstripe, 24 louvres, centre hinge; cowl with the stripe sweeping up to the belt; body with one door
a side (seams, three hinges, handle), belt stripe, sill line; two side windows a side (frame, dark reveal, glass);
upright two-pane windscreen with centre bar; two-pane rear window; back panel seam; black padded roof with its inner
seam; nickel radiator shell, dark core, badge, filler cap with mascot (`filler`); nickel drum headlamps on posts;
blade front wings with the inner sweep, deep rear wings, running board with bright edge, valance; one red tail lamp in
a nickel rim on each rear wing; visible running gear as `vis_` parts (front cross tube and horn ends, front axle mass,
rear tank with straps, rear frame end, rear axle mass); tyre sections front and rear. Wheels: wire, 40 spokes, black,
small nickel cap, `whitewall` 0.58. `gloss` 0.75. modelshade run last.

Removed against the draft: spare and carrier, both bumpers and clamps, third side window, steps, lamp bar, plate lamp,
pillar, rear handle (none are on the sheet). Added: cap, badge, window reveals, tank, cross tube, board edge.

## Scores (autocmp on views/; silhouette / edges on lines)
| view | draft | direct |
|---|---|---|
| side | 0.840 / 0.642 | 0.962 / 0.874 |
| front | 0.873 / 0.757 | 0.957 / 0.799 |
| rear | 0.866 / 0.474 | 0.966 / 0.723 |
| top | 0.851 / 0.477 | 0.963 / 0.625 |
(the draft's top score is against the turned plan, which the draft was not fitted to)

## Where the views disagree (each keeps its own)
- Plan against side, along the car: roof 906..1551 in the plan, 806..1483 in the side (about 100 units, 250 mm,
  further back in the plan); cowl and bonnet joint 50 units further back in the plan; lamps and shell agree.
- Width: body half width 661 mm in the front and rear views, 790 mm in the plan (the plan's roof is nearly as wide as
  the wings); bonnet 333 mm half width in front, up to 524 in the plan.
- The plan's body lies 7 units (18 mm) off the middle of its cut; the model is symmetric about the middle.
- Height scales: front view 992 units, rear 912, side 800 for the same car. build.log lists every part over 50 mm.

## Still wrong / not done
- Front corner posts with their narrow panes (front view) are only seams; the cowl's sweep up to the screen post is a
  step, not a curve; the screen has no plan bar (the roof's peak covers it, so none is due).
- Rear wing tail: the dark valance under the tip (side) is missing; front wing tip a few units short at the bottom.
- Headlamp: no separate rim part, no stays; the lamp is one nickel drum with a lens.
- Front suspension detail (springs, drag link, shock absorbers), tank straps' fittings, door hinges' true shape,
  the mascot's wings (front view only roughly) are masses or features, not parts.
- Window frames are black on black and barely show; the wing's bright edge mouldings are not drawn.
- The white walls shade to blue-grey at the lower right in the tool's render (the renderer's wheel light, not the model).
- The under view was not traced.
With another hour: corner posts and cowl curve, lamp rims and stays, wing mouldings as highlights, the plan's detail
behind the body (frame horns, tank straps), a check of every outline at 8x.

## New elements
None. The filler cap with mascot uses `filler`; the tank `tank`; cross tube and frame ends `frame`.

## Fix round (review)
Rebuilt on the coordinator's one-scale front and rear views (W is now 1940 from the front view's proportions).
- Side nose: the shell runs down behind the wing crown (the sheet's shell ends at the crown, y 358; the outline now
  goes to 374 so no gap can open), the bonnet's front lower edge follows the wing's underside, and a dark `lampStay`
  closes the space between lamp, shell and wing.
- Head lamp: drum body (rounder back), a separate bright `lampRim`, a `lens` that bulges forward in side and plan,
  and the `lampStand` now has a side outline down to the wing. Read off 16x side and 12x plan crops.
- Plan: lamps as above; shell at its read width (half 136 units at the back, 120 at the face); the dumb irons
  (`vis_hornF`) under the lamps, the cross tube with its end knobs (`vis_knobF`). The bar ahead of the lamps in the
  plan is the frame's front cross tube (the front view shows it under the radiator, y 700..755); the sheet shows no
  separate tie bar between the lamps in the front or side view, so none is drawn.
- Front, under the radiator: one black block replaced by `vis_backF` (the dark behind), `vis_axleF` (beam),
  `vis_drumF`, `vis_dragF` (the slanting rods), `vis_leafF` (spring packs end on, ribbed), `vis_hornF` (irons with
  bolts), `vis_crossF` (tube with its bright line), `vis_apronF` (the panel under it), `vis_crank` (the starting
  handle boss).
- Rear, under the body: `vis_backR`, `vis_axleR`, `vis_diffR`, `vis_rodR`, `vis_leafR`, `vis_tankBody`, `vis_tank`
  (the bright upper tube), `vis_barR`, `vis_hornR` (the horn ends with four bolts each).
- Core: `{'kind': 'core', 'pattern': 'slats', 'pitch': 14}`; the shell's front outline is no longer smoothed (its
  foot bowed).
- 78 parts. Scores after: side 0.965 / 0.876, front 0.952 / 0.804, rear 0.964 / 0.730, top 0.965 / 0.660.
- Still thin: the running gear is drawn in the sheet's own near-black, so it reads faintly; shock absorbers, steering
  arms and the spring shackles' true shapes are not parts; no bumper exists on this car.

## New elements (fix round)
- `crank`: the starting handle's boss on the front cross tube (front view). No existing element fits.
