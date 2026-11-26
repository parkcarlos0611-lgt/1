// E1 prop batch B1 (36 + mascot rework): fenders F10/R8, running boards 5, spare mounts 7, trunks 6. Detail scale 12.5 mm/px (side view).
import { Pix, Mask } from '../pix.mjs';
import { fillet, arc } from './geom.mjs';
import { outlineAll } from './props.mjs';
import { dith } from './car.mjs';
import { wheel } from './wheel.mjs';
import { tire } from './tire.mjs';

class Cv {
  constructor(P, wMM, hMM, mm = 12.5, ox = 0) { this.P = P; this.mm = mm; this.w = Math.ceil(wMM / mm) + 6; this.h = Math.ceil(hMM / mm) + 6; this.px = new Pix(this.w, this.h); this.ox = ox; this.tag = 20; }
  X(x) { return 3 + (x + this.ox) / this.mm; } Y(z) { return this.h - 3 - z / this.mm; }
  M() { return new Mask(this.w, this.h); }
  poly(pts, r = 0) { return this.M().poly(fillet(pts.map(p => [p[0], p[1], p[2] ?? r]), 3).map(([x, z]) => [this.X(x), this.Y(z)])); }
  vol(m, ramp, g = [3.2, 0.8]) { const t = this.tag++, r = this.P.id(ramp);
    for (let x = 0; x < this.w; x++) { let y = 0; while (y < this.h) { if (!m.get(x, y)) { y++; continue; } const y0 = y; while (y < this.h && m.get(x, y)) y++; const n = y - y0;
      for (let k = 0; k < n; k++) this.px.set(x, y0 + k, r, k === 0 ? 4 : dith(x, y0 + k, g[0] + (g[1] - g[0]) * k / Math.max(1, n - 1)), t); } } }
  chrome(m) { const t = this.tag++, r = this.P.id('chrome'), bb = m.bbox(); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (m.get(x, y)) { const k = (y - bb.y0) / Math.max(1, bb.y1 - bb.y0 + 1); this.px.set(x, y, r, [4, 3, 1, 2, 2, 1][Math.floor(k * 6)], t); } }
  flat(m, ramp, lv) { const t = this.tag++, r = this.P.id(ramp); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (m.get(x, y)) this.px.set(x, y, r, !m.get(x, y - 1) ? lv + 1 : lv, t); }
  ghostWheel(x, r, tf) { const wp = wheel(this.P, { r: r / this.mm, tireFrac: tf, style: 'disc', paint: 'ghost' }); const X0 = Math.round(this.X(x) - wp.w / 2), Y0 = Math.round(this.Y(r) - wp.h / 2);
    for (let j = 0; j < wp.h; j++) for (let i = 0; i < wp.w; i++) { const k = j * wp.w + i; if (wp.r[k]) this.px.set(X0 + i, Y0 + j, this.P.id('ghost'), Math.min(1, wp.l[k] < 0 ? 0 : wp.l[k] >> 1), 2); } }
  blitWheel(x, z, r, opt) { const wp = wheel(this.P, { ...opt, r: r / this.mm }); const X0 = Math.round(this.X(x) - wp.w / 2), Y0 = Math.round(this.Y(z) - wp.h / 2); for (let j = 0; j < wp.h; j++) for (let i = 0; i < wp.w; i++) { const k = j * wp.w + i; if (wp.r[k]) this.px.set(X0 + i, Y0 + j, wp.r[k], wp.l[k], this.tag); } this.tag++; }
  done() { outlineAll(this.px); return this.px; }
}
const T = tire('5.25-18'), R = T.r, TF = T.frac;

