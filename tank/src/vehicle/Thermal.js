// Heat model for the thermal sights. Each vehicle carries part temperatures on a 0–1.5 scale (relative, not
// kelvin): engine (rises with power, cools over minutes once stopped), tracks and road wheels (friction, with
// speed), gun tube (each main-gun round adds heat, cools over minutes), fire. The scene's ambient terms depend
// on time and conditions — warm sand by day, cold at night, and around sunrise hull and sand are nearly the
// same temperature (thermal crossover), so only running engines and hot tubes stand out.
DS.Thermal = {
  update(w, dt) {
    for (const v of w.vehicles) {
      if (!v.heat) v.heat = { eng: v.alive ? 0.35 : 0, trk: 0, gun: 0, fire: 0, f: v.gun.fired };
      const H = v.heat, ease = (cur, tgt, up, down) => cur + (tgt - cur) * Math.min(1, dt / (tgt > cur ? up : down));
      H.eng = ease(H.eng, v.alive ? 0.35 + 0.65 * v.spool : 0, 15, 240);
      H.trk = ease(H.trk, Math.min(1, Math.abs(v.vt) / 10), 10, 90);
      if (v.gun.fired !== H.f) {
        const small = v.gun.ammo && DS.AMMO[v.gun.ammo] && DS.AMMO[v.gun.ammo].small;
        H.gun = Math.min(1, H.gun + (small ? 0.012 : 0.22) * (v.gun.fired - H.f)); H.f = v.gun.fired;
      }
      H.gun -= H.gun * Math.min(1, dt / 150);
      H.fire = v.burning ? Math.min(1.5, H.fire + dt) : H.fire * (1 - Math.min(1, dt / 300));
    }
  },
  // how strongly a vehicle shows up in a thermal sight (used by the sensors)
  sig(v) { const H = v.heat; return H ? Math.max(H.eng * 0.8, H.trk * 0.6, H.gun * 0.7, H.fire) + 0.25 : 0.6; },

  ambient(w) {
    const env = w.env || {}, sun = env.sun, night = env.night || 0;
    // the ground warms through the day and cools through the night (lagging the sun a couple of hours)
    const h = env.clock != null ? env.clock : null, heat = h == null ? null : Math.max(0, Math.sin((h - 8) / 12 * Math.PI));
    let ground = h != null ? 0.08 + (0.30 + 0.25 * heat - 0.08) * Math.min(1, heat * 1.6 + (1 - night) * 0.2)
      : night ? 0.08 : 0.30 + 0.25 * Math.min(1, (sun ? sun.el : 30) / 45);
    if (env.visibility) ground -= 0.03;
    const hullDelta = 0.2 * night + (1 - night) * (sun && sun.el < 20 ? Math.max(0, (sun.el - 14) / 6) * 0.08 : 0.09);
    return { ground, hullDelta, sky: 0.05 * (1 - night), att: env.visibility ? env.visibility * 2.6 : 7000 };
  },
  hull(v, amb) { const H = v.heat || { eng: 0.3, fire: 0 }; return amb.ground + amb.hullDelta + 0.12 * H.eng + 0.3 * Math.min(1, H.fire); },
  // hot spots in world coordinates: [x, y, radius m, extra temperature over the hull]
  spots(v) {
    const H = v.heat || { eng: 0.3, trk: 0, gun: 0, fire: 0 }, D = v.def, out = [];
    const em = D.modules.find(m => m.id === 'engine');
    if (em) { const p = v.local(em.p[0] * v.dir, em.p[1]); out.push([p.x, p.y, 1.9, H.eng * 0.9]); }
    const e = v.local(v.g.exhaust.x, v.g.exhaust.y); out.push([e.x, e.y, 1.1, H.eng * 1.3]);
    for (const s of v.st) out.push([s.wx, s.wy, D.wheelR * 1.3, H.trk * 0.45]);
    const sp = v.local(v.g.sprocket.x, v.g.sprocket.y); out.push([sp.x, sp.y, 0.5, H.trk * 0.4 + H.eng * 0.15]);
    if (v.burning) { const f = v.fireSource(); out.push([f.x, f.y, 2.6, 1.2]); }
    return out.filter(s => s[3] > 0.02);
  },
  peak(v) { const H = v.heat || { eng: 0.3, fire: 0, gun: 0 }; return Math.max(0.6, 0.4 + H.eng * 0.85, 0.4 + H.gun * 0.6, v.burning ? 1.6 : 0); },
};
