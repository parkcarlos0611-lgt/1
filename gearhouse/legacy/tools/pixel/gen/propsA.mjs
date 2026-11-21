// E1 prop batch A (84): headlamps, aux lamps, tail lamps, grilles, mascots, bumpers, wheels. S2 = 5 mm/px.
// Each entry = one parameter row -> one sprite + catalogue metadata. All shapes generic (no trademarks).
import { Pix, Mask, line } from '../pix.mjs';
import { fillet } from './geom.mjs';
import { outlineAll } from './props.mjs';
import { dith } from './car.mjs';
import { wheel } from './wheel.mjs';
import { tire } from './tire.mjs';

class Cv { // centred canvas: y lateral (or x along car for side sprites), z up; mm units
  constructor(wMM, hMM, mm = 5) { this.mm = mm; this.w = Math.ceil(wMM / mm) + 6; this.h = Math.ceil(hMM / mm) + 6; this.px = new Pix(this.w, this.h); this.tag = 20; }
  X(y) { return this.w / 2 + y / this.mm; } Y(z) { return this.h / 2 - z / this.mm; }
  M() { return new Mask(this.w, this.h); }
  poly(pts, r = 0) { return this.M().poly(fillet(pts.map(p => [p[0], p[1], p[2] ?? r]), 3).map(([y, z]) => [this.X(y), this.Y(z)])); }
  circ(y, z, r) { return this.M().circle(this.X(y), this.Y(z), r / this.mm); }
  ell(y, z, ry, rz) { return this.M().ellipse(this.X(y), this.Y(z), ry / this.mm, rz / this.mm); }
  rect(y0, z0, y1, z1, r = 0) { return this.poly([[y0, z0], [y1, z0], [y1, z1], [y0, z1]], r); }
  fill(m, ramp, fn) { const t = this.tag++, r = this.P.id(ramp); const bb = m.bbox(); const cx = (bb.x0 + bb.x1 + 1) / 2, cy = (bb.y0 + bb.y1 + 1) / 2, R = Math.max(1, (bb.x1 - bb.x0 + 1) / 2), Rz = Math.max(1, (bb.y1 - bb.y0 + 1) / 2);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (m.get(x, y)) { const dx = (x + 0.5 - cx) / R, dy = (y + 0.5 - cy) / Rz;
      const edge = !m.get(x - 1, y) || !m.get(x + 1, y) || !m.get(x, y - 1) || !m.get(x, y + 1); const lv = fn({ x, y, dx, dy, d: Math.hypot(dx, dy), edge, dot: -(dx + dy) * 0.707, m }); if (lv != null) this.px.set(x, y, r, Math.max(0, Math.min(4, lv)), t); } return this; }
  chrome(m) { return this.fill(m, 'chrome', ({ dy, dot, x, y }) => dith(x, y, 3.2 + dot * 1.4 - (dy > 0.2 && dy < 0.45 ? 1.6 : 0))); }
  dome(m, ramp, base = 2.2, k = 1.4) { return this.fill(m, ramp, ({ dot, d, x, y }) => dith(x, y, base + dot * k - d * 0.6)); }
  flat(m, ramp, lv) { return this.fill(m, ramp, ({ edge }) => edge ? lv + 1 : lv); }
  done() { outlineAll(this.px); return this.px; }
}
const ring = (c, y, z, r, th) => { const m = c.circ(y, z, r); m.sub(c.circ(y, z, r - th)); return m; };

