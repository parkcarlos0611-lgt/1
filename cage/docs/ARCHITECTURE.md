# Cage Legends — 2D Engine Architecture (v11)

Single-page HTML5 Canvas game. The original engine lives inline in `index.html`
(sections `m_body`, `m_moves`, `m_fighter`, `m_stage`, `m_input`, `m_ai`, `m_match`,
`c_world`, `c_career`, `c_ui`). The v11 overhaul adds **modules in `src/`** that are
loaded *after* the inline engine and extend or replace its classes in place
(prototype patching), so the existing game keeps working while each system is upgraded
independently.

```
index.html  (inline core: Body, F2, MV, Stage, In2, AI2, Match, World, Career, UI)
  └─ src/Tuning.js              TUNING — every balance/physics number, JSON-overridable
  └─ src/FootPlant.js           foot-planting IK after Body.solve (support feet flat on the mat)
  └─ src/Arena.js               real cage sizes (30 ft / 25 ft / 20 ft ring) + responsive camera
  └─ src/Ragdoll2D.js           Ragdoll2D — PBD ragdoll; replaces Body.startRag/stepRag
  └─ src/JudgeRefereeSystem.js  StunModel, RefereeAI, doctor, ScoringEngine (3 judges)
  └─ src/CombatEngine.js        InputBuffer, playback speed, cancel windows, weave/sway/parry, sim-time game clock
  └─ src/CombatPacingEngine.js  spacing / tempo / mind games: stamina penalty, whiff windows, sweet spot,
                                quick step, feints, jab setups, reactive takedown & clinch, AI in-out rhythm
  └─ src/ImpactFeedbackManager.js  tiered hitstop (1–5 f), micro shake / zoom, shock rings, sweat & blood bursts
  └─ src/GraphicsRenderer.js    per-fighter lighting layer (normal shading, key light, rim light), bruises,
                                swelling, blood streaks, sweat sheen; octagon spotlight, texture, haze, vignette
  └─ src/UIManager.js           touch step/feint/weave/sway cluster, GASSED HUD, combat labels, help tables
  └─ src/ArenaRenderer.js      arena backdrop (red ambient, LED screens, truss + beams, crowd tiers), padded cage, sprite-cached mat
  └─ src/RefereeModel.js       new referee figure (generic looks, state poses)
  └─ src/GPURenderer.js        WebGL compositor (DoF, bloom, rim, grade, vignette) + dynamic resolution
  └─ src/MotionPhysics.js      joint spring physics, bouncy footwork, no shadows, stamina drain ×0.6
  └─ src/MotionRealism.js      game pace, limb shading in draw order, strike variety, blend-in, idle life
  └─ src/DebugLayer.js          F9 overlay: hitboxes, ragdoll joints, buffer, ref path, conc gauge
  └─ src/CareerManager.js       InjuryModel, Matchmaker, coaching staff, scheduler / fight-card tab
  tools/careerbench.js          multi-year career bench (injuries, weeks lost, fights, rematches)
  tools/simbench.js             fast-forward balance bench (virtual clock, real engine, N fights)
```

Physics: the brief allows "Matter.js or equivalent". The fighters are already a
joint/bone skeleton driven by the pose solver, so v11 uses its own **position-based
(Verlet) rigid-joint solver**. It works directly on that skeleton, has no dependency or
download cost, and gives the controls Matter.js would: solver iterations, angular
damping, joint limits, friction, restitution, sleeping and CCD.

## Core classes and data flow

```
            ┌──────────── In2 (keyboard / pad / touch) ────────────┐
            │ raw events                                            │
            ▼                                                       │
     InputBuffer (CombatEngine)  ──timestamped cmds──►  Match.playerInput
            │ consume when fighter can act / cancel window open       │
            ▼                                                       ▼
   F2 (fighter state machine)                                  AI2 (CPU)
     act = {key, c:MV[key], t, speed, phase}                       │
     speed = base × PlaybackSpeed(phase, outcome)  ◄───────────────┘
            │ hit window t0..t1
            ▼
   Match.checkHit ── capsule strikeBox (swept) vs hurtBoxes ──► onHit / onMiss
            │                                   │
            │                                   ├─► CombatEngine.onImpact → hit-drag / whiff / recoil speed
            │                                   ├─► applyDmg → stun/chin → knock()
            ▼                                   ▼
   Body.solve (kinematic pose)          knock(): Body.startRag(impulse vector, hit joint)
            │                                   │
            └─────────────► Ragdoll2D ◄──────────┘
                             blend kinematic→physical, CCD floor/cage, joint limits, sleep
                                   │
                                   ▼
                     Stage.render (camera, arena)  +  DebugLayer.draw
```

