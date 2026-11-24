# 62. Making a car's part model by hand (the "direct" method) — the common guide

Used for the conversion trial (review 61/62): the same guide for Claude in the main session and for the agents, so the
results can be compared. Writes are English (repository language); the planner reads the report in Korean.

## The goal
A 3D part model of one car from the planner's sheet, as good as `data/cars/sedan29.json` (the 1929 sedan, made by
hand from a sheet by the same artist; `tools/ref/sedan29_model.py` is how). "As good" means:
- every part's outline in every view it shows in (side, front, rear, top) lies on the sheet's drawing: the silhouette,
  the panel joins, the glass, the lamps, the wings, the running board, the radiator shell, the spare;
- the car's real build is kept: parts this car has that the template has not (more or fewer windows, a different
  radiator shell, a visor, a trunk, side-mounted spares, cowl lamps, bumpers of another shape), parts it lacks removed;
- the parts keep the standard names, elements, materials and slots of the template (hood, cowl, body, roof, fenderF,
  fenderR, board, step*, lamp, shell, glass*, wframe*, screen*, tyreF/R, ...), so parts can be exchanged between cars
  and the game's systems (bodywork, finish layers, damage) find them. New parts get names in the same style;
- colours (paint, paint2, canvas, chrome, glassTint) and the wheel spec (wire / artillery / disc, spokes, rim
  material) as the sheet shows them;
- symmetric outlines stay symmetric; boxes agree between views within a few mm.

## What you start from
- The car's six views cut from the sheet: `v_front.png v_rear.png v_left.png v_right.png v_top.png v_under.png` in
  your folder (`v_left` is the side view the model is fitted to; 8–10 mm a pixel).
- `draft/<id>.json`: the automatic converter's model (`tools/ref/autocar.py`): the template's parts moved onto this
  car by landmarks and snapped to its lines. Its report says which landmarks it found. Start from it or from scratch,
  as you judge best; say which.
- `draft/mv_auto/`: the draft drawn by the game (`tools/ref/modelviews.ts`).

## Tools (all in `tools/ref/`)
- `sedan29_model.py`: the hand-made template's script. `part(...)` takes outlines in the sheet's pixel coordinates on
  a 4x enlargement of each view (`S(px, py)` side, `F(dx, py)` front), `fit=` pulls an outline onto the nearest lines,
  `half()`/`fhalf()`/`halfT()` mirror half outlines. Copy its structure for your car's script.
- `zkit.py` (`View`, `fit_closed`, `fit_open`): the line fitting.
- `modelviews.ts <model> <dir>`: draws the model's views and every part alone (`npx tsx`).
- `partsheet.py <modelviews dir> <png>`: the parts check sheet (each part alone in each view).
- `tiles.py <model> <modelviews dir> <views dir> <png> [ids]`: each part's outline over the enlarged sheet.
- `autocmp.py <views dir> <png> <label=modelviews dir> ...`: side by side with the sheet, with scores
  (silhouette agreement, share of the model's edges on the drawing's lines). Use it with `draft=` and yours.
- `modelshade.py <model> <views dir> <modelviews dir>`: reads how light falls on each painted part (run last).

## What to hand in (in your folder)
- `<id>.py`: the script that writes the model (reproducible; no hand-edited JSON).
- `<id>.json`: the model.
- `cmp.png` / `cmp.json`: `autocmp.py` with `draft=` and `direct=` (yours).
- `parts.png`: the parts check sheet.
- `report.md`: what you changed from the draft and why, parts added or removed, the scores before and after, what is
  still wrong, and roughly how long it took.

## Rules
- Write only in your own folder. Do not change anything in the repository (no edits to `tools/`, `data/`, `ui/`,
  `render/`, `docs/`), do not commit.
- The game-facing `name` is a plain one ("1926 large sedan"), never a maker's name.
- Look at the pictures. A score can be good while a part is plainly wrong; the planner will judge by eye.
- Stop when another hour would change little; say what you would do with more time.
