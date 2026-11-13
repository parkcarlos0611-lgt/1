// Ballistic table: flight time, remaining velocity and drop vs range for each ammo (flat-fire, no gravity drop correction).
// usage: node tools/balbench.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { window: {}, Math, console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['src/core/Tuning.js', 'data/ammo/ammo.js', 'src/ballistics/Projectile.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
vm.runInContext(`
const flat = { height: () => -1e9, n: 1e9, dx: 1 };
for (const k in DS.AMMO) {
  const A = DS.AMMO[k], p = new DS.Projectile(0, 0, A.v0, 0, A, null), rows = [];
  let next = 500;
  while (p.alive && next <= 4000) { p.step(1 / 2000, flat); if (p.x >= next) { rows.push([next, p.t.toFixed(3) + ' s', Math.round(Math.hypot(p.vx, p.vy)) + ' m/s', (-p.y).toFixed(2) + ' m drop']); next += 500; } }
  console.log(A.name); for (const r of rows) console.log('  ' + r.join('  '));
}`, ctx);
