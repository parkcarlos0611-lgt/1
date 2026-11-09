// Point-mass exterior ballistics: gravity + Mach-dependent drag, sub-stepped, segment vs terrain.
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
    this.t = 0; this.alive = true; this.x0 = x; this.trail = [x, y];
    this.area = Math.PI * ammo.d * ammo.d / 4;
  }
  // returns hit info or null
  step(dt, terrain) {
    const A = this.ammo, rho = DS.T.rho, g = DS.T.g;
    const sub = Math.max(1, Math.ceil(Math.hypot(this.vx, this.vy) * dt / 2));
    const h = dt / sub;
    for (let k = 0; k < sub; k++) {
      const v = Math.hypot(this.vx, this.vy), M = v / DS.T.sound;
      const kd = 0.5 * rho * DS.cdAt(A.cd, M) * this.area / A.mass;
      const ax = -kd * v * this.vx, ay = -kd * v * this.vy - g;
      const nx = this.x + (this.vx + ax * h * 0.5) * h, ny = this.y + (this.vy + ay * h * 0.5) * h;
      this.vx += ax * h; this.vy += ay * h;
      if (ny < terrain.height(nx)) {
        // bisect for the surface crossing
        let a = 0, b = 1;
        for (let it = 0; it < 12; it++) { const m = (a + b) / 2, px = this.x + (nx - this.x) * m, py = this.y + (ny - this.y) * m; if (py < terrain.height(px)) b = m; else a = m; }
        this.x += (nx - this.x) * b; this.y += (ny - this.y) * b;
        this.alive = false;
        return { x: this.x, y: terrain.height(this.x), vx: this.vx, vy: this.vy, ammo: A, range: Math.abs(this.x - this.x0), t: this.t };
      }
      this.x = nx; this.y = ny; this.t += h;
    }
    if (this.x < 0 || this.x > terrain.n * terrain.dx || this.t > 90) this.alive = false;
    return null;
  }
};
