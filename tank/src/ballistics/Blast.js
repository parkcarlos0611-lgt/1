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
};
