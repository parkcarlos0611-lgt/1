# dodgeV28 — notes for the know-how

## Reusable parts (all in dodgeV28.py; numbers are 4x-view units through S/F/B/T)
- **Helper block** (top of the script, from pontiac29.py): `S F B T`, `half/fhalf/bhalf/halfT`, `fell/bell`,
  `rrect/srrect`, `snap`, `part`. Per car change only the scale block (K, L, H, W, FX, RX, R and the four view
  sizes) — and the view sizes inside `fell`/`bell` (they are written out there; easy to forget).
- **`arch(wx, r, lo, hi, low)`** wheel house: takes the wheel x, a radius, and the x limits where daylight shows.
  The radius must reach the wing's underside measured from the *model's* hub (z = R), not the sheet's.
- **Black upper body** `bodyTop` + **`belt`** band: bodyTop is the body's outline cut at the belt; `belt` is a
  `paint` part with its own colour lying `on='body'`, with side, rear and front outlines. Particular here: the
  upsweep over the rear quarter and that it runs round the back.
- **Window stack** loop `WIN`: three rectangles per window (surround, wood, glass) -> `wframeK`, `woodK`, `glassK`,
  each `on` the one before. Particular: the wood is wide only at the rear edge.
- **Seen through the glass**: `seenWheel`, `seenSeat1/2` (`wood` material with a colour, `on='glassK'`, lift 1). Any
  car whose sheet shows a wheel or seats can take them with new points.
- **Dark screen from in front**: `screen` (glass) + `cabin` (black with colour, on screen, lift 1) + `screenThrough`
  (glass, lift 2) + `steering` (lift 3) + `wiper` (lift 4). A `color` on a glass part is ignored, hence `cabin`.
- **`visor`**: 7-point side wedge, front band, plan strip.
- **Drum lamp on a stand**: `lamp` (black bowl, side+front+top), `lampRim` (bright, side+top), `lampGap`, `lens`,
  `lampStand`; **`lampBar`** tie bar (front only, surface `fender`, at least 18 units high or it draws as a line).
- **`cowlLamp`**: `on='cowl'`, lift 2, side + front + plan. Without `on` the cowl's box hides it in side and front.
- **Split bumperettes**: `bumperR0/1` with `pair=True`, rear outline with a pointed inner end, `clampR0`.
- **Single tail lamp and plate**: no `pair`; positive y is the car's left (left of the rear view). Give them an x
  behind the rear wing's box or the wing hides them.
- **Board with edge strip**: `board` (chrome with a grey colour, `ribs`) + `boardTrim` (on board, lift 1).
- **Spare**: `tyre_section` for side and plan, `bell` for the rear, `wheel={'r': ...}`.
- **Artillery wheel spec**: `{'rim': 0.68, 'style': 'artillery', 'spokes': 16, 'rimMaterial': 'paint', 'cap': 0.2,
  'capRings': 1, 'trim': True}`.
- **Chassis block** at the end: unchanged from pontiac29.py.

## Details caught (checklist; * = the draft had it wrong or missing)
- [x] * Body black above the belt, blue below (side, front, rear)
- [x] * Belt moulding: broad lighter band, upswept at the rear quarter, round the back (side, rear)
- [x] * Visor over the screen (side, front, plan)
- [x] * Three windows a side with black surrounds and wood garnish, widest at the rear edge (side)
- [x] * Steering wheel and seat backs through the side glass (side); steering wheel through the screen (front)
- [x] * Screen: one pane, dark, rear window showing through, wiper from the top (front)
- [x] * Rear window: wood surround, rounded corners (rear)
- [x] * Doors: front hinged at A post, rear at C post, 2 hinges each below the belt, hinges above; double B-post line
- [x] * 2 bright door handles either side of the B post (side; front and rear as bulges)
- [x] * Radiator shell: flat, broad arched top with centre dip, winged badge, mesh core, winged cap (front, side, plan)
- [ ] Maker's lettering on the core (left out on purpose)
- [x] * Headlamp tie bar across the shell (front)
- [x] * Drum headlamps: black bowl, bright rim, pale lens, on stands (side, front, plan)
- [x] * 2 cowl lamps (side, front, plan)
- [x] * Hood: about 24 louvres, hinge seam, lit shoulder, latch; bright band at the cowl (side, plan)
- [x] * Wings black, crease along the crown; dumb iron end ahead of the front wing (side)
- [x] * Running board: aluminium plate, full-length bright edge strip, no step plates (side, plan)
- [x] * Front bumper: 2 bars, 2 clamps, centre medallion (front, side, plan)
- [x] * Rear: 2 split bumperettes a side, pointed inner ends, 1 clamp each (rear, side, plan)
- [x] * 1 tail lamp on the left, plate under it (rear)
- [x] * Spare on the back, artillery wheel (side, rear, plan)
- [x] * Wheels: artillery, 16 spokes, body blue, thin bright rim ring, nickel cap
- [x] * Tyre radius (392, not 404) and width

## Pitfalls
- **Tyre radius from "hub to ground" was 7 % too big.** The sheet's hub cap sits above the tyre's middle. Measure
  the tyre's width (left to right edge on an 8x crop) and halve it. Too big a tyre swallowed the wing's underside
  and made the wing look like a thin line — I first blamed the wing.
- **A gap of daylight between tyre and wing**: after shrinking the tyre the wheel house (radius from the model's
  hub) no longer reached the wing's underside. I lost time suspecting `cutWheel`; the house part alone drew fine.
  Check the house's top z against the wing's underside z.
- **Misreading a gridded crop that does not start at 0**: I read the plan's rear bumperettes 25 units off. Use the
  labels, never the picture's pixels, and check with the overlay (`work/look.py`) straight after.
- **Order by boxes**: small parts on a big one (cowl lamp, tail lamp, plate) vanish when their box lies inside the
  big part's. Use `on=` or an x/y outside it.
- **Thin bright parts** (under about 25 mm) draw as a dark line (two outlines): use a `trim` feature, or make them
  thicker with surface `fender`.
- **The front and rear grids are 5x pictures with 4x labels** in my crops; clamps and lamps must be read by label.
- The plan view is not centred on the sheet (about 8 units low); measure half-widths as (bottom - top) / 2.
