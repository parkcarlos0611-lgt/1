// Town buildings that come down cell by cell (firing range). Each building is the drawing cut into a grid of
// cells on its floor slabs and piers (data/city.js). Every cell holds wall and carries what stands on it:
//   - shells wear cells down; a cell that fails is either gutted (its facade blown in, the floor slabs still
//     spanning between the cells beside it — drawn as an exposed, burnt-out room) or knocked out altogether
//   - load paths: a cell stands on the cell under it; a slab can span a gap of up to four bays between two
//     standing cells and cantilever one bay past the last one. Cells that lose every path fall.
//   - when a storey has lost more than half its cells, everything above it goes as one block: straight down
//     onto the storeys below (each impact crushes the lowest storey of the block and the top of what it lands
//     on — the floors pancake) or, if the block's weight is off to one side of what is left, it pivots on the
//     last standing edge, tips over and breaks up where it lands
// Crushed cells turn into tumbling facade fragments cut from the building's own drawing, chunks of concrete,
// bricks, blocks and rebar from the debris sheet, and dust; the material piles up at the foot as a rubble heap
// drawn from the heap sprites. Vehicles pass in front of the buildings; shells, sight lines and blast meet them.
DS.Structure = class Structure {
  constructor(k, x, world) {
    const D = DS.CITY[k];
    this.k = k; this.D = D; this.name = D.name; this.x = x; this.world = world;
    this.ppm = (D.h - D.roof) / D.hb;                              // sprite px per metre
    this.w = D.w / this.ppm; this.h = D.h / this.ppm;
    this.base = world.terrain.height(x) - 0.12;
    this.hpMax = D.kind === 'l' ? 70 : D.kind === 'm' ? 90 : 100;
    this.reset();
  }
  reset() {
    this.unheap();
    const D = this.D, p = this.ppm, R = D.rows.length - 1, C = D.cols.length - 1;
    this.R = R; this.C = C; this.cells = [];
    for (let i = 0; i < R; i++) for (let c = 0; c < C; c++) {
      const sx = D.cols[c], sy = D.rows[i], sw = D.cols[c + 1] - sx, sh = D.rows[i + 1] - sy;
      this.cells.push({ i, c, f: R - 1 - i, ex: !!D.occ[i][c], st: D.occ[i][c] ? 'ok' : 'none', hp: this.hpMax, chunk: null,
        sx, sy, sw, sh, x0: sx / p - this.w / 2, x1: (sx + sw) / p - this.w / 2, y0: (D.h - sy - sh) / p, y1: (D.h - sy) / p, seed: i * 37 + c * 11 + 5 });
    }
    this.chunks = []; this.pieces = []; this.scorch = []; this.glass = false; this.touched = false;
    this.heap = new Float32Array(Math.ceil(this.w * 2.6) + 8); this.heapX0 = -this.w * 1.3 - 4; this.heapVer = 0; this.heapDraw = null;
    this.state = 'ok'; this.hits = 0; this.sink = 0; this.crackT = 0;
  }
  cell(i, c) { return i >= 0 && i < this.R && c >= 0 && c < this.C ? this.cells[i * this.C + c] : null; }
  stand(cl) { return cl && cl.ex && cl.st === 'ok' && !cl.chunk; }
  // still in place and carrying load: intact bays and gutted rooms (their piers and slabs are still there)
  carry(cl) { return cl && cl.ex && !cl.chunk && (cl.st === 'ok' || cl.st === 'gut'); }
  get top() { let t = 0; for (const cl of this.cells) if (this.stand(cl)) t = Math.max(t, cl.y1); return this.base + t; }
  get bottomY() { return this.base; }

  // ---- hits ----
  rayHit(x0, y0, x1, y1) {
    const xa = this.x - this.w / 2, xb = this.x + this.w / 2, yt = this.top;
    if (Math.max(x0, x1) < xa || Math.min(x0, x1) > xb || Math.max(y0, y1) < this.base || Math.min(y0, y1) > yt) return null;
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 0.3));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, cl = this.cellAt(x - this.x, y - this.base);
      if (cl && (cl.st === 'ok' || cl.st === 'gut')) return { t, x, y, cl };
    }
    return null;
  }
  cellAt(lx, ly) {
    const p = this.ppm, D = this.D, sx = (lx + this.w / 2) * p, sy = D.h - ly * p;
    if (sx < 0 || sx >= D.w || sy < 0 || sy >= D.h) return null;
    let c = 0; while (c < this.C - 1 && sx >= D.cols[c + 1]) c++;
    let i = 0; while (i < this.R - 1 && sy >= D.rows[i + 1]) i++;
    const cl = this.cell(i, c); return cl && cl.ex && !cl.chunk ? cl : null;
  }
  dist(x, y) { return Math.hypot(Math.max(0, Math.abs(x - this.x) - this.w / 2), Math.max(0, this.base - y, y - this.top)); }
  // blast of radius r (the vehicle-damage radius of the warhead) at (x, y)
  blast(W, x, y, r) {
    if (this.state === 'rubble') return;
    const d0 = this.dist(x, y);
    if (d0 <= r * 4.5 && !this.glass) this.shatter(W);
    const R = Math.max(0.8, r * 0.65), D0 = 120 + 20 * r;
    if (d0 > R) return;
    let any = false;
    for (const cl of this.cells) {
      if (!cl.ex || cl.chunk || (cl.st !== 'ok' && cl.st !== 'gut')) continue;
      const cx = this.x + (cl.x0 + cl.x1) / 2, cy = this.base + (cl.y0 + cl.y1) / 2;
      const d = Math.hypot(Math.max(0, Math.abs(x - cx) - (cl.x1 - cl.x0) / 2), Math.max(0, Math.abs(y - cy) - (cl.y1 - cl.y0) / 2));
      if (d < R) { this.damageCell(W, cl, D0 * (1 - d / R), x); any = true; }
    }
    if (any) { this.hits++; this.scorch.push({ x: x - this.x, y: y - this.base, r: 2.2 + r * 0.45 }); this.touched = true; this.settle(W); }
  }
  // armour-piercing shot, shaped charge or cannon shell striking the wall
  hit(W, x, y, p) {
    const A = p.ammo, cl = this.cellAt(x - this.x, y - this.base); if (!cl) return;
    const dmg = A.small ? (A.d >= 0.02 ? 5 : 0.4) : A.pen && A.pen.ce ? 75 : 45;
    this.damageCell(W, cl, dmg, x); this.touched = true;
    if (!A.small) { this.scorch.push({ x: x - this.x, y: y - this.base, r: 1.1 }); this.settle(W); }
  }
  damageCell(W, cl, dmg, fromX) {
    cl.hp -= dmg;
    if (cl.hp > 0) return;
    if (cl.st === 'ok') {
      // blown in where the cells round it still hold: a gutted room; otherwise the bay is gone
      let n = 0; for (const [di, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.stand(this.cell(cl.i + di, cl.c + dc))) n++;
      if (n >= 2 && cl.hp > -this.hpMax * 1.2) { cl.st = 'gut'; cl.hp = this.hpMax * 0.6; this.spill(W, cl, 0.45, fromX); }
      else { cl.st = 'gone'; this.spill(W, cl, 1, fromX); }
    } else if (cl.st === 'gut') { cl.st = 'gone'; this.spill(W, cl, 0.6, fromX); }
  }

  // ---- load paths ----
  settle(W) {
    const R = this.R, C = this.C, sup = new Uint8Array(R * C);
    let block = null;
    for (let f = 0; f < R; f++) {
      const i = R - 1 - f;
      const base = [];
      for (let c = 0; c < C; c++) { const cl = this.cell(i, c); base[c] = this.carry(cl) && (f === 0 || sup[(i + 1) * C + c] === 1); }
      // runs of standing cells: held where they stand on something, spanning between such cells (up to 4 bays)
      // or cantilevered one bay past the outermost
      let c = 0;
      while (c < C) {
        if (!this.carry(this.cell(i, c))) { c++; continue; }
        let e = c; while (e + 1 < C && this.carry(this.cell(i, e + 1))) e++;
        const bs = []; for (let k = c; k <= e; k++) if (base[k]) bs.push(k);
        if (bs.length) for (let k = c; k <= e; k++) {
          let ok = base[k];
          if (!ok && this.cell(i, k).st !== 'gut') {           // a gutted room has no wall to hang from: it needs the storey under it
            const l = bs.filter(b => b < k).pop(), r = bs.find(b => b > k);
            ok = (l != null && r != null && r - l <= 5) || (l != null && r == null && k - l <= 1) || (r != null && l == null && r - k <= 1);
          }
          if (ok) sup[i * C + k] = 1;
        }
        c = e + 1;
      }
      // a storey that has lost most of its cells cannot carry the floors above it
      if (!block && f < R - 1) {
        let ex = 0, held = 0, above = 0;
        for (let c2 = 0; c2 < C; c2++) { const cl = this.cell(i, c2); if (cl.ex) { ex++; if (sup[i * C + c2]) held++; } }
        for (let i2 = 0; i2 < i; i2++) for (let c2 = 0; c2 < C; c2++) if (this.carry(this.cell(i2, c2))) above++;
        if (above && ex && held < ex * 0.56) block = { i, f };
      }
    }
    const falling = [];
    if (block) {
      // everything above the failed storey goes as one block; it pivots on the last standing edge if its
      // weight is off to one side of what still stands in that storey
      const cells = this.cells.filter(cl => cl.i < block.i && this.carry(cl));
      let mx = 0; for (const cl of cells) mx += (cl.x0 + cl.x1) / 2; mx /= cells.length;
      let smin = 1e9, smax = -1e9;
      for (let c = 0; c < C; c++) if (sup[block.i * C + c]) { const cl = this.cell(block.i, c); smin = Math.min(smin, cl.x0); smax = Math.max(smax, cl.x1); }
      const yb = this.cell(block.i, 0).y1;
      let piv = null;
      if (smax > smin) { if (mx < smin + 0.3) piv = { x: smin, y: yb, s: 1 }; else if (mx > smax - 0.3) piv = { x: smax, y: yb, s: -1 }; }
      falling.push({ cells, piv, mx });
    }
    const loose = this.cells.filter(cl => this.carry(cl) && !sup[cl.i * C + cl.c] && !(block && cl.i < block.i));
    // group loose cells into connected pieces
    const seen = new Set();
    for (const cl of loose) {
      if (seen.has(cl)) continue;
      const g = [], st = [cl]; seen.add(cl);
      while (st.length) { const a = st.pop(); g.push(a); for (const [di, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const b = this.cell(a.i + di, a.c + dc); if (b && loose.includes(b) && !seen.has(b)) { seen.add(b); st.push(b); } } }
      falling.push({ cells: g, piv: null });
    }
    for (const F of falling) this.drop(W, F.cells, F.piv);
    // a gutted room needs a standing bay beside it to hold its slabs; one left hanging in the air comes down
    let again = false;
    for (let it = 0; it < 3; it++) for (const cl of this.cells) {
      if (cl.st !== 'gut' || cl.chunk) continue;
      if (!this.stand(this.cell(cl.i, cl.c - 1)) && !this.stand(this.cell(cl.i, cl.c + 1))) { cl.st = 'gone'; this.spill(W, cl, 0.5, null); this.touched = true; again = true; }
    }
    if (falling.length) { this.touched = true; DS.Audio.collapse(this.x, this.base, Math.min(6, 1.5 + falling.reduce((s, F) => s + F.cells.length, 0) * 0.08)); }
    this.gutKey = null;
    if (again) return this.settle(W);
    if (!this.cells.some(cl => cl.ex && (cl.st === 'ok' || cl.st === 'gut'))) this.state = 'rubble';
    else if (this.cells.some(cl => cl.ex && cl.st !== 'ok')) this.state = 'damaged';
  }
  drop(W, cells, piv) {
    const ch = { cells, ang: 0, w: 0, ox: 0, oy: 0, vx: 0, vy: 0, t: 0, piv, crumble: 0 };
    let ax = 0, ay = 1e9, top = 0; for (const cl of cells) { cl.chunk = ch; ax += (cl.x0 + cl.x1) / 2; ay = Math.min(ay, cl.y0); top = Math.max(top, cl.y1); }
    ch.ax = piv ? piv.x : ax / cells.length; ch.ay = piv ? piv.y : ay; ch.Lh = top - ay;
    if (!piv) ch.w = (Math.random() - 0.5) * 0.04;
    this.chunks.push(ch);
  }
  // highest standing wall (building-local y) under building-local x, ignoring chunk ch; ground is 0
  standTop(lx, ch) {
    let t = 0;
    for (const cl of this.cells) if (this.stand(cl) && lx >= cl.x0 && lx <= cl.x1 && cl.chunk !== ch) t = Math.max(t, cl.y1);
    return t;
  }
  heapAt(lx) { const j = Math.floor(lx - this.heapX0); return j >= 0 && j < this.heap.length ? this.heap[j] : 0; }
  toWorld(ch, lx, ly) {
    const c = Math.cos(ch.ang), s = Math.sin(ch.ang), dx = lx - ch.ax, dy = ly - ch.ay;
    return { x: ch.ax + c * dx - s * dy + ch.ox, y: ch.ay + s * dx + c * dy + ch.oy };
  }

  // ---- per frame ----
  step(dt, W) {
    const g = DS.T.g;
    for (const ch of this.chunks) {
      ch.t += dt;
      if (ch.piv && ch.t > 0.35) {
        // pivoting on the standing edge: gravity's torque about the pivot over the block's moment of inertia
        let cx = 0, cy = 0; for (const cl of ch.cells) { const q = this.toWorld(ch, (cl.x0 + cl.x1) / 2, (cl.y0 + cl.y1) / 2); cx += q.x; cy += q.y; }
        cx /= ch.cells.length; cy /= ch.cells.length;
        const rx = cx - (ch.ax + ch.ox), ry = cy - (ch.ay + ch.oy), r2 = rx * rx + ry * ry + ch.Lh * ch.Lh / 12;
        ch.w += -g * rx / r2 * dt * 1.6; ch.ang += ch.w * dt;
        if (Math.abs(ch.ang) > 0.45) { ch.vx = -ch.w * ry; ch.vy = ch.w * rx; ch.piv = null; }
        continue;
      }
      if (ch.piv) continue;
      if (ch.t > 9) { for (const cl of ch.cells.slice()) this.crushCell(W, ch, cl); continue; }      // whatever is left breaks up where it lies
      ch.vy -= g * dt; ch.ox += ch.vx * dt; ch.oy += ch.vy * dt; ch.ang += ch.w * dt;
      // lowest corner of the block against what is under it
      let low = null;
      for (const cl of ch.cells) for (const [px, py] of [[cl.x0, cl.y0], [cl.x1, cl.y0], [cl.x0, cl.y1], [cl.x1, cl.y1]]) {
        const q = this.toWorld(ch, px, py), s = Math.max(this.standTop(q.x, ch), this.world.terrain.height(this.x + q.x) - this.base);
        if (q.y - s < (low ? low.pen : 0)) low = { pen: q.y - s, x: q.x, s };
      }
      if (low) {
        const speed = -ch.vy;
        ch.oy -= low.pen;
        // the lowest storey of the block is crushed where it struck, and so is the top of what it fell on
        const crush = ch.cells.filter(cl => { const a = this.toWorld(ch, (cl.x0 + cl.x1) / 2, cl.y0); return a.y < low.s + (cl.y1 - cl.y0) * 0.75; });
        const k = Math.max(1, Math.min(crush.length, ch.crumble ? 2 : crush.length));
        for (const cl of crush.slice(0, k)) this.crushCell(W, ch, cl);
        if (low.s > 0.3 && speed > 4) { const under = this.cellAt(low.x, low.s - 0.2); if (under && !under.chunk) { this.damageCell(W, under, speed * 14, this.x + low.x); this.settle(W); } }
        ch.vy = speed > 3 ? -speed * 0.55 : 0; ch.vx *= 0.7; ch.w *= 0.75;
        if (speed < 3) ch.crumble += dt;
        if (ch.crumble > 0.3) { ch.crumble = 0.001; const cl = ch.cells.slice().sort((a, b) => a.y0 - b.y0)[0]; if (cl) this.crushCell(W, ch, cl); }
        W.fx.shake = Math.max(W.fx.shake, Math.min(0.9, speed / 25) * Math.max(0, 1 - Math.abs(this.x - W.cam.x) / 500));
        if (speed > 5) DS.Audio.thud(this.x + low.x, this.base, Math.min(1.5, speed / 15));
        this.hurtVehicles(W, low.x, speed);
      }
    }
    this.chunks = this.chunks.filter(ch => ch.cells.length);
    // tumbling fragments
    const T = W.terrain;
    for (const p of this.pieces) {
      if (p.rest) continue;
      p.vy -= g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.w * dt;
      const gy = T.height(p.x) + p.h * 0.35;              // the heap is part of the ground
      if (p.y < gy) {
        p.y = gy;
        if (p.vy < -2.5) { p.vy *= -0.25; p.vx *= 0.55; p.w *= 0.5; if (p.big && Math.random() < 0.5) W.particles.add(DS.P.DUST, p.x, gy, (Math.random() - 0.5) * 3, Math.random() * 2, 3 + Math.random() * 3, 0.8 + p.w0, { grow: 1, drag: 1, grav: 0, alpha: 0.32, col: 0xc9b79a }); }
        else { p.rest = 1; p.vx = p.vy = 0; p.a = Math.round(p.a / Math.PI) * Math.PI + (Math.random() - 0.5) * 0.5; }
      }
    }
    if (this.pieces.length > 240) { const keep = this.pieces.filter(p => !p.rest).concat(this.pieces.filter(p => p.rest).slice(-160)); this.pieces = keep; }
  }
  hurtVehicles(W, lx, speed) {
    if (speed < 6) return;
    for (const v of W.vehicles) {
      if (!v.alive || v.heli || v.god || Math.abs(v.pos.x - (this.x + lx)) > 3) continue;
      const fx = [];
      if (v.def.mass < 35000) { v.knockOut('건물 잔해'); fx.push('격파 (건물 잔해)'); }
      else { fx.push(v.damage('track', { x: v.pos.x, y: v.pos.y - 1 })); const m = v.def.modules.filter(m => m.type === 'optics' || m.type === 'gun'); if (m.length) fx.push(v.damage(m[0].id)); }
      W.addLog({ blast: true, vehicle: v, dist: 0, direct: true, ammo: { short: '건물 붕괴' }, effects: fx.filter(Boolean), range: 0 });
    }
  }
  crushCell(W, ch, cl) {
    const i = ch.cells.indexOf(cl); if (i >= 0) ch.cells.splice(i, 1);
    cl.chunk = null; cl.st = 'gone';
    const q = this.toWorld(ch, (cl.x0 + cl.x1) / 2, (cl.y0 + cl.y1) / 2);
    this.spill(W, cl, 1, null, { x: this.x + q.x, y: this.base + q.y }, ch);
  }

  // ---- what comes out of a broken cell ----
  // k: share of the cell that comes down (1 = the whole bay, less for a gutted room); at: world position (cells of
  // a falling block are no longer where the grid says)
  spill(W, cl, k, fromX, at, ch) {
    const P = W.particles, r = (a, b) => a + Math.random() * (b - a);
    const cx = at ? at.x : this.x + (cl.x0 + cl.x1) / 2, cy = at ? at.y : this.base + (cl.y0 + cl.y1) / 2;
    const cw = cl.x1 - cl.x0, chh = cl.y1 - cl.y0, out = fromX == null ? 0 : Math.sign(cx - fromX), vy0 = ch ? Math.min(0, ch.vy) * 0.4 : 0;
    // facade fragments: pieces of the cell's own drawing
    const nf = Math.round((k >= 1 ? 3 : 2) * (0.6 + Math.random() * 0.8));
    for (let n = 0; n < nf; n++) {
      const fw = cw * r(0.28, 0.55), fh = chh * r(0.3, 0.6);
      this.pieces.push({ src: 'cell', sx: cl.sx + (cl.sw * (1 - fw / cw)) * Math.random(), sy: cl.sy + (cl.sh * (1 - fh / chh)) * Math.random(), sw: cl.sw * fw / cw, sh: cl.sh * fh / chh,
        x: cx + r(-0.4, 0.4) * cw, y: cy + r(-0.3, 0.3) * chh, vx: (out || (Math.random() < 0.5 ? -1 : 1)) * r(1, 7) + (ch ? ch.vx : 0), vy: r(-1, 4) + vy0, a: r(-0.4, 0.4), w: r(-3, 3), wd: fw, h: fh, big: true, w0: fw * 0.3, rest: 0 });
    }
    // loose material from the debris sheet
    const kinds = ['conc1', 'conc2', 'conc3', 'conc4', 'conc5', 'conc6', 'conc7', 'conc2', 'conc4', 'block1', 'block2', 'brick1', 'brick3', 'rebar2', 'rebar3', 'slab1', 'grit1', 'grit2', 'beam2'];
    const nd = Math.round((k >= 1 ? 7 : 4) * (0.7 + Math.random() * 0.6));
    for (let n = 0; n < nd; n++) {
      const key = kinds[Math.floor(Math.random() * kinds.length)], I = DS.DEBRIS[key], sz = key.startsWith('grit') ? r(0.6, 1.1) : key === 'slab1' || key === 'beam2' ? r(1.2, 2.2) : r(0.35, 1.0);
      this.pieces.push({ src: key, x: cx + r(-0.5, 0.5) * cw, y: cy + r(-0.5, 0.5) * chh, vx: (out || (Math.random() < 0.5 ? -1 : 1)) * r(0.5, 9) + (ch ? ch.vx : 0), vy: r(-2, 6) + vy0, a: r(-0.5, 0.5), w: r(-5, 5), wd: sz, h: sz * I.h / I.w, big: sz > 1, w0: sz * 0.3, rest: 0 });
    }
    // dust bursting out of the bay and down the face
    for (let n = 0; n < Math.round(7 * k) + 2; n++)
      P.add(DS.P.DUST, cx + r(-0.5, 0.5) * cw, cy + r(-0.4, 0.4) * chh, (out || (Math.random() < 0.5 ? -1 : 1)) * r(1, 5), r(-1, 2), r(6, 12), r(1.2, 2.6), { grow: r(1, 2), drag: 0.9, grav: 0, alpha: 0.42, col: Math.random() < 0.6 ? 0xcbb99c : 0xb8a888 });
    for (let n = 0; n < 6; n++) P.add(DS.P.DEBRIS, cx, cy, r(-8, 8), r(-2, 8), r(1, 2.5), r(0.06, 0.16), { drag: 0.3, col: 0x8f8472 });
    // the material ends up in the heap at the foot
    const vol = cw * chh * 0.2 * k;
    this.addHeap(cx - this.x + (out || 0) * cw * 0.4, vol);
  }
  // The rubble heap is real ground: its mound is added to the terrain, so vehicles climb it and shells and
  // fragments land on it. heapT keeps what was added (per terrain cell) so a rebuild takes it out again.
  syncHeap() {
    const T = this.world.terrain, H = this.heap, dx = T.dx, x0 = this.x + this.heapX0;
    const n = Math.round(H.length / dx), i0 = T.idx(x0);
    if (!this.heapT || this.heapT.length !== n) this.heapT = new Float32Array(n);
    let lo = 1e9, hi = -1;
    for (let k = 0; k < n; k++) {
      const u = k * dx - 0.5, j = Math.floor(u), f = u - j, a = j >= 0 && j < H.length ? H[j] : 0, b = j + 1 >= 0 && j + 1 < H.length ? H[j + 1] : 0;
      const want = (a + (b - a) * f) * 0.8, d = want - this.heapT[k], i = i0 + k;
      if (Math.abs(d) < 1e-4 || i < 0 || i >= T.n) continue;
      T.h[i] += d; this.heapT[k] = want; T.soil[i] = 0; T.crust[i] = 0; T.sink[i] = 0; lo = Math.min(lo, i); hi = Math.max(hi, i);
    }
    if (hi >= 0) { T.mark(lo); T.mark(hi); T.version++; }
  }
  unheap() {
    if (!this.heapT || !this.world) return;
    const T = this.world.terrain, i0 = T.idx(this.x + this.heapX0);
    for (let k = 0; k < this.heapT.length; k++) { const i = i0 + k; if (i >= 0 && i < T.n) T.h[i] -= this.heapT[k]; }
    this.heapT.fill(0); T.mark(Math.max(0, i0)); T.mark(Math.min(T.n - 1, i0 + this.heapT.length)); T.version++;
  }
  heapUnder(x) { if (!this.heapT) return 0; const k = Math.round((x - this.x - this.heapX0) / this.world.terrain.dx); return k >= 0 && k < this.heapT.length ? this.heapT[k] : 0; }
  addHeap(lx, vol) {
    const H = this.heap, j0 = Math.floor(lx - this.heapX0), sp = 3;
    let wsum = 0; for (let d = -sp; d <= sp; d++) wsum += sp + 1 - Math.abs(d);
    for (let d = -sp; d <= sp; d++) { const j = j0 + d; if (j >= 0 && j < H.length) H[j] += vol * (sp + 1 - Math.abs(d)) / wsum; }
    for (let it = 0; it < 6; it++) for (let j = 1; j < H.length; j++) {          // slump to the angle of repose
      const d = H[j] - H[j - 1]; if (Math.abs(d) > 0.5) { const m = (Math.abs(d) - 0.5) / 2 * Math.sign(d); H[j] -= m; H[j - 1] += m; }
    }
    // the ends of the heap taper to the ground (no wall at the edge of the array)
    for (let it = 0; it < 30; it++) { let moved = false; for (const j of [0, H.length - 1]) { const n = j ? j - 1 : 1; if (H[j] > 0.5) { const m = H[j] - 0.5; H[j] = 0.5; H[n] += m; moved = true; } } for (let j = 1; j < H.length; j++) { const d = H[j] - H[j - 1]; if (Math.abs(d) > 0.5) { const m = (Math.abs(d) - 0.5) / 2 * Math.sign(d); H[j] -= m; H[j - 1] += m; } } if (!moved) break; }
    // a collapsed block spreads: the heap rises to about a fifth of the building's height and then widens
    const cap = Math.max(1.2, this.h * 0.2) / 0.8;
    for (let it = 0; it < 4; it++) for (let j = 1; j < H.length - 1; j++) if (H[j] > cap) { const m = (H[j] - cap) / 2; H[j] = cap; H[j - 1] += m; H[j + 1] += m; }
    this.heapVer++;
    this.syncHeap();
  }
  shatter(W) {
    this.glass = true;
    const r = (a, b) => a + Math.random() * (b - a);
    for (let n = 0; n < 26; n++) {
      const key = ['glass2', 'glass3'][n % 2], I = DS.DEBRIS[key], sz = r(0.4, 0.9), cl = this.cells[Math.floor(Math.random() * this.cells.length)];
      if (!cl.ex || cl.st !== 'ok') continue;
      this.pieces.push({ src: key, x: this.x + r(cl.x0, cl.x1), y: this.base + r(cl.y0, cl.y1), vx: r(-4, 4), vy: r(-1, 3), a: 0, w: r(-6, 6), wd: sz, h: sz * I.h / I.w, rest: 0, w0: 0.2 });
    }
    for (let n = 0; n < 160; n++) {
      const cl = this.cells[Math.floor(Math.random() * this.cells.length)]; if (!cl.ex || cl.st !== 'ok') continue;
      W.particles.add(DS.P.DEBRIS, this.x + r(cl.x0, cl.x1), this.base + r(cl.y0, cl.y1), r(-5, 5), r(-1, 4), r(2.5, 6), r(0.04, 0.1), { drag: 0.9, col: Math.random() < 0.6 ? 0xcfe2ec : 0x9db8c6 });
    }
    DS.Audio.glass(this.x, this.base + this.h / 2);
  }

  // ---- drawing ----
  // ragged outline of a cell: edges that border a missing or gutted neighbour are broken back irregularly
  outline(cl, open) {
    const H = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    const { x0, x1, y0, y1 } = cl, w = x1 - x0, h = y1 - y0, pts = [], s = cl.seed, brk = [];
    const edge = (ax, ay, bx, by, nx, ny, b, k) => {
      const n = b ? 7 : 1, d = Math.min(w, h);
      for (let j = 0; j < n; j++) {
        const t = j / n, inset = b && j > 0 ? d * (0.04 + 0.22 * H(s * 3 + k * 17 + j)) : 0;
        const q = [ax + (bx - ax) * t + nx * inset, ay + (by - ay) * t + ny * inset];
        if (b && j > 0) brk.push([pts[pts.length - 1], q]);
        pts.push(q);
      }
      if (b) brk.push([pts[pts.length - 1], [bx, by]]);
    };
    edge(x0, y0, x1, y0, 0, 1, open.b, 1); edge(x1, y0, x1, y1, -1, 0, open.r, 2); edge(x1, y1, x0, y1, 0, -1, open.t, 3); edge(x0, y1, x0, y0, 1, 0, open.l, 4);
    pts.brk = brk; return pts;
  }
  openSides(cl, ch) {
    const nb = (di, dc) => { const b = this.cell(cl.i + di, cl.c + dc); return b && b.ex && (ch ? b.chunk !== ch : !this.carry(b)); };
    return { t: nb(-1, 0), b: nb(1, 0), l: nb(0, -1), r: nb(0, 1) };
  }
  drawCell(ctx, im, cl, ch, grey) {
    const p = this.ppm, open = this.openSides(cl, ch), pts = this.outline(cl, open), e = 0.03;
    ctx.save(); ctx.beginPath(); pts.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
    ctx.save(); ctx.scale(1, -1);
    ctx.drawImage(im, cl.sx - 1, cl.sy - 1, cl.sw + 2, cl.sh + 2, cl.x0 - e, -cl.y1 - e, cl.x1 - cl.x0 + 2 * e, cl.y1 - cl.y0 + 2 * e);
    ctx.restore(); ctx.restore();
    if (grey != null || !(open.t || open.b || open.l || open.r)) return;
    // broken concrete along the torn edges: the grey core of the slab and wall, cracks, rebar sticking out
    const H = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    ctx.lineJoin = 'round';
    const segs = pts.brk;
    ctx.strokeStyle = '#8d8676'; ctx.lineWidth = 0.16; ctx.beginPath(); for (const [a, b] of segs) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
    ctx.strokeStyle = 'rgba(40,34,28,0.75)'; ctx.lineWidth = 0.05; ctx.stroke();
    ctx.strokeStyle = '#6e3f22'; ctx.lineWidth = 0.035; ctx.beginPath();
    segs.forEach(([a, b], j) => {
      if (H(cl.seed + j * 7) > 0.55) return;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, cx = (cl.x0 + cl.x1) / 2, cy = (cl.y0 + cl.y1) / 2;
      let nx = mx - cx, ny = my - cy; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      const len = 0.25 + 0.5 * H(cl.seed + j * 13), bend = (H(cl.seed + j * 5) - 0.5) * 0.6;
      ctx.moveTo(mx, my); ctx.quadraticCurveTo(mx + nx * len * 0.6, my + ny * len * 0.6, mx + nx * len - ny * bend, my + ny * len + nx * bend);
    });
    ctx.stroke();
  }
  // gutted bays, painted into a copy of the building's drawing ('source-atop': only where the drawing has
  // wall, so a room can never be bigger than the building or show where there was sky). Each one: the facade
  // blown in, the burnt-out room behind it, the slab above and the floor below, a ragged rim of facade left
  // round the hole, a little rubble on the floor and rebar hanging from the slab.
  gutTex(im, R) {
    const key = (im === R.cityBroken[this.k] ? 'b' : 'a') + this.cells.filter(cl => cl.st === 'gut').map(cl => cl.i * this.C + cl.c).join(',');
    if (this.gutKey === key && this.gutC) return this.gutC;
    const c = this.gutC || (this.gutC = document.createElement('canvas')); c.width = im.width; c.height = im.height; this.gutKey = key;
    const x = c.getContext('2d'), H = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop';
    const DI = R.debImg;
    for (const cl of this.cells) {
      if (cl.st !== 'gut') continue;
      const { sx, sy, sw, sh } = cl, slab = Math.max(3, sh * 0.11);
      // ragged opening: inset more where the neighbour still stands (the wall carries on past it)
      const nb = (di, dc) => this.carry(this.cell(cl.i + di, cl.c + dc));
      const L = sx + sw * (nb(0, -1) ? 0.14 : 0.04), Rr = sx + sw * (1 - (nb(0, 1) ? 0.14 : 0.04)), T = sy + slab * 1.1, B = sy + sh - slab * 0.9;
      const hole = [], N = 6, j = (k, a) => (H(cl.seed * 7 + k) - 0.5) * a;
      for (let k = 0; k <= N; k++) hole.push([L + (Rr - L) * k / N, T + Math.abs(j(k, sh * 0.16))]);
      for (let k = 1; k <= N; k++) hole.push([Rr - Math.abs(j(k + 10, sw * 0.12)), T + (B - T) * k / N]);
      for (let k = 1; k <= N; k++) hole.push([Rr - (Rr - L) * k / N, B - Math.abs(j(k + 20, sh * 0.12))]);
      for (let k = 1; k < N; k++) hole.push([L + Math.abs(j(k + 30, sw * 0.12)), B - (B - T) * k / N]);
      x.save(); x.beginPath(); hole.forEach(([px, py], k) => k ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); x.clip();
      const g = x.createLinearGradient(0, sy, 0, sy + sh); g.addColorStop(0, '#3b3128'); g.addColorStop(0.35, '#2a221b'); g.addColorStop(1, '#1b1612');
      x.fillStyle = g; x.fillRect(sx, sy, sw, sh);
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(sx + sw * (0.3 + 0.35 * H(cl.seed)), T, sw * 0.12, (B - T) * 0.8);      // a doorway at the back
      x.fillStyle = '#7d766a'; x.fillRect(sx, T - slab * 0.2, sw, slab * 0.55);                                            // underside of the slab above
      x.fillStyle = '#5f594f'; x.fillRect(sx, B - slab * 0.25, sw, slab * 0.6);                                             // floor
      const pile = DI && DI[['pile1', 'pile2', 'grit2'][cl.seed % 3]];
      if (pile) { const pw = sw * (0.4 + 0.3 * H(cl.seed + 3)), ph = pw * pile.height / pile.width; x.drawImage(pile, sx + (sw - pw) * H(cl.seed + 5), B - ph * 0.92, pw, ph); }
      x.strokeStyle = '#6e3f22'; x.lineWidth = Math.max(1.2, sw * 0.012); x.beginPath();
      for (let k = 0; k < 3; k++) { const hx = sx + sw * (0.2 + 0.3 * k + 0.1 * H(cl.seed + k)), len = sh * (0.12 + 0.18 * H(cl.seed + k * 3)); x.moveTo(hx, T); x.quadraticCurveTo(hx + sw * 0.03, T + len * 0.6, hx + (H(cl.seed + 9 + k) - 0.5) * sw * 0.1, T + len); }
      x.stroke();
      x.restore();
      // broken concrete round the rim
      x.strokeStyle = '#9a9283'; x.lineWidth = Math.max(1.5, sw * 0.018); x.beginPath(); hole.forEach(([px, py], k) => k ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); x.stroke();
      x.strokeStyle = 'rgba(35,28,22,0.7)'; x.lineWidth = Math.max(0.8, sw * 0.006); x.stroke();
    }
    return c;
  }
  draw(ctx, cam, grey, R) {
    const D = this.D, k = this.k, im0 = R.cityImg[k]; if (!im0) return;
    if (this.x + this.w + 40 < cam.left || this.x - this.w - 40 > cam.right) return;
    const env = this.world.env || {}, sun = env.night ? null : env.sun, storm = env.visibility ? 1 : 0;
    let im = this.glass && R.cityBroken[k] ? R.cityBroken[k] : im0;
    if (grey != null) im = R.propTinted('city:' + k + (this.glass ? 'b' : ''), 't', grey(0.2), 1);
    else if (storm) im = R.propTinted('city:' + k + (this.glass ? 'b' : ''), 's', '205,176,134', 0.22);
    ctx.imageSmoothingQuality = 'high';
    // shadow of what stands
    if (sun && grey == null) {
      const t = this.top - this.base, run = -sun.side * Math.min(3.2, 1 / Math.tan(sun.el * Math.PI / 180)) * t * 0.5, e = this.w * 0.46;
      if (t > 0.5) { ctx.fillStyle = storm ? 'rgba(52,36,18,0.12)' : 'rgba(52,36,18,0.24)'; ctx.beginPath(); ctx.moveTo(this.x - e, this.base + 0.2); ctx.lineTo(this.x + e, this.base + 0.2); ctx.lineTo(this.x + e + run, this.base - 2.6); ctx.lineTo(this.x - e + run, this.base - 2.6); ctx.closePath(); ctx.fill(); }
    }
    ctx.save(); ctx.translate(this.x, this.base);
    if (!this.touched) { ctx.save(); ctx.scale(1, -1); ctx.drawImage(im, -this.w / 2, -this.h, this.w, this.h); ctx.restore(); }
    else {
      if (grey == null && this.cells.some(cl => cl.st === 'gut')) im = this.gutTex(im, R);
      for (const cl of this.cells) if (this.carry(cl)) this.drawCell(ctx, im, cl, null, grey);
      // soot where shells burst, kept on the standing wall
      if (grey == null && this.scorch.length) {
        ctx.save(); ctx.beginPath(); for (const cl of this.cells) if (this.carry(cl)) ctx.rect(cl.x0, cl.y0, cl.x1 - cl.x0, cl.y1 - cl.y0); ctx.clip();
        for (const s of this.scorch) { const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 1.6); gr.addColorStop(0, 'rgba(18,14,10,0.8)'); gr.addColorStop(0.4, 'rgba(28,22,15,0.45)'); gr.addColorStop(1, 'rgba(30,24,16,0)'); ctx.fillStyle = gr; ctx.fillRect(s.x - s.r * 1.6, s.y - s.r * 1.6, s.r * 3.2, s.r * 3.2); }
        ctx.restore();
      }
      // falling blocks
      for (const ch of this.chunks) {
        ctx.save(); ctx.translate(ch.ax + ch.ox, ch.ay + ch.oy); ctx.rotate(ch.ang); ctx.translate(-ch.ax, -ch.ay);
        for (const cl of ch.cells) this.drawCell(ctx, im, cl, ch, grey);       // (gutted rooms ride along in the composite texture)
        ctx.restore();
      }
    }
    ctx.restore();
    this._im = im;
  }
  // after the ground: the heap (it is part of the ground now) and the fragments lying on it
  drawFront(ctx, cam, grey, R) {
    if (this.x + this.w + 40 < cam.left || this.x - this.w - 40 > cam.right) return;
    const im = this._im || R.cityImg[this.k];
    this.drawHeap(ctx, cam, grey, R);
    const DI = R.debImg;
    for (const p of this.pieces) {
      const img = p.src === 'cell' ? im : DI[p.src]; if (!img) continue;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, -1);
      if (p.src === 'cell') ctx.drawImage(img, p.sx, p.sy, p.sw, p.sh, -p.wd / 2, -p.h / 2, p.wd, p.h);
      else if (grey != null) { ctx.fillStyle = `rgb(${grey(0.1)})`; ctx.fillRect(-p.wd / 2, -p.h / 2, p.wd, p.h); }
      else ctx.drawImage(img, -p.wd / 2, -p.h / 2, p.wd, p.h);
      ctx.restore();
    }
  }
  // rubble heap: a mound of the right height covered with heap sprites chosen by the local height
  drawHeap(ctx, cam, grey, R) {
    const H = this.heap; let any = false; for (let j = 0; j < H.length; j++) if (H[j] > 0.15) { any = true; break; }
    if (!any) return;
    const T = this.world.terrain, x0 = this.x + this.heapX0;
    if (!this.heapDraw || this.heapDraw.v !== this.heapVer) {
      const L = [], rnd = DS.rng(this.k.length * 13 + Math.round(this.x));
      for (let j = 1; j < H.length - 1; j += 2) {
        const h = (H[j - 1] + H[j] + H[j + 1]) / 3; if (h < 0.35) continue;
        const key = h > 3.2 ? ['pile5', 'mixed4', 'pile5'][j % 3] : h > 2.2 ? ['pile4', 'mixed1', 'mixed3'][j % 3] : h > 1.3 ? ['pile3', 'mixed2', 'pile4'][j % 3] : h > 0.7 ? ['pile2', 'pile3'][j % 2] : 'pile1';
        const I = DS.DEBRIS[key], hh = h * (1.05 + 0.2 * rnd()), ww = hh * I.w / I.h;
        L.push({ key, x: x0 + j + 0.5 + (rnd() - 0.5) * 1.2, w: Math.min(ww, 12), h: Math.min(ww, 12) * I.h / I.w });
      }
      L.sort((a, b) => b.h - a.h);
      this.heapDraw = { v: this.heapVer, L };
    }
    // mound under the sprites so no gaps show
    ctx.beginPath(); ctx.moveTo(x0, T.height(x0));
    for (let j = 0; j <= H.length * 4; j++) { const x = x0 + j / 4; ctx.lineTo(x, T.height(x)); }
    for (let j = H.length * 4; j >= 0; j--) { const x = x0 + j / 4; ctx.lineTo(x, T.height(x) - this.heapUnder(x) - 0.02); }
    ctx.closePath();
    if (grey != null) { ctx.fillStyle = `rgb(${grey(0.05)})`; ctx.fill(); }
    else {
      // the mound is filled with a rubble texture (pieces of the debris sheet packed together), shaded darker
      // toward the foot, so no plain colour shows between the heap sprites
      const pat = R.rubblePattern(), m = ctx.getTransform();
      if (pat) {
        const z = Math.hypot(m.a, m.b), k = 7 / 256 * z;                     // one tile = 7 m
        pat.setTransform(new DOMMatrix([k, 0, 0, k, (m.e % (256 * k)), (m.f % (256 * k))]));
        ctx.save(); ctx.clip(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = pat; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
        ctx.save(); ctx.clip();
        const gy = T.height(this.x), sh = ctx.createLinearGradient(0, gy + 4, 0, gy);
        sh.addColorStop(0, 'rgba(60,48,34,0)'); sh.addColorStop(1, 'rgba(60,48,34,0.35)'); ctx.fillStyle = sh; ctx.fillRect(x0, gy - 1, H.length, 8); ctx.restore();
      } else { ctx.fillStyle = '#a39276'; ctx.fill(); }
    }
    const DI = R.debImg;
    for (const s of this.heapDraw.L) { const im = DI[s.key]; if (!im) continue; const y = T.height(s.x) - this.heapUnder(s.x) - 0.1; ctx.save(); ctx.translate(s.x, y); ctx.scale(1, -1);
      if (grey != null) { ctx.fillStyle = `rgb(${grey(0.05)})`; ctx.fillRect(-s.w / 2, -s.h, s.w, s.h * 0.6); } else ctx.drawImage(im, -s.w / 2, -s.h, s.w, s.h); ctx.restore(); }
  }
};

