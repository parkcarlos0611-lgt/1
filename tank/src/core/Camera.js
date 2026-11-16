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
    if (Math.abs(this.tzoom - this.zoom) < this.tzoom * 0.001) this.zoom = this.tzoom;      // settle exactly (caches key on it)
    const halfW = this.W / 2 / this.zoom;
    // the ground line sits `ground` of the screen height above the bottom edge at every zoom. The part of the
    // height that depends on the zoom is applied exactly every frame and only the vehicle's own rise and fall
    // is smoothed: smoothing the whole height let the ground swing up and down the screen (even off it) each
    // time the view zoomed, and settle back a second later
    const off = this.H / this.zoom * (0.5 - T.ground);
    let base = v.pos.y - 1.5;
    // aircraft: the ground stays at the bottom of the view until the machine climbs past the top third
    if (v.heli) { const a = v.alt(), vh = this.H / this.zoom; base = v.pos.y - a - 1.5 + Math.max(0, a - vh * 0.62); }
    const k = Math.min(1, dt * 3);
    let by = this.y - (this._off != null ? this._off : off);           // (also picks up a height another view set)
    by += (base - by) * Math.min(1, dt * 2.5);
    // sideways the same: the look-ahead is a share of the half-width (smoothed as the speed changes), applied at
    // the current zoom; only the following of the vehicle is smoothed
    const lf = 0.25 + Math.max(-1, Math.min(1, v.vel.x / 12)) * 0.35 * T.lookAhead;
    this._lf = this._lf == null ? lf : this._lf + (lf - this._lf) * k;
    let bx = this.x - (this._lead != null ? this._lead : halfW * this._lf);
    bx += (v.pos.x - bx) * k;
    const lead = halfW * this._lf;
    this.x = bx + lead; this._lead = lead; this.y = by + off; this._off = off;
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
