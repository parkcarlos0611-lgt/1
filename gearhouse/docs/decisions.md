# Design decisions

Each decision is listed with its date. The newest come first.

## 2026-11-19 — system design answers (docs/systems)

- The founder's working hours are the small workshop's key resource.
- The player sets which weekdays are days off. Public holidays are skipped days.
- Reading newspapers and magazines costs no time.
- Customers' hidden wants are found out by consultation.
- Customers hit by the Depression can fail to pay.
- Reputation is split into five fields: quality, performance, style, trust and value.
- Every event, letter and article is written through the text-variety method in `docs/systems/00_text_variety.md`, so the same event reads differently each time.
- Text is written by Claude and reviewed by the planner. Period speech is used lightly, so the text reads naturally.
- Both a bought rolling chassis and a self-built chassis are offered.
- Materials are ordered and used as one-car sets; the store also shows leftovers in real units.
- A car is built in nine steps. One hands-on real-time step, panel beating, is in the slice.
- Car bodies start from the measured base cars of the first test build and are edited in three layers: proportions, parts and panel points.

## 2026-11-19 — reboot (plan: docs/REBOOT_PLAN.md)

### Platform and code
- **Engine:** TypeScript. Rendering on PixiJS 8.
- **Packaging:** Capacitor for Android and iOS; Electron for Steam on Windows and Mac.
- **Project location:** the new project is the `gearhouse/` folder itself. The first test build moves whole into `legacy/` with git mv; nothing is deleted. Its last commit before the move is `42b7f86` (game page version 27).
- **What carries over from the first build:**
  - Calculation formulas carry over: engine, chassis, gearbox and acceleration.
  - Real-time physics and the drive screens are redesigned from a cause analysis (plan chapter 2). The old code is reference only.

### Scope, time and people
- **Countries:** USA, UK, Germany, France and Japan. The vertical slice uses the USA only.
- **Time:**
  - One day takes 8 s at 1x, 4 s at 2x and about 2.7 s at 3x.
  - The game stops often, on many kinds of events.
  - Skipping shows the days going by one at a time, quickly, and stops when an event happens.
- **Public figures:** real people are named in the news. Nazi symbols never appear in pictures.
- **Founder lifespan:** 80% of founders live to a Beta(5,3) lifespan mapped onto 49–99 years. 20% die earlier, at a random point in life; war, racing and period medicine move that point.

### Art and screens
- **Top-down driving is the default**; side-on shots are used only in some scenes. Top-down cars are sprite stacks about 300 px long.
- **Asset sizes:** vehicles and parts are drawn about 400 px long, at roughly 12.5 mm/px. Asset scale is kept separate from screen scale. Pixel size is the same everywhere within one scene, and only integer scales are used.
- **Who makes what:**
  - Backgrounds and props are drawn by hand or adapted from images the planner makes.
  - Vehicles and parts are generated from the design data.
- **UI quality gate:** every screen is checked for click and touch targets, window overlap and text overflow before it is called done.
- **Real brands:** car makers' names and logos are replaced with invented ones; historical events stay real.

### Carried over from the first build
These decisions still hold, from `legacy/docs/MASTER_GAME_PLAN.md`:
- No real car or company brand names, logos or badges appear on screen.
- Engine sound is synthesised from the design values.
- No code ever uses the email address of the planner.

## 2026-11-19 — names

- People's and suppliers' names stay in Latin letters; they are not converted to Korean spellings.

## 2026-11-19 — news bodies and effects (reviews 09 and 10)

- An article's slant is good news, bad news or neutral.
- Bodies are assembled in three layers: fact sentences per topic and tier, ten frames, ten voices.
- Effects are added in this order: the town register, then seven changes in numbers, then four opportunities.
- Verification of the real events is a separate, later task.
- The reporter seats and the town register as a database are under review (review 10).

## 2026-11-19 — reporters and the town register (review 10)

- Voices stay at their present strength.
- Each publication has its own staff of fourteen seats: ten named seats, one per voice, and four unnamed seats.
- A successor writes in the seat's voice with one or two small habits of their own.
- Real news is printed as wire copy with a local paragraph.
- The town register is two tables kept in the save (entities and records) and starts with five kinds: banks, factories, rival makers, roads and public offices.

## 2026-11-19 — effects of news (review 09, applied)

- Passing conditions: seven kinds (inquiries by customer type, budgets, cannot-pay chance, wanted car character, supplier lead time and reliability, material quality, advert and utility costs).
- All demand multipliers together are kept within 0.5 to 1.6; at most two conditions of one kind hold at once, the weakest giving way to a stronger one.
- Four chances that the reader must act on before a last day: a public tender, a motor show, a supplier's clearance sale, a tool auction. An unread chance passes and the journal says the paper had it.
- The motor show no longer raises awareness by itself; only entering a car does.

## 2026-11-19 — tenders and weather (review 11)

- A public tender is open only to a shop with a record of working vehicles: at least one delivered in the last three years for a county or town tender, three for a state-level one. The article is still printed; a shop without the record cannot bid.
- No price ceiling keeps costly shops out of tenders; a high bid already loses on price.
- Weather: clear, rain, snow; six seasonal spells (cold wave, blizzard, long rain, heat wave, drought, fine autumn) of at most a month; a long rain once a year at most; a grace of 7-14 days after a spell (5-10 in winter).
- Weather changes only callers in person; half of those a spell kept away come within two weeks after it.
- Papers print short weather notes by a leaning set per publication.
- Links from weather to other systems (painting, deliveries, wanted features, roads, utilities, farms) come next, as soon as possible.
- Real weather disasters are added when the real events are verified.

## 2026-11-19 — weather links and delays

- Rain stops the paint step for the day; working days lost to it are not counted as late.
- A customer can be asked once per order for more time.
- A cold wave raises the next utilities bill by 40% (heating); a heat wave by 15% (ice and fans; workshops of the 1930s had no air cooling).

## 2026-11-19 — after the first play; banks

- Chances come about half as often and are worth more.
- Headlines carry no unrelated time and place; quotes are said by someone who could say them; letters keep one speech level.
- A customer sits through two talks before a quote.
- Banks: one account at a town bank, 3% on deposits, loans of 6/12/24 months, payments monthly, three missed payments end the game; a failed bank locks the deposit away and returns part of it later; the papers are the only warning.
- Tax: told on January 2, paid on March 15, 4% of the year's earnings above $1,500 (to be checked against sources).

