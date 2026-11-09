# Adding a fighter face (every new photo goes through this)

    python3 tools/add_fighter.py "<exact in-game name>" <key> <full-body.png> [#skin]

One command does all of it:
1. `auto_geom.py` finds head top / back / nose / chin from the silhouette (flat backdrop, facing right) with the proportions of the hand-tuned fighters.
2. `build_head2.py` cuts the head and the neck piece (bending neck), removes loose fragments, and writes `head2.json` with the blink eye position,
   hit-mouth position, eyelid colour (sampled from the face), and the brow / cheek / nose points used by the bruises and blood.
3. The fighter is added to `CURATED` in `src/Cutout.js` (head size 0.138 of the body height, same head height for everyone).
4. `node tools/face_check.js <url> <out.png> "<name>"` renders normal / blink / damaged / hit-reaction for the face.

Hand-tuning, only when the check sheet shows a problem: add a `CFG` entry in `build_head2.py` (copy `aldo`) — `taper` / `ntaper` round the nape,
`clipX` cuts a glove or fist from the head, `neckEnd` stops the neck piece above a tattoo, `padL` keeps a ponytail.
Always run the 70 s soak and the 504-case cancel test afterwards.
