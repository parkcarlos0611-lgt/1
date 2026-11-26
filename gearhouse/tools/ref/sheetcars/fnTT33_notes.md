# fnTT33 — notes for the know-how

## Methods
- **Units**: outlines in source pixels of each view (not 4x); `S F B T` carry each view's ground row, centre column
  and scale. Grid crops (`work/grid.py view x0 y0 x1 y1 scale out`) at 4x for the whole view, 10x for thirds.
- **Scale for an open car**: hubs for K; ground row = hub row + tyre radius (the image crops the tyres' bottoms).
- **Each view isotropic where the views disagree in width**: the plan uses K both ways (`T`), so plan parts keep
  their true shape; front/rear are fitted across to the model's W.
- **Cycle wing**: one closed blade in the side view (crown points forward-to-back, underside back), `smooth`,
  `fit=2`, no `cutWheel`; front/rear: dome plus the tail seen inboard of the tyre; plan: lozenge. `pair=True`.
- **Cockpit**: black `flat` part with `lift=1`; plan = opening, side = only what stands above the cutaway, rear = band.
- **Twin aero screens**: `screenFrame` + `screen` with `pair=True`, outlines given for one side (positive dx).
- **One-sided parts** (mirror, spot lamp, exhaust): front outline with -dx is the viewer's left; the rear view is
  mirrored by the renderer (give the same sign as the front for the same physical side); the plan's lower half is
  negative dy. Check on the render, it is quick.
- **Things behind a big part's box** (tail lamps beside the tail): give x at the very rear (L-30..L) or they are hidden.
- **Straps**: `wood` material with a leather colour, `on='hood'`, lift 1; buckles chrome, lift 2.
- **Visible running gear**: `vis_` parts with explicit boxes; one outline in the view that shows them.
- **tyre_face(fn, d0, d1, top_row, ground)**: tyre seen face on from its inner/outer edge and top row.

## Details caught (checklist; the draft, a moved sedan, had none of these)
- [x] Two leather bonnet straps with buckles (side, plan)
- [x] Bonnet side louvres (12, one group between the straps), plan louvres both sides, centre hinge
- [x] Radiator: bright shell, mesh stone guard, badge, tall cap (side, front, plan)
- [x] Twin aero screens, raked (side, front, rear, plan)
- [x] Cutaway cockpit sides with bright edge; open cockpit (plan)
- [x] Slab tail with panel seams and a large filler cap (side, rear, plan)
- [x] Four cycle wings, with a small marker on each crown
- [x] Head lamps on a cross bar, stands; stays from the frame to the wings (front)
- [x] Mirror on the right, spot lamp on the left (front, rear)
- [x] Two red tail lamps on stalks beside the tail (rear)
- [x] Outside exhaust and silencer on the left (side, plan); chain and sprocket guard (side)
- [x] Wire wheels, bright rims
- [ ] Flag on the bonnet side, lamp mesh guards, rivets, wiring over the front, friction-damper detail

## Pitfalls
- Reading which side is which in rear and plan views: got the mirror wrong once by "fixing" a correct render.
- `cells` detail on a lamp lens turns it black; fine on the radiator.
- Width: forcing one W on the plan made the wings 10 % too far out against the sheet; giving the plan its own
  scale fixed it (top silhouette 0.847 -> 0.878).