### Module responsibilities

| Module | Class / object | Responsibility |
|---|---|---|
| Tuning.js | `TUNING`, `tune(path)` | One tree of parameters (physics, combat, judging, injury). Overrides come from `localStorage.cl_tuning` (JSON) or the `?tune=` URL param, deep-merged at load time. |
| Ragdoll2D.js | `Ragdoll2D` | Particles = skeleton joints; constraints = bones (rigid), shape (soft), angle limits (knee/elbow/neck/hip). Partial kinematic blend that decays over time; impulse spread from the hit joint along the strike vector; sub-stepped CCD against canvas floor and cage walls; angular-velocity damping; friction, restitution and sleep. |
| CombatEngine.js | `InputBuffer`, `CombatEngine` | Combo pre-input buffer with a time window; per-phase playback speed (startup / active / recovery × hit / miss / block); startup cancel into guard, movement or head movement; player weave/sway; parry (block pressed just before impact). |
| DebugLayer.js | `DebugLayer` | F9 / `?debug=1`. Hurt/strike capsules with active-frame state, ragdoll particles, bones, limits and contacts, input-buffer timeline, action phase bar, ref target and path. |

### Action phases (frame model)

Each move in `MV` has `hit.t0` (first active frame), `hit.t1` (last active frame) and
`dur`. CombatEngine derives the phases:

```
t: 0 ───── startup ───── t0 ── active ── t1 ───── recovery ───── dur
            │ cancel window = [0, t0 × cancelFrac]  → guard / step / weave / sway
                                         │ on hit: hit-drag (speed × hitDrag for hitDragT)
                                         │ on block: recoil (speed × blockRecoil)
                                         │ on miss: over-extension (speed × whiffRecovery)
                                 buffer window: last `bufferMs` of recovery
```

### Ragdoll state machine

```
KINEMATIC ──knock(ko, impulse)──► BLEND (drive w = w0·e^(−t/τ))
                                   ├─ w < 0.02 → PHYSICAL
PHYSICAL ── all |v| < sleepV for sleepT ──► ASLEEP (frozen, no jitter)
any ── getup / ground / ceremony ──► KINEMATIC (body.rag = null)
```

## Phase 2 — JudgeRefereeSystem

**Load order matters:** JudgeRefereeSystem replaces `Match.applyDmg`, and CombatEngine then wraps it,
so JudgeRefereeSystem.js must load first.

### StunModel (replaces the old random KO rolls)
```
impact = dmg × 1.6 (counter) × 1.35 (clean on the chin) × 0.5 (ground strike)
combo  = 1 + 0.2 × (head shots in the last 1.3 s)      (cap 1.9)
conc  += impact × combo × (1.25 − chin × 0.5)           decays 5.5/s after 1.2 s quiet, never below
                                                          the permanent share (22 % of all conc taken)
T      = 15 + chin × 17   (× 0.82 when stamina < 25)
conc/T ≥ 0.62 rocked · ≥ 1.0 knockdown (KO chance from overshoot, shot impact, 2nd KD in round) · ≥ 1.6 KO
flash KO: clean/counter shot with impact ≥ 7, chance = (impact − (10 + 7·chin − 3·conc/T)) / 6, cap 0.5
```
### RefereeAI
- Positioning: stays 1.15–1.9 units from the pair on the side with more room, never between
  them or in striking range, 0.95 units off the action on the ground, centre at the bell (and walks
  the fighters back to their corners).
