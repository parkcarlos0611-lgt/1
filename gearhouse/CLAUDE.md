# GEARHOUSE: notes for agents

A 1990s car builder and racing game: TypeScript + WebGL2, built with esbuild/vite. Write user-facing notes and docs in Korean; code comments stay in English.

## Read first (and usually only these)
- `docs/00_NORTH_STAR.md`: direction and work principles.
- `docs/STATUS.md`: where things stand.
- `docs/decisions.md`: recent decisions. Older ones live in `docs/archive/`.
- The one plan in `docs/systems/` that your task names (the 100-series are current).

## Skip unless a task names them
- `legacy/`: the 1930s 2D game.
- `docs/archive/`: old plans and decisions.
- `dist/`: build output.
- `docs/reference/`: pictures. Open only the ones your task names; they are large.
- `cage/` at the repository root: a different project.

## Work rules
- Verification is minimal. Run tsc and the tests for the files you touch. No full-suite runs, no long regressions, no repeated renders. Headless browsers on software GPU are very slow, so make one or two pictures at most.
- Modelling and visual quality checks are NOT reduced. Judge your pictures against the references honestly (blueprint overlay, surfacecheck, photo comparison where relevant).
- Triangle budgets are targets with a separate ceiling (see `docs/decisions.md`). Do not cut shape to hit a number.
- No model names or IDs in code, comments or docs.
- Other agents work in the tree at the same time. Commit only your own files (`git add <paths>`, never `-A`), and pull with `git pull --no-rebase` before pushing.
- Branch: `claude/car-tycoon-game-design-czkj9t`. No pull requests.
- Commit messages end with exactly:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01BMyqTudGWpuTphuwn8oTvi
  ```

## Useful commands
- Build the game page: `node tools/ref/buildsite.mjs ui/shell/main.ts ui/shell/game.page.html <outdir> game.html`
- Type check: `npx tsc --noEmit -p .`
- One test file: `npx vitest run tests/<name>.test.ts`
