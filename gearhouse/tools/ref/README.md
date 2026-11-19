# Reference sheets to game cars

`trace.py` splits a sheet into views, scales the side view by the car's length, finds the wheels and traces the areas between the drawn outlines into panels. `render.ts` draws the result with the game's body renderer; `compare.py` sets source, materials and game drawing side by side.

Sheets and real names stay outside the repository (see docs/reference/cars_catalogue.md for the working list). Needs `opencv-python-headless`.

Method Z (structure first): `sedan36_z.py` fits a hand-written body to its view and cuts the shell into elements (`zkit.py`), `shade.py` reads how light falls on each element, `zscore.py` scores a drawing against the view element by element, `ztest.ts` and `zsheet.py` set the same changes on a pixel map and on elements side by side. Needs `shapely`.

Method ZY: `capture.py` with the fitted body's roles, then `skin.py`, hands the view's detail to the elements (`data/skins/<id>.json`); `render.ts` attaches `<id>.skin.json` lying next to a body, `ztest.ts` takes the skin as its last argument.

ZY2 and Z2 (review 21): `zkit.build` with a small per-car script (`speedster35_z.py`, `pickup48_z.py`) makes the elements; `skin.py --common --fill --clean` writes `data/skins/<id>.json`, `decals.py` turns it into `data/decals/<id>.json`; `ztest2.ts <id> <donor id> <dir>` draws seven changes for both, `zsheet.py` (A=, B=) and `zrow.py` lay them out.
