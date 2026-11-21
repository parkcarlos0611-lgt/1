# hudson26: the 1926 large sedan, a part model made by hand (the direct method)

Folder: `/tmp/claude-0/-home-user-1/0b845933-8226-57c8-b442-07d308e42630/scratchpad/direct/hudson_opus/`
Hand-in files: `hudson26.py`, `hudson26.json`, `cmp.png` + `cmp.json`, `parts.png`, this report. Work files are in `work/`.
`work/run.sh` runs the whole chain: the script, then modelviews, then modelshade, then modelviews again, then autocmp, partsheet and tiles.

## Starting point
I wrote it **from scratch** in the template's form. `hudson26.py` copies the structure of `sedan29_model.py`: the same
`part()`, `snap()`, box averaging and outline normalising. I did not edit the draft. I used the draft only to compare
against and for its landmarks (scale, wheel centres), which I checked again. Every outline is read off this car's own
cut views on a 4x enlargement with a 20 px grid (`work/grid.py`). Each view has its own scale (`S`, `F`, `B`, `T`):
side 2.451 mm per 4x px, front 2.006/2.060, rear 2.125/2.105, plan 2.416/2.626. The wheel centres come from a Hough
circle fit on the side view (px 244.5 and 1564.5), so FX = 599, RX = 3835 and the wheelbase is 3236 mm (target
about 3235). R = 441, the track is 765, L/W/H = 4725/1870/1961. Large outlines are pulled onto the drawing with
`fit=`, which moves them by 4 to 11 mm on average.

The chassis layer (engine, gearbox, driveline, exhaust, tank, steering) is the template's chassis mapped onto this
wheelbase and size in the script. The sheet's under view was not used for it.

## Scores (autocmp, silhouette / edges on lines)
| view  | draft         | direct (final)    |
|-------|---------------|-------------------|
| side  | 0.932 / 0.695 | **0.982 / 0.825** |
| front | 0.892 / 0.660 | **0.954 / 0.785** |
| rear  | 0.915 / 0.632 | **0.975 / 0.777** |
| top   | 0.919 / 0.626 | **0.958 / 0.731** |

Running modelshade (the last step) raised the side lines score from 0.805 to 0.825. It changed the other views by less
than 0.01.

## What changed from the draft, and why
- **Upper body**: on this car everything above the belt is black, leather-covered like the cap: pillars, the rear
  quarter, the header. The draft painted it maroon and gave it a thin roof strip. `roof` is now the whole black
  greenhouse in all four views, with the windows, screen and rear glass on it.
- **Windows**: three side windows at the sheet's openings (780-1060, 1110-1360, 1395-1685 px), each with a wood
  garnish (`wframe*`, material wood) around the glass. The draft's windows were shifted and too small.
- **Radiator shell**: this car has a tall shell with an arched top and a badge. The shell, lip and core are traced
  from the front sheet, and the core has fine vertical flutes. The draft had the template's round-bottomed shell.
  I added the motometer cap from the side and front sheets.
- **Front wings**: the crown, lip and sweep down to the board are traced from the side view, with the wheel cut at
  r 462. The draft's wing sagged far below the board. The face-on view is a dome, and the plan view is the wide
  crescent with its nose ahead of the lamps.
- **Rear wings**: traced in side, rear and plan. In the plan view the draft's wing reached past the body.
- **Headlamps**: black bowls with a nickel front rim (`lampRim`) on stands, sized and placed from the front sheet
  (centre 213 px out, r 63 px). The draft's lamps were all chrome and sat too low and too far in.
- **Bumpers**: the front has two full-width bars with two clamps (`clampF`). The rear has split bumperettes, two bars
  each side with clamps (`clampR`). The draft had one continuous rear bar.
