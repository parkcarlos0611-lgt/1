// The garage's bay (version one, step 4; review 58): the customer's car stands on the floor, at its true size, with its
// damage on it. The work card beside it: the rust and paint by hand on the body stand (ui/scenes/bodywork.ts, the
// customer's paint and the job's rust, some of it under the paint), and the rest at the bench (a dent beaten out, a lamp
// glass or a roof cloth replaced: hours on the clock and materials paid). Finished, the job goes to the customer
// (repair.finish) and waits to be collected (step 5).
import type { App } from '../shell/app';
import { COL, split, type Rect } from '../pixel/kit';
import { newHouse, type BayState } from '../../core/house';
import { post } from '../../core/ledger';
import { addDays } from '../../core/calendar';
import type { Damage, JobResult } from '../../core/repair';
import { bodyworkScene } from '../scenes/bodywork';
import { carSprite, type CarSprite } from './car';

const KIND: Record<string, string> = { rust: '녹 · 칠', dent: '찌그러짐 펴기', lamp: '헤드램프 유리 갈기', roof: '지붕 천 갈기' };
const PART: Record<string, string> = { body: '차체', cowl: '카울', hood: '보닛', fenderF: '앞 펜더', fenderR: '뒤 펜더', splash: '흙받이', apron: '앞 에이프런', lamp: '헤드램프', roof: '지붕', shell: '라디에이터' };
export const BAY_PANEL: Rect = { x: 300, y: 26, w: 176, h: 150 };
const W = 480, H = 270, MM = 15, FLOOR = 238, MID = 186;
const key = (d: Damage) => `${d.kind}:${d.part}`;

