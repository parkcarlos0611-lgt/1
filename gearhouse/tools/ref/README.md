# Reference sheets to game cars

`trace.py` splits a sheet into views, scales the side view by the car's length, finds the wheels and traces the areas between the drawn outlines into panels. `render.ts` draws the result with the game's body renderer; `compare.py` sets source, materials and game drawing side by side.

Sheets and real names stay outside the repository (see docs/reference/cars_catalogue.md for the working list). Needs `opencv-python-headless`.
