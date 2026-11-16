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
      let ax = P.a[0] * dir, ay = P.a[1], bx = P.b[0] * dir, by = P.b[1];
      // plates overlap their neighbours by 6 cm at each end, so no ray slips through the seam between two
      // plates (e.g. under the turret front, over the hull roof, at turret-ring height)
      { const L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L * 0.06, uy = (by - ay) / L * 0.06; ax -= ux; ay -= uy; bx += ux; by += uy; }
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
  raycast(world, x0, y0, x1, y1, ignore, team, barrels) {
    let best = null;
    const dx = x1 - x0, dy = y1 - y0;
    for (const v of world.vehicles) {
      if (v === ignore || (team && v.team === team)) continue;   // friends are in another lane of the 2D line
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
      if (barrels) { const b = this.barrelHit(v, x0, y0, x1, y1); if (b && (!best || b.t < best.t)) best = { v, barrel: true, t: b.t, x: b.x, y: b.y }; }
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

  // H5: equipment on the outside, world positions: the gunner's sight head, the searchlight, the commander's
  // machine gun (each with a radius a burst or a strike must come within), and the gun tube as a segment
  ext(v) {
    const out = [], o = v.sightOrigin(); out.push({ id: 'optics', x: o.x, y: o.y + 0.25, r: 0.45 });
    if (DS.Searchlight.has && DS.Searchlight.has(v)) { const B = DS.Searchlight.beam(v); out.push({ id: 'lamp', x: B.x, y: B.y, r: 0.5 }); }
    if (v.def.mg && v.mg) { const p = v.local(v.dir * v.def.mg.pivot[0], v.def.mg.pivot[1]); out.push({ id: 'mg', x: p.x, y: p.y + 0.1, r: 0.45 }); }
    return out;
  },
  barrel(v) { if (v.turretGone || v.heli || !v.def.gun || !v.g.trunnion) return null; const tp = v.local(v.g.trunnion.x, v.g.trunnion.y), m = v.muzzle(); return { ax: tp.x, ay: tp.y, bx: m.x, by: m.y }; },
  // the gun tube in the path of segment (x0,y0)→(x1,y1)? (within the tube's radius; t along the segment)
  barrelHit(v, x0, y0, x1, y1) {
    const B = this.barrel(v); if (!B) return null;
    const dx = x1 - x0, dy = y1 - y0, ex = B.bx - B.ax, ey = B.by - B.ay, den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) return null;
    const t = ((B.ax - x0) * ey - (B.ay - y0) * ex) / den, q = ((B.ax - x0) * dy - (B.ay - y0) * dx) / den;
    if (t < 0 || t > 1 || q < 0.25 || q > 1) return null;                // (the part out in front of the mantlet)
    return { t, x: x0 + dx * t, y: y0 + dy * t };
  },
  // One layer of armour struck along a path (H2, H3): obliquity (with a little yaw on the first plate), long-rod
  // overmatch and normalisation, line-of-sight thickness, the material, and reactive tiles (stronger at a steep
  // angle; a tile that has gone off is gone). inner: a plate met inside the vehicle (no yaw, either face).
  layer(A, pl, dx, dy, rnd, v, hx, hy, inner) {
    const P = pl.P, cosV = Math.max(0, Math.abs(dx * pl.nx + dy * pl.ny));
    const yaw = inner ? 0 : Math.abs(rnd() + rnd() + rnd() - 1.5) * 9;                       // deg, ~0–13
    const hAng = Math.abs(P.h + (rnd() < 0.5 ? -yaw : yaw)) * Math.PI / 180;
    const cosT = Math.max(0.03, cosV * Math.cos(hAng)), obl = Math.acos(cosT) * 180 / Math.PI;
    const ke = !A.pen.ce, heat = !!A.pen.ce, rod = A.d * 1000;
    // overmatch: a rod much thicker than the plate turns into it and goes through (no ricochet); otherwise a
    // kinetic round turns a few degrees toward the normal (more for full-calibre shot than for a long rod)
    const over = ke && P.t < rod * 1.5 ? P.t / rod : null;
    let oblE = obl;
    if (ke) oblE = over != null ? obl * (0.4 + 0.4 * over / 1.5) : Math.max(0, obl - ({ APFSDS: 2, APDS: 4, APHE: 7 }[A.type] || 3));
    const cosE = Math.max(0.05, Math.cos(oblE * Math.PI / 180)), los = P.t / cosE, M = DS.MATERIALS[P.mat];
    let era = 0;
    if (P.era && !inner) {
      const lp = v.toLocal(hx, hy), key = P.name + '|' + Math.round(lp.x / 0.6) + '|' + Math.round(lp.y / 0.6), used = v.eraUsed || (v.eraUsed = new Set());
      if (!used.has(key)) { era = P.era * (heat ? 1 : 0.06) * (0.55 + 0.6 * Math.sin(obl * Math.PI / 180)); used.add(key); }
    }
    return { obl, oblE, los, prot: los * (heat ? M.ce : M.ke) + era, over: over != null, era };
  },
  // the plates further along a path inside the vehicle (H1): [{ pl, d (m from the entry), front, x, y }]
  inner(v, x0, y0, dx, dy, first) {
    const out = [], x1 = x0 + dx * 9, y1 = y0 + dy * 9;
    for (const pl of this.plates(v)) {
      if (pl === first) continue;
      const ex = pl.bx - pl.ax, ey = pl.by - pl.ay, den = (x1 - x0) * ey - (y1 - y0) * ex; if (Math.abs(den) < 1e-12) continue;
      const t = ((pl.ax - x0) * ey - (pl.ay - y0) * ex) / den, q = ((pl.ax - x0) * (y1 - y0) - (pl.ay - y0) * (x1 - x0)) / den;
      if (t <= 0.004 || t > 1 || q < 0 || q > 1) continue;
      out.push({ pl, d: t * 9, front: pl.nx * dx + pl.ny * dy < 0, x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
    }
    return out.sort((a, b) => a.d - b.d);
  },

  // Resolve a projectile striking plate pl. Returns a result object (also used for the hit log).
  resolve(world, proj, hit) {
    const A = proj.ammo, pl = hit.pl, P = pl.P, v = hit.v;
    const sp = Math.hypot(proj.vx, proj.vy), dx = proj.vx / sp, dy = proj.vy / sp;
    const rnd = world.rng, heat = !!A.pen.ce && !A.pen.hesh;
    const L1 = this.layer(A, pl, dx, dy, rnd, v, hit.x, hit.y, false);
    const pen = this.penetration(A, sp);
    const range = Math.abs(hit.x - proj.x0);
    const r = { plateLocal: P, vehicle: v, plate: P.name, part: P.part, ammo: A, range, speed: sp, obl: L1.obl, los: L1.los, prot: L1.prot, pen, x: hit.x, y: hit.y, effects: [], layers: [] };
    if (L1.over) r.over = true; if (L1.era) r.era = Math.round(L1.era);

    if (v.def.proofD && A.small && A.d <= v.def.proofD) { r.result = 'nonpen'; return r; }     // armoured aircraft: small arms do nothing
    // protection that depends on the side hit (AH-1W): from ahead, rounds up to `front` calibre do nothing and up
    // to `frontPart` get through half the time; from behind or below, up to `rearPart` get through half the time
    const PR = v.def.proof;
    if (PR && A.small) {
      const ahead = dx * v.dir < -0.3;
      if (ahead && A.d <= PR.front) { r.result = 'nonpen'; return r; }
      if ((ahead ? A.d <= PR.frontPart : A.d <= PR.rearPart) && rnd() < 0.5) { r.result = 'nonpen'; return r; }
    }
    // ricochet / fuze graze (an overmatching rod does not skid off)
    const pr = L1.over ? 0 : Math.max(0, Math.min(1, (L1.obl - (A.crit - 5)) / 10));
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
      r.result = pen > L1.prot ? 'track' : 'nonpen';
      if (pen > L1.prot && v.alive && rnd() < 0.75) { v.damage('track', { x: hit.x, y: hit.y }); r.effects.push('궤도 절단 → 기동 불능'); }
      return r;
    }
    // H4 HESH: the squashed charge does not go through; it blows a scab off the inside of plate that is thin
    // enough for its calibre (the true thickness counts, not the slope), and composite or spaced armour and very
    // steep faces break it up
    if (A.pen.hesh) {
      const M = DS.MATERIALS[P.mat], cal = A.d * 1000, mult = M.ce > 1.1 ? 2.2 : M.ke < 0.8 ? 1.6 : 1;
      const eff = P.t * mult * (L1.obl > 65 ? 1.6 : 1), lim = 1.3 * cal;
      r.prot = eff; r.pen = lim; r.los = P.t; r.hesh = true;
      if (eff > lim) { r.result = 'nonpen'; r.effects.push('점착유탄 — 장갑이 두꺼워 박리 없음'); return r; }
      r.result = 'pen'; r.scab = true; r.resid = lim - eff;
      v.addScorch(hit.x, hit.y, 0.9);
      r.layers.push({ name: P.name, prot: Math.round(eff), pen: Math.round(lim) });
      this.spall(v, hit.x, hit.y, dx, dy, Math.min(2.2, 1 + (lim - eff) / 120), 38 * Math.PI / 180, 0.42, r, rnd, false);
      r.effects.unshift('내부 박리(스캡)');
      return r;
    }
    if (pen < L1.prot) { r.result = 'nonpen'; return r; }

    r.result = 'pen';
    let rem = pen - L1.prot;
    r.layers.push({ name: P.name, prot: Math.round(L1.prot), pen: Math.round(pen) });
    // char spreads from the entry hole; flame and debris blow back out of it for a moment
    v.addScorch(hit.x, hit.y, heat ? 1.0 : 0.8);
    const hl = v.toLocal(hit.x, hit.y);
    v.holes.push({ lx: hl.x, ly: hl.y, nx: pl.nx, ny: pl.ny, t: heat ? 1.4 : 0.9, part: hl.y > v.g.ring.y - 0.05 ? 'turret' : 'hull' });
    // H1: on through the vehicle — another plate inside (the hull roof under the turret, a far wall) takes what is
    // left; a jet loses itself fast over an air gap (H3), a rod a little to what it passes through; enough left
    // and it leaves by the far side (a rod then flies on)
    const segs = [{ x: hit.x, y: hit.y, d0: 0 }]; let prevD = 0, stopD = Infinity;
    for (const q of this.inner(v, hit.x, hit.y, dx, dy, pl)) {
      if (q.pl.P.track) continue;
      const gap = q.d - prevD; rem *= heat ? Math.max(0.3, 1 - 0.32 * gap) : Math.pow(0.97, gap); prevD = q.d;
      const Lq = this.layer(A, q.pl, dx, dy, rnd, v, q.x, q.y, true);
      if (rem < Lq.prot) { stopD = q.d; r.layers.push({ name: q.pl.P.name, prot: Math.round(Lq.prot), pen: Math.round(rem), stop: true }); break; }
      rem -= Lq.prot; r.layers.push({ name: q.pl.P.name, prot: Math.round(Lq.prot), pen: Math.round(rem + Lq.prot), exit: !q.front });
      if (!q.front) { if (!heat) r.exit = { x: q.x + dx * 0.15, y: q.y + dy * 0.15, keep: Math.max(0.2, rem / pen) }; stopD = q.d; break; }
      segs.push({ x: q.x, y: q.y, d0: q.d });
    }
    r.resid = Math.round(rem);
    // behind-armour debris / jet (H6) from the entry, and again from each further plate it got through
    const len0 = (heat ? Math.min(3.5, 1.2 + (pen - L1.prot) / 250) : Math.min(4.5, 0.9 + (pen - L1.prot) / 120)) * (v.def.thin || 1);
    const half = (heat ? 8 : 20) * Math.PI / 180, pk = heat ? 0.55 : 0.45;
    segs.forEach((g, k) => {
      const lim = Math.max(0.3, Math.min(len0 - g.d0 * 0.5, stopD - g.d0));
      this.spall(v, g.x, g.y, dx, dy, lim, k ? half * 0.8 : half, pk * (k ? 0.8 : 1), r, rnd, heat);
    });
    if (r.exit) r.effects.push('관통 후 반대편 이탈');
    if (!r.effects.length) r.effects.push('파편 피해 경미');
    return r;
  },
  // H6 behind-armour effects: a cone of fragment rays; each ray loses energy with distance and is often stopped
  // by the first thing it meets (equipment shields what is behind it). The energy a module collects decides what
  // happens to it: crew wounded, badly wounded (out of action) or killed; other modules damaged by chance.
  spall(v, x0, y0, dx, dy, len, half, pk, r, rnd, heat) {
    const n = 13, c = Math.cos(v.ang), s = Math.sin(v.ang), E = new Map(), mods = [];
    for (const m of v.def.modules) {
      if (v.modState[m.id] && m.type === 'crew') continue;
      if (v.turretGone && m.p[1] > 0.2) continue;
      const lx = m.p[0] * v.dir, ly = m.p[1]; mods.push([m, v.pos.x + c * lx - s * ly, v.pos.y + s * lx + c * ly]);
    }
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dy, dx) + (i / (n - 1) - 0.5) * 2 * half, ux = Math.cos(a), uy = Math.sin(a), on = [];
      for (const [m, mx, my] of mods) {
        const ox = mx - x0, oy = my - y0, along = ox * ux + oy * uy;
        if (along < 0 || along > len) continue;
        if (Math.hypot(ox - ux * along, oy - uy * along) < m.r) on.push([along, m]);
      }
      on.sort((p, q) => p[0] - q[0]);
      for (const [along, m] of on) {
        E.set(m, (E.get(m) || 0) + (1 - 0.65 * along / len) * (heat ? 1.15 : 1));
        if (rnd() < 0.45) break;                                   // stopped by what it hit
      }
    }
    const R = r.mods || (r.mods = []); r.spallLen = Math.max(r.spallLen || 0, len); r.spallHalf = half;
    for (const [m, e] of E) {
      if (!R.includes(m.id)) R.push(m.id);
      if (m.type === 'crew') {
        const g = e * (0.75 + 0.5 * rnd());
        if (g >= 2.4) r.effects.push(v.damage(m.id));
        else if (g >= 1.3) r.effects.push(v.damage(m.id, null, 'crit'));
        else if (g >= 0.5) r.effects.push(v.wound(m.id));
      } else if (rnd() < 1 - Math.pow(1 - pk, e * 1.3)) r.effects.push(v.damage(m.id, null, Math.min(1, e / 1.5)));
    }
  },
};
