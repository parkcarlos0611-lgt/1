// E1 prop batch B2 (104). Generic forms only (no trademarks / no lettering).
import { Canvas } from './canvas.mjs';
import { dith } from './car.mjs';
import { wheel } from './wheel.mjs';
import { tire } from './tire.mjs';
const cv = (P, w, h, mm, o) => new Canvas(P, w, h, mm, o);
const panel = (c, w, h, ramp = 'paint.prop') => c.vgrad(c.rect(-w / 2, -h / 2, w / 2, h / 2), ramp, 3, 1.6);

// ---- windshields (front view, 12.5 mm/px) ----
function windshield(P, o) {
  const c = cv(P, 1400, 700, 10), W = 600, H = o.h || 260;
  const frameR = o.frame === 'chrome' ? 'chrome' : o.frame === 'black' ? 'black' : 'paint.prop';
  const pane = (x0, x1, z0, z1, tilt = 0) => { const outer = c.rect(x0 - 24, z0 - 24, x1 + 24, z1 + 24, o.r || 20); frameR === 'chrome' ? c.chrome(outer) : c.vgrad(outer, frameR, 3, 1.4);
    c.fill(c.rect(x0, z0 + tilt, x1, z1, Math.max(0, (o.r || 20) - 15)), 'glass', ({ x, y, ty }) => ty < 0.08 ? 1 : dith(x, y, 3 - 3.2 * ty)); if (tilt) c.flat(c.rect(x0, z0, x1, z0 + tilt), 'black', 0); };
  if (o.kind === 'single') pane(-W, W, -H, H, o.open ? 70 : 0);
  if (o.kind === 'split') { pane(-W, -15, -H, H); pane(15, W, -H, H); }
  if (o.kind === 'vee') { c.chrome(c.poly([[-W - 20, -H - 20], [0, -H - 50], [W + 20, -H - 20], [W + 20, H + 20], [0, H - 10], [-W - 20, H + 20]], 20)); for (const s of [-1, 1]) c.fill(c.poly([[s * 14, -H - 25], [s * W, -H], [s * W, H], [s * 14, H - 25]], 10), 'glass', ({ x, y, ty }) => dith(x, y, 3 - 3 * ty)); }
  if (o.kind === 'aero') for (const s of [-1, 1]) { c.chrome(c.rect(s * 300 - 160, -60, s * 300 + 160, 140, 60)); c.fill(c.rect(s * 300 - 140, -40, s * 300 + 140, 120, 50), 'glass', ({ x, y, ty }) => dith(x, y, 3.2 - 2.6 * ty)); c.flat(c.rect(s * 300 - 15, -160, s * 300 + 15, -60), 'chrome', 2); }
  if (o.kind === 'racing') { c.chrome(c.rect(-W * 0.7, -100, W * 0.7, 120, 80)); c.fill(c.rect(-W * 0.65, -80, W * 0.65, 100, 70), 'glass', ({ x, y, ty }) => dith(x, y, 3 - 2.8 * ty)); }
  if (o.wiper) c.fill(c.band([[-W * 0.6, H - 10], [-W * 0.2, -H * 0.4]], 14), 'black', () => 1);
  return c.done();
}
// ---- visors (side view) ----
function visor(P, k) { const c = cv(P, 500, 300, 5, { centre: false });
  c.vgrad(c.rect(0, 0, 60, 200), 'paint.prop', 3, 1.5);                                        // roof stub reference
  if (k === 'flat') c.vgrad(c.poly([[60, 170], [320, 150], [330, 165], [60, 200]], 10), 'paint.prop', 3.4, 1.2);
  if (k === 'curved') c.vgrad(c.poly([[60, 120], [200, 140], [300, 110], [310, 125], [210, 165], [60, 200]], 40), 'paint.prop', 3.4, 1.2);
  if (k === 'glass') { c.chrome(c.rect(60, 165, 330, 180, 4)); c.fill(c.poly([[60, 165], [330, 150], [330, 165], [60, 180]]), 'lensA', () => 2); }
  if (k === 'stub') c.vgrad(c.poly([[60, 175], [160, 168], [165, 180], [60, 200]], 6), 'paint.prop', 3.4, 1.2);
  return c.done(); }
