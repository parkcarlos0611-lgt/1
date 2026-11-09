// Point-mass exterior ballistics: gravity + Mach-dependent drag, sub-stepped; each sub-step is a
// segment tested against armour plates (world given) and the terrain.
DS.cdAt = function (tab, M) {
  if (M <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (M <= tab[i][0]) {
    const a = tab[i - 1], b = tab[i], f = (M - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * f;
  }
  return tab[tab.length - 1][1];
};

DS.Projectile = class Projectile {
  constructor(x, y, vx, vy, ammo, owner) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.ammo = ammo; this.owner = owner;
    this.t = 0; this.alive = true; this.x0 = x;
    this.area = Math.PI * ammo.d * ammo.d / 4;
    this.ignore = owner; this.ignoreT = 0;
  }
  // returns {kind:'ground'|'armor', ...} or null
  step(dt, terrain, world) {
    const A = this.ammo, rho = DS.T.rho, g = DS.T.g;
    const sub = Math.max(1, Math.ceil(Math.hypot(this.vx, this.vy) * dt / 2));
    const h = dt / sub;
    for (let k = 0; k < sub; k++) {
      const v = Math.hypot(this.vx, this.vy), M = v / DS.T.sound;
      const kd = 0.5 * rho * DS.cdAt(A.cd, M) * this.area / A.mass;
      const ax = -kd * v * this.vx, ay = -kd * v * this.vy - g;
      const nx = this.x + (this.vx + ax * h * 0.5) * h, ny = this.y + (this.vy + ay * h * 0.5) * h;
      const nvx = this.vx + ax * h, nvy = this.vy + ay * h;
      if (world) {
        if (this.ignoreT > 0) { this.ignoreT -= h; if (this.ignoreT <= 0) this.ignore = this.owner; }
        const hit = DS.Armor.raycast(world, this.x, this.y, nx, ny, this.ignore);
        if (hit) {
          this.x = hit.x; this.y = hit.y; this.vx = nvx; this.vy = nvy; this.t += h * hit.t;
          return { kind: 'armor', hit };
        }
      }
      if (ny < terrain.height(nx)) {
        let a = 0, b = 1;
        for (let it = 0; it < 12; it++) { const m = (a + b) / 2, px = this.x + (nx - this.x) * m, py = this.y + (ny - this.y) * m; if (py < terrain.height(px)) b = m; else a = m; }
        this.x += (nx - this.x) * b; this.y += (ny - this.y) * b; this.vx = nvx; this.vy = nvy;
        this.alive = false;
        return { kind: 'ground', x: this.x, y: terrain.height(this.x), vx: this.vx, vy: this.vy, ammo: A, range: Math.abs(this.x - this.x0), t: this.t };
      }
      this.x = nx; this.y = ny; this.vx = nvx; this.vy = nvy; this.t += h;
    }
    if (this.x < 0 || this.x > terrain.n * terrain.dx || this.t > 90) this.alive = false;
    return null;
  }
};