// ---------- lamp face (front / rear view) ----------
function lampFace(P, o) {
  const D = o.d, c = new Cv(D * (o.shape === 'triple' ? 3.4 : o.shape === 'twin' ? 1.3 : 1.25) + 40, D * (o.shape === 'twin' ? 1.9 : o.visor ? 1.35 : 1.25) + 40); c.P = P;
  const one = (y, z, dd, lensRamp, pattern) => {
    const r = dd / 2;
    if (o.shape === 'teardrop' || o.shape === 'bullet') c.dome(c.circ(y, z, r * 1.08), o.shell || 'chrome', 2.4, 1.6);
    if (o.shape === 'rect') { c.chrome(c.rect(y - r * 1.1, z - r * 0.75, y + r * 1.1, z + r * 0.75, 30)); c.fill(c.rect(y - r * 0.95, z - r * 0.6, y + r * 0.95, z + r * 0.6, 20), lensRamp, ({ x, y: yy, dy }) => (x % 4 === 0 || yy % 3 === 0) ? 1 : dy < 0 ? 3 : 2); return; }
    c.fill(ring(c, y, z, r, Math.max(10, dd * (o.ringK || 0.12))), o.bezel || 'chrome', ({ dot }) => dot > 0.35 ? 4 : dot > -0.2 ? 3 : 1);
    const lens = c.circ(y, z, r - Math.max(10, dd * (o.ringK || 0.12)));
    c.fill(lens, lensRamp, ({ x, y: yy, dx, dy, d }) => {
      if (Math.hypot(dx + 0.32, dy + 0.32) < 0.16) return 4;
      if (pattern === 'fluted') return (x % 3 === 0) ? 1 : dith(x, yy, 3.2 - d * 1.8);
      if (pattern === 'prism') return ((x + yy) % 4 === 0 || (x - yy + 400) % 4 === 0) ? 1 : dith(x, yy, 3 - d * 1.4);
      if (pattern === 'rings') return (Math.round(d * 6) % 2 === 0) ? 2 : 3;
      if (pattern === 'tilt') return (yy % 3 === 0 && dy > 0) ? 1 : dith(x, yy, 3.2 - d * 1.6);
      if (pattern === 'ribbed') return (yy % 2 === 0) ? 1 : 3;
      return d < 0.22 ? 4 : dith(x, yy, 3.4 - d * 2);
    });
  };
  const lr = o.lens || 'lensW';
  if (o.shape === 'triple') { one(-D * 1.1, 0, D * 0.8, lr, o.pattern); one(0, 0, D, lr, o.pattern); one(D * 1.1, 0, D * 0.8, lr, o.pattern); }
  else if (o.shape === 'twin') { one(0, D * 0.3, D, lr, o.pattern); one(0, -D * 0.55, D * 0.45, o.lens2 || 'lensA', 'plain'); }
  else if (o.shape === 'hidden') { c.dome(c.ell(0, 0, D * 0.55, D * 0.45), o.shell || 'paint.prop', 2.2, 1.2); c.fill(c.rect(-D * 0.5, -3, D * 0.5, 3), 'black', () => 0); }
  else if (o.shape === 'oval') { c.chrome(c.ell(0, 0, D * 0.6, D * 0.42)); c.fill(c.ell(0, 0, D * 0.5, D * 0.33), lr, ({ x, y, d }) => d < 0.25 ? 4 : dith(x, y, 3.2 - d * 1.6)); }
  else if (o.shape === 'pod') { c.dome(c.ell(0, -D * 0.05, D * 0.62, D * 0.58), o.shell || 'paint.prop', 2, 1.4); one(0, 0, D * 0.82, lr, o.pattern); }
  else if (o.shape === 'heart') { c.chrome(c.poly([[0, -D * 0.55], [D * 0.55, D * 0.05], [D * 0.42, D * 0.48], [0, D * 0.3], [-D * 0.42, D * 0.48], [-D * 0.55, D * 0.05]], 40)); c.fill(c.poly([[0, -D * 0.42], [D * 0.43, D * 0.03], [D * 0.33, D * 0.36], [0, D * 0.2], [-D * 0.33, D * 0.36], [-D * 0.43, D * 0.03]], 30), lr, ({ x, y, d }) => (y % 2 ? 2 : 3)); }
  else if (o.shape === 'vertical') { c.chrome(c.rect(-D * 0.28, -D * 0.6, D * 0.28, D * 0.6, 40)); c.fill(c.rect(-D * 0.2, -D * 0.52, D * 0.2, D * 0.52, 30), lr, ({ y, dy }) => (y % 3 === 0 ? 1 : dy < 0 ? 3 : 2)); }
  else one(0, 0, D, lr, o.pattern);
  if (o.visor) c.dome(c.poly([[-D * 0.6, D * 0.4], [-D * 0.5, D * 0.62], [0, D * 0.68], [D * 0.5, D * 0.62], [D * 0.6, D * 0.4], [D * 0.45, D * 0.5], [-D * 0.45, D * 0.5]], 30), o.shell || 'chrome', 2.6, 1);
  if (o.stem) c.fill(c.rect(-14, -D * 0.6 - 60, 14, -D * 0.45), 'black', ({ edge }) => edge ? 2 : 1);
  if (o.guard) for (let k = -2; k <= 2; k++) c.fill(c.rect(k * D * 0.16 - 4, -D * 0.45, k * D * 0.16 + 4, D * 0.45), 'chrome', () => 3);
  return c.done();
}