// ---- roofs (plan view) ----
function roof(P, k) { const c = cv(P, 1900, 1200, 12.5); const shell = c.rect(-900, -560, 900, 560, 260);
  const body = k === 'turret' || k === 'sunshine' || k === 'opera';
  c.dome(shell, body ? 'paint.prop' : (k === 'canvasDown' ? 'paint.prop' : 'canvas'), 2.4, 1.1);
  if (k === 'insert') { c.dome(shell, 'paint.prop', 2.4, 1.1); c.fill(c.rect(-600, -380, 650, 380, 120), 'canvas', ({ x, y, d }) => (y % 4 === 0 ? 1 : dith(x, y, 2.4 - d))); }
  if (k === 'landau' || k === 'softUp' || k === 'leatherette') for (let xx = -700; xx <= 700; xx += 280) c.fill(c.rect(xx - 10, -540, xx + 10, 540), 'canvas', () => 1);
  if (k === 'landau') c.fill(c.rect(-900, -560, -380, 560, 200), 'black', ({ d }) => 1);
  if (k === 'canvasDown') c.fill(c.rect(-900, -520, -500, 520, 120), 'canvas', ({ x }) => (x % 3 === 0 ? 1 : 2));
  if (k === 'sunshine') { c.fill(c.rect(-300, -320, 300, 320, 40), 'canvas', () => 1); c.chrome(c.rect(-320, -330, -300, 330)); }
  if (k === 'opera') { c.fill(c.rect(300, -560, 900, 560, 200), 'black', () => 1); }
  if (k === 'leatherette') c.fill(shell, 'canvas', ({ x, y }) => ((x * 7 + y * 13) % 17 === 0 ? 1 : null));
  return c.done(); }
// ---- hood vents (side panel 650 x 380) ----
function hoodVent(P, k) { const c = cv(P, 700, 420, 5); panel(c, 650, 380);
  const slot = (x0, z0, x1, z1) => { c.flat(c.rect(x0, z0, x1, z1, 4), 'black', 0); c.fill(c.rect(x1, z0, x1 + 5, z1), 'paint.prop', () => 4); };
  if (k === 'vShort') for (let x = -260; x < 270; x += 28) slot(x, -60, x + 8, 100);
  if (k === 'vLong') for (let x = -270; x < 280; x += 24) slot(x, -150, x + 7, 150);
  if (k === 'vGroups') for (const g of [-200, 0, 200]) for (let x = g - 60; x <= g + 60; x += 24) slot(x, -120, x + 7, 120);
  if (k === 'horizontal') for (let z = -140; z < 150; z += 30) slot(-250, z, 250, z + 10);
  if (k === 'doors3' || k === 'doors5' || k === 'doors7') { const n = +k.slice(-1); for (let i = 0; i < n; i++) { const x = -260 + i * (520 / (n - 1)); c.flat(c.rect(x - 27, -135, x + 27, 135, 10), 'black', 0); c.vgrad(c.rect(x - 22, -130, x + 22, 130, 8), 'paint.prop', 3.8, 1.6); c.chrome(c.rect(x - 8, -10, x + 8, 10, 3)); } }
  if (k === 'speedlines') for (const z of [-60, 0, 60]) c.chrome(c.rect(-280, z - 6, 260, z + 6, 6));
  if (k === 'wrap') for (let i = 0; i < 7; i++) c.chrome(c.rect(-300 + i * 30, 120 - i * 38, 300, 128 - i * 38, 3));
  if (k === 'mesh') { c.chrome(c.rect(-230, -120, 230, 120, 20)); c.fill(c.rect(-215, -105, 215, 105, 16), 'black', ({ x, y }) => ((x + y) % 3 === 0 ? 3 : 0)); }
  if (k === 'chromeBars') for (let x = -240; x <= 240; x += 40) c.chrome(c.rect(x - 7, -110, x + 7, 110, 6));
  if (k === 'angled') for (let x = -260; x < 260; x += 30) c.fill(c.band([[x, -110], [x + 60, 110]], 9), 'black', () => 0);
  return c.done(); }
