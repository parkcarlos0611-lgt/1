// Searchlights over the main gun, laid with it: M60A1 AN/VSS-1 xenon (white light or infrared), T-55 / T-62
// L-2 "Luna" and T-72 L-4 (infrared). v.light: 0 off, 1 infrared, 2 white (AN/VSS-1 only).
//   - an active infrared night sight (the Iraqi tanks') sees properly only what its own infrared lamp lights:
//     about 1 km down the beam instead of 300–800 m; white light lets any optical sight see as far
//   - the lamp gives the vehicle away: an infrared beam is plain to anyone with a night device (image
//     intensifier, thermal, active infrared) out to about 3.5 km, a white one to everyone
//   - drawn: white beams in the main view at night; every beam (infrared too) in a night-vision sight
// Iraqi crews keep the lamp on at night while they search and fire; the Marines' M60A1s run dark (passive
// sights) unless the player switches it on. Y (or the 탐조등 button) steps off → IR → white → off.
DS.Searchlight = {
  KIT: { m60a1: { name: 'AN/VSS-1', white: true }, t55: { name: 'L-2' }, t62: { name: 'L-2G' }, t72: { name: 'L-4' } },
  has(v) { return !v.heli && !!this.KIT[v.def.id]; },
  cycle(v) {
    const K = this.KIT[v.def.id]; if (!K || !v.alive) return null;
    v.light = ((v.light || 0) + 1) % (K.white ? 3 : 2);
    return v.light ? `${K.name} ${v.light === 1 ? '적외선' : '백색광'} 켬` : `${K.name} 끔`;
  },
  // the lamp's position and the direction it points (along the gun)
  beam(v) {
    const m = v.muzzle(), G = v.def.gun, tr = v.local(v.dir * G.trunnion[0], G.trunnion[1] + 0.55);
    return { x: tr.x + m.dx * 0.4, y: tr.y + m.dy * 0.4, dx: m.dx, dy: m.dy };
  },
  // is b inside a's beam (within ~3°)?
  inBeam(a, b, range) {
    if (!a.light) return false;
    const B = this.beam(a), ex = b.pos.x - B.x, ey = b.pos.y + 1.2 - B.y, L = Math.hypot(ex, ey) || 1;
    return (ex * B.dx + ey * B.dy) / L > 0.9985 && range < (a.light === 2 ? 1400 : 1100);
  },
  // night visibility adjustments for the sensor model (src/ai/Sensor.js): returns the visibility to use
  night(world, a, b, range, vis, flash) {
    const S = a.def.sight;
    if (this.inBeam(a, b, range)) {
      if (a.light === 2) vis = Math.max(vis, range < 1000 ? 0.6 : 0.2);                 // white light: any sight
      else if (!S.thermal) vis = Math.max(vis, range < 800 ? 0.6 : 0.25);                // its own infrared, through its IR sight
    }
    if (b.light && b.alive) {
      const dev = S.thermal || S.passive || this.KIT[a.def.id];                           // a night device of any kind
      if (b.light === 2 || dev) vis = Math.max(vis, range < 3500 ? 0.5 : 0.1);
    }
    return vis;
  },
  ai(v, world) {
    if (!this.has(v) || v.team === 'US' || !v.alive) { if (!v.alive) v.light = 0; return; }
    v.light = (world.env.night || 0) > 0.5 ? 1 : 0;
  },
  // ---- drawing: cones of light along the gun, fading with distance; ir: also the infrared ones ----
  draw(ctx, cam, world, ir) {
    for (const v of world.vehicles) {
      if (!v.light || !v.alive || (v.light === 1 && !ir)) continue;
      const B = this.beam(v), L = v.light === 2 ? 1200 : 900, half = 0.045;
      if (!cam.visible(B.x, B.y, L)) continue;
      const nx = -B.dy, ny = B.dx, ex = B.x + B.dx * L, ey = B.y + B.dy * L;
      const g = ctx.createLinearGradient(B.x, B.y, ex, ey);
      const c = v.light === 2 ? '255,248,225' : '235,255,235';
      g.addColorStop(0, `rgba(${c},0.55)`); g.addColorStop(0.08, `rgba(${c},0.22)`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(B.x + nx * 0.15, B.y + ny * 0.15); ctx.lineTo(ex + nx * L * half, ey + ny * L * half); ctx.lineTo(ex - nx * L * half, ey - ny * L * half); ctx.lineTo(B.x - nx * 0.15, B.y - ny * 0.15); ctx.closePath(); ctx.fill();
      const r = 0.6 + 2.5 / cam.zoom, lg = ctx.createRadialGradient(B.x, B.y, 0, B.x, B.y, r);
      lg.addColorStop(0, `rgba(${c},1)`); lg.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = lg; ctx.fillRect(B.x - r, B.y - r, r * 2, r * 2);
      ctx.restore();
    }
  },
};
