# Cage Legends — 2D Engine Architecture (v11)

Single-page HTML5 Canvas game. The original engine lives inline in `index.html`
(sections `m_body`, `m_moves`, `m_fighter`, `m_stage`, `m_input`, `m_ai`, `m_match`,
`c_world`, `c_career`, `c_ui`). The v11 overhaul adds **modules in `src/`** that are
loaded *after* the inline engine and extend or replace its classes in place
(prototype patching), so the existing game keeps working while each system is upgraded
independently.

```
index.html  (inline core: Body, F2, MV, Stage, In2, AI2, Match, World, Career, UI)
  └─ src/Tuning.js            TUNING — every balance/physics number, JSON-overridable
  └─ src/Ragdoll2D.js         Ragdoll2D — PBD ragdoll; replaces Body.startRag/stepRag
  └─ src/CombatEngine.js      InputBuffer, playback speed, cancel windows, weave/sway/parry
  └─ src/DebugLayer.js        F9 overlay: hitboxes, ragdoll joints, buffer, ref path
  └─ src/JudgeRefereeSystem.js   (phase 2) StunModel, ScoringEngine (3 judges), RefereeAI
  └─ src/CareerManager.js        (phase 3) Matchmaker, InjuryModel, scheduler UI
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

## Delivery phases
1. **Architecture + hitboxes + 2D ragdoll + combat feel + debug layer** (this update)
2. JudgeRefereeSystem: zone stun gauges, flash KO / TKO / doctor, 3-judge 10-point
   must with octagon control, referee positioning and stoppage AI
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
