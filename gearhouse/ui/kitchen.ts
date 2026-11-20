// Prototype C on its own page: the consultation at the kitchen table (ui/scenes/kitchen.ts).
import { App } from './shell/app';
import { kitchenScene } from './scenes/kitchen';

const app = new App(document.getElementById('board') as HTMLCanvasElement, document.getElementById('typer') as HTMLInputElement);
const h = new Date().getHours(), again = () => app.replace(kitchenScene(app, { hour: h, sky: '비', done: () => { app.toast('상담을 마쳤다. 메모는 도면의 주문서로 간다.'); setTimeout(again, 2500); } }));
app.push(kitchenScene(app, { hour: h, sky: '비', done: () => { app.toast('상담을 마쳤다. 메모는 도면의 주문서로 간다.'); setTimeout(again, 2500); } }));
(globalThis as { __app?: App }).__app = app;
