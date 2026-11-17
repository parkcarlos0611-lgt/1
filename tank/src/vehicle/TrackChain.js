// A cut track: the closed belt becomes an open chain of links (Verlet points, one per link) at the moment it
// breaks. Links keep their pitch, fall under gravity, rest on the sand with friction and drape over the
// wheels; the drive sprocket still drags any links it holds, so throttling a cut track spools it off onto the
// ground.
DS.TrackChain = {
  // build from the current belt, opened at the link nearest (bx, by)
  create(v, bx, by) {
    const D = v.def, circles = v.gearCircles();
    let path = DS.Track.buildPath(circles, [], circles.map(c => c.fixed));
    path = DS.Track.conformBottom(path, v.terrain, D.track.thick / 2, 0.25);
    const links = [], info = DS.Track.links(path, D.track.pitch, v.s, links);
    let k = 0, bd = 1e9;
    links.forEach((l, i) => { const d = Math.hypot(l[0] - bx, l[1] - by); if (d < bd) { bd = d; k = i; } });
    const order = links.slice(k + 1).concat(links.slice(0, k));          // open at the hit: drop the struck link
    const p = order.map(l => ({ x: l[0], y: l[1], px: l[0], py: l[1] }));
    // the two new ends whip apart a little
    if (p.length > 2) { p[0].px = p[0].x + (Math.random() - 0.5) * 0.04; p[0].py = p[0].y - 0.03; const e = p[p.length - 1]; e.px = e.x + (Math.random() - 0.5) * 0.04; e.py = e.y - 0.03; }
    return { p, L: info.pitch, settle: 0 };
  },
  step(v, dt) {
    const ch = v.chain, P = ch.p, D = v.def, T = v.terrain, th = D.track.thick / 2, g = DS.T.g;
    const circles = v.gearCircles(), sp = circles.find(c => c.fixed && Math.abs(c.r - v.sprR()) < 1e-6) || null;
    const drive = v.alive && v.input.drive ? v.input.drive * Math.min(3, 1 + Math.abs(v.vt)) : 0;
    v.sprAng -= drive * dt / v.sprR();
    for (const q of P) {                                              // integrate
      const vx = (q.x - q.px) * 0.995, vy = (q.y - q.py) * 0.995;
      q.px = q.x; q.py = q.y; q.x += vx; q.y += vy - g * dt * dt;
    }
    for (let it = 0; it < 8; it++) {
      for (let i = 1; i < P.length; i++) {                            // keep the pitch
        const a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, f = (d - ch.L) / d * 0.5;
        a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f;
      }
      for (const q of P) {
        for (const c of circles) {                                    // links lie outside the wheels
          const dx = q.x - c.x, dy = q.y - c.y, d = Math.hypot(dx, dy), r = c.r;
          if (d < r && d > 1e-6) {
            q.x = c.x + dx / d * r; q.y = c.y + dy / d * r;
            if (c === sp && drive) { const tx = dy / d, ty = -dx / d; q.x += tx * drive * dt; q.y += ty * drive * dt; }   // sprocket teeth drag it round
          }
        }
        const h = T.height(q.x) + th;                                 // sand: no sinking, high friction
        if (q.y < h) { q.y = h; q.px = q.x - (q.x - q.px) * 0.3; }
      }
    }
  },
};
