# bmw315 — notes for the know-how

## Methods
- **Grid** (work/grid.py): crop, enlarge 5-6x, grid every 10 source px labelled in 4x units. Read by the labels only.
- **Scale**: tyre extents on the hub row of the side view from the alpha/dark pixels (not from the hub cap, which sits
  above the tyre's middle); centres and radius from those.
- **Wing sweeping into the body**: one part from the nose to the sill end, crown + sweep + sill + arch in one side
  outline; `join=['body', ...]` so no outline where it runs into the body. Its plan outline has an inner edge along
  the bonnet joint. Body, hood, deck have smaller y, so the wing covers their lower edges in the side view: draw those
  parts down behind the wing rather than along it.
- **Shared edge** between hood and tub: one list of points (`HOODEDGE`) used by both outlines.
- **Rounded tail** (`deck`): surface `fender`, smooth in plan and rear; boot-lid seam as a `seam` feature.
- **Cockpit**: plan outline, `on='body'`, lift 1 (otherwise the body's box hides it from above); side sliver over the cut.
- **Kidney grilles**: `frrect` (rounded rectangle with radius = half width) for frame and core, mirrored by sign;
  core is element `guard`, `cells` detail.
- **Things that stand behind another part's front plane but beside it** (headlamps beside a nose that reaches further
  forward, tail lamps on a wing): `on=<that part>` with lift, else the box order hides them in front/rear views.
- **Straps**: `wood` material with a leather colour, `on='hood'`; side + plan rectangles; buckle as a bright part.
- **Horizontal bonnet slots**: `seam` lines (the `louvres` feature only draws uprights); plan louvres use `louvres`.
- **Tyre face on**: `rrect` with radius 0.42 of the width.

## Details caught (checklist)
- [x] two kidney grilles, bright frames, mesh; round badge above (front, plan)
- [x] body-colour headlamp shells faired back, bright rims (side, front, plan)
- [x] 2 leather straps with buckles (side, plan); 5 horizontal slots a side; 2 banks of top louvres; centre hinge
- [x] wings sweeping into the body, no running board, no bumpers
- [x] cut-down door with seam, 2 bright hinges at the front edge (side)
- [x] fold-flat two-pane screen with posts (side, front, rear, plan)
- [x] tonneau behind the seats (side, rear, plan); [ ] its studs
- [x] rounded tail with boot-lid seam, badge and handle (rear, plan)
- [x] tail lamps on the wing ends, red in bright rims (rear, side, plan)
- [x] exhaust end on the right (rear); [x] 2 upright bright bars under the lamps (front)
- [ ] disc wheels with 16 holes (plain disc used)

## Pitfalls
- I read the first plan and front crops in the enlargement's own pixels instead of the grid labels (crop starting at
  0 makes them look alike); found when the car's centre line came out at 688 instead of 552. Re-read by labels.
- Averaged boxes: a part read in two views that disagree (lamp: side/front heights) gets a box between them and then
  sorts under its neighbour in the plan; give `z=` (or `x=`) explicitly from the view you trust.
- Raising one part's outline in one view (body front) changed its box and hid the cockpit in the plan: use `on=`.
