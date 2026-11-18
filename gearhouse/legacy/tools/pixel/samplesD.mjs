// Detail-scale comparison: node tools/pixel/samplesD.mjs
import { eraPalette, hex } from './color.mjs';
import { Sheet, drawPix } from './pix.mjs';
import { writePNG } from './png.mjs';
import { text } from './font.mjs';
import { buildCar } from './gen/car.mjs';
import { coupeD, sedanD } from './gen/detail30.mjs';
import { coupe, townSedan } from './gen/vehicles30.mjs';
import { buildFront } from './gen/front.mjs';
import { airflow34, zephyr37, airflow34Front, airflow34Rear, zephyr37Front, zephyr37Rear } from './gen/stream30d.mjs';
import { engineSV } from './gen/engineSV.mjs';
import { buildUnderbody, smallPlatformUnder } from './gen/underbody.mjs';
import { townCar34, townCarFront, townCarRear } from './gen/luxury30d.mjs';
export const P = eraPalette();
P.auto('paint.niagara', '#4b6283'); P.auto('paint.copra', '#7d3a2c'); P.auto('paint.airflow', '#3f8a72'); P.auto('paint.zephyr', '#7a1f2b'); P.add('ghost', ['#1d3557', '#2f5486', '#5c86bd', '#9cc3ea', '#dceeff'], '#9cc3ea');
const out = new URL('../../samples/', import.meta.url).pathname, ink = hex('#3a3440');
export const items = [['BEFORE (25MM/PX)', buildCar(P, coupe.body, 25), 4], ['AFTER - DETAIL 12.5MM/PX', buildCar(P, coupeD, 12.5), 2],
  ['BEFORE (25MM/PX)', buildCar(P, townSedan.body, 25), 4], ['AFTER - DETAIL 12.5MM/PX', buildCar(P, sedanD, 12.5), 2]];
const W = Math.max(...items.map(([, c, z]) => c.w * z)) + 32; const sh = new Sheet(W, items.reduce((a, [, c, z]) => a + c.h * z + 40, 20), hex('#d9d3c7'));
let y = 14; for (const [n, c, z] of items) { text(sh, n + '  ' + c.w + 'x' + c.h, 16, y, ink); drawPix(sh, c, P, 16, y + 16, z); y += c.h * z + 40; }
writePNG(out + 'e1_detail_before_after.png', sh.w, sh.h, sh.d); console.log('ok', sh.w, sh.h);

{ const F = buildFront(P, { ...townSedan.front, glassStyle: 'period' }, 12.5), B = buildFront(P, townSedan.rear, 12.5), z = 3;
  const sh2 = new Sheet((F.w + B.w) * z + 60, F.h * z + 50, hex('#d9d3c7'));
  text(sh2, 'FRONT 12.5MM/PX', 16, 12, ink); drawPix(sh2, F, P, 16, 30, z); text(sh2, 'REAR', 40 + F.w * z, 12, ink); drawPix(sh2, B, P, 40 + F.w * z, 30, z);
  writePNG(out + 'e1_detail_front_rear.png', sh2.w, sh2.h, sh2.d); }

{ const L = [['1934 AIRFLOW-TYPE SEDAN 12.5MM/PX', buildCar(P, airflow34, 12.5)], ['1937 PROW-GRILLE FASTBACK COUPE 12.5MM/PX', buildCar(P, zephyr37, 12.5)]], z = 2;
  const sh3 = new Sheet(Math.max(...L.map(([, c]) => c.w)) * z + 32, L.reduce((a, [, c]) => a + c.h * z + 40, 20), hex('#d9d3c7')); let y = 14;
  for (const [n, c] of L) { text(sh3, n, 16, y, ink); drawPix(sh3, c, P, 16, y + 16, z); y += c.h * z + 40; }
  writePNG(out + 'e1_streamline_detail.png', sh3.w, sh3.h, sh3.d); }

{ P.auto('paint.enginegreen', '#45574d', { sat: 0.8 }); P.auto('rust', '#8a5236', { sat: 0.8 });
  const e = engineSV(P, {}), z = 4; const sh4 = new Sheet(e.w * z + 32, e.h * z + 50, hex('#d9d3c7'));
  text(sh4, 'I4 3.3L SIDEVALVE - DETAIL (5MM/PX) FROM ENGINE-BAY PHOTOS', 16, 12, ink); drawPix(sh4, e, P, 16, 32, z);
  writePNG(out + 'e1_engine_sv_detail.png', sh4.w, sh4.h, sh4.d); }

{ P.auto('floor', '#5a3a28', { sat: 0.7 }); P.auto('paint.wheel', '#c9a227');
  const u = buildUnderbody(P, smallPlatformUnder, 12.5), z = 3; const sh5 = new Sheet(u.w * z + 32, u.h * z + 50, hex('#cfc9bd'));
  text(sh5, '1930 SMALL PLATFORM - UNDERSIDE (VIEW FROM BELOW, FRONT LEFT) 12.5MM/PX', 16, 12, ink); drawPix(sh5, u, P, 16, 32, z);
  writePNG(out + 'e1_underbody.png', sh5.w, sh5.h, sh5.d); }

{ P.auto('paint.cadmaroon', '#5c1c27');
  const L = buildCar(P, townCar34, 12.5), Fv = buildFront(P, townCarFront, 12.5), Bv = buildFront(P, townCarRear, 12.5), z = 2;
  const sh6 = new Sheet(Math.max(L.w, Fv.w + Bv.w + 20) * z + 40, (L.h + Fv.h) * z + 90, hex('#d9d3c7'));
  text(sh6, '1934 V12 TOWN CAR - SIDE / FRONT / REAR 12.5MM/PX', 16, 12, ink); drawPix(sh6, L, P, 16, 30, z);
  drawPix(sh6, Fv, P, 16, 50 + L.h * z, z); drawPix(sh6, Bv, P, 56 + Fv.w * z, 50 + L.h * z, z);
  writePNG(out + 'e1_towncar_views.png', sh6.w, sh6.h, sh6.d); }

{ const V = [['AIRFLOW-TYPE FRONT', buildFront(P, airflow34Front, 12.5)], ['REAR', buildFront(P, airflow34Rear, 12.5)], ['PROW COUPE FRONT', buildFront(P, zephyr37Front, 12.5)], ['REAR', buildFront(P, zephyr37Rear, 12.5)]], z = 2;
  const sh7 = new Sheet(V.reduce((a, [, c]) => a + c.w * z + 24, 24), Math.max(...V.map(([, c]) => c.h)) * z + 50, hex('#d9d3c7')); let x = 16;
  for (const [n, c] of V) { text(sh7, n, x, 12, ink); drawPix(sh7, c, P, x, 30, z); x += c.w * z + 24; }
  writePNG(out + 'e1_streamline_front_rear.png', sh7.w, sh7.h, sh7.d); }
