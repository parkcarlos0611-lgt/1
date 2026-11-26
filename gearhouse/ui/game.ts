// The game's one entry point (roadmap step 2): the shell with the title screen; from there the pixel desk and the
// drawing board. The HTML desk (desk.html) still holds the rest of the work and reads the same save.
import { App } from './shell/app';
import { titleScene } from './scenes/desk';

const app = new App(document.getElementById('board') as HTMLCanvasElement, document.getElementById('typer') as HTMLInputElement);
const htmlDesk = !!(globalThis as { GEARHOUSE_HTML_DESK?: boolean }).GEARHOUSE_HTML_DESK;
app.push(titleScene(app, { htmlDesk }));
(globalThis as { __app?: App }).__app = app;
