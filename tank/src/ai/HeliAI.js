// Attack-helicopter crew (AH-1W / AH-64A when not flown by the player): flies overwatch behind the tank
// platoon it is given, at a set height, nose toward the enemy, and engages enemy armour it can see —
// Hellfires (locked on, top attack) at long range, rocket ripples and the gun closer in. It does not go
// forward of the tanks; it slides back when enemies close inside 1.5 km.
//   opt: { lead: vehicle to keep station on (falls back to the nearest friendly ground vehicle), back: metres
//          behind it (default 600), alt: hover height (default 40 m), face: +1 / -1 direction of the enemy }
DS.HeliAI = class HeliAI {
  constructor(v, world, opt = {}) {
    this.v = v; this.w = world; v.ai = this; this.opt = opt; this.state = '엄호 대기'; this.tgt = null; this.hfT = 2 + Math.random() * 3; this.rk = 0;
    v.rpm = 1; v.hoverAlt = opt.alt || 40; v.parked = false;
  }
  lead() {
    const v = this.v, L = this.opt.lead;
    if (L && L.alive) return L;
    let best = null, bd = 1e9; for (const e of this.w.vehicles) if (e !== v && !e.heli && e.alive && e.team === v.team) { const d = Math.abs(e.pos.x - v.pos.x); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  update(dt) {
    const v = this.v, W = this.w, I = v.input, face = this.opt.face || 1;
    I.fire = false; I.coaxFire = false;
    if (!v.alive) { I.drive = 0; I.climb = 0; this.state = v.status; return; }
    // the enemy armour this crew has found (ground vehicles only), nearest first
    const seen = DS.Sensor.list(v, true).filter(e => !e.heli && e.alive);
    const tgt = this.tgt && seen.includes(this.tgt) ? this.tgt : seen[0] || null; this.tgt = tgt;
    const d = tgt ? Math.hypot(tgt.pos.x - v.pos.x, tgt.pos.y - v.pos.y) : 1e9;
    // station: behind the lead (behind = away from the enemy), farther back when they come close
    const L = this.lead(), back = (this.opt.back || 600) + (d < 800 ? 500 : 0);       // pulls back only from enemies very close
    const ML = W.terrain.length || 1e9, tx = Math.max(60, Math.min(ML - 60, L ? L.pos.x - face * back : v.pos.x)), dx = tx - v.pos.x;     // never past the map's ends
    // it keeps its nose to the enemy and slides back and forth to its station (backing up slowly)
    I.drive = Math.abs(dx) < 50 ? 0 : Math.max(-0.4, Math.min(0.7, dx / 300 * face)) * face;
    if (v.dir !== face && v.turnT <= 0) v.turn();
    I.climb = 0; v.hoverAlt = this.opt.alt || 40;
    if (!tgt) { this.state = '엄호 대기'; I.aim = null; v.lock = null; return; }
    // engage, only with the nose on it
    I.aim = { x: tgt.pos.x, y: tgt.pos.y + 1.2 };
    if ((tgt.pos.x - v.pos.x) * v.dir <= 0 || v.turnT > 0) { this.state = '선회'; return; }
    v.lock = tgt;
    this.hfT -= dt;
    if (d < 7500 && v.hf > 0 && this.hfT <= 0 && !(v.hfState && v.hfState.missile)) { I.hf = true; this.hfT = 7 + Math.random() * 4; this.state = '헬파이어'; return; }
    if (d < 3000 && v.rk > 0) { this.rk += dt; I.coaxFire = this.rk % 6 < 0.8; this.state = '로켓'; }
    if (d < 1800 && v.cannon > 0) { I.fire = (W.time % 3) < 1; this.state = '기관포'; }
    if (this.state === '엄호 대기' || this.state === '선회') this.state = '교전';
  }
};
