// Searchlights over the main gun, laid with it: M60A1 AN/VSS-1 xenon (infrared or white light, each as a narrow
// spot or a wide flood), T-55 / T-62 L-2 "Luna" and T-72 L-4 (infrared). v.light:
//   0 off · 1 infrared spot · 2 infrared flood · 3 white spot · 4 white flood (3–4 AN/VSS-1 only; the Soviet lamps
//   have the infrared spot and flood)
// What the light does:
//   - an active infrared night sight (the Iraqi tanks') sees properly only what its own infrared lamp lights:
//     ~1 km down a spot beam (≈ 500 m in a flood), instead of 300–800 m; white light lets any optical sight see
//   - the lamp gives the vehicle away: an infrared lamp is plain to anyone with a night device out to ~3.5 km,
//     a white one to everyone
//   - a hit near the lamp breaks it
// What it looks like: a narrow bright core widening and fading with distance (soft edges, no hard wedge), seen
// faintly in clear air and strongly in dust or smoke, stopping where it meets the ground, a building or a
// vehicle — with a pool of light there — and a glaring source. Infrared shows only in a night-vision sight
// (a dull red glow at the lamp to the eye); white in the main view at night.
// Iraqi crews run them at night while searching; once they are fighting, half of them put theirs out. The
// Marines' M60A1s run dark unless the player switches one on (Y / 탐조등 steps through the modes).
DS.Searchlight = {
  KIT: { m60a1: { name: 'AN/VSS-1', white: true }, t55: { name: 'L-2' }, t62: { name: 'L-2G' }, t72: { name: 'L-4' } },
  MODES: ['끔', '적외선 집광', '적외선 산광', '백색 집광', '백색 산광'],
  has(v) { return !v.heli && !!this.KIT[v.def.id]; },
  white(v) { return v.light >= 3; },
  flood(v) { return v.light === 2 || v.light === 4; },
  // beam reach (m) and half-width (rad)
  spec(v) { const w = this.white(v); return this.flood(v) ? { L: w ? 650 : 520, half: 0.042 } : { L: w ? 1500 : 1150, half: 0.011 }; },
  cycle(v) {
    const K = this.KIT[v.def.id]; if (!K || !v.alive) return null;
    if (v.lampBroken) return `${K.name} 파손 — 사용 불가`;
    v.light = ((v.light || 0) + 1) % (K.white ? 5 : 3);
    return `${K.name} ${this.MODES[v.light]}${v.light ? ' 켬' : ''}`;
  },
  // the lamp's position and the direction it points (along the gun)
  beam(v) {
    const m = v.muzzle(), G = v.def.gun, tr = v.local(v.dir * G.trunnion[0], G.trunnion[1] + 0.55);
    return { x: tr.x + m.dx * 0.4, y: tr.y + m.dy * 0.4, dx: m.dx, dy: m.dy };
  },
  // where the beam stops: ground, a building or a vehicle (cached a few times a second)
  reachOf(v, world) {
    const now = world.time; if (v._beamT != null && now - v._beamT < 0.15) return v._beamD;
    const B = this.beam(v), S = this.spec(v), ex = B.x + B.dx * S.L, ey = B.y + B.dy * S.L, T = world.terrain;
    let d = S.L;
    for (let s = 4; s < S.L; s += 4) { const x = B.x + B.dx * s, y = B.y + B.dy * s; if (y < T.height(x)) { d = s; break; } }
    const hv = DS.Armor.raycast(world, B.x, B.y, ex, ey, v, null); if (hv && hv.t * S.L < d) d = hv.t * S.L;
    if (world.buildings.length) { const hb = DS.Building.ray(world, B.x, B.y, ex, ey); if (hb && hb.t * S.L < d) d = hb.t * S.L; }
    v._beamT = now; v._beamD = d; return d;
  },
  // is b inside a's beam?
  inBeam(a, b, range, world) {
    if (!a.light) return false;
    const B = this.beam(a), S = this.spec(a), ex = b.pos.x - B.x, ey = b.pos.y + 1.2 - B.y, L = Math.hypot(ex, ey) || 1;
    return (ex * B.dx + ey * B.dy) / L > Math.cos(S.half * 1.4) && range < this.reachOf(a, world) + 8;
  },
  // night visibility for the sensor model (src/ai/Sensor.js)
  night(world, a, b, range, vis, flash) {
    const S = a.def.sight;
    if (this.inBeam(a, b, range, world)) {
      if (this.white(a)) vis = Math.max(vis, range < 900 ? 0.6 : 0.2);                   // white light: any sight
      else if (!S.thermal) vis = Math.max(vis, range < 750 ? 0.6 : 0.25);                // its own infrared, through its IR sight
    }
    if (b.light && b.alive) {
      const dev = S.thermal || S.passive || this.KIT[a.def.id];
      if (this.white(b) || dev) vis = Math.max(vis, range < 3500 ? 0.5 : 0.1);
    }
    return vis;
  },
  // a hit within ~0.7 m of the lamp breaks it
  hit(v, x, y) {
    if (!this.has(v) || v.lampBroken) return;
    const B = this.beam(v); if (Math.hypot(x - B.x, y - B.y) < 0.7) { v.lampBroken = true; v.light = 0; }
  },
  ai(v, world) {
    if (!this.has(v) || v.team === 'US' || !v.alive || v.lampBroken) { if (!v.alive || v.lampBroken) v.light = 0; return; }
    const night = (world.env.night || 0) > 0.5, fighting = v.ai && v.ai.tgt;
    if (fighting && v._lampDark == null) v._lampDark = Math.random() < 0.5;        // half the crews go dark once in action
    v.light = night && !(fighting && v._lampDark) ? 1 : 0;
  },

  // ---- drawing. nv: inside a night-vision sight (every beam, infrared included, green and bloomed) ----
  draw(ctx, cam, world, nv) {
    const env = world.env || {}, haze = env.visibility ? Math.min(3, 900 / env.visibility) : 0;
    for (const v of world.vehicles) {
      if (!v.light || !v.alive) continue;
      const white = this.white(v);
      if (!white && !nv) { this.lampGlow(ctx, cam, v, '150,30,20', 0.18); continue; }    // infrared to the eye: a dull red at the lamp
      const B = this.beam(v), S = this.spec(v), D = this.reachOf(v, world);
      if (!cam.visible(B.x, B.y, D + 20)) continue;
      const c = nv ? '220,255,220' : '255,246,220', air = (nv ? 0.1 : 0.12) * (1 + haze);           // scattering: faint in clear air
      const nx = -B.dy, ny = B.dx, ex = B.x + B.dx * D, ey = B.y + B.dy * D;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // light does not go into the ground: clip to what is above the surface
      { const T = world.terrain, st = Math.max(1, 4 / cam.zoom), a = cam.left - 2, b2 = cam.right + 2; ctx.beginPath(); ctx.moveTo(a, cam.top + 50);
        for (let x = a; x <= b2; x += st) ctx.lineTo(x, T.height(x) - 0.05); ctx.lineTo(b2, cam.top + 50); ctx.closePath(); ctx.clip(); }
      // three nested cones, each wider and fainter: a soft-edged beam
      for (const [wk, ak] of [[1, 1], [1.8, 0.45], [3, 0.18]]) {
        const w0 = 0.12 * wk, w1 = Math.max(w0, D * S.half * wk);
        const g = ctx.createLinearGradient(B.x, B.y, ex, ey);
        g.addColorStop(0, `rgba(${c},${Math.min(1, air * 3.5 * ak)})`); g.addColorStop(0.05, `rgba(${c},${air * 1.6 * ak})`);
        g.addColorStop(0.3, `rgba(${c},${air * 0.45 * ak})`); g.addColorStop(1, `rgba(${c},${air * 0.06 * ak})`);
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(B.x + nx * w0, B.y + ny * w0); ctx.lineTo(ex + nx * w1, ey + ny * w1); ctx.lineTo(ex - nx * w1, ey - ny * w1); ctx.lineTo(B.x - nx * w0, B.y - ny * w0); ctx.closePath(); ctx.fill();
      }
      // where it lands: a pool of light (dimmer the farther the throw)
      if (D < S.L - 1) {
        const r = Math.max(1.5, D * S.half * 1.6), a = Math.min(0.85, (nv ? 1.1 : 0.7) * (300 / (D + 300)));
        const pg = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 1.8); pg.addColorStop(0, `rgba(${c},${a})`); pg.addColorStop(0.5, `rgba(${c},${a * 0.35})`); pg.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = pg; ctx.fillRect(ex - r * 1.8, ey - r * 1.8, r * 3.6, r * 3.6);
      }
      ctx.restore();
      this.lampGlow(ctx, cam, v, c, 1);
    }
  },
  // the lamp itself: a glaring point with a short four-ray flare
  lampGlow(ctx, cam, v, c, k) {
    const B = this.beam(v), r = 0.35 + 3 / cam.zoom;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(B.x, B.y, 0, B.x, B.y, r * 2.5); g.addColorStop(0, `rgba(${c},${k})`); g.addColorStop(0.2, `rgba(${c},${0.5 * k})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.fillRect(B.x - r * 2.5, B.y - r * 2.5, r * 5, r * 5);
    if (k > 0.5) { ctx.strokeStyle = `rgba(${c},0.35)`; ctx.lineWidth = 0.6 / cam.zoom; ctx.beginPath(); ctx.moveTo(B.x - r * 4, B.y); ctx.lineTo(B.x + r * 4, B.y); ctx.moveTo(B.x, B.y - r * 3); ctx.lineTo(B.x, B.y + r * 3); ctx.stroke(); }
    ctx.restore();
  },
};