// ---- cowl vents (top view) ----
function cowlVent(P, k) { const c = cv(P, 500, 300, 2.5); panel(c, 480, 260);
  if (k === 'flapClosed') { c.flat(c.rect(-185, -55, 185, 55, 22), 'black', 0); c.vgrad(c.rect(-180, -50, 180, 50, 20), 'paint.prop', 3.6, 1.8); c.chrome(c.rect(-30, -60, 30, -48, 4)); }
  if (k === 'flapOpen') { c.flat(c.rect(-180, -50, 180, 50, 20), 'black', 0); c.vgrad(c.rect(-180, 40, 180, 90, 20), 'paint.prop', 3.8, 2); }
  if (k === 'louvred') for (let z = -60; z <= 60; z += 20) { c.flat(c.rect(-170, z - 5, 170, z + 3, 4), 'black', 0); }
  if (k === 'scoop') { c.dome(c.ell(0, 0, 150, 70), 'paint.prop', 2.6, 1.4); c.flat(c.ell(0, -40, 110, 20), 'black', 0); }
  return c.done(); }
// ---- trims (300 mm segment on a body panel) ----
function trim(P, k) { const c = cv(P, 640, 260, 2.5); panel(c, 620, 240);
  const chromeBar = (x0, x1, z, h, tail = 0) => { c.chrome(c.poly([[x0, z - h / 2, h / 2], [x1, z - h / 2 + tail * 0.4, h / 3], [x1 + tail, z, 2], [x1, z + h / 2 - tail * 0.4, h / 3], [x0, z + h / 2, h / 2]])); c.fill(c.rect(x0 + 8, z - h / 2 - 8, x1, z - h / 2), 'paint.prop', () => 0); };
  if (k === 'bead') { c.vgrad(c.rect(-300, -14, 300, 14, 12), 'paint.prop', 4, 1); }
  if (k === 'pinstripe') { c.fill(c.rect(-300, 18, 300, 22), 'brass', () => 3); c.fill(c.rect(-300, -2, 300, 2), 'brass', () => 3); }
  if (k === 'spear') chromeBar(-300, 200, 0, 22, 90);
  if (k === 'spearTail') { chromeBar(-300, 120, 20, 20, 0); c.chrome(c.poly([[120, 10], [260, -40], [280, -30], [130, 30]], 6)); }
  if (k === 'twoTone') { c.vgrad(c.rect(-310, 0, 310, 120), 'black', 2.8, 1.2); chromeBar(-300, 300, 0, 14, 0); }
  if (k === 'rocker') { chromeBar(-300, 300, -90, 36, 0); }
  if (k === 'fenderBead') c.chrome(c.band([[-300, -60], [-100, 20], [150, 60], [300, 70]], 12));
  if (k === 'hoodCentre') { c.chrome(c.rect(-300, -8, 300, 8, 6)); for (let x = -260; x < 300; x += 120) c.chrome(c.ell(x, 0, 14, 12)); }
  return c.done(); }
// ---- door handles (side view, 2.5 mm/px) ----
function handle(P, k) { const c = cv(P, 260, 140, 2.5); panel(c, 240, 120);
  if (k === 'tHandle') { c.chrome(c.ell(-60, 0, 22, 22)); c.chrome(c.poly([[-60, -8], [90, -14], [100, 0], [90, 14], [-60, 8]], 8)); }
  if (k === 'lever') { c.chrome(c.ell(-70, 0, 20, 20)); c.chrome(c.poly([[-70, -6], [80, -26], [90, -14], [-60, 10]], 6)); }
  if (k === 'pushButton') { c.chrome(c.poly([[-90, -16], [90, -16], [100, 0], [90, 16], [-90, 16]], 14)); c.dome(c.circ(70, 0, 12), 'chrome', 3, 1); }
  if (k === 'flap') { c.flat(c.rect(-80, -30, 80, 30, 12), 'black', 0); c.chrome(c.rect(-70, -10, 70, 24, 10)); }
  if (k === 'recessed') { c.vgrad(c.rect(-90, -26, 90, 26, 20), 'black', 1.6, 0.2); c.chrome(c.rect(-60, -8, 60, 8, 6)); }
  return c.done(); }
