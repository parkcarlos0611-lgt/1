// Version one on its own page: a new game (or the saved one) and the places of the shop (ui/world/world.ts).
import { App, store } from './shell/app';
import { worldScene } from './world/world';
import { startGame } from './scenes/desk';
import { builderScene } from './scenes/builder';
import { openWorld } from '../core/world';
import { load } from '../core/state';
import { split, COL, rnd } from './pixel/kit';

/** the build's number (it follows the published page's version) and the pre-alpha's steps: 1 done, 0.5 begun, 0 to come */
const BUILD = 23;
const STATUS: [string, number][] = [['1 집 앞 · 주방 · 전화 · 문', 1], ['2 손님 차 (실제 크기)', 1], ['3 손님 방문 · 상담', 1], ['4 차고 수리 (녹 · 판금)', 1], ['5 인도 · 대금', 1], ['부품 빌더 (시험)', 0.5], ['다음: 엔진 그림 · 금속 질감', 0]];
const app = new App(document.getElementById('board') as HTMLCanvasElement, document.getElementById('typer') as HTMLInputElement);
app.push({ id: 'title', frame() { const S = app.S, ui = app.ui; for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) { const v = Math.sin(y * 0.55 + Math.sin(x * 0.02 + y * 0.05) * 3) + (rnd(y * 977 + (x >> 3)) - 0.5) * 0.6; S.px(x, y, v > 0.75 ? COL.wood3 : v < -0.7 ? COL.wood2 : COL.wood); }
  ui.panel({ x: 120, y: 60, w: 240, h: 40 }, 'enamel'); ui.label({ x: 130, y: 70, w: 220, h: 10 }, 'G E A R H O U S E', COL.cream, 'c'); ui.label({ x: 130, y: 84, w: 220, h: 9 }, '프리알파 · 수리 공방 한 바퀴', COL.lit, 'c');
  // where the build stands (the pre-alpha's steps, done and to come)
  { const r = { x: 296, y: 170, w: 180, h: 96 }; ui.panel(r, 'card'); ui.label({ x: r.x + 6, y: r.y + 4, w: r.w - 12, h: 10 }, `프리알파 버전 ${BUILD}`, COL.ink);
    STATUS.forEach(([s, done], k) => ui.label({ x: r.x + 6, y: r.y + 17 + k * 10, w: r.w - 12, h: 9 }, `${done === 1 ? '+' : done === 0.5 ? '~' : '-'} ${s}`, done === 1 ? COL.ok : done ? COL.ink : COL.inkSoft)); }
  const [a, b] = split({ x: 160, y: 130, w: 160, h: 16 }, ['*', '*'], 6), has = !!store.get();
  if (ui.button('builder', { x: 160, y: 152, w: 160, h: 16 }, '부품 빌더 (시험)')) { app.push(builderScene(app)); return; }
  if (ui.button('new', a!, '새로 시작')) { startGame(app, 'coachbuilder', 31); app.replace(worldScene(app)); }
  if (ui.button('cont', b!, '이어서', { disabled: !has })) { try { app.world = openWorld(load(store.get()!)); app.replace(worldScene(app)); } catch (e) { app.toast('저장을 읽지 못했다: ' + (e as Error).message); } } } });
(globalThis as { __app?: App }).__app = app;
