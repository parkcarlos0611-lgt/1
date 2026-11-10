// World camera: metres → screen. y up in the world.
DS.Camera = class Camera {
  constructor() { this.x = 0; this.y = 0; this.zoom = 40; this.tzoom = 40; this.W = 1; this.H = 1; this.dpr = 1; this.sx = 0; this.sy = 0; }
  resize(W, H, dpr) { this.W = W; this.H = H; this.dpr = dpr; }
  apply(ctx) {
    const z = this.zoom * this.dpr;
    ctx.setTransform(z, 0, 0, -z, this.W * this.dpr / 2 - (this.x + this.sx) * z, this.H * this.dpr / 2 + (this.y + this.sy) * z);
  }
  follow(v, dt) {
    const T = DS.T.camera;
    this.zoom += (this.tzoom - this.zoom) * Math.min(1, dt * 6);
    const halfW = this.W / 2 / this.zoom;
    const lead = Math.max(-1, Math.min(1, v.vel.x / 12)) * halfW * 0.35 * T.lookAhead + halfW * 0.25;
    const tx = v.pos.x + lead;
    const ty = v.pos.y + this.H / this.zoom * DS.T.camera.ground + 1.0;
    const k = Math.min(1, dt * 3);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * Math.min(1, dt * 2.5);
  }
  visible(x, y, r = 0) {
    const hw = this.W / 2 / this.zoom + r, hh = this.H / 2 / this.zoom + r;
    return Math.abs(x - this.x) < hw && Math.abs(y - this.y) < hh;
  }
  toWorld(px, py) { return { x: this.x + (px - this.W / 2) / this.zoom, y: this.y - (py - this.H / 2) / this.zoom }; }
  get left() { return this.x - this.W / 2 / this.zoom; }
  get right() { return this.x + this.W / 2 / this.zoom; }
  get bottom() { return this.y - this.H / 2 / this.zoom; }
  get top() { return this.y + this.H / 2 / this.zoom; }
};
