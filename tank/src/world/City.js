// Town buildings that break up and come down (firing range). Each building is its drawing on two grids
// (data/city.js):
//   - blocks of 0.75 m: what a hit takes out. Shells, shaped charges and blast knock blocks out round the point
//     of impact (falling off with distance, a little at random, so holes are irregular); where the wall is
//     gone but the bay still stands the dark inside of the building shows through. Shots pass through holes.
//   - cells (bays between floor slabs and piers): what carries load. A cell that has lost half its blocks
//     fails; a cell stands on the cell under it, a slab can span a gap of up to four bays between two standing
//     cells and cantilever one bay past the last one. Cells that lose every path fall.
//   - when a storey has lost more than half its cells, everything above it goes as one block, after a moment
//     of creaking and dust: straight down onto the storeys below (each impact crushes the lowest storey of the
//     block and the top of what it lands on — the floors pancake, dust jets out at every floor) or, if its
//     weight is off to one side, it pivots on the last standing edge, tips over and breaks up where it lands.
//     Where it reaches the ground a dust cloud rolls out along it and hangs for half a minute.
// Everything that comes off is cut from the building's own drawing into irregular shards — a few big slab
// pieces, more mid-sized chunks and many small ones; hard landings break big shards again — plus a little
// concrete and rebar from the debris sheet, grit and dust. The material piles up at the foot as a rubble heap
// that is part of the ground. Vehicles pass in front of the buildings; shells, sight lines and blast meet them.
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
    this.chunks = []; this.pieces = []; this.fires = []; this.glass = false; this.touched = false;
    this.heap = new Float32Array(Math.ceil(this.w * 2.6) + 8); this.heapX0 = -this.w * 1.3 - 4; this.heapVer = 0; this.heapDraw = null;
    this.state = 'ok'; this.hits = 0; this.sink = 0; this.crackT = 0;
    // 0.75 m blocks (sprite px): built on first damage, once the drawing is loaded (its alpha says where there is wall)
    this.bs = 0.75 * p; this.GX = Math.ceil(D.w / this.bs); this.GY = Math.ceil(D.h / this.bs);
    this.blk = null; this.face = null; this.faceKey = null; this.ops = []; this.faceVer = 0;
  }
  ensureBlocks() {
    if (this.blk) return;
    const D = this.D, GX = this.GX, GY = this.GY, bs = this.bs, n = GX * GY;
    this.blk = new Float32Array(n).fill(-1); this.blkCell = new Int32Array(n).fill(-1);
    let alpha = null; const im = this.world.rend && this.world.rend.cityImg[this.k];
    if (im) try { const c = document.createElement('canvas'); c.width = GX; c.height = GY; const x = c.getContext('2d'); x.drawImage(im, 0, 0, GX * bs, GY * bs, 0, 0, GX, GY); alpha = x.getImageData(0, 0, GX, GY).data; } catch (e) { alpha = null; }
    for (const cl of this.cells) cl.nb = cl.left = 0;
    for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
      const k = gy * GX + gx, sx = (gx + 0.5) * bs, sy = (gy + 0.5) * bs;
      if (sx >= D.w || sy >= D.h || (alpha && alpha[k * 4 + 3] < 60)) continue;
      let c = 0; while (c < this.C - 1 && sx >= D.cols[c + 1]) c++;
      let i = 0; while (i < this.R - 1 && sy >= D.rows[i + 1]) i++;
      const cl = this.cell(i, c); if (!cl || !cl.ex) continue;
      this.blk[k] = this.hpMax / 100; this.blkCell[k] = i * this.C + c; cl.nb++; cl.left++;
    }
    for (const cl of this.cells) if (cl.ex && !cl.nb) { cl.nb = cl.left = 1; }       // (a cell with no sampled wall still counts)
    this.cleared = new Uint8Array(n); this.holed = new Uint8Array(n);                                 // block taken off the face (fell, or rides a falling block)
    this.faceImg();
  }
  // building-local metres → block index (or -1)
  blockAt(lx, ly) {
    const sx = (lx + this.w / 2) * this.ppm, sy = this.D.h - ly * this.ppm, gx = Math.floor(sx / this.bs), gy = Math.floor(sy / this.bs);
    return gx >= 0 && gx < this.GX && gy >= 0 && gy < this.GY ? gy * this.GX + gx : -1;
  }
  solidAt(lx, ly) { if (!this.blk) return true; const k = this.blockAt(lx, ly); return k < 0 || this.blk[k] !== 0; }
  cell(i, c) { return i >= 0 && i < this.R && c >= 0 && c < this.C ? this.cells[i * this.C + c] : null; }
  stand(cl) { return cl && cl.ex && cl.st === 'ok' && !cl.chunk; }
  // still in place and carrying load
  carry(cl) { return cl && cl.ex && !cl.chunk && cl.st === 'ok'; }
  get top() { let t = 0; for (const cl of this.cells) if (this.stand(cl)) t = Math.max(t, cl.y1); return this.base + t; }
  get bottomY() { return this.base; }

  // ---- hits ----
  rayHit(x0, y0, x1, y1) {
    const xa = this.x - this.w / 2, xb = this.x + this.w / 2, yt = this.top;
    if (Math.max(x0, x1) < xa || Math.min(x0, x1) > xb || Math.max(y0, y1) < this.base || Math.min(y0, y1) > yt) return null;
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / 0.3));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, cl = this.cellAt(x - this.x, y - this.base);
      if (cl && cl.st === 'ok' && this.solidAt(x - this.x, y - this.base)) return { t, x, y, cl };     // holes let shots through
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
    const R = Math.max(0.8, r * 0.65);
    if (d0 > R * 1.6) return;
    const lx = x - this.x, ly = y - this.base;
    this.ensureBlocks(); this.touched = true;
    this.soot(lx, ly, R * 1.6, 0.8);
    if (d0 <= R && this.damageAt(W, lx, ly, R, 2.6, x)) this.hits++;
    if (r >= 3 && Math.random() < 0.7 && this.cellAt(lx, ly)) this.fires.push({ lx, ly, t: 0, dur: 15 + Math.random() * 20, next: 0 });
  }
  // armour-piercing shot, shaped charge or cannon shell striking the wall
  hit(W, x, y, p) {
    const A = p.ammo, lx = x - this.x, ly = y - this.base;
    this.ensureBlocks(); this.touched = true;
    if (A.small) { if (A.d >= 0.02) this.soot(lx, ly, 0.3, 0.5); this.damageAt(W, lx, ly, A.d >= 0.02 ? 0.25 : 0.12, A.d >= 0.02 ? 0.4 : 0.05, x); }
    else if (A.pen && A.pen.ce) { this.soot(lx, ly, 1.6, 0.8); this.damageAt(W, lx, ly, 0.85, 2.2, x); }     // shaped charge: a round hole, scorched round
    else { this.soot(lx, ly, 0.9, 0.55); this.damageAt(W, lx, ly, 0.5, 2.4, x); }                               // AP shot: a small hole punched through
  }
  // knock blocks out round (lx, ly): damage dmg at the centre, falling off to nothing at r + one block, with a
  // little randomness so the hole is ragged. Cells that lose half their blocks fail. Returns true if anything broke.
  damageAt(W, lx, ly, r, dmg, fromX) {
    this.ensureBlocks();
    const p = this.ppm, bs = this.bs, B = this.blk, GX = this.GX, reach = r + 0.75;
    const sx = (lx + this.w / 2) * p, sy = this.D.h - ly * p, rr = reach * p;
    const gx0 = Math.max(0, Math.floor((sx - rr) / bs)), gx1 = Math.min(GX - 1, Math.floor((sx + rr) / bs));
    const gy0 = Math.max(0, Math.floor((sy - rr) / bs)), gy1 = Math.min(this.GY - 1, Math.floor((sy + rr) / bs));
    const out = [];
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const k = gy * GX + gx; if (B[k] <= 0) continue;
      const cl = this.cells[this.blkCell[k]]; if (!cl || cl.st !== 'ok' || cl.chunk || this.cleared[k]) continue;
      const d = Math.hypot((gx + 0.5) * bs - sx, (gy + 0.5) * bs - sy) / p;
      if (d > reach) continue;
      B[k] -= dmg * (1 - d / reach) * (0.6 + Math.random() * 0.8);
      if (B[k] <= 0) { B[k] = 0; cl.left--; out.push(k); }
    }
    if (!out.length) return false;
    this.touched = true;
    this.spillBlocks(W, out, fromX);                                 // (cut from the face before the holes are painted)
    for (const k of out) { this.holed[k] = 1; this.op({ t: 'hole', k }); this.op({ t: 'soot', x: (k % GX + 0.5) * bs, y: ((k / GX | 0) + 0.5) * bs, r: bs * 1.7, a: 0.4 }); }
    let failed = false;
    for (const cl of this.cells) if (cl.ex && cl.st === 'ok' && !cl.chunk && cl.left < cl.nb * 0.5) { this.failCell(W, cl, fromX); failed = true; }
    this.settle(W);
    return true;
  }
  // a bay that has lost too much wall to carry anything: what is left of it comes down
  failCell(W, cl, fromX) { cl.st = 'gone'; this.spillCell(W, cl, fromX); this.clearBlocks(cl); }
  clearBlocks(cl) {
    if (!this.blk) return;
    const j = cl.i * this.C + cl.c, set = new Set();
    for (let k = 0; k < this.blk.length; k++) if (this.blkCell[k] === j && !this.cleared[k] && this.blk[k] !== -1) set.add(k);
    this.clearSet(set); cl.left = 0;
  }
  // take a set of blocks off the face: their outline is jagged only where a block still on the face borders
  // them; toward empty space it reaches past the block edge, so nothing is ever left hanging between clearings
  present(k) { return k >= 0 && this.blk[k] !== -1 && !this.cleared[k]; }
  clearSet(set) {
    if (!set.size) return;
    const pts = this.blockPolys(set, k2 => this.present(k2) && !set.has(k2));
    for (const k of set) { this.cleared[k] = 1; this.blk[k] = 0; }
    this.op({ t: 'clr', pts });
  }
  // outline polygons (sprite px) of the blocks in set; open(k) says a neighbour edge must be jagged
  blockPolys(set, open, ox = 0, oy = 0) {
    const bs = this.bs, GX = this.GX, GY = this.GY, e = bs * 0.4, out = [];
    const H = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    const nb = (gx, gy) => gx < 0 || gy < 0 || gx >= GX || gy >= GY ? -1 : gy * GX + gx;
    for (const k of set) {
      const gx = k % GX, gy = (k / GX) | 0;
      const oT = open(nb(gx, gy - 1)), oR = open(nb(gx + 1, gy)), oB = open(nb(gx, gy + 1)), oL = open(nb(gx - 1, gy));
      const x0 = gx * bs - (oL ? 0 : e) - ox, x1 = (gx + 1) * bs + (oR ? 0 : e) - ox, y0 = gy * bs - (oT ? 0 : e) - oy, y1 = (gy + 1) * bs + (oB ? 0 : e) - oy;
      // jag on a shared edge is seeded by the edge itself, so both sides of it cut the same line
      const jag = (ax, ay, bx, by, seed, P) => { for (const t of [0.33, 0.67]) { const d = (H(seed + t * 7) - 0.5) * bs * 0.5; P.push(ax + (bx - ax) * t + (ay === by ? 0 : d), ay + (by - ay) * t + (ay === by ? d : 0)); } };
      const hE = (gx, gy) => gy * 7919 + gx * 31 + 1, vE = (gx, gy) => gy * 7919 + gx * 31 + 5;
      const P = [x0, y0];
      if (oT) jag(x0, y0, x1, y0, hE(gx, gy), P); P.push(x1, y0);
      if (oR) jag(x1, y0, x1, y1, vE(gx + 1, gy), P); P.push(x1, y1);
      if (oB) jag(x1, y1, x0, y1, hE(gx, gy + 1), P); P.push(x0, y1);
      if (oL) jag(x0, y1, x0, y0, vE(gx, gy), P);
      out.push(P);
    }
    return out;
  }
  // (used by falling blocks crushing what they land on)
  damageCell(W, cl, dmg, fromX, lx, ly) {
    if (cl.st !== 'ok') return;
    this.damageAt(W, lx != null ? lx : (cl.x0 + cl.x1) / 2, ly != null ? ly : cl.y1, 1.2 + dmg / 120, 2 + dmg / 60, fromX);
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
          if (!ok) {
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
    for (const F of falling) this.drop(W, F.cells, F.piv, F === falling[0] && !!block);
    if (falling.length) this.touched = true;
    if (!this.cells.some(cl => cl.ex && cl.st === 'ok')) this.state = 'rubble';
    else if (this.touched) this.state = 'damaged';
  }
  // big: a storey has given way under everything above it. It creaks and sheds dust for a moment first.
  drop(W, cells, piv, big) {
    const n = cells.length, hold = big || piv ? 0.6 + Math.random() * 1.2 : n > 4 ? 0.25 + Math.random() * 0.35 : 0.05;
    const ch = { cells, ang: 0, w: 0, ox: 0, oy: 0, vx: 0, vy: 0, t: 0, piv, crumble: 0, hold, held: 0, n0: n, cloudT: 0 };
    if (hold > 0.2) DS.Audio.creak(this.x, this.base + this.h / 2, Math.min(1.5, 0.4 + n * 0.03), hold);
    let ax = 0, ay = 1e9, top = 0; for (const cl of cells) { cl.chunk = ch; ax += (cl.x0 + cl.x1) / 2; ay = Math.min(ay, cl.y0); top = Math.max(top, cl.y1); }
    ch.ax = piv ? piv.x : ax / cells.length; ch.ay = piv ? piv.y : ay; ch.Lh = top - ay;
    if (!piv) ch.w = (Math.random() - 0.5) * 0.04;
    ch.x0 = Math.min(...cells.map(c => c.x0)); ch.x1 = Math.max(...cells.map(c => c.x1));
    this.chunkArt(ch);
    this.chunks.push(ch);
  }
  // what the falling block looks like: its blocks lifted off the face into a canvas of its own. Where it
  // breaks away from a standing bay below, the break runs along a slanting, ragged crack a couple of blocks
  // either side of the floor line instead of the straight slab edge.
  chunkArt(ch) {
    if (!this.blk) return;
    const GX = this.GX, bs = this.bs, H = n => { const v = Math.sin(n * 91.7 + 17.3) * 43758.5453; return v - Math.floor(v); };
    const idx = new Map(ch.cells.map(cl => [cl.i * this.C + cl.c, cl])), S = new Set();
    for (let k = 0; k < this.blk.length; k++) if (idx.has(this.blkCell[k]) && this.present(k)) S.add(k);
    const slope = (Math.random() - 0.5) * 0.9, seed = Math.random() * 1000;
    for (const cl of ch.cells) {
      const below = this.cell(cl.i + 1, cl.c); if (!this.stand(below)) continue;
      const gyB = Math.round((cl.sy + cl.sh) / bs), gx0 = Math.floor(cl.sx / bs), gx1 = Math.ceil((cl.sx + cl.sw) / bs), gxc = (gx0 + gx1) / 2;
      for (let gx = gx0; gx < gx1; gx++) {
        const cutY = gyB + Math.max(-2, Math.min(2, Math.round(slope * (gx - gxc) + (H(seed + gx) - 0.5) * 2.6)));
        for (let gy = gyB - 2; gy < gyB + 2; gy++) {
          const k = gy * GX + gx; if (gy < 0 || gy >= this.GY || !this.present(k)) continue;
          const own = this.blkCell[k];
          if (gy >= cutY && idx.has(own)) { S.delete(k); this.blkCell[k] = below.i * this.C + below.c; }        // stays as a stump on the bay below
          else if (gy < cutY && own === below.i * this.C + below.c) { S.add(k); this.blkCell[k] = cl.i * this.C + cl.c; }   // torn off with the block
        }
      }
    }
    if (!S.size) return;
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    for (const k of S) { const gx = k % GX, gy = (k / GX) | 0; a = Math.min(a, gx); b = Math.min(b, gy); c = Math.max(c, gx); d = Math.max(d, gy); }
    const ox = Math.max(0, (a - 1) * bs), oy = Math.max(0, (b - 1) * bs), w = Math.ceil((c + 2) * bs - ox), h = Math.ceil((d + 2) * bs - oy);
    const cv = document.createElement('canvas'); cv.width = Math.max(1, w); cv.height = Math.max(1, h); const x = cv.getContext('2d');
    x.drawImage(this.face, ox, oy, w, h, 0, 0, w, h);
    const open = k2 => this.present(k2) && !S.has(k2);
    x.globalCompositeOperation = 'destination-in'; this.fillPolys(x, this.blockPolys(S, open, ox, oy));
    ch.S = S; ch.cv = cv; ch.box = [ox, oy, w, h];
    this.clearSet(S);
  }
  fillPolys(x, polys) {
    x.beginPath();
    for (const P of polys) { x.moveTo(P[0], P[1]); for (let j = 2; j < P.length; j += 2) x.lineTo(P[j], P[j + 1]); x.closePath(); }
    x.fillStyle = '#000'; x.fill();
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
    // fires inside the building: smoke out of the opening and soot climbing the wall above it
    for (const f of this.fires) {
      f.t += dt; f.next -= dt;
      if (!this.cellAt(f.lx, f.ly) || f.t > f.dur) { f.done = true; continue; }
      const wx = this.x + f.lx, wy = this.base + f.ly, k = Math.min(1, f.t / 4) * Math.min(1, (f.dur - f.t) / 5);
      if (Math.random() < dt * 4 * k) W.particles.add(DS.P.DARK, wx + (Math.random() - 0.5), wy + 0.5, (Math.random() - 0.5) * 0.6, 1 + Math.random(), 6 + Math.random() * 5, 0.8 + Math.random() * 0.8, { grow: 0.7, drag: 0.6, grav: -0.03, alpha: 0.45 * k, col: 0x2a2623 });
      if (f.t < f.dur * 0.6 && Math.random() < dt * 6 * k) W.particles.add(DS.P.FLAME, wx + (Math.random() - 0.5) * 0.8, wy + Math.random() * 0.4, 0, 0.8 + Math.random(), 0.8 + Math.random() * 0.6, 0.5 + Math.random() * 0.4, { grow: 0.3, drag: 1, grav: -0.05, alpha: 0.8, col: 0x3a3430 });
      if (f.next <= 0) { f.next = 0.7; const sx = (f.lx + this.w / 2) * this.ppm, sy = this.D.h - f.ly * this.ppm, u = Math.min(1, f.t / 12);
        this.op({ t: 'streak', x: sx + (Math.random() - 0.5) * this.bs * 0.4, y: sy - this.bs * 0.3, w: this.bs * (0.9 + 0.8 * u), h: this.bs * (2 + 4 * u), a: 0.12 }); }
    }
    if (this.fires.length) this.fires = this.fires.filter(f => !f.done);
    for (const ch of this.chunks) {
      if (ch.hold > 0) {                                  // creaking: dust sifting out along the failing floor
        ch.hold -= dt; ch.held += dt;
        if (Math.random() < dt * 30) W.particles.add(DS.P.DUST, this.x + ch.x0 + Math.random() * (ch.x1 - ch.x0), this.base + ch.ay + (Math.random() - 0.3) * 1.5, (Math.random() - 0.5) * 2, -0.3 - Math.random(), 4 + Math.random() * 4, 0.6 + Math.random() * 1.2, { grow: 0.6, drag: 0.8, grav: 0.02, alpha: 0.35, col: 0xc6b597 });
        if (Math.random() < dt * 14) W.particles.add(DS.P.DEBRIS, this.x + ch.x0 + Math.random() * (ch.x1 - ch.x0), this.base + ch.ay, (Math.random() - 0.5) * 2, 0, 3, 0.05 + Math.random() * 0.08, { drag: 0.2, col: 0x8f8472 });
        ch.ang = (Math.random() - 0.5) * 0.004 * ch.held;      // a tremor
        if (ch.hold <= 0) { ch.ang = 0; DS.Audio.collapse(this.x, this.base, Math.min(6, 1.5 + ch.n0 * 0.08)); }
        continue;
      }
      ch.t += dt; ch.cloudT -= dt; ch.jetT = (ch.jetT || 0) - dt;
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
        if (crush.length && speed > 3 && ch.jetT <= 0) { ch.jetT = 0.18; this.floorJets(W, ch, low, speed); }
        if (low.s > 0.3 && speed > 4) { const under = this.cellAt(low.x, low.s - 0.2); if (under && !under.chunk) this.damageCell(W, under, speed * 14, this.x + low.x, low.x, low.s - 0.4); }
        if (speed > 4 && ch.cloudT <= 0 && low.s < 2.5) { ch.cloudT = 0.6; this.dustCloud(W, this.x + low.x, Math.min(1.4, (ch.cells.length + 2) / 14 * speed / 12)); }
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
    const supp = p => {                                   // ground (heap included) or a resting fragment under it
      let gy = T.height(p.x) + p.h * 0.35;
      for (const q of this.pieces) { if (!q.rest || q === p || q.gone || Math.abs(q.x - p.x) > (q.wd + p.wd) * 0.38) continue; const top = q.y + q.h * 0.42 + p.h * 0.4; if (top > gy && top < p.y + 0.3) gy = top; }
      return gy;
    };
    for (const p of this.pieces) {
      if (p.rest) {                                       // what it was lying on may have gone: then it falls again
        p.chk = (p.chk || Math.random() * 0.25) - dt;
        if (p.chk <= 0) { p.chk = 0.25; if (p.y > supp(p) + 0.12) { p.rest = 0; p.vy = 0; } }
        continue;
      }
      p.vy -= g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.w * dt;
      const gy = supp(p);
      if (p.y < gy) {
        p.y = gy;
        if (p.src === 'shard' && p.vy < -9 && p.wd > 0.6 && this.budget()) { this.breakShard(W, p, gy); continue; }     // a hard landing breaks a big shard again
        if (p.vy < -2.5) { p.vy *= -0.25; p.vx *= 0.55; p.w *= 0.5; if (p.big && Math.random() < 0.5) W.particles.add(DS.P.DUST, p.x, gy, (Math.random() - 0.5) * 3, Math.random() * 2, 3 + Math.random() * 3, 0.8 + p.w0, { grow: 1, drag: 1, grav: 0, alpha: 0.32, col: 0xc9b79a }); }
        else { p.rest = 1; p.vx = p.vy = 0; p.a = Math.round(p.a / Math.PI) * Math.PI + (Math.random() - 0.5) * 0.5; }
      }
    }
    this.pieces = this.pieces.filter(p => !p.gone);
    if (this.pieces.length > 460) { const rest = this.pieces.filter(p => p.rest); rest.sort((a, b) => b.wd - a.wd); const keep = new Set(rest.slice(0, 300)); this.pieces = this.pieces.filter(p => !p.rest || keep.has(p)); }
  }
  breakShard(W, p, gy) {
    p.gone = true;
    const sw = p.img.width, sh = p.img.height, src = { cv: p.img, ox: 0, oy: 0, m: p.wd / sw }, r = (a, b) => a + Math.random() * (b - a), n = 2 + Math.floor(Math.random() * 2), sp = Math.min(6, -p.vy * 0.25);
    for (let j = 0; j < n; j++) {
      const f = r(0.4, 0.7), w = sw * f, h = sh * r(0.45, 0.8);
      this.addShard(W, this.shard(r(0, sw - w), r(0, sh - h), w, h, src), p.x + r(-0.3, 0.3) * p.wd, gy + 0.2, p.vx * 0.5 + r(-sp, sp), r(0.5, sp));
    }
    W.particles.add(DS.P.DUST, p.x, gy, r(-1.5, 1.5), r(0.5, 2), r(4, 7), 0.8 + p.wd * 0.6, { grow: 1, drag: 1, grav: 0, alpha: 0.35, col: 0xc9b79a });
    for (let j = 0; j < 5; j++) W.particles.add(DS.P.DEBRIS, p.x, gy + 0.1, r(-5, 5), r(1, 5), r(1, 2), r(0.04, 0.1), { drag: 0.3, col: 0x8f8472 });
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
    this.spillCell(W, cl, null, ch);
    if (ch.S) {
      // the crushed bay's blocks come off the block, and some of the row above it with them (a ragged front)
      const j = cl.i * this.C + cl.c, GX = this.GX, bs = this.bs, R = new Set(), top = Math.floor(cl.sy / bs);
      for (const k of ch.S) { const own = this.blkCell[k]; if (own === j) R.add(k); else if (((k / GX) | 0) === top - 1 && Math.random() < 0.45 && ch.cells.some(c => c.i * this.C + c.c === own)) R.add(k); }
      for (const k of R) ch.S.delete(k);
      if (R.size) { const x = ch.cv.getContext('2d'); x.save(); x.globalCompositeOperation = 'destination-out'; this.fillPolys(x, this.blockPolys(R, k2 => ch.S.has(k2), ch.box[0], ch.box[1])); x.restore(); }
    }
    this.clearBlocks(cl);
  }

  // ---- what comes off ----
  // An irregular shard of the drawing: the sprite-px box (sx, sy, sw, sh) clipped to a jagged polygon and kept
  // in its own little canvas, so drawing it later is a single image (no clipping per frame).
  shard(sx, sy, sw, sh, src) {
    const S = src || { cv: this.skin || ((this.glass && this.world.rend.cityBroken[this.k]) || this.world.rend.cityImg[this.k]), ox: 0, oy: 0, m: 1 / this.ppm };
    if (!S.cv || sw < 1 || sh < 1) return null;
    const s = Math.min(1, 72 / Math.max(sw, sh)), w = Math.max(2, Math.ceil(sw * s)), h = Math.max(2, Math.ceil(sh * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const n = 5 + Math.floor(Math.random() * 3), a0 = Math.random() * 6.28;
    x.beginPath();
    for (let j = 0; j < n; j++) {
      const a = a0 + j / n * 6.283 + (Math.random() - 0.5) * 0.6, rr = 0.72 + Math.random() * 0.28;
      const px = w / 2 + Math.cos(a) * w / 2 * rr * 1.25, py = h / 2 + Math.sin(a) * h / 2 * rr * 1.25;
      x[j ? 'lineTo' : 'moveTo'](Math.max(0, Math.min(w, px)), Math.max(0, Math.min(h, py)));
    }
    x.closePath(); x.clip(); x.drawImage(S.cv, sx - S.ox, sy - S.oy, sw, sh, 0, 0, w, h);
    // an empty cut (the part was already gone) makes no shard
    try { const d = x.getImageData(0, 0, w, h).data; let o = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) o++; if (o * 4 < w * h * 0.12) return null; } catch (e) { /* unreadable: keep it */ }
    return { img: c, wd: sw * S.m, h: sh * S.m };
  }
  addShard(W, sh, x, y, vx, vy) {
    if (!sh) return;
    this.pieces.push({ src: 'shard', img: sh.img, x, y, vx, vy, a: (Math.random() - 0.5) * 0.4, w: (Math.random() - 0.5) * (8 - Math.min(6, sh.wd * 3)),
      wd: sh.wd, h: sh.h, big: sh.wd > 0.9, w0: sh.wd * 0.3, rest: 0 });
  }
  // budget: with many fragments about, new ones are made bigger (fewer), and past the cap only dust and grit
  budget() { const n = this.pieces.length; return n > 420 ? 0 : 1 + n / 140; }
  // blocks knocked out of a standing wall: each leaves as a few small shards blown away from the shot
  spillBlocks(W, ks, fromX) {
    const P = W.particles, r = (a, b) => a + Math.random() * (b - a), bs = this.bs, GX = this.GX, bud = this.budget();
    for (const k of ks) {
      const gx = k % GX, gy = (k / GX) | 0, sx = gx * bs, sy = gy * bs;
      const x = this.x + (sx + bs / 2) / this.ppm - this.w / 2, y = this.base + (this.D.h - sy - bs / 2) / this.ppm;
      const out = fromX == null ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(x - fromX) || 1;
      const n = bud ? Math.max(1, Math.round((1 + Math.random() * 2.5) / bud)) : 0;
      for (let j = 0; j < n; j++) {
        const f = r(0.3, 0.75), w = bs * f, h = bs * f * r(0.6, 1.2);
        this.addShard(W, this.shard(sx + r(0, bs - w), sy + r(0, Math.max(0, bs - h)), w, h), x + r(-0.3, 0.3), y + r(-0.3, 0.3), out * r(1, 9), r(-1, 5));
      }
      for (let j = 0; j < 3; j++) P.add(DS.P.DEBRIS, x, y, out * r(1, 10), r(-2, 7), r(1, 2.5), r(0.04, 0.12), { drag: 0.3, col: 0x8f8472 });
      if (k & 1) P.add(DS.P.DUST, x, y, out * r(0.5, 3), r(-0.5, 1), r(5, 10), r(1, 2), { grow: r(0.6, 1.2), drag: 0.9, grav: 0, alpha: 0.38, col: Math.random() < 0.6 ? 0xcbb99c : 0xb8a888 });
    }
    this.addHeap((fromX == null ? 0 : Math.sign(this.x - fromX) * 1.5) + (this.blockLx(ks[0]) || 0), ks.length * 0.75 * 0.75 * 0.2);
  }
  blockLx(k) { return ((k % this.GX) + 0.5) * this.bs / this.ppm - this.w / 2; }
  // a whole bay coming down (failed in place, or crushed in a falling block ch): what is left of its wall is
  // split into irregular shards — a few big slab pieces, more mid-sized chunks, many small ones
  spillCell(W, cl, fromX, ch) {
    const P = W.particles, r = (a, b) => a + Math.random() * (b - a), p = this.ppm, bud = this.budget();
    const left = this.blk ? cl.left / cl.nb : 1;
    const at = (lx, ly) => ch ? (q => ({ x: this.x + q.x, y: this.base + q.y }))(this.toWorld(ch, lx, ly)) : { x: this.x + lx, y: this.base + ly };
    const c0 = at((cl.x0 + cl.x1) / 2, (cl.y0 + cl.y1) / 2), out = fromX == null ? 0 : Math.sign(c0.x - fromX);
    const vx0 = ch ? ch.vx : 0, vy0 = ch ? Math.min(0, ch.vy) * 0.4 : 0;
    if (bud) {
      // split the bay's box at random until each part is down to its drawn target size
      const parts = [], stack = [[cl.sx, cl.sy, cl.sw, cl.sh]];
      const target = () => { const u = Math.random(); return (u < 0.1 ? r(1.5, 2.5) : u < 0.4 ? r(0.6, 1.2) : r(0.25, 0.6)) * p * bud; };
      while (stack.length && parts.length < 60) {
        const b = stack.pop(), t = target();
        if (b[2] <= t && b[3] <= t) { parts.push(b); continue; }
        if (b[2] >= b[3]) { const f = r(0.3, 0.7); stack.push([b[0], b[1], b[2] * f, b[3]], [b[0] + b[2] * f, b[1], b[2] * (1 - f), b[3]]); }
        else { const f = r(0.3, 0.7); stack.push([b[0], b[1], b[2], b[3] * f], [b[0], b[1] + b[3] * f, b[2], b[3] * (1 - f)]); }
      }
      for (const b of parts) {
        const lx = (b[0] + b[2] / 2) / p - this.w / 2, ly = (this.D.h - b[1] - b[3] / 2) / p;
        const q = at(lx, ly), dir = out || Math.sign(lx - (cl.x0 + cl.x1) / 2) || 1, big = b[2] / p > 1.2;
        if (this.holed) { const kb = this.blockAt(lx, ly); if (kb >= 0 && this.holed[kb]) continue; }      // shot away already: nothing there to fall
        this.addShard(W, this.shard(b[0], b[1], b[2], b[3]), q.x, q.y, dir * r(0.3, big ? 3 : 7) + vx0, r(-1, big ? 2 : 5) + vy0);
      }
    }
    // a little concrete, rebar and grit from the debris sheet
    const kinds = ['conc2', 'conc4', 'conc6', 'rebar2', 'rebar3', 'grit1', 'grit2'];
    for (let n = 0; n < Math.round(3 * left); n++) {
      const key = kinds[Math.floor(Math.random() * kinds.length)], I = DS.DEBRIS[key], sz = key.startsWith('grit') ? r(0.5, 0.9) : r(0.3, 0.8), q = at(r(cl.x0, cl.x1), r(cl.y0, cl.y1));
      this.pieces.push({ src: key, x: q.x, y: q.y, vx: (out || (Math.random() < 0.5 ? -1 : 1)) * r(0.5, 7) + vx0, vy: r(-2, 5) + vy0, a: r(-0.5, 0.5), w: r(-5, 5), wd: sz, h: sz * I.h / I.w, big: false, w0: sz * 0.3, rest: 0 });
    }
    const cw = cl.x1 - cl.x0, chh = cl.y1 - cl.y0;
    for (let n = 0; n < Math.round(4 * left) + 2; n++) { const q = at(r(cl.x0, cl.x1), r(cl.y0, cl.y1));
      P.add(DS.P.DUST, q.x, q.y, (out || (Math.random() < 0.5 ? -1 : 1)) * r(1, 5), r(-1, 2), r(7, 14), r(1.8, 3.6), { grow: r(1, 2), drag: 0.9, grav: 0, alpha: 0.42, col: Math.random() < 0.6 ? 0xcbb99c : 0xb8a888 }); }
    for (let n = 0; n < 12; n++) { const q = at(r(cl.x0, cl.x1), r(cl.y0, cl.y1)); P.add(DS.P.DEBRIS, q.x, q.y, r(-8, 8), r(-2, 8), r(1, 2.5), r(0.04, 0.14), { drag: 0.3, col: 0x8f8472 }); }
    this.addHeap(c0.x - this.x + (out || 0) * cw * 0.4, cw * chh * 0.2 * Math.max(0.2, left));
  }
  // a floor of a falling block slamming down: dust jets out sideways along that floor
  floorJets(W, ch, low, speed) {
    const P = W.particles, r = (a, b) => a + Math.random() * (b - a), y = this.base + low.s + 0.5, k = Math.min(1.5, speed / 10);
    for (let n = 0; n < 8 * k; n++) for (const s of [-1, 1]) {
      const x = this.x + (s < 0 ? ch.x0 : ch.x1) + ch.ox;
      P.add(DS.P.DUST, x, y + r(-0.5, 1), s * r(4, 14) * k, r(-0.5, 1.5), r(8, 16), r(1.5, 3.5), { grow: r(0.8, 1.6), drag: 0.6, grav: 0, alpha: 0.45, col: Math.random() < 0.6 ? 0xc9b89b : 0xb3a284 });
    }
  }
  // the collapse reaching the ground: a heavy cloud rolls out both ways along the ground, climbs and hangs
  dustCloud(W, x, k) {
    const P = W.particles, r = (a, b) => a + Math.random() * (b - a), gy = W.terrain.height(x);
    for (let n = 0; n < 8 + 22 * k; n++) {
      const s = Math.random() < 0.5 ? -1 : 1;
      P.add(DS.P.DUST, x + r(-this.w / 2, this.w / 2), gy + r(0.5, 3 + 4 * k), s * r(2, 11) * (0.5 + k), r(0.1, 2.2), r(20, 40), r(3, 6) * (0.6 + k * 0.5),
        { grow: r(0.15, 0.4), drag: r(0.12, 0.3), grav: 0, alpha: r(0.35, 0.55), col: Math.random() < 0.5 ? 0xc8b698 : 0xb7a587 });
    }
    W.fx.shake = Math.max(W.fx.shake, Math.min(0.8, 0.3 * k) * Math.max(0, 1 - Math.abs(x - W.cam.x) / 600));
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
  // The building's face: its drawing with everything that has happened to it painted straight into it — the
  // dark inside showing through knocked-out blocks, soot, and blocks taken off (cleared). All of it is painted
  // 'source-atop' or erased from the drawing itself, so it can never reach past the building's outline. The
  // operations are kept so the face can be rebuilt when the glass breaks (another base image).
  faceImg() {
    const R = this.world.rend; if (!R) return null;
    const im = (this.glass && R.cityBroken[this.k]) || R.cityImg[this.k]; if (!im) return null;
    const key = this.glass ? 'b' : 'a';
    if (!this.face || this.faceKey !== key) {
      const c = this.face || (this.face = document.createElement('canvas')); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0); this.faceKey = key;
      for (const o of this.ops) this.paint(x, o);
      const sk = this.skin || (this.skin = document.createElement('canvas')); sk.width = im.width; sk.height = im.height;
      const y = sk.getContext('2d'); y.drawImage(im, 0, 0); for (const o of this.ops) if (o.t === 'soot' || o.t === 'streak') this.paint(y, o);
      this.faceVer++;
    }
    return this.face;
  }
  op(o) { this.ops.push(o); if (this.face) { this.paint(this.face.getContext('2d'), o); if (o.t === 'soot' || o.t === 'streak') this.paint(this.skin.getContext('2d'), o); this.faceVer++; } }
  soot(lx, ly, r, a) { this.op({ t: 'soot', x: (lx + this.w / 2) * this.ppm, y: this.D.h - ly * this.ppm, r: r * this.ppm, a }); }
  paint(x, o) {
    x.save();
    if (o.t === 'clr') { x.globalCompositeOperation = 'destination-out'; this.fillPolys(x, o.pts); }
    else if (o.t === 'hole') {
      const H = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }, k = o.k, bs = this.bs;
      const cx = (k % this.GX + 0.5) * bs, cy = (((k / this.GX) | 0) + 0.5) * bs;
      x.globalCompositeOperation = 'source-atop'; x.beginPath();
      for (let j = 0; j < 8; j++) { const a = j / 8 * 6.283 + H(k * 3 + j) * 0.5, rr = bs * (0.55 + 0.32 * H(k * 7 + j)); x[j ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      x.closePath(); const v = 20 + Math.floor(H(k) * 14); x.fillStyle = `rgb(${v + 8},${v + 2},${v - 3})`; x.fill();
    } else if (o.t === 'soot') {                          // blackened round a burst: dark at the centre, fading out
      x.globalCompositeOperation = 'source-atop';
      const g = x.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r); g.addColorStop(0, `rgba(14,11,8,${o.a})`); g.addColorStop(0.55, `rgba(20,15,10,${o.a * 0.75})`); g.addColorStop(0.8, `rgba(26,19,12,${o.a * 0.35})`); g.addColorStop(1, 'rgba(30,22,14,0)');
      x.fillStyle = g; x.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
    } else if (o.t === 'streak') {                        // soot carried up the wall by the smoke of a fire
      x.globalCompositeOperation = 'source-atop'; x.translate(o.x, o.y - o.h * 0.45); x.scale(1, o.h / o.w);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, o.w); g.addColorStop(0, `rgba(14,11,8,${o.a})`); g.addColorStop(1, 'rgba(14,11,8,0)');
      x.fillStyle = g; x.fillRect(-o.w, -o.w, o.w * 2, o.w * 2);
    }
    x.restore();
  }
  // a canvas drawn in one flat colour (thermal picture), cached until the canvas changes
  tinted(cv, col, ver) {
    if (cv._tk === col + ver) return cv._t;
    const c = cv._t || (cv._t = document.createElement('canvas')); c.width = cv.width; c.height = cv.height;
    const x = c.getContext('2d'); x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = `rgb(${col})`; x.fillRect(0, 0, c.width, c.height);
    cv._tk = col + ver; return c;
  }
  draw(ctx, cam, grey, R) {
    const D = this.D, k = this.k, im0 = R.cityImg[k]; if (!im0) return;
    if (this.x + this.w + 40 < cam.left || this.x - this.w - 40 > cam.right) return;
    const env = this.world.env || {}, sun = env.sun && env.sun.el > 0 && (env.night || 0) < 0.5 ? env.sun : null, storm = env.visibility ? 1 : 0;
    let im = this.glass && R.cityBroken[k] ? R.cityBroken[k] : im0;
    if (grey != null) im = R.propTinted('city:' + k + (this.glass ? 'b' : ''), 't', grey(0.2), 1);
    else if (storm) im = R.propTinted('city:' + k + (this.glass ? 'b' : ''), 's', '205,176,134', 0.22);
    ctx.imageSmoothingQuality = 'high';
    // (its shadow is cast with the vehicles' into the shared shadow layer: Renderer.shadowExtra below)
    ctx.save(); ctx.translate(this.x, this.base);
    const face = this.touched && this.faceImg();
    if (!face) { ctx.save(); ctx.scale(1, -1); ctx.drawImage(im, -this.w / 2, -this.h, this.w, this.h); if (grey == null) R.relief(ctx, 'city:' + k, im0, -this.w / 2, -this.h, this.w, this.h, 1); ctx.restore(); }
    else {
      const p = this.ppm, col = grey != null ? grey(0.2) : null;
      ctx.save(); ctx.scale(1, -1); ctx.drawImage(col ? this.tinted(face, col, this.faceVer) : face, -this.w / 2, -this.h, this.w, this.h); ctx.restore();
      // falling blocks, each its own canvas
      for (const ch of this.chunks) {
        if (!ch.cv) continue;
        ctx.save(); ctx.translate(ch.ax + ch.ox, ch.ay + ch.oy); ctx.rotate(ch.ang); ctx.translate(-ch.ax, -ch.ay); ctx.scale(1, -1);
        const [bx, by, bw, bh] = ch.box;
        ctx.drawImage(col ? this.tinted(ch.cv, col, 0) : ch.cv, bx / p - this.w / 2, (by - this.D.h) / p, bw / p, bh / p);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  // after the ground: the heap (it is part of the ground now) and the fragments lying on it
  drawFront(ctx, cam, grey, R) {
    if (this.x + this.w + 40 < cam.left || this.x - this.w - 40 > cam.right) return;
    this.drawHeap(ctx, cam, grey, R);
    const DI = R.debImg;
    for (const p of this.pieces) {
      if (p.x < cam.left - 3 || p.x > cam.right + 3) continue;
      const img = p.src === 'shard' ? p.img : DI[p.src]; if (!img) continue;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, -1);
      if (grey != null) { ctx.fillStyle = `rgb(${grey(0.1)})`; ctx.fillRect(-p.wd * 0.35, -p.h * 0.35, p.wd * 0.7, p.h * 0.7); }
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
  // Buildings cast their real silhouette (what is left of them, falling blocks included) into the shadow layer
  // the vehicles use, sheared away from the light the same way; a building's shadow reaches less far toward
  // the viewer (most of it falls on the ground behind the row) so a tower does not black out the road.
  shadowExtra(o, m, q, Lt, cam) {
    if (Lt.fire) return 0;
    let n = 0;
    for (const b of this.w.buildings) {
      if (!b.D || b.state === 'rubble' || b.x + b.w + 60 < cam.left || b.x - b.w - 60 > cam.right) continue;
      const im = (b.touched && b.face) || (b.glass && this.cityBroken[b.k]) || this.cityImg[b.k]; if (!im) continue;
      const cot = Lt.cot != null ? Lt.cot : 1 / Math.tan(Math.max(8, Lt.el) * Math.PI / 180), kx = -Lt.side * Math.min(3.5, cot * 0.55), ky = 0.12, y0 = b.base + 0.1;
      o.setTransform(m.a / q, m.b / q, m.c / q, m.d / q, m.e / q, m.f / q); o.transform(1, 0, kx, -ky, -kx * y0, y0 * (1 + ky));
      o.globalAlpha = Math.max(0, Math.min(1, Lt.k));
      o.save(); o.translate(b.x, b.base); o.scale(1, -1); o.drawImage(im, -b.w / 2, -b.h, b.w, b.h); o.restore();
      for (const ch of b.chunks) if (ch.cv) { const p = b.ppm, [bx, by, bw, bh] = ch.box;
        o.save(); o.translate(b.x + ch.ax + ch.ox, b.base + ch.ay + ch.oy); o.rotate(ch.ang); o.translate(-ch.ax, -ch.ay); o.scale(1, -1); o.drawImage(ch.cv, bx / p - b.w / 2, (by - b.D.h) / p, bw / p, bh / p); o.restore(); }
      n++;
    }
    return n;
  },
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