- Stoppage: `danger` grows with unanswered damage on a rocked, downed or badly hurt bottom fighter
  (×0.3 while he defends intelligently: strikes back, guard up, escaping, attacking a sub) and drains at
  4.5/s; over `stopAt × heart × (1.5 on the ground)` the ref rushes in (0.5 s), waves it off → TKO.
- Doctor: cut check at the bleed limit stops with p = 0.3 + 0.28 × cut severity (otherwise "continue");
  a fully swollen eye between rounds stops with p = 0.45.

### ScoringEngine (10-point must, three judges)
Per round: impact-weighted damage, significant strikes, knockdowns, takedowns, control time,
near-submissions, sub attempts, aggression (walking the opponent down) and octagon control
(centre while the opponent is near the fence). Judges differ (striking-leaning / balanced /
grappling-leaning) and add noise. Impact decides; aggression then cage control only when the round
is within 7 %. 10-8 = margin > 62 % with real volume, two knockdowns, or a knockdown plus a 35 % margin;
10-7 = three knockdowns or 85 % with two. Decision type (unanimous / split / majority / draw)
comes from the totals; the result screen shows every judge's card for every round.

### Balance (simbench, AI vs AI, 3 × 5 min, UFC level)
| | KO/TKO | SUB | DEC | KD / fight | 10-8 rounds |
|---|---|---|---|---|---|
| before (LW / HW) | 18 % / 27 % (KO 0 % / 5 %) | 10 % / 12 % | 72 % / 60 % | 0.00 / 0.10 | – |
| after, 80 fights (LW / HW) | 31 % / 41 % | 17 % / 18 % | 51 % / 40 % | 0.20 / 0.41 | 2.3 % |
| real UFC (approx.) | ~30 % / ~45 % | ~18 % | ~50 % / ~40 % | | ~3 % |

Run it yourself: `node tools/simbench.js index.html 80 LW 3` (add `?tune={...}` to the file to test values).

## Feet and arena
- FootPlant: a leg whose lowest point is within 0.075 H of the mat is planted (blend to free at
  0.14 H, so kicks and knees are untouched). The toe keeps its x, the sole lies flat (rear heel raised
  3 % H), the body sinks up to 6 % H if a planted leg can't reach, and 2-bone IK re-solves the knee.
  Before: idle stance had both fighters on tiptoe with the rear foot 4–29 cm off the mat. After: toes
  0 cm, lead heel 0.7 cm, rear heel 5 cm.
- Arena: 1 world unit = 1/0.9 m (fighters are drawn at 0.9 × real height). UFC Octagon 30 ft → R 4.11,
  25 ft cage (smaller promotions) → R 3.43, 20 ft ring → R 2.74 (was a fixed 3.15). Camera framing is
  wider (fighter ≈ 34 % of screen height at 16:9, was 40 %) and narrow screens are framed by height.

## Phase 3 — CareerManager

### InjuryModel (one model instead of three separate rolls)
`weekly risk = base 0.008 × fatigue curve × plan load × age (+7 %/yr after 31) × conditioning
(cardio + recovery + strength) × (1 − 0.12 × S&C coach level)`; fatigue curve 0→0.06, 55→0.35,
65→0.9, 75→1.9, 90→3.6, 100→5. Severity tiers: minor 1–2 wk (62 %), moderate 3–5 wk (30 %),
serious 6–10 wk (8 %), shifting toward serious with fatigue. A minor knock that heals before fight
week no longer cancels the fight. Hard camp risk 3 + 0.32 × fatigue % (cap 35, was 8 + 0.5 × fatigue,
cap 55). Fight injuries scale with damage taken (from 125) plus a KO-loss bonus.

### Matchmaker
Score per available opponent: rank distance to a target (one or two spots up when on a run, down
after a loss), ELO and OVR closeness, form (winners meet winners), style clash (striker vs grappler),
rivalry, star power, minus a penalty per previous meeting (larger for the last 3). Pick = best score +
small noise. The reasons travel with the offer ("🧭 랭킹 #11 (나 #14) · 연승자끼리") and the booked fight.
Event cards pair NPCs the same way (close ranks, close ELO/OVR, style clash).

