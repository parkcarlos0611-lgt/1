# bmw315 (1935 roadster) — report (Fable build)

## What was built
Written from scratch (bmw315.py, structure of sedan29_model.py / the sheet cars); the draft was used only for the
chassis layer (20 parts, moved onto this car's wheels) and to confirm the wheel centres. 41 body-layer parts, 61 in all.
Three rounds (first build, occlusion fixes, small fixes); about 35 minutes.

Parts: `shell` (body-colour nose), `grilleL/R` + `coreL/R` (two kidney grilles, bright frames, mesh), `badgeF/In`,
`hood` (S-curved rear edge, 5 side slots, centre hinge, two banks of 24 top louvres), `body` (tub with the door cut, door
seam, body crease), `hinge0/1`, `deck` (rounded tail, boot-lid seam in rear and plan), `badgeR/In`, `handleR`, `cockpit`,
`tonneau`, `strap0/1` + `buckle0/1`, `fenderF`, `fenderR` (pairs), `lamp` + `lampRim` + `lens`, `noseBar`, `screenFrame` +
`screen` + `screenPost`, `tailRim` + `tail`, `house0/1`, `under`, `underR`, `tyreF/R`, `vis_axleF`, `vis_exhaust` (+Bore).
Removed against the draft: every sedan part (roof, pillars, windows, board, steps, bumpers, spare, lamp bar, cap ...).
The car has no bumpers, no running board, no spare outside.

## Scale and real sizes
Scaled by the wheelbase: tyre centres at 314 and 1788 on the 4x side view = 2400 mm, 1.628 mm a unit (6.51 mm a pixel).
| | sheet at this scale | real | difference |
|---|---|---|---|
| length | 3634 (side view; the plan gives 3541) | 3800 | -4.4 % |
| width | 1393 (plan at the side view's scale); model uses 1440 | 1440 | -3.3 % |
| height (screen top) | 1329 | 1350 | -1.6 % |
| track front / rear | 1132 / 1140 (front and rear views scaled to 1440 wide) | 1153 / 1220 | -2 % / -7 % |
| tyre radius | 379 | about 335 | +13 % (the sheet draws the wheels large) |

## Scores (autocmp, silhouette / edges on lines)
| view | draft | direct |
|---|---|---|
| side | 0.731 / 0.575 | 0.943 / 0.747 |
| front | 0.829 / 0.686 | 0.937 / 0.757 |
| rear | 0.828 / 0.368 | 0.917 / 0.572 |
| top | 0.873 / 0.519 | 0.959 / 0.626 |
(v_left has stray bits of the neighbouring drawings at the top and bottom edges; they are in the sheet's silhouette.)

## Joins
`fenderF` join body, fenderR, shell; `fenderR` join body, deck; `deck` join body; `body` join hood (the hood's rear edge
is kept as outline by the hood itself being a separate part). The one real seam kept: the short vertical seam between
the sill part of the front wing and the rear wing (x = 1378 units).

## Curves
- Front wing, side: 44 points (25 on the crown and sweep, 19 on the arch and nose); rear wing: 41 points. Read off 6x
  gridded crops (grid every 10 source px, labelled in 4x units), checked on the side-by-side and the silhouette
  difference in cmp.png. No line fitting (`fit=`) was used.
- Tail in plan: 10 points a half; rear wing in plan 21; front wing in plan 25. The plan's rear wing inner edge and the
  place the wing ends against the tail lamp were the hardest to read (cream on cream).
- Rear of the side view: two near-parallel lines run down to the tail lamp. I took the outer one as the tail (`deck`)
  and the inner one as the rear wing's crown; this is my reading, not certain.
- Wing section in the front view: 20 points including the valance sweeping to the nose; rear 15.

## Open body
- Drawn: `cockpit` (dark well in the plan; from the side a dark sliver over the door cut where the sheet shows seat
  and wheel), `tonneau` (dark brown cover, side/rear/plan), fold-flat screen (bright frame, two panes, posts), two
  bonnet straps with buckles.
- Visible running gear: `vis_axleF` (the dark axle/suspension mass in the front view), `vis_exhaust` (the pipe end,
  rear view, car's right). The side view shows no exhaust or springs.
- Left out under the rules: seats, steering wheel and column, dashboard, the hood-frame details. Also left out: tonneau
  studs, the padded cockpit rim (the sheet shows none), hub-cap badge, the far headlamp seen over the nose.

## Views that disagree (each keeps its own)
- Headlamps: side 170-375 units along, plan 116-256 (about 80 mm further forward in the plan); the front view draws
  them about 150 mm lower and larger than the side (perspective in the front view).
- The plan is 2.5 % shorter than the side view. Front view cowl top 55 mm below the side view's.
- Tonneau, deck, screen: 60-110 mm in width between rear view and plan.

## Still wrong
- Wheels: the sheet's pressed discs have a ring of 16 holes and a blue-white cap; the model's disc is plain.
- Headlamp from the side is small and its bright rim thin; lens pattern not drawn.
- Top view: the front wings' inner shading is blotchy; the wing/nose dip behind the lamps is approximate.
- Rear view: tonneau droops less at the ends than the sheet; the under-tail dark band is a plain strip.
- The body-colour crease lines on the wings (side view) are not drawn.
- parts check sheet came out as parts_1.png ... parts_5.png (partsheet splits by count).
With more time: line-fit the wing outlines, tonneau studs, screen stanchion detail, wheel holes as a feature if the
renderer gets one.

## New elements
- `noseBar` — two upright bright bars on the front valance under the headlamps (front view only). Not a bumper bar
  (no cross bar exists on this car) and not part of the grille; possibly overriders or horn/stay covers.
- Used from brief 64: `cockpit`, `tonneau`, `deck`, `strap`, `guard` (the mesh in the kidney grilles, parts `coreL/R`).
