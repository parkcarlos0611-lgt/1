# Reference sheets to game cars

`trace.py` splits a sheet into views, scales the side view by the car's length, finds the wheels and traces the areas between the drawn outlines into panels. `render.ts` draws the result with the game's body renderer; `compare.py` sets source, materials and game drawing side by side.

Sheets and real names stay outside the repository (see docs/reference/cars_catalogue.md for the working list). Needs `opencv-python-headless`.

Method Z (structure first): `sedan36_z.py` fits a hand-written body to its view and cuts the shell into elements (`zkit.py`), `shade.py` reads how light falls on each element, `zscore.py` scores a drawing against the view element by element, `ztest.ts` and `zsheet.py` set the same changes on a pixel map and on elements side by side. Needs `shapely`.
