// Assembly test sheet: node tools/pixel/samplesAsm.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { writeFileSync } from 'node:fs';
import { buildCar } from './gen/car.mjs';
import { assemble, assembleViews, PAINT_HEX } from './gen/assemble.mjs';
import { buildFront } from './gen/front.mjs';
import { marketScores } from './gen/market.mjs';
const P = eraPalette(); PAINT_HEX.forEach((h, i) => P.auto('paint.c' + (i + 1), h, h === '#d8c9a0' ? { sat: 0.9 } : {}));
const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440'), sub = hex('#6a6070');
const cars = []; for (let s = 1; s <= 20; s++) { const { spec, report } = assemble(s); report.market = marketScores(report); const c = buildCar(P, spec, 12.5); report.anchors = c.anchorLog.brackets.length; cars.push([c, report]); }
const colW = Math.max(...cars.map(([c]) => c.w)) + 30, rowH = Math.max(...cars.map(([c]) => c.h)) + 52;
const sh = new Sheet(colW * 2 + 20, rowH * 10 + 20, hex('#d9d3c7'));
cars.forEach(([c, r], i) => { const x = 16 + (i % 2) * colW, y = 12 + Math.floor(i / 2) * rowH;
  text(sh, `#${r.seed} ${r.year} ${r.style.toUpperCase()} ${r.type.toUpperCase()}  SCORE ${r.score}  ${r.character.toUpperCase()}  ECO ${r.market.economy} FAM ${r.market.family} LUX ${r.market.luxury} SPT ${r.market.sport}`, x, y, ink, 1);
  text(sh, `${r.body.fender} ${r.body.tail} ${r.picks.wheel} ${r.picks.headlamp} ${r.picks.bumper} ${r.picks.hoodVent}`.toUpperCase(), x, y + 9, sub, 1);
  drawPix(sh, c, P, x, y + 20, 1); });
writePNG(out + 'e1_assembly_test.png', sh.w, sh.h, sh.d);
writeFileSync(new URL('../../data/e1_assembly_test.json', import.meta.url).pathname, JSON.stringify(cars.map(([, r]) => r), null, 1));
const sc = cars.map(([, r]) => r.score); console.log('scores', sc.join(','), 'rejected avg', (cars.reduce((a, [, r]) => a + r.rejected, 0) / 20).toFixed(1));

// 3-view sheet for 8 assembled cars
{ const z = 1, rows = [1, 2, 4, 6, 9, 12, 15, 20].map(sd => { const a = assembleViews(sd); return [a.report, buildCar(P, a.spec, 12.5), buildFront(P, a.front, 12.5), buildFront(P, a.rear, 12.5)]; });
  const W = Math.max(...rows.map(([, L, F, B]) => L.w + F.w + B.w)) + 80, H = rows.reduce((a, [, L]) => a + L.h + 30, 20);
  const s2 = new Sheet(W, H, hex('#d9d3c7')); let y = 12;
  for (const [r, L, F, B] of rows) { text(s2, `#${r.seed} ${r.year} ${r.style.toUpperCase()} ${r.picks.grille.toUpperCase()} ${r.picks.headlamp.toUpperCase()} ${r.picks.bumper.toUpperCase()}`, 16, y, ink, 1);
    drawPix(s2, L, P, 16, y + 12, 1); drawPix(s2, F, P, 40 + L.w, y + 12 + L.h - F.h, 1); drawPix(s2, B, P, 60 + L.w + F.w, y + 12 + L.h - B.h, 1); y += L.h + 30; }
  writePNG(out + 'e1_assembly_3view.png', s2.w, s2.h, s2.d); }
