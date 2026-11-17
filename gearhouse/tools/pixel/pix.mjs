// Indexed pixel canvas (ramp id + ramp level per pixel), masks, raster primitives, post passes.
export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.r = new Uint8Array(w * h); this.l = new Int8Array(w * h); this.t = new Uint8Array(w * h); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, ramp, lvl, tag = 0) { x |= 0; y |= 0; if (!this.in(x, y)) return; const i = y * this.w + x; this.r[i] = ramp; this.l[i] = lvl; this.t[i] = tag; }
  ramp(x, y) { return this.in(x, y) ? this.r[y * this.w + x] : 0; }
  lvl(x, y) { return this.l[y * this.w + x]; }
  tag(x, y) { return this.in(x, y) ? this.t[y * this.w + x] : 0; }
  clear(x, y) { if (this.in(x, y)) this.r[y * this.w + x] = 0; }
  blit(src, dx, dy, { flipX = false } = {}) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = y * src.w + x; if (!src.r[i]) continue;
      this.set(dx + (flipX ? src.w - 1 - x : x), dy + y, src.r[i], src.l[i], src.t[i]);
    }
  }
  flipped() { const p = new Pix(this.w, this.h); p.blit(this, 0, 0, { flipX: true }); return p; }
  // paint a mask: fn(x,y) -> [ramp,lvl,tag] | null
  paint(mask, fn) { for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) if (mask.a[y * mask.w + x]) { const v = fn(x, y); if (v) this.set(x, y, v[0], v[1], v[2] || 0); } }
}

export class Mask {
  constructor(w, h) { this.w = w; this.h = h; this.a = new Uint8Array(w * h); }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.a[y * this.w + x] : 0; }
  put(x, y, v = 1) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y * this.w + x] = v; }
  copy() { const m = new Mask(this.w, this.h); m.a.set(this.a); return m; }
  poly(pts, v = 1) { fillPoly(pts, (x, y) => this.put(x, y, v), this.w, this.h); return this; }
  circle(cx, cy, r, v = 1) { for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.put(x, y, v); return this; }
  ellipse(cx, cy, rx, ry, v = 1) { for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.put(x, y, v); return this; }
  rect(x0, y0, x1, y1, v = 1) { for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) this.put(x, y, v); return this; }
  sub(m) { for (let i = 0; i < this.a.length; i++) if (m.a[i]) this.a[i] = 0; return this; }
  and(m) { for (let i = 0; i < this.a.length; i++) if (!m.a[i]) this.a[i] = 0; return this; }
  or(m) { for (let i = 0; i < this.a.length; i++) if (m.a[i]) this.a[i] = 1; return this; }
  // pixel-art cleanup: drop 1px spurs, fill 1px notches
  clean(iter = 2) {
    for (let k = 0; k < iter; k++) {
      const b = this.a.slice();
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const n = this.get(x - 1, y) + this.get(x + 1, y) + this.get(x, y - 1) + this.get(x, y + 1);
        const i = y * this.w + x;
        if (this.a[i] && n <= 1) b[i] = 0; else if (!this.a[i] && n >= 3) b[i] = 1;
      }
      this.a = b;
    }
    return this;
  }
  bbox() { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.a[y * this.w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; }
}

export function fillPoly(pts, plot, W = 1e5, H = 1e5) {
  let ymin = Infinity, ymax = -Infinity; for (const p of pts) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
  for (let y = Math.max(0, Math.floor(ymin)); y <= Math.min(H - 1, Math.ceil(ymax)); y++) {
    const sy = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(x0 + (sy - y0) / (y1 - y0) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); x++) plot(x, y);
  }
}

// Chaikin corner-cutting; points [x,y,sharp?]. closed polygon by default.
export function smooth(pts, iters = 3, closed = true) {
  let p = pts.map(q => [q[0], q[1], q[2] ? 1 : 0]);
  for (let k = 0; k < iters; k++) {
    const o = []; const n = p.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = p[i], b = p[(i + 1) % n];
      if (a[2]) o.push(a); else if (!closed && i === 0) o.push(a);
      o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, 0]);
      o.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, 0]);
    }
    if (!closed) o.push(p[n - 1]);
    p = o;
  }
  return p;
}

export function line(x0, y0, x1, y1, plot) {
  if (![x0, y0, x1, y1].every(Number.isFinite)) throw new Error('line(): non-finite coordinate');
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { plot(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
export function polyline(pts, plot) { for (let i = 0; i + 1 < pts.length; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], plot); }

// mm-space view helper: x along car (from front), z up from ground.
export class View {
  constructor(lenMM, hMM, mm, pad = 2) { this.mm = mm; this.pad = pad; this.w = Math.ceil(lenMM / mm) + pad * 2; this.h = Math.ceil(hMM / mm) + pad * 2; }
  X(x) { return x / this.mm + this.pad; }
  Y(z) { return this.h - this.pad - z / this.mm; }
  P(pts) { return pts.map(([x, z, s]) => [this.X(x), this.Y(z), s]); }
  R(mm) { return mm / this.mm; }
}

// Outer selective outline: border pixels take their ramp's outline colour.
export function outline(pix, { skipRamps = [], inner = [] } = {}) {
  const W = pix.w, H = pix.h, out = [];
  const solid = (x, y) => { const r = pix.ramp(x, y); return r && !skipRamps.includes(r); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = pix.ramp(x, y); if (!r || skipRamps.includes(r)) continue;
    if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) out.push(y * W + x);
  }
  for (const i of out) pix.l[i] = -1;
  return pix;
}

// Composite a Pix into an RGBA buffer (sheet) at integer scale.
export function drawPix(sheet, pix, P, ox, oy, s = 1, { shadowA = 0.28 } = {}) {
  const shadowId = P.byName.shadow;
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) {
    const i = y * pix.w + x, r = pix.r[i]; if (!r) continue;
    const ramp = P.ramps[r]; const lv = pix.l[i];
    const c = lv < 0 ? ramp.o : ramp.c[Math.max(0, Math.min(ramp.c.length - 1, lv))];
    const a = r === shadowId ? shadowA : 1;
    for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) sheet.blend(ox + x * s + xx, oy + y * s + yy, c, a);
  }
}

export class Sheet {
  constructor(w, h, bg = [0, 0, 0]) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); this.fill(0, 0, w, h, bg); }
  blend(x, y, c, a = 1) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 4; for (let k = 0; k < 3; k++) this.d[i + k] = this.d[i + k] * (1 - a) + c[k] * a; this.d[i + 3] = 255; }
  fill(x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.blend(x, y, c, 1); }
}
