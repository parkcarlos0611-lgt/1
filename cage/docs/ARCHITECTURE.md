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
  └─ src/CombatEngine.js        InputBuffer, playback speed, cancel windows, weave/sway/parry
  └─ src/DebugLayer.js          F9 overlay: hitboxes, ragdoll joints, buffer, ref path, conc gauge
  └─ src/CareerManager.js       (phase 3) Matchmaker, InjuryModel, scheduler UI
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

## Delivery phases
1. ✅ Architecture + hitboxes + 2D ragdoll + combat feel + debug layer
2. ✅ FootPlant, real arena scale, JudgeRefereeSystem (stun gauge, flash KO / TKO / doctor,
   3-judge 10-point must with octagon control, referee positioning and stoppage AI)
3. CareerManager: matchmaking (rank, form, style), injury model tied to conditioning
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
