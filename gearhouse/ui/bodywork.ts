// Prototype B on its own page: rust repair by hand on the 1929 sedan (ui/scenes/bodywork.ts).
import { App } from './shell/app';
import { bodyworkScene } from './scenes/bodywork';

const app = new App(document.getElementById('board') as HTMLCanvasElement, document.getElementById('typer') as HTMLInputElement);
app.push(bodyworkScene(app));
(globalThis as { __app?: App }).__app = app;
