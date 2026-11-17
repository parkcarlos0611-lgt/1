// Iraqi 2S1 battery: the guns stand on the map (seen, and destroyed, like any vehicle) and fire on what the
// Iraqi crews up front report. A crew that has an enemy in sight calls it in; 30–90 s later (the report goes
// up the chain, the guns are laid) the battery fires a salvo. The first salvo is laid on a rough map position
// and falls wide; each one after it is corrected from what the spotter sees and lands closer, while the
// spotter still has the target. A gun that sees an enemy close by turns to direct fire (src/ai/TankAI.js).
DS.ArtyAI = class ArtyAI {
  constructor(v, world) {
    this.v = v; this.w = world; v.ai = this; this.state = '대기';
    this.direct = new DS.TankAI(v, world, { mode: 'hold' }); v.ai = this;       // close defence: the ordinary tank crew
    const B = world._battery || (world._battery = { guns: [], phase: 'idle', t: 0, salvo: 0, off: 0, tgt: null, spot: null });
    B.guns.push(this); this.B = B; this.laid = false; this.fired = 0;
  }
  // a gun's own low-angle solution (flat ground at the target's height): smallest charge that reaches, then
  // the elevation by bisection
  solve(D, ty) {
    const v = this.v, A = DS.AMMO[v.gun.ammo], G = v.def.gun, C = G.charges, d2r = Math.PI / 180;
    const tp = v.local(v.g.trunnion.x, v.g.trunnion.y), flat = { height: () => -1e9, n: 1e9, dx: 1 };
    const shot = (el, v0) => {
      const p = new DS.Projectile(tp.x, tp.y, Math.cos(el) * v0, Math.sin(el) * v0, A, null); let px = p.x, py = p.y;
      while (p.t < 160) { px = p.x; py = p.y; p.step(1 / 20, flat); if (p.vy < 0 && p.y <= ty) break; }
      const f = (py - ty) / ((py - p.y) || 1e-9); return px + (p.x - px) * f - tp.x;
    };
    let c = 0;
    for (; c < C.length - 1; c++) if (shot(43 * d2r, C[c].v0) >= D * 1.04) break;
    let lo = Math.max(1, G.elevMin) * d2r, hi = 43 * d2r;
    if (shot(hi, C[c].v0) < D) return null;                     // out of range
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (shot(m, C[c].v0) < D) lo = m; else hi = m; }
    return { charge: c, el: (lo + hi) / 2 };
  }
  // the battery's fire-mission cycle (run by its first living gun)
  battery(dt) {
    const B = this.B, W = this.w, r = W.rng;
    const guns = B.guns.filter(g => g.v.alive && g.v.firepower);
    if (guns[0] !== this) return;
    // who has something in sight? (the forward crews, not the battery itself)
    const spotters = W.vehicles.filter(s => s.alive && s.team === this.v.team && s.ai && !(s.ai instanceof DS.ArtyAI));
    let spot = null, tgt = null;
    if (B.spot && B.spot.alive && B.tgt && B.tgt.alive && DS.Sensor.seenNow(B.spot, B.tgt)) { spot = B.spot; tgt = B.tgt; }
    else for (const s of spotters) { const e = DS.Sensor.list(s, true).find(e => !e.heli && e.alive); if (e) { spot = s; tgt = e; break; } }
    if (B.phase === 'idle') {
      if (!tgt) return;
      B.spot = spot; B.tgt = tgt; B.phase = 'call'; B.t = 30 + r() * 60;                 // the report goes up; the guns are laid
      B.off = (r() < 0.5 ? -1 : 1) * (150 + r() * 250); B.salvo = 0;
      return;
    }
    if (tgt && tgt !== B.tgt) { if (Math.abs(tgt.pos.x - B.tgt.pos.x) > 300) B.off = (r() < 0.5 ? -1 : 1) * (150 + r() * 250); B.tgt = tgt; B.spot = spot; }
    B.t -= dt;
    if (B.phase === 'call' || B.phase === 'reload') {
      if (B.t > 0) return;
      if (!B.tgt || !B.tgt.alive) { B.phase = 'idle'; B.tgt = null; return; }
      // aim point: the reported position plus the battery's error; corrected after each salvo the spotter sees
      // (the spotter corrects while it still has the target, in sight or just lost in the dust of the bursts)
      const watch = B.spot && B.spot.alive && DS.Sensor.list(B.spot, false).includes(B.tgt);
      if (B.salvo > 0) B.off = watch ? B.off * (0.35 + r() * 0.3) + DS.AI.gauss(r) * 20 : B.off * 0.9;
      const ax = B.tgt.pos.x + B.off;
      for (const g of guns) { g.aim = ax + DS.AI.gauss(r) * 12; g.laid = false; g.sol = null; g.fired = 0; }
      B.phase = 'lay'; B.t = 25;
      return;
    }
    if (B.phase === 'lay') {
      if (guns.every(g => g.fired) || B.t <= 0) {
        B.salvo++;
        if (B.salvo >= 6 || !B.tgt.alive) { B.phase = 'call'; B.t = 40 + r() * 50; B.salvo = 0; B.tgt = tgt; B.spot = spot; if (!tgt) B.phase = 'idle'; }
        else { B.phase = 'reload'; B.t = Math.max(...guns.map(g => g.v.gun.reload)) + 2 + r() * 3; }
      }
    }
  }
  update(dt) {
    const v = this.v, I = v.input, B = this.B;
    I.fire = false; I.drive = 0;
    if (!v.alive || !v.firepower) { this.state = v.status; return; }
    // an enemy close in sight: direct fire with the direct charge
    const near = DS.Sensor.list(v, true).find(e => !e.heli && Math.abs(e.pos.x - v.pos.x) < 1500);
    if (near) {
      v.indirectLock = false; v.gun.charge = v.def.gun.directCharge; this.direct.update(dt); I.drive = 0;
      this.state = '직사 ' + this.direct.state; this.mode = 'direct'; return;
    }
    this.mode = 'indirect';
    this.battery(dt);
    if (B.phase !== 'lay' || this.fired || this.aim == null) { this.state = B.phase === 'call' ? '사격 요청 접수' : B.phase === 'reload' ? '재장전 · 수정' : B.phase === 'lay' ? '사격 완료' : '대기'; return; }
    if (!this.sol) {
      const ty = this.w.terrain.height(this.aim), D = Math.abs(this.aim - v.pos.x);
      this.sol = this.solve(D, ty) || { none: true };
      if (!this.sol.none) this.sol.el += DS.AI.gauss(this.w.rng) * 0.0008;               // the laying itself is a little off
    }
    if (this.sol.none) { this.state = '사거리 밖'; this.fired = 1; return; }
    const s = Math.sign(this.aim - v.pos.x) || v.dir;
    if (s !== v.dir) { this.state = '방열 불가 (후방)'; this.fired = 1; return; }
    v.fc.se = 0; v.gun.charge = this.sol.charge; v.indirectLock = true;
    v.gun.aimW = s > 0 ? this.sol.el : Math.PI - this.sol.el;
    const err = Math.abs(Math.atan2(Math.sin(v.gunWorld() - v.gun.aimW), Math.cos(v.gunWorld() - v.gun.aimW)));
    this.state = `방열 · 장약 ${v.def.gun.charges[this.sol.charge].n}`;
    if (err < 0.002 && v.gun.reload <= 0 && v.gun.rx === 0) { I.fire = true; this.fired = 1; this.state = `사격 (${B.salvo + 1}번째 일제사)`; }
  }
  observe(end) { if (this.mode === 'direct') this.direct.observe(end); }
  get busy() { return this.B.phase === 'lay' && !this.fired; }
  get tgt() { return this.mode === 'direct' ? this.direct.tgt : null; }
};
