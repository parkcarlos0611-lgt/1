// Prototype D on its own page: the telephone and the directory (ui/scenes/phone.ts).
import { App } from './shell/app';
import { phoneScene } from './scenes/phone';

const app = new App(document.getElementById('board') as HTMLCanvasElement, document.getElementById('typer') as HTMLInputElement);
app.push(phoneScene(app));
(globalThis as { __app?: App }).__app = app;
