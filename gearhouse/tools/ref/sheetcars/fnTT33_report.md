# fnTT33 — 1933 light sports (sheet 51747984, left car) — Fable build

Written from scratch in the structure of tools/ref/sedan29_model.py (`fnTT33.py`, rebuilt by `run.sh shade`). The draft
was used only for the chassis layer (20 parts, moved onto this car's wheels). 75 parts (55 body-layer). About 20
minutes, 4 build rounds.

## Scale
Hubs at columns 57 and 456 of the side view, wheelbase 2590 mm -> 6.49 mm a pixel. Length 3382, height to the screen
top 1243, tyre radius 373. Width 1600 over the tyres (see disagreements).

## Scores (autocmp: silhouette / edges on lines)
| view | draft | direct |
|---|---|---|
| side | 0.766 / 0.687 | 0.945 / 0.859 |
| front | 0.771 / 0.851 | 0.886 / 0.896 |
| rear | 0.803 / 0.629 | 0.920 / 0.780 |
| top | 0.787 / 0.546 | 0.878 / 0.813 |

## Parts (all new; none of the draft's sedan body parts kept)
hood (side louvres, plan louvres, centre hinge, panel seams), strap0/1 + buckle0/1, cowl, body (cutaway side with bright
edge bead), deck (tail over the slab tank, rear panel seams), fuelCap, cockpit, screenFrame/screen (twin aero screens,
pair) + screenPivot, shell/core/guard/badge/radCap, fenderF/fenderR (cycle wings), fenderStayF/R, markerF/R, lamp/lampGap/
lens/lampBar/lampStand, mirror + mirrorArm (car's right), spotLamp (car's left), tailStalk/tailRim/tail, tyreF/R,
and the visible running gear: vis_frame, vis_under, vis_axleF, vis_axleFtop, vis_crossF, vis_leafF, vis_brakeF,
vis_damperF, vis_axleR, vis_axleRtop, vis_brakeR, vis_underR, vis_damperR, vis_exhaust, vis_silencer, vis_tailpipe,
vis_chain, vis_chainCase. Removed against the draft: roof, pillars, windows, boards, steps, bumpers, spare, wheel houses.
Wheel spec: wire, 48 spokes, bright rim, small hub.

## New elements
- `marker` — the small bright knob/lamp standing on the crown of each cycle wing (front and rear views on all four
  wings; side view on the rear wing's tail). Not a head lamp or tail lamp, sits on the wing: no existing element fits.
- `mirror` — the round mirror on an arm at the scuttle, car's right only (front and rear views). No existing element.
- Used from the brief's list: `cockpit`, `deck`, `strap`, `guard` (radiator mesh), `damper`, `chain`, `filler`
  (radiator cap and fuel cap). The spot lamp on the car's left is element `lamp` (id `spotLamp`).

## Curves
- Front cycle wing, side view: 29 points round the blade (crown and underside), read off a 10x gridded crop, then
  `fit=2`; mean move 5 mm. Rear wing: 27 points, move 4 mm. Front/rear views: the dome over the tyre 9 points plus the
  wing's tail coming down inboard of the tyre. Plan: 10-point lozenges.
- Tail (deck): side 17 points, plan half 9 points (the rounded end), rear half 10 points. Checked on the cmp
  difference picture (side silhouette 0.945).
- Scuttle and cutaway: cowl 11 points, body's cutaway edge 7 points.
- Hard: the wings' section in the front/rear view (dark green on black tyre: read by eye point by point), and the
  place of the rear wing, which the plan draws 23 px (150 mm) further forward than the side view.

## Open body
- Drawn: `cockpit` (black; plan: the whole opening with rounded rear corners; side: only the wedge that stands above
  the cutaway against the tail, where the sheet shows the seat back; rear: the dark band between scuttle and tail),
  the cutaway's bright edge as a bead, twin aero screens (frame + glass, side/front/rear/plan), bonnet straps with
  buckles, both filler caps, radiator stone guard, outside exhaust with silencer on the left, chain run and sprocket
  guard, front axle beam, dampers, dumb irons, stays, tail lamps on stalks.
- Left out under the rules: seats, steering wheel and column, dashboard and instruments (rear view), gear/brake levers.
- Left out for want of a tool: the flag decal on the bonnet side, the radiator badge's enamel (a small red-brown
  plate stands in), rivets, the cables over the front (orange wiring), the mesh guards over the head lamps (the `cells`
  detail draws near black and hid the pale lens; the lens is drawn plain).

## Disagreements between the views
- Width over the tyres: plan 1325 mm, front 1645, rear 1720 (at each view's own height scale). The model's width is
  1600; the plan keeps one scale both ways (so its wings sit at 570 mm from the centre), front and rear are squeezed
  3 % / 7 % across to 1600.
- Rear wing: plan 150 mm ahead of the side view. Screen: 320 mm high (raked) in the side view, 160 in the front view.
- Fuel cap 75 mm lower in the rear view than in the side view.

## Still wrong
- Side: the cockpit shows a black wedge where the sheet shows the seat; the far screen and the rear-wing stay are simple.
- Front/rear: the running gear between body and wheels is blocks, not the sheet's detail; rear edges score 0.78.
- Plan: steering arms, wing stays at the rear, the tie rod and the exhaust's bends are approximate; no rivets.
- Head-lamp mesh, flag, badge detail missing (above). Wire wheels draw brighter than the sheet's.
- With more time: under view not traced; lamp side shape (hidden behind the wing) is an ellipse guess from the front
  view's size; finer panel seams and the louvre count on the plan.