// ---- mirrors (side view) ----
function mirror(P, k) { const c = cv(P, 360, 420, 2.5);
  const head = (x, z, rx, rz) => { c.chrome(c.ell(x, z, rx, rz)); c.fill(c.ell(x, z, rx - 10, rz - 10), 'glass', ({ x: xx, y, dot }) => dith(xx, y, 2.4 + dot * 1.4)); };
  if (k === 'spare') { c.chrome(c.band([[0, -170], [0, 60]], 18)); head(0, 110, 70, 55); }
  if (k === 'fender') { c.chrome(c.band([[0, -170], [-20, 0], [10, 90]], 14)); head(10, 130, 60, 50); }
  if (k === 'door') { c.chrome(c.band([[-60, -60], [40, 40]], 14)); head(70, 80, 70, 45); }
  if (k === 'cowl') { c.chrome(c.band([[0, -140], [30, 40]], 16)); head(40, 100, 90, 45); }
  if (k === 'pillarClamp') { c.chrome(c.rect(-120, -170, -80, 160, 10)); c.chrome(c.band([[-80, 60], [40, 90]], 12)); head(80, 100, 55, 40); }
  if (k === 'oblong') { c.chrome(c.band([[0, -160], [0, 40]], 18)); head(0, 90, 130, 45); }
  return c.done(); }
// ---- horns ----
function horn(P, k) { const c = cv(P, 520, 360, 2.5);
  const trumpet = (z, L) => { c.chrome(c.poly([[-200, z - 14], [L - 230, z - 22], [L - 200, z - 70], [L - 180, z - 70], [L - 180, z + 70], [L - 200, z + 70], [L - 230, z + 22], [-200, z + 14]], 10)); c.flat(c.ell(L - 182, z, 10, 64), 'black', 0); };
  if (k === 'twinTrumpet') { trumpet(60, 420); trumpet(-70, 380); }
  if (k === 'single') trumpet(0, 400);
  if (k === 'disc') { c.dome(c.circ(0, 0, 130), 'black', 2.4, 1.4); c.chrome(c.circ(0, 0, 70)); c.fill(c.circ(0, 0, 50), 'black', ({ x, y }) => ((x + y) % 3 === 0 ? 2 : 1)); }
  if (k === 'grillePlate') { c.chrome(c.rect(-150, -100, 150, 100, 30)); c.fill(c.rect(-130, -80, 130, 80, 20), 'black', ({ y }) => (y % 3 === 0 ? 2 : 0)); }
  return c.done(); }
// ---- wipers (front view on glass) ----
function wiper(P, k) { const c = cv(P, 600, 300, 2.5); c.fill(c.rect(-280, -130, 280, 130, 10), 'glass', ({ x, y, ty }) => dith(x, y, 3 - 3 * ty));
  if (k === 'topVacuum') { c.flat(c.rect(-60, 110, 60, 145, 8), 'black', 1); c.fill(c.band([[0, 120], [-160, -80]], 10), 'black', () => 1); c.fill(c.band([[-200, -40], [-120, -120]], 16), 'rubber', () => 2); }
  if (k === 'twinBottom') for (const s of [-1, 1]) { c.chrome(c.circ(s * 150, -125, 14)); c.fill(c.band([[s * 150, -125], [s * 40, 80]], 10), 'black', () => 1); c.fill(c.band([[s * 70, 10], [s * 10, 150]], 14), 'rubber', () => 2); }
  if (k === 'chromeArm') { c.chrome(c.circ(-200, -125, 16)); c.chrome(c.band([[-200, -125], [100, 60]], 12)); c.fill(c.band([[40, -10], [160, 130]], 16), 'rubber', () => 2); }
  return c.done(); }
