// Light on the buildings through the day and night (driven by the clock, src/world/Sky.js):
//   - day: relief — the faces of the drawing turned toward the sun (edges where the wall steps out on that
//     side: window reveals, balconies, piers) catch warm light, those turned away darken a little; strongest
//     when the sun is low and to one side, nothing at noon. Masks come from the drawing itself, so the light
//     never reaches past a building's outline.
//   - night: windows (the drawing's dark glass, found once per image and grouped into panes) light up in
//     warm, cold-white and television-blue tones, a share of them by the hour (about 40 % at 21:00, 8 % before
//     dawn), each building its own pattern; blown-out bays, crushed floors and wrecked buildings go dark,
//     burning floors glow red. Street lamps light up at dusk with a pool of light on the road; a blackout
//     (env.blackout, set per mission) puts out all of them.
// All night light is drawn after the darkness overlay (Renderer.atmosphere), so it stays bright.
Object.assign(DS.Renderer.prototype, {
  // ---- per-image analysis (cached) ----
  lightInfo(key, im) {
    const C = this._lightInfo || (this._lightInfo = new Map());
    if (C.has(key)) return C.get(key);
    let info = null;
    try {
      const w = im.width, h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, w, h).data;
      const L = new Float32Array(w * h), A = new Uint8Array(w * h);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) { A[j] = d[i + 3]; L[j] = (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10; }
      // relief masks: a pixel is a west-facing face (lit by a western sun) where the wall steps out to its left
      // (darker or empty two pixels to the left); east-facing the other way
      const mk = (dir, col, k) => {
        const out = new ImageData(w, h), o = out.data, s = Math.max(2, Math.round(w / 260));
        for (let y = 0; y < h; y++) for (let X = s; X < w - s; X++) {
          const j = y * w + X; if (A[j] < 160) continue;
          const n = j - dir * s, step = A[n] < 100 ? 60 : L[j] - L[n];
          if (step < 14) continue;
          const a = Math.min(1, (step - 14) / 45) * k;
          for (let t = 0; t < s * 2 && X + dir * t >= 0 && X + dir * t < w; t++) { const q = (j + dir * t) * 4; if (A[j + dir * t] < 160) break; o[q] = col[0]; o[q + 1] = col[1]; o[q + 2] = col[2]; o[q + 3] = Math.max(o[q + 3], 255 * a * (1 - t / (s * 2))); }
        }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').putImageData(out, 0, 0); return cv;
      };
      // glass: dark blue-grey panes (the same test the broken-glass version uses)
      const G = new Uint8Array(w * h);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) if (A[j] > 128 && L[j] < 120 && d[i + 2] >= d[i] - 12) G[j] = 1;
      // panes: connected glass on a 3 px grid
      const g = 3, gw = Math.ceil(w / g), gh = Math.ceil(h / g), cell = new Uint8Array(gw * gh);
      for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) if (G[y * w + X]) cell[((y / g) | 0) * gw + ((X / g) | 0)]++;
      const lab = new Int32Array(gw * gh).fill(-1), panes = [];
      for (let i = 0; i < gw * gh; i++) {
        if (cell[i] < 3 || lab[i] >= 0) continue;
        const st = [i], b = [1e9, 1e9, -1, -1]; lab[i] = panes.length; let n = 0;
        while (st.length) { const k = st.pop(), cx = k % gw, cy = (k / gw) | 0; n++; b[0] = Math.min(b[0], cx); b[1] = Math.min(b[1], cy); b[2] = Math.max(b[2], cx); b[3] = Math.max(b[3], cy);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy, q = ny * gw + nx; if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && lab[q] < 0 && cell[q] >= 3) { lab[q] = panes.length; st.push(q); } } }
        // a pane is a compact, mostly filled rectangle of glass, not a long shadow or a dark doorway band
        const bw = b[2] - b[0] + 1, bh = b[3] - b[1] + 1, fillR = n / (bw * bh), area = bw * bh * g * g;
        if (n >= 4 && fillR > 0.55 && bw <= bh * 4 && bh <= bw * 5 && area < w * h * 0.012) panes.push([b[0] * g, b[1] * g, (b[2] + 1) * g, (b[3] + 1) * g]);
      }
      // the glass in three light colours
      const glass = col => { const o = new ImageData(w, h), od = o.data; for (let j = 0; j < w * h; j++) if (G[j]) { const q = j * 4, v = 0.6 + 0.4 * (1 - L[j] / 120); od[q] = col[0] * v; od[q + 1] = col[1] * v; od[q + 2] = col[2] * v; od[q + 3] = 255; }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').putImageData(o, 0, 0); return cv; };
      info = { w, h, im, westLit: mk(1, [255, 226, 180], 0.9), eastLit: mk(-1, [255, 226, 180], 0.9), westDark: mk(1, [24, 18, 12], 0.8), eastDark: mk(-1, [24, 18, 12], 0.8),
        panes, glass: [glass([255, 190, 100]), glass([225, 225, 205]), glass([135, 180, 245])], lit: new Map() };
    } catch (e) { info = null; }                  // a page opened from disk cannot read its own pixels: no extra light
    C.set(key, info); return info;
  },
  // which panes are lit for a building variant at share s (quantised), as one canvas
  litPanes(key, info, variant, s) {
    const q = Math.round(s * 40) / 40, id = variant + ':' + q; if (info.lit.has(id)) return info.lit.get(id);
    const H = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    const c = document.createElement('canvas'); c.width = info.w; c.height = info.h; const x = c.getContext('2d');
    // each lit window is airbrushed like the street lamps: a soft glow filling the pane and a wide faint halo
    // bleeding onto the wall round it (kept inside the building's outline below), no hard pane edges
    const COLS = [[255, 186, 96], [236, 232, 206], [140, 182, 250]];
    const blob = (cx, cy, rx, ry, c, a) => { x.save(); x.translate(cx, cy); x.scale(1, ry / rx);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(0.45, `rgba(${c},${a * 0.6})`); g.addColorStop(1, `rgba(${c},0)`);
      x.fillStyle = g; x.fillRect(-rx, -rx, rx * 2, rx * 2); x.restore(); };
    x.globalCompositeOperation = 'lighter';
    info.panes.forEach((p, i) => { const u = H(i * 13.7 + variant * 101.3); if (u >= q) return;
      const t = H(i * 3.1 + variant * 7.7), c = COLS[t < 0.62 ? 0 : t < 0.9 ? 1 : 2].join(','), cx = (p[0] + p[2]) / 2, cy = (p[1] + p[3]) / 2, pw = p[2] - p[0], ph = p[3] - p[1];
      blob(cx, cy, pw * 0.75, ph * 0.72, c, 0.8);
      blob(cx, cy + ph * 0.05, pw * 1.7, ph * 1.4, c, 0.16); });
    x.globalCompositeOperation = 'destination-in'; x.drawImage(info.im, 0, 0);
    if (info.lit.size > 60) info.lit.clear();
    info.lit.set(id, c); return c;
  },
  // ---- day: relief on one drawn building (call right after drawing it, same transform: image box at x0,y0,w,h) ----
  relief(ctx, key, im, x0, y0, w, h, flip) {
    const env = this.w.env || {}, sun = env.sun; if (!sun || sun.el <= 0 || env.visibility) return;
    const side = Math.abs(sun.ex) * Math.min(1, sun.el / 4) * (1 - (env.night || 0)) * (0.55 + 0.45 * (env.low || 0)); if (side < 0.06) return;
    const info = this.lightInfo(key, im); if (!info) return;
    const west = (sun.ex < 0) !== (flip === -1);             // the sun on the west (left): west faces lit
    ctx.save(); ctx.globalAlpha = 0.55 * side; ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(west ? info.westLit : info.eastLit, x0, y0, w, h);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.5 * side;
    ctx.drawImage(west ? info.eastDark : info.westDark, x0, y0, w, h);
    ctx.restore();
  },
  // ---- night ----
  nightLights(ctx, cam) {
    // (ctx is swapped for the light layer below)
    const env = this.w.env || {}, k = Math.max(0, Math.min(1, ((env.dark || env.night || 0) - 0.15) / 0.5)); if (k <= 0 || env.blackout) { this._litList = null; return; }
    const share = env.clock != null ? DS.Sky.windowShare(env.clock) : 0.3, T = this.w.terrain;
    // everything goes into a half-resolution layer; the vehicles (in front of the buildings) are cut out of it,
    // then it is added onto the picture
    const main = ctx, m = main.getTransform(), cv = main.canvas, lw = Math.ceil(cv.width / 2), lh = Math.ceil(cv.height / 2);
    const lay = this._lightLayer || (this._lightLayer = document.createElement('canvas'));
    if (lay.width !== lw || lay.height !== lh) { lay.width = lw; lay.height = lh; }
    ctx = lay.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.clearRect(0, 0, lw, lh);
    ctx.setTransform(m.a / 2, m.b / 2, m.c / 2, m.d / 2, m.e / 2, m.f / 2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // Drawn back to front: before each building's own lights go in, its silhouette erases whatever light from
    // farther back lies behind it, so no window or lamp shows through a nearer building.
    const cut = (im, x, y, w, h, f, ox = 0) => { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 1; ctx.translate(x, y); ctx.scale(f === -1 ? -1 : 1, -1); ctx.drawImage(im, -w / 2, -h * ox, w, h); ctx.restore(); };
    const list = this._litList || [], back = list.filter(L => L.z > 0), front = list.filter(L => !(L.z > 0));
    const rowsPass = items => { for (const L of items) {
      if (!L.lamp) cut(L.im, L.x, L.y, L.w, L.h, L.f, 0.985);
      if (L.lamp) {
        const hx = L.x + L.hx, hy = L.y + L.hy, r = 0.9 * L.s, g1 = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 3);
        g1.addColorStop(0, 'rgba(255,240,200,1)'); g1.addColorStop(0.25, 'rgba(255,205,125,0.45)'); g1.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.globalAlpha = k * (1 - L.haze); ctx.fillStyle = g1; ctx.fillRect(hx - r * 3, hy - r * 3, r * 6, r * 6);
        // the pool of light on the ground under it (and on whatever stands there)
        const gy = L.y, R = 4.2 * L.s, g2 = ctx.createRadialGradient(hx, gy, 0, hx, gy, R);
        g2.addColorStop(0, 'rgba(255,214,150,0.42)'); g2.addColorStop(1, 'rgba(255,200,130,0)');
        ctx.save(); ctx.translate(hx, gy); ctx.scale(1, 0.55); ctx.translate(-hx, -gy); ctx.fillStyle = g2; ctx.fillRect(hx - R, gy - R, R * 2, R * 2); ctx.restore();
        continue;
      }
      const info = this.lightInfo(L.key, L.im); if (!info || !info.panes.length) continue;
      const lit = this.litPanes(L.key, info, L.variant, share);
      ctx.globalAlpha = Math.min(1, k * 1.1 * (1 - L.haze * 0.5));
      ctx.save(); ctx.translate(L.x, L.y); ctx.scale(L.f === -1 ? -1 : 1, -1); ctx.drawImage(lit, -L.w / 2, -L.h * 0.985, L.w, L.h); ctx.restore();
    }
    };
    rowsPass(back);
    // buildings on the drive line (in front of the rows behind it)
    for (const b of this.w.buildings) {
      if (!b.D || b.state === 'rubble' || b.x + b.w + 20 < cam.left || b.x - b.w - 20 > cam.right) continue;
      const im = this.cityImg[b.k]; if (!im) continue;
      cut((b.touched && b.face) || im, b.x, b.base, b.w, b.h, 1, 1);
      const info = this.lightInfo('city:' + b.k, im); if (!info || !info.panes.length) continue;
      // power: a building that has lost a quarter of its bays is dark
      let ex = 0, ok = 0; for (const c of b.cells) if (c.ex) { ex++; if (c.st === 'ok' && !c.chunk) ok++; }
      const power = Math.max(0, Math.min(1, (ok / ex - 0.75) * 4)); if (power > 0) {
        let lit = this.litPanes('city:' + b.k, info, Math.round(b.x) % 7, share);
        if (b.ops && b.ops.length) lit = this.litDamaged(b, lit);
        ctx.globalAlpha = Math.min(1, k * power * 1.15); ctx.save(); ctx.translate(b.x, b.base); ctx.scale(1, -1); ctx.drawImage(lit, -b.w / 2, -b.h, b.w, b.h); ctx.restore();
      }
      for (const f of b.fires || []) {                         // burning floors glow
        const fx = b.x + f.lx, fy = b.base + f.ly, r = 4 + Math.sin(this.w.time * 9 + f.lx) * 0.4, gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
        gr.addColorStop(0, 'rgba(255,140,50,0.5)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); ctx.globalAlpha = k; ctx.fillStyle = gr; ctx.fillRect(fx - r, fy - r, r * 2, r * 2);
      }
    }
    rowsPass(front);
    ctx.restore(); this._litList = null;
    // cut out what stands in front: the vehicles
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 1;
    const lcam = Object.assign(Object.create(Object.getPrototypeOf(cam)), cam); lcam.zoom = cam.zoom / 2;
    for (const v of this.w.vehicles) if (cam.visible(v.pos.x, v.pos.y, 14) && this.shown(v)) this.drawVehicle(ctx, v, lcam);
    ctx.restore();
    main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.globalCompositeOperation = 'lighter'; main.globalAlpha = 1; main.drawImage(lay, 0, 0, lw, lh, 0, 0, cv.width, cv.height); main.restore();
  },
  // lit panes of a damaged drive-line building: what has been knocked out or taken off is dark
  litDamaged(b, lit) {
    const key = b.faceVer + ':' + lit.width + ':' + (lit._id || (lit._id = Math.random()));
    if (b._litKey === key) return b._litC;
    const c = b._litC || (b._litC = document.createElement('canvas')); c.width = lit.width; c.height = lit.height;
    const x = c.getContext('2d'); x.drawImage(lit, 0, 0);
    if (b.face) { x.globalCompositeOperation = 'destination-in'; x.drawImage(b.face, 0, 0, lit.width, lit.height); }
    x.globalCompositeOperation = 'destination-out';
    for (const o of b.ops) if (o.t === 'hole') { const bs = b.bs, cx = (o.k % b.GX + 0.5) * bs, cy = (((o.k / b.GX) | 0) + 0.5) * bs; x.fillRect(cx - bs, cy - bs, bs * 2, bs * 2); }
    b._litKey = key; return c;
  },
  // scenery rows call this for every building or lamp they draw at night
  litRecord(p, im, x, y, wd, ht, haze) {
    const env = this.w.env || {}; if ((env.dark || 0) < 0.15 || env.blackout) return;
    const L = this._litList || (this._litList = []), k = p.k;
    if (k === 't:lamp' || k === 't:lane_lamp') {
      if (DS.MAP && DS.MAP.town && DS.MAP.district(p.x)[2] === 'ruins') return;
      const lamp = k === 't:lamp', s = wd / (lamp ? 3.47 : 1.87);
      L.push({ lamp: true, z: p.z, x, y, hx: lamp ? (p.f === -1 ? -1 : 1) * wd * 0.36 : 0, hy: ht * (lamp ? 0.93 : 0.82), s, haze }); return;
    }
    // lit: houses, blocks and towers and the big market buildings; small shops, stalls and sheds stay dark
    const bld = (k.startsWith('city:') && !/^city:(l5|l7)$/.test(k)) || /^t:(market_a|market_b|market_2storey|market_alley)$/.test(k);
    if (!bld) return;
    if (DS.MAP && DS.MAP.town && DS.MAP.district(p.x)[2] === 'ruins') return;
    L.push({ key: k, z: p.z, im, x, y, w: wd, h: ht, f: p.f, haze, variant: Math.abs(Math.round(p.x * 7.3)) % 9 });
  },
});
