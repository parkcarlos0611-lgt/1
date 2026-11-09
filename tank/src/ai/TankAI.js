// Enemy tank crew: detect → estimate range → lay → fire → watch the fall of shot → correct.
// Detection needs line of sight (terrain and hulls block it); it builds faster at short range, against a
// moving target and right after the target fires (flash and dust). A crew that hears gunfire but has no
// line of sight advances until it does. Range error and aim error come from the vehicle's sight data.
DS.AI = {
  // line of sight from a's sight to b's turret
  los(world, a, b) {
    const o = a.sightOrigin(), t = b.local(b.g.ring.x, b.g.ring.y + 0.4), T = world.terrain;
    const dx = t.x - o.x, dy = t.y - o.y, L = Math.hypot(dx, dy), n = Math.ceil(L / 3);
    for (let i = 1; i < n; i++) { const f = i / n; if (o.y + dy * f < T.height(o.x + dx * f)) return false; }
    for (const v of world.vehicles) {
      if (v === a || v === b) continue;
      if (DS.Armor.raycast({ vehicles: [v] }, o.x, o.y, t.x, t.y, null)) return false;
    }
    return true;
  },
  gauss(r) { return (r() + r() + r() + r() - 2) * 1.22; },
};

DS.TankAI = class TankAI {
  constructor(v, world) {
    this.v = v; this.w = world; v.ai = this;
    this.detect = 0; this.alerted = false; this.los = false; this.tick = Math.random() * 0.3;
    this.lay = 0; this.rangeEst = null; this.sol = null; this.solT = 0; this.shots = 0; this.state = '대기';
    this.ammo = v.def.ammo[0];
    v.fc.se = 0;
  }
  target() { return this.w.vehicles.find(x => x.team !== this.v.team && x.alive); }

  update(dt) {
    const v = this.v, W = this.w, S = v.def.sight, r = W.rng;
    v.input.fire = false;
    if (!v.alive || !v.firepower) { v.input.drive = 0; this.state = v.status; return; }
    const tgt = this.target();
    if (!tgt) { v.input.drive = 0; this.state = '대기'; return; }
    const range = Math.hypot(tgt.pos.x - v.pos.x, tgt.pos.y - v.pos.y);
    this.tick -= dt;
    if (this.tick <= 0) { this.tick = 0.25; this.los = range < 4000 && DS.AI.los(W, v, tgt); }
    // gunfire is heard across the battlefield
    if (tgt.lastFired && W.time - tgt.lastFired < 0.5 && range < 4000) this.alerted = true;

    if (this.los) {
      const flash = tgt.lastFired && W.time - tgt.lastFired < 5 ? 3 : 1;
      const moving = Math.abs(tgt.vt) > 1.5 ? 1.5 : 1;
      let vis = Math.max(0.12, Math.min(1, 1.5 - range / 2200));
      const env = W.env || {};
      if (env.visibility) vis *= Math.max(0.03, Math.exp(-range / env.visibility) * 2.2);   // no thermal: dust blinds them
      if (env.night && range > 800) vis *= flash > 1 ? 0.6 : 0.02;                         // IR sights reach ~800 m
      this.detect = Math.min(1.2, this.detect + dt * vis * flash * moving / 3.5);
    } else this.detect = Math.max(0, this.detect - dt * 0.05);

    if (this.detect < 1) {
      // no target yet: advance toward the sound of the guns until something is in sight
      v.input.drive = this.alerted && !this.los && v.mobile ? v.dir : 0;
      this.state = this.alerted ? (this.los ? '탐색' : '전진') : '대기';
      return;
    }
    v.input.drive = 0;                                   // halt to shoot
    this.state = '조준';
    if (!this.rangeEst) this.rangeEst = range * (1 + DS.AI.gauss(r) * S.rangeErr);
    // re-solve the lay a few times a second (target and own hull move)
    this.solT -= dt;
    if (this.solT <= 0 || this.sol == null) {
      this.solT = 0.3;
      const o = v.sightOrigin(), t = tgt.local(tgt.g.ring.x, tgt.g.ring.y + 0.1), d = Math.hypot(t.x - o.x, t.y - o.y);
      const px = o.x + (t.x - o.x) / d * this.rangeEst, py = o.y + (t.y - o.y) / d * this.rangeEst;
      if (v.gun.ammo !== this.ammo) v.gun.ammo = this.ammo;
      this.sol = DS.FireControl.solve(v, this.ammo, px, py);
      this.jit = DS.AI.gauss(r) * S.aimErr / 1000;
    }
    v.fc.se = 0;
    v.gun.aimW = this.sol + this.jit;
    this.lay += dt;
    const err = Math.abs(Math.atan2(Math.sin(v.gunWorld() - v.gun.aimW), Math.cos(v.gunWorld() - v.gun.aimW)));
    const need = this.shots ? S.layTime * 0.6 : S.layTime;
    if (this.lay > need && v.gun.reload <= 0 && v.gun.rx === 0 && err < 0.0015) {
      v.input.fire = true; this.lay = 0; this.shots++; this.state = '사격';
      this.tgtX = tgt.pos.x; this.sol = null;
    }
  }

  // fall of shot: short → add range, over → take some off (the crew sees tracer and dust)
  observe(end) {
    if (end.hitVehicle && end.hitVehicle.team !== this.v.team) return;          // on target: keep the lay
    if (!this.rangeEst || end.x == null) return;
    const toward = Math.sign(this.tgtX - this.v.pos.x), d = (end.x - this.tgtX) * toward;
    if (d < -3) this.rangeEst += Math.min(-d, this.rangeEst * 0.3) * 0.85;        // short
    else if (d > 3) this.rangeEst -= Math.min(d, this.rangeEst * 0.12) * 0.6;     // over
  }
};
