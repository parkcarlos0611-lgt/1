// Calibrates the 155 mm shells: finds the drag scale that gives the M107 its 18.1 km at charge 8 and the rocket
// thrust that takes the M549A1 to 23.5 km (same integrator as the game). usage: node tools/artybench.js
global.window = global; global.DS = {};
for (const f of ['src/core/Tuning.js', 'data/ammo/ammo.js', 'src/ballistics/Projectile.js']) require('vm').runInThisContext(require('fs').readFileSync(__dirname + '/../' + f, 'utf8'));
const flat = { height: () => 0, n: 1e9, dx: 1 };
const range = (A, v0, deg) => { const a = deg * Math.PI / 180, p = new DS.Projectile(0, 2, Math.cos(a) * v0, Math.sin(a) * v0, A, null); while (p.alive) p.step(1 / 30, flat); return [p.x, p.t]; };
const best = (A, v0) => { let b = [0, 0, 0]; for (let d = 25; d <= 60; d += 1) { const [r, t] = range(A, v0, d); if (r > b[0]) b = [r, d, t]; } return b; };
const base = [[0, 0.20], [0.8, 0.21], [0.95, 0.30], [1.05, 0.42], [1.3, 0.40], [2, 0.33], [3, 0.28]];   // shape; the scale found below is what data/ammo/ammo.js carries
const mk = (k, rocket) => ({ ...DS.AMMO.M107, cd: base.map(([m, c]) => [m, c * k]), rocket });
let lo = 0.3, hi = 2;
for (let i = 0; i < 30; i++) { const k = (lo + hi) / 2; if (best(mk(k), 684)[0] > 18100) lo = k; else hi = k; }
const k = (lo + hi) / 2; console.log('drag scale', k.toFixed(3), 'cd', JSON.stringify(base.map(([m, c]) => [m, +(c * k).toFixed(3)])), best(mk(k), 684));
let a0 = 0, a1 = 200;
for (let i = 0; i < 30; i++) { const a = (a0 + a1) / 2; if (best(mk(k, { at: 7, burn: 3, acc: a }), 684)[0] > 23500) a1 = a; else a0 = a; }
console.log('rocket acc', ((a0 + a1) / 2).toFixed(1), best(mk(k, { at: 7, burn: 3, acc: (a0 + a1) / 2 }), 684));
for (const v0 of [210, 235, 275, 315, 375, 465, 565, 684]) { const b = best(mk(k), v0); console.log('v0', v0, 'max', Math.round(b[0]), 'm at', b[1], 'deg,', b[2].toFixed(0), 's; 10 deg:', Math.round(range(mk(k), v0, 10)[0]), ' 65 deg:', Math.round(range(mk(k), v0, 65)[0])); }