- **Tail lamp**: one lamp only, on the left, with a stalk. The draft had a pair.
- **Spare**: a tall rounded tread band from the side, a large wheel from behind (r 436, at the sheet's height), and a
  narrow band in plan.
- **Hood**: 12 louvres where the sheet has them. The hood narrows from the cowl (x 566 px) to the shell (x 205 px) in
  plan. The cowl follows the sheet's seam at x 605 px.
- **Body**: seams at the door shuts (755, 1082, 1380 px). The rear door's shut follows the wing. The belt bead is
  added, and both door handles are at the centre pillar. The rear face has its two vertical panel lines.
- **Below the body**: the black splash apron. From in front it runs down diagonally from beside the lamp to the foot
  of the shell, and the frame horns show under the bumper. The board (rubber, ribs) gets a chrome edge strip, and the
  two step plates are placed separately in side and plan, because the two views disagree by about 120 mm.
- **Colours** sampled from the sheet: paint #3e1c21 (maroon), paint2 #252424 (black wings), canvas #2c2c2d, roof
  colour #1d1d1e, chrome #a2968a (nickel), glass #9da7b1.
- **Wheels**: artillery, 12 spokes, rim 0.71 (measured), painted rim, nickel trim ring, small cap (0.16).
- Name "1926 large sedan", id `hudson26`.

## Parts added / removed (draft 78 parts, direct 79)
- Added: `visor` (sun visor over the screen), `badge` and `badgeR` (the shell badge), `cowlLamp` (cowl lamps, a pair),
  `lampRim` (the nickel rims of the black lamp bowls), `boardEdge` (the board's chrome edge), `clampF` (replaces
  `clampF0`/`clampF1`: one clamp each side, as the sheet has), `clampR` (rear bumperette clamps), `tailStand`.
- Removed: `lampBar` (this car has no lamp tie-bar), `plateLamp`, `handleR` and `rearBar` (not on this car's rear),
  `pillar` (now part of the black greenhouse), `spareHub` (not seen from the side on this sheet), and
  `clampF0`/`clampF1` (replaced by `clampF`).
- All other parts keep the template's names, elements, materials and slots. The slots are grille, lamp, tail,
  bumperF/R, fenderF/R, board and spare.

## What is still wrong / not done
- **Wheels**: the game's artillery wheel fills between the spokes with a dark blue-grey disc. The sheet has black
  there and thicker maroon spokes. The model has no setting for this; only the renderer could change it.
- **Front wings face on**: the shape is right, but they read as flat dark blobs, because the renderer does not give
  them the sheet's dome highlights.
- **Screen divider** (`screenBar`): it sits right of the centre line, as the sheet draws it, so that one outline is not
  symmetric. The two side windows seen in the front view (between the pillars) are not modelled; the black greenhouse
  covers them.
- **The views disagree** by 50-150 mm in places, and each view keeps its own. The step plates and board ends differ by
  about 120 mm between side and plan. The spare's centre height differs by about 80 mm between side and rear. The
  bumper height differs by about 100 mm between side and front. The script's build log lists them all
  (`work/build.log`).
- **Plan view**: the roof and body end about 20 mm (one sheet pixel) behind the sheet. The black splash ahead of the
  cowl is the black material's blue-black, not the sheet's grey-black. The lamp bowls almost disappear against it.
- **Mirror direction**: the plan and rear views follow the template's mirroring convention, which I did not check
  against the sheet's handedness. This only matters for the one-sided tail lamp and the screen bar.
- **Chassis layer**: carried over from the template by scaling, not traced from this car's under view. That would be
  the next job.

With more time I would trace the under view for the chassis layer, refine the face-on wing and lamp-bracket shapes,
and give the hood its side panels in the front view (the maroon vertical panels beside the shell).

## Time and iterations
About 1.5 hours: about 40 minutes reading the guide, template and sheet and gridding the views; about 30 minutes for
the first full script; then 8 build-and-look rounds. The rounds fixed paired outlines that had been mirrored by
mistake (front wings, rear wings, cowl lamps), the plan-view wings, steps, roof length and lamps, the gaps in the
front valance, the tail lamp hidden behind the body, the louvres, the spare's side shape, the grille core pattern and
the rear door shut. The last round added modelshade.
