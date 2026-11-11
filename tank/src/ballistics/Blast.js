// High-explosive burst (155 mm shells): overpressure and fragments against vehicles within the blast radius,
// buildings brought down, and the big ground burst. Rules (docs/PLAN.md):
//   light armour (under 35 t: Bradley, M109): knocked out inside ~2/3 of the radius or by a direct hit, likely
//     beyond that; survivors lose a track or a crewman
//   tanks: knocked out only by a direct hit or a burst within `kill` metres (not always); otherwise the track
//     is cut — certain close in, less likely toward the edge — and the gun / sights may be damaged
DS.Blast = {
  burst(W, x, y, p, hit, bld) {
    const A = p.ammo, B = A.blast, rnd = W.rng, owner = p.owner;
    W.fx.heBurst(x, y, A, !!hit || !!bld);
    for (const v of W.vehicles) {
      if (!v.alive || v.god) continue;
      const half = Math.abs(v.g.idler.x - v.g.sprocket.x) / 2 + 0.4, direct = hit && hit.v === v;
      const d = direct ? 0 : Math.hypot(Math.max(0, Math.abs(v.pos.x - x) - half), Math.max(0, y - (v.pos.y + 2.2), (v.pos.y - 1.6) - y));
      if (d > B.r) continue;
      const light = v.def.mass < 35000, fx = [];
      let dead = false;
      if (light) dead = direct || d < B.r * 0.65 || rnd() < 1 - d / B.r;
      else dead = direct ? rnd() < 0.6 : d < B.kill && rnd() < 0.7;
      if (dead) {
        v.knockOut('폭압·파편'); fx.push('격파 (폭압)');
        if (rnd() < (light ? 0.6 : 0.3)) { v.ignite(); fx.push('화재'); }
      } else {
        const pt = direct || d < B.kill ? 1 : 1 - 0.75 * (d - B.kill) / (B.r - B.kill);
        if (rnd() < pt) fx.push(v.damage('track', { x: Math.max(v.pos.x - half, Math.min(v.pos.x + half, x)), y: v.pos.y - 1.2 }));
        const ext = v.def.modules.filter(m => m.type === 'gun' || m.type === 'optics' || (light && m.type === 'crew'));
        if (ext.length && rnd() < (light ? 0.5 : 0.25) * (1 - d / B.r + 0.3)) fx.push(v.damage(ext[Math.floor(rnd() * ext.length)].id));
        if (!fx.length) fx.push('흔들림 — 피해 없음');
      }
      W.addLog({ blast: true, vehicle: v, dist: d, direct, ammo: A, effects: fx.filter(Boolean), range: Math.abs(x - p.x0), shooter: owner, t: p.t });
      if (v === W.vehicles[0]) W.playerHitAt = W.time;
    }
    for (const b of W.buildings) b.blast(W, x, y, B.r);
    if (owner && !owner.ai) W.lastBurst = { x, y, t: W.time, tof: p.t };
    if (owner && owner.ai) owner.ai.observe({ x });
  },
  // Cluster warhead (M26): opens at `alt` above the ground; the bomblets carry on along the rocket's path and
  // come down over a strip ±half metres long. A few dozen are shown bursting; hits on vehicles are drawn from
  // the density of the pattern (docs/PLAN.md): the real footprint is an ellipse about 200 x 100 m, so a
  // vehicle 7 x 3.5 m at its centre collects about one and a half of the 644 bomblets, fewer toward the edge.
  cluster(W, p) {
    const C = p.ammo.cluster, T = W.terrain, rnd = W.rng, g = DS.T.g;
    // pattern centre: where the rocket itself would have come down (the fire-control solution is computed for
    // that point); the bomblets take a few seconds longer to fall from the opening height
    const q = new DS.Projectile(p.x, p.y, p.vx, p.vy, p.ammo, null); q.t = p.t;
    let land = null; for (let i = 0; i < 4000 && !land && q.alive; i++) land = q.step(1 / 60, T, null);
    const cx = land ? land.x : p.x, tf = (q.t - p.t) + 2.5;
    W.fx.flashes.push({ x: p.x, y: p.y, dx: 0, dy: 1, t: 0, ttl: 0.08, boom: true });
    for (let i = 0; i < 10; i++) W.particles.add(DS.P.SMOKE, p.x, p.y, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 3 + Math.random() * 3, 1.5, { grow: 2, drag: 1, grav: 0, alpha: 0.4, col: 0xdad4c8 });
    const t0 = W.time + tf, shown = 44;
    for (let i = 0; i < shown; i++) {
      const x = cx + DS.AI.gauss(rnd) * C.half * 0.5, at = t0 + Math.random() * 2.2 + Math.abs(x - cx) / C.half * 0.4;
      W.sched.push({ t: at, fn: () => { const y = T.height(x); W.fx.bomblet(x, y, i % 3 !== 0); if (i % 4 === 0) T.crater(x, 0.5, 0.12, 0.3, 0); for (const b of W.buildings) b.blast(W, x, y, 1.2); } });
    }
    W.sched.push({ t: t0, fn: () => DS.Audio.crackle(cx, T.height(cx), 40, 2.6) });
    for (const v of W.vehicles) {
      if (v.god) continue;
      const u = (v.pos.x - cx) / (C.half * 0.5); if (Math.abs(u) > 2.4) continue;
      const mean = 1.5 * Math.exp(-u * u / 2);
      let n = 0, L = Math.exp(-mean), q = rnd(); while (q > L && n < 6) { n++; q *= rnd(); }      // Poisson draw
      if (!n) continue;
      W.sched.push({ t: t0 + Math.random() * 2, fn: () => {
        if (!v.alive) return;
        const fx = [], top = v.def.armor.filter(a => a.n === 90), roof = top.length ? Math.min(...top.map(a => a.t * (DS.MATERIALS[a.mat].ce || 1))) : 30;
        for (let k = 0; k < n; k++) {
          const hx = v.pos.x + (rnd() - 0.5) * 5, hy = v.pos.y + 1.2;
          W.fx.bomblet(hx, hy, false); v.addScorch(hx, hy, 0.5);
          if (C.pen > roof) { const m = v.def.modules[Math.floor(rnd() * v.def.modules.length)]; fx.push(v.damage(m.id)); }
          else fx.push('상면 비관통');
        }
        W.addLog({ blast: true, vehicle: v, dist: Math.abs(v.pos.x - cx), direct: false, ammo: p.ammo, effects: [`자탄 ${n}발 명중`, ...fx.filter(Boolean)], range: Math.abs(cx - p.x0), shooter: p.owner, t: p.t });
        if (v === W.vehicles[0]) W.playerHitAt = W.time;
      } });
    }
    if (p.owner && !p.owner.ai) W.sched.push({ t: t0, fn: () => { W.lastBurst = { x: cx, y: T.height(cx), t: W.time, tof: p.t + tf }; } });
  },
};
