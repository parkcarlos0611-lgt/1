// Automotive side-view / plan-view renderer.
// Geometry comes from the body outline in millimetres. Shading follows how a real
// car is photographed in a studio: upper surfaces and the shoulder reflect the sky,
// a horizon line runs along the door, the lower body reflects the floor, and the
// surface darkens where the plan view turns away (nose, tail). Sheet texture (or a
// user image) is warped onto the body, then paint, trim, glazing, lamps, bumpers and
// wheels are drawn in the style of the design year. Results are cached per design.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim, R = MW.render;

  // ── era style resolution ───────────────────────────────────────────
  R.styleFor = (car, year) => {
    const b = car.body, st = b.style || {};
    const seg = car.segment || '';
    const auto = {
      lamp: year < 1953 ? 'pod' : year < 1975 ? 'round' : year < 1990 ? 'rect' : year < 2010 ? 'aero' : 'led',
      tail: b.preset === 'fin59' ? 'fin' : year < 1958 ? 'small' : year < 1990 ? 'band' : 'wrap',
      bumper: year < 1974 ? 'blade' : year < 1990 ? 'impact' : 'integrated',
      wheel: (car.powertrain === 'bev' && year >= 2012) ? 'aero' : year < 1956 ? 'cap' : year < 1968 ? 'cover' : year < 1980 ? 'slot' : year < 1990 ? 'lattice' : year < 2005 ? 'five' : year < 2015 ? 'multi' : 'twin',
      trim: year < 1975 ? 'chrome' : year < 1985 ? 'mixed' : 'black',
      whitewall: year < 1966 && (b.chrome ?? .5) > .3,
      mirror: year >= 1962 ? 'door' : 'none',
      marker: year >= 1968,
      caliper: year >= 2000 && ['sport', 'super', 'muscle'].includes(seg)
    };
    return Object.assign(auto, st);
  };

  // ── geometry in mm ─────────────────────────────────────────────────
  R.geom = (car) => {
    const b = car.body;
    const side = U.spline(b.side.map(p => ({ x: p.x * b.L, y: p.y * b.H, s: p.s })), 10, false);
    const glass = U.spline(b.glass.map(p => ({ x: p.x * b.L, y: p.y * b.H })), 10, true);
    const top = U.spline(b.top.map(p => ({ x: p.x * b.L, y: p.y * b.W / 2 })), 10, false);
    const tyreD = (car.rim * 25.4 + 2 * car.tireW * car.tireAR / 100);
    const wr = tyreD / 2;
    const fx = (b.L - b.wb) * b.foh, rx = fx + b.wb;
    const gap = (b.archGap ?? (b.clr > 190 ? 55 : 38));
    const Ra = wr + gap, cy = wr + 8;
    const sillY = b.clr + 25;
    const gl = b.glass, A0 = { x: gl[0].x * b.L, y: gl[0].y * b.H }, A1 = { x: gl[1].x * b.L, y: gl[1].y * b.H };
    const C1 = { x: gl[gl.length - 2].x * b.L, y: gl[gl.length - 2].y * b.H }, C0 = { x: gl[gl.length - 1].x * b.L, y: gl[gl.length - 1].y * b.H };
    const belt = Math.min(A0.y, C0.y);
    // underside with arches cut out
    const F0 = side[0], Ln = side[side.length - 1];
    const arch = (cx, yFrom, yTo, fromRight) => {
      const pts = [];
      const dy1 = U.clamp(yFrom - cy, -Ra + 1, Ra - 1), dy2 = U.clamp(yTo - cy, -Ra + 1, Ra - 1);
      const t1 = Math.atan2(dy1, Math.sqrt(Ra * Ra - dy1 * dy1)), t2 = Math.PI - Math.atan2(dy2, Math.sqrt(Ra * Ra - dy2 * dy2));
      for (let i = 0; i <= 24; i++) { const t = U.lerp(t1, t2, i / 24); pts.push({ x: cx + Math.cos(t) * Ra, y: cy + Math.sin(t) * Ra }); }
      return pts;
    };
    // nose/tail faces continue down to the valance (≈ clearance + 110 mm) even if the outline stops higher
    const valance = Math.max(sillY + 20, b.clr + 110);
    const rearB = Math.max(Math.min(Ln.y, valance), sillY), frontB = Math.max(Math.min(F0.y, valance), sillY);
    const under = [{ x: Ln.x, y: rearB }, ...arch(rx, rearB, sillY), ...arch(fx, sillY, frontB), { x: F0.x, y: frontB }];
    const poly = side.concat(under);
    const halfW = x => U.yAt(top, U.clamp(x, 1, b.L - 1), 'max') ?? b.W * .45;
    return { side, glass, top, poly, tyreD, wr, fx, rx, Ra, cy, sillY, A0, A1, C0, C1, belt, halfW, roof: Math.max(...side.map(p => p.y)) };
  };

  const skin = (car, year) => {
    const b = car.body;
    if (b.customTex) { const im = R.userImage(b.customTex, () => { car._rev = (car._rev || 0) + 1; }); if (im) return { img: im, raw: true }; }
    if (b.rawSheet) return { img: R.sheetTexture(D.byId(D.C.sheet, b.sheet).tex), raw: true };
    return { img: R.paintTexture(b.paint || '#888888', b.gloss ?? .8, year >= 1958 && b.metallic ? 1 : 0), raw: false };
  };
  const chromeGrad = (ctx, y0, y1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#fbfcfd'); g.addColorStop(.35, '#c9ced5'); g.addColorStop(.5, '#5d636b'); g.addColorStop(.62, '#e9ecef'); g.addColorStop(1, '#7a8088'); return g; };
  const path = (ctx, pts, X, Y, close = true) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))); if (close) ctx.closePath(); };

  // ── wheel ──────────────────────────────────────────────────────────
  R.drawWheel = (ctx, car, x0, y0, s, style, year, spin = 0) => {
    const wr = (car.rim * 25.4 / 2 + car.tireW * car.tireAR / 100) * s, rr = car.rim * 25.4 / 2 * s;
    // tyre
    const tg = ctx.createRadialGradient(x0, y0, rr, x0, y0, wr);
    tg.addColorStop(0, '#26282c'); tg.addColorStop(.55, '#1b1c1f'); tg.addColorStop(.92, '#121315'); tg.addColorStop(1, '#0b0b0c');
    ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(x0, y0 + wr * .012, wr, wr * .985, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = Math.max(1, wr * .04); ctx.beginPath(); ctx.arc(x0, y0, (wr + rr) / 2, Math.PI * 1.1, Math.PI * 1.65); ctx.stroke();
    if (style.whitewall) { ctx.strokeStyle = '#ecebe6'; ctx.lineWidth = (wr - rr) * .42; ctx.beginPath(); ctx.arc(x0, y0, rr + (wr - rr) * .36, 0, 7); ctx.stroke(); }
    // brake disc behind spokes
    const disc = ctx.createRadialGradient(x0, y0, rr * .2, x0, y0, rr * .88);
    disc.addColorStop(0, '#3b3e43'); disc.addColorStop(.6, '#71757b'); disc.addColorStop(1, '#3a3c40');
    ctx.fillStyle = '#0d0e10'; ctx.beginPath(); ctx.arc(x0, y0, rr, 0, 7); ctx.fill();
    if (car.brakes !== 'drum') { ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(x0, y0, rr * .86, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#2a2b2e'; ctx.beginPath(); ctx.arc(x0, y0, rr * .86, 0, 7); ctx.fill(); }
    if (style.caliper || car.brakes === 'ccb') { ctx.fillStyle = car.brakes === 'ccb' ? '#d9b21c' : '#b0141b'; ctx.beginPath(); ctx.arc(x0, y0, rr * .8, -2.3, -1.2); ctx.arc(x0, y0, rr * .55, -1.2, -2.3, true); ctx.fill(); }
    const metal = (r0, r1, light = '#eef0f2', dark = '#80868e') => { const g = ctx.createLinearGradient(x0 - r1, y0 - r1, x0 + r1, y0 + r1); g.addColorStop(0, light); g.addColorStop(.5, dark); g.addColorStop(1, light); return g; };
    const w = style.wheel;
    ctx.save(); ctx.translate(x0, y0); ctx.rotate(spin);
    const spokes = (n, w0, w1, r0 = .3, r1 = .9, fill) => {
      ctx.fillStyle = fill || metal(0, rr);
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - w0) * rr * r0, Math.sin(a - w0) * rr * r0); ctx.lineTo(Math.cos(a - w1) * rr * r1, Math.sin(a - w1) * rr * r1);
        ctx.lineTo(Math.cos(a + w1) * rr * r1, Math.sin(a + w1) * rr * r1); ctx.lineTo(Math.cos(a + w0) * rr * r0, Math.sin(a + w0) * rr * r0); ctx.closePath(); ctx.fill();
      }
    };
    const ring = (r0, r1, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, 0, rr * r1, 0, Math.PI * 2); ctx.moveTo(rr * r0, 0); ctx.arc(0, 0, rr * r0, 0, Math.PI * 2); ctx.fill('evenodd'); };
    if (w === 'cap') {
      ctx.fillStyle = car.body.paint || '#333'; ctx.beginPath(); ctx.arc(0, 0, rr * .98, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(0, 0, rr * .98, 0, 7); ctx.fill();
      for (let i = 0; i < 12; i++) { const a = i / 12 * 7; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * rr * .72, Math.sin(a) * rr * .72, rr * .07, rr * .035, a, 0, 7); ctx.fill(); }
      const cg = ctx.createRadialGradient(-rr * .15, -rr * .2, 1, 0, 0, rr * .6); cg.addColorStop(0, '#ffffff'); cg.addColorStop(.5, '#c3c8cf'); cg.addColorStop(.85, '#6d737b'); cg.addColorStop(1, '#a9aeb5');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, rr * .58, 0, 7); ctx.fill();
      ring(.94, 1, metal(0, rr));
    } else if (w === 'cover') {
      const cg = ctx.createRadialGradient(-rr * .2, -rr * .25, 1, 0, 0, rr); cg.addColorStop(0, '#ffffff'); cg.addColorStop(.6, '#b4bac2'); cg.addColorStop(1, '#5c626a');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, rr * .99, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(40,44,50,.55)'; ctx.lineWidth = Math.max(.6, rr * .025);
      for (let i = 0; i < 24; i++) { const a = i / 24 * 7; ctx.beginPath(); ctx.moveTo(Math.cos(a) * rr * .42, Math.sin(a) * rr * .42); ctx.lineTo(Math.cos(a) * rr * .9, Math.sin(a) * rr * .9); ctx.stroke(); }
      ring(.3, .38, '#444a52');
      ctx.fillStyle = metal(0, rr * .3); ctx.beginPath(); ctx.arc(0, 0, rr * .3, 0, 7); ctx.fill();
    } else if (w === 'slot') {
      ctx.fillStyle = metal(0, rr, '#e5e8eb', '#8f959c'); ctx.beginPath(); ctx.arc(0, 0, rr * .98, 0, 7); ctx.fill();
      ctx.fillStyle = '#121315';
      for (let i = 0; i < 5; i++) { const a = i / 5 * 7; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(rr * .62, 0, rr * .2, rr * .1, 0, 0, 7); ctx.fill(); ctx.restore(); }
      ring(.86, 1, metal(0, rr, '#fafbfc', '#a6abb1'));
    } else if (w === 'lattice') {
      ctx.fillStyle = '#1a1b1e'; ctx.beginPath(); ctx.arc(0, 0, rr * .9, 0, 7); ctx.fill();
      ctx.strokeStyle = metal(0, rr, '#d8dbdf', '#7d838a'); ctx.lineWidth = Math.max(.8, rr * .06);
      for (let i = 0; i < 16; i++) { const a = i / 16 * 7; ctx.beginPath(); ctx.moveTo(Math.cos(a) * rr * .3, Math.sin(a) * rr * .3); ctx.lineTo(Math.cos(a + .35) * rr * .9, Math.sin(a + .35) * rr * .9); ctx.moveTo(Math.cos(a) * rr * .3, Math.sin(a) * rr * .3); ctx.lineTo(Math.cos(a - .35) * rr * .9, Math.sin(a - .35) * rr * .9); ctx.stroke(); }
      ring(.86, 1, metal(0, rr, '#f4f5f6', '#9aa0a7'));
      ctx.fillStyle = metal(0, rr * .3); ctx.beginPath(); ctx.arc(0, 0, rr * .3, 0, 7); ctx.fill();
    } else if (w === 'aero') {
      ctx.fillStyle = metal(0, rr, '#cfd3d8', '#55595f'); ctx.beginPath(); ctx.arc(0, 0, rr * .98, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(20,22,25,.7)'; ctx.lineWidth = Math.max(1, rr * .05);
      for (let i = 0; i < 5; i++) { const a = i / 5 * 7; ctx.beginPath(); ctx.arc(0, 0, rr * .75, a, a + .7); ctx.stroke(); }
    } else {
      const n = w === 'five' ? 5 : w === 'multi' ? 10 : 10;
      const wid = w === 'five' ? [.2, .13] : w === 'multi' ? [.08, .045] : [.07, .04];
      if (w === 'twin') { for (let k = 0; k < 5; k++) { ctx.save(); ctx.rotate(k / 5 * 7); spokes(1, .1, .055, .3, .9); ctx.rotate(.22); spokes(1, .1, .055, .3, .9); ctx.restore(); } }
      else spokes(n, wid[0], wid[1]);
      ring(.86, 1, metal(0, rr, '#f2f4f6', '#8c9299'));
      ctx.fillStyle = metal(0, rr * .32); ctx.beginPath(); ctx.arc(0, 0, rr * .32, 0, 7); ctx.fill();
      ring(.8, .86, 'rgba(0,0,0,.25)');
    }
    // lug nuts + centre cap
    if (w !== 'cover' && w !== 'cap') { ctx.fillStyle = '#2a2c30'; const n = year < 1980 ? 4 : 5; for (let i = 0; i < n; i++) { const a = i / n * 7 + .3; ctx.beginPath(); ctx.arc(Math.cos(a) * rr * .2, Math.sin(a) * rr * .2, Math.max(.8, rr * .035), 0, 7); ctx.fill(); } ctx.fillStyle = '#1c1d20'; ctx.beginPath(); ctx.arc(0, 0, rr * .1, 0, 7); ctx.fill(); }
    ctx.restore();
    // wheel shading (light from above-left, rim lip)
    const sh = ctx.createLinearGradient(x0, y0 - rr, x0, y0 + rr); sh.addColorStop(0, 'rgba(255,255,255,.08)'); sh.addColorStop(.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.3)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(x0, y0, rr, 0, 7); ctx.fill();
  };

  // ── side view (renders into ctx at scale s with ground at oy) ─────────
  const drawSide = (ctx, car, o) => {
    const b = car.body, year = o.year, s = o.scale, st = R.styleFor(car, year);
    const X = mm => o.x + mm * s, Y = mm => o.y - mm * s;
    const g = R.geom(car);
    const L = b.L, H = b.H;
    const paint = b.paint || '#808080';
    // contact shadow
    ctx.save(); ctx.filter = 'blur(' + Math.max(2, 18 * s * 10) + 'px)';
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(X(L / 2), Y(0) - 2, L * s * .5, Math.max(4, 60 * s), 0, 0, 7); ctx.fill();
    ctx.filter = 'none'; ctx.restore();
    for (const cx of [g.fx, g.rx]) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.ellipse(X(cx), Y(0), g.wr * s * .8, Math.max(2, 22 * s), 0, 0, 7); ctx.fill(); }
    // wheel wells
    for (const cx of [g.fx, g.rx]) {
      const wg = ctx.createRadialGradient(X(cx), Y(g.cy), g.wr * s * .5, X(cx), Y(g.cy), g.Ra * s);
      wg.addColorStop(0, '#000'); wg.addColorStop(1, '#141518');
      ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(X(cx), Y(g.cy), g.Ra * s, Math.PI, 0); ctx.lineTo(X(cx + g.Ra), Y(g.cy)); ctx.closePath(); ctx.fill();
    }
    for (const cx of [g.fx, g.rx]) R.drawWheel(ctx, car, X(cx), Y(g.wr), s, st, year, o.spin || 0);
    // body skin
    ctx.save();
    path(ctx, g.poly, X, Y); ctx.save(); ctx.clip();
    const sk = skin(car, year);
    ctx.fillStyle = sk.raw ? '#777b80' : paint; ctx.fillRect(X(-10), Y(H + 10), (L + 20) * s, (H + 20) * s);
    const upAt = t => { const xm = t * L; const yy = U.yAt(g.side, U.clamp(xm, .5, L - .5), 'max') ?? g.sillY; return { x: X(xm), y: Y(yy) - 2 }; };
    const loAt = t => { const xm = t * L; const yy = U.yAt(g.poly, U.clamp(xm, .5, L - .5), 'min') ?? 0; return { x: X(xm), y: Y(Math.min(yy, g.sillY)) + 2 }; };
    R.warp(ctx, sk.img, upAt, loAt, 40, 6, 1);
    // panel-specific raw sheet (tailored blanks): repaint panels whose material differs
    if (sk.raw && b.panels) for (const P of R.panelRects(car, g)) { const m = b.panels[P.id]; if (!m || m.sheet === b.sheet) continue; ctx.save(); ctx.beginPath(); ctx.rect(X(P.x0), Y(P.y1), (P.x1 - P.x0) * s, (P.y1 - P.y0) * s); ctx.clip(); R.warp(ctx, R.sheetTexture(D.byId(D.C.sheet, m.sheet).tex), upAt, loAt, 40, 6, 1); ctx.restore(); }
    const k = sk.raw ? .6 : 1;
    // (1) plan-view turn-away: darken nose & tail where the side wraps round
    const wmax = Math.max(...g.top.map(p => p.y));
    const hg = ctx.createLinearGradient(X(0), 0, X(L), 0);
    for (let i = 0; i <= 24; i++) { const xm = i / 24 * L; const r = g.halfW(xm) / wmax; hg.addColorStop(i / 24, `rgba(0,0,0,${(Math.pow(1 - U.clamp(r, 0, 1), .55) * .7 * k).toFixed(3)})`); }
    ctx.fillStyle = hg; ctx.fillRect(X(0), Y(H), L * s, H * s);
    // (2) environment reflection, vertical: sky / shoulder / horizon / floor
    const belt = g.belt, sill = g.sillY;
    const hor = sill + (belt - sill) * .5;
    const v = ctx.createLinearGradient(0, Y(H), 0, Y(sill));
    const f = y => U.clamp((H - y) / (H - sill), 0, 1);
    v.addColorStop(0, `rgba(255,255,255,${.22 * k})`);
    v.addColorStop(f(belt + 70), `rgba(255,255,255,${.1 * k})`);
    v.addColorStop(f(belt + 22), `rgba(255,255,255,${.42 * k})`);
    v.addColorStop(f(belt - 10), `rgba(255,255,255,${.06 * k})`);
    v.addColorStop(f(hor + 30), `rgba(255,255,255,${.1 * k})`);
    v.addColorStop(f(hor + 4), `rgba(0,0,0,${.05 * k})`);
    v.addColorStop(f(hor - 6), `rgba(0,0,0,${.42 * k})`);
    v.addColorStop(f(hor - 40), `rgba(0,0,0,${.22 * k})`);
    v.addColorStop(f(sill + 90), `rgba(0,0,0,${.36 * k})`);
    v.addColorStop(1, `rgba(0,0,0,${.62 * k})`);
    ctx.fillStyle = v; ctx.fillRect(X(-10), Y(H), (L + 20) * s, (H - sill + 40) * s);
    // (3) crown highlight along hood / roof / deck
    ctx.save(); ctx.translate(0, Math.max(2, 22 * s)); path(ctx, g.side.slice(2, -2), X, Y, false);
    ctx.strokeStyle = `rgba(255,255,255,${.26 * k})`; ctx.lineWidth = Math.max(2, 40 * s); ctx.stroke(); ctx.restore();
    // (4) stamped character line + sill crease
    const cl = H * (b.charLine ?? .5);
    if (cl > sill + 60 && cl < belt - 20) {
      ctx.strokeStyle = `rgba(255,255,255,${.38 * k})`; ctx.lineWidth = Math.max(.8, 6 * s); ctx.beginPath(); ctx.moveTo(X(g.fx - g.Ra * .6), Y(cl + 12)); ctx.quadraticCurveTo(X(L / 2), Y(cl + 28), X(L - 120), Y(cl + 30)); ctx.stroke();
      ctx.strokeStyle = `rgba(0,0,0,${.3 * k})`; ctx.beginPath(); ctx.moveTo(X(g.fx - g.Ra * .6), Y(cl)); ctx.quadraticCurveTo(X(L / 2), Y(cl + 16), X(L - 120), Y(cl + 18)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(.6, 4 * s); ctx.beginPath(); ctx.moveTo(X(g.fx + g.Ra), Y(sill + 70)); ctx.lineTo(X(g.rx - g.Ra), Y(sill + 70)); ctx.stroke();
    // (5) shut lines
    const shut = (pts) => { ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = Math.max(.7, 5 * s); path(ctx, pts, X, Y, false); ctx.stroke(); ctx.save(); ctx.translate(Math.max(.6, 4 * s), 0); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = Math.max(.5, 3 * s); ctx.stroke(); ctx.restore(); };
    const A0 = g.A0, C0 = g.C0, doors = b.doors || 4;
    const dTop = belt + 10, dBot = sill + 20;
    const fDoor = Math.max(g.fx + g.Ra + 60, A0.x - 60);
    const bX = doors >= 4 ? U.lerp(A0.x, C0.x, .5) : U.lerp(A0.x, C0.x, .8);
    if (!b.bed || true) {
      shut([{ x: fDoor + 40, y: g.roof * .98 }, { x: fDoor + 10, y: dTop }, { x: fDoor - 20, y: dBot + 60 }, { x: fDoor + 10, y: dBot }]);
      shut([{ x: bX, y: g.roof * .99 }, { x: bX, y: dBot }]);
      shut([{ x: fDoor + 10, y: dBot }, { x: (doors >= 4 ? Math.min(C0.x, g.rx - g.Ra - 30) : bX), y: dBot }]);
      if (doors >= 4 && !b.bed) {
        const rX = Math.min(C0.x + 30, g.rx - g.Ra * .2), at = g.cy + g.Ra + 40;
        const pts = [{ x: rX, y: belt + 30 }, { x: rX, y: Math.max(at, sill + 80) }];
        for (let i = 0; i <= 8; i++) { const t = Math.PI / 2 + i / 8 * Math.PI / 2 * .95; pts.push({ x: g.rx + Math.cos(t) * (g.Ra + 40), y: g.cy + Math.sin(t) * (g.Ra + 40) }); }
        shut(pts);
      }
    }
    if (b.bed) shut([{ x: C0.x + 140, y: g.roof * .7 }, { x: C0.x + 140, y: dBot }]);
    if (st.bumper === 'integrated') { shut([{ x: g.fx - g.Ra - 60, y: sill + 40 }, { x: g.fx - g.Ra - 20, y: g.cy + g.Ra * .9 }, { x: 260, y: (U.yAt(g.side, 260, 'max') || 700) - 60 }]); shut([{ x: g.rx + g.Ra + 60, y: sill + 40 }, { x: g.rx + g.Ra + 30, y: g.cy + g.Ra * .9 }, { x: L - 260, y: (U.yAt(g.side, L - 260, 'max') || 700) - 90 }]); }
    // fuel door
    if (!b.bed) { ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = Math.max(.6, 4 * s); const fdx = Math.min(L - 500, g.rx + g.Ra * .2), fdy = belt - 160; ctx.beginPath(); ctx.roundRect(X(fdx), Y(fdy + 90), 170 * s, 90 * s, 25 * s); ctx.stroke(); }
    ctx.restore(); // end skin clip
    // arch lips
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(.8, 8 * s);
    for (const cx of [g.fx, g.rx]) { ctx.beginPath(); ctx.arc(X(cx), Y(g.cy), (g.Ra + 6) * s, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); }
    // ── glazing ──
    path(ctx, g.glass, X, Y);
    const gTop = Math.max(...g.glass.map(p => p.y)), gBot = Math.min(...g.glass.map(p => p.y));
    const gg = ctx.createLinearGradient(0, Y(gTop), 0, Y(gBot));
    gg.addColorStop(0, '#5e6f82'); gg.addColorStop(.35, '#28333f'); gg.addColorStop(1, '#0e1319');
    ctx.fillStyle = gg; ctx.fill();
    ctx.save(); ctx.clip();
    // interior silhouettes
    ctx.fillStyle = 'rgba(8,10,12,.7)';
    const seatRow = (x) => { ctx.beginPath(); ctx.roundRect(X(x), Y(belt + 260), 150 * s, 330 * s, 40 * s); ctx.fill(); if (year >= 1969) { ctx.beginPath(); ctx.roundRect(X(x + 10), Y(belt + 400), 120 * s, 150 * s, 40 * s); ctx.fill(); } };
    seatRow(U.lerp(A0.x, C0.x, .38)); if ((b.seats || 5) > 2 && doors >= 4) seatRow(U.lerp(A0.x, C0.x, .78));
    ctx.strokeStyle = 'rgba(8,10,12,.75)'; ctx.lineWidth = Math.max(1, 25 * s); ctx.beginPath(); ctx.ellipse(X(A0.x + 230), Y(belt + 120), 40 * s, 170 * s, -.35, 0, 7); ctx.stroke();
    // sky reflection sweep
    const rg = ctx.createLinearGradient(X(A0.x), Y(gTop), X(C0.x), Y(gBot));
    rg.addColorStop(0, 'rgba(255,255,255,.0)'); rg.addColorStop(.3, 'rgba(210,225,240,.22)'); rg.addColorStop(.42, 'rgba(255,255,255,.02)'); rg.addColorStop(.7, 'rgba(210,225,240,.12)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(X(A0.x - 100), Y(gTop + 10), (C0.x - A0.x + 300) * s, (gTop - gBot + 30) * s);
    ctx.restore();
    // window trim and pillars
    const trimC = st.trim === 'chrome' ? chromeGrad(ctx, Y(gTop), Y(gBot)) : '#0c0d0f';
    path(ctx, g.glass, X, Y); ctx.strokeStyle = trimC; ctx.lineWidth = Math.max(1, (st.trim === 'black' ? 16 : 14) * s); ctx.stroke();
    const bTop = U.yAt(g.glass, bX, 'max');
    if (bTop != null) { ctx.fillStyle = st.trim === 'chrome' ? paint : '#0d0e10'; ctx.fillRect(X(bX - 45), Y(bTop + 10), 90 * s, (bTop - belt + 20) * s); if (st.trim === 'chrome') { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(X(bX - 45), Y(bTop + 10), 90 * s, (bTop - belt + 20) * s); } }
    if (st.trim !== 'black') { ctx.fillStyle = chromeGrad(ctx, Y(belt + 8), Y(belt - 8)); ctx.fillRect(X(A0.x), Y(belt + 8), (C0.x - A0.x) * s, Math.max(1, 16 * s)); }
    // mirror
    if (st.mirror === 'door') { const mx = A0.x + 40, my = belt + 70; ctx.fillStyle = year >= 1985 ? (year >= 2000 ? paint : '#121315') : chromeGrad(ctx, Y(my + 60), Y(my - 60)); ctx.beginPath(); ctx.moveTo(X(mx - 30), Y(my - 40)); ctx.quadraticCurveTo(X(mx + 40), Y(my + 90), X(mx + 200), Y(my + 50)); ctx.lineTo(X(mx + 190), Y(my - 45)); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill(); }
    // door handles
    const hY = belt - 90;
    const handle = x => { if (year < 1975) { ctx.fillStyle = chromeGrad(ctx, Y(hY + 18), Y(hY - 18)); ctx.beginPath(); ctx.roundRect(X(x), Y(hY + 16), 150 * s, 32 * s, 12 * s); ctx.fill(); } else { ctx.fillStyle = year < 1995 ? '#141517' : 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.roundRect(X(x), Y(hY + 16), 160 * s, 30 * s, 14 * s); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(X(x + 10), Y(hY + 16), 140 * s, Math.max(.5, 4 * s)); } };
    handle(bX - 280); if (doors >= 4 && !b.bed) handle(Math.min(C0.x, g.rx - g.Ra) - 280);
    // ── lamps ──
    const yAtUp = x => U.yAt(g.side, U.clamp(x, .5, L - .5), 'max') ?? H * .5;
    const noseTop = yAtUp(30), bumpC = b.clr + (noseTop - b.clr) * .34;
    const lampY = U.lerp(bumpC, noseTop, .62);
    if (st.lamp === 'pod' || st.lamp === 'round') {
      const lx = st.lamp === 'pod' ? 110 : 25;
      ctx.fillStyle = chromeGrad(ctx, Y(lampY + 100), Y(lampY - 100)); ctx.beginPath(); ctx.ellipse(X(lx), Y(lampY), 34 * s, 98 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#eef0e6'; ctx.beginPath(); ctx.ellipse(X(lx - 8), Y(lampY), 18 * s, 80 * s, 0, 0, 7); ctx.fill();
    } else if (st.lamp === 'rect') {
      ctx.fillStyle = '#e4e7ea'; ctx.fillRect(X(0), Y(lampY + 75), 30 * s, 150 * s);
      ctx.fillStyle = '#d98a1d'; ctx.beginPath(); ctx.roundRect(X(20), Y(lampY + 60), 180 * s, 110 * s, 10 * s); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(X(30), Y(lampY + 55), 160 * s, 20 * s);
    } else {
      const len = st.lamp === 'led' ? 640 : 470, hgt = st.lamp === 'led' ? 70 : 150;
      const top = []; for (let x = 20; x <= len; x += 30) top.push({ x, y: yAtUp(x) - 22 });
      const bot = top.slice().reverse().map((p, i, a) => ({ x: p.x, y: p.y - hgt * (st.lamp === 'led' ? .4 + .6 * (p.x / len) : .9 - .5 * (p.x / len)) - 10 }));
      path(ctx, top.concat(bot), X, Y);
      const lg = ctx.createLinearGradient(0, Y(lampY + hgt), 0, Y(lampY - hgt)); lg.addColorStop(0, '#f6f8fb'); lg.addColorStop(.5, '#b9c2cc'); lg.addColorStop(1, '#6d7780');
      const lg2 = ctx.createLinearGradient(0, Y(lampY + hgt), 0, Y(lampY - hgt)); lg2.addColorStop(0, '#9aa4ae'); lg2.addColorStop(.45, '#2a3038'); lg2.addColorStop(1, '#4b535c');
      ctx.fillStyle = st.lamp === 'led' ? lg2 : lg; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(.5, 3 * s); ctx.stroke();
      if (st.lamp === 'led') { ctx.fillStyle = 'rgba(235,240,248,.85)'; ctx.beginPath(); ctx.arc(X(len * .3), Y(top[Math.floor(top.length * .3)].y - hgt * .45), 22 * s, 0, 7); ctx.fill(); }
      if (st.lamp === 'led') { ctx.strokeStyle = '#eaf4ff'; ctx.lineWidth = Math.max(1, 14 * s); ctx.beginPath(); top.forEach((p, i) => i ? ctx.lineTo(X(p.x), Y(p.y - 18)) : ctx.moveTo(X(p.x), Y(p.y - 18))); ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(X(len * .35), Y(lampY + 10), 38 * s, 0, 7); ctx.fill(); ctx.fillStyle = '#e39a2b'; ctx.fillRect(X(len - 120), Y(top[top.length - 1].y - 10), 90 * s, 60 * s); }
    }
    if (st.marker) { ctx.fillStyle = '#d98a1d'; ctx.fillRect(X(Math.max(120, g.fx - g.Ra - 200)), Y(bumpC + 70), 70 * s, 30 * s); ctx.fillStyle = '#a3121a'; ctx.fillRect(X(Math.min(L - 190, g.rx + g.Ra + 130)), Y(bumpC + 80), 70 * s, 30 * s); }
    // tail lamps
    const tailTop = yAtUp(L - 30);
    ctx.fillStyle = '#9e1119';
    if (st.tail === 'fin') { for (const dy of [70, 170]) { ctx.beginPath(); ctx.ellipse(X(L - 50), Y(tailTop - dy), 45 * s, 32 * s, 0, 0, 7); ctx.fill(); } }
    else if (st.tail === 'small') { ctx.beginPath(); ctx.ellipse(X(L - 20), Y(tailTop - 80), 22 * s, 60 * s, 0, 0, 7); ctx.fill(); }
    else if (st.tail === 'band') { ctx.fillRect(X(L - 150), Y(tailTop - 40), 150 * s, 130 * s); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(X(L - 150), Y(tailTop - 40), 150 * s, 18 * s); }
    else { const pts = []; for (let x = L - 30; x >= L - 420; x -= 30) pts.push({ x, y: yAtUp(x) - 25 }); const bot = pts.slice().reverse().map(p => ({ x: p.x, y: p.y - 120 + (L - p.x) * .12 })); path(ctx, pts.concat(bot), X, Y); const tg = ctx.createLinearGradient(0, Y(tailTop), 0, Y(tailTop - 160)); tg.addColorStop(0, '#d42a33'); tg.addColorStop(1, '#6b0b11'); ctx.fillStyle = tg; ctx.fill(); }
    // ── bumpers ──
    const bumpH = st.bumper === 'blade' ? 120 : 175;
    if (st.bumper === 'blade') {
      for (const [x0, x1] of [[-25, 340], [L - 340, L + 25]]) { ctx.fillStyle = chromeGrad(ctx, Y(bumpC + bumpH / 2), Y(bumpC - bumpH / 2)); ctx.beginPath(); ctx.roundRect(X(x0), Y(bumpC + bumpH / 2), (x1 - x0) * s, bumpH * s, 40 * s); ctx.fill(); }
      if (year < 1959) for (const x of [120, L - 160]) { ctx.fillStyle = chromeGrad(ctx, Y(bumpC + 150), Y(bumpC - 80)); ctx.beginPath(); ctx.roundRect(X(x), Y(bumpC + 150), 50 * s, 230 * s, 25 * s); ctx.fill(); }
    } else if (st.bumper === 'impact') {
      for (const [x0, x1] of [[-60, 380], [L - 380, L + 60]]) { ctx.fillStyle = year < 1980 ? chromeGrad(ctx, Y(bumpC + bumpH / 2), Y(bumpC - bumpH / 2)) : '#2b2d31'; ctx.beginPath(); ctx.roundRect(X(x0), Y(bumpC + bumpH / 2), (x1 - x0) * s, bumpH * s, 25 * s); ctx.fill(); ctx.fillStyle = '#121315'; ctx.fillRect(X(x0), Y(bumpC + 25), (x1 - x0) * s, 50 * s); }
    } else {
      ctx.save(); path(ctx, g.poly, X, Y); ctx.clip();
      const ig = ctx.createLinearGradient(0, Y(b.clr + 230), 0, Y(b.clr)); ig.addColorStop(0, '#24272b'); ig.addColorStop(1, '#08090a');
      ctx.fillStyle = ig; ctx.beginPath(); ctx.roundRect(X(-40), Y(b.clr + 210), Math.min(330, g.fx - g.Ra - 60) * s, 150 * s, 30 * s); ctx.fill();
      ctx.fillStyle = '#0d0e10'; ctx.fillRect(X(L - 380), Y(b.clr + 110), 420 * s, 90 * s);
      if (car.segment === 'suv' || b.clr > 185) { ctx.fillStyle = 'rgba(18,19,21,.92)'; ctx.fillRect(X(0), Y(g.sillY + 120), L * s, 125 * s); for (const cx of [g.fx, g.rx]) { ctx.strokeStyle = 'rgba(18,19,21,.95)'; ctx.lineWidth = 55 * s; ctx.beginPath(); ctx.arc(X(cx), Y(g.cy), (g.Ra + 20) * s, Math.PI, 0); ctx.stroke(); } }
      ctx.restore();
    }
    // outline
    path(ctx, g.poly, X, Y); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = Math.max(.8, 5 * s); ctx.stroke();
    return g;
  };

  // ── plan view ──────────────────────────────────────────────────────
  const drawTop = (ctx, car, o) => {
    const b = car.body, s = o.scale, year = o.year, st = R.styleFor(car, year);
    const X = mm => o.x + mm * s, Y = mm => o.y + mm * s;
    const g = R.geom(car), L = b.L;
    const right = g.top.map(p => ({ x: p.x, y: p.y })), left = g.top.slice().reverse().map(p => ({ x: p.x, y: -p.y }));
    const poly = right.concat(left);
    const tw = car.tireW;
    ctx.save(); ctx.filter = 'blur(' + Math.max(2, 40 * s) + 'px)'; ctx.fillStyle = 'rgba(0,0,0,.45)'; path(ctx, poly.map(p => ({ x: p.x + 40, y: p.y * 1.04 + 60 })), X, Y); ctx.fill(); ctx.filter = 'none'; ctx.restore();
    ctx.fillStyle = '#0c0d0f';
    for (const cx of [g.fx, g.rx]) for (const sg of [1, -1]) { const hw = g.halfW(cx) - 30; ctx.beginPath(); ctx.roundRect(X(cx - g.wr), Y(sg > 0 ? hw - tw * .6 : -hw - tw * .4), g.tyreD * s, tw * s, 20 * s); ctx.fill(); }
    ctx.save(); path(ctx, poly, X, Y); ctx.clip();
    const sk = skin(car, year);
    ctx.fillStyle = sk.raw ? '#777b80' : (b.paint || '#888'); ctx.fillRect(X(0), Y(-b.W / 2), L * s, b.W * s);
    R.warp(ctx, sk.img, t => ({ x: X(t * L), y: Y(-g.halfW(t * L)) - 1 }), t => ({ x: X(t * L), y: Y(g.halfW(t * L)) + 1 }), 34, 6, 1);
    const k = sk.raw ? .6 : 1;
    const cg = ctx.createLinearGradient(0, Y(-b.W / 2), 0, Y(b.W / 2));
    cg.addColorStop(0, `rgba(0,0,0,${.55 * k})`); cg.addColorStop(.12, `rgba(0,0,0,${.15 * k})`); cg.addColorStop(.3, `rgba(255,255,255,${.2 * k})`); cg.addColorStop(.38, `rgba(255,255,255,${.05 * k})`);
    cg.addColorStop(.62, `rgba(255,255,255,${.05 * k})`); cg.addColorStop(.7, `rgba(255,255,255,${.2 * k})`); cg.addColorStop(.88, `rgba(0,0,0,${.15 * k})`); cg.addColorStop(1, `rgba(0,0,0,${.55 * k})`);
    ctx.fillStyle = cg; ctx.fillRect(X(0), Y(-b.W / 2), L * s, b.W * s);
    // glazing: windscreen, roof, backlight
    const A0 = g.A0.x, A1 = g.A1.x, C1 = g.C1.x, C0 = g.C0.x;
    const tumble = .82;
    const wsc = (x0, x1, w0, w1, bow) => { ctx.beginPath(); ctx.moveTo(X(x0), Y(-w0)); ctx.quadraticCurveTo(X(x0 - bow), Y(0), X(x0), Y(w0)); ctx.lineTo(X(x1), Y(w1)); ctx.quadraticCurveTo(X(x1 - bow * .6), Y(0), X(x1), Y(-w1)); ctx.closePath(); };
    const gl = ctx.createLinearGradient(0, Y(-b.W / 2), 0, Y(b.W / 2)); gl.addColorStop(0, '#0d1218'); gl.addColorStop(.45, '#3c4a59'); gl.addColorStop(.55, '#26313d'); gl.addColorStop(1, '#0d1218');
    ctx.fillStyle = gl;
    wsc(A0, A1, g.halfW(A0) * .86, g.halfW(A1) * tumble, 90); ctx.fill();
    if (!b.bed) { wsc(C1, C0, g.halfW(C1) * tumble, g.halfW(C0) * .84, -60); ctx.fill(); }
    const rf = ctx.createLinearGradient(0, Y(-b.W * .4), 0, Y(b.W * .4)); rf.addColorStop(0, 'rgba(0,0,0,.3)'); rf.addColorStop(.5, 'rgba(255,255,255,.16)'); rf.addColorStop(1, 'rgba(0,0,0,.3)');
    ctx.fillStyle = rf; ctx.fillRect(X(A1), Y(-g.halfW(A1) * tumble), (C1 - A1) * s, g.halfW(A1) * tumble * 2 * s);
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = Math.max(.6, 5 * s);
    ctx.beginPath(); ctx.moveTo(X(A1), Y(-g.halfW(A1) * tumble)); ctx.lineTo(X(C1), Y(-g.halfW(C1) * tumble)); ctx.moveTo(X(A1), Y(g.halfW(A1) * tumble)); ctx.lineTo(X(C1), Y(g.halfW(C1) * tumble)); ctx.stroke();
    // hood & deck shut lines
    const hl = (x0, x1, f) => { ctx.beginPath(); ctx.moveTo(X(x0), Y(-g.halfW(x0) * f)); ctx.lineTo(X(x1), Y(-g.halfW(x1) * f)); ctx.moveTo(X(x0), Y(g.halfW(x0) * f)); ctx.lineTo(X(x1), Y(g.halfW(x1) * f)); ctx.stroke(); };
    hl(A0 - 60, 180, .86); ctx.beginPath(); ctx.moveTo(X(A0 - 60), Y(-g.halfW(A0) * .86)); ctx.lineTo(X(A0 - 60), Y(g.halfW(A0) * .86)); ctx.stroke();
    if (!b.hatch && !b.bed) hl(C0 + 60, L - 120, .86);
    if (b.bed) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(X(C0 + 150), Y(-b.W * .43), (L - C0 - 210) * s, b.W * .86 * s); }
    // wipers
    ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(.8, 12 * s); for (const yy of [-.35, .2]) { ctx.beginPath(); ctx.moveTo(X(A0 + 20), Y(yy * b.W)); ctx.lineTo(X(A0 + 160), Y(yy * b.W + 260)); ctx.stroke(); }
    ctx.restore();
    if (st.mirror === 'door') { ctx.fillStyle = year >= 2000 ? (b.paint || '#888') : '#141518'; for (const sg of [1, -1]) { ctx.beginPath(); ctx.roundRect(X(A0 + 60), Y(sg * (g.halfW(A0) + (sg > 0 ? 0 : 150))), 140 * s, 150 * s, 30 * s); ctx.fill(); } }
    path(ctx, poly, X, Y); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = Math.max(.8, 5 * s); ctx.stroke();
    ctx.fillStyle = st.lamp === 'led' ? '#eaf4ff' : '#f0efe4'; for (const sg of [1, -1]) { ctx.beginPath(); ctx.roundRect(X(20), Y(sg * g.halfW(80) * .78 - 70), 70 * s, 140 * s, 20 * s); ctx.fill(); }
    ctx.fillStyle = '#a3121a'; for (const sg of [1, -1]) { ctx.beginPath(); ctx.roundRect(X(L - 70), Y(sg * g.halfW(L - 80) * .78 - 90), 60 * s, 180 * s, 15 * s); ctx.fill(); }
    return g;
  };

  // panel regions in side view (mm) for tailored blanks / per-panel status
  R.panelRects = (car, g) => {
    const b = car.body, A = g.A0.x, C = g.C0.x, bX = (b.doors >= 4) ? U.lerp(A, C, .5) : U.lerp(A, C, .8);
    const fDoor = Math.max(g.fx + g.Ra + 60, A - 60), rEnd = b.doors >= 4 ? Math.min(C + 30, g.rx - g.Ra * .2) : bX;
    return [
      { id: 'fender', name: '프런트 펜더', x0: 0, x1: fDoor, y0: 0, y1: b.H },
      { id: 'door', name: b.doors >= 4 ? '프런트 도어' : '도어', x0: fDoor, x1: bX, y0: 0, y1: g.belt + 10 },
      ...(b.doors >= 4 ? [{ id: 'rdoor', name: '리어 도어', x0: bX, x1: rEnd, y0: 0, y1: g.belt + 10 }] : []),
      { id: 'quarter', name: '리어 쿼터', x0: rEnd, x1: b.L, y0: 0, y1: b.H },
      { id: 'roof', name: '루프·필러', x0: fDoor, x1: rEnd, y0: g.belt + 10, y1: b.H }
    ];
  };

  // ── cached public API ───────────────────────────────────────────────
  const cache = new Map();
  const keyOf = (car, kind, year, s) => { const b = car.body; return kind + '|' + year + '|' + s.toFixed(4) + '|' + (car._rev || 0) + '|' + JSON.stringify([b.side, b.glass, b.top, b.L, b.W, b.H, b.wb, b.foh, b.clr, b.doors, b.paint, b.sheet, b.grade, b.rawSheet, b.metallic, b.chrome, b.charLine, b.style, b.panels, b.seats, (b.customTex || '').length, car.tireW, car.tireAR, car.rim, car.brakes, car.segment, car.powertrain]); };
  const render = (kind, car, year, s, padX, padY) => {
    const k = keyOf(car, kind, year, s);
    let c = cache.get(k);
    if (c) return c;
    const b = car.body, dpr = window.devicePixelRatio || 1;
    c = document.createElement('canvas');
    const W = (b.L + padX * 2) * s, H = (kind === 'side' ? b.H + padY * 2 : b.W + padY * 2) * s;
    c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr);
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    if (kind === 'side') drawSide(x, car, { x: padX * s, y: H - padY * s, scale: s, year });
    else drawTop(x, car, { x: padX * s, y: H / 2, scale: s, year });
    c.cssW = W; c.cssH = H; c.padX = padX; c.padY = padY;
    cache.set(k, c); if (cache.size > 60) cache.delete(cache.keys().next().value);
    return c;
  };
  // o: {x, y (ground), scale, year, reflect}
  R.drawCarSide = (ctx, car, o) => {
    const c = render('side', car, o.year, o.scale, 260, 140);
    const x0 = o.x - c.padX * o.scale, y0 = o.y - c.cssH + c.padY * o.scale;
    if (o.reflect) {
      ctx.save(); ctx.globalAlpha = .16; ctx.translate(0, o.y * 2); ctx.scale(1, -1); ctx.drawImage(c, x0, y0, c.cssW, c.cssH); ctx.restore();
      const fade = ctx.createLinearGradient(0, o.y, 0, o.y + o.scale * 900); fade.addColorStop(0, o.floor + '00'); fade.addColorStop(1, o.floor + 'ff');
      ctx.fillStyle = fade; ctx.fillRect(x0, o.y, c.cssW, o.scale * 900);
    }
    ctx.drawImage(c, x0, y0, c.cssW, c.cssH);
    return R.geom(car);
  };
  R.drawCarTop = (ctx, car, o) => {
    const c = render('top', car, o.year, o.scale, 200, 200);
    ctx.drawImage(c, o.x - c.padX * o.scale, o.y - c.cssH / 2, c.cssW, c.cssH);
    return R.geom(car);
  };
  // studio backdrop for viewports
  R.studio = (ctx, W, H, groundY, pal) => {
    const g = ctx.createLinearGradient(0, 0, 0, groundY); g.addColorStop(0, pal.sky0); g.addColorStop(1, pal.sky1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY);
    const f = ctx.createLinearGradient(0, groundY, 0, H); f.addColorStop(0, pal.floor0); f.addColorStop(1, pal.floor1);
    ctx.fillStyle = f; ctx.fillRect(0, groundY, W, H - groundY);
    const v = ctx.createRadialGradient(W / 2, groundY, 10, W / 2, groundY, W * .7); v.addColorStop(0, 'rgba(255,255,255,.08)'); v.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  };
  // mini plan-view silhouette (factory conveyor)
  R.drawCarMini = (ctx, car, x, y, len, ang, painted, stage) => {
    const b = car.body, s = len / b.L, g = R.geom(car);
    ctx.save(); ctx.translate(x - len / 2, y); ctx.rotate(ang);
    ctx.beginPath(); g.top.forEach((p, i) => i ? ctx.lineTo(p.x * s, p.y * s) : ctx.moveTo(p.x * s, p.y * s)); for (let i = g.top.length - 1; i >= 0; i--) ctx.lineTo(g.top[i].x * s, -g.top[i].y * s); ctx.closePath();
    ctx.fillStyle = stage <= 1 ? '#a3a8ae' : painted ? (b.paint || '#888') : '#d2d5d8'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.stroke();
    if (stage >= 3) { ctx.fillStyle = '#1c242d'; ctx.fillRect(g.A0.x * s, -b.W * s * .36, (g.A1.x - g.A0.x) * s, b.W * s * .72); ctx.fillRect(g.C1.x * s, -b.W * s * .34, (g.C0.x - g.C1.x) * s, b.W * s * .68); }
    ctx.restore();
  };
})(window.MW);
