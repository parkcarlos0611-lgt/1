// Engine renderer. One cylinder "segment" texture (block slice + head slice + cover slice)
// is generated in code — or taken from a user-uploaded image — and tiled per cylinder to
// build any inline / V / boxer / W engine. Side view (with live cutaway pistons) and a
// front cross-section with animated crank, rods and pistons in firing order.
(function (MW) {
  const U = MW.U, D = MW.data, S = MW.sim, R = MW.render;
  const segCache = {};
  // segment texture: width = 1 bore pitch, height = full engine side (block + head + cover)
  R.engineSegment = (e) => {
    const key = [e.blockMat, e.headMat, e.head, e.valves, e.ignition, e.fuelSys, e.customSeg ? e.customSeg.length : 0].join('|');
    if (segCache[key]) return segCache[key];
    const W = 120, H = 300, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const block = R.castTexture(e.blockMat), head = R.castTexture(e.headMat === 'alu' ? 'alu' : 'iron');
    const coverMat = e.head === 'dohc' ? (e.valves >= 4 ? 'red' : 'crinkle') : e.head === 'sohc' ? 'blue' : e.head === 'ohv' ? 'black' : e.headMat;
    // cover (top)
    const coverH = e.head === 'flat' ? 0 : e.head === 'dohc' ? 70 : 55;
    const headY = 8 + coverH, headH = e.head === 'flat' ? 46 : 50, blockY = headY + headH, blockH = H - blockY;
    // block slice
    const userImg = e.customSeg ? R.userImage(e.customSeg) : null;
    if (userImg) x.drawImage(userImg, 0, blockY, W, blockH);
    else {
      x.drawImage(block, 0, 0, W, blockH, 0, blockY, W, blockH);
      // water-jacket bulge per cylinder, casting rib between cylinders, core plug
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(.18, 'rgba(255,255,255,.08)'); g.addColorStop(.5, 'rgba(255,255,255,.18)'); g.addColorStop(.82, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
      x.fillStyle = g; x.fillRect(0, blockY, W, blockH * .62);
      x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(W - 4, blockY, 4, blockH * .7);
      x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(W - 7, blockY, 2, blockH * .7);
      x.fillStyle = '#7c6a4a'; x.beginPath(); x.arc(W / 2, blockY + blockH * .35, 11, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 2; x.stroke();
      // skirt & main-bearing web
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, blockY + blockH * .62, W, 3);
      x.fillStyle = 'rgba(255,255,255,.1)'; x.beginPath(); x.moveTo(W * .42, blockY + blockH * .64); x.lineTo(W * .58, blockY + blockH * .64); x.lineTo(W * .64, H); x.lineTo(W * .36, H); x.fill();
    }
    // head slice
    x.drawImage(head, 0, 0, W, headH, 0, headY, W, headH);
    const hg = x.createLinearGradient(0, headY, 0, headY + headH); hg.addColorStop(0, 'rgba(255,255,255,.2)'); hg.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = hg; x.fillRect(0, headY, W, headH);
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, headY + headH - 3, W, 3); // head gasket
    // head bolts
    x.fillStyle = '#c9ccd0'; for (const bx of [16, W - 16]) { x.beginPath(); x.arc(bx, headY + headH * .5, 5, 0, 7); x.fill(); x.fillStyle = '#555'; x.fillRect(bx - 3, headY + headH * .5 - 1, 6, 2); x.fillStyle = '#c9ccd0'; }
    // exhaust port
    x.fillStyle = '#1a1a1c'; x.beginPath(); x.ellipse(W / 2, headY + headH * .62, 18, 10, 0, 0, 7); x.fill();
    // valve cover slice
    if (coverH) {
      const cv = R.castTexture(coverMat);
      x.drawImage(cv, 0, 0, W, coverH, 0, 8, W, coverH);
      const cg = x.createLinearGradient(0, 8, 0, 8 + coverH); cg.addColorStop(0, 'rgba(255,255,255,.35)'); cg.addColorStop(.3, 'rgba(255,255,255,.05)'); cg.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = cg; x.fillRect(0, 8, W, coverH);
      if (e.head === 'dohc') { // twin cam covers with plug well
        x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, 8 + coverH * .48, W, 3);
        if (e.ignition === 'cop') { x.fillStyle = '#18191b'; x.fillRect(W / 2 - 14, 0, 28, 30); x.fillStyle = '#3a3c40'; x.fillRect(W / 2 - 10, 4, 20, 6); }
        else { x.fillStyle = '#111'; x.beginPath(); x.arc(W / 2, 8 + coverH * .5, 9, 0, 7); x.fill(); x.strokeStyle = '#d33'; x.lineWidth = 4; x.beginPath(); x.moveTo(W / 2, 8 + coverH * .5); x.quadraticCurveTo(W / 2 + 20, -10, W, 2); x.stroke(); }
      } else { // ribbed cover
        x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(0, 18 + i * 9); x.lineTo(W, 18 + i * 9); x.stroke(); }
        x.fillStyle = '#c9ccd0'; x.beginPath(); x.arc(W / 2, 8 + coverH - 8, 4, 0, 7); x.fill();
      }
    } else { // flathead: valves are in the block; head is a flat slab with many studs
      x.fillStyle = '#c9ccd0'; for (const bx of [30, 60, 90]) { x.beginPath(); x.arc(bx, headY + 12, 3.5, 0, 7); x.fill(); }
    }
    return (segCache[key] = { canvas: c, W, H, headY, blockY, coverH });
  };

  const pistonPos = (theta, r, l) => r * Math.cos(theta) + Math.sqrt(l * l - r * r * Math.sin(theta) ** 2);
  // firing order phase for cylinder i (even firing, typical orders)
  const ORDERS = { 1: [1], 2: [1, 2], 3: [1, 3, 2], 4: [1, 3, 4, 2], 5: [1, 2, 4, 5, 3], 6: [1, 5, 3, 6, 2, 4], 8: [1, 8, 4, 3, 6, 5, 7, 2], 10: [1, 6, 5, 10, 2, 7, 3, 8, 4, 9], 12: [1, 7, 5, 11, 3, 9, 6, 12, 2, 8, 4, 10], 16: [1, 9, 3, 11, 5, 13, 7, 15, 2, 10, 4, 12, 6, 14, 8, 16] };
  R.cylPhase = (n, i) => { const ord = ORDERS[n] || Array.from({ length: n }, (_, k) => k + 1); const k = ord.indexOf(i + 1); return -(k < 0 ? i : k) * (4 * Math.PI / n); };

  // side view: o = {x, y, scale (px/mm), crank (rad), cutaway}
  R.drawEngineSide = (ctx, e, er, o) => {
    const seg = R.engineSegment(e), n = er.perBank, pitch = e.bore * 1.18 + 8;
    const s = o.scale, segW = pitch * s, H = er.height * s * .78;
    const k = H / seg.H; // texture px → screen
    const totalW = segW * n;
    const x0 = o.x - totalW / 2, yTop = o.y - H;
    // timing cover (front) & bellhousing (rear)
    const tc = R.castTexture(e.blockMat);
    ctx.save();
    ctx.fillStyle = ctx.createPattern(tc, 'repeat'); ctx.beginPath(); ctx.roundRect(x0 - 60 * s, yTop + seg.headY * k, 60 * s, H - seg.headY * k - 10, 10 * s); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x0 - 60 * s, yTop + seg.headY * k, 60 * s, H - seg.headY * k - 10);
    // crank pulley + belt
    const py = o.y - H * .2;
    ctx.fillStyle = '#26282b'; ctx.beginPath(); ctx.arc(x0 - 75 * s, py, 55 * s, 0, 7); ctx.fill(); ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(x0 - 75 * s, py); ctx.rotate(o.crank || 0); ctx.fillStyle = '#888'; ctx.fillRect(-4, -50 * s, 8, 30 * s); ctx.restore();
    const camY = yTop + seg.headY * k * .6;
    ctx.fillStyle = '#1e1f22'; ctx.beginPath(); ctx.arc(x0 - 70 * s, camY, 40 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(x0 - 125 * s, py); ctx.lineTo(x0 - 105 * s, camY); ctx.moveTo(x0 - 25 * s, py); ctx.lineTo(x0 - 35 * s, camY); ctx.stroke();
    // bellhousing
    ctx.fillStyle = ctx.createPattern(R.castTexture('alu'), 'repeat');
    ctx.beginPath(); ctx.moveTo(x0 + totalW, yTop + seg.blockY * k); ctx.lineTo(x0 + totalW + 70 * s, yTop + seg.blockY * k - 40 * s); ctx.lineTo(x0 + totalW + 70 * s, o.y + 20 * s); ctx.lineTo(x0 + totalW, o.y - 10 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
    // tiled cylinder segments
    for (let i = 0; i < n; i++) ctx.drawImage(seg.canvas, x0 + i * segW, yTop, segW, H);
    // oil pan
    ctx.fillStyle = '#2b2d31'; ctx.beginPath(); ctx.moveTo(x0, o.y - 8); ctx.lineTo(x0 + totalW, o.y - 8); ctx.lineTo(x0 + totalW - 30 * s, o.y + 60 * s); ctx.lineTo(x0 + totalW * .35, o.y + 70 * s); ctx.lineTo(x0 + 20 * s, o.y + 30 * s); ctx.closePath(); ctx.fill();
    // cutaway: bore, piston, rod
    if (o.cutaway) {
      const boreW = e.bore * s * .92, deck = yTop + seg.blockY * k + 4, crankY = o.y - 14 * s;
      const r = Math.min(e.stroke * s / 2, (crankY - deck) * .22), l = Math.max(r * 2.2, crankY - deck - r - boreW * .45);
      for (let i = 0; i < n; i++) {
        const cx = x0 + i * segW + segW / 2;
        const th = (o.crank || 0) + R.cylPhase(er.n, i * (S.engineBanks(e) > 1 ? S.engineBanks(e) : 1) % er.n);
        const pp = pistonPos(th, r, l);
        const pY = crankY - pp;
        ctx.fillStyle = '#0d0e10'; ctx.fillRect(cx - boreW / 2, deck, boreW, crankY - deck - r * .2);
        // combustion flash near TDC on the power stroke
        const cyc = ((th % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI);
        if (cyc < .5) { ctx.fillStyle = `rgba(255,170,60,${.8 - cyc * 1.4})`; ctx.fillRect(cx - boreW / 2, deck, boreW, Math.max(2, pY - deck - boreW * .3)); }
        ctx.fillStyle = '#b9bdc2'; ctx.fillRect(cx - boreW / 2 + 1, pY - boreW * .35, boreW - 2, boreW * .55);
        ctx.fillStyle = 'rgba(0,0,0,.4)'; for (let rr = 0; rr < 3; rr++) ctx.fillRect(cx - boreW / 2 + 1, pY - boreW * .3 + rr * 4, boreW - 2, 1.5);
        const pinX = cx, pinY = pY, crX = cx + Math.sin(th) * r, crY = crankY - Math.cos(th) * r;
        ctx.strokeStyle = '#8d939a'; ctx.lineWidth = Math.max(3, boreW * .18); ctx.beginPath(); ctx.moveTo(pinX, pinY); ctx.lineTo(crX, crY); ctx.stroke();
        ctx.fillStyle = '#5a5f66'; ctx.beginPath(); ctx.arc(cx, crankY, r * .95, Math.PI + th, th); ctx.fill();
        ctx.fillStyle = '#c6c9cd'; ctx.beginPath(); ctx.arc(crX, crY, Math.max(2, boreW * .12), 0, 7); ctx.fill();
      }
    }
    // intake manifold + induction per fuel system
    const inY = yTop + (seg.headY + 10) * k;
    const F = e.fuelSys;
    ctx.fillStyle = ctx.createPattern(R.castTexture(e.headMat === 'alu' ? 'alu' : 'iron'), 'repeat');
    for (let i = 0; i < n; i++) { const cx = x0 + i * segW + segW / 2; ctx.fillRect(cx - segW * .16, inY - 14 * s, segW * .32, 34 * s); }
    ctx.fillRect(x0 + 10 * s, inY - 34 * s, totalW - 20 * s, 24 * s);
    const ix = x0 + totalW / 2, iy = inY - 34 * s;
    if (F.startsWith('carb')) {
      const nc = F === 'carbm' ? n : 1;
      for (let i = 0; i < nc; i++) { const cx = nc === 1 ? ix : x0 + i * segW + segW / 2; ctx.fillStyle = '#8d8a7c'; ctx.fillRect(cx - 22 * s, iy - 60 * s, 44 * s, 60 * s); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(cx, iy - 75 * s, (nc === 1 ? 90 : 32) * s, 22 * s, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#555'; ctx.fillRect(cx - 3, iy - 98 * s, 6, 10 * s); }
    } else if (['tbi', 'mpfi', 'gdi', 'mech', 'crdi', 'idi', 'tdi'].includes(F)) {
      ctx.fillStyle = '#2f3237'; ctx.beginPath(); ctx.roundRect(x0 + 20 * s, iy - 42 * s, totalW - 40 * s, 42 * s, 12 * s); ctx.fill();
      ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.arc(x0 + 20 * s, iy - 20 * s, 26 * s, 0, 7); ctx.fill();
      if (F !== 'tbi') { ctx.strokeStyle = '#b8a040'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x0 + 30 * s, inY + 6 * s); ctx.lineTo(x0 + totalW - 30 * s, inY + 6 * s); ctx.stroke(); }
    }
    // turbo / supercharger
    if (e.asp === 'sc') { ctx.fillStyle = '#8e9299'; ctx.beginPath(); ctx.roundRect(ix - 120 * s, iy - 120 * s, 240 * s, 70 * s, 20 * s); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(ix - 110 * s + i * 24 * s, iy - 116 * s); ctx.lineTo(ix - 110 * s + i * 24 * s, iy - 54 * s); ctx.stroke(); } }
    else if (e.asp !== 'na') {
      const tx = x0 + totalW + 20 * s, ty = yTop + (seg.headY + 40) * k;
      for (let tb = 0; tb < (e.asp === 'twin' ? 2 : 1); tb++) { const yy = ty + tb * 110 * s; ctx.fillStyle = '#7e5a38'; ctx.beginPath(); ctx.arc(tx, yy, 55 * s, 0, 7); ctx.fill(); ctx.fillStyle = '#b7bcc2'; ctx.beginPath(); ctx.arc(tx + 55 * s, yy, 42 * s, 0, 7); ctx.fill(); ctx.save(); ctx.translate(tx + 55 * s, yy); ctx.rotate((o.crank || 0) * 3); ctx.strokeStyle = '#555'; ctx.lineWidth = 2; for (let b = 0; b < 6; b++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30 * s); ctx.stroke(); } ctx.restore(); }
      if (e.intercooler) { ctx.fillStyle = '#3a3d42'; ctx.fillRect(x0 - 40 * s, iy - 150 * s, totalW * .6, 50 * s); ctx.strokeStyle = 'rgba(255,255,255,.15)'; for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.moveTo(x0 - 36 * s + i * totalW * .03, iy - 148 * s); ctx.lineTo(x0 - 36 * s + i * totalW * .03, iy - 102 * s); ctx.stroke(); } }
    }
    // exhaust manifold
    const exY = yTop + (seg.headY + seg.coverH * 0 + 30) * k;
    ctx.strokeStyle = e.exhaust === 'log' ? '#4a3a30' : '#8a7f78'; ctx.lineWidth = Math.max(4, segW * .22); ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) { const cx = x0 + i * segW + segW / 2; ctx.beginPath(); ctx.moveTo(cx, exY); ctx.quadraticCurveTo(cx, exY + 60 * s, x0 + totalW + 40 * s, exY + 80 * s + (e.exhaust === 'log' ? 0 : i * 6 * s)); ctx.stroke(); }
    ctx.lineCap = 'butt';
    ctx.restore();
    return { x0, totalW, yTop, H };
  };

  // front cross-section (looking from the front): banks at angle, animated crank & pistons
  R.drawEngineFront = (ctx, e, er, o) => {
    const s = o.scale, cx = o.x, cy = o.y;
    const stroke = e.stroke * s, r = stroke / 2, l = stroke * 1.7, bw = e.bore * s;
    const banks = e.layout === 'I' ? [0] : e.layout === 'B' ? [-90, 90] : e.layout === 'W' ? [-(+e.vAngle) / 2 - 7.5, -(+e.vAngle) / 2 + 7.5, (+e.vAngle) / 2 - 7.5, (+e.vAngle) / 2 + 7.5] : [-(+e.vAngle) / 2, (+e.vAngle) / 2];
    const inc = e.layout === 'I' ? 15 : 0;
    const block = ctx.createPattern(R.castTexture(e.blockMat), 'repeat'), head = ctx.createPattern(R.castTexture(e.headMat === 'alu' ? 'alu' : 'iron'), 'repeat');
    // crankcase
    ctx.save();
    ctx.fillStyle = block; ctx.beginPath(); ctx.arc(cx, cy, r * 2.4 + 10 * s, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
    ctx.fillStyle = '#2b2d31'; ctx.beginPath(); ctx.moveTo(cx - r * 2.6, cy + r * .5); ctx.lineTo(cx + r * 2.6, cy + r * .5); ctx.lineTo(cx + r * 2.2, cy + r * 3.2); ctx.lineTo(cx - r * 2.2, cy + r * 3.2); ctx.closePath(); ctx.fill();
    const crank = o.crank || 0;
    banks.forEach((deg, bi) => {
      const a = (deg + inc) * Math.PI / 180;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      const deck = l + r + bw * .45, cylLen = deck;
      ctx.fillStyle = block; ctx.fillRect(-bw * .75, -cylLen, bw * 1.5, cylLen - r * 1.2);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(-bw * .75, -cylLen, bw * .3, cylLen - r * 1.2);
      const hh = (e.head === 'flat' ? 30 : e.head === 'dohc' ? 95 : e.head === 'sohc' ? 75 : 70) * s;
      ctx.fillStyle = head; ctx.fillRect(-bw * .85, -cylLen - hh, bw * 1.7, hh);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-bw * .85, -cylLen - hh, bw * 1.7, hh);
      // cams
      const camsN = e.head === 'dohc' ? 2 : e.head === 'sohc' ? 1 : 0;
      for (let c = 0; c < camsN; c++) { ctx.save(); ctx.translate(camsN === 2 ? (c ? bw * .35 : -bw * .35) : 0, -cylLen - hh * .55); ctx.rotate(crank / 2); ctx.fillStyle = '#c3c7cc'; ctx.beginPath(); ctx.ellipse(0, -3 * s, 14 * s, 19 * s, 0, 0, 7); ctx.fill(); ctx.restore(); }
      if (e.head === 'ohv') { ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-bw * .6, -r * 1.6); ctx.lineTo(-bw * .4, -cylLen - hh * .5); ctx.stroke(); }
      // bore
      ctx.fillStyle = '#0d0e10'; ctx.fillRect(-bw / 2, -cylLen, bw, cylLen - r * 1.25);
      // which cylinder of this bank leads → use first cylinder of the bank for phase
      const cylIdx = bi % er.n;
      const th = crank + R.cylPhase(er.n, cylIdx) - a;
      const pp = pistonPos(th, r, l);
      const cyc = ((th % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI);
      if (cyc < .6) { ctx.fillStyle = `rgba(255,160,50,${.85 - cyc})`; ctx.fillRect(-bw / 2, -cylLen, bw, cylLen - pp - bw * .3); }
      ctx.fillStyle = '#b9bdc2'; ctx.fillRect(-bw / 2 + 1, -pp - bw * .3, bw - 2, bw * .55);
      const cpx = Math.sin(th) * r, cpy = -Math.cos(th) * r;
      ctx.strokeStyle = '#8d939a'; ctx.lineWidth = bw * .2; ctx.beginPath(); ctx.moveTo(0, -pp); ctx.lineTo(cpx, cpy); ctx.stroke();
      ctx.restore();
    });
    // crankshaft counterweight
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(crank);
    ctx.fillStyle = '#6a6f76'; ctx.beginPath(); ctx.arc(0, 0, r * 1.25, Math.PI * .15, Math.PI * .85); ctx.lineTo(0, 0); ctx.fill();
    ctx.fillStyle = '#9ea3aa'; ctx.beginPath(); ctx.arc(0, -r, bw * .14, 0, 7); ctx.fill();
    ctx.fillStyle = '#d5d8dc'; ctx.beginPath(); ctx.arc(0, 0, bw * .16, 0, 7); ctx.fill();
    ctx.restore(); ctx.restore();
  };
})(window.MW);
