// The drawing board on its own page (the published demo): the game's drawing scene with a made-up order, every sheet
// and era to switch through. The game itself opens the same scene from the desk (ui/scenes/desk.ts).
import { App } from './shell/app';
import { drawingScene, lightsName, type Ask } from './scenes/drawing';

const HOWARD: Ask[] = [
  { t: '4도어 세단', test: m => m.lights !== 2, val: m => `세단 ${lightsName(m.lights)}` },
  { t: '머리 공간: 전고 1850 이상', test: m => m.height >= 1850, val: m => `${m.height}` },
  { t: '뒷좌석: 축간 2700 이상', test: m => m.wb >= 2700, val: m => `${m.wb}` },
  { t: '시골길: 지상고 310 이상', test: m => m.clearance >= 310, val: m => `${m.clearance}` },
  { t: '왕진 가방: 짐받이', test: m => m.rack, val: m => (m.rack ? '있음' : '없음') },
  { t: '예산 $1,200 이하', test: (_m, _e, x) => x.total <= 1200, val: (_m, _e, x) => `$${x.total}` } ];
const app = new App(document.getElementById('board') as HTMLCanvasElement, document.getElementById('typer') as HTMLInputElement);
app.push(drawingScene(app, { from: '닥터 하워드 부부', asks: HOWARD, era: '1920s', size: 0, demo: true }));
(globalThis as { __app?: App }).__app = app;
