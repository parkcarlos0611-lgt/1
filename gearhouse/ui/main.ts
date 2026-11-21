// Boot: an empty PixiJS stage at an integer pixel scale. The screens of the prototypes start from here.
import { Application, Graphics, Text } from 'pixi.js';

const app = new Application();
await app.init({ resizeTo: window, background: '#140e0b', antialias: false, roundPixels: true });
document.body.appendChild(app.canvas);
const mark = new Graphics().rect(0, 0, 8, 8).fill('#c8a050');
const label = new Text({ text: 'GEARHOUSE 0.2 - prototype stage', style: { fill: '#e8dcc0', fontFamily: 'monospace', fontSize: 16 } });
label.position.set(16, 12); mark.position.set(4, 16);
app.stage.addChild(mark, label);