export function bayPlace(app: App, passTime: (minutes: number) => void) {
  const scenes = new Map<number, ReturnType<typeof bodyworkScene>>();
  let sprite: { key: string; sp: CarSprite } | null = null;
  const house = () => (app.world!.sim.g.house ??= newHouse());
  const bay = (): BayState | null => { const b = house().bay; if (!b) return null; try { app.world!.repair.job(b.job); return b; } catch { house().bay = undefined; return null; } };
  /** the damage still showing on the car: not yet put right at the bench; rust until the bodywork is done (rust under the paint never shows) */
  const showing = (b: BayState) => app.world!.repair.job(b.job).damages.filter(d => !b.fixed.includes(key(d)) && !(d.kind === 'rust' && (b.body || d.hidden)));

  /** the car on the floor, lit by the room (`k` the placeholder picture's light) */
  function drawCar(d: Uint8ClampedArray, k: number) { const b = bay(); if (!b) return; const j = app.world!.repair.job(b.job), dm = showing(b), sk = j.car.colour + dm.map(key).join();
    if (!sprite || sprite.key !== sk) { const sp = carSprite(j.car.colour, dm, { mm: MM, driver: false }); if (!sp) return; sprite = { key: sk, sp }; }
    const sp = sprite.sp, ox = Math.round(MID - sp.anchor[0]), oy = Math.round(FLOOR - sp.anchor[1]);
    // its shadow on the concrete
    const rx = sp.w * 0.5, ry = 6; for (let y = FLOOR - ry; y <= FLOOR + ry; y++) for (let x = Math.floor(MID - rx); x <= MID + rx; x++) { if (x < 0 || x >= W || y >= H) continue; const q = ((x - MID) / rx) ** 2 + ((y - FLOOR) / ry) ** 2; if (q >= 1) continue; const i = (y * W + x) * 4, f = 1 - 0.55 * (1 - q); d[i] = d[i]! * f; d[i + 1] = d[i + 1]! * f; d[i + 2] = d[i + 2]! * f; }
    for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) { const j4 = (y * sp.w + x) * 4; if (sp.rgba[j4 + 3]! < 128) continue; const X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const i = (Y * W + X) * 4, top = 1 - 0.12 * (y / sp.h); d[i] = Math.min(255, sp.rgba[j4]! * k * top * 1.04); d[i + 1] = Math.min(255, sp.rgba[j4 + 1]! * k * top); d[i + 2] = Math.min(255, sp.rgba[j4 + 2]! * k * top * 0.92); } }

  /** the work card; returns whether there is a car in the bay */
  function panel(): boolean { const b = bay(); if (!b) return false; const ui = app.ui, R = app.world!.repair, v = R.view(b.job), j = R.job(b.job);
    ui.panel(BAY_PANEL, 'card'); const x = BAY_PANEL.x + 6, w = BAY_PANEL.w - 12; let y = BAY_PANEL.y + 4;
    ui.label({ x, y, w, h: 10 }, `${v.name} 씨 · ${v.car}`, COL.ink); y += 10;
    ui.label({ x, y, w, h: 10 }, j.state === 'agreed' ? `약속 ${v.due} · $${v.price}` : j.state === 'ready' ? '다 고쳤다 · 손님을 기다린다' : '', COL.inkSoft); y += 13;
    const rust = j.damages.filter(d => d.kind === 'rust'), seen = rust.filter(d => !d.hidden || j.revealed.hidden);
    if (rust.length) { const [l, bt] = split({ x, y, w, h: 13 }, ['*', 54], 4);
      ui.label({ ...l!, y: y + 2, h: 9 }, b.body ? `녹 · 칠: 만족 ${b.body.satisfaction}` : `녹 · 칠: ${seen.length ? seen.map(d => PART[d.part] ?? d.part).join(', ') : '살펴볼 것'}`, b.body ? COL.ok : COL.ink);
      if (j.state === 'agreed' && ui.button('bay-body', bt!, b.body ? '다시 본다' : '차체 작업')) openBody(b); y += 15; }
    for (const d of j.damages.filter(d => d.kind !== 'rust' && (!d.hidden || j.revealed.hidden))) { const done = b.fixed.includes(key(d)), wk = R.work(d), [l, bt] = split({ x, y, w, h: 13 }, ['*', 54], 4);
      ui.label({ ...l!, y: y + 2, h: 9 }, `${KIND[d.kind] ?? d.kind}${d.kind === 'dent' ? ' · ' + (PART[d.part] ?? d.part) : ''}`, done ? COL.ok : COL.ink);
      if (ui.button('bay-' + key(d), bt!, done ? '끝' : `${wk.hours}시간 $${wk.materials}`, { disabled: done || j.state !== 'agreed' })) {
        b.fixed.push(key(d)); b.minutes += wk.hours * 60; post(app.world!.sim.api(), 'materials', -wk.materials, `repair ${j.id} ${d.kind}`); app.sound.once(d.kind === 'dent' ? 'knock' : 'clink'); passTime(wk.hours * 60); }
      y += 15; }
    if (j.state === 'agreed' && ui.button('bay-done', { x, y: BAY_PANEL.y + BAY_PANEL.h - 18, w, h: 14 }, '작업을 끝낸다')) finish(b);
    return true; }

  function openBody(b: BayState) { const R = app.world!.repair, j = R.job(b.job), v = R.view(b.job); let s = scenes.get(b.job);
    if (!s) { s = bodyworkScene(app, { title: `${v.name} 씨의 ${v.car} · 녹 · 칠`, colour: j.car.colour, rust: j.damages.filter(d => d.kind === 'rust').map(d => ({ part: d.part, severity: d.severity, hidden: d.hidden })),
      done: (r, m) => { b.body = r; b.minutes += m; passTime(m); if (j.damages.some(d => d.hidden)) j.revealed.hidden = true; app.toast(`차체 작업을 마쳤다. 손님 만족 ${r.satisfaction}점.`); },
      away: m => { b.minutes += m; passTime(m); } }); scenes.set(b.job, s); }
    app.push(s); }

  /** what the customer will find: the bodywork's result, less for what was not done at the bench */
  function finish(b: BayState) { const R = app.world!.repair, j = R.job(b.job), hasRust = j.damages.some(d => d.kind === 'rust'), undone = j.damages.filter(d => d.kind !== 'rust' && !b.fixed.includes(key(d))).length;
    const body: JobResult | null = hasRust ? b.body ?? null : null, sat = Math.max(0, (body ? body.satisfaction : hasRust ? 25 : 92) - undone * 30);
    R.finish(b.job, { satisfaction: sat, backChance: body ? body.backChance : hasRust ? 0.7 : 0.04, hours: b.minutes / 60, parts: body?.parts });
    // he comes for it on the day agreed (or, finished late, the next morning)
    const C = app.world!.clock, due = j.due ?? C.today, date = due > C.today ? due : addDays(C.today, 1); C.schedule({ date, minute: 9 * 60 + (j.id * 47) % 420, kind: 'repair_collect', ref: j.id });
    app.sound.once('chime'); app.toast(undone || (hasRust && !body) ? '손을 덜 댄 채 끝냈다. 손님이 알아챌 것이다.' : '일이 끝났다. 차는 손님이 찾으러 올 때까지 차고에 있다.'); }

  return { drawCar, panel, has: () => !!bay() };
}
