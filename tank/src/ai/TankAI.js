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
      if (v === a || v === b || v.team === a.team) continue;
      if (DS.Armor.raycast({ vehicles: [v] }, o.x, o.y, t.x, t.y, null)) return false;
    }
    return true;
  },
  gauss(r) { return (r() + r() + r() + r() - 2) * 1.22; },
};

DS.TankAI = class TankAI {
  constructor(v, world, opt = {}) {
    this.v = v; this.w = world; v.ai = this; this.follow = opt.follow || null; this.offset = opt.offset || 0;
    this.detect = 0; this.alerted = false; this.los = false; this.tick = Math.random() * 0.3;
    this.lay = 0; this.rangeEst = null; this.sol = null; this.solT = 0; this.shots = 0; this.state = '대기';
    this.ammo = v.def.ammo[0];
    v.fc.se = 0;
  }
  target() {                                  // nearest live enemy
    let best = null, bd = 1e9;
    for (const x of this.w.vehicles) { if (x.team === this.v.team || !x.alive) continue; const d = Math.abs(x.pos.x - this.v.pos.x); if (d < bd) { bd = d; best = x; } }
    if (best !== this.tgt) { this.tgt = best; this.detect = 0; this.rangeEst = null; this.sol = null; this.lay = 0; }
    return best;
  }
  // wingman: hold station behind the leader
  station() {
    const v = this.v, L = this.follow;
    if (!L || !v.mobile) return 0;
    const dx = L.pos.x + this.offset * L.dir - v.pos.x;
    return Math.abs(dx) < 6 ? 0 : Math.max(-1, Math.min(1, dx / 25));
  }

  update(dt) {
    const v = this.v, W = this.w, S = v.def.sight, r = W.rng;
    v.input.fire = false;
    if (!v.alive || !v.firepower) { v.input.drive = 0; this.state = v.status; return; }
    const tgt = this.target();
    if (!tgt) { v.input.drive = this.station(); this.state = this.follow ? '대형 유지' : '대기'; return; }
    const range = Math.hypot(tgt.pos.x - v.pos.x, tgt.pos.y - v.pos.y);
    this.tick -= dt;
    if (this.tick <= 0) { this.tick = 0.25; this.los = range < 4000 && DS.AI.los(W, v, tgt); }
    // gunfire is heard across the battlefield
    if (tgt.lastFired && W.time - tgt.lastFired < 0.5 && range < 4000) this.alerted = true;

    if (this.los) {
      const flash = tgt.lastFired && W.time - tgt.lastFired < 5 ? 2 : 1;
      const moving = Math.abs(tgt.vt) > 1.5 ? 1.5 : 1;
      // optical sights: nothing can be identified beyond detectMax (user data: 0 % hits past 2.5 km),
      // easy inside ~700 m, falling off steeply in between
      const dm = S.detectMax || 2500;
      let vis = range >= dm ? 0 : Math.pow(Math.max(0, Math.min(1, (dm - range) / (dm - 700))), 1.5);
      const env = W.env || {};
      if (!S.thermal) {
        vis *= DS.T.ai.detect;                                              // Iraqi crews overall: poor optics and training
        vis *= tgt.def.signature || 1;                                      // smaller / lower targets (Bradley) are harder to pick out
        // sandstorm: visibility falls away fast; a muzzle flash shows only close in
        if (env.visibility) vis *= Math.max(0, Math.exp(-range / (env.visibility * 0.45)) * 1.6 - 0.02);
        // night: passive / IR sights only, ~400 m; beyond that only a muzzle flash gives a fleeting bearing
        if (env.night) vis *= range < 400 ? 0.5 : range < 800 ? 0.08 : (flash > 1 ? 0.05 : 0);
      }
      this.detect = Math.min(1.2, this.detect + dt * vis * flash * moving / 5);
    } else this.detect = Math.max(0, this.detect - dt * 0.08);

    if (this.detect < 1) {
      // no target yet: advance toward the sound of the guns until something is in sight
      if (this.follow) { v.input.drive = this.station(); this.state = '대형 유지'; return; }
      v.input.drive = this.alerted && !this.los && v.mobile ? v.dir : 0;
      this.state = this.alerted ? (this.los ? '탐색' : '전진') : '대기';
      return;
    }
    // seen but beyond the gun's effective range: close in (firing on the move is useless for them)
    if (range > (S.engageMax || 2000)) { v.input.drive = v.mobile ? v.dir : 0; this.state = '접근'; this.lay = 0; return; }
    v.input.drive = 0;                                   // halt to shoot
    if (v.tow) {                                         // Bradley: TOW, guided by keeping the sight on the target
      const o = v.sightOrigin(), q = tgt.local(tgt.g.ring.x, tgt.g.ring.y + 0.35);     // the turret: the same point the line-of-sight check uses
      v.fc.se = 0; v.gun.aimW = Math.atan2(q.y - o.y, q.x - o.x);
      this.lay += dt;
      if (v.tow.missile) this.state = 'TOW 유도';
      else if (v.tow.loaded === 0) this.state = v.tow.reserve ? 'TOW 재장전' : 'TOW 소진';
      else { this.state = 'TOW 조준'; if (this.lay > S.layTime && this.los) { v.input.tow = true; this.lay = 0; this.shots++; } }
      return;
    }
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
      this.jit = DS.AI.gauss(r) * S.aimErr / 1000 * (1 + Math.pow(range / 800, 2));   // lay error grows quickly with range (tools/hitbench.js)
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
    // poorly drilled crews only partly correct from the fall of shot
    if (d < -3) this.rangeEst += Math.min(-d, this.rangeEst * 0.3) * 0.45;        // short
    else if (d > 3) this.rangeEst -= Math.min(d, this.rangeEst * 0.12) * 0.35;    // over
  }
};