## 2026-11-19 — the car itself comes first (reviews 14 and 15)

- Reference sheets made by the planner are material, not assets: cars are rebuilt at the 400 px rule from traced outlines, as the first build did from drawings.
- Only badges and lettering are removed; grilles and a car's own design stay.
- The underside views of the sheets are guesses and are used only as examples of layout.
- Choosing a car: era, kind of car, body shell, parts in eleven fixed places, then dimensions by the outline. Dimensions change the figures.
- The frame is chosen from a list and drawn on the plan; wheelbase, track and reinforcements are values of it.
- Outlines are traced with a helper tool and then finished by hand; three samples first, to measure quality and effort.

## 2026-11-19 — how cars are drawn

- Cars are drawn in the first build's manner (render/car/flat.ts): five flat tones per material, an outline only where a part meets the background or a part behind it, narrow dithering, chunky window frames, parts strictly in layer order.
- Cars that are only seen (rivals, cars on the road) are made the same way and carry a kind of car; how they are generated and tied to the systems is under review (review 16).

## 2026-11-19 — background cars and driving views (reviews 16 and 17)

- Makers have a house style; their models are combined only inside it. Model shapes are set by hand at first; each car gets wear: paint chips, lost gloss, rust and dirt, five steps each.
- Road traffic starts from simple weights and moves to counts of cars sold and still running. Cars the player sold are seen on the road.
- Views by scene: side view for streets, deliveries, straight tests, drag races and hill climbs; top view for track races, rallies and handling tests. One physics model for both.
- The side view has fixed lanes (two or three); a lane change is a short slide. Wheels stay fixed in the car picture for now.
- Cars going the other way are drawn separately in the near lane and mirrored in the far lane.
- Next after the three sample bodies and the drivetrain figures: a straight test in side view.

## 2026-11-19 — body detail (review 18)

- The reference scale is 10 mm/px, about one to one with the reference sheets; scenes may draw at other scales from the same data.
- Parts are built as a library of parts with their own structure (grille, lamps, wheels and caps, bumpers, tail lamps, handles and hinges, trim, running boards).
- Paint gets seven tones; reflection bands, overlap shadows and glimpses through the glass are added.
- Source images are never used as pictures in the game, not even for cars that are only seen.

## 2026-11-19 — front and rear views (review 19); outline weight

- One design gives side, front and rear views: heights and wheels come from the side, the front and rear keep widths and section shapes; half outlines mirrored.
- Overall width comes from the catalogue figures, else from the class rule; the three samples get rear views too, later cars the front first; this follows the side detail work.
- The outline against the background is two pixels thick all round, roof and bonnet top included; lines between parts stay one pixel.

## 2026-11-19 — chrome and reflections; plan views; the 200 cars (review 20)

- Reflections keep the paint's colour and are soft bands on rounded surfaces; chrome is a hard cold line with a lip and a shadow, only in a part's place.
- The plan view is made from the same design as the side, front and rear views.
- Each of the 200 reference cars can be a body shell, a rival model, a car on the road, or several of these; order: the slice's cars, then the rest of the 1930s, then the 1940s; the schedule is set after the three samples have all four views and one car's real effort is measured.

## 2026-11-19 — structure first, picture as the answer sheet (method Z)

- A car is held as elements: each a whole closed shape in millimetres (hood, cowl, door, sill, quarter, tail, roof, fenders, parts), hidden areas included. The captured pixel map (Y) is kept only as the answer sheet that outlines, shut lines and shading are fitted to and scored against; it is not drawn in the game.
- Reason, from one test on the sedan: the pixel map repeats the view far more closely (colour difference 5.6 against 24.4) and survives a tenth more length and another paint, but a part cannot be exchanged or taken off without holes, because what a part covers is not in the picture.
- Shading belongs to the shape: a 16 x 16 grid of tone steps per painted element, read from the view, over the element's width and each column's height. It follows the element when the car is stretched and is dithered afresh.
- Dark paints keep their dark tone steps apart (they used to run together into black).
- Pixel snapping (grid by autocorrelation, majority colour per cell) is not used: the reference views have no coarser grid, and snapping made the capture worse (9.4 against 5.6) and broke fine lines.
- Tools: zkit.py (fit, split), sedan36_z.py, shade.py, zscore.py, ztest.ts, zsheet.py, snap.py.

## 2026-11-19 — method ZY: elements that carry the view's detail

- Named ZY: the structure of Z (whole elements in millimetres) with the detail of Y handed to each element. A cell of an element's skin is a material and a tone step, or empty where the view does not show the element; the cells sit in the element's own box, so they move, stretch and are exchanged with it (data/skins, tools/ref/skin.py).
- Where an element has no cell (behind a fender or a lamp), the game draws it by its rules in the element's usual tone. A part exchanged for another form, and a wheel of another kind, are drawn by the rules too.
- Sedan, against its view: colour difference 6.2 (Y 5.6, Z 24.4); a tenth longer, repainted, lamps and wheels exchanged and elements pulled apart all hold.
- The capture now leaves wheel arches open, which ends paint running into the tyres on a repaint.

## 2026-11-19 — ZY2 and Z2 (review 21)

- ZY2: element skins on the game's own ramps (each tone of the view to the ramp step nearest in lightness), hidden paint carried on smoothly, a mostly hidden wheel taking the detail of the wheel the view shows best, lone cells cleaned, badges and lettering on hub caps removed. Z2: the same detail as shapes per element (tools/ref/decals.py), drawn afresh at any scale.
- On the three samples both pass longer, repaint, lamps and wheels from another car, pulled apart, 7 and 15 mm/px; colour difference 11-18 against the view. ZY2 is a third the size; Z2 can be made from it at any time. Proposed: ZY2 as the stored form (review 21, awaiting decision).
- Capture: chrome keeps the body colour in its reflections; a low-saturation paint no longer takes chrome as paint. Method Z build steps are shared (zkit.build); a second paint tone keeps its colour.

## 2026-11-19 — method Z only; five views of one car; early cars as full parts (review 22)

