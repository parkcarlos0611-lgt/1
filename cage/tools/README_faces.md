# Adding a fighter face (checklist — run every time a new face image is added)

1. Build the sprites: `python3 tools/build_head2.py <key> <full-body.png> assets/cutout/<key>` (full-body art) or
   `tools/build_head.py` (close-up of the head). The builder writes `head.png`, `neck.png` and `head2.json`, including
   `fx` (eye / brow / nose / cheek / lip positions, the hurt-mouth position and the eyelid colour sampled from the face),
   so **blinking, the hit reaction (closed eyes + open mouth), bruises and blood work automatically** for every new face.
2. Register the fighter in `CURATED` in `src/Cutout.js` (cutout key, skin, shorts, glove, `headK`, optional `headDown`, `variants`).
3. Rounding the corners behind the neck: `taper` / `ntaper` in the config (spur-free nape).
4. Check: `node tools/face_check.js http://localhost:8765/index.html out.png` renders every curated fighter in four states
   (normal, blink, damaged with cuts, hit reaction). Look for: lid patch colour, mouth position, blood inside the face,
   no spur behind the neck, no hand or glove in the head sprite.
5. Regression: the 70 s AI soak and the 504-case cancel test must stay clean.