### Coaching staff
| Role | Effect per level (1–3) | Weekly salary (2005 $) |
|---|---|---|
| 타격 코치 / 그래플링 코치 | training quality +14 % in that area | 350 / 900 / 2,200 |
| S&C 코치 | conditioning quality +14 %, injury risk −12 % | 300 / 800 / 1,900 |
| 영양사 | weight cut +0.012/wk, fatigue −0.8/wk | 200 / 550 / 1,300 |
| 컷맨 | skin +1.2 in fights | 100 / 300 / 800 |

### Scheduler tab (📅 스케줄)
10 week cards: training plan per week (applied automatically when that week is played), fight / camp
countdown / injury / contract markers, projected fatigue and injury risk. "자동 주기화" builds a
plan from the fight date: camp in the camp focus, taper the last 3 weeks, rest around the fight, and a rest
week whenever projected fatigue passes 62. Below: coaching staff cards, the matchmaking shortlist
(OVR, ELO, style, reasons; "요청" asks the promotion for that fight), and the upcoming event's fight card.

### Career bench (10 careers × 5 years per scenario)
| Scenario | Injuries / yr old → new | Weeks lost / yr | Fight cancellations / yr | Fights / yr |
|---|---|---|---|---|
| Train every week, never rest | 2.97 → 1.72 | 14.6 → 6.7 | 1.1 → 0.46 | 2.2 → 3.0 |
| Sparring-heavy | 3.83 → 2.28 | 18.6 → 9.1 | 1.6 → 0.7 | 1.8 → 2.7 |
| Hard camp every fight | 3.90 → 2.72 | 13.0 → 5.8 | 0.8 → 0.3 | 2.5 → 3.0 |
| Auto-periodised schedule | 0.13 → 0.14 | 0.7 → 0.4 | 0 → 0 | 3.3 → 3.3 |
Rematches over 50 career-years: 23–29 → 7–15. Run: `node tools/careerbench.js index.html [old]`.

## Phase 4 — Spacing, tempo, mind games + impact feel + graphics/UI

### Anti-slugfest rules (CombatPacingEngine)
| Rule | Mechanism |
|---|---|
| Stamina penalty | > 4 throws inside 2 s → each extra throw costs +45 % × n stamina. Stamina < 28 = **GASSED**: deals ×0.8, takes ×1.2 (also feeds concussion → more KDs / flash KOs), strikes ×0.86 speed, guard refills ×0.55. |
| Whiff punishment | a miss opens a window of 0.16 + 0.3 × strike weight s (jab ≈ 0.22 s, overhand ≈ 0.46 s) and slows its recovery ×0.85. Anything landing in it is a **counter** (×1.25, counts as counter for concussion). The AI punishes heavy whiffs. |
| Sweet spot | at contact, distance ÷ (strike REACH × body size): 0.86–1.06 = sweet spot ×1.18, < 0.66 = jammed ×0.75, > 1.12 = over-reaching ×0.85. Hooks, uppercuts, knees and elbows are close tools (exempt). |
| Quick step | Shift+A/D, double-tap, touch ⇄. Forward 2.5 / back 3.0 units·s⁻¹ burst for 0.17 s, 3.5 stamina, 0.42 s cooldown; cancels strike startup. |
| Feint | B / touch 🎭. Plays the start of a cross / hook / overhand / body kick and stops at 62 % of startup. An opponent who reacts (guard, head movement, counter swing) is **bitten**: open as if he had whiffed for 0.5 s. |
| Jab tempo | a jab / body jab / teep that lands or is blocked makes the next power shot within 1.3 s ×1.12. |
| Reactive grappling | shooting on an opponent who is mid-strike, just whiffed or bursting forward: no sprawl, TD defence −5. Clinching him: clinch control −5. |
| AI pacing | waits just outside the opponent's reach and only closes to attack range when about to strike (in-out rhythm), steps out of heavy shots to make them whiff, steps in to attack, feints, leads with the jab, holds fire when spamming or gassed. |

