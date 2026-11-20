// Prototype B (reviews 33, 34): rust repair by hand in the garage, seen close up. The 1929 sedan's side, drawn from its
// 3D part model at 5 mm a pixel, carries rust on its lower panels; the view shows a part of it and pans with the arrows
// at the screen's edges (or the keyboard), "전체" shows the whole car. Every painted pixel keeps layers: the old paint
// (worn through slowly, scratch by scratch, then the undercoat, then bare steel), rust, pits under the rust, lead filled
// in (flux and lead, as in the period), masking tape, and new paint (colour and thickness). The tools are drawn at the
// pointer with their shadow on the car.
import type { App, Scene } from '../shell/app';
import { split, COL, rnd, mix, type Rect } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { viewDesign, type CarModel } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import model from '../../data/cars/sedan29.json';

type Tool = 'brush' | 'lead' | 'tape' | 'spray';
const TOOLS: { id: Tool; name: string; tip: string }[] = [
  { id: 'brush', name: '철수세미', tip: '문지르면 칠에 긁힌 줄이 생기고, 밑칠, 맨 철판, 녹 순서로 벗겨진다' },
  { id: 'lead', name: '납 메움', tip: '맨 철판에 플럭스와 납. 파인 곳부터 찬다. 많으면 솟는다 (철수세미로 깎는다)' },
  { id: 'tape', name: '마스킹', tip: '누른 채 밀면 테이프가 곧게 풀린다 (가로나 세로로)' },
  { id: 'spray', name: '스프레이', tip: '누르고 움직여 칠한다. 넓게 퍼지고, 한곳에 오래 두면 흘러내린다' } ];
const COLOURS: { name: string; rgb: RGB | null }[] = [{ name: '원래 색', rgb: null }, { name: '검정', rgb: hex('#202024') }, { name: '적갈색', rgb: hex('#6a2a22') }, { name: '크림', rgb: hex('#d8c8a0') }];
const lum = (c: RGB) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const RUST = [hex('#b0602a'), hex('#8a4a22'), hex('#6a3418'), hex('#4a2410')], STEEL = [hex('#c4c8cc'), hex('#a0a6ac'), hex('#7a8086')], LEAD = [hex('#a8acb0'), hex('#8a8e94'), hex('#6e7278')];
const UNDER = hex('#7c5e4a');                                              // the red-oxide undercoat under the colour
const TAPE = [hex('#e4d6aa'), hex('#cdbd8c'), hex('#b8a676')];
const MM = 5, VIEW: Rect = { x: 0, y: 24, w: 480, h: 202 };

