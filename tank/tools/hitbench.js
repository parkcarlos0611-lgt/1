// First-round hit probability of the enemy AI lay against a stationary M1A1 on flat ground, using the game's
// own vehicle, ballistics, fire-control solver and armour plates. Same error model as src/ai/TankAI.js.
// usage: node tools/hitbench.js [shots per cell]
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { window: {}, Math, console, document: undefined }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['src/core/Tuning.js', 'data/ammo/ammo.js', 'data/vehicles/m1a1.js', 'data/vehicles/t55.js', 'data/vehicles/t62.js',
  'data/vehicles/t72.js', 'src/world/Terrain.js', 'src/vehicle/Track.js', 'src/vehicle/Vehicle.js', 'src/ballistics/Projectile.js',
  'src/ballistics/Armor.js', 'src/vehicle/FireControl.js', 'src/ai/TankAI.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
ctx.N = +(process.argv[2] || 300);
vm.runInContext(`
DS.Armor.calibrate();
const T = new DS.Terrain(7); T.h.fill(10); T.sink.fill(0);
const rng = DS.rng(42), out = [];
for (const id of ['t72', 't62', 't55']) {
  const row = [DS.VEHICLES[id].name.padEnd(7)];
  for (const R of [500, 1000, 1500, 2000]) {
    const tgt = new DS.Vehicle(DS.VEHICLES.m1a1, 100, T, { dir: 1 });
    const sh = new DS.Vehicle(DS.VEHICLES[id], 100 + R, T, { dir: -1 });
    const world = { vehicles: [tgt, sh], terrain: T };
    const S = sh.def.sight, A = DS.AMMO[sh.def.ammo[0]];
    let hits = 0;
    for (let n = 0; n < N; n++) {
      const range = Math.hypot(tgt.pos.x - sh.pos.x, tgt.pos.y - sh.pos.y);
      const est = range * (1 + DS.AI.gauss(rng) * S.rangeErr);
      const o = sh.sightOrigin(), t = tgt.local(tgt.g.ring.x, tgt.g.ring.y + 0.1), d = Math.hypot(t.x - o.x, t.y - o.y);
      const sol = DS.FireControl.solve(sh, sh.def.ammo[0], o.x + (t.x - o.x) / d * est, o.y + (t.y - o.y) / d * est);
      const ang = sol + DS.AI.gauss(rng) * S.aimErr / 1000 * (1 + Math.pow(range / 800, 2));
      const m = sh.muzzle(), L = Math.hypot(m.x - sh.local(sh.g.trunnion.x, sh.g.trunnion.y).x, m.y - sh.local(sh.g.trunnion.x, sh.g.trunnion.y).y);
      const tp = sh.local(sh.g.trunnion.x, sh.g.trunnion.y);
      const p = new DS.Projectile(tp.x + Math.cos(ang) * L, tp.y + Math.sin(ang) * L, Math.cos(ang) * A.v0, Math.sin(ang) * A.v0, A, sh);
      let h = null; while (p.alive && !h) h = p.step(1 / 480, T, world);
      if (h && h.kind === 'armor') hits++;
    }
    row.push((R + ' m').padStart(7) + ' ' + String(Math.round(hits / N * 100)).padStart(3) + ' %');
  }
  out.push(row.join('  '));
}
console.log('첫 발 명중률 (정지한 M1A1, 평지, ' + N + '발씩)'); console.log(out.join('\\n'));
`, ctx);
