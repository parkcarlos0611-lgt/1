// Prototype B (review 33): rust repair by hand in the garage. The 1929 sedan's side, drawn from its 3D part model,
// carries rust on its lower panels. Every painted pixel keeps layers: the old paint, rust (how deep), metal lost under
// the rust (pits), lead filled in (flux and lead, as in the period), masking tape, and new paint (colour and thickness).
// Wire brush: takes off rust, paint and lead above the surface (and scratches whatever it touches). Lead: fills the
// pits first, then heaps up. Tape: laid in strips; paint never reaches what it covers. Spray gun: builds paint up
// softly, runs where it is laid too thick, mists glass and chrome nearby. "검사" scores the work the way the customer
// (and the next six months) will.
import type { App, Scene } from '../shell/app';
import { split, COL, rnd, mix } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { viewDesign, type CarModel } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import model from '../../data/cars/sedan29.json';

type Tool = 'brush' | 'lead' | 'tape' | 'spray';
const TOOLS: { id: Tool; name: string; tip: string }[] = [
  { id: 'brush', name: '철수세미', tip: '문질러 녹과 칠을 벗긴다. 납이 솟은 곳도 깎인다' },
  { id: 'lead', name: '납 메움', tip: '맨 철판에 플럭스와 납. 파인 곳부터 찬다. 많으면 솟는다' },
  { id: 'tape', name: '마스킹', tip: '끌어서 테이프를 붙인다. 붙인 곳에는 칠이 안 묻는다' },
  { id: 'spray', name: '스프레이', tip: '누르고 움직여 칠한다. 한곳에 오래 두면 흘러내린다' } ];
const COLOURS: { name: string; rgb: RGB | null }[] = [{ name: '원래 색', rgb: null }, { name: '검정', rgb: hex('#202024') }, { name: '적갈색', rgb: hex('#6a2a22') }, { name: '크림', rgb: hex('#d8c8a0') }];
const lum = (c: RGB) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const RUST = [hex('#b0602a'), hex('#8a4a22'), hex('#6a3418'), hex('#4a2410')], STEEL = [hex('#b8bcc0'), hex('#9aa0a6'), hex('#7a8086')], LEAD = [hex('#a0a4a8'), hex('#8a8e94'), hex('#6e7278')];
const TAPE = [hex('#e2d4a8'), hex('#cdbd8c')];