// ---- licence plate brackets (generic, digits are random blocks) ----
function plate(P, k) { const c = cv(P, 520, 300, 2.5);
  const pl = (w, h, ramp = 'white') => { c.chrome(c.rect(-w / 2 - 10, -h / 2 - 10, w / 2 + 10, h / 2 + 10, 12)); c.fill(c.rect(-w / 2, -h / 2, w / 2, h / 2, 8), ramp, ({ x, y, tx, ty }) => ((ty > 0.3 && ty < 0.7 && Math.floor(tx * 12) % 2 === 0 && tx > 0.1 && tx < 0.9) ? 0 : 3)); };
  if (k === 'rearLamp') { pl(380, 160); c.chrome(c.ell(0, 120, 60, 26)); c.fill(c.ell(0, 120, 40, 14), 'lensR', () => 2); }
  if (k === 'frontBar') { c.chrome(c.rect(-240, -10, 240, 10)); pl(380, 140, 'lensA'); }
  if (k === 'stopCombo') { pl(360, 150); c.chrome(c.rect(-180, 90, 180, 130, 16)); c.fill(c.rect(-160, 98, 160, 122, 10), 'lensR', () => 2); }
  if (k === 'roundFrame') pl(400, 170, 'black');
  return c.done(); }
// ---- step plates (plan view) ----
function stepPlate(P, k) { const c = cv(P, 420, 220, 2.5);
  if (k === 'aluTread') c.fill(c.rect(-200, -90, 200, 90, 14), 'alu', ({ x, y }) => ((x + y) % 6 < 2 || (x - y + 600) % 6 < 2 ? 4 : 2));
  if (k === 'rubberPad') { c.chrome(c.rect(-200, -90, 200, 90, 14)); c.fill(c.rect(-180, -70, 180, 70, 10), 'rubber', ({ x }) => (x % 3 === 0 ? 2 : 1)); }
  if (k === 'chromeStep') c.chrome(c.rect(-200, -90, 200, 90, 30));
  return c.done(); }
// ---- emblems (generic enamel badges) ----
function emblem(P, k) { const c = cv(P, 260, 200, 1.5);
  const S = { shield: [[0, -80, 10], [70, -40, 30], [70, 60, 10], [-70, 60, 10], [-70, -40, 30]], diamond: [[0, -80], [80, 0], [0, 80], [-80, 0]], triangle: [[0, -75], [85, 70], [-85, 70]],
    hexagon: Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3) * 80, Math.sin(i * Math.PI / 3) * 70]), oval: Array.from({ length: 20 }, (_, i) => [Math.cos(i / 20 * 6.283) * 95, Math.sin(i / 20 * 6.283) * 55]) };
  const enamel = (pts, ramp) => { c.chrome(c.poly(pts.map(([x, z, r]) => [x * 1.12, z * 1.12, r]), 6)); c.fill(c.poly(pts, 6), ramp, ({ x, y, ty }) => dith(x, y, 3 - 1.6 * ty)); };
  if (k === 'shieldChevron') { enamel(S.shield, 'lensR'); c.chrome(c.band([[-50, 30], [0, -10], [50, 30]], 12)); }
  if (k === 'wingedCircle') { for (const s of [-1, 1]) c.chrome(c.poly([[s * 30, -10], [s * 120, -40], [s * 110, -20], [s * 125, -10], [s * 105, 5], [s * 30, 20]], 6)); enamel(Array.from({ length: 18 }, (_, i) => [Math.cos(i / 18 * 6.283) * 40, Math.sin(i / 18 * 6.283) * 40]), 'glass'); }
  if (k === 'laurel') { for (let i = 0; i < 7; i++) for (const s of [-1, 1]) c.chrome(c.ell(s * (60 - i * 4), 50 - i * 18, 14, 7)); enamel(S.oval.map(([x, z]) => [x * 0.45, z * 0.6]), 'lensR'); }
  if (k === 'crownCrest') { enamel(S.shield, 'glass'); c.chrome(c.poly([[-50, 62], [-30, 98], [-10, 72], [10, 98], [30, 72], [50, 98], [50, 62]], 3)); }
  if (k === 'diamond') enamel(S.diamond, 'lensA');
  if (k === 'ovalBars') { enamel(S.oval, 'glass'); for (const z of [-20, 0, 20]) c.chrome(c.rect(-70, z - 5, 70, z + 5, 3)); }
  if (k === 'triangle') enamel(S.triangle, 'lensR');
  if (k === 'hexagon') enamel(S.hexagon, 'black');
  if (k === 'torch') { enamel(S.oval, 'glass'); c.chrome(c.poly([[-10, -40], [10, -40], [16, 10], [-16, 10]], 4)); c.fill(c.poly([[-16, 10], [0, 50], [16, 10]], 6), 'lensA', () => 3); }
  if (k === 'starburst') { enamel(Array.from({ length: 16 }, (_, i) => [Math.cos(i / 16 * 6.283) * (i % 2 ? 40 : 85), Math.sin(i / 16 * 6.283) * (i % 2 ? 40 : 85)]), 'lensA'); }
  return c.done(); }
