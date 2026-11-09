// Armour plates in world space, ray tests, penetration / ricochet resolution and
// behind-armour damage to internal modules.
DS.Armor = {
  // world-space plates of a vehicle (cached per physics step)
  plates(v) {
    if (v._platesT === v.simT) return v._plates;
    const out = v._plates || (v._plates = []);
    out.length = 0;
    const c = Math.cos(v.ang), s = Math.sin(v.ang), dir = v.dir;
    for (const P of v.def.armor) {
      if (P.part === 'turret' && v.turretGone) continue;
      const ax = P.a[0] * dir, ay = P.a[1], bx = P.b[0] * dir, by = P.b[1];
      const na = P.n * Math.PI / 180, nlx = Math.cos(na) * dir, nly = Math.sin(na);
      out.push({
        P, ax: v.pos.x + c * ax - s * ay, ay: v.pos.y + s * ax + c * ay,
        bx: v.pos.x + c * bx - s * by, by: v.pos.y + s * bx + c * by,
        nx: c * nlx - s * nly, ny: s * nlx + c * nly,
      });
    }
    v._platesT = v.simT;
    return out;
  },

  // nearest plate hit along segment p0→p1 (only plates facing the ray). returns {v, pl, t, x, y} or null
  raycast(world, x0, y0, x1, y1, ignore) {
    let best = null;
    const dx = x1 - x0, dy = y1 - y0;
    for (const v of world.vehicles) {
      if (v === ignore) continue;
      // broad phase: distance from vehicle centre to the segment
      const L2 = dx * dx + dy * dy || 1e-9;
      let u = ((v.pos.x - x0) * dx + (v.pos.y - y0) * dy) / L2; u = Math.max(0, Math.min(1, u));
      if (Math.hypot(x0 + dx * u - v.pos.x, y0 + dy * u - v.pos.y) > 7) continue;
      for (const pl of this.plates(v)) {
        if (pl.nx * dx + pl.ny * dy >= 0) continue;            // back-facing
        const ex = pl.bx - pl.ax, ey = pl.by - pl.ay, den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((pl.ax - x0) * ey - (pl.ay - y0) * ex) / den;
        const q = ((pl.ax - x0) * dy - (pl.ay - y0) * dx) / den;
        if (t < 0 || t > 1 || q < 0 || q > 1) continue;
        if (!best || t < best.t) best = { v, pl, t, x: x0 + dx * t, y: y0 + dy * t };
      }
    }
    return best;
  },

  // penetration capability of a round at impact speed v (mm RHA)
  penetration(A, v) {
    if (A.pen.ce) return A.pen.ce;
    return A.pen.ke * Math.exp(-A.pen.s * (1 / (v * v) - 1 / (A.pen.vref * A.pen.vref)));
  },

  // velocity at the reference range, from the same ballistic integrator the game uses
  calibrate() {
    const flat = { height: () => -1e9, n: 1e9, dx: 1 };
    for (const k in DS.AMMO) {
      const A = DS.AMMO[k];
      if (!A.pen.ke) continue;
      const p = new DS.Projectile(0, 0, A.v0, 0, A, null);
      while (p.alive && p.x < A.pen.at) p.step(1 / 1000, flat);
      A.pen.vref = Math.hypot(p.vx, p.vy);
    }
  },

  // Resolve a projectile striking plate pl. Returns a result object (also used for the hit log).
  resolve(world, proj, hit) {
    const A = proj.ammo, pl = hit.pl, P = pl.P, v = hit.v;
    const sp = Math.hypot(proj.vx, proj.vy), dx = proj.vx / sp, dy = proj.vy / sp;
    const rnd = world.rng;
    // obliquity: 2D angle to the plate normal, combined with the plate's plan-view angle and a
    // small random yaw (the target is never perfectly square to the shot)
    const cosV = Math.max(0, -(dx * pl.nx + dy * pl.ny));
    const yaw = Math.abs(rnd() + rnd() + rnd() - 1.5) * 9;          // deg, ~0–13
    const hAng = Math.abs(P.h + (rnd() < 0.5 ? -yaw : yaw)) * Math.PI / 180;
    const cosT = Math.max(0.03, cosV * Math.cos(hAng));
    const obl = Math.acos(cosT) * 180 / Math.PI;
    const M = DS.MATERIALS[P.mat];
    const los = P.t / cosT;
    const heat = A.type === 'HEAT';
    const prot = los * (heat ? M.ce : M.ke);
    const pen = this.penetration(A, sp);
    const range = Math.abs(hit.x - proj.x0);
    const r = { vehicle: v, plate: P.name, part: P.part, ammo: A, range, speed: sp, obl, los, prot, pen, x: hit.x, y: hit.y, effects: [] };

    // ricochet / fuze graze
    const pr = Math.max(0, Math.min(1, (obl - (A.crit - 5)) / 10));
    if (rnd() < pr) {
      r.result = 'ricochet';
      const k = 2 * (dx * pl.nx + dy * pl.ny);
      let rx = dx - k * pl.nx, ry = dy - k * pl.ny;
      const j = (rnd() - 0.5) * 0.12, cj = Math.cos(j), sj = Math.sin(j);
      [rx, ry] = [rx * cj - ry * sj, rx * sj + ry * cj];
      const keep = heat ? 0.9 : 0.55;
      r.reflect = { x: hit.x + pl.nx * 0.05, y: hit.y + pl.ny * 0.05, vx: rx * sp * keep, vy: ry * sp * keep };
      return r;
    }
    if (P.track) {
      r.result = pen > prot ? 'track' : 'nonpen';
      if (v.alive && rnd() < 0.75) { v.damage('track'); r.effects.push('궤도 절단 → 기동 불능'); }
      return r;
    }
    if (pen < prot) { r.result = 'nonpen'; return r; }

    r.result = 'pen';
    const resid = pen - prot;
    // char spreads from the entry hole; flame and debris blow back out of it for a moment
    v.addScorch(hit.x, hit.y, heat ? 1.0 : 0.8);
    const hl = v.toLocal(hit.x, hit.y);
    v.holes.push({ lx: hl.x, ly: hl.y, nx: pl.nx, ny: pl.ny, t: heat ? 1.4 : 0.9, part: hl.y > v.g.ring.y - 0.05 ? 'turret' : 'hull' });
    r.resid = resid;
    // behind-armour debris / jet: a cone of rays from the entry point
    const len = heat ? Math.min(3.5, 1.2 + resid / 250) : Math.min(4.5, 0.9 + resid / 120);
    const half = (heat ? 8 : 20) * Math.PI / 180, n = 11;
    const pk = heat ? 0.55 : 0.45;
    const c = Math.cos(v.ang), s = Math.sin(v.ang);
    const hits = new Map();
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dy, dx) + (i / (n - 1) - 0.5) * 2 * half;
      const ux = Math.cos(a), uy = Math.sin(a);
      for (const m of v.def.modules) {
        if (v.modState[m.id] && m.type === 'crew') continue;
        if (v.turretGone && m.p[1] > 0.2) continue;
        const lx = m.p[0] * v.dir, ly = m.p[1];
        const mx = v.pos.x + c * lx - s * ly, my = v.pos.y + s * lx + c * ly;
        const ox = mx - hit.x, oy = my - hit.y, along = ox * ux + oy * uy;
        if (along < 0 || along > len) continue;
        if (Math.hypot(ox - ux * along, oy - uy * along) < m.r) hits.set(m, (hits.get(m) || 0) + 1);
      }
    }
    for (const [m, k] of hits) {
      if (rnd() < 1 - Math.pow(1 - pk, k)) r.effects.push(v.damage(m.id));
    }
    if (!r.effects.length) r.effects.push('파편 피해 경미');
    return r;
  },
};
