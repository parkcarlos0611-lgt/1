# 70 · Low-poly mesh cars: build rules

Approved direction (review 80–81): every car becomes a true low-polygon 3D mesh, drawn flat-shaded with outlines
(render/car/mesh.ts). The reference car is the 1935 grand roadster, `render/car/mesh_ssj.ts`. Read it first: copy its
layout, helpers and level of detail.

## Files
- One file per car: `render/car/mesh_<id>.ts` (id as in data/cars/sheet/<id>.json). It exports
  `export function mesh(spin = 0): Mesh`; `spin` turns the wheels (radians).
- Do not edit `mesh.ts`, `mesh_ssj.ts` or any shared file. A needed helper goes as a local function in your own file.
- Check pictures: `npx tsx tools/ref/meshshot.ts <out.png> car=<id> mm=10 scale=1 line=3`
  (top row 40° from above at three headings, bottom row both sides and the front). Close-up: `mm=6 yaws=210 pitch=45`.
  Game size: `mm=19.6 scale=2`. Look at every picture you make; view PNGs with the Read tool.
- 2D reference for the same car: `npx tsx tools/ref/modelviews.ts data/cars/sheet/<id>.json <out dir>` draws its side,
  front, rear and plan views. The part model json holds every part's outline per view in mm and the notes
  (tools/ref/sheetcars/<id>_report.md, _notes.md) say how it was read and its scale.

## Space and size
- x from the front bumper backwards, y across (+ = the car's right, as in the sheets' part models; drawMesh mirrors so
  the car's left shows when the nose points left), z up from the
  ground; mm. `mesh(length)` takes the overall length.
- Real proportions first: wheelbase, track and tyre size from data/cars/specs.json (`cars.<id>`); length, height and
  the width from the sheet report. Check the width against real figures: the plan views were often read narrow (the
  roadster was 6 % narrow: windscreen stood out past the body, lamps sat inside the wings). Put the overall width on
  the wings/running boards, the track on the wheel centres.
- Nothing pokes through what it should sit inside: screen inside the scuttle, lamps clear of the wings, wheels inside
  the wings' reach, doors and handles on the skin.

## Shapes
- Body: `loft` of `section(x, halfWidth, zBottom, zTop, top, bot)` rings at stations along the car, from tables read
  off the side view (heights) and plan (half widths) with `at()`. Sedans: the cabin is its own loft (roof, pillars
  as quads/bars), glass as GLASS quads set just inside the frames, dark interior visible through the glass.
- Open cars: cut the tub down to a deep floor (the roadster's FLOOR 610), side walls for the doors' tops, a dash face,
  seats low inside. No steering wheel on open cars (a standing decision).
- Wings: `wing(b, path, hub)` with [x, zTop, yIn, yOut] points; running boards as boxes; the wings meet the boards.
- Wheels: lathe tyre + rim + hub, then the car's own wheel type: wire spokes (bars), wooden artillery spokes (wide flat
  bars, 10–12), or pressed discs (holes as dark lathed rings). Same `spin` parameter.
- Lamps, horns, bumpers, grille (dark box + bright slats or mesh + a shell ring), radiator cap, spare, tail lamps,
  handles, louvres, hinges: as in the reference.

## Look
- Materials via `b.mat(colour, gloss)`: paint ~0.45, chrome 0.9, rubber/dark 0.05, glass 0.5, leather 0.25. Take
  each car's paint colours from its sheet json (`paint` or the parts' colours) so it reads as the same car.
- Budget: 3 000–8 000 triangles a car. Detail that does not show at game size (mm 19.6) is not worth triangles.
- Preview defaults chosen by the user: resolution 0.85x (19.6 mm a pixel), outline 3 px.

## Materials, glass, age (review 83)
- `b.mat(colour, gloss, kind)`: kind is one of `paint`, `metal` (chrome, nickel, aluminium), `glass`, `shine` (a
  reflection streak on glass), `tyre`, `wood`, `canvas` (roof cloth, cloth upholstery), `leather`, `lens`, `grille`
  (a grille's mesh core), or `plain` (default: no texture, no age). The kind picks the texture (wood grain along the
  part's longest edge, cloth and leather mottling, tread blocks on a tyre's outermost band, a diamond wire mesh on
  `grille`) and how age shows (rust and fading on `paint`, a milky film and pitting on `metal`, a broken `lens`).
- Glass is drawn see-through at the page's opacity (default 70 %) in one tint for every car; its own colour is not
  used. What is behind it shows: closed cars need an interior.
