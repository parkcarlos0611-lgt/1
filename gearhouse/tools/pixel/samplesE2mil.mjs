// node tools/pixel/samplesE2mil.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildMil } from './gen/military.mjs';
import * as M from './gen/e2military.mjs';
const P = eraPalette(); const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440');
const V = [['1941 1/4-TON 4X4 UTILITY - SIDE', buildMil(P, M.jeepSide)], ['FRONT', buildMil(P, M.jeepFront)], ['1941 2-1/2-TON 6X6 CARGO', buildMil(P, M.cckwCargo)], ['6X6 CANVAS', buildMil(P, M.cckwCanvas)], ['6X6 FRONT', buildMil(P, M.cckwFront)]];
const z = 2, W = 40 + Math.max(V[0][1].w + V[1][1].w + 30, V[2][1].w, V[3][1].w + V[4][1].w + 30) * z, sh = new Sheet(W, (V[0][1].h + V[2][1].h + V[3][1].h) * z + 140, hex('#d9d3c7'));
let y = 14; text(sh, V[0][0], 16, y, ink); drawPix(sh, V[0][1], P, 16, y + 16, z); text(sh, V[1][0], 46 + V[0][1].w * z, y, ink); drawPix(sh, V[1][1], P, 46 + V[0][1].w * z, y + 16 + (V[0][1].h - V[1][1].h) * z, z);
y += V[0][1].h * z + 40; text(sh, V[2][0], 16, y, ink); drawPix(sh, V[2][1], P, 16, y + 16, z);
y += V[2][1].h * z + 40; text(sh, V[3][0], 16, y, ink); drawPix(sh, V[3][1], P, 16, y + 16, z); text(sh, V[4][0], 46 + V[3][1].w * z, y, ink); drawPix(sh, V[4][1], P, 46 + V[3][1].w * z, y + 16 + (V[3][1].h - V[4][1].h) * z, z);
writePNG(out + 'e2_military.png', sh.w, sh.h, sh.d);
console.log('ok', V.map(([n, c]) => n + ':' + c.anchorLog.brackets.length + '/' + c.anchorLog.unresolved.length).join(' '));
