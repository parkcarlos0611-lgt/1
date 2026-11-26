# dodgeV28 — "1928 six sedan" (sheet d5f881aa, the right-hand car), made by hand

Script `dodgeV28.py` (written from scratch in the structure of `tools/ref/sedan29_model.py`; helper block and
chassis-layer block taken over from the batch's `pontiac29.py`), model `dodgeV28.json`, `./run.sh shade` rebuilds
everything (model, `mv/`, sheet light with `modelshade.py`, `cmp.png`/`cmp.json`, `parts.png`).
The draft was used only for the chassis layer (20 parts, moved onto this car's wheel centres); every body-layer part
is new.

## Scale (what I used)
- Hub caps at 258 and 1565 on the 4x side view; with the given wheelbase 2864 mm that is 2.191 mm a unit
  (8.77 mm a pixel, as the draft measured). Length 4225, height 1841 — plausible for this car; the wheelbase was kept.
- Tyre radius 392 mm (the draft had 404). The sheet's tyre is 358 units across, but its hub cap sits about 11 units
  above the tyre's middle, so "ground to hub" (192 units = 420 mm) over-reads the radius. I took the tyre's own width.
- Width 1780 mm: the front and rear views drawn at the side view's height scale would give about 1950, the plan
  about 1630; each view is mapped onto the one width.

## Scores (autocmp; silhouette / edges on lines)
| view  | draft         | direct        |
|-------|---------------|---------------|
| side  | 0.901 / 0.717 | 0.951 / 0.808 |
| front | 0.849 / 0.632 | 0.962 / 0.751 |
| rear  | 0.892 / 0.599 | 0.965 / 0.743 |
| top   | 0.885 / 0.582 | 0.959 / 0.616 |

## What was built (against the draft, which is the 1929 template stretched)
- **Body in two**: `body` (blue, following the rear wheel arch behind the wing) and `bodyTop` (black above the belt,
  with the rear quarter's edge, drip moulding, pillar seams, pillar glass slits in the front view). New `belt`: the
  broad lighter-blue belt moulding from the cowl back, sweeping up over the rear quarter and round the back (side,
  rear, front).
- **Roof** low black cloth cap with its real profile and plan welt; new **`visor`** (side wedge, front band, plan).
- **Radiator**: flat bright shell with the broad arched top that dips to a point, `core` directly in it (no `lip`),
  winged `badge` + `badgeGem`, `cap` as a winged motometer. The maker's lettering on the core is left out.
- **Hood / cowl**: 24 louvres, side hinge seam, lit shoulder, latch; the bright band between hood and cowl as a trim
  line on the cowl (a 20 mm chrome part drew as a dark line); new `cowlLamp`s (side, front, plan); `dashTop`, the
  wood seen behind the cowl from above.
- **Lamps**: drum headlamps — black bowl (`lamp`), deep bright `lampRim`, `lampGap`, pale `lens` — on `lampStand`s,
  with the bright tie bar `lampBar` across the shell.
- **Screen**: one pane; dark from in front (`cabin`) with the rear window showing pale through it (`screenThrough`),
  the `steering` wheel on the driver's side and a `wiper` hanging from the top.
- **Windows**: three a side, each black surround (`wframe0-2`) with a dark wood garnish (`wood0-2`, widest at the
  rear edge as on the sheet) and `glass0-2`; through the glass the steering wheel (`seenWheel`) and the seat backs
  (`seenSeat1/2`). Rear window in a wood surround with rounded corners (`rearFrame`, `rearGlass`).
- **Doors**: front door hinged at the A post, rear door at the C post (hinges on both, above and below the belt),
  double shut line at the B post, heavy bright handles either side of it (`doorHandle0/1`, standing out in the front
  and rear views too), sill crease.
- **Wings** redrawn: blades with a crease along the crown over black wheel houses (side), bulb and inner sweep to
  the frame (front), rear wing from behind, plan outlines. Their own lighter black (#3d3d44) so they stand off the
  wheel houses. New `hornF` (the dumb iron's end ahead of the front wing).
- **Board**: aluminium tread plate with a full-length bright `boardTrim`; no separate step plates.
- **Bumpers**: front two bars, a clamp a side and a medallion at the centre (`clampF0/1`); rear two split
  bumperettes a side with pointed inner ends and one clamp each (`bumperR0/1` as pairs, `clampR0`).
- **Tail**: one tail lamp on the left (`tailRim`, `tail`), a blank plate under it (`plateRim`, `plate`).
- **Spare** on the back at the sheet's place and size, an artillery wheel from behind.
- **Wheels**: artillery, 16 spokes, painted the body's blue, thin bright ring on the rim (`trim`), nickel cap; rim 0.68.
- **Colours** from the sheet: paint #1c2a42, paint2 #27272b, canvas #29292d, chrome #a9a6a5, glass #b7bdc5;
  bodyTop #202022, belt #33455e, valance and wheel houses #1c1b1e.

Parts added (not in the draft): badge, badgeGem, belt, boardTrim, bodyTop, cabin, clampR0, cowlLamp, dashTop,
doorHandle0, doorHandle1, hornF, lampRim, plate, plateRim, rearFrame, screenThrough, seenSeat1, seenSeat2, seenWheel,
steering, visor, wiper, wood0, wood1, wood2.
Parts removed (template parts this car has not): handleR, lip, pillar, plateLamp, rearBar, screenBar, spareHub,
step0, step1. The rest keep the template's ids, elements, materials and slots. 95 parts in all (75 body, 20 chassis).

## What is still wrong
- **Wings read thinner than the sheet's.** The outlines lie on the sheet's crowns, but the sheet lights the whole
  blade grey down to the wheel house while the game lights only a band; in the front view the bulbs look less full
  for the same reason.
- **Wheel centre**: the game stands the wheel on the ground at its radius, so the hub is drawn about 25 mm lower
  than the sheet's (see Scale).
- **The plan** is drawn about 8 units (20 mm) off centre on the sheet and its nose and tail lie elsewhere than in
  the side view; the model is symmetric and each view keeps its own place. `work/build.log` lists every difference
  over 50 mm. The main ones: shell and cap 100 mm further forward in the plan than in the side view; rear wing,
  bumperettes and bumper stays 120–170 mm further forward in the plan; boards 160 mm shorter in the plan; the body
  90–150 mm taller in the front and rear views than in the side view; hood and cowl narrower in the plan than in
  the front view (about 115 mm).
- Top-view edge score stays low (0.616): the plan's wings and roof are soft dark shapes with few lines to lie on.
- The roof in the plan and the screen's pale patch draw lighter than the sheet; the shell's arch draws whiter.
- Not modelled: the maker's lettering, the plate's lettering, the fluting of the hood's side panels seen from in
  front, bumper stays in the plan beyond simple bars, the brake drums, the rear blind. The spare's wheel is the road
  wheel spec (the sheet's spare shows a slightly fatter tyre).
- `v_right.png` was not checked against the mirrored model; the chassis layer is the draft's (under view not used).
- parts.png was only glanced at reduced size (no part is empty or misplaced there); I did not run `tiles.py`.

## With another hour
A `tiles.py` round on every part; the front wings' bulb and the plan wings point by point at 8x; the chassis layer
from `v_under.png`; the right-hand view.

## Time and rounds
About 60 minutes: ~30 reading the guides, examples and gridded crops and writing the first script (it built first
time), then 6 build-and-look rounds (`work/look.py` overlays, `work/pairs.py` side-by-sides; `work/all.png` is the
last look). Nothing in the repository was changed.

Files: dodgeV28.py, dodgeV28.json, run.sh, cmp.png, cmp.json, parts.png (parts_1..6.png singly), report.md, notes.md,
mv/ (the game's drawings), work/ (grid.py, look.py, pairs.py, build.log, shade.log, check pictures).
