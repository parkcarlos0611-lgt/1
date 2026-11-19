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
