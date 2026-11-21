// The part builder, first form (reviews 60, 66): opened from the title. Pick a base car; for each slot (grille, lamps,
// wings, boards, bumpers, tail lamp, wheels) pick whose part goes on it; the car is drawn as it comes out, side and
// front, and each slot says how its part fits: its own, fits as it is, fits with work, does not fit (render/car/swap.ts).
import type { App, Scene } from '../shell/app';
import { COL, split } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { viewDesign, type CarModel } from '../../render/car/model';
import { rasterizeFlat } from '../../render/car/flat';
import { SLOTS, assemble, type Slot, type Grade } from '../../render/car/swap';
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
const GRADE: Record<Grade, [string, RGB]> = { own: ['원래', hex('#8a8478')], fits: ['맞음', hex('#3f6e3a')], work: ['손봄', hex('#b07a1e')], no: ['안 맞음', hex('#a8402c')] };
const BG: RGB = hex('#e6e2d6');

export function builderScene(app: App): Scene {
  const ui = app.ui, S = app.S;
  let base = 1; const pick: Partial<Record<Slot, number>> = {}; let cache: { key: string; side: ReturnType<typeof rasterizeFlat>; front: ReturnType<typeof rasterizeFlat>; fits: ReturnType<typeof assemble>['fits'] } | null = null;
  function build() {
    const key = base + JSON.stringify(pick); if (cache?.key === key) return cache;
    const choice: Partial<Record<Slot, CarModel>> = {}; for (const [s, k] of Object.entries(pick)) choice[s as Slot] = CARS[k!]!.m;
    const r = assemble(CARS[base]!.m, choice), m = r.model;
    const sideMM = Math.max(10, Math.ceil(m.length / 280)), frontMM = Math.max(10, Math.ceil(m.height / 100));
    cache = { key, side: rasterizeFlat(viewDesign(m, 'left'), { mm: sideMM, shadow: true }), front: rasterizeFlat(viewDesign(m, 'front'), { mm: frontMM, shadow: true }), fits: r.fits }; return cache;
  }
  /** a car picture into the screen, centred in a box, on the light ground */
  function blit(im: { w: number; h: number; rgba: Uint8ClampedArray }, bx: number, by: number, bw: number, bh: number) {
    S.fill(bx, by, bw, bh, BG); const ox = bx + Math.floor((bw - im.w) / 2), oy = by + Math.floor((bh - im.h) / 2);
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const j = (y * im.w + x) * 4, a = im.rgba[j + 3]! / 255; if (a < 0.05) continue; const X = ox + x, Y = oy + y; if (X < bx || Y < by || X >= bx + bw || Y >= by + bh) continue; S.px(X, Y, [im.rgba[j]!, im.rgba[j + 1]!, im.rgba[j + 2]!], a); } }
  return { id: 'builder',
    frame() {
      S.fill(0, 0, 480, 270, COL.wood2);
      const top = { x: 4, y: 4, w: 472, h: 16 }; ui.panel(top, 'enamel'); const [t, b] = split({ x: 10, y: 7, w: 460, h: 11 }, ['*', 60], 4);
      ui.label({ ...t!, y: 8, h: 9 }, '부품 빌더 (시험) · 다른 차의 부품을 끼워 본다', COL.cream); if (ui.button('back', b!, '돌아가기')) { app.pop(); return; }
      // the base car
      const left = { x: 4, y: 24, w: 172, h: 222 }; ui.panel(left, 'card'); ui.label({ x: 10, y: 27, w: 160, h: 9 }, '바탕 차', COL.inkSoft);
      CARS.forEach((c, k) => { const r = { x: 10 + (k % 2) * 81, y: 38 + Math.floor(k / 2) * 15, w: 78, h: 13 }; if (ui.tab('base' + k, r, c.short, base === k)) { base = k; for (const s in pick) delete pick[s as Slot]; } });
      // the slots
      const c = build(); ui.label({ x: 10, y: 100, w: 160, h: 9 }, '자리 · 가져올 차 · 맞음', COL.inkSoft);
      SLOTS.forEach((s, k) => { const y = 111 + k * 15, cur = pick[s.id] ?? base, f = c.fits[s.id] ?? { grade: 'own' as Grade, notes: [], change: 0 };
        ui.label({ x: 10, y: y + 2, w: 38, h: 9 }, s.name, COL.ink);
        if (ui.button('p' + s.id, { x: 48, y, w: 12, h: 13 }, '<')) pick[s.id] = (cur + CARS.length - 1) % CARS.length;
        ui.label({ x: 61, y: y + 2, w: 58, h: 9 }, CARS[cur]!.short, cur === base ? COL.inkSoft : COL.ink, 'c');
        if (ui.button('n' + s.id, { x: 120, y, w: 12, h: 13 }, '>')) pick[s.id] = (cur + 1) % CARS.length;
        const [gl, gc] = GRADE[f.grade]; S.fill(134, y + 1, 38, 11, gc); ui.label({ x: 134, y: y + 2, w: 38, h: 9 }, gl, COL.cream, 'c'); });
      // the car as it comes out
      const right = { x: 180, y: 24, w: 296, h: 222 }; ui.panel(right, 'card');
      blit(c.side, 184, 28, 288, 132); blit(c.front, 184, 164, 96, 78);
      let ny = 166; for (const s of SLOTS) { const f = c.fits[s.id]; if (!f || f.grade === 'own') continue; if (ny > 236) break;
        ui.label({ x: 286, y: ny, w: 186, h: 9 }, `${s.name}: ${GRADE[f.grade][0]} · ${f.notes.join(', ')}`, f.grade === 'no' ? COL.bad : COL.ink); ny += 10; }
      if (ny === 166) ui.label({ x: 286, y: 166, w: 186, h: 9 }, '왼쪽에서 자리마다 가져올 차를 고른다', COL.inkSoft);
    } };
}
