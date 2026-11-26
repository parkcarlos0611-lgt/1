// Floating-part detector + auto-bracket. Every visible component must connect to the main body.
// 1) label 8-connected components (shadow ignored)  2) main = component holding most body pixels
// 3) wheel components count as supported (axle)     4) others: find the shortest support path, preferring straight down,
//    then straight back/forward, then nearest pixel; draw an iron bracket; record it for validation.
export function anchorFloating(px, P, { bodyTags = [4], wheelTags = [3], shadowTag = 1, bracketTag = 14, maxDist = 60 } = {}) {
  const W = px.w, H = px.h, lab = new Int32Array(W * H).fill(-1), comps = [];
  const solid = i => px.r[i] && px.t[i] !== shadowTag;
  for (let i = 0; i < W * H; i++) { if (!solid(i) || lab[i] >= 0) continue;
    const id = comps.length, st = [i], cells = []; lab[i] = id; let body = 0, wheel = 0;
    while (st.length) { const k = st.pop(); cells.push(k); if (bodyTags.includes(px.t[k])) body++; if (wheelTags.includes(px.t[k])) wheel++;
      const x = k % W, y = (k / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (lab[j] < 0 && solid(j)) { lab[j] = id; st.push(j); } } }
    comps.push({ id, cells, body, wheel }); }
  if (!comps.length) return [];
  const main = comps.reduce((a, c) => (c.body > a.body || (c.body === a.body && c.cells.length > a.cells.length) ? c : a));
  const supported = new Set([main.id]); comps.forEach(c => { if (c.wheel > c.cells.length * 0.5) supported.add(c.id); });
  const log = [], iron = P.id('black');
  // iterate: a component may become supported through another one
  for (let pass = 0; pass < 4; pass++) for (const c of comps) { if (supported.has(c.id)) continue;
    let best = null;
    for (const k of c.cells) { const x = k % W, y = (k / W) | 0;
      for (const [dx, dy, pen] of [[0, 1, 0], [1, 0, 6], [-1, 0, 6], [0, -1, 10]]) { for (let s = 1; s <= maxDist; s++) { const xx = x + dx * s, yy = y + dy * s; if (xx < 0 || yy < 0 || xx >= W || yy >= H) break; const j = yy * W + xx;
        if (solid(j)) { if (lab[j] !== c.id && supported.has(lab[j]) && (!best || s + pen < best.cost)) best = { cost: s + pen, x, y, dx, dy, s }; if (lab[j] !== c.id) break; if (lab[j] === c.id) break; } } } }
    if (!best) continue;
    const th = c.cells.length > 40 ? 2 : 1;
    for (let s = 1; s < best.s; s++) for (let t = 0; t < th; t++) { const xx = best.x + best.dx * s + (best.dy ? t : 0), yy = best.y + best.dy * s + (best.dx ? t : 0); if (xx >= 0 && yy >= 0 && xx < W && yy < H && !solid(yy * W + xx)) px.set(xx, yy, iron, t ? 0 : 1, bracketTag); }
    supported.add(c.id); const xs = c.cells.map(k => k % W), ys = c.cells.map(k => (k / W) | 0);
    log.push({ size: c.cells.length, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], bracket: best.s - 1, dir: best.dy ? (best.dy > 0 ? 'down' : 'up') : 'side' }); }
  const left = comps.filter(c => !supported.has(c.id)).map(c => c.cells.length);
  px.anchorLog = { brackets: log, unresolved: left };
  return log;
}
