// Across the kitchen table (version one, step 3; review 57): the customer sits with a cup of tea; the card beside him is
// what the shop knows of the job. Ask him about it over the tea (twice at most: the budget, and damage he kept quiet
// about, may come out; a cup of tea out of the larder makes him easier); then a price and a day, said across the table,
// and he answers at once. Twice turned down and he goes; agreed, he leaves the car and walks home. The clock stands.
import type { App } from '../shell/app';
import type { Rect } from '../pixel/kit';
import { COL, split } from '../pixel/kit';
import { newHouse } from '../../core/house';

const KIND: Record<string, string> = { rust: '녹', dent: '찌그러짐', lamp: '깨진 헤드램프', roof: '찢어진 지붕 천' };
/** a damage in words: the part and what is wrong with it (a broken lamp or a torn roof names its part already) */
const says = (d: { part: string; kind: string }) => (d.kind === 'lamp' || d.kind === 'roof' ? KIND[d.kind]! : `${PART[d.part] ?? d.part} ${KIND[d.kind] ?? d.kind}`);
const PART: Record<string, string> = { body: '차체', cowl: '카울', hood: '보닛', fenderF: '앞 펜더', fenderR: '뒤 펜더', splash: '흙받이', apron: '앞 에이프런', lamp: '헤드램프', roof: '지붕', shell: '라디에이터 껍데기' };
export const PANEL: Rect = { x: 292, y: 26, w: 184, h: 150 };
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function consultation(app: App, leave: (drive: boolean) => void) {
  let job = -1, price = 0, dayN = 0, tries = 0, said: string[] = [], served = false;
  const W = () => app.world!;
  /** the job at the table, if a customer sits there and the talk is open */
  const open = (): number | null => { const h = W().sim.g.house; if (!h?.visitor || !h.car) return null; try { return W().repair.view(h.car).state === 'asked' ? h.car : null; } catch { return null; } };
  function start(id: number) { const v = W().repair.view(id), j = W().repair.job(id); job = id; tries = 0; said = []; served = false;
    price = Math.max(5, Math.round(W().repair.fairPrice(v.damages))); dayN = Math.max(2, days(W().clock.today, v.wantBy) - 1); void j; }
  /** draw the card; returns true while the talk is on (the clock stands, the table is his) */
  function draw(): boolean { const id = open(); if (id === null) { job = -1; return false; } if (id !== job) start(id);
    const ui = app.ui, R = W().repair, v = R.view(id), j = R.job(id), max = 2, left = Math.max(0, max - j.consults), pantry = ((W().sim.g.house ??= newHouse()).pantry ??= { tea: 1, coffee: 1 });
    ui.panel(PANEL, 'card'); const x = PANEL.x + 6, w = PANEL.w - 12; let y = PANEL.y + 4;
    ui.label({ x, y, w, h: 10 }, `${v.name} 씨 · ${v.car}`, COL.ink); y += 11;
    const dmg = v.damages.map(d => `${says(d)}${d.severity > 0.7 ? ' (심함)' : ''}`).join(' · ');
    y += 10 * ui.paragraph({ x, y, w, h: 20 }, `손볼 곳: ${dmg || '없음'}`, COL.ink);
    ui.label({ x, y, w, h: 10 }, `원하는 날: ${days(W().clock.today, v.wantBy) > 0 ? days(W().clock.today, v.wantBy) + '일 안' : '되도록 빨리'} · 예산: ${v.budget ? `$${v.budget[0]}~${v.budget[1]}` : '모름'}`, COL.inkSoft); y += 11;
    if (said.length) { y += 10 * ui.paragraph({ x, y, w, h: 20 }, said[said.length - 1]!, COL.bad); }
    // talk over tea
    const [ask, tea] = split({ x, y, w, h: 13 }, ['*', 58], 4);
    if (ui.button('c-ask', ask!, left ? `사정을 묻는다 (${left})` : '할 말은 다 했다', { disabled: !left })) { const r = R.consult(id); app.sound.once('murmur');
      const bits = [r.budget ? `예산은 $${j.budget[0]}~${j.budget[1]} 정도라 한다.` : '', r.hidden ? `말 안 한 곳이 있었다: ${j.damages.filter(d => d.hidden).map(says).join(' · ')}.` : ''].filter(Boolean);
      said.push(bits.length ? bits.join(' ') : '별말이 없다.'); }
    if (ui.button('c-tea', tea!, served ? '차를 냈다' : '차를 낸다', { disabled: served || pantry.tea <= 0 })) { served = true; pantry.tea = Math.max(0, pantry.tea - 1); app.sound.once('pour'); setTimeout(() => app.sound.once('clink'), 700); if (j.consults > 0) j.consults--; said.push('찻잔을 받아 들며 조금 누그러진다.'); }
    y += 16;
    // the offer
    const [pl, ps] = split({ x, y, w, h: 13 }, [34, '*'], 4); ui.label(pl!, '값', COL.ink);
    const np = ui.stepper('c-price', ps!, price, { min: 1, max: 500, step: 1 }, n => `$${n}`); if (np !== null) price = np; y += 15;
    const [dl, ds] = split({ x, y, w, h: 13 }, [34, '*'], 4); ui.label(dl!, '날짜', COL.ink);
    const nd = ui.stepper('c-days', ds!, dayN, { min: 1, max: 40, step: 1 }, n => `${n}일 뒤`); if (nd !== null) dayN = nd; y += 17;
    const [ok, no] = split({ x, y, w, h: 14 }, ['*', 54], 4);
    if (ui.button('c-offer', ok!, '이 값에 맡아 드리죠')) { app.sound.once('murmur');
      if (R.offer(id, price, dayN)) { app.toast(`${v.name} 씨가 고개를 끄덕인다. $${price}, ${dayN}일 뒤. 차는 두고 걸어서 간다.`); app.sound.once('chime'); leave(false); }
      else if (++tries >= 2) { R.decline(id); app.toast(`${v.name} 씨가 모자를 집어 든다. "다른 데를 알아보겠소."`); leave(true); }
      else said.push(`"그 값은 좀…" (한 번 더 말해 볼 수 있다)`); }
    if (ui.button('c-no', no!, '못 맡겠다')) { R.decline(id); app.toast(`${v.name} 씨를 돌려보냈다.`); leave(true); }
    return true; }
  return { draw, open: () => open() !== null };
}