### Impact feel (ImpactFeedbackManager)
Tiers replace the engine's freeze of up to 0.26 s (≈ 15 frames) and shake of up to 0.3 units:
blocked 1 f · light 2 f · medium 3 f · heavy 4 f · crit (counter / whiff punish / sweet-spot heavy) 5 f +
shock ring and sparks. Shake 0.010–0.065, zoom 0.01–0.06. Head and torso reaction springs are scaled per tier
(×0.5–1.15); knockback distance is not (it is gameplay).

**Game clock:** `Match.t2()` now runs on simulation time. It used to be wall time, so every window
(combo, concussion decay, whiff, spam, setup, cooldowns) kept running during hitstop. Shortening the freeze
changed balance (KO/TKO 36 % → 15 % in A/B tests); now presentation can't change balance.

### Graphics / UI
- Each fighter is drawn into an offscreen layer (bounding box only). Shading is painted with
  `source-atop`, so it stays on the fighter's pixels: a cylinder gradient on every segment (procedural
  normal shading), a warm-top / cool-bottom key light, bruises (face / ribs / lead leg) scaled by zone damage,
  swelling, blood streaking from cuts, and sweat glints that grow with fight time and fatigue. The rim
  light (silhouette minus a shifted silhouette, half resolution) is added with `lighter`.
- Octagon: canvas texture on the mat, spotlight pool, drifting haze in the light, vignette.
- Cost (CPU-only headless 1280×720, worst case): low 6 ms/frame, high 20 ms/frame. `gfx.quality:'auto'`
  turns the layer passes off when frames run slow.
- Touch: ⇄ step (direction from the stick, neutral = backstep), 🎭 feint, ⤵ weave, ↶ sway beside the
  action pad; no overlap with the pad at 844×390 or 1180×820. Fires on touchstart.
- HUD: stamina bar turns red with GASSED, amber over the spam limit; floating COUNTER / WHIFF PUNISH /
  SWEET SPOT / JAMMED / PARRY / BIT ON FEINT labels for the player's exchanges.

### Results (simbench, AI vs AI, 3 × 5 min)
| | before (LW / HW) | after (LW / HW) |
|---|---|---|
| strikes thrown / min / fighter | 17.4 / 12.2 | 7–11 / 5–7 |
| time in the pocket (< 0.95 apart) | 52 % / 47 % | 33 % / 30–32 % |
| average distance | 1.25 / 1.26 | 1.9–2.1 |
| KO/TKO · SUB · DEC (LW, 80 fights) | 25 · 20 · 55 % | 30 · 16 · 53 % |
| knockdowns / fight (LW) | 0.07 | 0.24 |
| whiff punishes · feints · reactive TDs / fight | 0 · 0 · 0 | ~1 · 2–3 · ~1 |

## Phase 5 — GPU compositing, 60 fps, broadcast camera, arena and referee

### Render pipeline
```
Canvas 2D (draw calls)                         WebGL (one full-screen pass, ~8 texture reads / pixel)
  far  : arena + crowd   (0.35 × res)  ──┐     far: bilinear upscale + 4 taps   → depth of field
  bloom: far ↓ 1/16                    ──┤     bloom: bright-pass of 1 tap      → glow of lights / screens
  near : cage, mat, referee            ──┼──►  near over far
  fig  : fighters, particles, labels   ──┘     fighters over that + rim light from alpha edges (3 taps)
                                                colour grade, vignette, damage tint, impact flash
```
- No more CPU per-pixel work: the 2D rim passes and `ctx.filter` (hit flash) are gone. The hit flash is a
  `source-atop` wash and flash/vignette are shader uniforms.
- **No quality cut-offs**: `gfx.quality` stays 'high'. **Dynamic resolution** holds 60 fps instead: render scale
  0.5–1 × DPR (cap 2), down 0.1 when frames average > 16.9 ms, up 0.05 when < 14.5 ms (1.2 s hold).
  Large high-DPR screens start at ≤ 2.2 Mpx.
- Canvas 2D fallback if WebGL is unavailable.
- Floor logos, sponsor boards, post pads and LED screen text are pre-rendered sprites (re-rendering text
  every frame was ~40 % of the frame).

