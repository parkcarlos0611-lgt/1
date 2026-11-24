# 67. Cars at full resolution over the scene (review 72) — kept as a setting, off

Decision (2026-11-22): the game keeps the scenes' own pixel scale for cars (the earlier proportions). The full-resolution
car layer stays in the code as a setting, `app.hiCars`, `'off'` by default.

## What it does
- The scene draws the car on its own grid as before (lit by the hour, mirrored on the wet road, hidden by the lamp post).
- The same car is drawn again at twice the detail (`carSprite(..., { mm: CAR_MM / 2 })`, the driver drawn larger) and laid
  over the scene on a sharper canvas above the pixel screen (`app.after()`, ui/shell/app.ts), at the scene's size. On a
  1920x1080 window each of its pixels is 2x2 screen pixels.
- Each fine pixel takes the light the scene gave the car at that spot: the light's colour averaged over the whole car,
  its strength averaged over each coarse pixel's neighbours (per-pixel ratios stained the paint along seams).
- A fine pixel is left out wherever the scene's pixel there has changed since the car was drawn (the caller walking past,
  exhaust, the interface) or where the scene did not light it as the car (a lamp post standing before it).
- Modes: `'off'`, `'wheels'` (only inside the wheels' circles: fine spokes on a coarse body), `'all'`.
- Only the side view is laid over; the turning pictures (yaw frames) are drawn on the grid.

## Why it is off
The finer pixels of the car next to the coarser scene read as two styles. The wheels-only mode is the mildest; it was
tested once (docs/reference/hicar_front_1.png shows the whole-car mode).

## Where it lives
ui/shell/app.ts (`hiCars`, `after()`, the over-canvas), ui/world/front.ts (`hiCar()`), ui/world/car.ts (driver scale).
