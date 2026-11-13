// Time of day. The clock runs continuously through 24 hours; the sun and the moon are placed for the Gulf War
// theatre (Kuwait, 29.4° N 47.9° E, local time UTC+3) in late February 1991, and every frame the world's env
// gets what the rest of the game reads:
//   env.clock     hours 0…24 (local time)
//   env.sun       { el: true elevation (deg), side: +1 sun toward +x (east) / -1 (west), ex: east component of
//                   the unit sun vector, cot: horizontal shadow run per metre of height along the drive line }
//                 or null below the horizon
//   env.night     0 (day) … 1 (full dark), continuous through dusk and dawn; lowered by moonlight; starlight keeps
//                 a little of the scene visible even on a moonless night (the darkness overlay stops short)
//   env.moon      { el, ex, light 0…1 } or null
//   env.dark      darkness of the sky picture itself (for the sky painter: stars, glow)
// The drive line runs east–west with the viewer to the south: the sun rises on the right (east, +x) and sets
// on the left; at noon it stands behind the viewer, so shadows fall away from the viewer and barely sideways.
DS.Sky = {
  LAT: 29.4, DECL: -9.5, EOT: -13.5, LON_CORR: 47.9 / 15 - 3,   // 25 Feb 1991: sun declination, equation of time (min)
  MOON_AGE: 10.6,                                              // days since new moon (14 Feb 1991) on 25 Feb
  STARLIGHT: 0.8,                                              // most the darkness overlay reaches with no moon
  speedOf(M) { return M && M.env && M.env.speed != null ? M.env.speed : M && (M.range || M.town) ? 60 : 1; },
  parse(t) { if (typeof t === 'number') return t; const m = /^(\d+):(\d+)/.exec(t || ''); return m ? +m[1] + +m[2] / 60 : 12; },
  fmt(h) { h = ((h % 24) + 24) % 24; const H = Math.floor(h), m = Math.floor((h - H) * 60); return String(H).padStart(2, '0') + ':' + String(m).padStart(2, '0'); },
  // unit vector of a body at hour angle H (deg) and declination d: east, north, up
  body(H, d) {
    const r = Math.PI / 180, la = this.LAT * r, h = H * r, dd = d * r;
    const up = Math.sin(la) * Math.sin(dd) + Math.cos(la) * Math.cos(dd) * Math.cos(h);
    const east = -Math.cos(dd) * Math.sin(h);
    const north = Math.cos(la) * Math.sin(dd) - Math.sin(la) * Math.cos(dd) * Math.cos(h);
    return { el: Math.asin(Math.max(-1, Math.min(1, up))) / r, ex: east, ny: north, up };
  },
  // sun's hour angle (deg) at local clock time h
  hourAngle(h) { return ((h + this.LON_CORR + this.EOT / 60) - 12) * 15; },
  update(w, dt) {
    const env = w.env; if (!env || env.clock == null) return;
    if (dt > 0) env.clock = (env.clock + dt * (env.speed || 0) / 3600 + 24) % 24;
    const s = this.body(this.hourAngle(env.clock), this.DECL);
    const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    // the moon: a phase's worth of hours behind the sun (0.8 h a day), its declination about +12° this month
    const age = this.MOON_AGE + (env.dayOff || 0), mh = this.hourAngle(env.clock) - age * 12.19;
    const m = this.body(mh, 12), illum = (1 - Math.cos(age / 29.53 * 2 * Math.PI)) / 2;
    const moonUp = env.moonless ? 0 : sm(-2, 8, m.el) * illum;
    env.moon = m.el > -2 && !env.moonless ? { el: m.el, ex: m.ex, light: moonUp, illum } : null;
    const dark = sm(2, -12, s.el);                              // civil to nautical twilight
    env.dark = dark;
    env.night = dark * (1 - 0.3 * moonUp);
    env.sun = s.el > -0.5 ? { el: s.el, ex: s.ex, side: s.ex >= 0 ? 1 : -1, cot: Math.min(8, Math.abs(s.ex) / Math.max(0.02, Math.sin(Math.max(1, s.el) * Math.PI / 180))) } : null;
    // light colour and level for the scene (sky and post grade read these)
    env.low = s.el > 0 ? sm(25, 5, s.el) : 1;
  },
  // set up a world's clock from a map or mission env (time 'HH:MM', speed game-seconds per real second)
  init(w, M) {
    const e = M.env || {};
    w.env.clock = this.parse(e.time || (M.night ? '01:00' : '10:00'));
    w.env.speed = this.speedOf(M);
    w.env.moonless = !!e.moonless;
    w.env.blackout = !!e.blackout;
    this.update(w, 0);
  },
  // windows lit in a town at clock h (share of all windows): evening peak, a few left on before dawn
  windowShare(h) {
    const k = (a, b) => { const t = Math.max(0, Math.min(1, (h - a) / (b - a))); return t * t * (3 - 2 * t); };
    if (h >= 12) return 0.4 * k(17.3, 19) - 0.32 * k(21, 27);
    return 0.4 - 0.32 * k(-3, 3) - 0.08 * k(4.5, 6.8);
  },
};
