# 65. Two luxury cars (sheet 94e0a997) — brief for each car's agent

Decision (2026-11-22): two cars from one clear sheet with all six views, each built once by a Fable agent. The rules of
docs/systems/62_direct_model_guide.md, 63_sedan_batch_brief.md and 64_open_car_brief.md hold (method, element names,
what is not drawn, seamless joins, screens in plan, spares, seats); this adds what is particular to these two.

| id | car (real name stays in docs/reference) | column on the sheet | wheelbase | year | game name | body |
|---|---|---|---|---|---|---|
| dueSSJ35 | 1935 Duesenberg SSJ | left | 3175 mm (125 in, two sources) | 1935 | 1935 grand roadster | open: brief 64 |
| dueA21 | 1921 Duesenberg Model A coupe | right | 3404 mm (134 in, two sources) | 1921 | 1921 grand coupe | closed: brief 63 |

Checked sizes: dueA21 track 1422 mm front and rear (56 in), tyres 33 x 5 in (about 419 mm radius), length about
5230 mm in one source (the sheet at the wheelbase's scale gives about 4740: report the difference, do not stretch).
dueSSJ35: no reliable length, width or height was found.

## The grand roadster (dueSSJ35)
- The outside exhaust: four flexible chrome pipes leaving the bonnet side on the car's **right** (y < 0; the sheet's
  second side view, v_right) and running down into the wing. Draw them as `vis_exhaust` parts on the right only, read
  off v_right; the game's main side view is the left, where they lie behind the bonnet. Read them as the Frazer Nash's
  exhaust was finally read (tools/ref/sheetcars/fnTT33.py): each length its own part, the bright edge and the bends.
- Two-tone paint: the body pale grey (`paint`), the wings and their sweep darker (`paint2`).
- Seats: none drawn; run `tools/ref/seatgen.py <json> --style bench --color <the sheet's tan>` last. The folded hood
  and its tan cover behind the seats are `tonneau`.
- The spare on the tail with its strap: place the part `spare` (with `wheel`) and run tools/ref/sparegen.py; the strap
  is its own part.
- Bumpers front and rear, twin horns or lamps on the front cross bar as the sheet shows.
- Gloss: set `"gloss": 0.85` on the model (a polished show car).

## The grand coupe (dueA21)
- A closed two-door coupe in black: black body, black wings, black tyres with white walls. Read the black-on-black
  outlines point by point off the gridded crops (brief 63); the pale outline the sheet draws round the body helps.
- White-wall tyres and wire wheels: the wheel spec (`whitewall`), not parts.
- The radiator shell is bright (nickel); bonnet louvres; the glass in plan follows brief 64's rule (frame top only for
  the screen).
- Gloss: `"gloss": 0.75`.

## Hand in
As brief 63 and 64, in your own folder. Do not change the repository; do not commit.
