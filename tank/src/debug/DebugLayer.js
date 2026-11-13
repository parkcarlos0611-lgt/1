// F9 overlay: track path, wheel loads & slip, centre of mass, gun line, terrain cells.
DS.Debug = {
  draw(ctx, w) {
    const z = w.cam.zoom, lw = 1.5 / z;
    ctx.lineWidth = lw;
    for (const v of w.vehicles) {
      const D = v.def;
      if (v._trackPath) {
        ctx.strokeStyle = 'rgba(0,200,255,0.9)'; ctx.beginPath();
        const p = v._trackPath; ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); ctx.stroke();
      }
      for (const s of v.st) {
        ctx.strokeStyle = s.contact ? '#0f0' : '#f44'; ctx.beginPath(); ctx.arc(s.wx, s.wy, D.wheelR, 0, 7); ctx.stroke();
        const n = s.N / v.F0;                                       // load bar (1 = static)
        ctx.fillStyle = 'rgba(0,255,0,0.6)'; ctx.fillRect(s.wx - 0.05, s.wy, 0.1, n * 0.8);
        ctx.fillStyle = 'rgba(255,200,0,0.8)'; ctx.fillRect(s.wx, s.wy - D.wheelR - 0.1, s.Ft / 4e4, 0.06);  // traction
      }
      ctx.fillStyle = '#f0f'; ctx.beginPath(); ctx.arc(v.pos.x, v.pos.y, 0.12, 0, 7); ctx.fill();
      const m = v.muzzle();
      ctx.strokeStyle = 'rgba(255,0,0,0.5)'; ctx.setLineDash([0.5, 0.5]); ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + m.dx * 400, m.y + m.dy * 400); ctx.stroke(); ctx.setLineDash([]);
    }
    // terrain cells near the camera when zoomed in
    if (z > 25) {
      const T = w.terrain; ctx.fillStyle = 'rgba(255,0,0,0.6)';
      for (let x = w.cam.left; x < w.cam.right; x += T.dx) { const i = T.idx(x); if (T.sink[i] > 0) ctx.fillRect(i * T.dx - 0.01, T.h[i], 0.02, T.sink[i] * 3); }
    }
    for (const h of w.hits) { ctx.strokeStyle = '#ff0'; ctx.beginPath(); ctx.arc(h.x, h.y, 0.5, 0, 7); ctx.stroke(); }
  },
};
