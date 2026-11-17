// MOTORWORKS — shared helpers (global namespace)
window.MW = window.MW || { data: {}, sim: {}, render: {}, ui: {} };
(function (MW) {
  const U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  U.smooth = t => { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  U.sig = (x) => 1 / (1 + Math.exp(-x));
  U.sum = a => a.reduce((s, v) => s + v, 0);
  U.uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
  U.deep = o => JSON.parse(JSON.stringify(o));
  // seeded RNG (mulberry32) so a saved game replays identically
  U.rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // piecewise-linear table lookup: tbl = [[x,y],...] sorted by x
  U.table = (tbl, x) => {
    if (x <= tbl[0][0]) return tbl[0][1];
    for (let i = 1; i < tbl.length; i++) if (x <= tbl[i][0]) { const [x0, y0] = tbl[i - 1], [x1, y1] = tbl[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
    return tbl[tbl.length - 1][1];
  };
  U.money = (v, short = true) => {
    const s = v < 0 ? '-' : ''; v = Math.abs(v);
    if (short) {
      if (v >= 1e9) return s + '$' + (v / 1e9).toFixed(2) + 'B';
      if (v >= 1e6) return s + '$' + (v / 1e6).toFixed(2) + 'M';
      if (v >= 1e4) return s + '$' + (v / 1e3).toFixed(1) + 'K';
    }
    return s + '$' + Math.round(v).toLocaleString('en-US');
  };
  U.num = (v, d = 0) => (v == null || isNaN(v) ? '–' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
  U.pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  U.monthName = m => (m + 1) + '월';

  // Closed / open Catmull-Rom spline sampling
  U.spline = (pts, seg = 8, closed = false) => {
    const out = [], n = pts.length; if (n < 2) return pts.slice();
    const P = i => closed ? pts[(i + n) % n] : pts[U.clamp(i, 0, n - 1)];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const sharp = p1.s; // sharp corner flag: straight segment
      for (let k = 0; k < seg; k++) {
        const t = k / seg, t2 = t * t, t3 = t2 * t;
        if (sharp || p2.s) { out.push({ x: U.lerp(p1.x, p2.x, t), y: U.lerp(p1.y, p2.y, t) }); continue; }
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    if (!closed) out.push({ x: pts[n - 1].x, y: pts[n - 1].y });
    return out;
  };
  // y of a polyline (x ascending or not) at x: returns max/min crossing
  U.yAt = (poly, x, pick = 'min') => {
    let best = null;
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1];
      if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) {
        const y = a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
        if (best == null || (pick === 'min' ? y < best : y > best)) best = y;
      }
    }
    return best;
  };
  U.polyArea = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i].x * q.y - q.x * p[i].y; } return Math.abs(a / 2); };
  U.polyLen = p => { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return l; };

  // tiny DOM builder
  U.h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(9)) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  U.hex = (c, a = 1) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  U.shade = (c, f) => { const n = parseInt(c.slice(1), 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; const t = f < 0 ? 0 : 255, p = Math.abs(f); r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); };
  MW.U = U;
})(window.MW);
