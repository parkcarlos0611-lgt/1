// Sensors: every vehicle searches for enemies with its own sights, under the same rules for the player and
// the AI. Each observer keeps a contact per enemy: level d rises while the enemy is in line of sight —
// d ≥ 1 "contact" (something is there), d ≥ 2 "identified" (type known) — and the last seen position is
// remembered for a while after line of sight is lost.
//   Iraqi optical / IR sights: data from docs/DATA_SOURCES.md (no detection past 2.0–2.5 km, ~400 m at night,
//   dust blinds them). US thermal sights: long reach, unaffected by darkness, dust only shortens it.
DS.Sensor = {
  TICK: 0.25, MEMORY: 8,

  // detection rate (contact levels per second) of observer a against b at range, with line of sight
  rate(world, a, b, range) {
    const S = a.def.sight, env = world.env || {};
    const flash = b.lastFired && world.time - b.lastFired < 5 ? 2 : 1;
    // a moving vehicle's dust tail gives it away, more over soft sand
    const moving = Math.abs(b.vt) > 1.5 ? 1 + Math.min(1.3, Math.abs(b.vt) / 8 * world.terrain.soilAt(b.pos.x).dust) : 1;
    const dm = S.detectMax || 2500;
    let vis;
    if (S.thermal) {
      vis = range >= dm ? 0 : Math.min(1, (dm - range) / (dm - 1200));
      if (env.visibility) vis *= Math.min(1, Math.exp(-range / (env.visibility * 2.6)) * 1.4);   // dust scatters even IR
      vis *= b.def.signature || 1;
      vis *= Math.min(1.3, 0.45 + 0.8 * DS.Thermal.sig(b));          // running engines, hot tubes, fires show up
      vis *= 1 - 0.5 * DS.AI.smoke(world, a, b);                     // smoke cools and scatters the image
      return vis * flash * moving / 1.5;
    }
    vis = range >= dm ? 0 : Math.pow(Math.max(0, Math.min(1, (dm - range) / (dm - 700))), 1.5);
    vis *= S.crew || DS.T.ai.detect;                                       // Iraqi crews overall: poor optics and training
    vis *= 1 - DS.AI.smoke(world, a, b);                          // smoke blocks optical sights
    vis *= b.def.signature || 1;                                 // smaller / lower targets (Bradley) are harder to pick out
    if (env.visibility) vis *= Math.max(0, Math.exp(-range / (env.visibility * 0.45)) * 1.6 - 0.02);
    if ((env.night || 0) > 0.5) vis *= S.passive ? (range < 900 ? 0.6 : range < 1600 ? 0.2 : (flash > 1 ? 0.1 : 0))      // image intensifier
      : range < 400 ? 0.5 : range < 800 ? 0.08 : (flash > 1 ? 0.05 : 0);
    return vis * flash * moving / 5;
  },
  // how far this observer can identify (type) a target under the current conditions
  identRange(world, a) {
    const S = a.def.sight, env = world.env || {}, base = S.identMax || (S.detectMax || 2500) * 0.6;
    if (S.thermal) return env.visibility ? Math.min(base, env.visibility * 2.2) : base;
    if ((env.night || 0) > 0.5) return S.passive ? 800 : 300;
    return env.visibility ? Math.min(base, env.visibility * 0.4) : base;
  },
  // how far the observer's sights reach at all (used to grey out ground it cannot search)
  reach(world, a) {
    const S = a.def.sight, env = world.env || {}, dm = S.detectMax || 2500;
    if (S.thermal) return env.visibility ? Math.min(dm, env.visibility * 2.6) : dm;
    if ((env.night || 0) > 0.5) return S.passive ? 1600 : 800;
    return env.visibility ? Math.min(dm, env.visibility * 0.9) : dm;
  },

  update(world, dt) {
    for (const a of world.vehicles) {
      if (!a.contacts) { a.contacts = new Map(); a.sensT = Math.random() * this.TICK; }
      if (!a.alive) { a.contacts.clear(); continue; }
      a.sensT -= dt;
      const tick = a.sensT <= 0;
      if (tick) a.sensT += this.TICK;
      for (const b of world.vehicles) {
        if (b.team === a.team) continue;
        let c = a.contacts.get(b);
        if (!b.alive) { if (c) c.dead = true; continue; }
        const range = Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
        if (tick) {
          const los = range < 4500 && DS.AI.los(world, a, b);
          if (!c && !los) continue;
          if (!c) { c = { d: 0, los: false, x: b.pos.x, y: b.pos.y, seen: -1e9 }; a.contacts.set(b, c); }
          c.los = los;
        }
        if (!c) continue;
        c.range = range;
        if (c.los) {
          const r = this.rate(world, a, b, range), cap = range < this.identRange(world, a) ? 2.2 : 1.2;
          c.d = Math.min(cap, c.d + dt * r * (c.d >= 1 ? 0.6 : 1));
          if (c.d >= 1) { c.x = b.pos.x; c.y = b.pos.y; c.seen = world.time; }
        } else {
          c.d = Math.max(0, c.d - dt * 0.08);
          if (world.time - c.seen > this.MEMORY && c.d < 1) a.contacts.delete(b);
        }
      }
    }
  },

  // 0 = unknown, 1 = contact, 2 = identified; 'lost' = remembered but out of sight
  level(a, b) {
    if (!a || b === a || b.team === a.team) return 2;
    const c = a.contacts && a.contacts.get(b);
    if (!c || c.seen < 0) return 0;
    return c.d >= 2 ? 2 : 1;
  },
  seenNow(a, b) { const c = a && a.contacts && a.contacts.get(b); return !!(c && c.los && c.d >= 1); },
  // detected enemies, nearest first (optionally only those in sight now)
  list(a, inSight) {
    const out = [];
    if (!a || !a.contacts) return out;
    for (const [b, c] of a.contacts) if (b.alive && c.seen > -1e9 && (!inSight || (c.los && c.d >= 1))) out.push(b);
    return out.sort((p, q) => Math.abs(p.pos.x - a.pos.x) - Math.abs(q.pos.x - a.pos.x));
  },
};
