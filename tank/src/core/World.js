// World: owns terrain, vehicles, projectiles, particles, fx; fixed-step simulation.
DS.World = class World {
  constructor() {
    this.terrain = new DS.Terrain(7);
    this.cam = new DS.Camera();
    this.particles = new DS.Particles(DS.T.particles.max);
    this.fx = new DS.Effects(this);
    this.vehicles = []; this.projectiles = []; this.hits = [];
    this.wind = 2.5; this.time = 0; this.acc = 0; this.debug = false;
  }
  spawnProjectile(x, y, vx, vy, ammo, owner) { this.projectiles.push(new DS.Projectile(x, y, vx, vy, ammo, owner)); }

  update(frameDt) {
    const h = 1 / DS.T.physicsHz;
    this.acc = Math.min(this.acc + frameDt, h * DS.T.maxSubsteps);
    while (this.acc >= h) {
      for (const v of this.vehicles) v.step(h, this);
      for (const p of this.projectiles) {
        const hit = p.step(h, this.terrain);
        if (hit) { this.fx.impact(hit); this.hits.push(hit); if (this.hits.length > 20) this.hits.shift(); }
      }
      this.projectiles = this.projectiles.filter(p => p.alive);
      this.acc -= h; this.time += h;
    }
    this.terrain.relax(undefined, undefined, 1);
    for (const v of this.vehicles) this.fx.vehicle(v, frameDt);
    this.particles.update(frameDt, this.terrain, this.wind);
    this.fx.update(frameDt);
    if (this.vehicles[0]) this.cam.follow(this.vehicles[0], frameDt);
    const sh = this.fx.shake; this.cam.sx = (Math.random() - 0.5) * sh * 0.25; this.cam.sy = (Math.random() - 0.5) * sh * 0.25;
  }
};
