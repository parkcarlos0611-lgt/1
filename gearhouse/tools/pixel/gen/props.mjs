// Props at S2 (5 mm/px): engines assembled from repeated modules, lamps, grilles, materials, springs, tanks.
import { Pix, Mask, smooth, line } from '../pix.mjs';

// local canvas in mm with origin at (ox, oz) mm from left/bottom
class Cv {
  constructor(wMM, hMM, mm = 5, ox = 0, oz = 0) { this.mm = mm; this.ox = ox; this.oz = oz; this.w = Math.ceil(wMM / mm) + 4; this.h = Math.ceil(hMM / mm) + 4; this.px = new Pix(this.w, this.h); this.tag = 20; }
  X(x) { return (x + this.ox) / this.mm + 2; } Y(z) { return this.h - 2 - (z + this.oz) / this.mm; } R(v) { return v / this.mm; }
  M() { return new Mask(this.w, this.h); }
  poly(pts, sm = 0) { return this.M().poly(smooth(pts.map(([x, z, s]) => [this.X(x), this.Y(z), s]), sm)); }
  rect(x0, z0, x1, z1) { return this.M().rect(this.X(x0), this.Y(z1), this.X(x1), this.Y(z0)); }
  ell(x, z, rx, rz) { return this.M().ellipse(this.X(x), this.Y(z), this.R(rx), this.R(rz)); }
  // lit solid: top edge bright, left lit, right/bottom dark
  solid(m, ramp, { base = 2, tag, flat = false, lvFn } = {}) {
    const t = tag ?? this.tag++;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!m.get(x, y)) continue; let lv = base;
      if (!flat) { if (!m.get(x, y - 1)) lv = base + 2; else if (!m.get(x - 1, y)) lv = base + 1; else if (!m.get(x + 1, y) || !m.get(x, y + 1)) lv = base - 1; else if (!m.get(x, y - 2)) lv = base + 1; }
      if (lvFn) { const o = lvFn(x, y, lv); if (o === null) continue; lv = o; }
      this.px.set(x, y, ramp, Math.max(0, Math.min(4, lv)), t);
    }
    return t;
  }
  chrome(m, ramp, tag) { const t = tag ?? this.tag++; const bb = m.bbox(); const bands = [4, 3, 1, 2, 2, 1];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y)) { const k = (y - bb.y0) / Math.max(1, bb.y1 - bb.y0 + 1); this.px.set(x, y, ramp, bands[Math.floor(k * bands.length)], t); } return t; }
  done() { outlineAll(this.px); return this.px; }
}
export function outlineAll(px) {
  const mark = [];
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    const t = px.tag(x, y); if (!px.ramp(x, y) || t < 20) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const tn = px.tag(x + dx, y + dy); if (!px.ramp(x + dx, y + dy) || (tn < t && tn >= 20)) { mark.push(y * px.w + x); break; } }
  }
  for (const i of mark) px.l[i] = -1;
}