export function bodyworkScene(app: App): Scene {
  const ui = app.ui, S = app.S, base = model as unknown as CarModel, d = viewDesign(base, 'left'), im = rasterizeFlat(d, { mm: MM }), w = im.w, h = im.h, N = w * h;
  // what each pixel is: 1 paint, 2 glass / chrome / lamp glass, 3 tyre and other black parts, 4 wheel (spokes, rim, hub)
  const kind = new Uint8Array(N), orig: RGB[] = new Array(N), tone = new Float32Array(N);
  const wheels = d.wheels.map(q => ({ cx: im.X(q.x), cy: im.Y(q.z ?? q.r), r: q.r / MM, rim: (q.rim ?? 0.62) * q.r / MM }));
  for (let i = 0; i < N; i++) { orig[i] = [im.rgba[i * 4]!, im.rgba[i * 4 + 1]!, im.rgba[i * 4 + 2]!]; if (im.rgba[i * 4 + 3]! < 128) continue; const o = im.owner[i]!, m = o >= 0 ? d.panels[o]?.material : undefined, x = i % w, y = (i / w) | 0;
    kind[i] = m === 'paint' || m === 'paint2' ? 1 : m === 'glass' || m === 'chrome' || m === 'lensR' || m === 'white' ? 2 : 3;
    if (kind[i] === 3 && o < 0) for (const q of wheels) { const dd = Math.hypot(x - q.cx, y - q.cy); if (dd < q.rim + 1) kind[i] = 4; }
    if (kind[i] === 1) tone[i] = lum(orig[i]!) / Math.max(8, lum(hex(m === 'paint2' ? base.paint2 ?? base.paint : base.paint))); }
  // layers
  const rust0 = new Float32Array(N), rust = new Float32Array(N), pit = new Float32Array(N), wear = new Float32Array(N), fill = new Float32Array(N), weak = new Uint8Array(N);
  const paint = new Float32Array(N), pcol = new Int8Array(N).fill(-1), tape = new Uint8Array(N), over = new Float32Array(N), scratch = new Float32Array(N);
  const bare = (i: number) => wear[i]! >= 1;
  const vn = (x: number, y: number, s: number) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), r = (a: number, b: number) => rnd(((a * 73856093) ^ (b * 19349663) ^ (s * 83492791)) >>> 0);
    return (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) + (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v; };
  // rust: patches on the lower panels (sills, fender skirts, door bottoms), each a noisy blob
  const low: number[] = []; for (let i = 0; i < N; i++) if (kind[i] === 1 && (i / w | 0) > im.groundY - 124) low.push(i);
  let rx = 0, ry = 0, rn = 0;
  for (let k = 0; k < 6; k++) { const c = low[Math.floor(rnd(k * 977 + 13) * low.length)]!, cx = c % w, cy = (c / w) | 0, r = 12 + rnd(k * 31) * 18;
    for (let y = cy - 36; y <= cy + 36; y++) for (let x = cx - 44; x <= cx + 44; x++) { if (x < 0 || y < 0 || x >= w || y >= h) continue; const i = y * w + x; if (kind[i] !== 1) continue;
      const dd = Math.hypot((x - cx) / 1.4, y - cy) / r, n = vn(x / 6, y / 6, k) * 0.6 + vn(x / 2.4, y / 2.4, k + 9) * 0.4, v = Math.max(0, 1 - dd + (n - 0.5) * 0.9);
      if (v > 0.05) { rust0[i] = rust[i] = Math.min(1, Math.max(rust0[i]!, v * (0.6 + n * 0.6))); rx += x; ry += y; rn++; } } }
  // the view
  const cam = { x: Math.round(rx / Math.max(1, rn) - VIEW.w / 2), y: Math.round(ry / Math.max(1, rn) - VIEW.h / 2) }; let whole = false;
  const clampCam = () => { cam.x = Math.round(Math.max(-40, Math.min(w - VIEW.w + 40, cam.x))); cam.y = Math.round(Math.max(-40, Math.min(h - VIEW.h + 30, cam.y))); }; clampCam();
  const camF = { x: cam.x, y: cam.y };
  // the work
  let tool: Tool = 'brush', colour = 0, last: { x: number; y: number } | null = null, dirLast = { x: 1, y: 0 }, minutes = 0, report: string[] | null = null, verdict = '';
  let tapeRun: { x: number; y: number; axis: '' | 'h' | 'v'; at: number } | null = null;
  const R = (t: Tool) => (t === 'spray' ? 16 : t === 'tape' ? 3 : 6);
  /** the paint a fresh coat gives: the chosen colour, or the car's own colour mixed again (never quite the same: a few per cent off) */
  const fresh = (i: number, c: number): RGB => { const cc = COLOURS[c]?.rgb; if (cc) return mix(hex('#000000'), cc, Math.min(1.25, tone[i]!)); const o = orig[i]!; return [Math.min(255, o[0] * 1.045), Math.min(255, o[1] * 1.035), Math.min(255, o[2] * 1.01)]; };
  function dab(cx: number, cy: number, dt: number, dir: { x: number; y: number }) {
    const r = R(tool); let touched = 0;
    for (let y = Math.floor(cy - r - 6); y <= cy + r + 6; y++) for (let x = Math.floor(cx - r - 6); x <= cx + r + 6; x++) { if (x < 0 || y < 0 || x >= w || y >= h) continue; const i = y * w + x, dd = Math.hypot(x - cx, y - cy); if (!kind[i]) continue;
      if (tool === 'brush') { if (dd > r + 0.5) continue;
        // steel wool: its strands cut lines along the stroke; only the pixels under a strand are cut this pass
        const across = -dir.y * x + dir.x * y, strand = rnd((Math.floor(across * 0.8) * 7919 + 17) >>> 0) < 0.55; if (!strand) continue;
        const s = 0.022 * (1 - dd / (r + 1));                                   // many dabs reach a pixel in one stroke: about eight strokes to bare steel
        if (kind[i] === 2 || kind[i] === 4) { scratch[i] = Math.min(1, scratch[i]! + s * 3); continue; } if (kind[i] !== 1 || tape[i]) continue; touched++;
        if (paint[i]! > 0) { paint[i] = Math.max(0, paint[i]! - s * 3); if (paint[i] === 0) pcol[i] = -1; continue; }
        if (fill[i]! > pit[i]!) { fill[i] = Math.max(pit[i]!, fill[i]! - s * 1.2); continue; }
        if (!bare(i)) { wear[i] = Math.min(1, wear[i]! + s * (rust[i]! > 0.3 ? 2 : 1)); continue; }               // rusty paint flakes off sooner
        if (rust[i]! > 0) { const took = Math.min(rust[i]!, s * 0.9); rust[i] = rust[i]! - took; pit[i] = pit[i]! + took * 0.55; if (rust[i]! < 0.02) rust[i] = 0; } }
      else if (tool === 'lead') { if (dd > r + 0.5 || kind[i] !== 1 || tape[i] || !bare(i) || paint[i]! > 0) continue; touched++; const s = 0.06 * (1 - dd / (r + 1));
        fill[i] = fill[i]! + (fill[i]! < pit[i]! ? s * 1.6 : s * 0.5); if (rust[i]! > 0.08) weak[i] = 1; }
      else if (tool === 'spray') { // a cone: thick in the middle, a fine mist of droplets round it
        let s = dt * 5 * Math.exp(-(dd * dd) / (2 * (r / 2.3) ** 2)); if (dd > r * 0.8 && rnd((i * 13 + Math.floor(minutes * 60)) >>> 0) < 0.06) s += dt * 2.5; if (dd > r + 6 || s < 0.0005) continue;
        if (tape[i]) { over[i] = over[i]! + s; continue; } touched++;
        if (kind[i] !== 1) { over[i] = over[i]! + s; continue; }
        if (pcol[i] !== colour && paint[i]! > 0 && s > paint[i]! * 0.3) pcol[i] = colour; else if (pcol[i]! < 0) pcol[i] = colour; paint[i] = paint[i]! + s; } }
    return touched;
  }
  /** masking tape off the roll: a 6 px strip (30 mm) from a to b */
  function layTape(ax: number, ay: number, bx: number, by: number) { const n = Math.ceil(Math.hypot(bx - ax, by - ay)) + 1, vert = Math.abs(by - ay) > Math.abs(bx - ax);
    for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n; for (let o = -3; o <= 2; o++) { const xx = Math.round(vert ? x + o : x), yy = Math.round(vert ? y : y + o); if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const i = yy * w + xx; if (kind[i]) tape[i] = vert ? 2 : 1; } } }

  function inspect() { let shiny = 0, dark = 0, wheelPx = 0, rustSeen = 0, rustHid = 0, pits = 0, bumps = 0, bareLeft = 0, thin = 0, runs = 0, other = 0, near = 0, extra = 0, mist = 0, darkMist = 0, tapeLeft = 0, weakLead = 0, scr = 0, wheelScr = 0, rustArea = 0, scratched = 0;
    for (let i = 0; i < N; i++) { if (tape[i]) tapeLeft++; const k = kind[i];
      if (k === 2) { shiny++; if (over[i]! > 0.25) mist++; if (scratch[i]! > 0.3) scr++; } if (k === 3) { dark++; if (over[i]! > 0.25) darkMist++; } if (k === 4) { wheelPx++; if (scratch[i]! > 0.3) wheelScr++; if (over[i]! > 0.25) darkMist++; }
      if (k !== 1) continue; if (rust0[i]! > 0.08) rustArea++;
      const pt = paint[i]!; if (rust[i]! > 0.08) (pt > 0.3 ? rustHid++ : rustSeen++); if (pt > 0.3 && pit[i]! - fill[i]! > 0.12) pits++; if (fill[i]! - pit[i]! > 0.22) bumps++;
      if (bare(i) && pt < 0.3) bareLeft++; else if (bare(i) && pt < 0.7) thin++; if (pt > 2.6) runs++; if (pt > 0.3 && pcol[i]! > 0) other++; else if (pt > 0.3) near++;
      if (bare(i) && rust0[i]! < 0.05) extra++; if (!bare(i) && wear[i]! > 0.1 && pt < 0.3) scratched++; if (weak[i] && pt > 0.3) weakLead++; }
    const pc = (n: number, of = rustArea) => Math.round(n / Math.max(1, of) * 100), cm = (n: number) => Math.round(n * MM * MM / 100);
    // shares of the rusted area weigh the score; the card shows areas in cm2
    const lines: [string, number, number, number][] = [['보이는 녹', pc(rustSeen), 0.9, rustSeen], ['칠 밑에 숨은 녹', pc(rustHid), 1.2, rustHid], ['메우지 않은 파인 곳', pc(pits), 0.6, pits], ['메움 굴곡', pc(bumps), 0.4, bumps],
      ['칠 안 된 맨 철판', pc(bareLeft), 0.8, bareLeft], ['얇은 칠', pc(thin), 0.3, thin], ['흘러내린 칠', pc(runs), 0.4, runs], ['다른 색', pc(other), 0.7, other], ['같은 색, 새 칠과 옛 칠의 미세한 차이', pc(near), 0.03, near],
      ['긁히기만 하고 덮이지 않은 칠', pc(scratched), 0.3, scratched], ['녹 없던 곳까지 벗김', pc(extra), 0.15, extra], ['녹 위에 올린 납', pc(weakLead), 0.5, weakLead],
      ['유리 · 크롬에 묻은 칠', pc(mist, shiny), 1.5, mist], ['타이어 · 휠에 묻은 칠', pc(darkMist, dark + wheelPx), 1, darkMist], ['유리 · 크롬 긁힘', pc(scr, shiny), 2, scr], ['휠 긁힘', pc(wheelScr, wheelPx), 1, wheelScr], ['떼지 않은 테이프', tapeLeft ? Math.max(1, pc(tapeLeft, rustArea)) : 0, 3, tapeLeft]];
    const pen = lines.reduce((a, [, v, k]) => a + Math.min(60, v) * k, 0), sat = Math.max(0, Math.round(100 - pen)), back = Math.min(95, Math.round(pc(rustHid) * 1.6 + pc(pits) * 0.9 + pc(bareLeft) * 1.2 + pc(weakLead) * 0.8));
    report = [`녹 슬었던 넓이 ${cm(rustArea)} cm2`, ...lines.filter(l => l[3] > 0).map(([t, , , n]) => `${t}  ${cm(n)} cm2`)];
    verdict = `손님 만족 ${sat}점 · 반년 안에 들뜨거나 다시 녹슬 확률 ${back}%`; }

  // ---------------- drawing ----------------
  const wall = (x: number, y: number): RGB => { const wx = x + Math.floor(cam.x * 0.3), plank = Math.floor(wx / 26), g = vn(wx / 40, y / 3, plank) * 0.5 + rnd((plank * 7) >>> 0) * 0.5;
    const c = wx % 26 === 0 ? hex('#3a2a1e') : g > 0.6 ? hex('#6a4e36') : g < 0.35 ? hex('#4e3826') : hex('#5c4430'), lamp = Math.hypot(x - 240, (y - 10) * 1.6), lit = Math.max(0, 1 - lamp / 300); return mix(c, hex('#e8c890'), lit * 0.25); };
  const floor = (x: number, y: number): RGB => { const fx = x + cam.x, g = vn(fx / 9, y / 2, 3); let c = g > 0.6 ? hex('#8a8478') : g < 0.3 ? hex('#6e6a60') : hex('#7c776c'); if (rnd((fx * 131 + y * 7) >>> 0) < 0.04) c = hex('#5e5a52'); return c; };
  function pixel(i: number): RGB | null {
    if (!kind[i]) return null; let c = orig[i]!;
    if (kind[i] === 1) {
      if (paint[i]! > 0.05) { const pcR = fresh(i, pcol[i]!), under: RGB = bare(i) ? (fill[i]! > 0 ? LEAD[1]! : STEEL[1]!) : wear[i]! > 0.4 ? UNDER : orig[i]!; c = paint[i]! < 0.7 ? mix(under, pcR, paint[i]! / 0.7) : pcR;
        const lump = fill[i]! - pit[i]!; if (lump > 0.22) { const up = i >= w ? fill[i - w]! - pit[i - w]! : 0; c = mix(c, up < lump ? hex('#ffffff') : hex('#000000'), 0.16); }   // a lump shows through
        if (pit[i]! - fill[i]! > 0.15) c = mix(c, hex('#000000'), 0.18);                                                                                              // a dent shows through
        if (paint[i]! > 2.6) c = mix(c, hex('#000000'), (i % w) % 3 === 0 ? 0.3 : 0.12); }                                                                           // runs
      else if (bare(i)) { if (fill[i]! > 0.02) { const hi = fill[i]! - pit[i]!; c = hi > 0.22 ? LEAD[0]! : hi < -0.1 ? LEAD[2]! : LEAD[1]!; }
        else { const p = pit[i]!; c = p > 0.3 ? hex('#4a4440') : p > 0.12 ? STEEL[2]! : rnd(i * 3) < 0.25 ? STEEL[0]! : STEEL[1]!; if (rust[i]! > 0.05) c = mix(c, RUST[rust[i]! > 0.4 ? 2 : 1]!, Math.min(1, rust[i]! * 1.5)); } }
      else { if (rust[i]! > 0.05) { const r = rust[i]!, n = rnd(i * 7); c = mix(c, r > 0.6 ? (n < 0.3 ? RUST[3]! : RUST[2]!) : r > 0.3 ? RUST[1]! : RUST[0]!, Math.min(1, 0.35 + r)); }
        const wr = wear[i]!; if (wr > 0) c = wr < 0.4 ? mix(c, mix(c, hex('#ffffff'), 0.35), wr / 0.4) : wr < 0.75 ? mix(c, UNDER, (wr - 0.4) / 0.35 * 0.9 + 0.1) : mix(UNDER, STEEL[1]!, (wr - 0.75) / 0.25); } }
    else { if (over[i]! > 0.05) c = mix(c, COLOURS[colour]!.rgb ?? hex(base.paint), Math.min(0.85, over[i]!)); if (scratch[i]! > 0.1) c = mix(c, hex('#e8ecef'), scratch[i]! * 0.5); }
    if (tape[i]) { const x = i % w, y = (i / w) | 0, along = tape[i] === 1 ? x : y; c = along % 7 === 0 ? TAPE[1]! : TAPE[0]!; if (over[i]! > 0.2) c = mix(c, COLOURS[colour]!.rgb ?? hex(base.paint), Math.min(0.7, over[i]!)); }
    return c; }
  const overview = () => { const k = 2, ox = Math.round((S.w - w / k) / 2), oy = VIEW.y + VIEW.h - Math.round(h / k) - 4; return { k, ox, oy }; };
  function scene() {
    if (whole) { const { k, ox, oy } = overview();
      for (let y = VIEW.y; y < VIEW.y + VIEW.h; y++) for (let x = 0; x < S.w; x++) S.px(x, y, y < oy + im.groundY / k ? wall(x, y) : floor(x, y));
      for (let y = 0; y < h; y += k) for (let x = 0; x < w; x += k) { const c = pixel(y * w + x); if (c) S.px(ox + x / k, oy + y / k, c); }
      const fx = ox + cam.x / k, fy = oy + cam.y / k; for (let x = fx; x < fx + VIEW.w / k; x++) { S.px(x, fy, COL.lit); S.px(x, fy + VIEW.h / k, COL.lit); } for (let y = fy; y < fy + VIEW.h / k; y++) { S.px(fx, y, COL.lit); S.px(fx + VIEW.w / k, y, COL.lit); }
      return; }
    const gy = im.groundY - cam.y + VIEW.y;
    for (let y = VIEW.y; y < VIEW.y + VIEW.h; y++) for (let x = 0; x < S.w; x++) { const ix = x + cam.x, iy = y - VIEW.y + cam.y, c = ix >= 0 && iy >= 0 && ix < w && iy < h ? pixel(iy * w + ix) : null;
      S.px(x, y, c ?? (y < gy ? wall(x, y) : floor(x, y))); } }
  /** the tool in the hand, with its shadow falling on whatever is under it */
  function toolSprite() { const p = ui.pointer(); if (p.y < VIEW.y || p.y > VIEW.y + VIEW.h || report || whole || ui.hover) return; const down = p.down, x = Math.round(p.x), y = Math.round(p.y), lift = down ? 0 : 2;
    const shade = (sx: number, sy: number, sw: number, sh: number, a: number) => { for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) { const dx = (i - sw / 2) / (sw / 2), dy = (j - sh / 2) / (sh / 2); if (dx * dx + dy * dy < 1) S.px(sx + i, sy + j, [10, 6, 4], a); } };
    if (tool === 'brush') { const off = down ? 2 : 6; shade(x - 7 + off, y - 4 + off, 15, 10, 0.35);
      for (let j = -5; j <= 4; j++) for (let i = -7; i <= 7; i++) { if ((i / 7.5) ** 2 + (j / 5.2) ** 2 > 1) continue; const n = rnd(((i + 20) * 31 + (j + 20) * 17) >>> 0); S.px(x + i, y + j - lift, n < 0.2 ? hex('#5a5e62') : n < 0.55 ? hex('#8a9096') : n < 0.85 ? hex('#b2b8be') : hex('#e6eaee')); } }
    else if (tool === 'lead') { const off = down ? 2 : 6; shade(x - 3 + off, y - 2 + off, 8, 6, 0.32);
      S.fill(x - 2, y - 15 - lift, 4, 12, hex('#7a5a3a')); S.vline(x - 2, y - 15 - lift, y - 4 - lift, hex('#9a7a52')); S.fill(x - 3, y - 4 - lift, 6, 4, hex('#9a9ea4')); S.px(x - 2, y - 4 - lift, hex('#d8dce0')); S.px(x, y - lift, hex('#5a5e62')); }
    else if (tool === 'tape') { const off = down ? 2 : 5; shade(x - 6 + off, y - 6 + off, 13, 13, 0.32); const cy = y - lift;
      for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) { const dd = Math.hypot(i, j); if (dd > 6.3 || dd < 2.6) continue; S.px(x + i, cy + j, dd > 5.4 ? TAPE[2]! : (i + j) % 3 === 0 ? TAPE[1]! : TAPE[0]!); }
      S.px(x - 1, cy - 1, hex('#fff6d8')); }
    else { const off = down ? 3 : 7, cy = y - lift; shade(x - 4 + off, y + off, 22, 9, 0.3);
      S.fill(x - 1, cy - 2, 4, 3, hex('#3a3a3e')); S.fill(x + 3, cy - 4, 12, 6, hex('#7a7e86')); S.hline(x + 3, x + 14, cy - 4, hex('#b8bcc4')); S.fill(x + 9, cy + 2, 3, 8, hex('#5a5e66')); S.fill(x + 6, cy - 11, 7, 7, hex('#9a6a3a')); S.hline(x + 6, x + 12, cy - 11, hex('#c89060'));
      if (down) for (let k = 0; k < 14; k++) { const t = Math.floor(performance.now() / 30); S.px(x - 3 - rnd((k * 7 + t) >>> 0) * 12, cy - 4 + rnd((k * 13 + t) >>> 0) * 8, COLOURS[colour]!.rgb ?? hex(base.paint), 0.6); } } }
  const clock = () => { const m = 8 * 60 + Math.floor(minutes), hh = Math.floor(m / 60), mm = m % 60; return `${hh < 12 ? '오전' : '오후'} ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`; };
  const arrows: [string, string, Rect, number, number][] = [['l', '<', { x: 2, y: VIEW.y + 80, w: 14, h: 40 }, -1, 0], ['r', '>', { x: 464, y: VIEW.y + 80, w: 14, h: 40 }, 1, 0], ['u', '^', { x: 210, y: VIEW.y + 2, w: 60, h: 13 }, 0, -1], ['d', 'v', { x: 210, y: VIEW.y + VIEW.h - 15, w: 60, h: 13 }, 0, 1]];

  return { id: 'bodywork',
    frame(_a, dt) {
      minutes += dt * 20 / 60;                                                                        // work runs twenty times real time
      scene();
      const p = ui.pointer(), lx = p.x + cam.x, ly = p.y - VIEW.y + cam.y; let snd: '' | 'scrape' | 'spray' | 'tape' | 'brush' = '', amt = 0, pitch = 1;
      // the edges: pan (held keeps going)
      if (!whole && !report) for (const [id, label, r, dx, dy] of arrows) { const held = p.down && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h; ui.button('pan-' + id, r, label, { down: held });
        if (held) { camF.x += dx * 160 * dt; camF.y += dy * 120 * dt; cam.x = camF.x; cam.y = camF.y; clampCam(); camF.x = Math.max(-40, Math.min(w - VIEW.w + 40, camF.x)); camF.y = Math.max(-40, Math.min(h - VIEW.h + 30, camF.y)); } }
      const overUI = ui.hover !== '' || p.y < VIEW.y || p.y >= VIEW.y + VIEW.h;
      if (whole) { if (p.down && !overUI && !ui.tookClick) { const { k, ox, oy } = overview(); cam.x = Math.round((p.x - ox) * k - VIEW.w / 2); cam.y = Math.round((p.y - oy) * k - VIEW.h / 2); clampCam(); camF.x = cam.x; camF.y = cam.y; whole = false; } }
      else if (!report) {
        if (tool === 'tape') {
          if (p.down && !overUI && !tapeRun) tapeRun = { x: lx, y: ly, axis: '', at: 0 };
          if (tapeRun && p.down) { const dx = lx - tapeRun.x, dy = ly - tapeRun.y; if (!tapeRun.axis && Math.hypot(dx, dy) > 4) tapeRun.axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
            if (tapeRun.axis) { const to = tapeRun.axis === 'h' ? dx : dy, from = tapeRun.at; if (Math.abs(to) > Math.abs(from)) { // the roll only pays out forward
                if (tapeRun.axis === 'h') layTape(tapeRun.x + from, tapeRun.y, tapeRun.x + to, tapeRun.y); else layTape(tapeRun.x, tapeRun.y + from, tapeRun.x, tapeRun.y + to);
                const v = Math.abs(to - from) / Math.max(dt, 0.001); tapeRun.at = to; snd = 'tape'; amt = Math.min(1, 0.4 + v / 200); pitch = 0.75 + Math.min(1.1, v / 260); } } }
          if (tapeRun && !p.down) tapeRun = null; }
        else if (p.down && !overUI && !ui.tookClick) { const from = last ?? { x: lx, y: ly }, moved = Math.hypot(lx - from.x, ly - from.y), n = Math.max(1, Math.ceil(moved)), dir = moved > 0.01 ? { x: (lx - from.x) / moved, y: (ly - from.y) / moved } : dirLast; let t = 0;
          for (let k = 1; k <= n; k++) t += dab(from.x + (lx - from.x) * k / n, from.y + (ly - from.y) * k / n, tool === 'spray' ? dt / n : dt, dir);
          if (tool === 'spray') { if (moved < 0.5) t += dab(lx, ly, dt, dir); snd = 'spray'; amt = 1; } else if (t > 0 && moved > 0.3) { snd = tool === 'brush' ? 'scrape' : 'brush'; amt = Math.min(1, moved / 5); pitch = 0.85 + Math.min(0.45, moved / 40); }
          last = { x: lx, y: ly }; dirLast = dir; }
        else last = null; }
      app.sound.play(snd, amt, pitch);
      toolSprite();
      const bar = { x: 4, y: 4, w: 472, h: 18 }; ui.panel(bar, 'enamel'); const [t1, t2] = split({ x: 12, y: 9, w: 456, h: 9 }, ['*', 80], 4);
      ui.label(t1!, '수리 견본: 1929 세단 아래쪽 녹 · 가까이서 긁고 메우고 가리고 칠하기', COL.cream); ui.label(t2!, clock(), COL.cream, 'r');
      S.fill(0, VIEW.y + VIEW.h, S.w, 14, COL.wood2); S.hline(0, S.w - 1, VIEW.y + VIEW.h, COL.shadow);
      ui.label({ x: 8, y: 229, w: 464, h: 9 }, whole ? '전체 보기: 작업할 곳을 누르면 가까이 간다' : TOOLS.find(t => t.id === tool)!.tip, COL.cream);
      ui.panel({ x: 4, y: 240, w: 472, h: 26 }, 'plate');
      const b = split({ x: 8, y: 244, w: 464, h: 16 }, ['*', '*', '*', '*', 52, 50, 32, 30], 3);
      TOOLS.forEach((t, k) => { if (ui.button('tool-' + t.id, b[k]!, t.name, { down: tool === t.id })) { tool = t.id; tapeRun = null; } });
      if (ui.button('colour', b[4]!, COLOURS[colour]!.name)) { colour = (colour + 1) % COLOURS.length; app.sound.once('shake'); }
      { const sw = COLOURS[colour]!.rgb ?? hex(base.paint); S.fill(b[4]!.x + 3, b[4]!.y + 4, 4, 8, sw); }
      if (ui.button('untape', b[5]!, '테이프 떼기')) { tape.fill(0); app.sound.play('tape', 1, 1.6); }
      if (ui.button('whole', b[6]!, whole ? '가까이' : '전체', { down: whole })) whole = !whole;
      if (ui.button('inspect', b[7]!, '검사')) inspect();
      if (report) { const r = { x: 100, y: 30, w: 280, h: 196 }; ui.panel(r, 'card'); ui.label({ x: r.x + 10, y: r.y + 6, w: r.w - 20, h: 10 }, '검사 결과', COL.ink); S.hline(r.x + 8, r.x + r.w - 8, r.y + 18, COL.card2);
        report.slice(0, 14).forEach((l, i) => ui.label({ x: r.x + 10, y: r.y + 22 + i * 10, w: r.w - 20, h: 9 }, l, i ? COL.inkSoft : COL.ink));
        ui.paragraph({ x: r.x + 10, y: r.y + 166, w: r.w - 90, h: 22 }, verdict, COL.ink);
        if (ui.button('close', { x: r.x + r.w - 70, y: r.y + r.h - 20, w: 60, h: 14 }, '계속')) report = null; }
    },
    key(_a, e) { const k = '1234'.indexOf(e.key); if (k >= 0) { tool = TOOLS[k]!.id; return true; }
      const mv: Record<string, [number, number]> = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -30], ArrowDown: [0, 30] }; const m = mv[e.key];
      if (m && !whole) { cam.x += m[0]; cam.y += m[1]; clampCam(); camF.x = cam.x; camF.y = cam.y; return true; } return false; } };
}