// images: buildings, their broken-glass versions, and the debris pieces
Object.assign(DS.Renderer.prototype, {
  // a 256 px tile of packed rubble cut from the debris pieces (built once the pieces have loaded)
  rubblePattern() {
    if (this._rubPat !== undefined) return this._rubPat;
    const DI = this.debImg, keys = ['conc1', 'conc2', 'conc3', 'conc4', 'conc5', 'conc6', 'conc7', 'brick1', 'brick3', 'block1', 'block2', 'grit1', 'grit2', 'gravel', 'rebar3', 'slab1'];
    if (!keys.every(k => DI[k] && DI[k].complete)) return null;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), r = DS.rng(19);
    x.fillStyle = '#8c7d66'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      const im = DI[keys[Math.floor(r() * keys.length)]], s = 18 + r() * 46, w = s, h = s * im.height / im.width, px = r() * 256, py = r() * 256, a = (r() - 0.5) * 1.2;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { if (px + ox < -s || px + ox > 256 + s || py + oy < -s || py + oy > 256 + s) continue;
        x.save(); x.translate(px + ox, py + oy); x.rotate(a); x.drawImage(im, -w / 2, -h / 2, w, h); x.restore(); }
    }
    this._rubPat = this.ctx.createPattern(c, 'repeat');
    return this._rubPat;
  },
  loadCity() {
    this.cityImg = {}; this.cityBroken = {}; this.debImg = {}; this.w.rend = this;
    const one = (src, cb) => new Promise(res => { const im = new Image(); im.onload = () => { cb(im); res(); }; im.onerror = () => res(); im.src = src; });
    return Promise.all(Object.keys(DS.CITY).map(k => one('assets/sprites/city/' + k + '.webp', im => {
      this.cityImg[k] = im; this.propImg['city:' + k] = im;
      // broken glass: the dark blue-grey panes knocked out to black with a few shards left in the frames
      try {
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height), a = d.data, r = DS.rng(7);
        for (let i = 0; i < a.length; i += 4) { const R = a[i], G = a[i + 1], B = a[i + 2], L = (R * 3 + G * 6 + B) / 10; if (a[i + 3] > 128 && L < 120 && B >= R - 12) { const s = r() < 0.012; a[i] = s ? 96 : 22 + (L >> 3); a[i + 1] = s ? 108 : 23 + (L >> 3); a[i + 2] = s ? 116 : 27 + (L >> 3); } }
        x.putImageData(d, 0, 0); this.cityBroken[k] = c; this.propImg['city:' + k + 'b'] = c;
      } catch (e) { /* a page opened from disk cannot read its own images back: keep the panes */ }
    })).concat(Object.keys(DS.DEBRIS).map(k => one('assets/sprites/debris/' + k + '.webp', im => { this.debImg[k] = im; }))));
  },
});