// ---------------- engine, side view (along crank) ----------------
// One cylinder module = bore + wall; block/head/cover are 3-slice (end caps + repeated middle).
export function engineSide(P, { layout = 'inline', cyl = 4, bore = 82, stroke = 86, head = 'ohv', cover = 'paint.enginered', intake = 'carb1' }) {
  const perBank = layout === 'V' ? cyl / 2 : cyl, pitch = bore + 14, len = perBank * pitch + (layout === 'V' ? bore / 2 : 0);
  const deck = stroke * 1.55 + 70, headH = head === 'dohc' ? 135 : head === 'sv' ? 35 : 95, coverH = head === 'sv' ? 0 : head === 'dohc' ? 75 : 60;
  const V = layout === 'V'; const top = deck + headH + coverH + (V ? 230 : 160);
  const front = 130, rear = 60, W = len + front + rear + 40;
  const c = new Cv(W, top + 230, 5, front + 20, 220);
  const iron = P.id('iron'), alu = P.id('alu'), cov = P.id(cover), chr = P.id('chrome'), blk = P.id('black'), rub = P.id('rubber');
  // oil pan (3-slice: sloped front, flat middle, deep sump at rear)
  c.solid(c.poly([[0, -60], [len, -60], [len - 10, -200], [len * 0.45, -200], [len * 0.3, -130], [20, -120]], 1), blk, { base: 1 });
  // block: end caps + repeated cylinder modules
  const blockTop = V ? deck * 0.72 : deck;
  c.solid(c.rect(0, -60, len, blockTop), iron, { base: 2 });
  for (let k = 0; k < perBank; k++) { // module: lit left web, dark right web, freeze plug
    const x0 = k * pitch + (V ? 0 : 0);
    const web = c.rect(x0 + pitch - 8, 0, x0 + pitch - 2, blockTop - 25); c.solid(web, iron, { base: 1, flat: true, tag: 19 });
    const plug = c.ell(x0 + pitch / 2, blockTop * 0.35, 16, 16); c.solid(plug, iron, { base: 3, flat: true, tag: 19, lvFn: (x, y, lv) => (y < c.Y(blockTop * 0.35) ? 3 : 1) });
  }
  // bellhousing flange (rear cap) & timing cover (front cap)
  c.solid(c.poly([[len, -120], [len + 45, -150], [len + 55, blockTop + 40], [len, blockTop]], 0), alu, { base: 2 });
  c.solid(c.poly([[0, -50], [-70, -30], [-90, blockTop * 0.6], [-40, blockTop + 10], [0, blockTop + 10]], 1), alu, { base: 2 });
  // head (per-cylinder segments, exhaust port bosses)
  const hz0 = blockTop, hz1 = blockTop + headH;
  c.solid(c.rect(-10, hz0, len + 10, hz1), V ? alu : iron, { base: 2 });
  if (head !== 'sv') for (let k = 0; k < perBank; k++) { // spark plug + boot per cylinder
    const x = k * pitch + pitch / 2 + 6; c.solid(c.rect(x - 7, hz0 + 25, x + 7, hz0 + 50), P.id('white'), { base: 2, tag: 60 });
    c.solid(c.rect(x - 5, hz0 + 50, x + 5, hz1 + 25), P.id('black'), { base: 1, tag: 61 });
  }
  // cam / valve cover: 3-slice with per-cylinder ribs; dohc = taller with two ridges
  if (coverH) {
    const cz1 = hz1 + coverH;
    const m = c.poly([[-5, hz1], [-5, cz1 - 20], [15, cz1], [len - 15, cz1], [len + 5, cz1 - 20], [len + 5, hz1]], 2);
    c.solid(m, cov, { base: 2, lvFn: (x, y, lv) => {
      const xm = (x - 2) * c.mm - c.ox; const k = ((xm % pitch) + pitch) % pitch;
      if (head === 'dohc') return Math.abs(y - c.Y(hz1 + coverH * 0.55)) < 1 ? 4 : lv;
      return k > pitch - 12 && k < pitch - 4 && lv === 2 ? 1 : k > pitch - 4 && lv === 2 ? 3 : lv; } });
    c.solid(c.rect(len * 0.42, cz1 - 2, len * 0.52, cz1 + 18), chr, { base: 3, tag: 62 }); // oil filler cap
  }
  // exhaust manifold: runner per cylinder -> log -> down-pipe (repeat + path)
  const exZ = hz0 + headH * 0.4;
  for (let k = 0; k < perBank; k++) { const x = k * pitch + pitch / 2 - 10; c.solid(c.poly([[x - 16, exZ + 10], [x + 16, exZ + 10], [x + 12, exZ - 70], [x - 12, exZ - 70]]), iron, { base: 1, tag: 70 }); }
  c.solid(c.poly([[10, exZ - 60], [len, exZ - 60], [len + 40, exZ - 110], [len + 40, -180], [len, -180], [len, exZ - 105], [10, exZ - 105]], 1), iron, { base: 1, tag: 71 });
  // intake / carb / air cleaner on top
  const iz = (coverH ? hz1 + coverH : hz1) + (V ? -10 : 10);
  if (V) { c.solid(c.poly([[30, hz1 - 20], [len - 30, hz1 - 20], [len - 80, iz + 70], [80, iz + 70]], 1), cov, { base: 2, tag: 80 });
    c.solid(c.rect(len / 2 - 50, iz + 70, len / 2 + 50, iz + 130), alu, { base: 2, tag: 81 });
    c.chrome(c.poly([[len / 2 - 190, iz + 130], [len / 2 + 190, iz + 130], [len / 2 + 175, iz + 195], [len / 2 - 175, iz + 195]], 2), chr, 82); }
  else { c.solid(c.rect(len * 0.35, iz, len * 0.55, iz + 60), alu, { base: 2, tag: 80 }); c.chrome(c.ell(len * 0.45, iz + 95, 120, 38), chr, 81); }
  // front: water pump, pulleys, belt, fan (fan blades edge-on), generator
  c.solid(c.ell(-100, blockTop * 0.22, 18, 70), blk, { base: 2, tag: 90 }); // crank pulley edge-on
  c.solid(c.ell(-40, blockTop + 60, 45, 45), P.id('black'), { base: 2, tag: 93 }); // generator end
  c.px.meta = { lenMM: Math.round(len + front + rear), heightMM: Math.round(top + 200), perBank, pitch };
  return c.done();
}

