// Fire control: laser rangefinder (ray along the sight line against terrain and armour) and a
// ballistic computer that solves the gun superelevation for the lased range with the same
// trajectory model the shells use.
DS.FireControl = {
  // march along the sight line; returns {range, x, y, vehicle} or null
  lase(world, v, maxR = 8000) {
    const o = v.sightOrigin(), a = v.gun.aimW, dx = Math.cos(a), dy = Math.sin(a), T = world.terrain;
    let px = o.x, py = o.y;
    for (let d = 2; d <= maxR; d += 2) {
      const x = o.x + dx * d, y = o.y + dy * d;
      const hit = DS.Armor.raycast(world, px, py, x, y, v, v.team);
      if (hit) return { range: Math.hypot(hit.x - o.x, hit.y - o.y), x: hit.x, y: hit.y, vehicle: hit.v };
      if (y < T.height(x)) {
        let lo = d - 2, hi = d;
        for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (o.y + dy * m < T.height(o.x + dx * m)) hi = m; else lo = m; }
        return { range: hi, x: o.x + dx * hi, y: o.y + dy * hi, vehicle: null };
      }
      if (x < 0 || x > T.n * T.dx) break;
      px = x; py = y;
    }
    return null;
  },

  // elevation (world angle) that puts the shell through (tx, ty) from the muzzle
  solve(v, ammo, tx, ty) {
    const m = v.muzzle(), A = DS.AMMO[ammo];
    const flat = { height: () => -1e9, n: 1e9, dx: 1 };
    const yAt = ang => {
      const p = new DS.Projectile(m.x, m.y, Math.cos(ang) * A.v0 + v.vel.x, Math.sin(ang) * A.v0 + v.vel.y, A, null);
      const sx = Math.sign(tx - m.x) || 1;
      let px = p.x, py = p.y;
      while (p.alive && (p.x - tx) * sx < 0 && p.t < 60) { px = p.x; py = p.y; p.step(1 / 240, flat); }
      const f = (tx - px) / ((p.x - px) || 1e-9);
      return py + (p.y - py) * f - ty;
    };
    let a0 = Math.atan2(ty - m.y, tx - m.x), a1 = a0 + 0.004;
    let e0 = yAt(a0), e1 = yAt(a1);
    for (let i = 0; i < 6 && Math.abs(e1) > 0.02; i++) {
      const a2 = a1 - e1 * (a1 - a0) / ((e1 - e0) || 1e-9);
      a0 = a1; e0 = e1; a1 = a2; e1 = yAt(a1);
    }
    return a1;
  },

  // lase and update superelevation (relative to the sight line)
  update(world, v, doLase) {
    const fc = v.fc;
    if (doLase) {
      const r = this.lase(world, v);
      fc.lasedAt = world.time;
      if (r) { fc.range = r.range; fc.point = r; } else { fc.range = null; fc.point = null; }
    }
    const R = fc.range || fc.bs;
    // superelevation for range R along the current sight line
    const o = v.sightOrigin(), a = v.gun.aimW;
    const tx = o.x + Math.cos(a) * R, ty = o.y + Math.sin(a) * R;
    const ang = this.solve(v, v.gun.ammo, tx, ty);
    const d = ang - v.gun.aimW;
    fc.se = Math.atan2(Math.sin(d), Math.cos(d));
    // coaxial MG: the computer also solves its (much steeper) trajectory for the same range
    if (v.def.coax) {
      const Rc = Math.min(fc.range || 800, 1800), cx = o.x + Math.cos(a) * Rc, cy = o.y + Math.sin(a) * Rc;
      const dc = this.solve(v, v.def.coax.ammo, cx, cy) - v.gun.aimW; fc.seCoax = Math.atan2(Math.sin(dc), Math.cos(dc));
    }
  },
};