- Cars are drawn by method Z only: hand-written parts fitted to the reference lines, drawn by the game's rules with at most a coarse light grid per part. Z2 and ZY2 are not used: they carry the picture's noise, measured well on colour difference while looking no better, and limit what the game can change. Judging is by eye, side by side at game size.
- Technology check: a randomly picked car (1940s #2, four-wheel-drive utility, 1948) in left, right, front, rear and plan views; the right side is the left side turned end for end with the light kept top left. Removing the tilt, a longer wheelbase, repainting and other wheels all hold.
- Renderer: wire mesh grille, tread tyres, black or painted hubs, canvas colour, lines on canvas; small parts move whole when a car is stretched (demo).
- Proposed (awaiting decision): only 1920s cars (sheets made by the planner) and 1930s cars up to about 1934 become full, exchangeable parts in all five views, with common mounting marks; later cars wait for their era.

## 2026-11-19 — running gear, suspension and a production system (review 23, proposals)

- Fixed on the sample utility: the front bumper bolts to frame ends and a valance; wheel houses are an inner arch panel a little larger than the opening instead of a black fill.
- Proposed (awaiting decision): running gear (frame, powertrain, suspension, tyres) is defined once in three dimensions per class of car and projected into every view, with wheelbase, track, frame height, tyre size and engine length set per car; suspension drawn from mount points and driven by the first build's reduced multi-body model, in stages (rest pose, slow scenes, driving); a fact sheet per car from research; automatic checks for attachment, gaps, agreement between views and lone pixels.

## 2026-11-20 — bouncy running gear (review 24)

- A side-view running-gear simulation (physics/rig.ts) after Desert Steel (sprung stations, wheels as circles on a heightfield, small fixed step) and BeamNG (tyres as rings of mass points with pressure): rigid body with pitch and roll, two beam axles, four leaf springs with friction, bump rubbers and rebound straps, telescopic dampers, four ring tyres, near and far ground; drive torque on all four wheels.
- Pictures are not turned: sprung pictures (body, wheel houses, chassis with engine, gearbox and transfer box) are drawn again from their outlines at every whole degree of pitch (render/car/pose.ts), the rest moves pixel columns; rows squash a little on landing by a visual spring; tyres, wheels, leaf springs, dampers and shafts are drawn every frame from the physics (render/car/running.ts). Far-side wheels, springs and dampers show offset and darkened.
- Research on real cars is a detail reference only.

## 2026-11-20 — the test-drive page (review 24, follow-up)

- A test-drive page (ui/testtrack.ts, ui/testtrack.page.html, bundled by tools/ref/buildtrack.mjs) lets the planner drive the 1948 utility over a course of asphalt, gravel with a log on one side and a hump on the other, a dip, a ledge, washboard, sand dunes and rock steps, with pedals or keys; look through the body; set the landing squash; pick soft, standard or hard springs; and use the transfer box's high or low range.
- Shared pieces: the drive scene (render/car/scene.ts) used by the page and the frame tool; soils with grip, rolling resistance, sinkage and dust (physics/rig.ts); a powertrain with a slipping clutch from rest, four gears changed by road speed, high and low range and governed revs (physics/powertrain.ts).

## 2026-11-20 — sand fixed; the body bounces whole; references for running gear (review 25)

- Fixed: the tyre's sinkage was mixed into the ground slope, so a sinking tyre was pushed backwards (sand) or spun (gravel). Slopes come from the ground alone; soils blend over a metre.
- Body bounce is the sprung body moving whole on its springs and tyres (heave, pitch, roll); the picture squash is off by default and proposed for removal.
- Proposed (awaiting decision): reference images for running gear per kind of part (about 60: engines, gearboxes, axles, springs, dampers, tanks, frames), generated orthographic sheets like the car sheets, used as shape references only.

## 2026-11-20 — body placed whole, tyres keep their weight (review 25, section 5)

- The picture squash is removed. Sprung pictures are placed whole at whole pixels: the body moves up and down on its springs and a little fore and aft when speeding up or braking; it takes a new pose only after standing on a slope for a moment, never for a bounce. Spring and damper mounts follow the drawn body.
- Tyres stay ring tyres (contact squash), with the carcass damped against ringing round the hub; they are drawn round above the hub and pressed flat only below it.

## 2026-11-20 — the first full car: 1929 four-door sedan (method Z)

- From the planner's 1920s sheet and chassis sheet: left, right (mirrored), front, rear and plan views fitted to the sheet (tools/ref/sedan29.py, sedan29_z.py), sized from the wheelbase 2629 mm; a chassis design with frame, four-cylinder engine, gearbox, fuel tank in the cowl, steering and exhaust.
- In the test track as a second car: transverse leaf springs front and rear seen end-on, lever dampers, torque tube to the rear axle, rear-wheel drive, three speeds (physics SEDAN29, SEDAN29_DRIVE, SEDAN29_LAYOUT).

## 2026-11-20 — one 3D part model per car; every car's parts are its own

- A car is one 3D part model (render/car/model.ts, data/cars): each part has one box in the car's space and its outlines from the side, front, rear and above in the unit box. All five views are projected from it, so a part sits at the same place in every view; drawing order comes from where the parts are (further out, further forward, further back, higher), never from a hand-written list. Where the sheet's views disagree, the model wins and the tool lists the disagreement.
- Corrects review 15 ("parts of a place grouped into a few dozen kinds"): body parts are NOT grouped. Every reference car gives its own lamp, grille and shell, fenders, bumpers, wheels, body and roof, shaped from its own sheet, so 200 cars give 200 of each (as in Automation). Stock forms describe how a material is drawn, never a shape. Only running gear (frame, drive line, suspension, tyres) uses shared models per class.
- First car rebuilt this way: the 1929 sedan, 43 parts (tools/ref/sedan29_model.py). A parts check sheet shows every part alone in every view (tools/ref/modelviews.ts, partsheet.py). The earlier per-view files (sedan29.py, sedan29_z.py) are superseded.

## 2026-11-20 — where the sheet's views disagree the side view rules; measuring instead of judging by eye (review 28)

- The side view gives a part's place along the car and its height, the front view its width; front, rear and plan views follow the model even where their own drawing differs.
- Improvement A: placed outlines are pulled onto the nearest strong line of the drawing (zkit.fit_closed, centred outlines kept symmetric). B: every part gets a score per view, the share of its visible outline lying on a line of the drawing (tools/ref/score.py, pass mark 80); in views other than the side the score also counts the sheet's own disagreement. C: outlines are checked over the enlarged view (tools/ref/overlay.py).
- The car's interior is not drawn.
- Next, in order: lines inside parts taken from the drawing, light per part, rounded corners, sub-parts (glass with reveal and frame, lamp with rim and lens, fender with face and side); then counts and colours measured; then the procedure written down, a second car made by it, and only then several cars at once.

## 2026-11-20 — plan, front and rear views read again; tyres seen face on; light per part (review 28, continued)

- Plan view outlines read off the plan sheet again: fenders full length, running board from fender to fender under both, splash aprons and the front cross member under the hood, bullet lamps, curved front bumper with its irons, rear bumpers either side of the spare with the spare carrier.
- Tyres seen from in front or behind: a balloon section flattened where it stands, its tread drawn face on (blocks crowd together towards the top and bottom, darker shoulders; detail 'treadFace'). Radiator core: rows of dark cells ('cells').
- Parts lying on another part's face (windscreen, side glass, radiator core, lamp lens) are lifted in the drawing order so the face never covers them.
- Improvement G: light per painted part and per view is read off the sheet and kept in the model (tools/ref/modelshade.py, part.shade).
- Open: headlamp height. The side sheet puts the lamp centre about 1030 mm up, the front sheet about 900 mm; by the side-view rule the front view shows the lamps higher than its sheet.

## 2026-11-20 — the reference at the centre (review 29)

- Each view keeps the sheet's own place and size for every part (part.sheet); the common box (mean of the views that show each axis) is used for the drawing order, for exchanging parts and for the physics. Where a view differs from the common box by more than 50 mm the build lists it. This replaces "the side view rules" of review 28.
- Proportion check (tools/ref/proportions.py): for every view and part, the sheet's place and size against where the drawn part really ends up, and its place against the body; tolerance 30 mm and 5 %.
- Parts lying on another's face say so (part.on: a lens on its lamp, glass on the body, a core in its shell) and are drawn just above it in every view.
- Part tiles (tools/ref/tiles.py): every part in every view cut from the sheet, enlarged 8 times, its drawn outline over it, with its measured colours, pattern repeat and share of outline on a line; measurements saved for the build.
- Colours: fenders, roof and wood take their middle tone from their tiles (tools/ref/partcolours.py, part.color); the body keeps the paint measured once on the side view, as shaded panels give darker colours than the paint.

## 2026-11-20 — roof checked; lines inside parts taken from the sheet (review 30)

- Roof: seen from in front and behind it is a dark cloth cap with a low arch and rounded corners, wrapping onto the body; its outline there is measured, not pulled onto lines (the visor's lines pulled it into waves). The body's back reaches up to the cap with rounded top corners (its own rear outline, no longer the front one). The cap's colour is set from the sheet's lit cloth.
- Improvement F: long straight-ish lines inside painted parts are found on the enlarged sheet (dark: shut lines and mouldings; bright, in the side view only: lit edges) and kept with the part as features of that view (tools/ref/innerlines.py); 67 on the sedan.

## 2026-11-20 — roof cap no wider than the body; lamp face as rim, reflector and bulb

- Seen from in front and behind, the roof cap is no wider than the body and its corners are rounded; its cloth is darker, as the sheet shows it.
- The lamp seen face on is a chrome rim, a silvered reflector shaded like a bowl and a dark bulb at the centre (sub-parts of the lamp, each lying on the one before).

## 2026-11-20 — sub-parts, first round

- Front: the cap's cloth comes down beside the windscreen as dark corner pillars; the radiator shell has a darker inner lip between it and the core; the front bumper bars carry two pairs of clamps; the front fenders' crowns catch the light.
- Side: each side window lies in a raised moulding frame; the body's rear top corner is rounded as the sheet draws it.
- Painted wire wheels read as the wheel's colour with dark gaps.

## 2026-11-20 — the spare drawn as the tyre it is

- Seen from the side and from above, the spare shows its tread edge on with the same section and the same face-on tread as the road tyres seen from in front (one shared tyre section per car). The section is rounder at the top, flat where it stands, and its tread finer.

## 2026-11-20 — lamp glass, nickel, tread bands, laced wire wheels

- The lamp's face is its own material (glass over a silvered reflector, detail 'bowl'), no longer the rim's chrome.
- A car may give its bright metal's colour (design.chrome); the 1929 sedan's is nickel, warmer and greyer than chrome.
- Tyres seen face on: a continuous centre rib between two grooves, blocks either side in a zigzag, darker shoulders.
- Wire wheels: two sets of slanted spokes crossing in a lattice, as on a laced wheel; painted wheels in their own colour.

## 2026-11-20 — tail lamps on the fenders, the shell's surround, silvered lamps, hub caps

- Rear tail lamps lie on the rear fenders (they were set on the body, which the fenders cover in the rear view), each a nickel rim with red glass.
- The radiator shell's surround is thicker and wraps round the bottom of the core, as the front sheet draws it.
- The lamp's reflector reads silver (middle steps), not white; wire wheels' hub caps follow the wheel's cap size.
- Plan view: the front fenders' crowns catch the light along their length.

## 2026-11-20 — fuller rear, the shell round the bottom, the lamp face in layers

- Rear: the back's two panel lines, its moulding catching the light, a number-plate lamp, the boot handle and a dark apron under the body behind the bumpers.
- Front: the frame is two rails whose ends show from in front (it was drawn as a bar across, over the shell's bottom); the front cross member sits lower; the shell's surround goes on round the bottom of the core.
- The lamp face: nickel rim, a dark gap, then the silvered reflector in the bright metal's own colour with a darker band, a bright ring and a bright bulb at the centre (the dark bulb read as an eye).

## 2026-11-20 — period glass

- A car may give its glass a tint (design.glassTint): pale glass as the period sheets draw it, lighter at the top, a shadow under the frame, one broad soft reflection and a thin one, a lit lower lip; the old dark glass with thin streaks remains for cars without one. The front view no longer darkens its glass.

## 2026-11-20 — the chassis in the same 3D model (first pass)

- The sedan's chassis parts (radiator core, fan, engine block, head, sump, generator, starter, bell housing, gearbox and lever, torque tube, rear axle and differential, fuel tank, steering, exhaust) are parts of the same 3D model with layer 'chassis'. Body views leave them out; chassis views (tools/ref/modelviews.ts writes <id>_<view>_chassis) draw them with the frame, axles, springs and tyres.
- Fit check (tools/ref/fitcheck.py): engine and radiator within the hood and shell, gearbox and tank under the cowl, ground clearance, the engine ahead of the cowl's back; all pass on the sedan.
- First pass: chassis parts are boxes and simple outlines from the chassis sheet's proportions; their outlines are next to be taken off the chassis sheet as the body's were.

## 2026-11-20 — the chassis sheet is a layout reference; engines (review 31, proposal)

- The chassis built from the chassis sheet is kept for tests (fit check, test drive) and as the layout reference: where each part sits when parts are put together. Each running-gear part (engine, gearbox, axles, springs, dampers, tank, frame) is to be made from its own part image, as body parts are made from the car sheets, and placed by the layout.
- Engines today: the new design (review 03) buys engines, gearboxes and clutches from suppliers in the 1930-35 slice; manufacturers sell only to shops with reputation and a record. The first build had company-size presets (garage, small works, mid-size with an engine plant, large) with researchers and a research facility grade, and a part-by-part engine designer (family, then variants) with an engine test room (legacy/docs/GDD.md 3.2, legacy/docs/MASTER_GAME_PLAN.md 15). Proposed: bring the scale-dependent ladder into the new design (review 31).

## 2026-11-20 — the whole interface in pixel art; the drawing board, first demo (reviews 26, 27)

- Decided (all as recommended): the whole interface is period-object pixel art, continuing the first build's way (one small pixel buffer scaled up, Galmuri pixel font, wood, drafting paper, brass, enamel); long text uses a larger pixel font; the drawing board is the first pixel screen; the interface's materials change with the company's size and era, as the drawing sheets do (worn paper, clean paper, blueprint, black screen).
- Drawing board demo (ui/drawingboard.ts, ui/drawing/lines.ts, ui/pixel/screen.ts; bundled by tools/ref/buildpage.mjs): a worn drafting sheet with the 1929 sedan in pencil lines only (side and plan, 1 px = 20 mm, drawn from the 3D part model), dimension lines, title block and the order's checklist. Changing the wheelbase, roof height, body height or adding a roof rack draws the change in red over the drawing; "수정" rubs the old lines out with an eraser and draws the change in pencil, "취소" rubs the red out; pencil scratch and eraser rub sounds from noise.
- Galmuri font files are copied into ui/pixel with their licence (docs/licenses/Galmuri-OFL.md).

## 2026-11-20 — 도면 화면 2차 (제도판 데모)
- 도면 선은 한 픽셀 굵기로 가늘게 한다(Zhang-Suen 세선화). 이웃 부품 경계가 겹쳐 두 줄로 번지던 것을 없앤다.
- 그리는 중에도 모든 버튼이 동작한다: 누르면 남은 선을 바로 끝내고 그 조작을 한다.
- 치수는 숫자 창을 눌러 키보드로 입력한다(mm, Enter 확정, Esc 취소, 범위로 자름). 휴대폰은 숨은 숫자 입력칸으로 키패드를 연다.
- 황동 버튼: 둥근 모서리, 6단 황동 명암, 광택 줄, 눌림 상태, 새긴 글자. 패널에 황동 나사.
- 도면 4종(닳은 제도지 · 깔끔한 제도지 · 청사진 · 검은 화면)을 같은 선 그림에 종이·선 색만 바꿔 쓴다. 청사진과 검은 화면은 지우개 대신 선이 깜빡이며 바뀐다. 데모에서는 버튼으로 돌려 보고, 게임에서는 회사 규모 + 시대로 연다(검토 26).
- 견적 탭: 섀시 구매가, 강판 면적, 물푸레 골조, 유리·지붕 천, 도장·내장, 짐받이, 노무 시간. 합계, 무게, 최고 속도, 제작 기간. 바꾼 값은 빨간 "전 → 후"로 보인다. 값은 1차 추정치다.
- 외장 탭: 도면 치수 그대로 지금의 차 렌더러로 그린 그림. 휠·그릴·램프·색 고르기는 다음 단계.

## 2026-11-20 — 도면 품질, 검은 화면 주사선 (검토 32)
- 종이는 3~4 색조를 순서 디더로 깐 결(닳은 제도지: 섬유, 접힘, 컵 자국, 얼룩 / 깔끔한 제도지: 테두리와 구역 눈금 / 청사진: 인화 얼룩 / 검은 화면: 비네트와 점 격자). 선은 연필 압력과 흑연 가루, 잉크, 청사진 번짐, 화면 글로.
- 검은 화면에서는 바꾼 내용이 위에서 내려오는 주사선을 따라 나타나고, 화면에 주사선 줄무늬가 깔린다. 오른쪽 위에 정이십면체 와이어프레임이 돈다.
- 문·창·램프·그릴·범퍼·펜더 조절은 검토 32로 제안(고정점과 묶음을 먼저 넣는다). 결정 대기.

## 2026-11-20 — 도면 단계 부품 조절 (검토 32 추천안 채택)
- 길이를 줄이면 6라이트 → 4라이트 → 2도어를 빨간 선으로 제안하고, 수정을 눌러야 반영한다. 플레이어가 고른 배치는 "원하는 배치"로 남고, 들어갈 수 없을 때만 한 단계 낮춘다(버튼에 "자동" 표시).
- 앞문 길이는 플레이어가 정하고, 뒷문이 축간 변화를 받는다. 뒷문이 최소(540 mm)보다 짧으면 쪽창을 없애고, 객실이 900 mm보다 짧으면 2도어.
- 고정점(A·B·C·Q·K)과 묶음은 차마다 data/cars/<id>_frame.json에 둔다. 모든 부품의 모든 보기 윤곽이 같은 변형(축간, 지붕, 차체 높이)을 거친 뒤 묶음별 이동·크기 조절을 받고, 문·창·손잡이·발판은 문 배치에서 놓는다. 그래서 도면, 외장 그림, 시험 주행이 같은 모델을 쓴다.
- 조절 범위는 시대(1920년대 · 1930년대 중반 · 1930년대 말) × 회사 규모(공방 · 설계실 · 설계 부서 · 대기업)로 정한다(ui/drawing/rules.ts). 펜더 떼기는 1920년대만, 범퍼 떼기도 1920년대만. 1930년대 말에는 램프 앞뒤 고정(펜더 속).
- 조절판은 차체 / 앞모습 / 범퍼 · 펜더 세 쪽. 위의 주문서 · 견적 · 외장 탭은 누른 것이 눌린 채로 남고 카드와 이어진다.
- 이음선·몰딩은 자기 부품 위에만 그린다(바퀴·펜더를 가로지르지 않게).
- 로드맵(docs/ROADMAP.md): 도면 데모에 기능을 더 붙이지 않고, 픽셀 UI 공통 부품 → 게임 껍데기(화면 관리자, 단일 진입점) → UI 자동 검사 → 도면을 게임 화면으로 옮기기 순서를 추천.

## 2026-11-20 — 통합 단계 시작; 엔진 사다리 결정 (검토 31); 검토 28~31 문서화
- 엔진 조달(검토 31, 추천안 채택): 1930~35 조각은 완성 엔진 구매와 구매 후 개조만. 라이선스 생산, 자체 변형, 자체 계열은 뒤 단계에서 회사 규모와 설비로 연다.
- 검토 28~31을 docs/systems/에 문서로 옮겼다(대화에서 정한 내용 그대로).
- 픽셀 UI 공통 부품(ui/pixel/kit.ts): 즉시 모드. 화면이 매 프레임 ui.button / tab / field / stepper / list / label / paragraph / panel을 부르면 그리고, 눌렸는지 돌려주고, 사각형을 등록부(window.__ui)에 남긴다. 배치는 split / rows / pad로 사각형을 잘라 쓴다. 숫자 입력은 숨은 입력칸 하나를 함께 쓴다.
- 게임 껍데기(ui/shell/app.ts): 캔버스 하나, 픽셀 버퍼 하나, 장면 쌓기(push / pop / replace), 공용 소리, 저장. 화면 배율은 맞으면 정수 배, 2배가 안 되면 창에 맞춤. 진입점 하나(game.html, ui/game.ts). 저장은 HTML 책상과 같은 키라 한 게임을 둘이 읽는다.
- UI 자동 검사(tools/uicheck.mjs): 4가지 창 크기에서 화면을 차례로 눌러 가며 글자 넘침, 누름 위젯 겹침, 화면 밖 위젯을 오류로, 44 CSS px보다 작은 누름 영역을 경고로 보고. 현재 오류 0, 누름 영역은 큰 데스크톱(4배)만 통과.
- 도면 화면은 장면이 되었다(ui/scenes/drawing.ts): 주문은 밖에서 받는다(손님 문의에서 만든 체크리스트, 또는 데모 주문). "설계 확정"은 가게의 설계(Design)를 만들고 도면 편집을 그 안에 저장한다(design.drawing). 회사 규모가 도면 종류를, 날짜가 시대를 정한다.
- 픽셀 책상(ui/scenes/desk.ts) 1차: 날짜·날씨·돈, 할 일 / 설계 / 주문 목록, 문의 카드(편지, 원하는 것, 상담, 도면 그리기, 견적 보내기, 거절), 하루 보내기. 공급사·주간 계획·장부는 아직 HTML 책상에서.
- 뒷문 최소 길이 450 mm(540은 축간 -100 mm에서 바로 4라이트가 되어 너무 민감했다).

## 2026-11-20 — 게임 전체 구조 구상 검토 (검토 33, 결정 대기)
- 기획자 구상: 장소로 이어진 세계(집 앞, 주방, 차고, 공방), 다이얼 전화와 전화번호부, 손으로 하는 부식 수리와 도색, 예상도, 자유 조합, 작은 집에서 시작해 땅을 사서 확장.
- 검토 결과: 방향이 맞고 구현 가능. 바뀌는 것 셋: 시간 속도(하루 8초 → 천천히), 제작(시간 게이지 → 손작업), 시작(수리 먼저).
- 제안: 집 앞 장면 견본과 부식 수리 견본을 먼저 만들어 그림 품질과 손맛을 확인한 뒤 "수리 한 건 고리"로 간다. 직전의 서류 화면 순서(견적 답장 → 공급사 주문 …)는 이 순서로 바꾼다.
- 정할 것: 시간 모델, 손작업과 능력치의 관계, 사람 스프라이트를 누가 그리는가, 첫 조각의 길이(1930년 한 해).

## 2026-11-20 — 시트 추리기, 프레임 계획, 시간 흐름, 스프라이트, 견본 B (검토 34)
- 시트 101장 안개 측정: 맑음 69, 안개 31. 미국 · 스포츠/고급/상급 · 맑음 = 8대만 남긴다(docs/reference/sheet_haze_shortlist.md). 배달 밴, 플랫베드 견인 트럭, 택시, 1920년대 말~1930년대 초 손님 차는 고화질 · 안개 없는 시트를 새로 만든다(한 장에 한 대, 1500~2000 px, 네 보기 + 섀시).
- 프레임과 하부: 1차판의 프레임 형식 5종, 강재 3종, 매개변수, 무게·강성·강도 공식, 약한 곳, 가로대 자리를 가져와 입체 부품을 만드는 생성기로. 고정 거리 배치 대신 붙는 점(마운트)으로 구동계를 잇는다. 휘고 금 가는 손상은 새로 넣는다.
- 시간: 평소 하루 60초, 작업 20배, 상담 1배(기획자 안). 더할 것: 사건(손님 도착, 배달) 동안 느려짐, 움직임은 늘 실제 시간, 밤 넘기기, 코어에 분 단위 시계.
- 손작업과 능력치: 결과는 손, 기술은 도구의 너그러움(검토 33 추천안 채택).
- 사람 스프라이트는 외부 도구로(키 48~56 px, 4방향 걷기, 게임 팔레트로 다시 칠함). 배경 · 집 안은 먼저 그려 보고 참고 이미지 여부를 정한다.
- 견본 B(ui/scenes/bodywork.ts): 녹 6군데, 철수세미 · 납 메움 · 마스킹 테이프 · 스프레이건, 색 4가지, 검사(만족 점수와 반년 안 재발 확률), 긁기 · 스프레이 · 테이프 소리, 20배 작업 시계.

## 2026-11-20 — 견본 B 2차, 견본 A, 시트 수, 시간 흐름 결정 (검토 35)
- 맑은 미국 차 26대, 맑은 스포츠 · 초고급 · 경주차 52대(미국 3). 제안: 미국 26 + 수입 고급 · 스포츠 · 경주 20~25 = 약 50대.
- 시간: 평소 하루 60초, 작업 20배, 상담 1배 + 사건 동안 1초에 1분, 움직임은 실제 시간, 밤은 침대, 코어에 분 단위 시계(결정).
- 견본 B 2차: 가까이 보기와 화면 끝 화살표, 도구 그림과 그림자, 쇠솜 가닥 줄 · 밑칠 · 철판 순서로 천천히, 휠은 긁히고 타이어는 아님, 넓은 스프레이와 물방울, 같은 색도 3~5% 차이, 테이프는 밀어서 곧게, 캔 흔드는 소리.
- 견본 A: 집 앞 정면(30 mm/px), 시간 · 계절 · 날씨(비 웅덩이 반사, 눈 쌓임), 손님 차 도착 → 걸어와 노크 → 맞이 / 돌려보냄. 사람 스프라이트 기준 키 56~58 px.

## 2026-11-20 — 견본은 방향 확인, 다듬기는 판본에서 (검토 36)
- 견본에서는 평가를 막는 고장만 고친다(이번: 소리). 그림 · 자료의 규칙은 지금 종이로 정하고, 다듬기는 판본 반영 목록(docs/version_list.md)에 적는다.
- 소리: 누를 때 · 뗄 때 · 탭 · 키마다 소리 장치를 깨우고, 애플 기기는 재생 모드. 휴대폰에서 누르는 순간은 사용자 동작으로 치지 않아 소리가 멈춰 있었다.
- 제안(결정 대기): 깊이 줄별 축척(도로 1.00 · 보도 0.96 · 마당 0.92 · 집 0.86), 램프 빛은 차 모델의 램프 부품 자리에서, 돋보기로 부품을 골라 그 부품만 작업, 부품별 소재 · 칠 층 자료, 납 높낮이 보기와 납 줄.

## 2026-11-20 — 소재 · 칠 층 형식, 견본 B 3차, 제도판 앞뒤, 견본 C · D (검토 37)
- 소재 · 칠 층: 부품마다 바탕(종류, 두께, 녹, 납)과 칠 층(안→밖, 두께 µm, 단단함, 광택). render/car/finish.ts, data/cars/sedan29_finish.json(고증 확인 필요 표시).
- 견본 B: 옆 · 앞 · 뒤 보기, 부품별 칠 층, 돋보기(부품만 작업, 1~3배), 마스킹은 부품 선택 → 점선 치수 → 종이 → 네 변 테이프(덜 붙인 변으로 칠이 스밈), 소리 새로(알갱이 · 딱딱 · 쉿 질감).
- 제도판: 도면 옆 · 위 / 앞 · 뒤 전환, 외장 옆 · 앞 · 뒤.
- 견본 C 주방 상담: 질문 칸, 잡담으로 마음 녹이기, 차 · 커피로 2번까지 충전, 메모, 시간 멈춤. 집 앞 견본과 이어짐.
- 견본 D 전화: 탁상 전화 다이얼(돌린 만큼 펄스), 발신음 · 신호음, 번호부 탭, 교환원, 주문(값은 배달 때).

## 2026-11-20 — 두툼한 번호부, 판본 1단계 제안 (검토 38)
- 기획자 평가: 새 소리는 나아짐, 종이 마스킹은 기초 수준, 주방 · 전화 구도는 구상과 비슷.
- 번호부는 두툼한 책(흰 · 노란 페이지, 넘기기, 빼곡한 줄)으로 판본에서 만든다. 고역 방지 장치(업종 페이지, 책갈피, 단골 쪽지, 교환원 안내, 광고 번호, 직원 위임)를 함께.
- 제안(결정 대기): 견본을 더 늘리지 않고 판본 1단계 "세계의 뼈대" — 분 단위 시계, 장소 장면 틀, 손님 · 전화 · 배달을 코어와 연결, 차의 부품별 상태 저장, 공방 방.

## 2026-11-20 — 참고 이미지 · 새 차 시트 · 고증 · 남은 시스템 · 판본 1단계 (검토 39)
- 장소 참고 이미지 8장(화려한 A, 견본 기반 B): 480×270, 48색으로 줄여도 품질이 유지됨. 추천: B 구도 + A 빛 · 소품. 배경은 층으로 나눠 날씨 · 시간을 바꾼다.
- 새 차 시트 12장(서로 다른 20대, 하부 보기 포함, 맑음, 한 대 옆모습 약 400~470 px): 배달 밴 · 픽업 · 트럭은 채워짐. 견인차와 1920년대~30년대 초 대중 승용차가 아직 없다.
- 깊이 축척표 채택(도로 1.00 · 보도 0.96 · 마당 0.92 · 집 0.86).
- 고증(동호회 · 복원 자료): 래커 차체는 광택 낮음, 펜더 · 발판은 광택 높은 검은 에나멜, 엔진룸 무광 재팬, 1928~29 니켈 · 1930 무렵 니켈 위 크롬, 천 지붕은 1935 이전, 납 메움 공정(틴닝 → 주걱 → 줄 → 씻기). sedan29_finish.json에 반영.
- 차로 넘어오기 전 계획 12는 3번(은행)까지 끝, 4번(구인)이 다음이었다. 남은 묶음은 새 세계 구조에 맞춰 다시 배치(검토 39 4장).
- 판본 1단계 "수리 한 건의 하루" 제안(결정 대기).

## 2026-11-20 — 판본 1단계 시작: 분 단위 시계, 수리 의뢰 (검토 40)
- 결정: 장소 그림은 B 구도 + A 빛 · 소품, 집은 방갈로. 두 번 온 시트는 "닷지". 판본 1단계 시작.
- 승용차 · 견인차 시트 11장(22대) 받음: 대중 · 중급 세단 16대가 수리 손님 차 후보, 1924 렉커가 견인차(docs/reference/sheets_2026_11_20.md).
- 분 단위 시계(core/clock.ts): 하루 60초 / 사건 1분/초 / 작업 20배 / 상담 멈춤, 날짜는 05:00에 진행, 일정, 잠, 저장.
- 수리 의뢰(core/repair.ts): 부품별 손상(소재 · 칠 형식에서 녹스는 부품), 도착 시각 일정, 상담으로 예산 · 숨은 손상, 탁자에서 값 제시, 결과 → 찾아감 · 값, 재발 확률대로 불만, 만족이면 소개. 자기 난수 흐름.

## 2026-11-21 — 견인차 · 부품 라이브러리, 판본 1단계 3단계 장소 (검토 41)
- 바로잡음: 두 번 온 포드 B · 닷지 KC 시트는 첫 번째 시트를 쓴다.
- 견인차(추천): 판본 1에서는 운송 회사의 NPC 차. 제작 부품에 넣지 않는다. 나중에 "장비 차" 갈래로 크레인 붐 A/B, 윈치, 고리 · 달리 같은 장비 부품을 트럭 · 낡은 차대에 얹어 만든다(당시 실제 방식, 자료로 재확인).
- 부품 라이브러리(추천): 구석 버튼과 공방 책장의 카탈로그로 여는 창. 부품 모델을 크게 돌려 보고, 이름 · 회사 · 크기 · 무게 · 값 · 소재 · 맞는 차를 본다. 못 얻은 부품은 실루엣. 8단계 다음.
- 판본 1단계 3단계 장소: 집 앞 · 주방 · 공방 방 · 차고 · 전화 책상. 임시 바탕(참고 그림 480×270 64색), 물건 · 문으로 이동, 화면 전환, 시계 판, 장소별 속도, 일정 카드, 침대 잠, 매시 저장.

## 2026-11-21 — 살아 있는 장소 (검토 42)
- 지적: 참고 그림을 덮어씌우기만 해서 게임 같지 않다.
- 제안: 장소 = 고정 판 + 상태 물건 + 영역 지도 + 빛 층 + 공용 바깥. 빛 · 시각은 팔레트 대응 표, 흐르는 것은 색 순환, 경계는 디더링. 게임 상태는 물건으로 보인다(우편함, 신문, 공구판, 선반, 책장, 도면, 손님 차).
- 창문: 그림 · 소리 · 방 온도 · 차고 도색 환기(연무 대 먼지, 습한 날 래커 블러싱)로 이어진다.
- 전화: 다이얼 회전 프레임, 수화기 · 줄, 울림. 전화번호부: 두께, 넘김, 엄지 색인, 2단 지면과 광고, 읽기 보기, 연필 표시.
- 결정 대기: 주방부터 살리기, 그림 재료(판 · 밤 그림 · 물건 시트), 전화번호부 글.

## 2026-11-21 — 살아 있는 주방 (검토 43)
- 방식: 참고 그림을 분해(물건 · 구워진 빛 걷어 내기, 벽지 다시 찍기, 등 · 창밖 떼어 내기, 재질 지도)하고, 빛은 매 프레임 계산(실제 해 위치 · 창을 지나는 햇살 광선, 매단 등 · 되비침, 화덕 불꽃, 하늘빛), 15비트 색 + 순서 디더로 낸다. 칠의 질은 그림에서, 빛과 움직임은 게임에서.
- 주방: 등 줄, 아래 창 올리기, 성냥으로 화덕 · 주전자 끓이기(김, 뚜껑 달그락, 휘파람), 김 서림, 빗방울, 구름 · 새, 커튼 · 등 흔들림, 먼지, 수도꼭지 물방울. 집 상태는 저장.
- 결정: 그림 재료(빈 방 판 · 밤 그림 · 물건 시트) 받을 수 있음. 주방부터.
- 결정: 전화번호부 · 책자는 영어 지면 + 한글 풀이, 레드 데드 리뎀션 2의 책자처럼 책이 물건이 된다(전화번호부, 부품 카탈로그, 신문, 편지, 가격표가 같은 틀).

## 2026-11-21 — 깨끗한 주방, 빛줄기, 집 창 대칭, 공간 소리 (검토 44)
- 주방 바탕을 기획자의 새 그림(고른 빛, 등 꺼짐)으로 바꿈. 그림을 그대로 쓰고, 탁자 위 물건만 메움(의자 대칭 메움, 원근 따라 간격 재는 식탁보 메움). 찻잔 · 접시 · 우유병은 setting.png로 4단계에 씀. 등은 꺼진 그림 그대로 + 켜면 전구 · 갓 안쪽 · 번짐.
- 출력 18비트(64단계) + 약한 디더로 노이즈를 줄임.
- 창 빛: 공기 속 빛줄기(반 해상도 광선 행진), 해 원판 5광선 · 등 갓 5점으로 부드러운 그림자.
- 집 앞: 왼쪽 두 창을 문 중심선 기준 오른쪽 창의 거울 자리로 옮기고 벽 · 기둥을 되살림(tools/places/front.py). 새 집 앞 그림 사용.
- 사실적 빛(차 · 집 · 소품 · 사람 · 날씨): 가능. 노멀 · 재질 · 깊이를 갖춘 층 + 빛 계산 + 픽셀아트 계단. 집 앞을 살릴 때 GPU 셰이더로 옮김(추천).
- 공간 소리: 방 공기, 냉장고, 바깥 먼 공기, 귀뚜라미, 참새, 지나가는 차, 기차 기적, 판자 삐걱.
- 다음 소품 시트는 자홍 단색 바탕으로 부탁.

## 2026-11-21 — 주방 고침, 살아 있는 집 앞, 공방 계획 (검토 45)
- 주방: 눈 · 비는 유리 안에만. 커튼은 닫힌 창에서 가만히, 열린 창에서 바람이 천 한 폭을 한 덩어리로 휨. 식탁보는 색으로 가려 냄(상자 칠 없앰). 그림자는 해석적 반그림자(등 갓 입구 · 해 원판). 출력 단계 없앰.
- 집 앞: 게임이 그리는 하늘(실시간 구름, 실제 방위 · 고도의 해가 집 뒤로 동→서, 달 위상, 별), 흔들리는 나무, 굴뚝 연기, 가로등과 빛 웅덩이, 밤 창 불빛, 젖은 길 반사, 지붕 · 잔디 눈, 새.
- 공방: 기획자 참고 그림을 받으면 만든다. 넣을 세부와 부탁할 그림(빈 공방 판, 제도판 앞 빈 종이, 자홍 바탕 물건 시트) 정리. 추천 추가: 벽시계, 달력, 라디오.

## 2026-11-21 — 전화기 · 전화번호부 (검토 47)
- 순서 A(전화 먼저), 다이얼 방식으로 결정.
- 책상 · 책은 완성 장면, 전화기는 부품 시트(몸체 · 수화기 · 휠, 휠은 3배 크기에서 돌림). 수화기 들기 · 놓기, 꼬인 줄, 실제 다이얼(멈춤쇠, 펄스), 교환원(장거리), 통화료.
- 전화번호부: 영어 업종별 지면, 광고 상자, 한글 풀이(포인터), 연필 동그라미, 넘김, 엄지 색인. 공급사 통화는 즉석 견적(Supply.call) → 주문. 식료품은 다음 날 배달.
- 공방 새 그림: 빈 방 낮 · 밤 한 쌍으로 밤 색 대응표, 요소별 상태. 난로 없음(부탁 후보).
