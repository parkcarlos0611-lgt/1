// Wire-guided missile (TOW): the launch motor throws it clear, the flight motor takes it to ~300 m/s, then it
// coasts. While the wire holds (launcher alive, within range) it steers onto the gunner's sight line —
// keep the cross-hair on the target until impact. With the wire gone it flies on ballistically.
DS.Missile = class Missile {
  constructor(x, y, ang, owner, ammo) {
    this.x = x; this.y = y; this.ang = ang; this.owner = owner; this.ammo = ammo;
    this.speed = 65; this.t = 0; this.alive = true; this.x0 = x; this.y0 = y; this.guided = true;
    this.vx = Math.cos(ang) * this.speed; this.vy = Math.sin(ang) * this.speed; this.wob = Math.random() * 6;
  }
  step(dt, world) {
    const o = this.owner, T = o.def.tow, terrain = world.terrain;
    this.t += dt;
    const M = this.ammo.missile;                  // (a slow first-generation missile carries its own speeds)
    this.speed = M ? Math.min(M.vmax, this.speed + M.accel * dt) - (this.t > 4 ? Math.min(M.vmax - M.vmin, (this.t - 4) * 2) : 0)
      : this.t < 1.6 ? Math.min(300, this.speed + 150 * dt) : Math.max(110, this.speed - 6 * dt);
    const flown = Math.hypot(this.x - this.x0, this.y - this.y0);
    this.guided = this.guided && o.alive && o.firepower && !o.turretGone && flown < T.range;
    if (this.guided) {
      const s = o.sightOrigin(), a = o.gun.aimW, dx = Math.cos(a), dy = Math.sin(a);
      const along = (this.x - s.x) * dx + (this.y - s.y) * dy, lead = Math.max(25, this.speed * 0.35);
      const ax = s.x + dx * (along + lead), ay = s.y + dy * (along + lead) + 0.15 + Math.sin(this.t * 5 + this.wob) * 0.1;   // rides just above the sight line (clears crests), slight corkscrew
      let d = Math.atan2(ay - this.y, ax - this.x) - this.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
      const mx = 0.9 * dt; this.ang += Math.max(-mx, Math.min(mx, d));
      this.vx = Math.cos(this.ang) * this.speed; this.vy = Math.sin(this.ang) * this.speed;
    } else {
      this.vy -= DS.T.g * dt; this.ang = Math.atan2(this.vy, this.vx);
    }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    const hit = DS.Armor.raycast(world, this.x, this.y, nx, ny, o, o.team);
    if (hit) { this.x = hit.x; this.y = hit.y; this.alive = false; return { kind: 'armor', hit }; }
    if (ny < terrain.height(nx)) {
      this.x = nx; this.y = terrain.height(nx); this.alive = false;
      return { kind: 'ground', x: this.x, y: this.y, vx: this.vx, vy: this.vy, ammo: this.ammo, range: flown, t: this.t };
    }
    this.x = nx; this.y = ny;
    if (this.t > 26 || nx < 0 || nx > terrain.n * terrain.dx) this.alive = false;
    return null;
  }
};
