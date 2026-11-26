// Prototype A on its own page: the front of the shop with weather, time and a customer at the door (ui/scenes/street.ts).
import { App } from './shell/app';
import { streetScene } from './scenes/street';

const app = new App(document.getElementById('board') as HTMLCanvasElement, document.getElementById('typer') as HTMLInputElement);
app.push(streetScene(app));
(globalThis as { __app?: App }).__app = app;
