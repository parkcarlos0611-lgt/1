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
    if (world.buildings && world.buildings.length && DS.Building.ray(world, o.x, o.y, t.x, t.y)) return false;      // a building stands in the way
    for (const v of world.vehicles) {
      if (v === a || v === b || v.team === a.team) continue;
      if (DS.Armor.raycast({ vehicles: [v] }, o.x, o.y, t.x, t.y, null)) return false;
    }
    return true;
  },
  // how much of the line from a to b passes through burning wrecks' smoke plumes (0 clear … 1 solid).
  // A plume rises from the fire and leans downwind; it is modelled as a slanted band a few metres wide.
  smoke(world, a, b) {
    const o = a.sightOrigin(), t = b.local(b.g.ring.x, b.g.ring.y + 0.4);
    let ob = 0;
    for (const v of world.vehicles) {
      if (!(v.burning > 1) || v === a || v === b) continue;
      const f = v.fireSource(), lean = world.wind * 0.6;
      const x0 = Math.min(o.x, t.x), x1 = Math.max(o.x, t.x);
      for (let hgt = 1; hgt < 40; hgt += 3) {                       // plume centre at each height
        const px = f.x + lean * hgt * 0.5, py = f.y + hgt;
        if (px < x0 || px > x1) continue;
        const ly = o.y + (t.y - o.y) * (px - o.x) / ((t.x - o.x) || 1e-6);
        const half = 1.5 + hgt * 0.15;
        if (Math.abs(ly - py) < half) { ob += Math.min(1, v.burning / 6) * 0.8 * (1 - hgt / 50); break; }
      }
    }
    return Math.min(1, ob);
  },
  gauss(r) { return (r() + r() + r() + r() - 2) * 1.22; },
  // gunnery skill of a vehicle's crew (Iraqi crews: DS.T.ai.skill; others as their sights allow)
  skill(v) { return v.team === 'IQ' || (v.def.side === 'IQ' && v.team !== 'US') ? DS.T.ai.skill : { aim: 1, range: 1, lay: 0, correct: 1 }; },
};

