// The part builder (reviews 60, 66, 67): opened from the title. Pick a base car; click a slot (grille, lamps, wings,
// boards, bumpers, tail lamp, wheels) and the parts that can go on it open as large pictures, each car's own, with how
// it would fit, and "no part"; the chosen part can be reshaped with sliders (size, width, length). The car as it comes
// out is drawn large; it can be zoomed and moved. Fitting: render/car/swap.ts.
import type { App, Scene } from '../shell/app';
import { COL, split } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { viewDesign, type CarModel, type ViewName } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import { SLOTS, assemble, fitSlot, NO_ADJUST, type Slot, type Grade, type Adjust } from '../../render/car/swap';
import { fitEngine, LAYOUTS, VALVES, displacement, type EngineSpec, type EngineFit } from '../../render/car/engine';
import { weightOf, workOf, slotArea } from '../../render/car/stats';
import { applyWear, NEW, type Wear } from '../../render/car/wear';
import fordT from '../../data/cars/sheet/fordT23.json';
import chev from '../../data/cars/sheet/chevAB28.json';
import plym from '../../data/cars/sheet/plymU29.json';
import pontiac from '../../data/cars/sheet/pontiac29.json';
import dodge from '../../data/cars/sheet/dodgeV28.json';
import willys from '../../data/cars/sheet/willys27.json';
import buick from '../../data/cars/sheet/buick28.json';
import hudson from '../../data/cars/trial/hudson26_hudson_fable.json';
import fnTT from '../../data/cars/sheet/fnTT33.json';
import bmw from '../../data/cars/sheet/bmw315.json';
import ssj from '../../data/cars/sheet/dueSSJ35.json';
import dueA from '../../data/cars/sheet/dueA21.json';

const CARS: { m: CarModel; short: string }[] = [
  [fordT, '1923 소형'], [chev, '1928 경세단'], [plym, '1929 경4기통'], [pontiac, '1929 6기통'], [dodge, '1928 6기통'], [willys, '1927 슬리브'], [buick, '1928 4도어'], [hudson, '1926 대형'], [fnTT, '1933 경스포츠'], [bmw, '1935 로드스터'], [ssj, '1935 그랜드'], [dueA, '1921 쿠페']]
  .map(([m, s]) => ({ m: m as unknown as CarModel, short: s as string }));
const GRADE: Record<Grade, [string, RGB]> = { own: ['원래', hex('#8a8478')], fits: ['맞음', hex('#3f6e3a')], work: ['손봄', hex('#b07a1e')], no: ['안 맞음', hex('#a8402c')], none: ['없음', hex('#5a5550')] };
const BG: RGB = hex('#e6e2d6'), TILE: RGB = hex('#efebe0');
/** the period's paint, as the makers listed it */
const PAINTS: [string, string][] = [['검정', '#1d1d20'], ['밤색', '#4a1e22'], ['군청', '#223249'], ['녹색', '#253a2c'], ['올리브', '#3b3e25'], ['회색', '#5a5c5c'], ['황갈', '#8a6e48'], ['크림', '#c8b98e']];
type Mode = 'parts' | 'engine' | 'paint';
/** the view a slot's part is best seen in, for its picture in the picker */
const VIEW_OF: Record<Slot, ViewName> = { grille: 'front', lamp: 'front', bumperF: 'front', bumperR: 'rear', tail: 'rear', fenderF: 'left', fenderR: 'left', board: 'left', wheel: 'left' };
type Img = { w: number; h: number; rgba: Uint8ClampedArray };

