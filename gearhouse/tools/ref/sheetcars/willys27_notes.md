# willys27 — notes for the know-how

## Reusable parts (all in willys27.py)
- **View mappers and shape helpers** (top of the script): `S/F/B/T`, `side/fr/re/top`, `fhalf/bhalf/halfT`, and
  `sell/fell/bell/tell` (ellipses given in a view's own units), `srrect/frrect/brrect` (rounded rectangles by two
  corners). Takes only the views' sizes in 4x units (`SW, SH, FW, FH, BW, BH, TW, TH`) and the wheel centres. Nothing
  particular to this car.
- **Wood window surround** (the `WIN` loop): three stacked parts per window — `wframe{k}` (material `wood`, colour
  override), `wreveal{k}` (black, inset 9 units, `lift=1`), `glass{k}` (`lift=2`), each `on` the one below. Takes the
  surround's and the glass's corners. Particular: the glass rectangle is only the pale part of the pane. The same
  three-layer block is reused for the rear window (`rearFrame/rearReveal/rearGlass` + `rearBar`) and the screen.
- **Wood-framed two-pane screen** (`screenFrame`, `screenIn`, `screen`, `screenBar`, `screenTop`, `wiper`): front
  outline by `frrect`, a side outline for the frame seen edge on, a plan outline for the frame's top rail.
- **Corner posts with panes** (`postF`, `postGlass`): a pair `on` bodyTop, front view only; takes two rectangles.
- **Black upper body** (`bodyTop`): the body's own side outline cut at the belt, `on='body'`, `y=[0, half width]`,
  colour override; mouldings as `highlight` features. Particular: the green-black colour.
- **Visor**: side wedge, front band, plan strip; `canvas`, `roof` surface. Takes ~9 side points.
- **Cowl lamp** (`cowlLamp` + `cowlLens`): three ellipses (`sell`, `fell`, `tell`); position and radius only.
- **Drum/bowl headlamp on a post**: `lamp`, `lampRim` (side), `lampGap`, `lens` (`detail: bowl`), `lampStand`,
  `lampBar` (plan only). Takes the side profile, the face-on centre and radius, the plan profile.
- **Full-width double bumper with clamps and end caps** (the `for k` loop + `clampF/endF/clampR/endR`): bar heights
  per view, half width, clamp offset.
- **Board with edge strip** (`board` + `boardTrim`): two rectangles in side and plan.
- **Exposed door hinges and handles as parts** (`hinge{k}`, `doorHandle{k}`): small chrome polygons `on='body'`,
  `lift=2`, own thin `y`.
- **Wheel house arch** (`arch()`), **tyre section** (`tyre()`, `tyre_section()`), **chassis from the draft** (last
  block): as in the pontiac29 script, unchanged.
- **Wire wheel spec painted body colour**: `{'rim': 0.63, 'style': 'wire', 'spokes': 40, 'rimMaterial': 'paint',
  'cap': 0.2, 'capRings': 2}`.

## Details caught (checklist; * = the draft had it wrong or missing)
- [x] * body black above the belt, olive below — side, front, rear
- [x] * visor — side, front, plan
- [x] * wood surrounds on 3 side windows a side, rear window, windscreen — side, rear, front, plan
- [x] * rear window in two panes (centre bar) — rear
- [x] * windscreen in two panes, wood-framed, standing ahead of the posts — front, side, plan
- [x] * corner posts with narrow panes — front
- [x] * steering wheel (wood rim) through the glass — front, side
- [x] * wiper, from the top of the screen — front
- [x] * cowl lamps, 2, nickel — side, front, plan
- [x] * radiator: narrow arched nickel shell, no inner lip, diamond badge, crank hole, winged cap — front, side, plan
- [x] * hood: 20 louvres, fold line, 2 latch knobs, raised band at the cowl, centre hinge strip — side, plan
- [x] * headlamps: drum front + bowl, on beaded posts; tie bar only in the plan — side, front, plan
- [x] * wings: blades with bulbous noses and a broad inner sweep — side, front, rear, plan
- [x] * running board with full-length bright strip, no step plates — side, plan
- [x] * doors: front hinged at the front, rear at the back, double seam at the centre post, rear door cut along the
      arch; 3 long nickel hinges a side; 2 nickel handles meeting at the centre post — side (handles also rear)
- [x] * bumpers: two full-width bars front AND rear (rear not split), 1 clamp a side, end caps — side, front, rear, plan
- [x] * tail lamps: 2, on the rear wings, red in nickel rims; no plate, no plate lamp — rear (side: small)
- [x] spare on the back, wire wheel — side, rear, plan
- [x] * wheels: wire, about 40 spokes, rims in the body's olive, nickel cap — side, rear
- [x] * colours: olive paint, green-black top, black wings, charcoal cloth, warm nickel, orange wood
- [ ] maker's script on the radiator core (left out on purpose)
- [ ] hub caps seen past the bumper ends (front), spring shackles (rear), board rivets (plan)

## Pitfalls
- **Reading a gridded crop that does not start at 0**: on the right-hand half of the side view I read some positions
  off the image's own pixel positions instead of the grid labels; near the right edge the two happen to be close, so
  the body's back edge landed 40 units (100 mm) too far forward and still looked plausible in numbers. The outline
  overlay on the sheet (`work/over.py`) showed it at once. Check: after the first build, always overlay every outline
  on the sheet before judging by the side-by-side.
- **A dark part behind a painted one**: the wheel house's `y` was smaller than the hood's half width, so the hood drew
  over it and the louvred panel showed under the wing. A part that must cover another in the side view needs the
  larger `y` (here `y=[0, 700]`), and its arch radius must reach the wing's underside.
- **Thin bright or coloured parts** (wood surround, board strip, steering rim): under about 20 mm the game's dark
  outline swallows them. Draw them 20-25 mm wide even when the sheet's are thinner.
- **Tyres in the plan** stick out behind a wing that the plan draws shorter than the side view: cut the tyre's plan
  rectangle to the wing's plan length.
- **Scale**: the given wheelbase can make the car implausibly tall when the sheet draws it short; the wheels were the
  true ones here, so it is the sheet. Say so and keep the factor in one number (`K`).
- The bodyTop's corner seams drawn as features on a black part do not show; make such things parts (`postF`).