// ---- side exhaust pipes (flexible, outside the hood) ----
function sidePipe(P, n) { const c = cv(P, 700, 700, 5); c.vgrad(c.rect(-330, -330, 330, 330), 'paint.prop', 3, 1.6);
  for (let i = 0; i < n; i++) { const x0 = -200 + i * (n > 1 ? 400 / (n - 1) : 0) * 0.6; const m = c.band([[x0, 200], [x0 + 60, 0], [x0 + 220, -300]], 50); c.fill(m, 'chrome', ({ x, y, d }) => ((x + y) % 3 === 0 ? 1 : dith(x, y, 3.4 - d))); }
  return c.done(); }
// ---- panel materials ----
function material(P, k) { const c = cv(P, 600, 300, 2.5); const m = c.rect(-290, -140, 290, 140);
  const base = { woodSteel: 'paint.prop', thinSteel: 'paint.prop', thickSteel: 'paint.prop', alu: 'alu', fabric: 'canvas', polished: 'chrome' }[k];
  c.fill(m, base, ({ x, y, ty }) => { let v = 3.1 - 1.8 * ty;
    if (k === 'thinSteel') v += 0.7 * Math.sin(x * 0.35) * (ty > 0.2 && ty < 0.5 ? 1 : 0.3);
    if (k === 'woodSteel' && x % 40 === 0) v -= 1.5;
    if (k === 'fabric') v += ((x + y) % 2) * 0.6 - 0.3 + (x % 30 === 0 ? -1.2 : 0);
    if (k === 'alu') v += ((x * 3 + y) % 7 === 0 ? 0.8 : 0);
    if (k === 'polished') v = ty < 0.3 ? 4 : ty < 0.45 ? 1 : 2.4;
    return dith(x, y, v); });
  if (k === 'woodSteel') for (let x = -270; x < 290; x += 90) c.flat(c.circ(x, 120, 5), 'iron', 3);
  return c.done(); }
// ---- hubcaps (front of wheel) ----
function hubcap(P, k) { const c = cv(P, 260, 260, 1.5);
  if (k === 'naveSmall') { c.dome(c.circ(0, 0, 55), 'chrome', 2.8, 1.6); }
  if (k === 'dome') { c.dome(c.circ(0, 0, 110), 'chrome', 2.6, 1.6); c.flat(c.circ(0, 0, 14), 'black', 0); }
  if (k === 'flatRing') { c.chrome(c.circ(0, 0, 110)); c.fill(c.circ(0, 0, 80), 'paint.prop', ({ x, y, dot }) => dith(x, y, 2.6 + dot)); c.dome(c.circ(0, 0, 30), 'chrome', 3, 1); }
  if (k === 'hexKnockoff') { c.chrome(c.poly(Array.from({ length: 6 }, (_, i) => [Math.cos(i * 1.047) * 80, Math.sin(i * 1.047) * 80]), 6)); c.chrome(c.band([[-120, 0], [120, 0]], 26)); }
  if (k === 'artillery') { c.dome(c.circ(0, 0, 70), 'brass', 2.8, 1.4); c.fill(c.circ(0, 0, 20), 'black', () => 1); }
  if (k === 'ribbedDisc') c.fill(c.circ(0, 0, 120), 'chrome', ({ x, y, d, dot }) => (Math.round(d * 9) % 2 ? dith(x, y, 3 + dot) : 1));
  return c.done(); }