// ---------- grille (front view) ----------
const PAT = {
  honey: (x, y) => ((x + (y % 4 < 2 ? 0 : 2)) % 4 === 0 || y % 2 === 0) ? 3 : null,
  vfine: (x) => x % 2 === 0 ? 3 : null, vbar: (x) => x % 3 === 0 ? 3 : (x % 3 === 1 ? 1 : null),
  hbar: (x, y) => y % 3 === 0 ? 3 : (y % 3 === 1 ? 1 : null), hfine: (x, y) => y % 2 === 0 ? 3 : null,
  egg: (x, y) => (x % 6 === 0 || y % 5 === 0) ? 3 : null, mesh: (x, y) => ((x + y) % 3 === 0 || (x - y + 300) % 3 === 0) ? 2 : null,
  shutter: (x, y) => y % 4 === 0 ? 4 : y % 4 === 1 ? 3 : y % 4 === 2 ? 2 : 1,
};
function grilleFace(P, o) {
  const W = o.w, Hh = o.h, c = new Cv(W + 120, Hh + 120); c.P = P;
  const outer = c.poly(o.outline(W / 2, Hh / 2), 0);
  c.chrome(outer);
  const inner = c.poly(o.outline(W / 2 - o.frame, Hh / 2 - o.frame), 0);
  const f = PAT[o.pattern]; const bb = inner.bbox();
  c.fill(inner, o.bars || 'chrome', ({ x, y }) => f(x - bb.x0, y - bb.y0));          // bars first (lower layer)
  c.fill(inner, o.backRamp || 'black', ({ x, y }) => f(x - bb.x0, y - bb.y0) == null ? 0 : null);  // dark gaps on top
  if (o.spine) c.chrome(c.rect(-o.spine, -Hh / 2 + o.frame, o.spine, Hh / 2 - o.frame));
  if (o.badge) c.chrome(c.ell(0, Hh / 2 - o.frame - 40, 45, 30));
  if (o.split) c.fill(c.rect(-o.split, -Hh / 2 - 10, o.split, Hh / 2 + 10), 'paint.prop', ({ dot }) => 2 + Math.round(dot));
  return c.done();
}
const shapes = {
  flatShell: (a, b) => [[-a, -b, 30], [a, -b, 30], [a, b - 60, 60], [a * 0.75, b, 50], [-a * 0.75, b, 50], [-a, b - 60, 60]],
  dipShell: (a, b) => [[-a, -b, 30], [a, -b, 30], [a, b - 30, 40], [a * 0.6, b, 60], [0, b - 40, 80], [-a * 0.6, b, 60], [-a, b - 30, 40]],
  vee: (a, b) => [[0, -b, 20], [a, -b * 0.7, 60], [a, b - 50, 70], [0, b, 30], [-a, b - 50, 70], [-a, -b * 0.7, 60]],
  heart: (a, b) => [[0, -b, 60], [a, -b * 0.2, 200], [a * 0.9, b * 0.7, 120], [0, b * 0.75, 40], [-a * 0.9, b * 0.7, 120], [-a, -b * 0.2, 200]],
  shield: (a, b) => [[0, -b, 40], [a * 0.55, -b * 0.75, 120], [a, -b * 0.1, 200], [a, b * 0.8, 120], [0, b, 60], [-a, b * 0.8, 120], [-a, -b * 0.1, 200], [-a * 0.55, -b * 0.75, 120]],
  waterfall: (a, b) => [[-a, -b, 30], [a, -b, 30], [a, b * 0.4, 200], [a * 0.5, b, 160], [-a * 0.5, b, 160], [-a, b * 0.4, 200]],
  prow: (a, b) => [[-a, -b, 40], [a, -b, 40], [a * 0.8, -b * 0.2, 160], [a * 0.25, b * 0.9, 60], [0, b, 30], [-a * 0.25, b * 0.9, 60], [-a * 0.8, -b * 0.2, 160]],
  rect: (a, b) => [[-a, -b, 30], [a, -b, 30], [a, b, 30], [-a, b, 30]],
  gothic: (a, b) => [[-a, -b, 20], [a, -b, 20], [a, b * 0.3, 100], [0, b, 20], [-a, b * 0.3, 100]],
  oval: (a, b) => Array.from({ length: 24 }, (_, k) => [Math.cos(k / 24 * Math.PI * 2) * a, Math.sin(k / 24 * Math.PI * 2) * b, 0]),
};

