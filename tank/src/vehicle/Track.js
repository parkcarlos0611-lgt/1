// Track loop: built each frame from the running-gear circles (hull-local positions after suspension),
// wrapped clockwise (sprocket → top run → idler → road wheels → sprocket), bottom run pushed up by
// terrain between wheels. Links are placed by arc length with offset s (= distance the track moved).
DS.Track = {
  // circles: [{x, y, r}] in loop order, world coords, r = centreline radius.
  buildPath(circles, out, fixed) {
    // drop circles the belt would have to wrap the wrong way round (concave: a road wheel pushed up
    // above the line of its neighbours, a return roller below the top run). fixed[i] = never drop.
    let cs = circles, fx = fixed;
    for (let pass = 0; pass < 4; pass++) {
      const t = this._tangents(cs), keep = [], kf = [];
      let dropped = false;
      for (let i = 0; i < cs.length; i++) {
        const sw = this._sweep(t[(i - 1 + cs.length) % cs.length].ang, t[i].ang);
        if (sw > Math.PI * 1.2 && !(fx && fx[i])) { dropped = true; continue; }
        keep.push(cs[i]); kf.push(fx ? fx[i] : false);
      }
      cs = keep; fx = kf;
      if (!dropped) break;
    }
    return this._build(cs, out);
  },
  _sweep(a0, a1) { let s = (a0 - a1) % (Math.PI * 2); if (s < 0) s += Math.PI * 2; if (s > Math.PI * 2 - 1e-4) s = 0; return s; },
  _tangents(circles) {
    const n = circles.length, tang = [];
    for (let i = 0; i < n; i++) {
      const A = circles[i], B = circles[(i + 1) % n];
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1e-6;
      const th = Math.atan2(dy, dx), beta = Math.asin(Math.max(-1, Math.min(1, (B.r - A.r) / L)));
      const a = th + Math.PI / 2 + beta;
      tang.push({ ang: a });
    }
    return tang;
  },
  _build(circles, out) {
    const n = circles.length, tang = [];
    for (let i = 0; i < n; i++) {
      const A = circles[i], B = circles[(i + 1) % n];
      const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1e-6;
      const th = Math.atan2(dy, dx), beta = Math.asin(Math.max(-1, Math.min(1, (B.r - A.r) / L)));
      const a = th + Math.PI / 2 + beta;                         // normal pointing to the outside (left of travel)
      const mx = Math.cos(a), my = Math.sin(a);
      tang.push({ ax: A.x + A.r * mx, ay: A.y + A.r * my, bx: B.x + B.r * mx, by: B.y + B.r * my, ang: a });
    }
    out.length = 0;
    for (let i = 0; i < n; i++) {
      const C = circles[i], tin = tang[(i - 1 + n) % n], tout = tang[i];
      // arc on circle i from incoming tangent angle to outgoing, clockwise (decreasing angle)
      const a0 = tin.ang, sweep = this._sweep(tin.ang, tout.ang), steps = Math.max(1, Math.ceil(sweep / 0.2));
      for (let k = 0; k <= steps; k++) {
        const a = a0 - sweep * k / steps;
        out.push(C.x + C.r * Math.cos(a), C.y + C.r * Math.sin(a));
      }
      // straight run to next circle is implicit (next arc starts at its tangent point)
    }
    return out;
  },

  // Push bottom-run points (between road wheels) above the ground: track can't cut into terrain.
  conformBottom(pts, terrain, half, maxLift) {
    // densify straight segments longer than 0.2 m and lift them
    const res = [];
    for (let i = 0; i < pts.length; i += 2) {
      const x0 = pts[i], y0 = pts[i + 1], j = (i + 2) % pts.length, x1 = pts[j], y1 = pts[j + 1];
      res.push(x0, y0);
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (L > 0.22 && x1 < x0) {                                // bottom run travels toward -x (rearward)
        const k = Math.ceil(L / 0.15);
        for (let s = 1; s < k; s++) {
          const x = x0 + (x1 - x0) * s / k, yl = y0 + (y1 - y0) * s / k;
          const g = terrain.height(x) + half;
          res.push(x, Math.min(Math.max(yl, g), yl + maxLift));
        }
      }
    }
    return res;
  },

  // Place links: returns array of [x, y, angle] every `pitch` along the closed polyline from offset s.
  links(pts, pitch, s, out) {
    out.length = 0;
    const n = pts.length / 2;
    let total = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; total += Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]); }
    const count = Math.max(4, Math.round(total / pitch)), p = total / count;   // track stretches to fit
    let off = ((s % p) + p) % p, acc = 0, seg = 0;
    let x0 = pts[0], y0 = pts[1], j = 1, sx = pts[2], sy = pts[3], segL = Math.hypot(sx - x0, sy - y0);
    for (let k = 0; k < count; k++) {
      const target = off + k * p;
      while (acc + segL < target && seg < n) {
        acc += segL; seg++; x0 = sx; y0 = sy; j = (seg + 1) % n; sx = pts[j * 2]; sy = pts[j * 2 + 1]; segL = Math.hypot(sx - x0, sy - y0);
      }
      const f = segL > 0 ? (target - acc) / segL : 0;
      out.push([x0 + (sx - x0) * f, y0 + (sy - y0) * f, Math.atan2(sy - y0, sx - x0)]);
    }
    return { total, count, pitch: p };
  },
};