// ---- tyres (side view, wheel hidden by plain disc) ----
function tyre(P, k) { const T = tire(k === 'racing' ? '5.50-18' : '6.00-16');
  const opt = { blackwall: {}, wideWW: { whitewall: 0.45 }, narrowWW: { whitewall: 0.16 }, racing: {}, mudSnow: {}, doubleStripe: { whitewall: 0.12 } }[k];
  const px = wheel(P, { r: T.r / 10, tireFrac: T.frac, style: 'disc', paint: 'black', ...opt });
  if (k === 'mudSnow' || k === 'racing') { const cx = px.w / 2, R = T.r / 10; for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cx); if (d > R - 2 && d <= R && (Math.floor(Math.atan2(y - cx, x - cx) * R / (k === 'racing' ? 1.4 : 2.2)) % 2 === 0)) px.r[y * px.w + x] = 0; } }
  if (k === 'doubleStripe') { const cx = px.w / 2, R = T.r / 10, ri = R * (1 - T.frac); for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) { const t = (Math.hypot(x + 0.5 - cx, y + 0.5 - cx) - ri) / (R - ri); if (t > 0.36 && t < 0.46) { px.r[y * px.w + x] = P.id('white'); px.l[y * px.w + x] = 3; } } }
  return px; }
// ---- bumper guards (front view) ----
function guard(P, k) { const c = cv(P, 240, 400, 2.5);
  if (k === 'overrider') c.chrome(c.rect(-30, -170, 30, 170, 26));
  if (k === 'bullet') { c.chrome(c.rect(-24, -170, 24, 40, 20)); c.dome(c.ell(0, 90, 50, 70), 'chrome', 3, 1.5); }
  if (k === 'twinPost') for (const s of [-1, 1]) c.chrome(c.rect(s * 60 - 18, -170, s * 60 + 18, 170, 16));
  if (k === 'grilleGuard') { for (const s of [-1, 1]) c.chrome(c.rect(s * 80 - 14, -170, s * 80 + 14, 170, 10)); for (const z of [-60, 60, 150]) c.chrome(c.rect(-94, z - 10, 94, z + 10, 8)); }
  return c.done(); }

