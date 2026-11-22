# dueSSJ35 — notes for the know-how

## Methods
- **Grid** (grid.py): crop, 5-6x, labelled lines every 10 source px; all points read by label.
- **Plan drawn the other way round**: T(column, offset from the centre row) turns it in the script; run.sh writes
  work/views with v_top rotated 180 degrees for snap, autocmp and modelshade. The plan's second coordinate is drawn
  upwards: on the turned sheet positive = the car's right. Box y stays the true side (negative for the right).
- **Plan shorter than the side view**: one stretch factor (side length / plan length) in T.
- **Sweeping wing**: one side outline (crown, fall, sill, arch), paint2, fit=2; the rear wing `join=['fenderF']`.
  Body panels are drawn down behind the wing; a black `vis_arch` part fills the arch behind each wheel.
- **Pipes** (`tube(points, width)`): centre line read off the sheet, buffered to an outline with flat ends; highlight
  feature offset to the lit side; a bright ellipse for each port. `on='hood'` so the plan shows them above the wing
  and the side view under the wing's edge.
- **Right-side-only parts**: read off v_right with RS(col) = S(514 - col).
- **Screen in plan**: a thin bar at the top edge's x from the side view, width from the front view; glass has no plan.
- **Spare**: a rectangle/ellipse placing it, `wheel`, sparegen; strap as one Y-shaped `wood` part with a leather colour.
- **Double-bar bumper**: one bright part, a black gap part on it, irons on the gap (lift).

## Details caught (checklist)
- [x] 4 outside pipes, right side only, ports in the louvre panel (v_right, plan)
- [x] two-tone: pale body, darker wings and sweep
- [x] bullet head lamps on a bar; [x] twin horns; [x] double-bar front bumper, 2 irons; [x] rear bar + 2 irons
- [x] side louvres 25, two top banks, centre hinge; [x] rear-hinged cut-down door, 2 hinges, handle at the front
- [x] tan folded hood behind the seats; [x] tail spare with 3-leg strap; [x] round red tail lamps on the wings
- [x] luggage lid on the tail (plan); wing markers (plan); mirror on the screen's top rail
- [ ] bonnet catches, wind wings, tonneau studs, spare tilt, knock-off ears

## Pitfalls
- The side view's order uses |y|: a right-side part cannot be hidden in the left view.
- The plan's sign: first had the pipes on the wrong side (negated once too often); checked with an overlay on the turned plan.
- modelshade turned the paint2 wings black; removed their shade in run.sh.