// ----- fenders: built around the wheel centre (0, R); x negative = forward -----
function fenderF(P, kind, paint = 'paint.prop') {
  const c = new Cv(P, 2600, 1100, 12.5, 900); c.ghostWheel(0, R, TF);
  const g = R + 60, out = [];
  const A = (rx, rz, a0, a1) => arc(0, R, rx, rz, a0, a1, 14);
  const P2 = {
    cycle: [...A(g + 70, g + 70, 160, 20), ...A(g, g, 20, 160)],
    clamshell: [...A(g + 90, g + 90, 175, 10), [g + 120, R - 40, 0], ...A(g, g, 10, 175), [-g - 110, R - 30, 0]],
    longsweep: [[-g - 120, R + 40, 0], ...A(g + 140, g + 130, 150, 30), [1250, 420, 0], [1250, 350, 0], [g * 0.95, R + g * 0.35, 0], ...A(g, g, 25, 150)],
    valanced: [[-g - 160, R - 80, 0], ...A(g + 170, g + 140, 165, 28), [1250, 400, 0], [1250, 330, 0], [g, R + 40, 0], ...A(g, g, 15, 165)],
    sidemount: [[-g - 120, R + 40, 0], ...A(g + 140, g + 130, 150, 40), [400, R + g, 0], [900, R + g - 40, 0], [1250, 420, 0], [1250, 350, 0], [g * 0.95, R + g * 0.35, 0], ...A(g, g, 25, 150)],
    pontoon: [[-g - 220, 260, 0], [-g - 200, R + g * 0.7, 0], [-g * 0.4, R + g + 140, 0], [g * 0.7, R + g + 110, 0], [1100, R + 120, 0], [1500, 300, 0], [g + 100, 300, 0], ...A(g, g, 15, 165)],
    lampPod: [[-g - 120, R + 40, 0], ...A(g + 140, g + 130, 150, 30), [1250, 420, 0], [1250, 350, 0], [g * 0.95, R + g * 0.35, 0], ...A(g, g, 25, 150)],
    teardrop: [[-g - 60, R - 60, 0], ...A(g + 120, g + 110, 170, 40), [1050, R + 40, 0], [1300, R - 120, 0], [g * 0.9, R + g * 0.2, 0], ...A(g, g, 25, 170)],
    skirted: [[-g - 140, 300, 0], [-g - 140, R + g * 0.6, 0], ...A(g + 140, g + 130, 140, 30), [1250, 400, 0], [1250, 300, 0], [g * 0.6, 300, 0], ...A(g, g * 0.7, 20, 160)],
    racingWing: [...A(g + 40, g + 40, 150, 30), ...A(g, g, 30, 150)],
  }[kind];
  c.vol(c.poly(P2, 0), paint);
  if (kind === 'lampPod') { c.vol(c.poly([[-g - 60, R + g * 0.55], [-g + 140, R + g * 0.55], [-g + 120, R + g * 0.9], [-g - 40, R + g * 0.9]], 60), paint, [3.6, 1.4]); c.chrome(c.poly([[-g - 85, R + g * 0.58], [-g - 55, R + g * 0.58], [-g - 55, R + g * 0.87], [-g - 85, R + g * 0.87]], 15)); }
  if (kind === 'sidemount') c.flat(c.poly([[350, R + g - 10], [900, R + g - 50], [900, R + g - 70], [350, R + g - 30]]), 'black', 0);
  return c.done();
}
function fenderR(P, kind, paint = 'paint.prop') {
  const c = new Cv(P, 2300, 1100, 12.5, 1100); c.ghostWheel(0, R, TF);
  const g = R + 60, A = (rx, rz, a0, a1) => arc(0, R, rx, rz, a0, a1, 14);
  const P2 = {
    arch: [[-g - 140, 330, 0], ...A(g + 130, g + 120, 165, 20), [g + 220, 300, 0], [g + 160, 270, 0], ...A(g, g, 12, 166)],
    longTail: [[-g - 140, 330, 0], ...A(g + 130, g + 120, 165, 30), [g + 500, 330, 0], [g + 440, 280, 0], ...A(g, g, 12, 166)],
    spatFull: [[-g - 120, 280, 0], [-g - 100, R + g * 0.6, 0], ...A(g + 120, g + 110, 140, 30), [g + 280, 300, 0], [g + 220, 270, 0]],
    spatHalf: [[-g - 120, 330, 0], ...A(g + 120, g + 110, 165, 25), [g + 260, 290, 0], [g + 200, 260, 0], [g * 0.6, R - 20, 0], [-g * 0.6, R - 20, 0]],
    pontoon: [[-g - 300, 260, 0], [-g - 260, R + g * 0.8, 0], [-g * 0.2, R + g + 100, 0], [g * 0.8, R + g + 40, 0], [g + 380, R - 40, 0], [g + 420, 280, 0], [g + 200, 260, 0], ...A(g, g, 10, 170)],
    teardrop: [[-g - 160, 340, 0], ...A(g + 120, g + 110, 160, 40), [g + 520, R - 40, 0], [g + 560, R - 140, 0], [g + 200, R - 60, 0], ...A(g, g, 12, 165)],
    cycle: [...A(g + 70, g + 70, 160, 20), ...A(g, g, 20, 160)],
    bustle: [[-g - 160, 330, 0], ...A(g + 140, g + 160, 165, 35), [g + 360, R + 180, 0], [g + 400, 330, 0], [g + 180, 280, 0], ...A(g, g, 12, 166)],
  }[kind];
  c.vol(c.poly(P2, 0), paint);
  if (kind === 'spatFull' || kind === 'spatHalf') c.chrome(c.poly([[-g + 20, R + 10], [g + 120, R + 10], [g + 120, R + 30], [-g + 20, R + 30]]));
  return c.done();
}
// ----- running boards (plan view, 1100 x 260) -----
function board(P, kind) {
  const c = new Cv(P, 1200, 300, 6.25); const m = c.poly([[0, 20], [1150, 20], [1150, 270], [0, 270]], 25);
  if (kind === 'rubberAlu') { c.flat(m, 'rubber', 1); for (let x = 60; x < 1100; x += 25) c.flat(c.poly([[x, 50], [x + 10, 50], [x + 10, 240], [x, 240]]), 'rubber', 2); c.chrome(c.poly([[0, 20], [1150, 20], [1150, 45], [0, 45]])); c.chrome(c.poly([[0, 245], [1150, 245], [1150, 270], [0, 270]])); }
  if (kind === 'ribbed') { c.flat(m, 'rubber', 1); for (let z = 40; z < 260; z += 18) c.flat(c.poly([[30, z], [1120, z], [1120, z + 6], [30, z + 6]]), 'rubber', 3); }
  if (kind === 'checker') { c.flat(m, 'rubber', 1); for (let x = 20; x < 1130; x += 30) for (let z = 40; z < 250; z += 30) if (((x + z) / 30) % 2 < 1) c.flat(c.poly([[x, z], [x + 15, z], [x + 15, z + 15], [x, z + 15]]), 'rubber', 3); }
  if (kind === 'woodSlat') { c.flat(m, 'black', 1); for (let z = 30; z < 260; z += 48) c.vol(c.poly([[10, z], [1140, z], [1140, z + 38], [10, z + 38]], 6), 'wood', [3, 1.5]); }
  if (kind === 'stepPads') { c.flat(m, 'paint.prop', 2); for (const x of [150, 900]) { c.flat(c.poly([[x, 60], [x + 150, 60], [x + 150, 230], [x, 230]], 20), 'rubber', 1); } c.chrome(c.poly([[0, 245], [1150, 245], [1150, 265], [0, 265]])); }
  return c.done();
}
// ----- spare mounts (side view) -----
function spare(P, kind) {
  const c = new Cv(P, 1100, 1000, 12.5, 100), r = R;
  if (kind === 'rearExposed' || kind === 'rearCover' || kind === 'dualRear') {
    const xs = kind === 'dualRear' ? [80, 280] : [150];
    for (const x of xs) { const k = kind === 'dualRear' ? 90 : 0; c.vol(c.poly([[x, 120, 60], [x + k, 120 + 2 * r, 60], [x + k + 140, 120 + 2 * r, 60], [x + 140, 120, 60]]), kind === 'rearCover' ? 'paint.prop' : 'rubber', kind === 'rearCover' ? [3.4, 1.2] : [2.4, 0.6]); }
    if (kind === 'rearCover') c.chrome(c.poly([[290, 120 + r - 50], [330, 120 + r - 50], [330, 120 + r + 50], [290, 120 + r + 50]], 10));
    c.flat(c.poly([[0, 200], [150, 240], [150, 270], [0, 230]]), 'black', 1);
  } else {
    c.blitWheel(500, r + 40, r, { tireFrac: TF, style: kind === 'sideExposed' ? 'wire' : 'hubcap', spokes: 32 });
    if (kind === 'sideCover' || kind === 'sideMirror') { const m = c.M().circle(c.X(500), c.Y(r + 40), r / 12.5); m.sub(c.M().circle(c.X(500), c.Y(r + 40), r * 0.62 / 12.5)); c.vol(m, 'paint.prop', [3.4, 1]); c.chrome(c.M().circle(c.X(500), c.Y(r + 40), r * 0.2 / 12.5)); }
    if (kind === 'sideMirror') { c.flat(c.poly([[490, 2 * r + 40], [510, 2 * r + 40], [510, 2 * r + 220], [490, 2 * r + 220]]), 'chrome', 2); c.chrome(c.M().ellipse(c.X(500), c.Y(2 * r + 270), 70 / 12.5, 55 / 12.5)); }
    if (kind === 'sideStrap') c.flat(c.poly([[490, 40], [510, 40], [510, 2 * r + 40], [490, 2 * r + 40]]), 'black', 1);
  }
  return c.done();
}
// ----- trunks (side view, attached at body rear x = 0) -----
function trunk(P, kind) {
  const c = new Cv(P, 900, 1000, 12.5, 100);
  c.flat(c.poly([[-100, 200], [0, 200], [0, 950], [-100, 950]]), 'ghost', 0);
  if (kind === 'rack') { for (const z of [420, 470]) c.chrome(c.poly([[0, z], [520, z], [520, z + 25], [0, z + 25]])); c.flat(c.poly([[480, 300], [520, 300], [520, 495], [480, 495]]), 'black', 1); c.flat(c.poly([[0, 300], [480, 300], [480, 320], [0, 320]]), 'black', 1); }
  if (kind === 'box') { c.vol(c.poly([[30, 470], [560, 470], [560, 900], [30, 900]], 30), 'black', [2.8, 1]); for (const z of [560, 680, 800]) c.chrome(c.poly([[30, z], [560, z], [560, z + 15], [30, z + 15]])); c.chrome(c.poly([[260, 860], [330, 860], [330, 900], [260, 900]], 8)); c.chrome(c.poly([[0, 440], [600, 440], [600, 470], [0, 470]])); }
  if (kind === 'integrated') c.vol(c.poly([[0, 300], [0, 900, 0], [250, 880, 200], [420, 700, 220], [450, 330, 80], [380, 300, 0]]), 'paint.prop');
  if (kind === 'beavertail') c.vol(c.poly([[0, 330], [0, 900], [300, 780, 300], [700, 420, 200], [720, 330, 60]]), 'paint.prop');
  if (kind === 'bustle') { c.vol(c.poly([[0, 300], [0, 950, 0], [120, 940, 120], [380, 820, 220], [430, 600, 160], [400, 320, 60]]), 'paint.prop'); c.chrome(c.poly([[200, 600], [260, 600], [260, 625], [200, 625]], 8)); }
  if (kind === 'rumble') { c.vol(c.poly([[0, 300], [0, 950, 0], [300, 880, 320], [520, 640, 260], [560, 330, 80]]), 'paint.prop'); c.flat(c.poly([[10, 930], [300, 860], [500, 640], [495, 630], [295, 850], [10, 918]]), 'black', 0); c.chrome(c.poly([[300, 820], [350, 820], [350, 840], [300, 840]], 6)); }
  return c.done();
}
// ----- mascots rework (2.5 mm/px, side view, generic forms) -----
const MS = {
  cap: [[[-32, 0], [32, 0], [30, 18], [24, 40, 8], [-24, 40, 8], [-30, 18]]],
  motometer: [[[-30, 0], [30, 0], [28, 22], [-28, 22]], [[-45, 22, 0], [45, 22, 0], [45, 112, 45], [-45, 112, 45]]],
  wingcap: [[[-30, 0], [30, 0], [28, 26, 6], [-28, 26, 6]], [[-5, 26], [20, 30], [100, 70, 20], [130, 95], [60, 74], [10, 60], [-40, 44]]],
  eagle: [[[-26, 0], [26, 0], [20, 24], [-20, 24]], [[-12, 24], [12, 24], [18, 60, 8], [40, 75], [140, 140], [70, 80], [130, 60], [40, 70], [10, 90, 6], [0, 102], [-14, 90], [-24, 66], [-90, 120], [-40, 64]]],
  arrow: [[[-30, 0], [30, 0], [26, 22], [-26, 22]], [[-60, 22], [20, 22], [40, 30], [150, 40], [40, 50], [20, 58], [-80, 58], [-40, 40]]],
  swan: [[[-30, 0], [30, 0], [26, 20], [-26, 20]], [[-70, 20], [60, 20], [90, 40, 20], [40, 56, 20], [22, 70], [16, 130, 20], [30, 150, 10], [62, 146], [34, 160, 10], [4, 150, 10], [0, 70], [-20, 56], [-90, 70], [-60, 40]]],
  hound: [[[-30, 0], [30, 0], [26, 20], [-26, 20]], [[-20, 20], [20, 20], [60, 40, 10], [130, 60], [150, 74, 6], [120, 80], [80, 66], [20, 64, 10], [-60, 72], [-110, 80], [-80, 60], [-40, 40]]],
  rocket: [[[-26, 0], [26, 0], [22, 22], [-22, 22]], [[-40, 22], [10, 22], [40, 34, 10], [150, 52, 10], [40, 70, 10], [-60, 72], [-90, 92], [-80, 58], [-90, 34], [-60, 40]]],
  propeller: [[[-24, 0], [24, 0], [20, 36], [-20, 36]], [[-14, 36], [14, 36], [10, 60], [110, 100, 20], [100, 112], [8, 74], [-100, 118], [-112, 104], [-10, 60]]],
  figure: [[[-30, 0], [30, 0], [26, 22], [-26, 22]], [[-10, 22], [16, 22], [26, 56], [80, 70, 10], [140, 100], [70, 92], [30, 90], [24, 130, 8], [8, 140, 8], [-6, 128], [-10, 90], [-90, 110], [-120, 104], [-30, 70], [-20, 40]]],
};
export function mascot2(P, k) { const c = new Cv(P, 340, 200, 2.5, 170); c.Y = z => c.h - 3 - z / c.mm; for (const shape of MS[k]) c.chrome(c.poly(shape, 4)); return c.done(); }

