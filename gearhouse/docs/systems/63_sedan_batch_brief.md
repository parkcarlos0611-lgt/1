# 63. The sedan batch — brief for each car's agent

Decision (2026-11-21): the sheet cars are made by hand by Fable agents (the planner judged the Fable trial's detail far
ahead of Opus and of the automatic converter). This brief adds what the trial taught to the common guide,
docs/systems/62_direct_model_guide.md, which still holds (goal, tools, hand-in, rules). Read both.

## What the trial taught (follow it)
- Write the car's script from scratch in the structure of tools/ref/sedan29_model.py (its `part()`, `snap()`, `half()`
  helpers, box rules, part names). Do not edit the draft by hand; use it only for landmarks and the chassis layer.
- Take the chassis layer (parts with `layer: 'chassis'`) from the draft, moved onto this car's wheel centres by the
  script. Do not trace the under view unless time is left at the end.
- Read outlines off gridded crops of each view (4x or 8x with a labelled grid every 10 source pixels). Flood fills and
  colour classes do not separate black wings from black tyres; read such outlines point by point.
- Build the car as it really is. Patterns seen in the trial:
  - many sedans of 1925–29 have the black top coming down the sides over the window band and the rear quarter: make
    it one part above the belt (the Fable Hudson's `bodyTop`, the Opus Studebaker's `upper`), lying on the body;
  - visor, cowl lamps, drum lamps on stands, split bumperettes, a single tail lamp, corner lights, two-pane screens,
    wood window surrounds, a full-length board edge strip: add what the sheet shows, remove what it does not;
  - wheels: wire, artillery (spoke count, painted or wood) or disc, as the sheet shows.
- Check the scale. The wheelbase given is approximate. If the result is implausible (a sedan of these years is about
  1.70–1.95 m high and 3.4–5.2 m long; the draft's report gives what it measured), find the true wheels on the side
  view (the spare tyre at the back can be mistaken for one) and say in the report what you used.
- Run tools/ref/modelshade.py last, so the model carries the sheet's light as sedan29.json does. Keep a run.sh that
  rebuilds everything.
- The sheet's views disagree with each other in places (50–190 mm); keep each view's own place and size, as the
  template does, and list the disagreements in the report.
- Do not try to change the game's renderer (the artillery spokes draw thinner and darker than the sheets; that is
  known and will be fixed in the game).

## Notes for the know-how (from the fifth car on)
The aim is that later cars (and, if it works, a cheaper model with Fable's checklist and review) can come near this
quality. Add a file `notes.md` in the folder with:
- **Reusable parts**: each part of your script that another car could use as it is or with a few numbers changed
  (visor, drum lamp on a stand, split bumperettes, black upper body, cowl lamp, corner light, two-pane screen, wood
  window surround, board edge strip, artillery wheel spec, ...). For each: the function or block in your script, what
  it takes (sizes, positions), and what of it was particular to this car.
- **Details caught**: the list of details of this car you found on the sheet and built, in the form of a checklist
  another builder could tick off (part, count, shape, colour, which views show it). Mark those the draft had wrong.
- **Pitfalls**: what took you longest or went wrong first, and how you got past it.

## Each car
- Folder: /tmp/claude-0/-home-user-1/0b845933-8226-57c8-b442-07d308e42630/scratchpad/batch/<id>/ (the six cut views
  v_*.png, and draft/ with the automatic model <id>_auto.json, its report and mv_auto/).
- The list with sheet, side, approximate wheelbase, year and the plain game name: tools/ref/batch_sedans.json.
- Hand in, in the folder: <id>.py, <id>.json, run.sh, cmp.png + cmp.json (autocmp with draft= and direct=),
  parts.png, report.md (what was built, parts added/removed, scores, what is still wrong, how long, how many rounds),
  and from the fifth car on notes.md (above).
- Write only in the folder; change nothing in the repository; do not commit.