export function builderScene(app: App): Scene {
  const ui = app.ui, S = app.S;
  let base = 1, sel: Slot | null = null, picker = false, zoom = 1, panX = 0, panY = 0, drag: { x: number; y: number; px: number; py: number } | null = null;
  const pick: Partial<Record<Slot, number | null>> = {}, adj: Partial<Record<Slot, Adjust>> = {};
  let mode: Mode = 'parts', eng: EngineSpec | null = null, gears = 3, colour: string | null = null, blackWings = true, wear: Wear = { ...NEW };
  const ownEngine = (): EngineSpec => { const r = (CARS[base]!.m as unknown as { running?: { engine: EngineSpec } }).running?.engine; return r ? { layout: r.layout, kind: r.kind, bore: r.bore, stroke: r.stroke } : { layout: 'I4', kind: 'sv', bore: 95, stroke: 105 }; };
  let cache: { key: string; m: CarModel; front: Img; fits: ReturnType<typeof assemble>['fits']; engFit: EngineFit | null; cc: number; kg: number; kg0: number; hours: number; dollars: number } | null = null, sideKey = '', side: Img | null = null;
  const thumbs = new Map<string, Img | null>(), grades = new Map<string, Grade>();
  function build() {
    const key = base + JSON.stringify([pick, adj, eng, gears, colour, blackWings, wear]); if (cache?.key === key) return cache;
    const choice: Partial<Record<Slot, CarModel | null>> = {}; for (const [s, k] of Object.entries(pick)) choice[s as Slot] = k === null ? null : CARS[k!]!.m;
    const r = assemble(CARS[base]!.m, choice, adj); let m = r.model, engFit: EngineFit | null = null, cc = displacement(ownEngine());
    if (eng) { const e = fitEngine(m, eng, gears); m = e.model; engFit = e.fit; cc = e.cc; }
    if (colour) { m = { ...m, paint: colour, paint2: blackWings ? '#1c1c1f' : colour } as CarModel; } else if (!blackWings) m = { ...m, paint2: (m as unknown as { paint: string }).paint } as CarModel;
    let hours = 0, dollars = 0; for (const s of SLOTS) { const f = r.fits[s.id]; if (!f) continue; const w = workOf(s.id, f, { area: slotArea(m, s.id) }); hours += w.hours; dollars += w.dollars; }
    if (engFit) { hours += 24 + (engFit.grade === 'work' ? 30 : engFit.grade === 'no' ? 80 : 0); dollars += engFit.grade === 'fits' ? 6 : 18; }
    if (colour || !blackWings) { hours += 40; dollars += 14; }
    const front = applyWear(rasterizeFlat(viewDesign(m, 'front'), { mm: Math.max(10, Math.ceil(m.height / 100)), shadow: true }), wear);
    cache = { key, m, front, fits: r.fits, engFit, cc, kg: weightOf(m), kg0: weightOf(CARS[base]!.m), hours: Math.round(hours * 2) / 2, dollars: Math.round(dollars * 4) / 4 }; return cache;
  }
  /** the car from the side at the zoom asked for (fit: the whole car in the box) */
  function sideImg(m: CarModel, key: string, bw: number): Img { const mm = Math.max(3, m.length / (bw - 8) / zoom), under = mode === 'engine', k = key + '|' + mm.toFixed(2) + under;
    if (k !== sideKey || !side) { side = under ? rasterizeFlat(viewDesign(m, 'left', undefined, { chassis: true }), { mm, shadow: true }) : applyWear(rasterizeFlat(viewDesign(m, 'left'), { mm, shadow: true }), wear); sideKey = k; } return side; }
  /** one car's part for a slot, drawn alone, cropped to itself */
  function thumb(slot: Slot, k: number): Img | null { const key = slot + k; if (thumbs.has(key)) return thumbs.get(key)!;
    const m = CARS[k]!.m, v = VIEW_OF[slot]; let d = viewDesign(m, v, slot === 'wheel' ? undefined : p => p.slot === slot);
    if (slot === 'wheel') { d = viewDesign(m, 'left'); d.panels = []; d.wheels = d.wheels.slice(0, 1); } else d.wheels = [];
    if (!d.panels.length && !d.wheels.length) { thumbs.set(key, null); return null; }
    const im = rasterizeFlat(d, { mm: 8, shadow: false }); let x0 = im.w, y0 = im.h, x1 = 0, y1 = 0;
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (im.rgba[(y * im.w + x) * 4 + 3]! > 40) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < x0) { thumbs.set(key, null); return null; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, rgba = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) rgba.set(im.rgba.subarray(((y0 + y) * im.w + x0) * 4, ((y0 + y) * im.w + x1 + 1) * 4), y * w * 4);
    const t = { w, h, rgba }; thumbs.set(key, t); return t; }
  /** a picture into a box: fitted (scaled down, or up by whole steps), centred, on a ground */
  function blit(im: Img, bx: number, by: number, bw: number, bh: number, ground: RGB, fit = true, ox = 0, oy = 0) {
    S.fill(bx, by, bw, bh, ground); const k = fit ? Math.min(bw / im.w, bh / im.h, 3) : 1, sc = k >= 1 ? Math.max(1, Math.floor(k)) : k, w = im.w * sc, h = im.h * sc;
    const x0 = bx + Math.floor((bw - w) / 2) + ox, y0 = by + Math.floor((bh - h) / 2) + oy;
    for (let y = Math.max(by, y0); y < Math.min(by + bh, y0 + h); y++) for (let x = Math.max(bx, x0); x < Math.min(bx + bw, x0 + w); x++) {
      const sx = Math.min(im.w - 1, Math.floor((x - x0) / sc)), sy = Math.min(im.h - 1, Math.floor((y - y0) / sc)), j = (sy * im.w + sx) * 4, a = im.rgba[j + 3]! / 255; if (a < 0.05) continue; S.px(x, y, [im.rgba[j]!, im.rgba[j + 1]!, im.rgba[j + 2]!], a); } }
  /** a slider: drag along the bar; returns the new value when it moved */
  function slider(id: string, x: number, y: number, w: number, v: number, lo: number, hi: number, step = 0.05, mark = 1): number | null { void id;
    const p = ui.pointer(), over = p.x >= x - 2 && p.x < x + w + 2 && p.y >= y - 3 && p.y < y + 8;
    S.fill(x, y + 2, w, 3, COL.well); const t = (v - lo) / (hi - lo), kx = Math.round(x + t * w), one = Math.round(x + (mark - lo) / (hi - lo) * w);
    S.fill(one, y, 1, 7, COL.inkSoft); S.fill(kx - 2, y - 1, 5, 9, over ? COL.lit : hex('#c9a45a')); S.fill(kx - 1, y, 3, 7, hex('#e8c878'));
    if (p.down && over) { const n = Math.round((lo + Math.max(0, Math.min(1, (p.x - x) / w)) * (hi - lo)) / step) * step; if (Math.abs(n - v) > 0.001) return n; } return null; }

  /** the engine: its layout, valve gear, bore and stroke, gears; and how it goes into the engine room */
  function enginePanel(c: NonNullable<typeof cache>) {
    const e = eng ?? ownEngine(), own = ownEngine(), set = (n: EngineSpec) => { eng = n; };
    const row = (y: number, label: string, text: string, id: string, prev: () => void, next: () => void) => { ui.label({ x: 286, y: y + 2, w: 40, h: 9 }, label, COL.ink);
      if (ui.button(id + '-', { x: 326, y, w: 12, h: 12 }, '<')) prev(); ui.label({ x: 340, y: y + 2, w: 70, h: 9 }, text, COL.ink, 'c'); if (ui.button(id + '+', { x: 412, y, w: 12, h: 12 }, '>')) next(); };
    const li = Math.max(0, LAYOUTS.findIndex(l => l.id === e.layout)), vi = Math.max(0, VALVES.findIndex(v => v.id === e.kind));
    row(164, '배치', LAYOUTS[li]!.name, 'lay', () => set({ ...e, layout: LAYOUTS[(li + LAYOUTS.length - 1) % LAYOUTS.length]!.id }), () => set({ ...e, layout: LAYOUTS[(li + 1) % LAYOUTS.length]!.id }));
    row(177, '밸브', VALVES[vi]!.name, 'val', () => set({ ...e, kind: VALVES[(vi + VALVES.length - 1) % VALVES.length]!.id }), () => set({ ...e, kind: VALVES[(vi + 1) % VALVES.length]!.id }));
    for (const [k, lo, hi, y] of [['bore', 65, 110, 193], ['stroke', 80, 140, 203]] as const) { ui.label({ x: 286, y: y - 1, w: 26, h: 9 }, k === 'bore' ? '보어' : '행정', COL.ink);
      const v = slider('e' + k, 312, y, 112, e[k], lo, hi, 0.5, own[k]); ui.label({ x: 428, y: y - 1, w: 44, h: 9 }, `${e[k].toFixed(1)} mm`, COL.ink, 'r'); if (v !== null) set({ ...e, [k]: v }); }
    ui.label({ x: 286, y: 214, w: 30, h: 9 }, '변속', COL.ink); [3, 4].forEach((g, i) => { if (ui.tab('gear' + g, { x: 318 + i * 30, y: 212, w: 28, h: 12 }, `${g}단`, gears === g)) { gears = g; if (!eng) eng = own; } });
    if (ui.button('eng-own', { x: 412, y: 212, w: 60, h: 12 }, '원래 엔진')) { eng = null; gears = 3; }
    const f = c.engFit, [gl, gc] = f ? GRADE[f.grade] : GRADE.own;
    S.fill(286, 227, 36, 11, gc); ui.label({ x: 286, y: 228, w: 36, h: 9 }, f ? gl : '원래', COL.cream, 'c');
    ui.label({ x: 326, y: 228, w: 146, h: 9 }, `${c.cc.toLocaleString()} cc${f ? ` · 엔진룸 채움 ${f.fill}%` : ''}`, COL.ink);
    if (f) ui.label({ x: 286, y: 239, w: 186, h: 9 }, f.notes.join(', '), f.grade === 'no' ? COL.bad : COL.inkSoft); }
  /** the paint and how the car has worn */
  function paintPanel() {
    ui.label({ x: 286, y: 164, w: 186, h: 9 }, '칠 색 (다시 누르면 원래 색)', COL.ink);
    PAINTS.forEach(([n, h], i) => { const x = 286 + (i % 4) * 47, y = 174 + Math.floor(i / 4) * 13;
      if (ui.tab('paint' + i, { x, y, w: 45, h: 12 }, '   ' + n, colour === h)) colour = colour === h ? null : h; S.fill(x + 3, y + 3, 6, 6, hex(h)); });
    if (ui.tab('wings', { x: 286, y: 201, w: 70, h: 12 }, '펜더 검정', blackWings)) blackWings = !blackWings;
    if (ui.button('paint-own', { x: 360, y: 201, w: 52, h: 12 }, '원래 칠')) { colour = null; blackWings = true; }
    if (ui.button('wear-new', { x: 416, y: 201, w: 56, h: 12 }, '새 차로')) wear = { ...NEW };
    ui.label({ x: 286, y: 217, w: 28, h: 9 }, '낡음', COL.ink);
    for (const [k, lab, x] of [['dent', '찌그러짐', 316], ['lamp', '깨진 램프', 372]] as const) if (ui.tab('w' + k, { x, y: 215, w: 54, h: 12 }, lab, wear[k])) wear = { ...wear, [k]: !wear[k] };
    for (const [k, lab, y] of [['rust', '녹', 230], ['fade', '바램', 239]] as const) { ui.label({ x: 286, y: y - 1, w: 26, h: 9 }, lab, COL.ink); const v = slider('w' + k, 312, y, 120, wear[k], 0, 1, 0.05, 0); ui.label({ x: 436, y: y - 1, w: 36, h: 9 }, `${Math.round(wear[k] * 100)}%`, COL.ink, 'r'); if (v !== null) wear = { ...wear, [k]: Math.round(v * 100) / 100 }; } }

  return { id: 'builder',
    frame() {
      S.fill(0, 0, 480, 270, COL.wood2);
      const top = { x: 4, y: 4, w: 472, h: 16 }; ui.panel(top, 'enamel'); const [t, b] = split({ x: 10, y: 7, w: 460, h: 11 }, ['*', 60], 4);
      ui.label({ x: 10, y: 8, w: 110, h: 9 }, '부품 빌더 (시험)', COL.cream); if (ui.button('back', b!, '돌아가기')) { app.pop(); return; } void t;
      (['parts', 'engine', 'paint'] as const).forEach((md, i) => { if (ui.tab('mode' + md, { x: 184 + i * 64, y: 6, w: 60, h: 12 }, ({ parts: '부품', engine: '엔진', paint: '칠 · 낡음' } as const)[md], mode === md)) { mode = md; picker = false; } });
      // the base car
      const left = { x: 4, y: 24, w: 172, h: 222 }; ui.panel(left, 'card'); ui.label({ x: 10, y: 27, w: 160, h: 9 }, '바탕 차', COL.inkSoft);
      CARS.forEach((c, k) => { const r = { x: 10 + (k % 2) * 81, y: 36 + Math.floor(k / 2) * 10.5, w: 78, h: 10 }; if (ui.tab('base' + k, r, c.short, base === k)) { base = k; for (const s in pick) delete pick[s as Slot]; for (const s in adj) delete adj[s as Slot]; grades.clear(); sel = null; picker = false; } });
      // the slots: click one to choose its part
      const c = build(); ui.label({ x: 10, y: 100, w: 160, h: 9 }, '자리 · 끼운 부품 · 맞음', COL.inkSoft);
      SLOTS.forEach((s, k) => { const y = 111 + k * 15, cur = pick[s.id], f = c.fits[s.id] ?? { grade: 'own' as Grade, notes: [], change: 0 };
        if (ui.button('slot' + s.id, { x: 8, y, w: 124, h: 13 }, `${s.name} · ${cur === null ? '없음' : CARS[cur ?? base]!.short}`, { down: sel === s.id })) { sel = s.id; picker = true; }
        const [gl, gc] = GRADE[f.grade]; S.fill(134, y + 1, 38, 11, gc); ui.label({ x: 134, y: y + 2, w: 38, h: 9 }, gl, COL.cream, 'c'); });
      const right = { x: 180, y: 24, w: 296, h: 222 }; ui.panel(right, 'card');
      if (picker && sel) {
        // the parts that can go on the slot, large, each with how it would fit
        const slot = sel, name = SLOTS.find(q => q.id === slot)!.name; ui.label({ x: 186, y: 27, w: 220, h: 9 }, `${name}: 끼울 부품을 고른다`, COL.ink);
        if (ui.button('pclose', { x: 420, y: 26, w: 50, h: 12 }, '닫기')) picker = false;
        const opts: (number | null)[] = [...CARS.map((_, k) => k), null];
        opts.forEach((k, i) => { const tx = 184 + Math.round((i % 5) * 57.6), ty = 40 + Math.floor(i / 5) * 59, tw = 55, th = 56;
          const chosen = (pick[slot] === undefined ? base : pick[slot]) === k, hov = ui.pointer().x >= tx && ui.pointer().x < tx + tw && ui.pointer().y >= ty && ui.pointer().y < ty + th;
          S.fill(tx - 1, ty - 1, tw + 2, th + 2, chosen ? COL.ok : hov ? COL.lit : COL.card2);
          if (k === null) { S.fill(tx, ty, tw, th - 21, TILE); ui.label({ x: tx, y: ty + 18, w: tw, h: 9 }, slot === 'wheel' ? '(뺄 수 없음)' : '달지 않기', COL.inkSoft, 'c'); }
          else { const im = thumb(slot, k); if (im) blit(im, tx, ty, tw, th - 21, TILE); else { S.fill(tx, ty, tw, th - 21, TILE); ui.label({ x: tx, y: ty + 18, w: tw, h: 9 }, '이 차엔 없음', COL.inkSoft, 'c'); } }
          const gk = `${base}|${slot}|${k}`; let g = grades.get(gk); if (g === undefined) { g = k === null ? 'none' : k === base ? 'own' : fitSlot(CARS[base]!.m, CARS[k]!.m, slot).fit.grade; grades.set(gk, g); }
          const [gl, gc] = GRADE[g]; S.fill(tx, ty + th - 21, tw, 10, TILE); ui.label({ x: tx, y: ty + th - 21, w: tw, h: 9 }, k === null ? '없음' : CARS[k]!.short, COL.ink, 'c'); S.fill(tx, ty + th - 11, tw, 11, gc); ui.label({ x: tx + 2, y: ty + th - 10, w: tw - 4, h: 9 }, gl, COL.cream, 'c');
          if (hov && ui.missed() && !(k === null && slot === 'wheel')) { if (k === base) delete pick[slot]; else pick[slot] = k; picker = false; app.sound.once('tick'); } });
        return;
      }
      // the car as it comes out: large, zoom and move
      const vb = { x: 184, y: 28, w: 288, h: 120 }, im = sideImg(c.m, c.key, vb.w), p = ui.pointer(), inView = p.x >= vb.x && p.x < vb.x + vb.w && p.y >= vb.y && p.y < vb.y + vb.h;
      if (p.down && inView && !ui.hoverAny) { if (!drag) drag = { x: p.x, y: p.y, px: panX, py: panY }; panX = drag.px + p.x - drag.x; panY = drag.py + p.y - drag.y; } else drag = null;
      if (zoom === 1) { panX = 0; panY = 0; }
      blit(im, vb.x, vb.y, vb.w, vb.h, BG, false, Math.round(panX), Math.round(panY));
      for (const [id, lab, dz] of [['zin', '+', 1.5], ['zout', '-', 1 / 1.5]] as const) { const r = { x: id === 'zin' ? 432 : 448, y: 30, w: 14, h: 12 }; if (ui.button(id, r, lab)) { zoom = Math.max(1, Math.min(6, zoom * dz)); panX *= dz; panY *= dz; } }
      if (ui.button('zfit', { x: 400, y: 30, w: 30, h: 12 }, '전체')) { zoom = 1; panX = 0; panY = 0; }
      ui.label({ x: 188, y: 31, w: 80, h: 9 }, `${Math.round(zoom * 100)}%${zoom > 1 ? ' · 끌어서 이동' : ''}`, COL.inkSoft);
      blit(c.front, 184, 164, 96, 78, BG);
      const dk = c.kg - c.kg0; S.fill(184, 150, 288, 11, hex('#d6d0bf'));
      ui.label({ x: 188, y: 151, w: 284, h: 9 }, `무게 ${c.kg.toLocaleString()} kg${dk ? ` (${dk > 0 ? '+' : ''}${dk})` : ''} · 작업 ${c.hours}시간 · 재료 $${c.dollars.toFixed(2)}${mode === 'engine' ? ' · 밑에서 본 차대' : ''}`, COL.ink);
      if (mode === 'engine') { enginePanel(c); return; }
      if (mode === 'paint') { paintPanel(); return; }
      // how each changed slot fits
      let ny = 164; for (const s of SLOTS) { const f = c.fits[s.id]; if (!f || f.grade === 'own') continue; if (ny > 194) break;
        ny += 10 * ui.paragraph({ x: 286, y: ny, w: 186, h: 20 }, `${s.name}: ${GRADE[f.grade][0]} · ${f.notes.join(', ')}`, f.grade === 'no' ? COL.bad : COL.ink); }
      if (ny === 164) ui.label({ x: 286, y: 164, w: 186, h: 9 }, '왼쪽에서 자리를 누른다', COL.inkSoft);
      // the chosen slot's part reshaped: sliders
      S.hline(286, 471, 205, COL.card2);
      if (!sel || sel === 'wheel' || pick[sel] === null) { ui.label({ x: 286, y: 208, w: 186, h: 9 }, sel === 'wheel' ? '바퀴는 규격만 바꾼다' : '자리를 고르면 모양을 바꿀 수 있다', COL.inkSoft); return; }
      const slot = sel, a = adj[slot] ?? NO_ADJUST; ui.label({ x: 286, y: 207, w: 140, h: 9 }, `${SLOTS.find(q => q.id === slot)!.name} 모양 (자리에 맞춘 크기 대비)`, COL.ink);
      if (ui.button('adjreset', { x: 432, y: 206, w: 40, h: 11 }, '되돌림')) delete adj[slot];
      (['size', 'width', 'length'] as const).forEach((k, i) => { const y = 219 + i * 9;
        ui.label({ x: 286, y: y - 1, w: 24, h: 9 }, ({ size: '크기', width: '폭', length: '길이' } as const)[k], COL.ink);
        const v = slider('sl-' + k, 312, y, 124, a[k], 0.6, 1.5); ui.label({ x: 440, y: y - 1, w: 32, h: 9 }, `${Math.round(a[k] * 100)}%`, COL.ink, 'r');
        if (v !== null) { const n = { ...a, [k]: v }; if (n.size === 1 && n.width === 1 && n.length === 1) delete adj[slot]; else adj[slot] = n; } });
    } };
}