// ---------------- engine, end view: same bank slice rotated per V angle ----------------
export function engineEnd(P, { layout = 'V', vAngle = 90, bore = 98, stroke = 89, head = 'ohv', cover = 'paint.enginered' }) {
  const deck = stroke * 1.55 + 70, headH = head === 'dohc' ? 135 : 95, coverH = head === 'dohc' ? 75 : 60;
  const c = new Cv(900, 900, 5, 450, 260);
  const iron = P.id('iron'), alu = P.id('alu'), cov = P.id(cover), chr = P.id('chrome'), blk = P.id('black');
  const banks = layout === 'V' ? [-vAngle / 2, vAngle / 2] : layout === 'flat' ? [-90, 90] : [0];
  const rot = (a, pts) => { const r = a * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r); return pts.map(([w, u, s]) => [w * cs + u * sn, -w * sn + u * cs, s]); };
  const shadeByNormal = (a, base) => { const r = a * Math.PI / 180; return base + Math.round(Math.cos(r + Math.PI / 4)); };
  // crankcase + pan (shared)
  const half = layout === 'V' ? 180 + Math.sin(vAngle * Math.PI / 360) * 120 : 170;
  c.solid(c.poly([[-half, 60], [half, 60], [half - 20, -140], [half - 60, -220], [-half + 60, -220], [-half + 20, -140]], 1), iron, { base: 2 });
  c.solid(c.poly([[-half + 40, -150], [half - 40, -150], [half - 50, -240], [-half + 50, -240]], 1), blk, { base: 1 });
  for (const a of banks) {
    const bw = bore / 2 + 22;
    const slice = (u0, u1, w, sm) => c.poly(rot(a, [[-w, u0], [w, u0], [w, u1], [-w, u1]]), sm);
    c.solid(slice(40, deck, bw, 0), iron, { base: shadeByNormal(a, 2) });                      // block slice
    const bore_ = c.poly(rot(a, [[-bore / 2 + 6, deck * 0.45], [bore / 2 - 6, deck * 0.45], [bore / 2 - 6, deck - 15], [-bore / 2 + 6, deck - 15]])); c.solid(bore_, iron, { base: 1, flat: true, tag: 30 });
    c.solid(slice(deck, deck + headH, bw + 12, 0), layout === 'V' ? alu : iron, { base: shadeByNormal(a, 2) });
    c.solid(c.poly(rot(a, [[-bw + 2, deck + headH], [bw - 2, deck + headH], [bw - 14, deck + headH + coverH, 0], [-bw + 14, deck + headH + coverH, 0]]), 2), cov, { base: shadeByNormal(a, 2) });
    // exhaust manifold on the outboard side of each bank
    const out = a < 0 ? -1 : 1; if (layout !== 'inline') c.solid(c.poly(rot(a, [[out * (bw + 12), deck + 20], [out * (bw + 70), deck + 10], [out * (bw + 70), deck + 75], [out * (bw + 12), deck + 85]])), iron, { base: 1 });
  }
  if (layout === 'V') { // valley intake, carb, air cleaner
    const yv = deck * Math.cos(vAngle * Math.PI / 360) + 40;
    c.solid(c.poly([[-140, yv - 120], [140, yv - 120], [110, yv + 60], [-110, yv + 60]], 1), cov, { base: 2 });
    c.solid(c.rect(-60, yv + 60, 60, yv + 120), alu, { base: 2 });
    c.chrome(c.poly([[-200, yv + 120], [200, yv + 120], [185, yv + 190], [-185, yv + 190]], 2), chr);
  }
  // front accessory drive: crank pulley, water pump, belt (path), generator
  c.solid(c.ell(0, 0, 85, 85), blk, { base: 2, lvFn: (x, y, lv) => (Math.hypot(x - c.X(0), y - c.Y(0)) < 6 ? 4 : Math.hypot(x - c.X(0), y - c.Y(0)) < 12 ? 1 : lv) });
  c.solid(c.ell(0, 260, 55, 55), alu, { base: 2 });
  c.solid(c.ell(-230, 330, 60, 60), blk, { base: 2 });
  const belt = [[0, -85], [-85, 0], [-275, 300], [-230, 395], [0, 315], [55, 260], [85, 0]];
  if (0) for (let i = 0; i + 1 < belt.length; i++) line(c.X(belt[i][0]), c.Y(belt[i][1]), c.X(belt[i + 1][0]), c.Y(belt[i + 1][1]), (x, y) => c.px.set(x, y, P.id('rubber'), 2, 99));
  return c.done();
}

