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
- x from the front bumper backwards, y across (+ = the car's left, the exhaust side is chosen per car), z up from the
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
