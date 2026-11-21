// Version one on its own page: a new game (or the saved one) and the places of the shop (ui/world/world.ts).
import { App, store } from './shell/app';
import { worldScene } from './world/world';
import { startGame } from './scenes/desk';
import { openWorld } from '../core/world';
import { load } from '../core/state';
import { split, COL, rnd } from './pixel/kit';

const app = new App(document.getElementById('board') as HTMLCanvasElement, document.getElementById('typer') as HTMLInputElement);
app.push({ id: 'title', frame() { const S = app.S, ui = app.ui; for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) { const v = Math.sin(y * 0.55 + Math.sin(x * 0.02 + y * 0.05) * 3) + (rnd(y * 977 + (x >> 3)) - 0.5) * 0.6; S.px(x, y, v > 0.75 ? COL.wood3 : v < -0.7 ? COL.wood2 : COL.wood); }
  ui.panel({ x: 120, y: 60, w: 240, h: 40 }, 'enamel'); ui.label({ x: 130, y: 70, w: 220, h: 10 }, 'G E A R H O U S E', COL.cream, 'c'); ui.label({ x: 130, y: 84, w: 220, h: 9 }, '판본 1단계 · 장소와 시계', COL.lit, 'c');
  const [a, b] = split({ x: 160, y: 130, w: 160, h: 16 }, ['*', '*'], 6), has = !!store.get();
  if (ui.button('new', a!, '새로 시작')) { startGame(app, 'coachbuilder', 31); app.replace(worldScene(app)); }
  if (ui.button('cont', b!, '이어서', { disabled: !has })) { try { app.world = openWorld(load(store.get()!)); app.replace(worldScene(app)); } catch (e) { app.toast('저장을 읽지 못했다: ' + (e as Error).message); } } } });
(globalThis as { __app?: App }).__app = app;