- Closed-car interior (behind every window): a dark floor, the door and side panels' inner faces in a trim colour,
  front and rear seats (cushion and back, upholstery `canvas` or `leather`), a dark headliner under the roof, the
  dash's back face, a parcel shelf behind the rear seat. No steering wheel for now (decision pending). The cabin must
  be hollow between the glass panes so the seats show; check at `glass=0.7` and `glass=0.3`.
- Check age with `rust=0.6 fade=0.5 dent=1 lamp=1` on meshshot: paint that should not rust (glass frames, roof cloth)
  must not be `paint`.

## Surface quality (review 127) — every new car, and every brief to a modelling agent
Lessons from the EB110 and XJ220 builds: the brief stressed matching the sheet and the figures, and named no quality
bar, so the bodies came out right in outline but faceted, creased and boxy. These rules now stand beside the outline:
- **The quality bar:** at least `mesh_ssj.ts` (wings, lamps, wheels) and, for one-piece bodies, `mesh_jagD55.ts`
  (smooth envelope). A brief names both as the models to follow; a 1930s separate-wing car is never the example for a
  modern one-piece body.
- **Sections are curves, not polygons:** each body section a superellipse (or a smooth spline) of at least 16
  points, the flanks curving in toward the top (tumblehome: the glasshouse's foot 6-12 % in from the widest point on a
  modern car), no vertical walls except where the car has them.
- **Measured tables are smoothed:** values read off a sheet's pixels are noisy; fit them with a smooth curve (a
  moving average or a monotone spline, at least 5 points' span) before lofting. No step of more than 1 % of the height
  between neighbouring stations unless the car has a real step (a shut line, a spoiler lip).
- **Even stations:** sections every 80-150 mm along a smooth body; never two sections at the same x; arches cut by
  moving section points, never by collapsing several to one point (no degenerate triangles).
- **Check the surface, not just the outline:** a 3/4 view at pitch 30 and a top view at pitch 89 under the PBR look:
  highlights must run as smooth bands along the wings and bonnet, not break into patches; any patch is a fold or a
  step to fix. The outline comparison with the sheet comes after this, not instead of it.
- **Colour from the real car**, not the sheet's flat drawing colour (the sheet's blue is a drawing's; Bleu Bugatti is
  a deep metallic).
- **Build afresh rather than patch** when the surface is wrong at the root (wrong section shape, unsmoothed tables): a
  new build from the measured, smoothed tables costs less than many fix rounds.
- Budget for modern one-piece bodies: 9 000-14 000 triangles.

## Proportions, budget, consistency (review 128)
- **Sheets are design references, not measurements.** The user's sheets are drawings: their wheelbase, widths and
  view heights are off by a few per cent (the EB110 sheet's wheelbase drawn 2595 for 2550, its front and rear views
  squashed; the XJ220 sheet's wheelbase 3 % long, plan 5 % wide). Proportions come from the real car only: length,
  width, height, wheelbase, tracks, overhangs, ground clearance, and the main heights (bonnet, belt, roof, deck) from
  sources or photographs. The sheet gives the design: the shapes of the grille, lamps, intakes, louvres, the lines'
  flow, the colours' layout; a feature's place is carried over as a share of the real dimensions (e.g. "the intake
  starts at 62 % of the wheelbase"), never as the sheet's pixels.
- **Budget like the others:** 9 000-10 500 triangles, about 1 800-2 200 per metre of length (the period cars run
  1 570-2 190; the SSJ, the most detailed, 2 190). A car far above the rest looks foreign beside them.
- **Spend on the body's curves:** a modern one-piece body has few parts; about 60 % of its triangles go into the
  envelope (points per section, sections along). Louvres, grilles and lamp clusters are a few panels with dark
  colours, not many small pieces; the interior only what shows through the glass at game size (seats, dash, tunnel).
- **Check beside the others:** after the surface check, render the new car beside the SSJ and the D-type at game
  scale (mm 16-20) and compare: the faces as smooth, the outline as busy, the colours as saturated. Then compare the
  design features with the sheet.

## Style direction (review 133) — set by the planner
- **Models: clean, in the FR Legends manner.** Simple, tidy surfaces and clear colour fields; no noise or busy
  detail on the body. The outline comes from the per-part drawing (doc 79 §2), at real dimensions.
- **Curves where the car has them.** A car whose body is curved (EB110 flanks, XJ220 tail, the 1930s wings) gets
  enough sections to read as curved at game size; a boxy car stays boxy. Clean does not mean flat-panelled.
- **Lamps and such are modelled.** Head and tail lamps, grilles, mirrors, intakes, badges that stand proud, wipers,
  exhausts: real geometry (props on the body), not only painted on. Small flat marks (lines, lettering) may stay 2D art.
- **Graphics stay realistic.** PBR lacquer, HDRI sky, reflections, shadows, period camera effects as now. The
  stylisation is in the shapes, not in the lighting.