const rows = (cat, slot, list, fn) => list.map(([k, name]) => ({ id: slot.slice(0, 3) + '_' + k, cat, slot, name: name.toUpperCase(), make: P => fn(P, k) }));
export const CATALOG_B2 = [
  ...[['single', 'flat single'], ['singleOpen', 'crank-open'], ['split', 'split two-pane'], ['vee', 'v split'], ['aero', 'twin aero screens'], ['racing', 'racing screen'], ['chrome', 'chrome framed'], ['round', 'rounded corners']]
    .map(([k, name]) => ({ id: 'ws_' + k, cat: 'windshield', slot: 'windshield', name: name.toUpperCase(), make: P => windshield(P, { single: { kind: 'single', wiper: 1 }, singleOpen: { kind: 'single', open: 1 }, split: { kind: 'split', wiper: 1 }, vee: { kind: 'vee' }, aero: { kind: 'aero' }, racing: { kind: 'racing' }, chrome: { kind: 'single', frame: 'chrome', wiper: 1 }, round: { kind: 'split', r: 90, frame: 'black' } }[k]) })),
  ...rows('visor', 'visor', [['flat', 'flat steel'], ['curved', 'curved integral'], ['glass', 'tinted glass'], ['stub', 'stub peak']], visor),
  ...rows('roof', 'roof', [['insert', 'steel + fabric insert'], ['landau', 'landau canvas'], ['softUp', 'soft top up'], ['canvasDown', 'soft top folded'], ['turret', 'steel turret top'], ['opera', 'opera blind quarter'], ['leatherette', 'leatherette'], ['sunshine', 'sliding sunshine roof']], roof),
  ...rows('hoodVent', 'hoodVent', [['vShort', 'vertical short'], ['vLong', 'vertical long'], ['vGroups', 'vertical 3 groups'], ['horizontal', 'horizontal'], ['doors3', 'vent doors 3'], ['doors5', 'vent doors 5'], ['doors7', 'vent doors 7'], ['speedlines', 'chrome speedlines'], ['wrap', 'wrap louvres'], ['mesh', 'mesh panel'], ['chromeBars', 'chrome bars'], ['angled', 'angled louvres']], hoodVent),
  ...rows('cowlVent', 'cowlVent', [['flapClosed', 'flap closed'], ['flapOpen', 'flap open'], ['louvred', 'louvred'], ['scoop', 'scoop']], cowlVent),
  ...rows('trim', 'trim', [['bead', 'belt bead'], ['pinstripe', 'double pinstripe'], ['spear', 'chrome spear'], ['spearTail', 'spear with tail'], ['twoTone', 'two-tone divider'], ['rocker', 'rocker moulding'], ['fenderBead', 'fender bead'], ['hoodCentre', 'hood centre strip']], trim),
  ...rows('handle', 'handle', [['tHandle', 't-handle'], ['lever', 'lever'], ['pushButton', 'push button'], ['flap', 'pull flap'], ['recessed', 'recessed']], handle),
  ...rows('mirror', 'mirror', [['spare', 'spare-wheel mirror'], ['fender', 'fender mirror'], ['door', 'door mirror'], ['cowl', 'cowl mirror'], ['pillarClamp', 'pillar clamp'], ['oblong', 'oblong']], mirror),
  ...rows('horn', 'horn', [['twinTrumpet', 'twin trumpets'], ['single', 'single trumpet'], ['disc', 'disc horn'], ['grillePlate', 'grille plate']], horn),
  ...rows('wiper', 'wiper', [['topVacuum', 'top vacuum'], ['twinBottom', 'twin bottom'], ['chromeArm', 'chrome arm']], wiper),
  ...rows('plate', 'plate', [['rearLamp', 'rear + lamp'], ['frontBar', 'front bar'], ['stopCombo', 'stop combo'], ['roundFrame', 'round frame']], plate),
  ...rows('step', 'step', [['aluTread', 'alu tread'], ['rubberPad', 'rubber pad'], ['chromeStep', 'chrome step']], stepPlate),
  ...rows('emblem', 'emblem', [['shieldChevron', 'shield chevron'], ['wingedCircle', 'winged circle'], ['laurel', 'laurel'], ['crownCrest', 'crown crest'], ['diamond', 'diamond'], ['ovalBars', 'oval bars'], ['triangle', 'triangle'], ['hexagon', 'hexagon'], ['torch', 'torch'], ['starburst', 'starburst']], emblem),
  ...[[1, 'single flex'], [3, 'triple flex'], [4, 'quad flex']].map(([n, name]) => ({ id: 'sxp_' + n, cat: 'sidePipe', slot: 'sidePipe', name: name.toUpperCase(), make: P => sidePipe(P, n) })),
  ...rows('panel', 'panel', [['woodSteel', 'wood frame + steel'], ['thinSteel', 'thin steel'], ['thickSteel', 'thick steel'], ['alu', 'hand-formed alu'], ['fabric', 'fabric body'], ['polished', 'polished alu']], material),
  ...rows('hubcap', 'hubcap', [['naveSmall', 'small nave'], ['dome', 'dome'], ['flatRing', 'flat + ring'], ['hexKnockoff', 'knock-off'], ['artillery', 'artillery cap'], ['ribbedDisc', 'ribbed disc']], hubcap),
  ...rows('tyre', 'tyre', [['blackwall', 'blackwall'], ['wideWW', 'wide whitewall'], ['narrowWW', 'narrow whitewall'], ['racing', 'racing tread'], ['mudSnow', 'mud & snow'], ['doubleStripe', 'double stripe']], tyre),
  ...rows('guard', 'guard', [['overrider', 'overrider'], ['bullet', 'bullet guard'], ['twinPost', 'twin post'], ['grilleGuard', 'grille guard']], guard),
];
