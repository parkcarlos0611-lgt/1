// Procedural material textures (sheet metal, composites, cast engine metal) and an
// affine triangle-mesh warper that bends any texture (procedural or user-uploaded)
// to follow a body contour, like a stamped panel.
(function (MW) {
  const U = MW.U, R = MW.render;
  const cache = {};
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const noise = (ctx, w, h, amt, rnd, alpha = 1) => {
    const d = ctx.getImageData(0, 0, w, h), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const n = (rnd() - .5) * amt; p[i] += n; p[i + 1] += n; p[i + 2] += n; p[i + 3] = 255 * alpha; }
    ctx.putImageData(d, 0, 0);
  };
  // raw sheet textures
  R.sheetTexture = (id) => {
    if (cache['s' + id]) return cache['s' + id];
    const W = 512, H = 256, c = mk(W, H), x = c.getContext('2d'), rnd = U.rng(id.length * 977 + 3);
    const base = { mild: '#6f747a', galv: '#a9adb1', hsla: '#7c8288', ahss: '#5f656c', uhss: '#8f8a7c', alu: '#c4c9cf', frp: '#d8d6c4', cfrp: '#1b1d20' }[id] || '#888';
    x.fillStyle = base; x.fillRect(0, 0, W, H);
    if (id === 'mild' || id === 'hsla' || id === 'ahss') {
      // mill scale mottling and roll direction streaks
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${rnd() < .5 ? '40,44,50' : '150,155,160'},${.05 + rnd() * .08})`; x.beginPath(); x.ellipse(rnd() * W, rnd() * H, 10 + rnd() * 60, 3 + rnd() * 12, 0, 0, 7); x.fill(); }
      for (let i = 0; i < 140; i++) { x.strokeStyle = `rgba(255,255,255,${rnd() * .07})`; x.lineWidth = rnd() * 1.5; const yy = rnd() * H; x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy + (rnd() - .5) * 4); x.stroke(); }
      if (id === 'hsla') { x.fillStyle = 'rgba(30,60,120,.08)'; x.fillRect(0, 0, W, H); }
      if (id === 'ahss') { x.font = 'bold 11px monospace'; x.fillStyle = 'rgba(230,230,230,.25)'; for (let i = 0; i < 5; i++) x.fillText('DP980  T0.60  HEAT 7' + i, 20 + i * 90, 30 + i * 46); }
      noise(x, W, H, 26, rnd);
    } else if (id === 'galv') {
      // zinc spangle: voronoi-ish crystal patches
      const pts = Array.from({ length: 140 }, () => [rnd() * W, rnd() * H, 150 + rnd() * 70, rnd() * Math.PI]);
      const d = x.getImageData(0, 0, W, H), p = d.data;
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
        let b = 1e9, bi = 0, s = 1e9; for (let i = 0; i < pts.length; i++) { const dx = xx - pts[i][0], dy = yy - pts[i][1], dd = dx * dx + dy * dy; if (dd < b) { s = b; b = dd; bi = i; } else if (dd < s) s = dd; }
        const P = pts[bi]; const ang = Math.atan2(yy - P[1], xx - P[0]) + P[3]; const dend = Math.cos(ang * 6) * 10;
        let v = P[2] + dend + (Math.sqrt(s) - Math.sqrt(b) < 1.2 ? -45 : 0) + (rnd() - .5) * 14;
        const k = (yy * W + xx) * 4; p[k] = v; p[k + 1] = v + 2; p[k + 2] = v + 6; p[k + 3] = 255;
      }
      x.putImageData(d, 0, 0);
    } else if (id === 'uhss') {
      for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${rnd() < .5 ? '120,110,80' : '170,165,150'},${.08 + rnd() * .1})`; x.beginPath(); x.arc(rnd() * W, rnd() * H, 2 + rnd() * 16, 0, 7); x.fill(); }
      noise(x, W, H, 30, rnd);
    } else if (id === 'alu') {
      for (let yy = 0; yy < H; yy++) { x.strokeStyle = `rgba(${rnd() < .5 ? '255,255,255' : '90,95,105'},${rnd() * .18})`; x.beginPath(); x.moveTo(0, yy + .5); x.lineTo(W, yy + .5); x.stroke(); }
      noise(x, W, H, 14, rnd);
    } else if (id === 'frp') {
      for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(${rnd() < .5 ? '140,150,110' : '255,255,240'},${.1 + rnd() * .2})`; x.lineWidth = .6; const a = rnd() * 7, l = 6 + rnd() * 30, xx = rnd() * W, yy = rnd() * H; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + Math.cos(a) * l, yy + Math.sin(a) * l); x.stroke(); }
      noise(x, W, H, 12, rnd);
    } else if (id === 'cfrp') {
      // 2x2 twill weave
      const s = 8;
      for (let i = 0; i < W / s; i++) for (let j = 0; j < H / s; j++) {
        const warp = ((i + j) >> 1) % 2 === 0;
        const g = x.createLinearGradient(i * s, j * s, warp ? i * s + s : i * s, warp ? j * s : j * s + s);
        g.addColorStop(0, warp ? '#2d3136' : '#121417'); g.addColorStop(.5, warp ? '#454a52' : '#22262b'); g.addColorStop(1, warp ? '#24272c' : '#0e1012');
        x.fillStyle = g; x.fillRect(i * s, j * s, s, s);
      }
    }
    return (cache['s' + id] = c);
  };
  // painted finish over a base: paint colour, orange-peel (paint process), metallic flake (era)
  R.paintTexture = (color, gloss = .7, flake = 0, key = '') => {
    const k = 'p' + color + gloss.toFixed(2) + flake + key; if (cache[k]) return cache[k];
    const W = 512, H = 256, c = mk(W, H), x = c.getContext('2d'), rnd = U.rng(7);
    x.fillStyle = color; x.fillRect(0, 0, W, H);
    const peel = (1 - gloss) * 40;
    const d = x.getImageData(0, 0, W, H), p = d.data;
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const k2 = (yy * W + xx) * 4;
      const n = (Math.sin(xx * .9 + Math.sin(yy * .7) * 2) + Math.sin(yy * 1.1 + Math.cos(xx * .6) * 2)) * peel * .25 + (rnd() - .5) * peel * .5;
      const f = flake && rnd() < .08 ? (rnd() * 60 * flake) : 0;
      p[k2] += n + f; p[k2 + 1] += n + f; p[k2 + 2] += n + f;
    }
    x.putImageData(d, 0, 0);
    return (cache[k] = c);
  };
  // cast metal for engine parts
  R.castTexture = (mat) => {
    const k = 'c' + mat; if (cache[k]) return cache[k];
    const W = 256, H = 256, c = mk(W, H), x = c.getContext('2d'), rnd = U.rng(mat.length * 31);
    x.fillStyle = { iron: '#55595e', alu: '#a7abb0', cgi: '#4b4f54', black: '#26282b', red: '#8e2420', blue: '#2c4f86', crinkle: '#2d2f33' }[mat] || '#777';
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${rnd() < .5 ? '0,0,0' : '255,255,255'},${rnd() * .12})`; x.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2.5, 1 + rnd() * 2.5); }
    noise(x, W, H, mat === 'alu' ? 22 : 34, rnd);
    return (cache[k] = c);
  };
  R.userImage = (dataUrl, cb) => { if (!dataUrl) return null; if (cache[dataUrl]) return cache[dataUrl].complete ? cache[dataUrl] : null; const im = new Image(); im.onload = () => cb && cb(); im.src = dataUrl; cache[dataUrl] = im; return null; };

  // draw texture image into triangle (dst) using affine map from (src) triangle
  const tri = (ctx, img, s0, s1, s2, d0, d1, d2) => {
    ctx.save(); ctx.beginPath(); ctx.moveTo(d0.x, d0.y); ctx.lineTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y); ctx.closePath(); ctx.clip();
    const den = (s0.x * (s2.y - s1.y) - s1.x * s2.y + s2.x * s1.y + (s1.x - s2.x) * s0.y); if (Math.abs(den) < 1e-9) { ctx.restore(); return; }
    const a = -(s0.y * (d2.x - d1.x) - s1.y * d2.x + s2.y * d1.x + (s1.y - s2.y) * d0.x) / den;
    const b = (s1.y * d2.y + s0.y * (d1.y - d2.y) - s2.y * d1.y + (s2.y - s1.y) * d0.y) / den;
    const c = (s0.x * (d2.x - d1.x) - s1.x * d2.x + s2.x * d1.x + (s1.x - s2.x) * d0.x) / den;
    const d = -(s1.x * d2.y + s0.x * (d1.y - d2.y) - s2.x * d1.y + (s2.x - s1.x) * d0.y) / den;
    const e = (s0.x * (s2.y * d1.x - s1.y * d2.x) + s0.y * (s1.x * d2.x - s2.x * d1.x) + (s2.x * s1.y - s1.x * s2.y) * d0.x) / den;
    const f = (s0.x * (s2.y * d1.y - s1.y * d2.y) + s0.y * (s1.x * d2.y - s2.x * d1.y) + (s2.x * s1.y - s1.x * s2.y) * d0.y) / den;
    ctx.transform(a, b, c, d, e, f); ctx.drawImage(img, 0, 0); ctx.restore();
  };
  // warp a texture between two curves: top(t) and bot(t) give screen points for t∈[0,1].
  // The texture's v axis follows the panel from bottom to top, so grain bends with the form.
  R.warp = (ctx, img, top, bot, cols = 28, rows = 5, uScale = 1) => {
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    for (let i = 0; i < cols; i++) {
      const t0 = i / cols, t1 = (i + 1) / cols;
      const T0 = top(t0), T1 = top(t1), B0 = bot(t0), B1 = bot(t1);
      for (let j = 0; j < rows; j++) {
        const v0 = j / rows, v1 = (j + 1) / rows;
        const P = (A, B, v) => ({ x: U.lerp(B.x, A.x, v), y: U.lerp(B.y, A.y, v) });
        const d00 = P(T0, B0, v0), d10 = P(T1, B1, v0), d01 = P(T0, B0, v1), d11 = P(T1, B1, v1);
        // expand a hair to hide seams
        const ex = (p, cx, cy) => ({ x: p.x + (p.x - cx) * .02, y: p.y + (p.y - cy) * .02 });
        const cx = (d00.x + d11.x) / 2, cy = (d00.y + d11.y) / 2;
        const su0 = t0 * uScale * iw, su1 = t1 * uScale * iw;
        const s00 = { x: su0, y: (1 - v0) * ih }, s10 = { x: su1, y: (1 - v0) * ih }, s01 = { x: su0, y: (1 - v1) * ih }, s11 = { x: su1, y: (1 - v1) * ih };
        tri(ctx, img, s00, s10, s11, ex(d00, cx, cy), ex(d10, cx, cy), ex(d11, cx, cy));
        tri(ctx, img, s00, s11, s01, ex(d00, cx, cy), ex(d11, cx, cy), ex(d01, cx, cy));
      }
    }
  };
})(window.MW);