// ---------------- lamps (front view) ----------------
export function lamp(P, kind) {
  const chr = P.id('chrome'), lw = P.id('lensW');
  if (kind === 'bullet34') { const c = new Cv(240, 240, 5, 120, 120); c.solid(c.ell(0, 0, 115, 115), chr, { base: 2, lvFn: (x, y) => { const dx = x - c.X(0), dy = y - c.Y(0), d = Math.hypot(dx, dy) / c.R(115), dot = -(dx + dy) / (Math.hypot(dx, dy) || 1) * 0.707; return d > 0.82 ? (dot > 0.3 ? 4 : dot < -0.4 ? 1 : 2) : null; } });
    c.solid(c.ell(0, 0, 92, 92), lw, { base: 2, lvFn: (x, y) => { const k = Math.round(x - c.X(0)); const d = Math.hypot(x - c.X(0), y - c.Y(0)); return d < 5 ? 4 : (k % 3 === 0 ? 1 : (y < c.Y(0) ? 3 : 2)); } }); return c.done(); }
  if (kind === 'round57') { const c = new Cv(220, 220, 5, 110, 110); c.solid(c.poly([[-110, -20], [-105, 40], [-60, 100], [0, 115], [60, 100], [105, 40], [110, -20], [80, -60], [-80, -60]], 2), P.id('paint.coral'), { base: 2 });
    c.solid(c.ell(0, 0, 90, 90), chr, { base: 3, lvFn: (x, y) => (Math.hypot(x - c.X(0), y - c.Y(0)) > c.R(78) ? (y < c.Y(0) ? 4 : 1) : null) });
    c.solid(c.ell(0, 0, 76, 76), lw, { base: 2, lvFn: (x, y) => { const dx = x - c.X(-25), dy = y - c.Y(25); if (Math.hypot(dx, dy) < 4) return 4; const r = Math.hypot(x - c.X(0), y - c.Y(0)); return r % 5 < 1 ? 1 : (y < c.Y(0) ? 3 : 2); } }); return c.done(); }
  if (kind === 'rect74') { const c = new Cv(240, 170, 5, 120, 85); c.solid(c.rect(-118, -82, 118, 82), P.id('black'), { base: 1 });
    c.solid(c.rect(-100, -66, 100, 66), lw, { base: 2, lvFn: (x, y) => { const lx = x - c.X(-100), ly = y - c.Y(66); return (lx % 5 === 0 || ly % 4 === 0) ? 1 : (ly < 6 ? 3 : 2); } }); return c.done(); }
  if (kind === 'proj96') { const c = new Cv(420, 180, 5, 210, 90);
    c.solid(c.poly([[-205, -60], [190, -85], [205, 40], [120, 85], [-205, 70]], 2), P.id('glass'), { base: 3, lvFn: (x, y, lv) => ((x + y) % 11 === 0 ? 4 : lv) });
    c.solid(c.ell(-90, 5, 55, 55), chr, { base: 2, lvFn: (x, y) => { const d = Math.hypot(x - c.X(-90), y - c.Y(5)); return d < c.R(28) ? (d < 3 ? 4 : 1) : (y < c.Y(5) ? 4 : 2); } });
    c.solid(c.ell(70, 0, 60, 45), chr, { base: 3, lvFn: (x, y) => (Math.hypot(x - c.X(70), y - c.Y(0)) < c.R(25) ? 4 : (y < c.Y(0) ? 3 : 1)) });
    c.solid(c.rect(150, -55, 195, 25), P.id('lensA'), { base: 2 }); return c.done(); }
  if (kind === 'tail57') { const c = new Cv(110, 260, 5, 55, 130); c.chrome(c.poly([[-50, -125], [50, -125], [45, 125], [-40, 128]], 1), chr);
    c.solid(c.poly([[-38, -110], [38, -110], [34, 112], [-30, 114]], 1), P.id('lensR'), { base: 2, lvFn: (x, y, lv) => ((y % 4 === 0) ? 1 : lv) }); return c.done(); }
  if (kind === 'tail74') { const c = new Cv(420, 110, 5, 210, 55); c.solid(c.rect(-208, -52, 208, 52), P.id('black'), { base: 1 });
    const seg = [['lensA', -195, -85], ['lensR', -80, 120], ['lensW', 125, 195]];
    for (const [r, a, b] of seg) c.solid(c.rect(a, -40, b, 40), P.id(r), { base: 2, lvFn: (x, y, lv) => ((x % 3 === 0) ? lv - 1 : lv) }); return c.done(); }
}

