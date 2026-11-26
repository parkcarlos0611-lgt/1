# dueSSJ35 — 1935 grand roadster (sheet 94e0a997, left column) — report

Written from scratch (`dueSSJ35.py`, rebuilt by `./run.sh shade`) in the structure of sedan29_model.py / the open cars.
The draft gave only the chassis layer (moved onto this car's wheels). One build round, one correction round, about 20 minutes.

## Scale
Hub caps at columns 60 and 422 of the side view, wheelbase 3175 mm: 8.77 mm a pixel. Length 4517, height to the
screen top 1509, tyre radius 421. Width set to 1800: the plan gives about 1700, the front view at its own height
scale about 2050; 1800 puts the front track at 1430 (no checked width exists; the real track is near 1420).
The sheet's plan has the front at the right: the tools use work/views/ (v_top turned 180 degrees, made by run.sh).
The plan is 3 % shorter than the side view (stretched to the side's length in `T`).

## Built (47 body-layer parts + 2 seat parts from seatgen + 20 chassis-layer parts from the draft)
shell (painted, bright bead), core (ribs), centre bar, radCap; hood (25 side louvres, two banks on top, centre hinge,
belt seam), cowl, body (rear-hinged cut-down door: seam, 2 hinges, handle), deck (luggage lid seam, hinges);
cockpit; tonneau (tan, folded hood and cover); raked screen frame + glass (plan: the frame's top bar only), mirror;
fenderF (paint2, one sweep from the nose over the wheel down to the sill), fenderR (joined, no seam), sill strip
(`board`), apronF; bullet head lamps, lens, stands, bar; twin horns; double-bar front bumper with irons; rear bumper
with irons; tail lamps on the rear wings, wing markers; spare (sparegen) with its three-leg strap and hub;
four exhaust pipes with their ports on the right (y < 0), read off v_right, each its own part with the lit edge,
plan outlines from the plan; dark arches and undersides (vis_arch*, vis_under*). Gloss 0.85, two-tone paint/paint2.
Removed against the draft: every sedan part (roof, pillars, windows, boards, steps...).

## Scores (autocmp: silhouette / edges on lines)
| view | draft | direct |
|---|---|---|
| side | 0.70 / 0.69 | 0.94 / 0.79 |
| front | 0.80 / 0.79 | 0.91 / 0.83 |
| rear | 0.79 / 0.72 | 0.93 / 0.75 |
| top | 0.87 / 0.59 | 0.94 / 0.68 |

## New elements
- `horn`: the two small bright bells above the front bumper irons (front view only). Not a lamp, not part of the bumper.

## Curves
- Front wing sweep (side): 34 points, crown, the long fall to the sill, the arch; pulled onto the drawing (fit=2).
- Rear wing (side) 31 points; front wing in the front view 16, plan 18. Tonneau side 16. Checked by eye against
  the sheet in cmp.png and a plan overlay only; not tile by tile (no time).

## Open body
Drawn: cockpit well (side sliver, plan, rear), tonneau, screen, seats by seatgen (bench, #b98a52). Not drawn:
steering wheel, dashboard, door trim, the wind wings' detail, the hood frame irons.

## Still wrong / to know
- **The exhaust shows in the left view too.** The renderer orders the side view by |y| (render/car/model.ts `depth`), so
  a part on y < 0 is not hidden behind the bonnet in the left view; the pipes' boxes are truthful (y -640..-440,
  `on: hood`). The game needs a signed side view to hide them on the left. Side x of the pipes (v_right) and their
  plan x differ by about 100 mm (the views disagree).
- **modelshade on the dark wings** drew them near black; run.sh removes the shade of paint2 parts (they keep the flat
  paint2 colour). The body panels carry the sheet's light.
- The spare is tilted on the sheet's side view; sparegen draws it upright, edge on. The strap is not drawn in the side view.
- Radiator shell: read as painted with a bright bead; could be bright metal (the front view is ambiguous).
- Front view: the space between wings and shell is one black part (no axle, springs, dumb irons, frame horns);
  rear view the same. Head lamp stands are simple. No bonnet catches, no screen wind wings, no tonneau studs beyond two,
  no rear bumper in the plan, no wheel knock-off ears, door handle is the stock feature.
- Views disagree: lamps sit about 180 mm further forward in the plan than in the side view; bumper width plan 890 /
  front 1200 mm; see work/build.log.
- With more time: tiles check of each part, the front axle and springs as vis_ parts, the spare's tilt, lamp shape.

## Fix round 2 (after review)
Kept the coordinator's changes (front/rear views one scale both ways, W = 2057; spare tilt 14, into 150; core detail).
- Front view: screen frame (half width 84 px) now sits inside the cowl (84) and body (92); grille core runs to row 140,
  the bumper's top edge, with the bright slats detail (`core`, slats, pitch 40, metal).
- Under the radiator: the black block is now only the shadow under the wings (rows 100-168, element `house`); in
  front of it vis_axleF (dropped beam), vis_leafF, vis_ironF (dumb irons), vis_brakeF, vis_damperF, read off a 6x crop.
  Under the tail: vis_axleR with the final drive's bulge, vis_leafR, vis_shackleR, vis_brakeR.
- Plan: front bumper with rounded ends, the seam between the two bars and a lit edge, irons out from the frame
  (bumperFiron2, bolts), end knobs (bumperFend), the dark cross member with its studs (vis_crossF), the lamp bar and
  the horns; rear bumper ends (bumperRend, a pair: the plan shows only the ends, the rest lies under the spare).
- Scores now: side 0.94/0.80, front 0.91/0.85, rear 0.93/0.74, top 0.96/0.69.
- Still weak: the running gear under the nose and tail is dark-on-dark on the sheet and read coarsely (blocks with
  the right places, not fine shapes); the horns in the plan are indistinct on the sheet (placed where the bright
  clamps show); the front bumper's irons in the plan are mostly under the cross member.