export const CATALOG_B1 = [
  ...['cycle', 'clamshell', 'longsweep', 'valanced', 'sidemount', 'pontoon', 'lampPod', 'teardrop', 'skirted', 'racingWing'].map(k => ({ id: 'ff_' + k, cat: 'fenderF', slot: 'fenderF', name: 'FRONT ' + k.toUpperCase(), make: P => fenderF(P, k) })),
  ...['arch', 'longTail', 'spatFull', 'spatHalf', 'pontoon', 'teardrop', 'cycle', 'bustle'].map(k => ({ id: 'fr_' + k, cat: 'fenderR', slot: 'fenderR', name: 'REAR ' + k.toUpperCase(), make: P => fenderR(P, k) })),
  ...['rubberAlu', 'ribbed', 'checker', 'woodSlat', 'stepPads'].map(k => ({ id: 'rb_' + k, cat: 'board', slot: 'board', name: k.toUpperCase(), make: P => board(P, k) })),
  ...['rearExposed', 'rearCover', 'dualRear', 'sideExposed', 'sideCover', 'sideMirror', 'sideStrap'].map(k => ({ id: 'sp_' + k, cat: 'spare', slot: 'spare', name: k.toUpperCase(), make: P => spare(P, k) })),
  ...['rack', 'box', 'integrated', 'beavertail', 'bustle', 'rumble'].map(k => ({ id: 'tr_' + k, cat: 'trunk', slot: 'trunk', name: k.toUpperCase(), make: P => trunk(P, k) })),
  ...Object.keys(MS).map(k => ({ id: 'ms_' + k, cat: 'mascot', slot: 'mascot', name: k.toUpperCase() + ' (V2)', make: P => mascot2(P, k) })),
];
