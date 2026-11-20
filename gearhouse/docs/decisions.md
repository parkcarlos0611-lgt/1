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
