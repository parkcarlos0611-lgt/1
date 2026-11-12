// What the gunner sees laid over the picture in his sight: the reticle of that vehicle's sight, its
// display (if it has one) and the eyepiece itself.
//   reticles: 'gps' M1A1 GPS / Bradley ISU (broken cross, mil ticks), 'm32' M60A1 (cross with a range ladder),
//     'tpd' T-72 TPD-K1 (chevron, stadia curve, lead marks), 'tsh' T-55 / T-62 TSh2B (inverted chevrons,
//     lead marks, range scale), 'tads' helicopter sights (cross with corner brackets)
//   displays: electronic sights show their readout as LED digits (red seven-segment on a day channel, green
//     phosphor dot-matrix in a thermal or night picture) drawn at low resolution and bloomed, so they sit in the
//     picture like the real thing instead of crisp screen text. Optical sights (M60A1, T-55, T-62) have none.
//   eyepiece: a soft fall-off to black toward the edge, a faint colour fringe at the field stop and the thin
//     rim of the eyecup — not a hard black circle.
DS.SightHud = {
  // 5 x 7 dot-matrix font (rows top to bottom, 5 bits each)
  F: {
    '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31], '3': [31, 2, 4, 2, 1, 17, 14], '4': [2, 6, 10, 18, 31, 2, 2],
    '5': [31, 16, 30, 1, 1, 17, 14], '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8], '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
    A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28], E: [31, 16, 16, 30, 16, 16, 31],
    F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12],
    K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31], M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
    P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
    U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17], Y: [17, 17, 10, 4, 4, 4, 4],
    Z: [31, 1, 2, 4, 8, 16, 31], '-': [0, 0, 0, 31, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], '×': [0, 17, 10, 4, 10, 17, 0], ' ': [0, 0, 0, 0, 0, 0, 0],
    '*': [0, 21, 14, 31, 14, 21, 0], '#': [31, 31, 31, 31, 31, 31, 31],
  },
  // seven segments a…g for the LED digits
  SEG: { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '' },
  layer(W, H) {
    const c = this._c || (this._c = document.createElement('canvas')), s = 3;
    const w = Math.max(1, Math.round(W / s)), h = Math.max(1, Math.round(H / s));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); x.setTransform(1 / s, 0, 0, 1 / s, 0, 0);
    return x;
  },
  dots(x, str, cx, cy, px, align = 'center') {
    str = String(str).toUpperCase(); const adv = px * 6, w = str.length * adv - px;
    let x0 = align === 'center' ? cx - w / 2 : align === 'right' ? cx - w : cx;
    for (const ch of str) { const g = this.F[ch] || this.F[' '];
      for (let r = 0; r < 7; r++) for (let b = 0; b < 5; b++) if (g[r] >> (4 - b) & 1) x.fillRect(x0 + b * px, cy - 3.5 * px + r * px, px * 0.86, px * 0.86);
      x0 += adv; }
  },
  seven(x, str, cx, cy, h, align = 'center') {
    const w = h * 0.55, t = h * 0.13, adv = w + h * 0.22, n = str.length, tot = n * adv - h * 0.22;
    let x0 = align === 'center' ? cx - tot / 2 : align === 'right' ? cx - tot : cx;
    const y0 = cy - h / 2, m = y0 + h / 2;
    for (const ch of str) { const on = this.SEG[ch] || '';
      const S = { a: [x0 + t, y0, w - 2 * t, t], b: [x0 + w - t, y0 + t, t, h / 2 - 1.5 * t], c: [x0 + w - t, m + t / 2, t, h / 2 - 1.5 * t], d: [x0 + t, y0 + h - t, w - 2 * t, t],
        e: [x0, m + t / 2, t, h / 2 - 1.5 * t], f: [x0, y0 + t, t, h / 2 - 1.5 * t], g: [x0 + t, m - t / 2, w - 2 * t, t] };
      for (const k of on) x.fillRect(...S[k]);
      x0 += adv; }
  },
  // blooms the low-resolution layer onto the sight: a soft wide copy and the sharp-ish one
  bloom(c, W, H) {
    const L = this._c; if (!L) return;
    c.save(); c.setTransform(c.getTransform()); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45; c.drawImage(L, -2, -2, W + 4, H + 4); c.drawImage(L, 2, 1, W - 1, H - 1);
    c.globalAlpha = 1; c.drawImage(L, 0, 0, W, H);
    c.restore();
  },

  kind(v) {
    if (v.heli) return 'tads';
    const n = (v.def.sight.name || '') + v.def.id;
    if (/TPD|t72/.test(n)) return 'tpd';
    if (/TSh|t55|t62/.test(n)) return 'tsh';
    if (v.def.id === 'm60a1') return 'm32';
    return 'gps';
  },
  // the eyepiece: fall-off to the field stop, colour fringe, eyecup rim
  eyepiece(c, W, H) {
    const cx = W / 2, cy = H / 2, R = W / 2;
    let g = c.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 0.97);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.62, 'rgba(0,0,0,0.18)'); g.addColorStop(0.86, 'rgba(0,0,0,0.62)'); g.addColorStop(1, 'rgba(0,0,0,0.97)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // chromatic fringe at the field stop: warm outside, cold inside
    c.lineWidth = Math.max(1, W / 260);
    c.strokeStyle = 'rgba(255,120,60,0.16)'; c.beginPath(); c.arc(cx, cy, R * 0.905, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(80,150,255,0.13)'; c.beginPath(); c.arc(cx, cy, R * 0.89, 0, 7); c.stroke();
    // the eye a little off-centre: a crescent of shadow on one side
    g = c.createRadialGradient(cx + R * 0.06, cy + R * 0.05, R * 0.8, cx + R * 0.06, cy + R * 0.05, R * 1.02);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  },

  // the whole overlay. o: { v, W, H, mil, fld, thermal, nv, lock, ranging, lasing, ready, round, range, title }
  draw(c, o) {
    const { W, H, mil, fld } = o, cx = W / 2, cy = H / 2, kind = this.kind(o.v), elec = kind === 'gps' || kind === 'tads' || kind === 'tpd';
    this.eyepiece(c, W, H);
    // ---- reticle: thin etched lines (dark on a day picture, bright on a thermal / night one) ----
    const ink = o.thermal || o.nv ? 'rgba(225,255,225,0.9)' : kind === 'tpd' || kind === 'tsh' ? 'rgba(20,14,8,0.92)' : 'rgba(12,12,12,0.9)';
    c.save(); c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = Math.max(0.9, W / 420); c.lineCap = 'butt';
    const L = W * 0.36, ln = (a, b, d, e) => { c.moveTo(a, b); c.lineTo(d, e); };
    c.beginPath();
    if (kind === 'gps' || kind === 'tads') {
      const gap = Math.min(W * 0.05, Math.max(6, 2 * mil)), tick = fld.fov < 1.5 ? 1 : fld.fov < 5 ? 2 : fld.fov < 8 ? 5 : fld.fov < 25 ? 20 : 100;
      ln(cx - L, cy, cx - gap, cy); ln(cx + gap, cy, cx + L, cy); ln(cx, cy + gap, cx, cy + L); ln(cx, cy - gap, cx, cy - L * 0.35);
      for (let m = tick; m * mil < L; m += tick) { const d = m * mil, h = (m / tick) % 2 ? 2.5 : 5; ln(cx - d, cy - h, cx - d, cy + h); ln(cx + d, cy - h, cx + d, cy + h); ln(cx - h, cy + d, cx + h, cy + d); }
      if (kind === 'tads') { const q = W * 0.2, e = W * 0.05; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.moveTo(cx + sx * q, cy + sy * (q - e)); c.lineTo(cx + sx * q, cy + sy * q); c.lineTo(cx + sx * (q - e), cy + sy * q); } }
    } else if (kind === 'm32') {
      // M32: cross, and under the aiming point a ladder of range bars (every 2 mil) with a short lead scale
      const gap = Math.max(5, mil);
      ln(cx - L, cy, cx - gap, cy); ln(cx + gap, cy, cx + L, cy); ln(cx, cy - L * 0.4, cx, cy - gap);
      for (let k = 1; k <= 8; k++) { const y = cy + k * 2 * mil, h = k % 2 ? W * 0.025 : W * 0.04; if (y - cy > L) break; ln(cx - h, y, cx + h, y); }
      ln(cx, cy + gap, cx, cy + Math.min(L, 16 * mil));
      for (let k = 1; k <= 4; k++) { const d = k * 5 * mil; if (d > L) break; ln(cx - d, cy - 4, cx - d, cy + 4); ln(cx + d, cy - 4, cx + d, cy + 4); }
    } else if (kind === 'tpd') {
      // TPD-K1: central chevron, lead marks either side, the stadia curve (target height 2.7 m) low left
      const s = Math.max(6, 1.6 * mil); ln(cx - s, cy + s, cx, cy); ln(cx, cy, cx + s, cy + s);
      for (let k = 1; k <= 4; k++) { const d = k * 4 * mil; if (d > L) break; ln(cx - d - s * 0.5, cy + s * 0.8, cx - d, cy); ln(cx - d, cy, cx - d + s * 0.5, cy + s * 0.8); ln(cx + d - s * 0.5, cy + s * 0.8, cx + d, cy); ln(cx + d, cy, cx + d + s * 0.5, cy + s * 0.8); }
      ln(cx, cy + s * 1.6, cx, cy + L * 0.6);
      const x0 = cx - L * 0.85, y0 = cy + L * 0.45; c.moveTo(x0, y0); for (let r = 400; r <= 3000; r += 200) c.lineTo(x0 + (r - 400) / 2600 * L * 0.7, y0 - 2.7 / r * 1000 * mil);
      ln(x0, y0, x0 + L * 0.7, y0);
    } else {
      // TSh2B: three inverted chevrons (centre the aiming mark), lead marks, a vertical range scale on the left
      const s = Math.max(6, 1.5 * mil), chev = x => { ln(x - s, cy - s, x, cy); ln(x, cy, x + s, cy - s); };
      chev(cx); for (let k = 1; k <= 3; k++) { const d = k * 4 * mil; if (d > L) break; chev(cx - d); chev(cx + d); }
      const x0 = cx - L * 0.8; ln(x0, cy - L * 0.6, x0, cy + L * 0.6);
      for (let k = 0; k <= 10; k++) { const y = cy - L * 0.6 + k * L * 0.12; ln(x0, y, x0 + (k % 2 ? 4 : 8), y); }
      const y = cy - L * 0.6 + Math.min(1, Math.max(0, (o.bs || 1000) / 3000)) * L * 1.2; ln(x0 - 6, y, x0 + 12, y);
    }
    c.stroke(); c.beginPath(); c.arc(cx, cy, Math.max(1, W / 360), 0, 7); c.fill(); c.restore();
    if (!elec && !o.thermal && !o.nv) return;            // an optical sight has only its etched reticle
    // ---- the display: LED / phosphor characters in a low-resolution layer, bloomed ----
    const x = this.layer(W, H), green = o.thermal || o.nv, col = green ? 'rgb(150,255,150)' : 'rgb(255,52,30)', dim = green ? 'rgb(90,200,90)' : 'rgb(255,120,40)';
    const by = cy + L + Math.max(16, W / 20), dh = Math.max(13, W / 22), px = Math.max(1.6, W / 210);
    x.fillStyle = col;
    if (green) this.dots(x, o.range ? String(Math.round(o.range)).padStart(4, '0') : '----', cx, by, px * 1.3);
    else this.seven(x, o.range ? String(Math.round(o.range)).padStart(4, '0') : '----', cx, by, dh);
    x.fillStyle = dim;
    if (o.ready) this.dots(x, 'RDY', cx - W * 0.14, by, px, 'right');
    this.dots(x, o.round + (o.lasing ? ' *' : ''), cx + W * 0.14, by, px, 'left');
    this.dots(x, o.title, cx, cy - L - px * 6, px);
    this.bloom(c, W, H);
  },
};