// ---------- mascot (side view) ----------
const MASC = {
  cap: [[-30, 0], [30, 0], [26, 40], [-26, 40]],
  motometer: [[-30, 0], [30, 0], [30, 30], [42, 60], [30, 110], [-30, 110], [-42, 60], [-30, 30]],
  wingcap: [[-30, 0], [30, 0], [26, 35], [80, 70], [10, 50], [-60, 80], [-26, 35]],
  eagle: [[-20, 0], [20, 0], [15, 40], [90, 110], [40, 70], [30, 90], [0, 60], [-30, 90], [-40, 70], [-90, 110], [-15, 40]],
  arrow: [[-40, 0], [40, 0], [30, 25], [120, 40], [30, 55], [-60, 50], [-30, 25]],
  swan: [[-30, 0], [30, 0], [60, 30], [20, 40], [10, 110], [40, 130], [0, 130], [-10, 50], [-60, 40]],
  hound: [[-30, 0], [30, 0], [25, 20], [110, 55], [90, 70], [20, 55], [-50, 65], [-80, 50], [-25, 22]],
  rocket: [[-25, 0], [25, 0], [20, 20], [100, 45], [20, 70], [-50, 70], [-60, 55], [-40, 45], [-60, 35], [-20, 20]],
  propeller: [[-15, 0], [15, 0], [10, 50], [70, 90], [60, 100], [5, 62], [-60, 100], [-70, 90], [-10, 50]],
  figure: [[-25, 0], [25, 0], [20, 30], [60, 60], [20, 70], [15, 120], [-5, 125], [-10, 70], [-70, 75], [-20, 30]],
};
function mascot(P, kind) { const c = new Cv(260, 160, 2.5); c.P = P; c.chrome(c.poly(MASC[kind].map(([y, z]) => [y, z - 60]), 6)); c.flat(c.rect(-40, -70, 40, -60), 'chrome', 2); return c.done(); }

// ---------- bumper (front view, half mirrored) ----------
function bumperFace(P, o) {
  const c = new Cv(o.w + 80, 360, 6); c.P = P; const a = o.w / 2;
  const bar = (z, h, curl = 0, dip = 0) => c.chrome(c.poly([[-a, z - h / 2, h / 2], [-a * 0.15, z - h / 2 - dip, 20], [0, z - h / 2 - dip * 1.3, 0], [a * 0.15, z - h / 2 - dip, 20], [a, z - h / 2, h / 2], [a + curl, z, h / 2], [a, z + h / 2, h / 2], [a * 0.15, z + h / 2 - dip, 20], [0, z + h / 2 - dip * 1.3, 0], [-a * 0.15, z + h / 2 - dip, 20], [-a, z + h / 2, h / 2], [-a - curl, z, h / 2]]));
  if (o.kind === 'twin') { bar(40, 44, 20); bar(-50, 44, 20); for (const y of [-a * 0.55, 0, a * 0.55]) c.chrome(c.rect(y - 22, -75, y + 22, 65, 6)); }
  if (o.kind === 'triple') { bar(70, 30, 15); bar(0, 30, 15); bar(-70, 30, 15); for (const y of [-a * 0.6, a * 0.6]) c.chrome(c.rect(y - 18, -90, y + 18, 90, 6)); }
  if (o.kind === 'heavy') bar(0, 90, 30, 30);
  if (o.kind === 'overriders') { bar(0, 70, 25); for (const y of [-a * 0.45, a * 0.45]) c.chrome(c.rect(y - 22, -110, y + 22, 130, 14)); }
  if (o.kind === 'blade') bar(0, 80, 45, -20);
  if (o.kind === 'split') { bar(0, 70, 25, 45); c.chrome(c.rect(-30, -120, 30, 60, 10)); }
  if (o.kind === 'bumperettes') { for (const s of [-1, 1]) c.chrome(c.poly([[s * a * 0.35, -30, 30], [s * a, -30, 30], [s * (a + 20), 0, 30], [s * a, 30, 30], [s * a * 0.35, 30, 30]])); }
  if (o.kind === 'tube') { bar(0, 50, 10); for (const y of [-a * 0.7, a * 0.7]) c.flat(c.rect(y - 15, -120, y + 15, -25), 'black', 1); }
  if (o.kind === 'nerf') for (const s of [-1, 1]) c.chrome(c.poly([[s * a * 0.55, -20, 20], [s * a, -20, 20], [s * a, 20, 20], [s * a * 0.55, 20, 20]]));
  if (o.kind === 'channel') { c.fill(c.rect(-a, -60, a, 60, 6), 'black', ({ dy }) => dy < -0.6 ? 3 : dy > 0.6 ? 0 : 1); for (const y of [-a * 0.8, a * 0.8]) c.flat(c.rect(y - 10, -20, y + 10, 20), 'iron', 3); }
  return c.done();
}

