# buick28 — notes for the know-how

## Reusable parts (all in buick28.py)
- **Scale block** (top): `K` from two measured hub centres; `S/F/B/T` map each view's full image to L/H/W. Change the
  six image sizes and centre lines. Measure the hubs by code (centroid of bright pixels near each hub), not by eye.
- **Wing as a band** (`TWF/LWF`, `OWR/IWR` + `fenderF/fenderR` + `house0/1`): the wing's upper and under edge as two
  point lists; the fender is the two joined, the wheel house is the under edge lowered 4 units and closed through the
  tyre, the body's arch (`ARCH`) is the mid line of the band. Reusable for any thin sweeping wing; the points are this car's.
- **Black upper body** (`bodyTop`, on='body', paint2 + colour): side polygon down to the belt, rear polygon with the
  belt's curve, plan outline = the body's. Particular here: no front outline (pillars are green from in front).
- **Pin stripes / thin bright bands as `trim` features** (body, cowl, hood): anything under about 25 mm wide. Takes
  point lists. Used for belt lines, hood hinge, hood/cowl band, plan hinge.
- **Window stack** (loop over `WIN/WOD/GLS`): frame, black reveal, wood surround, glass, each `on` the frame with
  lift 1..3. Takes three rectangles a window.
- **Seen-through parts**: `cabinSeen` (a ring with a slit, drawn on the screen: dark cabin round the back window's
  light), `wheelSeen` (arc band), `columnSeen`, `seatSeen`, `dashSeen` (plan). Sizes are this car's.
- **Visor**: three small outlines (side wedge, front band, plan strip).
- **Cowl lamp**: `cowlLamp`, pair, `on='cowl'` so it is not hidden by the cowl in front and plan views.
- **Drum headlamp on a bar**: `lamp` (full drum in side even where the wing hides half), `lampGap`, `lens`, `lampBar`, `lampStand`.
- **Front bumper, two bars + three clamps + stays**; **split bumperettes** (`bumperR{k}` pair with tapered inner
  ends, `clampR0`, `ironR`): loop over (side row, front row, rear row).
- **Framed plate under a single tail lamp**: `tailRim/tail/plateRim/plate`, non-pair, y positive = left of the rear picture.
- **Spare on the back**: `tyre_section()` for side and plan, `wheel={'r'}` + `ell` for the rear.
- **Board with edge strip**: `board`, `boardTrim` (on board), `step0` (plain grey in plan), `apron` + `sill`.
- **Artillery wheel spec**: style artillery, spokes counted by FFT of a ring of pixels round the hub, rimMaterial paint, trim.
- **Chassis block** (bottom): unchanged from the trial scripts.

## Details caught (checklist; * = the draft had it wrong or missing)
- [ ] * black upper body above the belt (side, rear, plan), green pillars from in front
- [ ] * black fabric roof with front peak; * visor (side, front, plan)
- [ ] * two pale gold belt lines (side, rear, cowl front); lit band between
- [ ] * rear doors hinged at the back: handles meet at the centre pillar; 8 hinges (side)
- [ ] * 3 windows a side with black reveal and wood surround; third window's glass narrower than its opening
- [ ] * steering column, seat backs through the glass (side); steering wheel, wiper, dark cabin (front); dash (plan)
- [ ] * cowl lamps, pair, nickel (side, front, plan)
- [ ] * nickel shell with peaked crown, red badge, winged cap; core to the frame (front, side, plan)
- [ ] hood: 26 louvres, bright hinge line, bright band at the cowl, catch (side); centre hinge (plan)
- [ ] * drum headlamps on a bar across the radiator, half behind the wing from the side
- [ ] * front bumper two bars, three clamps, two stays (front, side, plan)
- [ ] * rear bumperettes, split by the spare, two bars each, one clamp each (rear, side, plan)
- [ ] * one tail lamp, left; framed plate under it (rear)
- [ ] spare on the back, tread edge-on from side and plan, wheel from behind
- [ ] * wings as thin bands with daylight-correct wheel houses; inner skirt from in front
- [ ] * running board with full-length nickel edge strip; black valance with lit edge
- [ ] * wheels: artillery, 16 spokes, body green, nickel cap, bright rim edge
- [ ] hub caps standing out past the front tyres (front)
- [ ] rear window with wood surround (rear)

## Pitfalls
- **Widths read off a crop were 15 units too wide** (hinge bumps and roof gutter taken for the body side). Printing
  the alpha extent of sheet and model row by row (`work/` one-liner, see report) found it at once: front silhouette
  0.919 -> 0.952. Do this before trusting the eye.
- **Thin parts vanish**: anything 1-2 game pixels wide (pin stripes, the hood/cowl band, a plate rim under 14 units)
  is eaten by its dark outline. Use `trim`/`highlight` features on the painted part, or make the rim wider.
- **Mean boxes change the drawing order**: the wing's box from side+plan started behind the tyre's, so the tyre drew
  over the wing nose in the front view; the cowl lamp was hidden behind the cowl. Give `x=` explicitly, or `on=`.
- **The plan view disagrees most** (shorter front, cut lower edge, wandering centre line). The tyres' plan rectangles
  had to be pulled inside the wings' plan outlines or they showed.
- **`tyre_section(..., across_first)`**: leave the default for both side and plan; the False branch swaps the axes.
- A part with only a plan outline needs `z=`, with only a side outline `y=`.
- Crops at 7x: read positions off the printed labels, never off the picture's own pixels.
