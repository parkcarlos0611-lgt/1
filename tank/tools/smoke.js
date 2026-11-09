// Playwright smoke test: loads the game, checks rest state, drives, fires, screenshots.
// usage: node tools/smoke.js [outdir]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  await p.waitForFunction(() => window.__game && __game.player, null, { timeout: 10000 });
  await p.waitForTimeout(2500);
  const st = () => p.evaluate(() => { const v = __game.player; return {
    x: +v.pos.x.toFixed(2), y: +v.pos.y.toFixed(3), ang: +(v.ang * 57.3).toFixed(2), spd: +v.speedKmh().toFixed(1), vt: +v.vt.toFixed(2),
    d: v.st.map(s => +s.d.toFixed(3)), N: v.st.map(s => Math.round(s.N / 1000)), sink: +(v.stats.sink * 100).toFixed(1), s: +v.s.toFixed(2), fps: Math.round(__game.fps) }; });
  const log = [];
  log.push(['rest', await st()]);
  await p.screenshot({ path: out + '/rest.png' });
  await p.keyboard.down('KeyD'); await p.waitForTimeout(4000);
  log.push(['drive 4s', await st()]);
  await p.screenshot({ path: out + '/drive.png' });
  await p.waitForTimeout(8000);
  log.push(['drive 12s', await st()]);
  await p.keyboard.up('KeyD'); await p.waitForTimeout(3000);
  log.push(['brake 3s', await st()]);
  await p.keyboard.press('Digit1'); await p.waitForTimeout(1200);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(400); await p.keyboard.up('KeyW');
  await p.keyboard.down('Space'); await p.waitForTimeout(60); await p.keyboard.up('Space');
  await p.waitForTimeout(70); await p.screenshot({ path: out + '/fire.png' });
  await p.waitForTimeout(500); await p.screenshot({ path: out + '/fire2.png' });
  await p.waitForTimeout(4000);
  log.push(['after fire', await st()]);
  log.push(['hit', await p.evaluate(() => __game.world.hits.map(h => ({ r: Math.round(h.range), t: +h.t.toFixed(2), v: Math.round(Math.hypot(h.vx, h.vy)) })))]);
  await p.keyboard.press('KeyA'); await p.keyboard.down('KeyA'); await p.waitForTimeout(3000); await p.keyboard.up('KeyA');
  log.push(['reverse 3s', await st()]);
  await p.keyboard.press('F9'); await p.waitForTimeout(300); await p.screenshot({ path: out + '/debug.png' });
  for (const [k, v] of log) console.log(k.padEnd(12), JSON.stringify(v));
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
  await b.close();
  process.exit(errs.length ? 1 : 0);
})();