// ---------- catalogue rows ----------
const L = (id, name, years, tags, o) => ({ id, cat: 'headlamp', slot: 'headlamp', name, years, tags, make: P => lampFace(P, o) });
export const CATALOG = [
  L('hl_drum9_nickel', 'DRUM 9IN NICKEL FLUTED', [1928, 1931], ['economy'], { d: 230, bezel: 'brass', pattern: 'fluted', stem: 1 }),
  L('hl_drum9_chrome', 'DRUM 9IN CHROME', [1930, 1933], ['economy'], { d: 230, pattern: 'plain', stem: 1 }),
  L('hl_drum10_prism', 'DRUM 10IN PRISM', [1930, 1934], ['luxury'], { d: 255, pattern: 'prism', stem: 1, ringK: 0.14 }),
  L('hl_bullet8_tilt', 'BULLET 8IN TILT-RAY', [1932, 1935], ['sport'], { d: 205, shape: 'bullet', pattern: 'tilt' }),
  L('hl_bullet10_body', 'BULLET 10IN BODY SHELL', [1934, 1936], ['family'], { d: 250, shape: 'bullet', shell: 'paint.prop', pattern: 'fluted' }),
  L('hl_tear_chrome', 'TEARDROP CHROME', [1933, 1936], ['streamline'], { d: 220, shape: 'teardrop', pattern: 'rings' }),
  L('hl_tear_body', 'TEARDROP BODY COLOUR', [1935, 1937], ['family'], { d: 220, shape: 'teardrop', shell: 'paint.prop', pattern: 'plain' }),
  L('hl_pod_round', 'FENDER POD ROUND', [1935, 1938], ['family', 'streamline'], { d: 200, shape: 'pod', pattern: 'fluted' }),
  L('hl_flush_oval', 'FENDER-FLUSH OVAL', [1937, 1939], ['streamline'], { d: 240, shape: 'oval' }),
  L('hl_tourer12', 'TOURER 12IN WITH VISOR', [1928, 1933], ['luxury', 'sport'], { d: 305, pattern: 'fluted', visor: 1, ringK: 0.1, stem: 1 }),
  L('hl_hidden', 'HIDDEN CRANK-UP (CLOSED)', [1936, 1937], ['streamline'], { d: 230, shape: 'hidden' }),
  L('hl_nose_flush', 'NOSE-FLUSH ROUND', [1934, 1937], ['streamline'], { d: 190, pattern: 'rings', ringK: 0.18 }),
  L('hl_twin_park', 'LAMP + PARKING LAMP', [1934, 1936], ['family', 'luxury'], { d: 220, shape: 'twin', pattern: 'prism' }),
  L('hl_triple', 'TRIPLE CLUSTER', [1935, 1937], ['luxury'], { d: 170, shape: 'triple', pattern: 'plain' }),
  ...[
    ['ax_fog_clear', 'FOG LAMP CLEAR 6IN', { d: 155, pattern: 'fluted', stem: 1 }], ['ax_fog_amber', 'FOG LAMP AMBER 6IN', { d: 155, lens: 'lensA', pattern: 'fluted', stem: 1 }],
    ['ax_driving', 'DRIVING LAMP 7IN', { d: 180, pattern: 'plain', stem: 1, ringK: 0.16 }], ['ax_spot', 'SPOTLIGHT (PILLAR)', { d: 150, shape: 'bullet', pattern: 'plain' }],
    ['ax_twin_fog', 'TWIN FOG BAR', { d: 120, shape: 'triple', pattern: 'fluted', lens: 'lensA' }], ['ax_cowl', 'COWL LAMP', { d: 90, shape: 'bullet', pattern: 'plain' }],
    ['ax_park_bullet', 'PARKING BULLET', { d: 80, shape: 'teardrop', lens: 'lensA', pattern: 'plain' }], ['ax_guard_fog', 'FOG WITH STONE GUARD', { d: 160, pattern: 'plain', guard: 1, stem: 1 }],
  ].map(([id, name, o]) => ({ id, cat: 'auxlamp', slot: 'auxlamp', name, years: [1930, 1939], tags: ['accessory'], make: P => lampFace(P, o) })),
  ...[
    ['tl_round_single', 'ROUND SINGLE', { d: 110, lens: 'lensR', pattern: 'plain', stem: 1 }], ['tl_round_stop', 'ROUND STOP/TAIL', { d: 120, shape: 'twin', lens: 'lensR', lens2: 'lensR', pattern: 'rings' }],
    ['tl_tear_chrome', 'TEARDROP CHROME', { d: 110, shape: 'teardrop', lens: 'lensR', pattern: 'rings' }], ['tl_tear_body', 'TEARDROP BODY', { d: 110, shape: 'teardrop', shell: 'paint.prop', lens: 'lensR' }],
    ['tl_heart', 'HEART', { d: 130, shape: 'heart', lens: 'lensR' }], ['tl_oval_fender', 'OVAL FENDER', { d: 160, shape: 'oval', lens: 'lensR' }],
    ['tl_plate_combo', 'PLATE COMBO RECT', { d: 150, shape: 'rect', lens: 'lensR' }], ['tl_vertical', 'VERTICAL BULLET', { d: 150, shape: 'vertical', lens: 'lensR' }],
    ['tl_beehive', 'BEEHIVE RIBBED', { d: 120, lens: 'lensR', pattern: 'ribbed', ringK: 0.16 }], ['tl_double_bar', 'DOUBLE ON BAR', { d: 90, shape: 'triple', lens: 'lensR', pattern: 'plain' }],
    ['tl_flush_vert', 'FENDER FLUSH VERTICAL', { d: 180, shape: 'vertical', lens: 'lensR' }], ['tl_torpedo', 'STREAMLINE TORPEDO', { d: 100, shape: 'bullet', lens: 'lensR', pattern: 'tilt' }],
  ].map(([id, name, o]) => ({ id, cat: 'taillamp', slot: 'taillamp', name, years: [1930, 1939], tags: [], make: P => lampFace(P, o) })),
  ...[
    ['gr_flat_honey', 'FLAT SHELL HONEYCOMB', [1928, 1931], 'flatShell', 'honey', 520, 700, {}], ['gr_dip_vfine', 'DIP SHELL FINE BARS', [1930, 1931], 'dipShell', 'vfine', 530, 690, { spine: 8 }],
    ['gr_tall_mesh', 'TALL SHELL STONE MESH', [1928, 1933], 'flatShell', 'mesh', 600, 900, { badge: 1 }], ['gr_vee_slat', 'V SHELL SLATS', [1932, 1934], 'vee', 'vbar', 560, 820, { spine: 10 }],
    ['gr_vee_shutter', 'V SHELL SHUTTERS', [1930, 1933], 'vee', 'shutter', 600, 900, { bars: 'chrome' }], ['gr_heart', 'HEART', [1933, 1935], 'heart', 'vbar', 600, 760, { spine: 8 }],
    ['gr_shield_h', 'SHIELD HORIZONTAL', [1934, 1935], 'shield', 'hbar', 520, 860, { spine: 10 }], ['gr_waterfall', 'WATERFALL', [1934, 1937], 'waterfall', 'vbar', 440, 680, {}],
    ['gr_prow_h', 'PROW V HORIZONTAL', [1936, 1938], 'prow', 'hbar', 460, 800, {}], ['gr_harp', 'WIDE HARP', [1935, 1936], 'flatShell', 'vbar', 760, 640, { spine: 10 }],
    ['gr_egg_rect', 'EGG-CRATE RECT', [1937, 1937], 'rect', 'egg', 800, 420, {}], ['gr_split_twin', 'SPLIT TWIN SIDE', [1938, 1939], 'rect', 'hfine', 820, 360, { split: 120 }],
    ['gr_louvre_wrap', 'LOUVRE WRAP NOSE', [1936, 1937], 'rect', 'hbar', 900, 340, { backRamp: 'paint.prop', bars: 'chrome' }], ['gr_gothic', 'GOTHIC ARCH', [1934, 1936], 'gothic', 'vbar', 500, 760, {}],
    ['gr_oval_mesh', 'WIDE OVAL MESH', [1938, 1939], 'oval', 'mesh', 760, 420, {}], ['gr_flat_hbar', 'FLAT HORIZONTAL BARS', [1936, 1937], 'flatShell', 'hbar', 620, 620, {}],
  ].map(([id, name, years, sh, pat, w, h, o]) => ({ id, cat: 'grille', slot: 'grille', name, years, tags: [], make: P => grilleFace(P, { w, h, outline: shapes[sh], pattern: pat, frame: 40, ...o }) })),
  ...['cap', 'motometer', 'wingcap', 'eagle', 'arrow', 'swan', 'hound', 'rocket', 'propeller', 'figure'].map(k => ({ id: 'ms_' + k, cat: 'mascot', slot: 'mascot', name: k.toUpperCase(), years: [1928, 1939], tags: ['decor'], make: P => mascot(P, k) })),
  ...[['bp_twin', 'TWIN BAR + CLAMPS', 'twin', 1780], ['bp_triple', 'TRIPLE BAR', 'triple', 1720], ['bp_heavy_dip', 'HEAVY CENTRE DIP', 'heavy', 1840], ['bp_overriders', 'SINGLE + OVERRIDERS', 'overriders', 1800],
    ['bp_blade', 'CURVED BLADE', 'blade', 1820], ['bp_split', 'SPLIT + GUARD', 'split', 1800], ['bp_bumperettes', 'REAR BUMPERETTES', 'bumperettes', 1700], ['bp_tube', 'TUBE BAR', 'tube', 1650],
    ['bp_nerf', 'SPORTS NERF', 'nerf', 1500], ['bp_channel', 'COMMERCIAL CHANNEL', 'channel', 1900]].map(([id, name, kind, w]) => ({ id, cat: 'bumper', slot: 'bumper', name, years: [1928, 1939], tags: [], make: P => bumperFace(P, { kind, w }) })),
  ...[['wh_wire32', 'WIRE 32', '4.75-19', { style: 'wire', spokes: 32 }], ['wh_wire40', 'WIRE 40', '5.25-18', { style: 'wire', spokes: 40 }], ['wh_wire48ww', 'WIRE 48 WHITEWALL', '6.50-20', { style: 'wire', spokes: 48, whitewall: 0.22 }],
    ['wh_art10', 'WOOD ARTILLERY 10', '4.75-19', { style: 'artillery', spokes: 10, paint: 'paint.prop' }], ['wh_art12', 'WOOD ARTILLERY 12', '5.50-17', { style: 'artillery', spokes: 12, paint: 'paint.prop' }],
    ['wh_disc', 'STEEL DISC PLAIN', '5.50-17', { style: 'disc', paint: 'paint.prop' }], ['wh_discperf', 'STEEL DISC PERFORATED', '6.00-16', { style: 'discperf', paint: 'paint.prop' }],
    ['wh_steel_cap', 'STEEL + SMALL CAP', '6.00-16', { style: 'steel', paint: 'paint.prop' }], ['wh_fullcap', 'FULL CHROME CAP', '6.50-16', { style: 'hubcap', whitewall: 0.3 }],
    ['wh_trimring', 'STEEL + TRIM RING', '6.00-16', { style: 'trimring', paint: 'paint.prop', whitewall: 0.25 }], ['wh_cover', 'FULL WHEEL COVER', '7.00-16', { style: 'hubcap', whitewall: 0.45 }],
    ['wh_steelspoke', 'STEEL SPOKE', '5.25-18', { style: 'steelspoke', spokes: 10, paint: 'paint.prop' }], ['wh_spinner', 'KNOCK-OFF WIRE', '5.50-18', { style: 'spinner', spokes: 48 }],
    ['wh_truck', 'TRUCK DEMOUNTABLE', '6.00-20', { style: 'truck', paint: 'black' }]].map(([id, name, code, o]) => ({ id, cat: 'wheel', slot: 'wheel', name: name + ' ' + code, years: [1928, 1939], tags: [], tire: code,
    make: P => { const T = tire(code); return wheel(P, { ...o, r: T.r / 5, tireFrac: T.frac }); } })),
];
