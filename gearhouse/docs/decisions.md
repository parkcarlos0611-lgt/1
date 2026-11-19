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
