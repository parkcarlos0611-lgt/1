// Blueprint import: load a side/top drawing (or orthographic photo), calibrate it with
// the two wheel centres and the real wheelbase, overlay it on the viewport, and trace
// the body outline / glasshouse / plan shape into the editable body points.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim, UI = MW.ui, h = U.h;
  const imgCache = {};
  UI.bpImage = (url, cb) => { if (!url) return null; let im = imgCache[url]; if (!im) { im = new Image(); im.onload = () => cb && cb(); im.src = url; imgCache[url] = im; } return im.complete && im.naturalWidth ? im : null; };
  const readImage = (file, max, cb) => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', .9), c.width, c.height); }; im.src = fr.result; }; fr.readAsDataURL(file); };

  // image px → body mm for the side view (front wheel centre / rear wheel centre calibration)
  UI.bpSideXf = (car) => {
    const b = car.body, bp = b.bp?.side; if (!bp || !bp.f || !bp.r) return null;
    const g = MW.render.geom(car);
    const flip = bp.r[0] < bp.f[0] ? -1 : 1;              // car facing right in the image
    const s = b.wb / Math.hypot(bp.r[0] - bp.f[0], bp.r[1] - bp.f[1]);
    const cy = (bp.f[1] + bp.r[1]) / 2;
    return { s, flip, toMM: (px, py) => ({ x: g.fx + (px - bp.f[0]) * s * flip, y: g.wr - (py - cy) * s }), g };
  };
  // draw the side blueprint into a viewport (called from UI.carSide after hook)
  UI.bpDrawSide = (x, car, v) => {
    const bp = car.body.bp; if (!bp?.side || bp.show === false) return;
    const im = UI.bpImage(bp.side.url, () => { }); if (!im) return;
    const T = UI.bpSideXf(car); if (!T) return;
    const k = T.s * v.sc;                              // image px → screen px
    const f0 = T.toMM(0, 0);
    x.save(); x.globalAlpha = bp.opacity ?? .5; x.globalCompositeOperation = 'multiply';
    x.translate(v.ox + f0.x * v.sc, v.gy - f0.y * v.sc); x.scale(k * T.flip, k);
    x.drawImage(im, 0, 0); x.restore();
  };
  UI.bpDrawTop = (x, car, v) => {
    const bp = car.body.bp; if (!bp?.top || bp.show === false || bp.top.x0 == null) return;
    const im = UI.bpImage(bp.top.url, () => { }); if (!im) return;
    const b = car.body, flip = bp.top.x1 < bp.top.x0 ? -1 : 1;
    const s = b.L / Math.abs(bp.top.x1 - bp.top.x0) * v.sc;
    x.save(); x.globalAlpha = bp.opacity ?? .5; x.globalCompositeOperation = 'multiply';
    x.translate(v.ox - bp.top.x0 * s * flip, v.cy - bp.top.cy * s); x.scale(s * flip, s); x.drawImage(im, 0, 0); x.restore();
  };

  // ── segmentation: everything not connected to the border background ──
  const silhouette = (im, tol) => {
    const W = im.naturalWidth, H = im.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, W, H).data;
    // background colour = median of border pixels
    const bord = []; for (let i = 0; i < W; i += 3) { bord.push(i, i + (H - 1) * W); } for (let j = 0; j < H; j += 3) { bord.push(j * W, j * W + W - 1); }
    const med = k => { const a = bord.map(p => d[p * 4 + k]).sort((a, b) => a - b); return a[a.length >> 1]; };
    const bg = [med(0), med(1), med(2)];
    const isBg = p => Math.abs(d[p * 4] - bg[0]) + Math.abs(d[p * 4 + 1] - bg[1]) + Math.abs(d[p * 4 + 2] - bg[2]) < tol;
    const m = new Uint8Array(W * H).fill(1); // 1 = car
    const st = []; for (const p of bord) if (isBg(p) && m[p]) { m[p] = 0; st.push(p); }
    while (st.length) { const p = st.pop(), px = p % W; for (const q of [p - 1, p + 1, p - W, p + W]) { if (q < 0 || q >= W * H) continue; if ((q === p - 1 && px === 0) || (q === p + 1 && px === W - 1)) continue; if (m[q] && isBg(q)) { m[q] = 0; st.push(q); } } }
    // keep the largest component
    const lab = new Int32Array(W * H); let best = 0, bestN = 0, id = 0;
    for (let p = 0; p < W * H; p++) if (m[p] && !lab[p]) { id++; let n = 0; const s2 = [p]; lab[p] = id; while (s2.length) { const q = s2.pop(); n++; const qx = q % W; for (const r of [q - 1, q + 1, q - W, q + W]) { if (r < 0 || r >= W * H || lab[r] || !m[r]) continue; if ((r === q - 1 && qx === 0) || (r === q + 1 && qx === W - 1)) continue; lab[r] = id; s2.push(r); } } if (n > bestN) { bestN = n; best = id; } }
    for (let p = 0; p < W * H; p++) m[p] = lab[p] === best ? 1 : 0;
    // fill holes (windows, line-art interiors): anything not reachable from the border is car
    const out = new Uint8Array(W * H).fill(1); const s3 = [];
    for (const p of bord) if (!m[p] && out[p]) { out[p] = 0; s3.push(p); }
    while (s3.length) { const p = s3.pop(), px = p % W; for (const q of [p - 1, p + 1, p - W, p + W]) { if (q < 0 || q >= W * H) continue; if ((q === p - 1 && px === 0) || (q === p + 1 && px === W - 1)) continue; if (out[q] && !m[q]) { out[q] = 0; s3.push(q); } } }
    return { m: out, W, H, d };
  };
  const dp = (P, eps) => { if (P.length < 3) return P; const [a, b] = [P[0], P[P.length - 1]]; const ax = b.x - a.x, ay = b.y - a.y, n = Math.hypot(ax, ay) || 1; let im = 0, md = 0; for (let i = 1; i < P.length - 1; i++) { const dd = Math.abs(ax * (P[i].y - a.y) - ay * (P[i].x - a.x)) / n; if (dd > md) { md = dd; im = i; } } return md > eps ? dp(P.slice(0, im + 1), eps).slice(0, -1).concat(dp(P.slice(im), eps)) : [a, b]; };

  UI.bpTraceSide = (car, opt = {}) => {
    const b = car.body, bp = b.bp.side, im = UI.bpImage(bp.url); if (!im) return '이미지를 불러오는 중입니다';
    const T = UI.bpSideXf(car); if (!T) return '먼저 앞·뒷바퀴 중심을 지정하세요';
    const { m, W, H, d } = silhouette(im, opt.tol || 60);
    const col = px => { for (let y = 0; y < H; y++) if (m[y * W + px]) return y; return -1; };
    let xmin = W, xmax = 0, ymin = H; for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) if (m[y * W + xx]) { if (xx < xmin) xmin = xx; if (xx > xmax) xmax = xx; if (y < ymin) ymin = y; }
    if (xmax <= xmin) return '윤곽을 찾지 못했습니다 — 배경 허용치를 조정하세요';
    const toMM = T.toMM;
    const front = T.flip > 0 ? xmin : xmax, rear = T.flip > 0 ? xmax : xmin;
    const L = Math.abs(rear - front) * T.s, x0mm = toMM(front, 0).x;
    const groundPy = (bp.f[1] + bp.r[1]) / 2 + T.g.wr / T.s;
    const cutPy = groundPy - T.g.wr / T.s * 1.0;           // ignore below bumper bottom ≈ wheel-centre height
    const pts = [];
    const rowExt = (py, side) => { let a = -1, z = -1; for (let xx = 0; xx < W; xx++) if (m[py * W + xx]) { if (a < 0) a = xx; z = xx; } return side === 'f' ? (T.flip > 0 ? a : z) : (T.flip > 0 ? z : a); };
    // front face (bottom → top), top envelope (front → rear), rear face (top → bottom)
    const N = 160, ys = [];
    for (let i = 0; i <= 40; i++) ys.push(Math.round(cutPy - (cutPy - ymin) * i / 40));
    const fFace = ys.map(py => ({ px: rowExt(py, 'f'), py })).filter(p => p.px >= 0);
    const topEnv = []; for (let i = 0; i <= N; i++) { const px = Math.round(front + (rear - front) * i / N); const py = col(Math.max(0, Math.min(W - 1, px))); if (py >= 0) topEnv.push({ px, py }); }
    const rFace = ys.map(py => ({ px: rowExt(py, 'r'), py })).filter(p => p.px >= 0).reverse();
    const toB = p => { const q = toMM(p.px, p.py); return { x: q.x - x0mm, y: q.y }; };
    let prof = [];
    const fF = fFace.map(toB), tE = topEnv.map(toB), rF = rFace.map(toB);
    const fEnd = tE.findIndex(p => p.x > 40), rEnd = tE.length - 1 - tE.slice().reverse().findIndex(p => p.x < L - 40);
    prof = fF.filter(p => p.y < (tE[fEnd]?.y ?? 9e9) - 5).concat(tE.slice(fEnd, rEnd + 1), rF.filter(p => p.y < (tE[rEnd]?.y ?? 9e9) - 5));
    prof = dp(prof, opt.eps || 5);
    const Hmm = Math.max(...prof.map(p => p.y));
    // glasshouse: dark pixels in the upper body
    const dark = [];
    const beltPy = groundPy - (Hmm * .6) / T.s;
    let vsum = 0, vn = 0; for (let py = ymin; py < beltPy; py += 2) for (let px = Math.min(xmin, xmax); px <= Math.max(xmin, xmax); px += 2) if (m[py * W + px]) { const q = (py * W + px) * 4; vsum += d[q] + d[q + 1] + d[q + 2]; vn++; }
    const thr = (vsum / Math.max(1, vn)) * (opt.glass || .7);
    for (let py = ymin; py < beltPy; py += 2) for (let px = Math.min(xmin, xmax); px <= Math.max(xmin, xmax); px += 2) { const q = (py * W + px) * 4; if (m[py * W + px] && d[q] + d[q + 1] + d[q + 2] < thr) dark.push(toB({ px, py })); }
    let glass = null;
    if (dark.length > 50) {
      // convex hull of dark area, simplified
      const P = dark.sort((a, b) => a.x - b.x || a.y - b.y), cr = (o, a, b2) => (a.x - o.x) * (b2.y - o.y) - (a.y - o.y) * (b2.x - o.x);
      const lo = [], up = []; for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (const p of P.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
      let hull = lo.slice(0, -1).concat(up.slice(0, -1));
      hull = dp(hull.concat([hull[0]]), 45).slice(0, -1);
      // start at the front-bottom corner, go over the top (clockwise in y-up space)
      const cx = U.sum(hull.map(p => p.x)) / hull.length, cyy = U.sum(hull.map(p => p.y)) / hull.length;
      const st = hull.reduce((bi, p, i) => (p.x + p.y * .8 < hull[bi].x + hull[bi].y * .8 ? i : bi), 0);
      const ang = p => Math.atan2(p.y - cyy, p.x - cx), a0 = ang(hull[st]);
      glass = hull.slice().sort((p, q) => ((a0 - ang(p)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - ((a0 - ang(q)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI));
      if (glass.length < 4 || glass.length > 10) glass = null;
    }
    // apply
    const foh = T.g.fx - x0mm;
    b.L = Math.round(L); b.H = Math.round(Hmm); b.foh = U.clamp(foh / (b.L - b.wb), .1, .9);
    // corners: where the traced outline turns sharply, keep the corner (no spline overshoot)
    b.side = prof.map((p, i) => {
      const o = { x: U.clamp(p.x / b.L, 0, 1), y: U.clamp(p.y / b.H, 0, 1) };
      if (i > 0 && i < prof.length - 1) { const a1 = Math.atan2(p.y - prof[i - 1].y, p.x - prof[i - 1].x), a2 = Math.atan2(prof[i + 1].y - p.y, prof[i + 1].x - p.x); let da = Math.abs(a2 - a1); if (da > Math.PI) da = 2 * Math.PI - da; if (da > .6) o.s = 1; }
      return o;
    });
    if (glass) b.glass = glass.map(p => ({ x: U.clamp(p.x / b.L, 0, 1), y: U.clamp(p.y / b.H, 0, 1) }));
    b.preset = b.preset + ''; b.traced = 1;
    car._rev = (car._rev || 0) + 1;
    return null;
  };
  UI.bpTraceTop = (car, opt = {}) => {
    const b = car.body, bp = b.bp.top, im = UI.bpImage(bp.url); if (!im) return '이미지를 불러오는 중입니다';
    if (bp.x0 == null) return '앞·뒤 끝을 지정하세요';
    const { m, W, H } = silhouette(im, opt.tol || 60);
    const flip = bp.x1 < bp.x0 ? -1 : 1, s = b.L / Math.abs(bp.x1 - bp.x0);
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const px = Math.round(bp.x0 + (bp.x1 - bp.x0) * i / 40); let a = -1, z = -1;
      for (let y = 0; y < H; y++) if (m[y * W + Math.max(0, Math.min(W - 1, px))]) { if (a < 0) a = y; z = y; }
      if (a >= 0) pts.push({ x: i / 40, w: (z - a) * s });
    }
    if (pts.length < 10) return '평면 윤곽을 찾지 못했습니다';
    const Wmm = Math.max(...pts.map(p => p.w)); b.W = Math.round(Wmm);
    bp.cy = (() => { let a = H, z = 0; for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx += 4) if (m[y * W + xx]) { a = Math.min(a, y); z = Math.max(z, y); } return (a + z) / 2; })();
    b.top = dp(pts.map(p => ({ x: p.x, y: p.w / Wmm })), .01);
    car._rev = (car._rev || 0) + 1; return null;
  };

  // calibration picker: click two points on the image
  const picker = (url, labels, done) => {
    const im = UI.bpImage(url, () => draw()); const pts = [];
    const c = h('canvas', { class: 'bpick' });
    const draw = () => { const img = UI.bpImage(url); if (!img) return; const W = c.clientWidth || 300, k = W / img.naturalWidth; c.width = W; c.height = img.naturalHeight * k; const x = c.getContext('2d'); x.drawImage(img, 0, 0, W, c.height); pts.forEach((p, i) => { x.strokeStyle = '#d0021b'; x.lineWidth = 2; x.beginPath(); x.arc(p[0] * k, p[1] * k, 8, 0, 7); x.moveTo(p[0] * k - 12, p[1] * k); x.lineTo(p[0] * k + 12, p[1] * k); x.moveTo(p[0] * k, p[1] * k - 12); x.lineTo(p[0] * k, p[1] * k + 12); x.stroke(); x.fillStyle = '#d0021b'; x.font = '12px sans-serif'; x.fillText(labels[i], p[0] * k + 10, p[1] * k - 10); }); };
    const info = h('p', { class: 'note' }, labels[0] + '을(를) 클릭하세요');
    c.onclick = ev => { const img = UI.bpImage(url); if (!img) return; const r = c.getBoundingClientRect(), k = img.naturalWidth / r.width; pts.push([(ev.clientX - r.left) * k, (ev.clientY - r.top) * k]); draw(); if (pts.length < labels.length) info.textContent = labels[pts.length] + '을(를) 클릭하세요'; else { info.textContent = '완료'; done(pts); } };
    requestAnimationFrame(draw);
    return h('div', { class: 'bpbox' }, info, c);
  };

  // inspector tab
  UI.blueprintTab = (g, car, locked) => {
    const b = car.body; b.bp = b.bp || {};
    const bp = b.bp;
    const wbIn = h('input', { class: 'in num', type: 'number', id: 'bp-wb', value: b.wb, step: 1 });
    const tolIn = h('input', { type: 'range', min: 15, max: 160, value: bp.tol || 60, oninput: ev => { bp.tol = +ev.target.value; } });
    const glIn = h('input', { type: 'range', min: 30, max: 95, value: Math.round((bp.glass || .7) * 100), oninput: ev => { bp.glass = +ev.target.value / 100; } });
    const upSide = h('input', { type: 'file', accept: 'image/*', id: 'bp-side', onchange: ev => { const f = ev.target.files[0]; if (f) readImage(f, 1600, (url, w, hh) => { bp.side = { url, w, h: hh }; bp.pick = 'side'; car._rev++; UI.render(); }); } });
    const upTop = h('input', { type: 'file', accept: 'image/*', id: 'bp-top', onchange: ev => { const f = ev.target.files[0]; if (f) readImage(f, 1600, (url, w, hh) => { bp.top = { url, w, h: hh }; bp.pick = 'top'; car._rev++; UI.render(); }); } });
    const fs = (...k) => h('fieldset', { disabled: locked }, ...k);
    return [
      fs(UI.group('측면 청사진',
        h('p', { class: 'note' }, '측면 정사영 도면(청사진) 또는 정측면 사진을 불러오세요. 앞·뒷바퀴 중심을 찍고 실제 휠베이스를 넣으면 mm 단위로 보정됩니다. 뷰포트에 겹쳐 보이며, 자동 추적 후 점을 끌어 100% 맞출 수 있습니다.'),
        UI.prop('도면 이미지', upSide),
        bp.side ? UI.prop('실제 휠베이스', h('div', { class: 'row tight' }, wbIn, UI.btn('적용', () => { b.wb = Math.max(1500, +wbIn.value || b.wb); car._rev++; UI.render(); }, 'ghost sm')), 'mm — 제원표 값') : null,
        bp.side && bp.pick === 'side' ? picker(bp.side.url, ['앞바퀴 중심', '뒷바퀴 중심'], pts => { bp.side.f = pts[0]; bp.side.r = pts[1]; bp.pick = null; car._rev++; UI.render(); }) : null,
        bp.side && bp.pick !== 'side' ? h('div', { class: 'row wrap' }, UI.btn('바퀴 중심 다시 지정', () => { bp.pick = 'side'; UI.render(); }, 'ghost sm'), UI.btn('도면 제거', () => { delete bp.side; car._rev++; UI.render(); }, 'ghost sm')) : null,
        bp.side?.f ? UI.prop('배경 허용치', tolIn, '윤곽이 새면 낮게') : null,
        bp.side?.f ? UI.prop('유리 감도', glIn, '창 영역 어두움 기준') : null,
        bp.side?.f ? UI.btn('측면 윤곽 자동 추적', () => { const e = UI.bpTraceSide(car, { tol: bp.tol, glass: bp.glass }); if (UI.err(e)) { UI.toast(`추적 완료 — 전장 ${b.L} · 전고 ${b.H} mm · 점 ${b.side.length}개`, 'good'); UI.render(); } }, 'pri') : null)),
      fs(UI.group('평면 청사진',
        UI.prop('도면 이미지', upTop),
        bp.top && bp.pick === 'top' ? picker(bp.top.url, ['차체 앞 끝', '차체 뒤 끝'], pts => { bp.top.x0 = pts[0][0]; bp.top.x1 = pts[1][0]; bp.top.cy = (pts[0][1] + pts[1][1]) / 2; bp.pick = null; car._rev++; UI.render(); }) : null,
        bp.top && bp.pick !== 'top' ? h('div', { class: 'row wrap' }, UI.btn('끝점 다시 지정', () => { bp.pick = 'top'; UI.render(); }, 'ghost sm'), UI.btn('평면 윤곽 자동 추적', () => UI.err(UI.bpTraceTop(car, { tol: bp.tol })) && (UI.toast(`평면 추적 완료 — 전폭 ${b.W} mm`, 'good'), UI.render()), 'pri'), UI.btn('도면 제거', () => { delete bp.top; car._rev++; UI.render(); }, 'ghost sm')) : null)),
      h('fieldset', {}, UI.group('표시',
        UI.prop('도면 표시', h('input', { type: 'checkbox', checked: bp.show !== false, onchange: ev => { bp.show = ev.target.checked; } })),
        UI.prop('불투명도', UI.range(Math.round((bp.opacity ?? .5) * 100), 10, 100, 5, v => { bp.opacity = v / 100; }, v => v + '%')),
        h('p', { class: 'note' }, '편집 핸들: 점 드래그로 이동, 점 더블클릭으로 각진/곡선 전환, 선 위 더블클릭으로 점 추가, 점 우클릭으로 삭제.')))
    ];
  };
})(window.MW);
