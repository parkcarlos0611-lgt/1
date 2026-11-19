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
