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
    // WebGL: the symbols lie on a transparent canvas over the picture, so the glow cannot add to the picture
    // under it; a second sharp copy keeps them as bright as they read when the glow was added
    if (this.overPicture) { c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.85; c.drawImage(L, 0, 0, W, H); c.globalAlpha = 1; }
    c.restore();
  },

  // drop of a round below the line it was fired along, in mils, by range: the same trajectory model the shells fly
  // (DS.Projectile over flat ground), sampled every 50 m and cached per round and muzzle velocity. The etched
  // range scales are placed from it, so a mark is where that round actually needs the gun laid for that range.
  dropMil(A, v0, R) {
    const C = this.drop || (this.drop = new Map()), key = A.name + '|' + Math.round(v0);
    let t = C.get(key);
    if (!t) {
      t = new Float32Array(101); const p = new DS.Projectile(0, 0, v0, 0, A, null), flat = { height: () => -1e9, n: 1e9, dx: 1 };
      let k = 1, px = 0, py = 0;
      while (p.alive && k <= 100 && p.t < 30) { px = p.x; py = p.y; p.step(1 / 240, flat); while (k <= 100 && p.x >= k * 50) { const f = (k * 50 - px) / ((p.x - px) || 1e-9), y = py + (p.y - py) * f; t[k] = Math.max(0, -y / (k * 50) * 1000); k++; } }
      for (; k <= 100; k++) t[k] = t[k - 1] * 1.08;
      C.set(key, t);
    }
    const u = Math.max(0, Math.min(99.999, R / 50)), i = Math.floor(u); return t[i] + (t[i + 1] - t[i]) * (u - i);
  },
  // the scale's name for a round, as etched on Soviet sights (БПС fin/discarding sabot, БР armour-piercing,
  // БК HEAT, ОФ HE, ПКТ/СГМТ the coaxial MG) or on American ones
  label(A, soviet, coax) {
    if (coax) return soviet ? coax : 'MG';
    const t = A.type; if (!soviet) return t === 'HEAT' ? 'HEAT' : t === 'HE' || t === 'HESH' ? 'HE' : 'APDS';
    return t === 'APFSDS' || t === 'APDS' ? 'БПС' : t === 'HEAT' ? 'БК' : t === 'HE' ? 'ОФ' : 'БР';
  },
  // dust and a hairline scratch on the outer window (a fixed pattern per sight size)
  dust(c, W, H) {
    let d = this._dust;
    if (!d || d.width !== Math.round(W) || d.height !== Math.round(H)) {
      d = this._dust = document.createElement('canvas'); d.width = Math.max(1, Math.round(W)); d.height = Math.max(1, Math.round(H));
      const x = d.getContext('2d'), r = DS.rng(77);
      for (let i = 0; i < 40; i++) { const px = r() * W, py = r() * H, rad = 0.4 + r() * r() * 2.6, g = x.createRadialGradient(px, py, 0, px, py, rad * 2.2);
        g.addColorStop(0, `rgba(40,34,26,${0.18 + r() * 0.2})`); g.addColorStop(1, 'rgba(40,34,26,0)'); x.fillStyle = g; x.fillRect(px - rad * 3, py - rad * 3, rad * 6, rad * 6); }
      x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 0.8; x.beginPath();
      const sx = W * (0.25 + r() * 0.2), sy = H * (0.6 + r() * 0.2); x.moveTo(sx, sy); x.quadraticCurveTo(sx + W * 0.12, sy - H * 0.05, sx + W * 0.22, sy - H * 0.16); x.stroke();
    }
    c.drawImage(d, 0, 0, W, H);
  },
  // a Soviet-style range scale: a column of marks from 200 m on (labelled every 400 m in hundreds), spaced by the
  // round's drop, over the top of the field; the setting line runs across all scales at the range set
  scaleCol(c, x0, y0, h, name, A, v0, maxR, setR, mil, k) {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y0 + this.dropMil(A, v0, maxR) * k);
    for (let r = 200; r <= maxR; r += 200) { const y = y0 + this.dropMil(A, v0, r) * k, w = r % 400 ? 3 : 6; c.moveTo(x0, y); c.lineTo(x0 + w, y); }
    c.stroke();
    c.font = `600 ${Math.max(7, h / 16).toFixed(1)}px ui-sans-serif, system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
    let yt = -1e9; const fz = Math.max(7, h / 16);
    for (let r = 400; r <= maxR; r += 400) { const y = y0 + this.dropMil(A, v0, r) * k; if (y - yt < fz) continue; yt = y; c.fillText(String(r / 100), x0 + 8, y); }
    c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(name, x0, y0 - 2);
    return setR != null ? y0 + this.dropMil(A, v0, Math.min(maxR, setR)) * k : null;
  },
  // stadiametric rangefinder for a 2.7 m tall target: the curve's height above its base line at a range is the
  // target's angular height there; labelled in hundreds of metres
  stadia(c, x0, y0, w, mil, ln) {
    c.moveTo(x0, y0 - 2.7 / 400 * 1000 * mil); for (let r = 400; r <= 3000; r += 100) c.lineTo(x0 + (r - 400) / 2600 * w, y0 - 2.7 / r * 1000 * mil);
    ln(x0, y0, x0 + w, y0);
    this._st = [];
    for (const r of [400, 800, 1200, 1600, 2000, 3000]) { const x = x0 + (r - 400) / 2600 * w; ln(x, y0, x, y0 + 3); this._st.push([x, y0 + 3, String(r / 100)]); }
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
    this.dust(c, W, H);
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
      // range lines for the round loaded (hold-over if the computer is out): every 400 m, at the drop of that round
      { const A = DS.AMMO[o.v.gun.ammo], v0 = o.v.muzzleV(A);
        let yl = cy + gap, yt = -1e9; const fsz = Math.max(7, W / 48);
        for (let r = 400; r <= 3600; r += 400) { const y = cy + this.dropMil(A, v0, r) * mil, h = r % 800 ? W * 0.022 : W * 0.04; if (y - cy > L) break;
          if (y - yl < 3) continue; yl = y; ln(cx - h, y, cx + h, y);                       // (lines closer than 3 px are left out)
          if (y - yt >= fsz) { o._m32 = o._m32 || []; o._m32.push([cx + h + 3, y, r / 100]); yt = y; } }
        o._m32lab = this.label(A, false); }
      ln(cx, cy + gap, cx, cy + Math.min(L, 16 * mil));
      for (let k = 1; k <= 4; k++) { const d = k * 5 * mil; if (d > L) break; ln(cx - d, cy - 4, cx - d, cy + 4); ln(cx + d, cy - 4, cx + d, cy + 4); }
    } else if (kind === 'tpd') {
      // TPD-K1: central chevron, lead marks either side, the stadia curve (target height 2.7 m) low left
      const s = Math.max(6, 1.6 * mil); ln(cx - s, cy + s, cx, cy); ln(cx, cy, cx + s, cy + s);
      for (let k = 1; k <= 4; k++) { const d = k * 4 * mil; if (d > L) break; ln(cx - d - s * 0.5, cy + s * 0.8, cx - d, cy); ln(cx - d, cy, cx - d + s * 0.5, cy + s * 0.8); ln(cx + d - s * 0.5, cy + s * 0.8, cx + d, cy); ln(cx + d, cy, cx + d + s * 0.5, cy + s * 0.8); }
      ln(cx, cy + s * 1.6, cx, cy + L * 0.6);
      this.stadia(c, cx - L * 0.85, cy + L * 0.45, L * 0.7, mil, ln); o._stadia = this._st;
      o._scales = true;
    } else {
      // TSh2B: three inverted chevrons (centre the aiming mark), lead marks, a vertical range scale on the left
      const s = Math.max(6, 1.5 * mil), chev = x => { ln(x - s, cy - s, x, cy); ln(x, cy, x + s, cy - s); };
      chev(cx); for (let k = 1; k <= 3; k++) { const d = k * 4 * mil; if (d > L) break; chev(cx - d); chev(cx + d); }
      this.stadia(c, cx - L * 0.85, cy + L * 0.5, L * 0.7, mil, ln); o._stadia = this._st;
      o._scales = true;
    }
    c.stroke(); c.beginPath(); c.arc(cx, cy, Math.max(1, W / 360), 0, 7); c.fill();
    const fs = Math.max(7, W / 48);
    if (o._m32) { c.font = `600 ${fs.toFixed(1)}px ui-sans-serif, system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; for (const [x, y, t] of o._m32) c.fillText(String(t), x, y); c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText(o._m32lab, cx - W * 0.05, cy + 4); }
    if (o._stadia) { c.font = `600 ${(fs * 0.85).toFixed(1)}px ui-sans-serif, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'top'; for (const [x, y, t] of o._stadia) c.fillText(t, x, y + 2); }
    // Soviet sights: a range scale per round across the top, the setting line across them at the range set
    // (laid by hand on the TSh2B; the laser range on the TPD-K1)
    if (o._scales) {
      const v = o.v, soviet = kind === 'tsh' || kind === 'tpd', list = v.def.ammo.slice(0, 3), coax = v.def.coax ? DS.AMMO[v.def.coax.ammo] : null;
      const cols = list.map(k => [this.label(DS.AMMO[k], soviet), DS.AMMO[k], v.muzzleV(DS.AMMO[k]), 4000]);
      if (coax) cols.push([this.label(coax, soviet, kind === 'tsh' ? 'СГМТ' : 'ПКТ'), coax, coax.v0, 1600]);
      const n = cols.length, span = L * 1.1, x0 = cx - span / 2, y0 = cy - L * 0.95, h = L * 0.55, setR = kind === 'tpd' ? (o.range || o.bs) : o.bs;
      // one mil axis for all the scales (as etched): flat-shooting rounds get short scales, slow ones long
      let top = 1; for (const [, A, v0, maxR] of cols) top = Math.max(top, this.dropMil(A, v0, maxR)); const k = h / top;
      c.lineWidth = Math.max(0.8, W / 520); c.fillStyle = c.strokeStyle;
      let yl = null, cur = list.indexOf(v.gun.ammo);
      cols.forEach(([name, A, v0, maxR], i) => { const y = this.scaleCol(c, x0 + i * span / Math.max(1, n - 1), y0, h, name, A, v0, maxR, setR, mil, k); if (i === Math.max(0, cur)) yl = y; });
      if (yl != null) { c.beginPath(); c.moveTo(x0 - 8, yl); c.lineTo(x0 + span + 12, yl); c.stroke(); }
    }
    c.restore();
    if (!elec) return;                                  // an optical sight (its night channel too) has only its etched reticle
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