Frame cost (headless, WebGL on SwiftShader, so the GPU stage also runs on the CPU), 1280×720:
| | median ms |
|---|---|
| before (2D high) | 9.2 (p90 19.1) |
| GPU path, before sprite caching | 8.3 |
| GPU path, final | 2.7–4.7 (mat 3.3 → 0.06, composite ≈ 0.5–0.9) |

### Camera
Broadcast framing like a TV feed: fighter ≈ 45–50 % of screen height (was 34 %), camera floor line 0.88.
Narrow screens frame by height.

### Arena
Dark arena with red ambient wash, lighting truss with fixtures and soft beams, a row of blue LED screens,
upper crowd tier and the lower crowd behind the cage (both defocused), padded posts and top rail, fine
chain-link, black fence skirt with sponsor boards. Branding is generic (promotion short name, parody
sponsors).

### Referee
New front-view official: black polo (collar, buttons, sleeve hems, chest patch), slacks with belt and
crease, polished shoes, blue gloves; generic look picked per fight (6 skin / hair presets). Poses blend
between watch, ground (crouched), break (arms out), wave-off and raise, driven by RefereeAI's `r.mode`.

## Phase 6 — Joint physics, lighter movement, controls, referees

- **Joint physics** (MotionPhysics): every pose channel has an underdamped spring-damper offset added
  before the skeleton is solved (so hitboxes follow). Hits push impulses by strike and zone:
  straight → head snaps back (−0.40 rad peak ~8 frames, overshoot +0.11, settled ~0.7 s);
  hook / head kick → head and torso whip sideways, and for a head kick the legs scissor and stumble;
  uppercut → head up and back; body → folds; leg kick → kicked leg buckles. The kicking leg recoils on
  contact (knee folds). Accelerating / stopping makes torso and arms lag. The engine's own reaction
  springs are scaled down so the two don't double up.
- **Movement**: speed ×1.22, light bounce on the balls of the feet (≈2.3 Hz standing, 3.3 Hz moving,
  damped while striking); feet stay planted through FootPlant.
- **Shadows removed**: floor shadows (fighters, referee), the dark side of the lighting layer, CSS
  text / box shadows and the drop-shadow filter in the match HUD.
- **Stamina**: every decrease of stamina and max stamina is ×0.6 (`motion.staminaDrain`). In AI-vs-AI
  benches nobody reaches GASSED any more; finish rates LW 28·18·54 %, HW 38·12·50 %.
- **Touch**: only ⤵ 위브 and ⇄ 스텝 remain, larger (96×68). Above the action pad on tablets/desktop;
  on short phone screens they stack in the free space above the jab button so they don't cover the HUD
  (no overlap with pad or HUD at 740×360, 844×390, 1024×600, 1180×820).
- **Referees**: stylised likenesses of two well-known referees, picked per fight — Herb Dean style (tall,
  dark skin, bald, full beard) and Marc Goddard style (stocky, light skin, shaved head, stubble, heavy
  brows); black polo, slacks, blue gloves.

## Phase 7 — Pace, legs, depth order, motion variety

- **Pace**: GAME_SPEED 0.8 → 0.72; walking speed multiplier 1.22 → 0.55 (the hips moved 5 units/s,
  about 3 body heights per second; now ≈ 3 units/s); the second bounce layer is off.
- **Legs (FootPlant stepping)**: a planted foot never slides (measured 0.000 while walking). When the
  body moves the foot steps along an arc (heel peels first, ≤ 12 cm lift, 0.09–0.2 s), aiming ahead by
  velocity × step time; the lead foot leads going forward, the rear foot going back; the next foot may
  start once the first is 55 % through. Both legs count as support unless that leg is kicking. During
  kicks the support foot is the pivot and stays put. The engine's walk cycle no longer swings hip / ankle
  angles (that lifted feet and fought the IK).
- **See-through fix**: the lighting layer stroked shading over every limb after the fighter was drawn, so
  far-limb outlines showed on top of near limbs. Shading is now applied inside `limbM` per segment,
  clipped to that segment and drawn in depth order; sweat glints only on near-side limbs.