// ---------------- grilles (front view): frame + pattern fill ----------------
export function grille(P, kind) {
  const chr = P.id('chrome'), blk = P.id('black');
  if (kind === 'shell34') { const c = new Cv(420, 720, 5, 210, 0);
    c.chrome(c.poly([[-200, 0], [200, 0], [205, 560], [120, 690], [0, 715], [-120, 690], [-205, 560]], 2), chr);
    const inner = c.poly([[-165, 30], [165, 30], [170, 550], [100, 650], [0, 672], [-100, 650], [-170, 550]], 2);
    c.solid(inner, blk, { base: 0, flat: true });
    c.solid(inner, chr, { base: 2, flat: true, tag: 80, lvFn: (x, y) => { const k = Math.round(x - c.X(-170)) % 3; const top = y < c.Y(560); return k === 0 ? (top ? 4 : 3) : k === 1 ? 1 : null; } });
    c.solid(c.ell(0, 620, 38, 38), P.id('brass'), { base: 2, tag: 90 }); return c.done(); }
  if (kind === 'egg57') { const c = new Cv(1300, 230, 5, 650, 0);
    c.chrome(c.poly([[-640, 0], [640, 0], [650, 200], [-650, 200]], 1), chr);
    const gi = c.poly([[-610, 22], [610, 22], [618, 178], [-618, 178]], 1); c.solid(gi, blk, { base: 0, flat: true });
    c.solid(gi, chr, { base: 2, flat: true, tag: 80, lvFn: (x, y) => { const lx = Math.round(x - c.X(-618)), ly = Math.round(y - c.Y(178)); if (ly % 6 === 0) return 3; if (ly % 6 === 1) return 1; if (lx % 6 === 0) return 2; return null; } });
    for (const s of [-1, 1]) c.chrome(c.poly([[s * 420, -40], [s * 470, -40], [s * 475, 120], [s * 445, 150], [s * 415, 120]], 2), chr); // bumper bullets
    return c.done(); }
  if (kind === 'hbar74') { const c = new Cv(1250, 170, 5, 625, 0);
    c.solid(c.rect(-620, 0, 620, 160), blk, { base: 1, flat: true, lvFn: (x, y) => ((y - c.Y(160)) % 4 === 0 ? 3 : (y - c.Y(160)) % 4 === 1 ? 2 : 0) });
    c.chrome(c.rect(-620, 150, 620, 165), chr); c.solid(c.rect(-40, 40, 40, 120), P.id('chrome'), { base: 3, tag: 90 }); return c.done(); }
}

