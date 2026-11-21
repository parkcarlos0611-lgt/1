# willys27 — "1927 sleeve-valve sedan", made by the direct method

Sheet 38bcc8df, the left-hand car. Model: `willys27.json` (99 parts: 79 body-layer, 20 chassis-layer), written by
`willys27.py`. Rebuild: `./run.sh shade` (script, `modelviews.ts`, `modelshade.py`, `modelviews.ts` again,
`autocmp.py`, `partsheet.py`). The JSON is the script's output plus the `shade` entries `modelshade.py` adds (hood,
cowl, body, bodyTop, postF, screenBar, fenderF, fenderR); nothing is edited by hand.

## Start: from scratch
Body-layer parts are written new in the structure of `sedan29_model.py`, outlines read point by point off gridded 8x
enlargements of each view (`S()` side, `F()` front, `B()` rear, `T()` plan, all in 4x-view units). The draft was used
only for its 20 chassis-layer parts, moved onto this car's wheel centres.

## Scale
The tyres stand on the ground centred at 264 and 1430 (4x units) on the side view: the true road wheels (the spare
hangs behind the body at 1632-1737 and was not taken for one). 1166 units = the given 2883 mm wheelbase, 9.89 mm a
pixel: length 4322, height 2067, wheels at x 653 and 3536, tyre radius 445. **The height is above the brief's
1.70-1.95 m band, and the wheels are large (0.89 m)**: the sheet draws this car tall and short for its wheelbase
(height / wheelbase 0.72; the real car about 0.64). I kept the given wheelbase, as the draft and the batch's Model T
did. Scaled to a 1.90 m height instead, everything would be 0.92 of this (wheelbase 2650, length 3970, tyre radius
409) — one number, `K`, in the script. Width 1870 (the draft's): the front view at its own height scale gives 1920,
the plan 1750.

## Scores (autocmp.py; cmp.png, cmp.json)
| view | draft silhouette | direct silhouette | draft edges on lines | direct edges on lines |
|---|---|---|---|---|
| side  | 0.938 | 0.980 | 0.776 | 0.885 |
| front | 0.947 | 0.959 | 0.735 | 0.858 |
| rear  | 0.963 | 0.962 | 0.757 | 0.823 |
| top   | 0.885 | 0.963 | 0.731 | 0.814 |

## What was built (against the draft, which is the 1929 template stretched)
- **Body in two**: `body` (olive, to the belt; its side follows the rear wheel arch, its back tapers in under the
  belt) and `bodyTop` (green-black above the belt, with drip moulding, belt moulding, post seams). Door seams as the
  sheet has them: front door hinged at the cowl, rear door hinged at the back, a double seam at the centre post, the
  rear door's cut following the wheel arch.
- **Wood**: every window sits in a varnished wood surround — `wframe0-2` (wood) with `wreveal0-2` (the dark reveal)
  and `glass0-2`; the rear window the same (`rearFrame`, `rearReveal`, `rearGlass`, `rearBar`: two panes); the
  windscreen is a wood-framed two-pane screen standing ahead of the corner posts (`screenFrame`, `screenIn`,
  `screen`, `screenBar`, seen edge on from the side and as a wood line in the plan, `screenTop`), with a `wiper`.
  The wood steering wheel shows through the screen and the front side glass (`steerRim`).
- **Corner posts** with narrow panes either side of the screen (`postF`, `postGlass`, front view).
- **Roof**: low black cloth cap with rounded back corners, the body's outline in the plan with its welt; new `visor`.
- **Radiator**: narrow nickel shell with a low arched top; the `core` directly in it (no `lip`) and its dark edge
  ahead of the shell in the side view; diamond `badge` + `badgeGem`; crank hole (`crankCover`); `cap` is the winged
  ornament. The maker's script on the core is left out.
- **Hood / cowl**: 20 louvres, the fold line, two latch knobs, a raised `hoodBand` between hood and cowl, centre hinge
  strip in the plan; **cowl lamps** (`cowlLamp`, `cowlLens`) in side, front and plan.
- **Lamps**: nickel drum-fronted bowl lamps (`lamp`, new `lampRim`, `lampGap`, `lens`) on beaded nickel posts
  (`lampStand`), the tie bar (`lampBar`) in the plan only (the front view does not show it).
- **Wings**: blades over black wheel houses (side), the bulbous nose with the broad inner sweep to the frame (front),
  the rear wing from behind, plan outlines.
- **Board**: ribbed `board` with a full-length bright `boardTrim`; no step plates.
- **Doors**: nickel `doorHandle0/1` (also standing out in the rear view), long nickel `hinge0-2`.
- **Bumpers**: two full-width bars front and rear (the rear is not split on this car), one clamp a side
  (`clampF`, `clampR`) and end caps (`endF`, `endR`).
- **Tail**: two tail lamps on the rear wings (`tailRim`, `tail`). **Spare** on the back at the sheet's place and size,
  a wire wheel from behind.
- **Colours** from the sheet: paint #55573c, paint2 #2b2c30, canvas #333235, chrome (nickel) #9f9683, glass #a6a3ad;
  bodyTop #20211a, wood #c8742e, valances and wheel houses #1e1e20.
- **Wheels**: wire, 40 spokes, rim 0.63 painted the body's olive, nickel hub cap (0.2, two rings).

Parts added (30): bodyTop, postF, postGlass, visor, badge, badgeGem, crankCover, hoodBand, cowlLamp, cowlLens,
screenIn, screenTop, steerRim, wiper, doorHandle0, doorHandle1, hinge0, hinge1, hinge2, wreveal0, wreveal1, wreveal2,
rearFrame, rearReveal, boardTrim, lampRim, clampF, endF, clampR, endR (clampF replaces the template's clampF0/1).
Parts removed (template parts this car has not): lip, pillar, step0, step1, plateLamp, handleR, spareHub,
clampF0/clampF1 (one clamp a side here). All others keep the template's ids, elements, materials and slots.

## What is still wrong
- **Scale**, as above: 2.07 m high on the given wheelbase.
- The **wood surrounds** are 15-20 mm wide on the sheet (under 2 game pixels); I drew them about 22 mm so they
  survive, and the game outlines them dark, so they read as a dark red-brown line with an orange core rather than the
  sheet's clean orange. The steering wheel rim reads maroon for the same reason.
- The **wings** read flatter and blacker than the sheet's glossy blue-black with broad lit crowns.
- The glass is drawn only where the sheet shows it pale (the rear two side windows have a dark blind edge behind the
  glass; the screen is mostly dark with a pale band): the dark remainder is the reveal part, not glass.
- Door handles and cowl lamps draw smaller and plainer than the sheet's; the lamp bowls are paler than the sheet's
  dark-reflecting nickel; the spare's tyre is bluer than the sheet's grey.
- The sheet's views disagree (each view keeps its own place; `work/build.log` lists the 47 differences over
  50 mm). The main ones: the rear wing is 135 mm longer in the side view than in the plan and sits 84 mm further
  back; both bumpers are 170-190 mm wider in the front and rear views than in the plan; the rear bumper is 70 mm
  further back in the side view than in the plan; the front wing's crown is about 90 mm higher in the side view than
  in the front view; the visor and roof are 50-60 mm apart between side and plan.
- Not modelled: the interior beyond the steering wheel, the maker's script on the radiator, the hub caps seen past
  the bumper ends in the front view, spring shackles and brake gear from behind, small rivets on the board. The
  chassis layer is the draft's (template engine moved); `v_under.png` and `v_right.png` were not used.

## With another hour
Thicker lit wing sections; a `tiles.py` round on every part; the interior feature; the chassis from the under view.

## Time and rounds
About 30 minutes: reading the six gridded views and writing the first script, then 4 build-and-look rounds
(`work/look.py` side-by-sides, `work/over.py` outlines over the sheet). The first round's biggest error was the body's
back edge, 40 units too far forward (see notes.md, pitfalls). Nothing in the repository was changed.

Files: willys27.py, willys27.json, run.sh, cmp.png, cmp.json, parts.png (parts_1..6.png singly), report.md, notes.md,
mv/ (the game's drawings), work/ (helpers, build.log, shade.log, check pictures).
