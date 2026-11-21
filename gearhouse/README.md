# GEARHOUSE

A 2D pixel-art simulation of a car company and its founder's family, from 1 January 1930 onwards.
It combines tycoon, management, life game, car design and sandbox play.

- Plan: `docs/REBOOT_PLAN.md` (based on the planner's design prompt)
- Decisions: `docs/decisions.md` · deferred work: `docs/backlog.md`
- First test build (vanilla JS, kept whole for reference): `legacy/`

## Layout

```
core/      simulation, no screen code: calendar and tick, event bus, people, company, economy, media
physics/   performance calculation + real-time driving
render/    PixiJS scenes and cameras, pixel generators
ui/        period-object UI components, window manager, input
data/      JSON data + schemas
assets/    game-ready art and sound
tools/     image processing, fonts, data checks
tests/     physics, formulas, long-run and UI checks
docs/      decisions, backlog, music licences, asset sources
legacy/    first test build
```

## Commands

`npm install`, then:

- `npm run dev`: development server
- `npm test`: unit tests
- `npm run typecheck`
- `npm run build`