DS.TankAI = class TankAI {
  constructor(v, world, opt = {}) {
    this.v = v; this.w = world; v.ai = this; this.follow = opt.follow || null; this.offset = opt.offset || 0;
    this.mode = opt.mode || 'combat'; this.patrol = opt.patrol || null;       // sandbox behaviours: watch / hold / combat / patrol
    this.detect = 0; this.alerted = false; this.los = false; this.tick = Math.random() * 0.3;
    this.lay = 0; this.rangeEst = null; this.sol = null; this.solT = 0; this.shots = 0; this.state = '대기';
    this.ammo = v.def.ammo[0];
    v.fc.se = 0;
  }
  // nearest enemy this crew has actually found (src/ai/Sensor.js); keeps the current one while it is in sight
  target() {
    const seen = DS.Sensor.list(this.v, true).filter(e => !e.heli);       // the main gun is not used on aircraft
    let best = this.tgt && seen.includes(this.tgt) ? this.tgt : seen[0] || null;
    if (best !== this.tgt) { this.tgt = best; this.rangeEst = null; this.sol = null; this.lay = 0; }
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
    const v = this.v;
    DS.Searchlight.ai(v, this.w);
    this.aa(dt);
    if (this.mode === 'patrol') return this.shuttle();
    this.think(dt);
    if (this.mode === 'hold' || this.mode === 'watch') v.input.drive = 0;                 // stays where it was put
    if (this.mode === 'watch') { v.input.fire = false; v.input.tow = false; if (this.state === '사격') this.state = '조준'; }
  }
  // anti-aircraft machine gun (DShK / M2): the commander engages a helicopter in sight within 1.8 km in bursts,
  // leading it by its speed and holding over for the bullet drop
  aa(dt) {
    const v = this.v, W = this.w, I = v.input;
    I.mgFire = false;
    if (!v.mg || !v.alive || this.mode === 'watch' || v.mg.rounds <= 0) { I.mgAim = null; return; }
    let best = null, bd = 1800;
    for (const e of W.vehicles) if (e.heli && e.alive && e.team !== v.team && DS.Sensor.seenNow(v, e)) { const d = Math.hypot(e.pos.x - v.pos.x, e.pos.y - v.pos.y); if (d < bd) { bd = d; best = e; } }
    if (!best) { I.mgAim = null; this.aaT = 0; return; }
    const tof = bd / 760, S = v.def.sight, j = (S.aimErr || 3) * 0.004 * bd;
    this.aaT = (this.aaT || 0) + dt;
    if (!this.aaJ || this.aaT % 2 < dt) this.aaJ = [DS.AI.gauss(W.rng) * j, DS.AI.gauss(W.rng) * j * 0.6];
    I.mgAim = { x: best.pos.x + best.vel.x * tof + this.aaJ[0], y: best.pos.y + best.vel.y * tof + 0.5 * DS.T.g * tof * tof + this.aaJ[1] };
    I.mgFire = this.aaT > 1.5 && this.aaT % 2 < 1.2;                 // lays on for a moment, then 1.2 s bursts
  }
  // moving target: runs back and forth between two points at a set speed, never fires
  shuttle() {
    const v = this.v, P = this.patrol;
    v.input.fire = false;
    if (!v.alive || !v.mobile) { v.input.drive = 0; this.state = v.status; return; }
    if (P.to == null) P.to = v.dir > 0 ? P.b : P.a;            // sets off forward; the leg back is in reverse gear (slower)
    if (Math.abs(P.to - v.pos.x) < 4) P.to = P.to === P.b ? P.a : P.b;
    const want = Math.sign(P.to - v.pos.x) * P.speed, err = want - v.vel.x;
    v.input.drive = Math.max(-1, Math.min(1, err / 2));
    this.state = '왕복 주행';
  }
  think(dt) {
    const v = this.v, W = this.w, S = v.def.sight, r = W.rng;
    v.input.fire = false;
    if (!v.alive || !v.firepower) { v.input.drive = 0; this.state = v.status; return; }
    // gunfire is heard across the battlefield
    for (const e of W.vehicles) if (e.team !== v.team && e.lastFired && W.time - e.lastFired < 0.5 && Math.abs(e.pos.x - v.pos.x) < 4000) this.alerted = true;
    const tgt = this.target();
    this.los = !!tgt;
    if (!tgt) {
      // nothing found yet: a wingman keeps station; others advance toward the sound of the guns
      if (this.follow) { v.input.drive = this.station(); this.state = '대형 유지'; return; }
      const mem = DS.Sensor.list(v, false)[0];
      v.input.drive = (this.alerted || mem) && v.mobile ? v.dir : 0;
      this.state = mem ? '탐색' : this.alerted ? '전진' : '대기';
      return;
    }
    const range = Math.hypot(tgt.pos.x - v.pos.x, tgt.pos.y - v.pos.y);
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
    const K = DS.AI.skill(v);
    if (!this.rangeEst) this.rangeEst = range * (1 + DS.AI.gauss(r) * S.rangeErr * K.range);
    // re-solve the lay a few times a second (target and own hull move)
    this.solT -= dt;
    if (this.solT <= 0 || this.sol == null) {
      this.solT = 0.3;
      const o = v.sightOrigin(), t = tgt.local(tgt.g.ring.x, tgt.g.ring.y + 0.1), d = Math.hypot(t.x - o.x, t.y - o.y);
      const px = o.x + (t.x - o.x) / d * this.rangeEst, py = o.y + (t.y - o.y) / d * this.rangeEst;
      if (v.gun.ammo !== this.ammo) v.gun.ammo = this.ammo;
      this.sol = DS.FireControl.solve(v, this.ammo, px, py);
      this.jit = DS.AI.gauss(r) * S.aimErr * K.aim / 1000 * (1 + Math.pow(range / 800, 2)) * (v.vt && Math.abs(v.vt) > 1 ? 1.3 : 1);   // lay error grows quickly with range (tools/hitbench.js); a little worse on the move (the stabiliser's leak comes on top)
    }
    v.fc.se = 0;
    // the hull's rocking the stabiliser lets through throws the lay off; the gunner works it back at about
    // 15 mrad/s (Iraqi crews: 10)
    const gs = v.gun, back = (K.aim > 1 ? 0.010 : 0.015) * dt;
    gs.drift = Math.sign(gs.drift || 0) * Math.max(0, Math.abs(gs.drift || 0) - back);
    v.gun.aimW = this.sol + this.jit + gs.drift;
    this.lay += dt;
    const err = Math.abs(Math.atan2(Math.sin(v.gunWorld() - v.gun.aimW), Math.cos(v.gunWorld() - v.gun.aimW)));
    const need = this.shots ? S.layTime * 0.6 + K.lay * 0.5 : S.layTime + K.lay;
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
    const c = DS.AI.skill(this.v).correct;
    if (d < -3) this.rangeEst += Math.min(-d, this.rangeEst * 0.3) * 0.45 * c;        // short
    else if (d > 3) this.rangeEst -= Math.min(d, this.rangeEst * 0.12) * 0.35 * c;    // over
  }
};
