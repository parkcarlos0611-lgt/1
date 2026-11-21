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
import fordT from '../../data/cars/sheet/fordT23.json';
import chev from '../../data/cars/sheet/chevAB28.json';
import plym from '../../data/cars/sheet/plymU29.json';
import pontiac from '../../data/cars/sheet/pontiac29.json';
import dodge from '../../data/cars/sheet/dodgeV28.json';
import willys from '../../data/cars/sheet/willys27.json';
import buick from '../../data/cars/sheet/buick28.json';
import hudson from '../../data/cars/trial/hudson26_hudson_fable.json';

const CARS: { m: CarModel; short: string }[] = [
  [fordT, '1923 소형'], [chev, '1928 경세단'], [plym, '1929 경4기통'], [pontiac, '1929 6기통'], [dodge, '1928 6기통'], [willys, '1927 슬리브'], [buick, '1928 4도어'], [hudson, '1926 대형']]
  .map(([m, s]) => ({ m: m as unknown as CarModel, short: s as string }));
const GRADE: Record<Grade, [string, RGB]> = { own: ['원래', hex('#8a8478')], fits: ['맞음', hex('#3f6e3a')], work: ['손봄', hex('#b07a1e')], no: ['안 맞음', hex('#a8402c')], none: ['없음', hex('#5a5550')] };
const BG: RGB = hex('#e6e2d6'), TILE: RGB = hex('#efebe0');
/** the view a slot's part is best seen in, for its picture in the picker */
const VIEW_OF: Record<Slot, ViewName> = { grille: 'front', lamp: 'front', bumperF: 'front', bumperR: 'rear', tail: 'rear', fenderF: 'left', fenderR: 'left', board: 'left', wheel: 'left' };
type Img = { w: number; h: number; rgba: Uint8ClampedArray };