export function bodyworkScene(app: App): Scene {
  const ui = app.ui, S = app.S, base = model as unknown as CarModel, d = viewDesign(base, 'left'), im = rasterizeFlat(d, {}), w = im.w, h = im.h, N = w * h;
  const OX = Math.round((S.w - w) / 2), GROUND = 226, OY = GROUND - im.groundY;
  // what each pixel is: 1 paint, 2 glass or chrome or lamp glass, 3 anything else (tyres, black parts, cloth)
  const kind = new Uint8Array(N), orig: RGB[] = new Array(N), tone = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = im.rgba[i * 4 + 3]!; orig[i] = [im.rgba[i * 4]!, im.rgba[i * 4 + 1]!, im.rgba[i * 4 + 2]!]; if (a < 128) continue; const o = im.owner[i]!, m = o >= 0 ? d.panels[o]?.material : undefined;
    kind[i] = m === 'paint' || m === 'paint2' ? 1 : m === 'glass' || m === 'chrome' || m === 'lensR' || m === 'white' ? 2 : 3;
    if (kind[i] === 1) tone[i] = lum(orig[i]!) / Math.max(8, lum(hex(m === 'paint2' ? base.paint2 ?? base.paint : base.paint))); }
  // layers
  const rust0 = new Float32Array(N), rust = new Float32Array(N), pit = new Float32Array(N), wear = new Float32Array(N), bare = new Uint8Array(N), fill = new Float32Array(N), weak = new Uint8Array(N);
  const paint = new Float32Array(N), pcol = new Int8Array(N).fill(-1), tape = new Uint8Array(N), over = new Float32Array(N), scratch = new Uint8Array(N);
  // rust: patches on the lower panels (sills, fender skirts, door bottoms), each a noisy blob
  const vn = (x: number, y: number, s: number) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), r = (a: number, b: number) => rnd(((a * 73856093) ^ (b * 19349663) ^ (s * 83492791)) >>> 0);
    return (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) + (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v; };
  const low = [] as number[]; for (let i = 0; i < N; i++) if (kind[i] === 1 && (i / w | 0) > im.groundY - 62) low.push(i);
  for (let k = 0; k < 6; k++) { const c = low[Math.floor(rnd(k * 977 + 13) * low.length)]!, cx = c % w, cy = (c / w) | 0, r = 6 + rnd(k * 31) * 9;
    for (let y = cy - 18; y <= cy + 18; y++) for (let x = cx - 22; x <= cx + 22; x++) { if (x < 0 || y < 0 || x >= w || y >= h) continue; const i = y * w + x; if (kind[i] !== 1) continue;
      const dd = Math.hypot((x - cx) / 1.4, y - cy) / r, n = vn(x / 3, y / 3, k) * 0.6 + vn(x / 1.2, y / 1.2, k + 9) * 0.4, v = Math.max(0, 1 - dd + (n - 0.5) * 0.9);
      if (v > 0.05) rust0[i] = rust[i] = Math.min(1, Math.max(rust0[i]!, v * (0.6 + n * 0.6))); } }
  // the work
  let tool: Tool = 'brush', colour = 0, last: { x: number; y: number } | null = null, tapeFrom: { x: number; y: number } | null = null, minutes = 0, report: string[] | null = null, verdict = '';
  const R = (t: Tool) => (t === 'spray' ? 7 : t === 'tape' ? 2 : 3);
  function dab(cx: number, cy: number, dt: number) {
    const r = R(tool); let touched = 0;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { if (x < 0 || y < 0 || x >= w || y >= h) continue; const i = y * w + x, dd = Math.hypot(x - cx, y - cy); if (dd > r + 0.5 || !kind[i]) continue;
      if (tool === 'brush') { const s = 0.45 * (1 - dd / (r + 1));
        if (kind[i] !== 1) { if (kind[i] === 2 && s > 0.2) scratch[i] = 1; continue; }
        if (tape[i]) continue; touched++;
        if (paint[i]! > 0) { paint[i] = Math.max(0, paint[i]! - s * 2); if (paint[i] === 0) pcol[i] = -1; continue; }
        if (fill[i]! > pit[i]!) { fill[i] = Math.max(pit[i]!, fill[i]! - s * 0.6); continue; }
        if (!bare[i]) { wear[i] = wear[i]! + s; if (wear[i]! >= 1) bare[i] = 1; continue; }
        if (rust[i]! > 0) { const took = Math.min(rust[i]!, s * 0.8); rust[i] = rust[i]! - took; pit[i] = pit[i]! + took * 0.55; if (rust[i]! < 0.02) rust[i] = 0; } }
      else if (tool === 'lead') { if (kind[i] !== 1 || tape[i] || !bare[i] || paint[i]! > 0) continue; touched++; const s = 0.07 * (1 - dd / (r + 1));
        fill[i] = fill[i]! + (fill[i]! < pit[i]! ? s * 1.6 : s * 0.5); if (rust[i]! > 0.08) weak[i] = 1; }
      else if (tool === 'spray') { const s = dt * 2.2 * Math.exp(-(dd * dd) / (2 * (r / 2.2) ** 2));
        if (tape[i]) continue; touched++;
        if (kind[i] !== 1) { over[i] = over[i]! + s; continue; }
        if (pcol[i] !== colour && paint[i]! > 0 && s > paint[i]! * 0.3) pcol[i] = colour; else if (pcol[i]! < 0) pcol[i] = colour; paint[i] = paint[i]! + s; } }
    return touched;
  }
  function layTape(a: { x: number; y: number }, b: { x: number; y: number }) { const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)) + 1;
    for (let k = 0; k <= n; k++) { const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = Math.round(x + dx), yy = Math.round(y + dy); if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const i = yy * w + xx; if (kind[i]) tape[i] = 1; } } }

  function inspect() { let shiny = 0, dark = 0, darkMist = 0, paintPx = 0, rustSeen = 0, rustHid = 0, pits = 0, bumps = 0, bareLeft = 0, thin = 0, runs = 0, other = 0, extra = 0, mist = 0, tapeLeft = 0, weakLead = 0, scr = 0, rustArea = 0;
    for (let i = 0; i < N; i++) { if (tape[i]) tapeLeft++; if (kind[i] === 2) { shiny++; if (over[i]! > 0.25) mist++; } if (kind[i] === 3) { dark++; if (over[i]! > 0.25) darkMist++; } if (scratch[i]) scr++; if (kind[i] !== 1) continue; paintPx++; if (rust0[i]! > 0.08) rustArea++;
      const pt = paint[i]!; if (rust[i]! > 0.08) (pt > 0.3 ? rustHid++ : rustSeen++); if (pt > 0.3 && pit[i]! - fill[i]! > 0.12) pits++; if (fill[i]! - pit[i]! > 0.22) bumps++;
      if (bare[i] && pt < 0.3) bareLeft++; else if (bare[i] && pt < 0.7) thin++; if (pt > 2.6) runs++; if (pt > 0.3 && pcol[i]! > 0) other++; if (bare[i] && rust0[i]! < 0.05) extra++; if (weak[i] && pt > 0.3) weakLead++; }
    const pc = (n: number, of = rustArea) => Math.round(n / Math.max(1, of) * 100);
    // shares of the rusted area weigh the score; the card shows areas (1 px = 1 cm2 at 10 mm a pixel)
    const lines: [string, number, number, number?][] = [['보이는 녹', pc(rustSeen), 0.9, rustSeen], ['칠 밑에 숨은 녹', pc(rustHid), 1.2, rustHid], ['메우지 않은 파인 곳', pc(pits), 0.6, pits], ['메움 굴곡', pc(bumps), 0.4, bumps], ['칠 안 된 맨 철판', pc(bareLeft), 0.8, bareLeft], ['얇은 칠', pc(thin), 0.3, thin],
      ['흘러내린 칠', pc(runs), 0.4, runs], ['다른 색', pc(other), 0.7, other], ['녹 없던 곳까지 벗김', pc(extra), 0.15, extra], ['녹 위에 올린 납', pc(weakLead), 0.5, weakLead], ['유리 · 크롬에 묻은 칠', pc(mist, shiny), 1.5], ['타이어 · 검은 부품에 묻은 칠', pc(darkMist, dark), 1], ['유리 · 크롬 긁힘', pc(scr, shiny), 2], ['떼지 않은 테이프', tapeLeft ? Math.max(1, pc(tapeLeft, paintPx)) : 0, 3]];
    const pen = lines.reduce((a, [, v, k]) => a + Math.min(60, v) * k, 0), sat = Math.max(0, Math.round(100 - pen)), back = Math.min(95, Math.round(pc(rustHid) * 1.6 + pc(pits) * 0.9 + pc(bareLeft) * 1.2 + pc(weakLead) * 0.8));
    report = [`녹 슬었던 넓이 ${rustArea} cm2`, ...lines.filter(l => l[1] > 0).map(([t, v, , n]) => `${t}  ${n !== undefined ? `${n} cm2` : `${v}%`}`)]; if (!report.length) report = ['흠잡을 데가 없다'];
    verdict = `손님 만족 ${sat}점 · 반년 안에 들뜨거나 다시 녹슬 확률 ${back}%`; }

  // ---------------- drawing ----------------
  function room() { for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { let c: RGB;
      if (y < GROUND) { const plank = Math.floor(x / 22), seam = x % 22 === 0, g = vn(x / 40, y / 3, plank) * 0.5 + rnd(plank * 7) * 0.5; c = seam ? hex('#3a2a1e') : g > 0.6 ? hex('#6a4e36') : g < 0.35 ? hex('#4e3826') : hex('#5c4430');
        const lamp = Math.hypot(x - 240, (y - 10) * 1.6), lit = Math.max(0, 1 - lamp / 260); c = mix(c, hex('#e8c890'), lit * 0.28); if (y > GROUND - 18) c = mix(c, hex('#2a1e14'), (y - GROUND + 18) / 30); }
      else { const g = vn(x / 9, y / 2, 3); c = g > 0.6 ? hex('#8a8478') : g < 0.3 ? hex('#6e6a60') : hex('#7c776c'); if (rnd(x * 131 + y * 7) < 0.04) c = hex('#5e5a52'); }
      S.px(x, y, c); } }
  function car() { const P = COLOURS[colour]!;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!kind[i]) continue; let c = orig[i]!;
      if (kind[i] === 1) {
        if (paint[i]! > 0.05) { const cc = COLOURS[pcol[i]!]?.rgb; let pcR: RGB = cc ? mix(hex('#000000'), cc, Math.min(1.25, tone[i]!)) : orig[i]!;
          const under: RGB = bare[i] ? (fill[i]! > 0 ? LEAD[1]! : STEEL[1]!) : orig[i]!; c = paint[i]! < 0.7 ? mix(under, pcR, paint[i]! / 0.7) : pcR;
          if (fill[i]! - pit[i]! > 0.22) { const up = i >= w ? fill[i - w]! - pit[i - w]! : 0; c = mix(c, up < fill[i]! - pit[i]! ? hex('#ffffff') : hex('#000000'), 0.18); }   // a lump shows through
          if (pit[i]! - fill[i]! > 0.15) c = mix(c, hex('#000000'), 0.18);                                             // a dent shows through
          if (paint[i]! > 2.6 && rnd(i) < 0.5) c = mix(c, hex('#000000'), 0.25); }                                      // a run
        else if (bare[i]) { if (fill[i]! > 0.02) { const hi = fill[i]! - pit[i]!; c = hi > 0.22 ? LEAD[0]! : hi < -0.1 ? LEAD[2]! : LEAD[1]!; }
          else { const p = pit[i]!; c = p > 0.3 ? hex('#4a4440') : p > 0.12 ? STEEL[2]! : rnd(i * 3) < 0.25 ? STEEL[0]! : STEEL[1]!; if (rust[i]! > 0.05) c = mix(c, RUST[rust[i]! > 0.4 ? 2 : 1]!, Math.min(1, rust[i]! * 1.5)); } }
        else if (rust[i]! > 0.05) { const r = rust[i]!, n = rnd(i * 7); c = mix(c, r > 0.6 ? (n < 0.3 ? RUST[3]! : RUST[2]!) : r > 0.3 ? RUST[1]! : RUST[0]!, Math.min(1, 0.35 + r));
          if (wear[i]! > 0) c = mix(c, STEEL[1]!, wear[i]! * 0.5); }
        else if (wear[i]! > 0) c = mix(c, STEEL[0]!, wear[i]! * 0.7); }
      else { if (over[i]! > 0.05) { const cc = COLOURS[colour]!.rgb ?? hex(base.paint); c = mix(c, cc, Math.min(0.85, over[i]!)); } if (scratch[i]) c = mix(c, hex('#ffffff'), 0.35); }
      if (tape[i]) c = (x + y) % 5 === 0 ? TAPE[1]! : TAPE[0]!;
      S.px(OX + x, OY + y, c); }
    void P; }
  function cursor() { const p = ui.pointer(); if (p.y > 222 || report) return; const r = R(tool) + (tool === 'spray' ? 0 : 1);
    for (let a = 0; a < 6.283; a += 0.25) S.px(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, hex('#fff1c0'), 0.8);
    if (tool === 'tape' && tapeFrom) S.line(tapeFrom.x, tapeFrom.y, p.x, p.y, TAPE[1]!); }
  const clock = () => { const m = 8 * 60 + Math.floor(minutes), hh = Math.floor(m / 60), mm = m % 60; return `${hh < 12 ? '오전' : '오후'} ${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`; };

  return { id: 'bodywork',
    frame(_a, dt) {
      minutes += dt * 20 / 60;                                                                        // work runs twenty times real time
      room(); car();
      const bar = { x: 4, y: 4, w: 472, h: 18 }; ui.panel(bar, 'enamel'); const [t1, t2] = split({ x: 12, y: 9, w: 456, h: 9 }, ['*', 80], 4);
      ui.label(t1!, '수리 견본: 1929 세단 아래쪽 녹 · 긁고 메우고 가리고 칠하기', COL.cream); ui.label(t2!, clock(), COL.cream, 'r');
      ui.label({ x: 8, y: 229, w: 464, h: 9 }, TOOLS.find(t => t.id === tool)!.tip, COL.cream);
      ui.panel({ x: 4, y: 240, w: 472, h: 26 }, 'plate');
      const b = split({ x: 8, y: 244, w: 464, h: 16 }, ['*', '*', '*', '*', 56, 52, 40], 3);
      TOOLS.forEach((t, k) => { if (ui.button('tool-' + t.id, b[k]!, t.name, { down: tool === t.id })) { tool = t.id; tapeFrom = null; } });
      if (ui.button('colour', b[4]!, COLOURS[colour]!.name)) colour = (colour + 1) % COLOURS.length;
      { const sw = COLOURS[colour]!.rgb ?? hex(base.paint); S.fill(b[4]!.x + 3, b[4]!.y + 4, 4, 8, sw); }
      if (ui.button('untape', b[5]!, '테이프 떼기')) { tape.fill(0); app.sound.play('tape', 1, 1.6); }
      if (ui.button('inspect', b[6]!, '검사')) inspect();
      // the tools at work
      const p = ui.pointer(), onCar = p.y < 222 && !ui.tookClick && !report, lx = p.x - OX, ly = p.y - OY; let snd: '' | 'scrape' | 'spray' | 'tape' | 'brush' = '', amt = 0, pitch = 1;
      if (tool === 'tape') { if (p.down && onCar && !tapeFrom) tapeFrom = { x: p.x, y: p.y }; if (tapeFrom && p.down) { const len = Math.hypot(p.x - tapeFrom.x, p.y - tapeFrom.y); snd = 'tape'; amt = len > 1 ? 1 : 0.3; pitch = 0.8 + Math.min(1.2, len / 120); }
        if (tapeFrom && !p.down) { layTape({ x: tapeFrom.x - OX, y: tapeFrom.y - OY }, { x: lx, y: ly }); tapeFrom = null; } }
      else if (p.down && onCar) { const from = last ?? { x: lx, y: ly }, n = Math.max(1, Math.ceil(Math.hypot(lx - from.x, ly - from.y))), moved = Math.hypot(lx - from.x, ly - from.y); let t = 0;
        for (let k = 1; k <= n; k++) t += dab(from.x + (lx - from.x) * k / n, from.y + (ly - from.y) * k / n, tool === 'spray' ? dt / n : dt);
        if (tool === 'spray') { if (moved < 0.5) t += dab(lx, ly, dt); snd = 'spray'; amt = 1; } else if (t > 0 && moved > 0.3) { snd = tool === 'brush' ? 'scrape' : 'brush'; amt = Math.min(1, moved / 4); pitch = 0.85 + Math.min(0.4, moved / 30); }
        last = { x: lx, y: ly }; }
      else last = null;
      app.sound.play(snd, amt, pitch);
      cursor();
      if (report) { const r = { x: 110, y: 40, w: 260, h: 170 }; ui.panel(r, 'card'); ui.label({ x: r.x + 10, y: r.y + 6, w: r.w - 20, h: 10 }, '검사 결과', COL.ink); S.hline(r.x + 8, r.x + r.w - 8, r.y + 18, COL.card2);
        report.slice(0, 11).forEach((l, i) => ui.label({ x: r.x + 10, y: r.y + 22 + i * 10, w: r.w - 20, h: 9 }, l, COL.inkSoft));
        ui.paragraph({ x: r.x + 10, y: r.y + 136, w: r.w - 20, h: 20 }, verdict, COL.ink);
        if (ui.button('close', { x: r.x + r.w - 70, y: r.y + r.h - 18, w: 60, h: 14 }, '계속')) report = null; }
    },
    key(_a, e) { const k = '1234'.indexOf(e.key); if (k >= 0) { tool = TOOLS[k]!.id; return true; } return false; } };
}
