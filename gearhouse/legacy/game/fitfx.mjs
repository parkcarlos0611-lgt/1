// Part-fitting effect: a part is taken off and the new one is fitted to the car (designer part swaps, assembly trim stage).
// Works on three renders of the same size: bare (car without that part), old (with the old part), new (with the new part).
// The part pixels are whatever differs from the bare render, so any part (grille, lamps, bumpers, ornament, wheels) works.
export const FIT_LEN = 52;
const colOf = (P, px, i) => { const ramp = P.ramps[px.r[i]], lv = px.l[i]; return lv < 0 ? ramp.o : ramp.c[Math.max(0, Math.min(ramp.c.length - 1, lv))]; };
export function partMask(a, b) {
  const m = new Uint8Array(a.w * a.h); let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  if (!b || b.w !== a.w || b.h !== a.h) return null;
  for (let i = 0; i < m.length; i++) if (a.r[i] && (a.r[i] !== b.r[i] || a.l[i] !== b.l[i])) { m[i] = 1; n++; const x = i % a.w, y = (i / a.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { m, n, bb: { x0, y0, x1, y1 } };
}
const WHITE = [255, 250, 232];
function blit(S, P, px, mask, ox, oy, s, dx = 0, dy = 0, a = 1) {
  const sh = P.byName.shadow;
  for (let i = 0; i < px.r.length; i++) { if (!px.r[i] || (mask && !mask[i])) continue; const x = i % px.w, y = (i / px.w) | 0, c = colOf(P, px, i), al = px.r[i] === sh ? 0.28 * a : a;
    for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) { const X = ox + x * s + xx + dx, Y = oy + y * s + yy + dy; if (al >= 1) S.fill(X, Y, 1, 1, c); else S.blend(X, Y, c, al); } }
}
// fx = { bare, old, now }; F = frames since the swap. returns false when finished (caller draws the plain sprite)
export function drawFit(S, P, fx, ox, oy, s, F, sfx = () => {}) {
  if (!fx.mn) { fx.mn = partMask(fx.now, fx.bare); fx.mo = fx.old ? partMask(fx.old, fx.bare) : null; }
  if (!fx.mn || F >= FIT_LEN) return false;
  const ease = u => 1 - (1 - u) * (1 - u) * (1 - u), done = fx.sfxDone || (fx.sfxDone = new Set()), once = (k, c, snd) => { if (c && !done.has(k)) { done.add(k); sfx(snd); } };   // sounds fire once even when frames are skipped
  if (F < 10) {                                                                       // old part comes off and drops away
    blit(S, P, fx.bare, null, ox, oy, s); if (fx.mo && fx.mo.n) blit(S, P, fx.old, fx.mo.m, ox, oy, s, 0, Math.round((F / 10) * (F / 10) * 12) * s, 1 - F / 11);
    once('off', F >= 1 && fx.mo && fx.mo.n, 'clunk'); return true; }
  if (F < 26) {                                                                       // new part lowered onto its mounting points, small settle
    const u = (F - 10) / 16, dy = -Math.round((1 - ease(u)) * 16) + (F === 24 ? 1 : 0);
    blit(S, P, fx.bare, null, ox, oy, s); blit(S, P, fx.now, fx.mn.m, ox, oy, s, 0, dy * s);
    once('seat', F >= 24, fx.small ? 'click' : 'thud'); return true; }
  blit(S, P, fx.now, null, ox, oy, s);
  const { x0, y0, x1, y1 } = fx.mn.bb;
  if (F < 38) {                                                                       // bolts tightened: sparkle at the mounting points in turn
    const pts = [[x0 + 1, y1 - 1], [x1 - 1, y1 - 1], [(x0 + x1) >> 1, (y0 + y1) >> 1]], k = Math.floor((F - 26) / 4) % 3, [bx, by] = pts[k];
    if ((F - 26) % 4 < 3) { const X = ox + bx * s, Y = oy + by * s; S.fill(X - s, Y, 3 * s, s, WHITE); S.fill(X, Y - s, s, 3 * s, WHITE); }
    once('r1', F >= 27, 'ratchet'); once('r2', F >= 31, 'ratchet'); once('r3', F >= 35, 'ratchet'); return true; }
  const band = ((F - 38) / (FIT_LEN - 38)) * (x1 - x0 + y1 - y0 + 4) - 2;             // light sweeps across the new chrome
  for (let i = 0; i < fx.mn.m.length; i++) if (fx.mn.m[i]) { const x = i % fx.now.w, y = (i / fx.now.w) | 0, d = Math.abs((x - x0) + (y - y0) - band);
    if (d < 1.6) for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) S.blend(ox + x * s + xx, oy + y * s + yy, WHITE, d < 0.8 ? 0.75 : 0.4); }
  once('glint', F >= 39, 'click'); return true;
}
