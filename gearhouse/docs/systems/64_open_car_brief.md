# 64. Open cars, first build — brief for each car's agent (sheet 51747984)

Decision (2026-11-21): the first open bodies, two cars from one clear sheet, each built twice at the same time (one Opus
agent, one Fable agent) to compare the models on shapes the sedans never had. The sedans' guide and brief still hold:
docs/systems/62_direct_model_guide.md and docs/systems/63_sedan_batch_brief.md (method, tools, hand-in, rules, notes).
This brief adds what is new for open cars and names the parts so the four builds can be compared and merged.

| id | car (real name stays in docs/reference) | side on the sheet | wheelbase (approx.) | year | game name |
|---|---|---|---|---|---|
| fnTT33 | 1933 Frazer Nash TT Replica | left | 2590 mm | 1933 | 1933 light sports |
| bmw315 | 1935 BMW 315/1 Roadster | right | 2400 mm | 1935 | 1935 roadster |

Checked sizes (2026-11-21): bmw315 wheelbase 2400, length about 3800, width 1440, height 1350, track 1153 front / 1220
rear (two sources agree, track from one). fnTT33: wheelbase 2590 (8 ft 6 in) is the usual figure; no reliable length,
width or height was found. Scale by the wheelbase; report how far the sheet's length, width and height are from these.

## What is new
- **Scale.** These are low open two-seaters: about 3.3–3.9 m long, 1.15–1.40 m high to the screen top, 1.4–1.6 m wide.
  The sedan range in brief 63 does not apply.
- **The draft is weak.** The automatic draft was moved from the 1929 sedan: its body parts are a sedan's and are no use
  as shapes. Use it only for the wheel centres, the scale and the chassis layer.
- **The template's names are a sedan's.** Keep the script structure of tools/ref/sedan29_model.py (`part()`, `snap()`,
  `half()`, the box rules) but make the parts this car really has; there is no roof, no glass house, no doors with
  windows.
- **Curves.** The roadster's wings sweep down into the body and its tail is rounded in plan; the light sports car has
  separate cycle wings. Read each outline point by point off gridded crops, enough points for the curve (a wing's crown
  in the side view, the tail in the top view, the wing's section in the front view). Pick the surface kind that is
  nearest (`fender` for a wing or a rounded tail, `hood` for the bonnet, `side` for the body) and let modelshade.py
  carry the sheet's light, as the sedans did.
- **Seamless joins.** Every part is outlined where it meets a part drawn before it. Where the sheet shows no seam (a wing
  that sweeps into the body, a tail that runs on from the body sides), give the later part `join: ['body', ...]` (ids or
  id prefixes of the parts it runs into): no dark line is drawn between them. Keep the wings their own parts (they are
  the player's swap slots); do not merge them into the body to hide a seam. Where the real car has a seam or welt, leave
  the outline.

## Open body: what is and is not drawn
- **Not drawn** (as for the sedans, and added for open cars): no seats or cushions, **no steering wheel** or column, no
  dashboard or instruments, no pedals or levers, nothing inside the car.
- **Drawn:** the cockpit opening as one part (`cockpit`, material `black`, the dark well seen from the side above the
  door line and from the top), its padded or beaded rim if the sheet shows one, the screens (fold-flat screen or twin
  aero screens: glass with their frames), a tonneau or hood cover lying on the body, the bonnet straps, the spare wheel,
  the fuel tank and filler where it is outside the body, the stone guard over the radiator, flags and badges as decals
  if the tools allow, otherwise leave them out.
- **Running gear seen from outside.** Where the sheet shows the front axle, springs, shock absorbers, the chain case,
  the exhaust pipe and silencer along the side, brake drums or levers in the side or front view, draw them from the
  sheet as the car's own parts, id prefixed `vis_` (`vis_axleF`, `vis_leafF`, `vis_damperF`, `vis_exhaust`, ...), with
  the elements in the list below. Do not change the chassis layer (parts with `layer: 'chassis'`): it is generated for
  the under view and the engine swap. The game will hide a chassis part where a `vis_` part of the same element is drawn.

## Screens in the plan view (decision 2026-11-22)
A raked screen seen from above shows only its frame's top edge: draw the plan outline of the frame as a thin bar
where the top edge lies (its x read off the side view), and give the glass no plan outline. This holds for every car
from now on, open or closed.

## Spare wheels (decision 2026-11-22)
A spare is the car's own wheel: give only the part `spare` (element `spare`) where it sits in each view and `wheel`,
then run tools/ref/sparegen.py on the model. It takes the car's tyre radius and tyre width, draws the views that see it
flat on with the car's wheel spec (so changing the wheels changes the spare), and the edge-on views as the tyre's section.
Covers, straps and carriers stay the car's own parts.

## Seats in open cars (decision 2026-11-22)
Do not draw seats. Run tools/ref/seatgen.py (`--style bucket|bench --color <the sheet's leather>`) last: it makes the
seat tops from the car's `cockpit` part.

## Element names (use these; the four builds are compared part by part)
Existing elements, as the sedans use them: `body`, `hood`, `cowl`, `radiator`, `lamp`, `fenderF`, `fenderR`, `apron`,
`board`, `bumperF`, `bumperR`, `tail` (the tail lamp), `screen`, `spare`, `wheel`, `house`, `tank`, `exhaust`, `axle`,
`spring`, `frame`.

New elements for open cars:

| element | what | slot |
|---|---|---|
| `cockpit` | the opening, its dark well and rim | — |
| `tonneau` | a cover over part of the cockpit, or the folded hood lying behind it | — |
| `deck` | the rear body behind the cockpit when it is its own panel (rounded or pointed tail, the panel over a slab tank) | — |
| `strap` | a leather strap over the bonnet | — |
| `guard` | the stone guard (mesh) over the radiator or lamps | grille |
| `damper` | a shock absorber seen from outside | — |
| `chain` | the chain case or sprockets of a chain-driven car | — |
| `filler` | a fuel or radiator filler cap standing above the body | — |
| `marker` | a small knob or lamp on a wing's crown (added after the first build) | — |
| `mirror` | a mirror on its arm (added after the first build) | — |

Small uprights or overriders on the front or rear valance belong to `bumperF` / `bumperR` (a car with no cross bar
may still have them).

- Cycle wings are `fenderF` / `fenderR` in the `fenderF` / `fenderR` slots (they mount at the wheel). A car with no
  running board has no `board` part.
- If you find a thing that fits none of these, give it a short camelCase element name of your own and list it in the
  report under **New elements** (name, what it is, which views show it, why no existing element fits). Do not stretch an
  existing element to cover something else.

## Hand in (in your own folder)
As brief 63 (the script, the json, run.sh, cmp.png + cmp.json against the draft, parts.png, report.md, notes.md), plus in
report.md: **New elements** (above), **Curves** (which outlines were hard, how many points, how you checked them against
the sheet) and **Open body** (what you drew of the cockpit, screens, covers and visible running gear, and what you left
out under the rules). Write only in your folder; change nothing in the repository; do not commit.