export function builderScene(app: App): Scene {
  const ui = app.ui, S = app.S;
  let base = 1, sel: Slot | null = null, picker = false, zoom = 1, panX = 0, panY = 0, drag: { x: number; y: number; px: number; py: number } | null = null;
  const pick: Partial<Record<Slot, number | null>> = {}, adj: Partial<Record<Slot, Adjust>> = {};
  let cache: { key: string; m: CarModel; front: Img; fits: ReturnType<typeof assemble>['fits'] } | null = null, sideKey = '', side: Img | null = null;
  const thumbs = new Map<string, Img | null>(), grades = new Map<string, Grade>();
  function build() {
    const key = base + JSON.stringify(pick) + JSON.stringify(adj); if (cache?.key === key) return cache;
    const choice: Partial<Record<Slot, CarModel | null>> = {}; for (const [s, k] of Object.entries(pick)) choice[s as Slot] = k === null ? null : CARS[k!]!.m;
    const r = assemble(CARS[base]!.m, choice, adj), m = r.model;
    cache = { key, m, front: rasterizeFlat(viewDesign(m, 'front'), { mm: Math.max(10, Math.ceil(m.height / 100)), shadow: true }), fits: r.fits }; return cache;
  }
  /** the car from the side at the zoom asked for (fit: the whole car in the box) */
  function sideImg(m: CarModel, key: string, bw: number): Img { const mm = Math.max(3, m.length / (bw - 8) / zoom), k = key + '|' + mm.toFixed(2);
    if (k !== sideKey || !side) { side = rasterizeFlat(viewDesign(m, 'left'), { mm, shadow: true }); sideKey = k; } return side; }
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
  function slider(id: string, x: number, y: number, w: number, v: number, lo: number, hi: number): number | null {
    const p = ui.pointer(), over = p.x >= x - 2 && p.x < x + w + 2 && p.y >= y - 3 && p.y < y + 8;
    S.fill(x, y + 2, w, 3, COL.well); const t = (v - lo) / (hi - lo), kx = Math.round(x + t * w), one = Math.round(x + (1 - lo) / (hi - lo) * w);
    S.fill(one, y, 1, 7, COL.inkSoft); S.fill(kx - 2, y - 1, 5, 9, over ? COL.lit : hex('#c9a45a')); S.fill(kx - 1, y, 3, 7, hex('#e8c878'));
    if (p.down && over) { const n = Math.round((lo + Math.max(0, Math.min(1, (p.x - x) / w)) * (hi - lo)) * 20) / 20; if (Math.abs(n - v) > 0.001) return n; } return null; }

  return { id: 'builder',
    frame() {
      S.fill(0, 0, 480, 270, COL.wood2);
      const top = { x: 4, y: 4, w: 472, h: 16 }; ui.panel(top, 'enamel'); const [t, b] = split({ x: 10, y: 7, w: 460, h: 11 }, ['*', 60], 4);
      ui.label({ ...t!, y: 8, h: 9 }, '부품 빌더 (시험) · 자리를 누르면 끼울 부품이 크게 나온다', COL.cream); if (ui.button('back', b!, '돌아가기')) { app.pop(); return; }
      // the base car
      const left = { x: 4, y: 24, w: 172, h: 222 }; ui.panel(left, 'card'); ui.label({ x: 10, y: 27, w: 160, h: 9 }, '바탕 차', COL.inkSoft);
      CARS.forEach((c, k) => { const r = { x: 10 + (k % 2) * 81, y: 38 + Math.floor(k / 2) * 15, w: 78, h: 13 }; if (ui.tab('base' + k, r, c.short, base === k)) { base = k; for (const s in pick) delete pick[s as Slot]; for (const s in adj) delete adj[s as Slot]; grades.clear(); sel = null; picker = false; } });
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
        opts.forEach((k, i) => { const tx = 184 + (i % 3) * 97, ty = 40 + Math.floor(i / 3) * 68, tw = 94, th = 65;
          const chosen = (pick[slot] === undefined ? base : pick[slot]) === k, hov = ui.pointer().x >= tx && ui.pointer().x < tx + tw && ui.pointer().y >= ty && ui.pointer().y < ty + th;
          S.fill(tx - 1, ty - 1, tw + 2, th + 2, chosen ? COL.ok : hov ? COL.lit : COL.card2);
          if (k === null) { S.fill(tx, ty, tw, th - 12, TILE); ui.label({ x: tx, y: ty + 22, w: tw, h: 9 }, slot === 'wheel' ? '(뺄 수 없음)' : '달지 않기', COL.inkSoft, 'c'); }
          else { const im = thumb(slot, k); if (im) blit(im, tx, ty, tw, th - 12, TILE); else { S.fill(tx, ty, tw, th - 12, TILE); ui.label({ x: tx, y: ty + 22, w: tw, h: 9 }, '이 차엔 없음', COL.inkSoft, 'c'); } }
          const gk = `${base}|${slot}|${k}`; let g = grades.get(gk); if (g === undefined) { g = k === null ? 'none' : k === base ? 'own' : fitSlot(CARS[base]!.m, CARS[k]!.m, slot).fit.grade; grades.set(gk, g); }
          const [gl, gc] = GRADE[g]; S.fill(tx, ty + th - 11, tw, 11, gc); ui.label({ x: tx + 2, y: ty + th - 10, w: tw - 4, h: 9 }, `${k === null ? '없음' : CARS[k]!.short} · ${gl}`, COL.cream, 'c');
          if (hov && ui.missed() && !(k === null && slot === 'wheel')) { if (k === base) delete pick[slot]; else pick[slot] = k; picker = false; app.sound.once('tick'); } });
        return;
      }
      // the car as it comes out: large, zoom and move
      const vb = { x: 184, y: 28, w: 288, h: 132 }, im = sideImg(c.m, c.key, vb.w), p = ui.pointer(), inView = p.x >= vb.x && p.x < vb.x + vb.w && p.y >= vb.y && p.y < vb.y + vb.h;
      if (p.down && inView && !ui.hoverAny) { if (!drag) drag = { x: p.x, y: p.y, px: panX, py: panY }; panX = drag.px + p.x - drag.x; panY = drag.py + p.y - drag.y; } else drag = null;
      if (zoom === 1) { panX = 0; panY = 0; }
      blit(im, vb.x, vb.y, vb.w, vb.h, BG, false, Math.round(panX), Math.round(panY));
      for (const [id, lab, dz] of [['zin', '+', 1.5], ['zout', '-', 1 / 1.5]] as const) { const r = { x: id === 'zin' ? 432 : 448, y: 30, w: 14, h: 12 }; if (ui.button(id, r, lab)) { zoom = Math.max(1, Math.min(6, zoom * dz)); panX *= dz; panY *= dz; } }
      if (ui.button('zfit', { x: 400, y: 30, w: 30, h: 12 }, '전체')) { zoom = 1; panX = 0; panY = 0; }
      ui.label({ x: 188, y: 31, w: 80, h: 9 }, `${Math.round(zoom * 100)}%${zoom > 1 ? ' · 끌어서 이동' : ''}`, COL.inkSoft);
      blit(c.front, 184, 164, 96, 78, BG);
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
