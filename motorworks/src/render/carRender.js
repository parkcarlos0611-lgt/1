// 2D car renderer: side view and top view. Body skin = selected sheet texture (or a
// user-supplied image) warped along the body contour, then paint, curvature shading,
// stamped character line, panel gaps, glazing, lamps, bumpers and wheels by era.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim, R = MW.render;

  const skinImage = (b, year, gloss = .75, redraw) => {
    if (b.customTex) { const im = R.userImage(b.customTex, redraw); if (im) return { img: im, raw: true }; }
    if (b.rawSheet) return { img: R.sheetTexture(D.byId(D.C.sheet, b.sheet).tex), raw: true };
    const metallic = year >= 1958 && b.metallic ? 1 : 0;
    return { img: R.paintTexture(b.paint || '#888888', gloss, metallic), raw: false };
  };

  // build the closed side silhouette polygon (screen coords)
  R.sidePoly = (b, X, Y) => {
    const g = S.bodyGeom(b);
    const up = g.side.map(p => ({ x: X(p.x), y: Y(p.y) }));
    const lowY = b.clr + 40;
    const bottom = [{ x: X(b.L * .995), y: Y(lowY + 30) }, { x: X(b.L * .97), y: Y(lowY) }, { x: X(b.L * .03), y: Y(lowY) }, { x: X(b.L * .005), y: Y(lowY + 30) }];
    return { up, poly: up.concat(bottom), g, lowY };
  };

  R.drawCarSide = (ctx, car, o) => {
    const b = car.body, year = o.year || car.year || 1960, s = o.scale;
    const X = mm => o.x + mm * s, Y = mm => o.y - mm * s;
    const { up, poly, g, lowY } = R.sidePoly(b, X, Y);
    const tireD = o.tireD || ((car.rim * 25.4 + 2 * car.tireW * car.tireAR / 100));
    const wr = tireD / 2;
    // ground shadow
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(X(b.L / 2), Y(0) + 3, b.L * s * .52, 7 * Math.max(.6, s * 4), 0, 0, 7); ctx.fill(); ctx.restore();
    // body skin
    ctx.save();
    ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    ctx.save(); ctx.clip();
    // wheel arches cut out by not painting: we paint body then the arch shadow
    const sk = skinImage(b, year, o.gloss ?? .75, o.redraw);
    const xs0 = 0, xs1 = b.L;
    const topAt = t => { const xm = U.lerp(xs0, xs1, t); const yy = U.yAt(g.side, xm, 'max') ?? lowY; return { x: X(xm), y: Y(Math.max(yy, lowY)) - 1 }; };
    const botAt = t => ({ x: X(U.lerp(xs0, xs1, t)), y: Y(lowY - 2) });
    ctx.fillStyle = sk.raw ? '#777b80' : (b.paint || '#888'); ctx.fill();
    R.warp(ctx, sk.img, topAt, botAt, 34, 5, 1);
    // curvature shading: side bulge (vertical), highlight band and shoulder shadow
    const yTop = Math.min(...up.map(p => p.y)), yBot = Y(lowY);
    const shade = ctx.createLinearGradient(0, yTop, 0, yBot);
    shade.addColorStop(0, 'rgba(255,255,255,.22)'); shade.addColorStop(.32, 'rgba(255,255,255,.04)');
    const belt = Y(b.H * (b.charLine || .55));
    const bf = U.clamp((belt - yTop) / (yBot - yTop), .05, .9);
    shade.addColorStop(bf - .02, 'rgba(255,255,255,.28)'); shade.addColorStop(bf + .03, 'rgba(0,0,0,.12)');
    shade.addColorStop(.85, 'rgba(0,0,0,.18)'); shade.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = shade; ctx.fillRect(X(0) - 5, yTop - 5, b.L * s + 10, yBot - yTop + 10);
    // sky reflection streak (only on painted / polished)
    if (!sk.raw || b.sheet === 'alu') { ctx.globalCompositeOperation = 'screen'; const rg = ctx.createLinearGradient(X(0), 0, X(b.L), 0); rg.addColorStop(0, 'rgba(120,140,170,0)'); rg.addColorStop(.4, 'rgba(160,180,210,.16)'); rg.addColorStop(.55, 'rgba(120,140,170,0)'); ctx.fillStyle = rg; ctx.fillRect(X(0), belt - 8 * s * 10, b.L * s, 14 * s * 10); ctx.globalCompositeOperation = 'source-over'; }
    // stamped character line
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1, s * 6); ctx.beginPath(); ctx.moveTo(X(b.L * .03), belt); ctx.lineTo(X(b.L * .97), belt - s * 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(X(b.L * .03), belt + Math.max(1, s * 8)); ctx.lineTo(X(b.L * .97), belt + Math.max(1, s * 8) - s * 10); ctx.stroke();
    // fenders (1940s): separate pontoon fenders over the wheels
    if (b.fenders) {
      for (const cx of [g.fx, g.rx]) {
        const fr = wr * 1.5;
        const fg = ctx.createRadialGradient(X(cx), Y(wr * 1.2), 2, X(cx), Y(wr), fr * s);
        fg.addColorStop(0, 'rgba(255,255,255,.12)'); fg.addColorStop(.75, 'rgba(0,0,0,.05)'); fg.addColorStop(1, 'rgba(0,0,0,.35)');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(X(cx), Y(wr * .95), fr * 1.05 * s, fr * .72 * s, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
      }
    }
    // panel gaps: doors, hood, trunk
    const gl = b.glass, aX = gl[0].x * b.L, cX = gl[gl.length - 1].x * b.L;
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = Math.max(.8, s * 4);
    const doorTop = Y(b.H * (gl[0].y)), doorBot = Y(lowY + 25);
    const bX = b.doors >= 4 ? U.lerp(aX, cX, .5) : U.lerp(aX, cX, .78);
    const vline = (xm, y0, y1, lean = 0) => { ctx.beginPath(); ctx.moveTo(X(xm), y0); ctx.lineTo(X(xm + lean), y1); ctx.stroke(); };
    const dA = aX + 60, dC = b.doors >= 4 ? Math.min(cX, g.rx - wr * 1.05) : bX;
    vline(dA, doorTop - 4 * s * 10, doorBot, -15); vline(bX, Y(b.H * .97), doorBot);
    if (b.doors >= 4) vline(dC, Y(b.H * .9), doorBot, 20);
    ctx.beginPath(); ctx.moveTo(X(dA - 15), doorBot); ctx.lineTo(X(dC), doorBot); ctx.stroke();
    // hood & deck cut lines
    vline(aX - 40, Y(b.H * gl[0].y), Y(b.H * gl[0].y) + 6 * s * 10);
    // handles
    ctx.fillStyle = year < 1970 ? 'rgba(235,235,240,.9)' : 'rgba(0,0,0,.45)';
    const hy = belt + 18 * s; ctx.fillRect(X(bX - 220), hy, 120 * s, Math.max(2, 18 * s)); if (b.doors >= 4) ctx.fillRect(X(dC - 200), hy, 120 * s, Math.max(2, 18 * s));
    if (b.bed) { vline(g.rx - b.wb * .45, Y(b.H * .62), doorBot); }
    // wheel arches (cut into the body skin)
    for (const cx of [g.fx, g.rx]) { const ag = ctx.createRadialGradient(X(cx), Y(wr), wr * s * .9, X(cx), Y(wr), wr * s * 1.12); ag.addColorStop(0, '#050607'); ag.addColorStop(1, '#1a1c20'); ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(X(cx), Y(wr), wr * s * (b.fenders ? 1.04 : 1.12), 0, 7); ctx.fill(); }
    ctx.restore(); // unclip
    // greenhouse glass
    const gp = U.spline(b.glass.map(p => ({ x: p.x * b.L, y: p.y * b.H })), 8, true).map(p => ({ x: X(p.x), y: Y(p.y) }));
    ctx.beginPath(); gp.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    const gg = ctx.createLinearGradient(0, Math.min(...gp.map(p => p.y)), 0, Math.max(...gp.map(p => p.y)));
    gg.addColorStop(0, '#46576b'); gg.addColorStop(.45, '#1c2733'); gg.addColorStop(1, '#0d131a');
    ctx.fillStyle = gg; ctx.fill();
    ctx.strokeStyle = year < 1975 && b.chrome > .3 ? 'rgba(230,232,236,.9)' : 'rgba(10,10,12,.85)'; ctx.lineWidth = Math.max(1, s * 12); ctx.stroke();
    // B pillar
    ctx.fillStyle = 'rgba(12,12,14,.9)'; const bpT = U.yAt(gp, X(bX), 'min'); if (bpT != null) ctx.fillRect(X(bX) - Math.max(1.5, 30 * s), bpT, Math.max(3, 60 * s), Y(b.H * gl[0].y) - bpT + 2);
    // lamps
    const noseTop = U.yAt(g.side, b.L * .02, 'max') ?? b.H * .45;
    const hy0 = Y(Math.min(noseTop - 70, b.H * .5));
    const lampF = year < 1975 ? 'round' : year < 1990 ? 'rect' : year < 2010 ? 'proj' : 'led';
    ctx.fillStyle = '#f5f1dc';
    if (lampF === 'round') { ctx.beginPath(); ctx.ellipse(X(35), hy0, Math.max(2, 25 * s), Math.max(3, 90 * s), 0, 0, 7); ctx.fill(); ctx.fillStyle = '#e8e8ea'; ctx.fillRect(X(10), hy0 - 95 * s, 30 * s, 190 * s); }
    else if (lampF === 'rect') ctx.fillRect(X(5), hy0 - 60 * s, Math.max(3, 40 * s), 120 * s);
    else if (lampF === 'proj') { ctx.beginPath(); ctx.moveTo(X(10), hy0 - 50 * s); ctx.lineTo(X(260), hy0 - 75 * s); ctx.lineTo(X(240), hy0 + 10 * s); ctx.lineTo(X(15), hy0 + 40 * s); ctx.closePath(); ctx.fillStyle = 'rgba(240,244,250,.85)'; ctx.fill(); }
    else { ctx.fillStyle = '#eaf3ff'; ctx.fillRect(X(20), hy0 - 30 * s, 300 * s, Math.max(2, 22 * s)); }
    // tail lamp
    const tailTop = U.yAt(g.side, b.L * .985, 'max') ?? b.H * .5;
    ctx.fillStyle = '#b3131b'; ctx.fillRect(X(b.L) - Math.max(3, 30 * s) - 2 * s, Y(tailTop - 40), Math.max(3, 30 * s), Math.max(4, (year < 1962 ? 180 : 130) * s));
    if (b.preset === 'fin50') { ctx.fillStyle = '#d0141f'; ctx.beginPath(); ctx.ellipse(X(b.L - 60), Y(tailTop - 70), 18 * s, 50 * s, 0, 0, 7); ctx.fill(); }
    // bumpers
    const chromeB = year < 1975 && b.chrome > .25;
    const bumpH = Math.max(3, (chromeB ? 110 : 140) * s), bumpY = Y(lowY + (chromeB ? 220 : 260));
    const bg = ctx.createLinearGradient(0, bumpY, 0, bumpY + bumpH);
    if (chromeB) { bg.addColorStop(0, '#fbfcfd'); bg.addColorStop(.45, '#8d939b'); bg.addColorStop(.55, '#e3e6ea'); bg.addColorStop(1, '#5c6168'); }
    else if (year < 1990) { bg.addColorStop(0, '#2a2b2e'); bg.addColorStop(1, '#111214'); }
    else { bg.addColorStop(0, 'rgba(255,255,255,.08)'); bg.addColorStop(1, 'rgba(0,0,0,.25)'); }
    ctx.fillStyle = bg; ctx.fillRect(X(-20), bumpY, 260 * s, bumpH); ctx.fillRect(X(b.L - 240), bumpY, 260 * s, bumpH);
    // wheels
    const drawWheel = (cx) => {
      const x0 = X(cx), y0 = Y(wr), r = wr * s;
      const tg = ctx.createRadialGradient(x0, y0, r * .5, x0, y0, r); tg.addColorStop(0, '#2b2d31'); tg.addColorStop(.85, '#151618'); tg.addColorStop(1, '#0a0a0b');
      ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(x0, y0, r, 0, 7); ctx.fill();
      const rimR = (car.rim * 25.4 / 2) * s;
      if (year < 1965) { ctx.fillStyle = '#f2f2ee'; ctx.beginPath(); ctx.arc(x0, y0, rimR * 1.35, 0, 7); ctx.fill(); } // whitewall
      const rg = ctx.createRadialGradient(x0 - rimR * .3, y0 - rimR * .3, 1, x0, y0, rimR);
      rg.addColorStop(0, '#f4f5f7'); rg.addColorStop(.6, year < 1965 ? '#a8adb5' : '#8a9099'); rg.addColorStop(1, '#3a3e44');
      ctx.fillStyle = year < 1965 ? '#1d1e21' : rg; ctx.beginPath(); ctx.arc(x0, y0, rimR, 0, 7); ctx.fill();
      if (year < 1965) { ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x0, y0, rimR * .72, 0, 7); ctx.fill(); }
      else {
        const spokes = year < 1985 ? 0 : year < 2000 ? 7 : 5;
        if (spokes) { ctx.strokeStyle = 'rgba(30,32,36,.85)'; ctx.lineWidth = Math.max(1, rimR * .2); for (let i = 0; i < spokes; i++) { const a = o.spin * 1 + i / spokes * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x0 + Math.cos(a + .35) * rimR * .3, y0 + Math.sin(a + .35) * rimR * .3); ctx.lineTo(x0 + Math.cos(a + .35) * rimR * .92, y0 + Math.sin(a + .35) * rimR * .92); ctx.stroke(); } }
        else { ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x0, y0, rimR * .6, 0, 7); ctx.stroke(); }
      }
      ctx.fillStyle = '#2a2c30'; ctx.beginPath(); ctx.arc(x0, y0, Math.max(1.5, rimR * .16), 0, 7); ctx.fill();
      // brake disc behind spokes
      if (car.brakes !== 'drum' && year >= 1985) { ctx.strokeStyle = car.brakes === 'ccb' ? 'rgba(220,200,40,.8)' : 'rgba(150,40,30,.6)'; ctx.lineWidth = Math.max(1, rimR * .18); ctx.beginPath(); ctx.arc(x0, y0, rimR * .72, -1.2, -.3); ctx.stroke(); }
    };
    if (!b.fenders) { drawWheel(g.fx); drawWheel(g.rx); }
    else { drawWheel(g.fx); drawWheel(g.rx); }
    // outline
    ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    return { X, Y, g, wr };
  };

  R.drawCarTop = (ctx, car, o) => {
    const b = car.body, s = o.scale, year = o.year || car.year;
    const X = mm => o.x + mm * s, Y = mm => o.y + mm * s; // y=0 centreline
    const g = S.bodyGeom(b);
    const right = g.top.map(p => ({ x: X(p.x), y: Y(p.y) })), left = g.top.slice().reverse().map(p => ({ x: X(p.x), y: Y(-p.y) }));
    const poly = right.concat(left);
    const tireD = (car.rim * 25.4 + 2 * car.tireW * car.tireAR / 100), wr = tireD / 2;
    // wheels peeking out
    ctx.fillStyle = '#0c0d0f';
    for (const cx of [g.fx, g.rx]) for (const sg of [1, -1]) { const halfW = (U.yAt(g.top, cx, 'max') || b.W / 2); ctx.fillRect(X(cx - wr), Y(sg * (halfW - car.tireW * .55)) - (sg < 0 ? car.tireW * s : 0), tireD * s, car.tireW * s * .9); }
    ctx.save(); ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.save(); ctx.translate(4, 6); ctx.fill(); ctx.restore();
    ctx.clip();
    const sk = skinImage(b, year, o.gloss ?? .75, o.redraw);
    ctx.fillStyle = sk.raw ? '#777b80' : (b.paint || '#888'); ctx.fillRect(X(0), Y(-b.W / 2), b.L * s, b.W * s);
    const hw = t => { const xm = t * b.L; return U.yAt(g.top, U.clamp(xm, 1, b.L - 1), 'max') ?? b.W * .3; };
    R.warp(ctx, sk.img, t => ({ x: X(t * b.L), y: Y(-hw(t)) - 1 }), t => ({ x: X(t * b.L), y: Y(hw(t)) + 1 }), 30, 6, 1);
    const sh = ctx.createLinearGradient(0, Y(-b.W / 2), 0, Y(b.W / 2));
    sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(.25, 'rgba(255,255,255,.08)'); sh.addColorStop(.5, 'rgba(255,255,255,.22)'); sh.addColorStop(.75, 'rgba(255,255,255,.06)'); sh.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = sh; ctx.fillRect(X(0), Y(-b.W / 2), b.L * s, b.W * s);
    // greenhouse from side-view glass x positions; roof tumblehome
    const gl = b.glass, a0 = gl[0].x * b.L, a1 = gl[1].x * b.L, c1 = gl[gl.length - 2].x * b.L, c0 = gl[gl.length - 1].x * b.L;
    const th = .8;
    const wAt = xm => (U.yAt(g.top, xm, 'max') || b.W / 2);
    ctx.fillStyle = '#18222c';
    ctx.beginPath(); ctx.moveTo(X(a0), Y(-wAt(a0) * .88)); ctx.lineTo(X(a1), Y(-wAt(a1) * th)); ctx.lineTo(X(a1), Y(wAt(a1) * th)); ctx.lineTo(X(a0), Y(wAt(a0) * .88)); ctx.closePath(); ctx.fill();
    if (!b.bed) { ctx.beginPath(); ctx.moveTo(X(c1), Y(-wAt(c1) * th)); ctx.lineTo(X(c0), Y(-wAt(c0) * .85)); ctx.lineTo(X(c0), Y(wAt(c0) * .85)); ctx.lineTo(X(c1), Y(wAt(c1) * th)); ctx.closePath(); ctx.fill(); }
    // roof panel
    const rg = ctx.createLinearGradient(0, Y(-b.W * .4), 0, Y(b.W * .4)); rg.addColorStop(0, 'rgba(0,0,0,.25)'); rg.addColorStop(.5, 'rgba(255,255,255,.14)'); rg.addColorStop(1, 'rgba(0,0,0,.25)');
    ctx.fillStyle = rg; ctx.fillRect(X(a1), Y(-wAt(a1) * th), (c1 - a1) * s, wAt(a1) * th * 2 * s);
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.strokeRect(X(a1), Y(-wAt(a1) * th), (c1 - a1) * s, wAt(a1) * th * 2 * s);
    // hood centre crease and cowl line
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.moveTo(X(a0 - 30), Y(-wAt(a0) * .9)); ctx.lineTo(X(a0 - 30), Y(wAt(a0) * .9)); ctx.stroke();
    if (b.bed) { ctx.fillStyle = 'rgba(0,0,0,.35)'; const bx0 = c0 + 60; ctx.fillRect(X(bx0), Y(-b.W * .44), (b.L - bx0 - 60) * s, b.W * .88 * s); }
    ctx.restore();
    // mirrors
    ctx.fillStyle = '#15171a'; for (const sg of [1, -1]) ctx.fillRect(X(a0 + 40), Y(sg * wAt(a0) * 1.04) - 6 * s * 10 / 2, 90 * s, 60 * s);
    ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    // lamps
    ctx.fillStyle = '#f2efda'; for (const sg of [1, -1]) ctx.fillRect(X(8), Y(sg * wAt(60) * .75) - 5, 22 * s + 2, 10);
    ctx.fillStyle = '#b3131b'; for (const sg of [1, -1]) ctx.fillRect(X(b.L - 26), Y(sg * wAt(b.L - 40) * .78) - 6, 22 * s + 2, 12);
    return { X, Y, g };
  };

  // small top-view silhouette for factory conveyor
  R.drawCarMini = (ctx, car, x, y, len, ang, painted, stage) => {
    const b = car.body, s = len / b.L;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const g = S.bodyGeom(b);
    ctx.beginPath(); g.top.forEach((p, i) => i ? ctx.lineTo(p.x * s - len / 2, p.y * s) : ctx.moveTo(p.x * s - len / 2, p.y * s)); for (let i = g.top.length - 1; i >= 0; i--) ctx.lineTo(g.top[i].x * s - len / 2, -g.top[i].y * s); ctx.closePath();
    ctx.fillStyle = stage === 0 ? '#9aa0a8' : stage === 1 ? '#7f868e' : painted ? (b.paint || '#888') : '#c9ccd0';
    ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.stroke();
    if (stage >= 3) { ctx.fillStyle = '#1b232c'; const a0 = b.glass[0].x * len - len / 2, c0 = b.glass[b.glass.length - 1].x * len - len / 2; ctx.fillRect(a0, -b.W * s * .35, (c0 - a0), b.W * s * .7); ctx.fillStyle = painted ? U.shade(b.paint || '#888888', .1) : '#ddd'; ctx.fillRect(b.glass[1].x * len - len / 2, -b.W * s * .3, (b.glass[b.glass.length - 2].x - b.glass[1].x) * len, b.W * s * .6); }
    ctx.restore();
  };
})(window.MW);