// ---------------- painted panel swatch by material grade ----------------
export function panelSwatch(P, grade, paint = 'paint.coral') {
  const c = new Cv(700, 380, 5, 0, 0), pr = P.id(paint);
  const gap = grade === 1 ? 3 : grade === 3 ? 2 : 1; const amp = grade === 1 ? 2.2 : grade === 3 ? 1.1 : 0;
  const hlZ = 280;
  c.solid(c.rect(0, 0, 700, 380), pr, { base: 2, flat: true, lvFn: (x, y) => {
    const wob = Math.round(amp * Math.sin(x * 0.45) + (grade === 1 ? amp * 0.6 * Math.sin(x * 1.3 + 1) : 0));
    const yh = c.Y(hlZ) + wob, yd = c.Y(70) + wob;
    if (grade === 1 && ((x * 7 + y * 13) % 53 === 0)) return 1; // orange-peel speckle
    if (y === Math.round(yh)) return (grade === 1 && x % 5 === 0) ? 3 : 4;
    if (y === Math.round(yh) + 1 || y === Math.round(yh) - 1) return 3;
    if (y > yd) return 1;
    if (y < c.Y(350)) return 3;
    return 2; } });
  // shut line (door gap) with width by grade
  const gx = c.X(470); for (let y = 0; y < c.h; y++) for (let k = 0; k < gap; k++) if (c.px.ramp(Math.round(gx) + k, y)) c.px.set(Math.round(gx) + k, y, pr, k === gap - 1 && gap > 1 ? 1 : 0, 50);
  if (grade === 1) for (let z = 40; z < 380; z += 60) c.px.set(Math.round(c.X(30)), Math.round(c.Y(z)), P.id('iron'), 3, 50); // rivet heads
  if (grade === 1) for (let y = 3; y < c.h - 2; y++) for (let x = 3; x < c.w - 2; x++) { const d = Math.hypot(x - 3, c.h - 3 - y); const n = Math.sin(x * 1.7) * Math.sin(y * 2.3); if (d < 14 + 5 * n) c.px.set(x, y, P.id('brass'), d < 8 + 4 * n ? 0 : 1, 50); } // rust bloom from corner
  return c.done();
}

// ---------------- springs & tank (repeat / 3-slice demos) ----------------
export function leafSpring(P, leaves = 5, lenMM = 1200) {
  const c = new Cv(lenMM + 80, 140 + leaves * 18, 5, lenMM / 2 + 40, 20), st = P.id('iron');
  const th = 14, sag = 70, zc = x => 40 + leaves * th + sag * (2 * x / lenMM) ** 2;   // shared camber, main leaf on top
  for (let i = leaves - 1; i >= 0; i--) { const L = lenMM * (1 - i * 0.13); const pts = [];
    for (let k = 0; k <= 16; k++) { const x = -L / 2 + L * k / 16; pts.push([x, zc(x) - i * th]); }
    const poly = pts.concat(pts.slice().reverse().map(([x, z]) => [x, z - th + 3])); c.solid(c.poly(poly), st, { base: 2 }); }
  for (const s of [-1, 1]) c.solid(c.ell(s * lenMM / 2, 40 + leaves * th + sag + 10, 24, 24), P.id('rubber'), { base: 2 });
  c.solid(c.rect(-50, 30, 50, 60 + leaves * th), P.id('black'), { base: 1 }); // U-bolt clamp
  return c.done();
}
export function coilSpring(P, turns = 7, hMM = 330) {
  const c = new Cv(160, hMM + 20, 5, 80, 10), st = P.id('paint.enginered'); const pitch = hMM / turns;
  for (let k = 0; k < turns; k++) { const z = k * pitch; c.solid(c.poly([[-70, z], [-60, z - 6], [70, z + pitch * 0.5 - 6], [70, z + pitch * 0.5 + 12], [-60, z + 14]], 1), st, { base: 2 });
    c.solid(c.poly([[70, z + pitch * 0.5], [-70, z + pitch], [-70, z + pitch + 14], [70, z + pitch * 0.5 + 14]], 1), st, { base: 1 }); }
  return c.done();
}
export function fuelTank(P, litres) {
  const lenMM = 300 + litres * 7.5; const c = new Cv(lenMM + 40, 330, 5, 20, 10), st = P.id('iron');
  c.solid(c.poly([[0, 0, 1], [lenMM, 0, 1], [lenMM, 260, 1], [0, 260, 1]], 1), st, { base: 2 });
  for (let x = 80; x < lenMM - 40; x += 110) c.solid(c.rect(x, 30, x + 14, 230), st, { base: 1, flat: true, tag: 40 }); // stamped ribs (repeat)
  c.solid(c.rect(lenMM - 90, 260, lenMM - 50, 310), P.id('chrome'), { base: 3 }); // filler neck stub
  for (const x of [lenMM * 0.25, lenMM * 0.75]) c.solid(c.rect(x - 8, -5, x + 8, 270), P.id('black'), { base: 1 }); // straps
  return c.done();
}