- **Strike variety**: every strike gets its own lean, chest, chin, shoulder twist, level change, arm
  extension, kick height, guard-hand position and ±7 % speed, shaped by an envelope over the move.
- **Blend-in**: a move starts from the pose the fighter is actually in and blends into the clip over 70 ms.
- **Idle life**: hands paw, head bobs, shoulders roll in stance.
- Balance after the changes (50 fights): LW 24 · 22 · 54 %, HW 42 · 14 · 44 %; time in the pocket 28–29 %.

## Delivery phases
1. ✅ Architecture + hitboxes + 2D ragdoll + combat feel + debug layer
2. ✅ FootPlant, real arena scale, JudgeRefereeSystem (stun gauge, flash KO / TKO / doctor,
   3-judge 10-point must with octagon control, referee positioning and stoppage AI)
3. ✅ CareerManager: matchmaking (rank, form, style), injury model tied to conditioning
   and rest, scheduler/card UI, arena scale (Standard 30 ft / Apex 25 ft) and responsive camera

## Tuning (JSON, no code edits)

All numbers are in `src/Tuning.js` → `TUNING`. Overrides are deep-merged at load time:

```js
// browser console, persists for this browser
localStorage.setItem('cl_tuning', JSON.stringify({
  ragdoll: { iterations: 16, friction: .7, blendKO: { w0: .5, tau: .1 } },
  combat:  { bufferMs: 220, parryWindow: .12 }
}))
// or one-off via URL
index.html?tune={"combat":{"cancelFrac":0.7}}&debug=1
```

| Key | Default | Effect |
|---|---|---|
| `ragdoll.iterations` | 12 | Solver passes per substep. Higher = stiffer bones, more CPU. |
| `ragdoll.maxSubsteps` | 4 | CCD substep cap. Substeps = displacement ÷ (½ smallest joint radius). |
| `ragdoll.angularDamping` | .18 | Share of each bone's relative spin removed per 1/60 s. Higher = less flailing. |
| `ragdoll.friction` / `restitution` / `contactDamping` | .62 / .08 / .12 | Mat/cage contact feel. Low restitution = no bouncing or jitter. |
| `ragdoll.blendKO` / `blendKD` | {.55,.11} / {.6,.18} | Kinematic drive at the moment of a KO / knockdown and its decay. τ grows with bone distance from the struck joint (partial ragdoll). |
| `ragdoll.impulseKO` / `impulseKD` / `impulseFalloff` | 3.2 / 1.6 / .55 | Strike impulse at the struck joint and how much passes along each bone. |
| `ragdoll.limitStiffness` | .4 | Share of a joint-limit violation corrected per pass. |
| `ragdoll.sleepSpeed` / `sleepTime` | .08 / .35 | Settling threshold; once asleep the body is frozen (no jitter). |
| `combat.bufferMs` / `bufferMax` | 180 / 3 | Pre-input window (game time) and queue length. |
| `combat.cancelFrac` | .55 | Startup share in which guard / backstep / weave / sway cancels the strike. |
| `combat.hitDrag` / `hitDragT` | .45 / .06 | Attacker slow-down on contact (impact weight). |
| `combat.blockRecoil` / `whiffRecovery` / `recoverySpeed` / `startupSpeed` | 1.25 / .78 / .95 / 1.08 | Playback multipliers per phase and outcome. |
| `combat.parryWindow` / `parryStun` | .14 / .38 | Guard pressed this long before contact = parry; attacker flinch. |

### Verified behaviour (headless test harness)
- Ragdoll, fixed dt 1/60, 6 cases (head/body/leg × KO/knockdown × both directions):
  0.00 cm floor penetration, joint-limit error ≤ 0.1 rad, no energy spikes, all come to rest
  (KO 2.0–2.5 s, knockdown 3–4.5 s).
- Combat: buffered jab fires after a flinch; guard cancels a cross in startup; held guard →
  `block` (recovery ×1.25); guard pressed 0.08–0.12 s before contact → `parried` (attacker
  flinch 0.22–0.26 s); hit → drag ×0.45 then recovery ×0.95.
