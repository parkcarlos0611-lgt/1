// GEARHOUSE 1930-1949 test build: scenes, designers, monthly loop, save/load. All UI is pixel-drawn (ui.mjs).
import * as AU from './audio.mjs';
import { lang, hooks } from './ui.mjs';
import { scrollArea } from './ui.mjs';
import { W, H, C, Sheet, drawPix, input, text, tw, windowBox, panel, button, slider, cycler, bar, stat, graph, desk, bevel, rivet, lineTo } from './ui.mjs';
import { eraPalette, hex } from '../tools/pixel/color.mjs';
import { buildCar } from '../tools/pixel/gen/car.mjs';
import { genBody, clampParams, limits } from '../tools/pixel/gen/bodygen.mjs';
import { engineSV } from '../tools/pixel/gen/engineSV.mjs';
import { flatheadV8, ohvI6, ptPalette } from '../tools/pixel/gen/engine40.mjs';
import { engineSide } from '../tools/pixel/gen/props.mjs';
import { engineStats, LAYOUTS, HEADS, maxCR } from '../sim/engine.mjs';
import { drawCutaway, fired } from './cutaway.mjs';
import { makeAssembly, drawAssembly } from './assembly.mjs';
import { TEMPLATES, available, makeBody, landmarks } from '../tools/pixel/gen/v2/template.mjs';
import { newDesign, sideSpec, frontSpec, rearSpec, optionsFor, ranges, clampDesign } from '../tools/pixel/gen/v3/design.mjs';
import { buildFront } from '../tools/pixel/gen/front.mjs';
import { baseWidth } from '../sim/dims.mjs';
import { LIMITS, dimsFor, SIZE } from '../sim/dims.mjs';
import { GEARBOX, proposeRatios, rpmTrace } from '../sim/drive.mjs';
import { COUNTRIES, SEGS, TECH, RES_SCALE, newGame, stepMonth, evaluate, appeal, dateNum, has, BANK_OPTS, bankOption } from './world.mjs';

const PAINTS = ['#2f3a4a', '#5c1c27', '#3f5a40', '#7d3a2c', '#4b6283', '#d8c9a0', '#1d1d22', '#6b5a3a', '#8c2a24', '#6b6e70'];
const P = ptPalette(eraPalette()); PAINTS.forEach((h, i) => P.auto('paint.c' + i, h)); P.auto('paint.enginecream', '#b9ae8e'); P.auto('bare', '#9aa0a6', { sat: 0.2 }); P.auto('primerRed', '#8a3b2a'); P.auto('primerGrey', '#7d8085'); P.auto('canvas', '#3b3631', { sat: 0.5 });
{ const seen = new Set(); const scan = o => { if (typeof o === 'string' && o.startsWith('paint.')) seen.add(o); else if (o && typeof o === 'object') Object.values(o).forEach(scan); }; TEMPLATES.forEach(t => scan(t.spec)); [...seen].forEach(n => { try { P.id(n); } catch { P.auto(n, '#3a4250'); } }); }
const S = new Sheet(W, H, C.desk), cv = document.getElementById('screen'), ctx = cv.getContext('2d'), img = new ImageData(S.d, W, H);
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } } };
const app = { scene: 'title', g: null, tab: 'cars', t: 0, settings: { fill: true, scan: true, lang: (navigator.language || '').startsWith('ko') ? 'ko' : 'en', music: 0.6, sfx: 0.8, ...(store.get('gh_settings') || {}) },
  ng: { country: 'USA', year: 1930, capital: 250000, research: 'medium', name: 'GEARHOUSE MOTOR CO.' }, toast: null, cache: new Map() };
const NAMES = ['GEARHOUSE MOTOR CO.', 'IRONWOOD AUTO WORKS', 'MERIDIAN MOTORS', 'BRASS & SONS CARRIAGE', 'NORTHLINE AUTOMOBILE', 'VALEN MOTOR WORKS'];
const toast = t => (app.toast = { t, until: app.t + 150 });

// ---------- sprite caches ----------
const tyreFor = y => (y < 1933 ? '4.75-19' : y < 1936 ? '5.50-17' : y < 1946 ? '6.00-16' : '6.70-15');
function carSprite(year, body, paintIdx, type, rot = 0) {
  const key = JSON.stringify([year, body, paintIdx, type, rot]); if (app.cache.has(key)) return app.cache.get(key);
  const wbRef = SIZE[body.size || 'medium'], q = clampParams({ ...body, year, type, tire: tyreFor(year), paint: 'paint.c' + paintIdx, fenderPaint: body.style === 'box' && body.blackFenders ? 'black' : 'paint.c' + paintIdx }); q.wbRef = wbRef;
  const L = LIMITS[type] || LIMITS.sedan4d; if (q.hWB * wbRef > L.h[1]) { q.hWB = L.h[1] / wbRef; q.notes.push(`HEIGHT CAPPED AT ${L.h[1]}MM (TALLEST REAL ${type === 'coupe2d' ? 'COUPE' : 'SEDAN'} +3%)`); }
  let px = null, len = q.wb * 1.6; try { const s = genBody(q); len = s.len; Object.assign(s, { grad: [3.1, 1.4], glassStyle: 'period' }); s.wheel = { ...s.wheel, rot }; px = buildCar(P, s, Math.max(25, Math.ceil(s.len / 190))); } catch (e) { console.warn(e); }
  const out = { px, q, dims: dimsFor(type, q, len, body.widthAdj ?? 0.5) }; app.cache.set(key, out); if (app.cache.size > 140) app.cache.delete(app.cache.keys().next().value); return out; }
// body generator v2: measured template (+ blend partner) re-proportioned by the section warp
function v2Sprite(v, paintIdx, rot = 0) {
  const key = 'V2' + JSON.stringify([v.base, v.partner, v.mix, v.wb, v.roof, v.widthAdj, paintIdx, rot]); if (app.cache.has(key)) return app.cache.get(key);
  let out = { px: null }; try { const { spec, lm, tpl } = makeBody({ ...v, paint: 'paint.c' + paintIdx }); spec.wheel = { ...(spec.wheel || {}), rot };
    const L2 = landmarks(spec), LIM = LIMITS[tpl.type] || LIMITS.sedan4d, width = Math.round(Math.max(LIM.w[0], Math.min(LIM.w[1], baseWidth(lm.wb) * (0.94 + 0.12 * (v.widthAdj ?? 0.5)))));
    out = { px: buildCar(P, spec, Math.max(25, Math.ceil(spec.len / 190))), spec, lm, tpl, dims: { len: Math.round(spec.len), width, height: Math.round(L2.roof), wb: Math.round(spec.v2.wb), track: width - 290 }, L2 }; } catch (e) { console.warn(e); }
  app.cache.set(key, out); if (app.cache.size > 140) app.cache.delete(app.cache.keys().next().value); return out; }
// body designer v3: one parametric record -> side / front / rear
function v3Sprite(des, paintIdx, view = 'side', rot = 0) {
  const key = 'V3' + view + JSON.stringify(des) + paintIdx + rot; if (app.cache.has(key)) return app.cache.get(key);
  let out = { px: null }; try { const paint = 'paint.c' + paintIdx;
    if (view === 'side') { const spec = sideSpec(des, paint); spec.wheel = { ...spec.wheel, rot }; out = { px: buildCar(P, spec, Math.max(25, Math.ceil(spec.len / 190))), spec }; }
    else out = { px: buildFront(P, (view === 'front' ? frontSpec : rearSpec)(des, paint), 25) }; } catch (e) { console.warn(e); }
  app.cache.set(key, out); if (app.cache.size > 160) app.cache.delete(app.cache.keys().next().value); return out; }
// blueprint re-scan: white linework on blue paper revealed by a moving scan bar
function blueprint(px, x0, y0, prog) { const sy = Math.round(px.h * prog); S.fill(x0 - 2, y0 - 2, px.w + 4, px.h + 4, hex('#1f4e8c'));
  for (let y = 0; y < px.h; y += 6) S.fill(x0 - 2, y0 + y, px.w + 4, 1, hex('#2a5d9e')); for (let x = 0; x < px.w; x += 6) S.fill(x0 + x, y0 - 2, 1, px.h + 4, hex('#2a5d9e'));
  for (let y = 0; y < Math.min(px.h, sy); y++) for (let x = 0; x < px.w; x++) { const i = y * px.w + x; if (!px.r[i] || px.t[i] === 1) continue; const edge = px.l[i] < 0 || px.t[i] === 9 || px.t[i] === 10; if (edge) S.fill(x0 + x, y0 + y, 1, 1, hex('#e6f0ff')); else if ((x + y) % 7 === 0) S.fill(x0 + x, y0 + y, 1, 1, hex('#6d97cc')); }
  if (prog < 1) { S.fill(x0 - 2, y0 + sy, px.w + 4, 2, hex('#fff8c8')); S.fill(x0 - 2, y0 + sy + 2, px.w + 4, 1, hex('#9fc4ff')); } }
function engineSprite(e, maxW = 140, maxH = 84) {
  const key = 'E' + JSON.stringify([e.layout, e.head, e.bore, e.stroke, maxW, maxH]); if (app.cache.has(key)) return app.cache.get(key);
  const L = LAYOUTS[e.layout]; let px = null;
  const make = mm => { if (e.head === 'sv' && L.banks === 1) return engineSV(P, { cyl: L.cyl, bore: e.bore, stroke: e.stroke, color: 'paint.enginegreen' }, mm);
    if (e.head === 'sv') return flatheadV8(P, { bore: e.bore, stroke: e.stroke, perBank: L.cyl / 2, color: L.cyl > 8 ? 'paint.engineGrey' : 'iron' }, mm);
    if (L.banks === 1 && L.cyl === 6) return ohvI6(P, { bore: e.bore, stroke: e.stroke, color: 'paint.engineGrey', box: 'none' }, mm);
    return engineSide(P, { layout: L.banks > 1 ? 'V' : 'inline', cyl: L.cyl / L.banks, bore: e.bore, stroke: e.stroke, head: 'ohv', cover: 'paint.enginered' }, mm); };
  try { for (const mm of [10, 11, 12, 13, 14, 16, 18, 20, 23, 26]) { px = make(mm); px.mm = mm; if (px.w <= maxW && px.h <= maxH) break; } } catch (err) { console.warn(err); }
  app.cache.set(key, px); return px; }

// ---------- scenes ----------
function title() {
  desk(S); const t = app.t;
  for (let x = 0; x < W; x++) S.fill(x, 196, 1, 74, x % 16 < 8 ? hex('#3a2a20') : hex('#30221b'));   // workshop floor
  S.fill(0, 195, W, 1, C.brassD);
  text(S, 'GEARHOUSE', 240 - tw('GEARHOUSE', 5) / 2 + 3, 33, C.black, 5); text(S, 'GEARHOUSE', 240 - tw('GEARHOUSE', 5) / 2, 30, C.brass, 5);
  text(S, 'MOTOR COMPANY SIMULATION - 1930-1949 TEST BUILD', 240 - tw('MOTOR COMPANY SIMULATION - 1930-1949 TEST BUILD') / 2, 62, C.paperDark);
  // passing car: drives FORWARD (front is on the left -> moves right to left), wheels roll without slipping, 1px bob, exhaust puffs
  const lap = 900, k = Math.floor(t / lap), yr = 1930 + (k % 20), u = (t % lap) / lap, speed = 0.75;
  const pool = TEMPLATES.filter(t => t.year <= yr && ['sedan4d', 'coupe2d', 'wagon'].includes(t.type)), tp = pool[(k * 7) % pool.length];
  const dist = (t % lap) * speed, wheelR = 340 / 25, FR = 16, frame = ((Math.floor(dist / wheelR / (2 * Math.PI / FR)) % FR) + FR) % FR;
  const car = v2Sprite({ base: tp.id, mix: 0, roof: 0 }, k % 8, frame * 2 * Math.PI / FR).px;
  if (car) { const cx = Math.round(W - dist), bob = (Math.floor(dist / 7) % 2); app.puffs = (app.puffs || []).filter(p => p.life > 0);
    if (t % 9 === 0) app.puffs.push({ x: cx + car.w - 4, y: 192 - 6, life: 60 });
    for (const p of app.puffs) { p.x += 0.25; p.y -= 0.12; p.life--; const a = p.life / 60, r = 1 + (60 - p.life) / 20; S.fill(p.x - r, p.y - r, r * 2, r * 2, a > 0.5 ? hex('#6a5e55') : hex('#4a3f38')); }
    drawPix(S, car, P, cx, 196 - car.h + 4 - bob, 1);
    AU.passBy({ layout: yr >= 1946 ? 'V8' : yr >= 1936 ? 'V8' : yr >= 1932 ? 'I6' : 'I4', head: yr >= 1946 ? 'ohv' : 'sv', litres: 3.5 }, yr, (cx + car.w / 2) / W); if (dist > W + car.w - 2) AU.passEnd(); }
  text(S, String(yr), 446, 186, C.brass);
  const bx = 190, items = [['NEW GAME', () => (app.scene = 'newgame')], ['CONTINUE', () => (app.scene = 'load')], ['SETTINGS', () => (app.scene = 'settings')]];
  items.forEach(([l, f], i) => { if (button(S, bx, 86 + i * 22, 100, 17, l)) f(); });
}
function settings() {
  desk(S); windowBox(S, 130, 30, 220, 210, 'SETTINGS'); const st = app.settings;
  st.lang = cycler(S, 145, 52, 190, 'LANGUAGE', ['ko', 'en'], st.lang, { names: v => (v === 'ko' ? '한국어' : 'ENGLISH') }); lang.ko = st.lang === 'ko';
  st.fill = cycler(S, 145, 76, 190, 'DISPLAY SCALE', [true, false], st.fill !== false, { names: v => (v ? 'FILL SCREEN' : 'SHARP (WHOLE PIXELS)') });
  st.scan = cycler(S, 145, 100, 190, 'CRT SCANLINES', [true, false], st.scan, { names: v => (v ? 'ON' : 'OFF') });
  st.music = slider(S, 145, 126, 190, 'MUSIC VOLUME', st.music, 0, 1, { step: 0.05, fmt: v => Math.round(v * 100) + '%' });
  st.sfx = slider(S, 145, 146, 190, 'SOUND FX VOLUME', st.sfx, 0, 1, { step: 0.05, fmt: v => Math.round(v * 100) + '%' }); AU.vol.music = st.music; AU.vol.sfx = st.sfx; AU.applyVolume();
  text(S, 'SAVES ARE KEPT IN THIS BROWSER ONLY.', 145, 172, C.inkSoft); text(S, 'FONT: GALMURI (SIL OFL 1.1) BY QUIPLE', 145, 184, C.inkSoft);
  if (button(S, 145, 212, 80, 16, 'BACK')) { store.set('gh_settings', st); resize(); app.scene = app.g ? 'hq' : 'title'; }
}
function newgame() {
  desk(S); windowBox(S, 60, 20, 360, 230, 'NEW COMPANY'); const n = app.ng;
  n.name = cycler(S, 75, 42, 200, 'COMPANY NAME', NAMES, n.name);
  n.country = cycler(S, 75, 68, 200, 'HOME COUNTRY', Object.keys(COUNTRIES), n.country, { names: k => COUNTRIES[k].name });
  n.year = Math.round(slider(S, 75, 96, 200, 'START YEAR', n.year, 1930, 1945, { step: 1, fmt: v => String(Math.round(v)) }));
  n.capital = cycler(S, 75, 116, 200, 'STARTING CAPITAL', [100000, 250000, 500000], n.capital, { names: money });
  n.research = cycler(S, 75, 142, 200, 'RESEARCH DEPARTMENT', Object.keys(RES_SCALE), n.research, { names: k => `${k.toUpperCase()} (${RES_SCALE[k].pts} PTS, ${money(RES_SCALE[k].cost)}/MO)` });
  n.diff = cycler(S, 75, 168, 200, 'DIFFICULTY', ['easy', 'normal', 'hard'], n.diff || 'normal', { names: k => ({ easy: 'EASY - FORGIVING MARKET', normal: 'NORMAL', hard: 'HARD - TOUGH BUYERS' })[k] });
  const c = COUNTRIES[n.country]; panel(S, 290, 42, 115, 120, 'COUNTRY');
  [['WEALTH', c.wealth], ['FUEL COST', c.fuel / 1.8], ['ROADS', c.roads], ['WAGES', c.wage]].forEach(([l, v], i) => { text(S, l, 295, 54 + i * 16, C.ink); bar(S, 295, 61 + i * 16, 105, 5, v, i === 1 ? C.red : C.teal); });
  text(S, `MARKET ${n.year}: ${(c.market[n.year] || 0)}K CARS`, 295, 122, C.ink); text(S, `WAR: ${c.war[0]}-${c.war[1]}`, 295, 132, C.red);
  if (button(S, 75, 222, 80, 16, 'BACK')) app.scene = 'title';
  if (button(S, 325, 222, 80, 16, 'FOUND IT', { tone: 'ox' })) { app.g = newGame(n); app.draft = null; app.edraft = null; app.scene = 'hq'; app.tab = 'engines'; }
}
function load() {
  desk(S); windowBox(S, 120, 40, 240, 180, 'LOAD COMPANY');
  for (let i = 1; i <= 3; i++) { const sv = store.get('gh_slot_' + i), y = 66 + (i - 1) * 40; panel(S, 135, y, 210, 32);
    if (sv) { text(S, sv.name, 140, y + 5, C.ink); text(S, `${MONTHS[sv.month - 1]} ${sv.year}  ${money(sv.cash)}`, 140, y + 14, C.inkSoft); if (button(S, 290, y + 8, 48, 15, 'LOAD')) { app.g = sv; app.scene = 'hq'; app.tab = 'news'; } }
    else text(S, `SLOT ${i} - EMPTY`, 140, y + 12, C.inkSoft); }
  if (button(S, 135, 196, 80, 16, 'BACK')) app.scene = 'title';
}
// ---------- HQ ----------
const TABS = [['news', 'OFFICE'], ['engines', 'ENGINES'], ['gearbox', 'GEARBOX'], ['cars', 'CAR DESIGN'], ['prod', 'PRODUCTION'], ['research', 'RESEARCH'], ['market', 'MARKET'], ['finance', 'FINANCE'], ['save', 'SAVE'], ['menu', 'MENU']];
function hq() {
  const g = app.g; desk(S);
  bevel(S, 0, 0, W, 16, C.oxblood, C.oxL, C.oxD); rivet(S, 4, 7); rivet(S, W - 6, 7);
  text(S, g.name, 10, 6, C.brassL); const dt = `${MONTHS[g.month - 1]} ${g.year}`; text(S, dt, 200, 6, C.white);
  text(S, money(g.cash), 280, 6, g.cash < 0 ? hex('#ffb0a0') : C.brassL); text(S, `REP ${Math.round(g.rep * 100)}`, 360, 6, C.white); if (g.loan > 0) text(S, `LOAN ${money(g.loan)}`, 280, 0 + 11, hex('#ffb0a0'));
  if (button(S, W - 52, 2, 44, 12, AU.vol.muted ? 'SOUND' : 'MUTE', { tone: 'ox' })) { AU.vol.muted = !AU.vol.muted; AU.applyVolume(); }
  TABS.forEach(([k, l], i) => { if (button(S, 3, 20 + i * 19, 66, 16, l, { active: app.tab === k, tone: k === 'menu' || k === 'save' ? 'teal' : 'brass' })) app.tab = k; });
  if (!g.over && button(S, 3, 222, 66, 22, 'NEXT MONTH', { tone: 'ox' })) { const n0 = g.news[0]; stepMonth(g); AU.sfx(g.news[0] !== n0 ? 'wire' : 'type'); if (g.last?.sales) AU.sfx('till'); }
  if (!g.over && button(S, 3, 246, 66, 16, '+6 MONTHS')) { for (let i = 0; i < 6 && !g.over; i++) stepMonth(g); }
  ({ news, engines, gearbox, cars, prod, research, market, finance, save, menu })[app.tab]?.(g);
  if (g.meeting && !g.over) { windowBox(S, 120, 60, 260, 150, 'MEETING AT THE BANK'); text(S, 'YOUR CREDIT IS EXHAUSTED FOR 3 MONTHS.', 134, 84, C.ink); text(S, 'CHOOSE A RESCUE PLAN:', 134, 94, C.oxblood);
    BANK_OPTS.forEach(([k, l], i) => { if (button(S, 134, 108 + i * 22, 232, 17, l, { tone: k === 'merge' ? 'ox' : 'brass' })) { bankOption(g, k); AU.sfx('wire'); } }); return; }
  if (g.over) { app.scene = 'end'; return; }
  if (false) { windowBox(S, 130, 80, 240, 100, 'THE BOOKS ARE CLOSED'); text(S, g.over, 145, 104, C.oxblood); text(S, `FINAL CASH ${money(g.cash)}`, 145, 118); text(S, `CARS SOLD ${g.models.reduce((a, m) => a + (m.sold || 0), 0).toLocaleString()}`, 145, 128);
    text(S, `REPUTATION ${Math.round(g.rep * 100)}`, 145, 138); if (button(S, 145, 155, 90, 16, 'TITLE')) { app.scene = 'title'; app.g = null; } }
}
const AX = 74, AY = 20, AW = W - AX - 3, AH = H - AY - 3;
function news(g) { windowBox(S, AX, AY, AW, AH, 'OFFICE - NEWS WIRE & SUMMARY');
  panel(S, AX + 8, AY + 22, 220, AH - 30, 'TELEGRAMS'); scrollArea(S, 'news', AX + 9, AY + 31, 218, AH - 40, g.news.length * 9 + 4, dy => g.news.forEach((n, i) => { const y = AY + 33 + i * 9 - dy, yy = Math.floor(n.d / 12), mm = n.d % 12; text(S, n.d ? `${MONTHS[mm]} ${yy}` : '----', AX + 12, y, C.oxblood); text(S, n.t, AX + 50, y, C.ink, 1, 172); }));
  const x = AX + 236; panel(S, x, AY + 22, AW - 244, 90, 'THIS MONTH'); const l = g.last || { rev: 0, cost: 0, sales: 0 };
  stat(S, x + 5, AY + 34, 'CARS SOLD', l.sales.toLocaleString()); stat(S, x + 5, AY + 44, 'REVENUE', money(l.rev)); stat(S, x + 5, AY + 54, 'COSTS', money(l.cost), C.red); stat(S, x + 5, AY + 64, 'PROFIT', money(l.rev - l.cost), l.rev >= l.cost ? C.green : C.red);
  stat(S, x + 5, AY + 78, 'FACTORY', `${g.factory}/MO`); stat(S, x + 5, AY + 88, 'MODELS', `${g.models.filter(m => !m.dead).length}`); stat(S, x + 5, AY + 98, 'RESEARCH', g.resCur ? TECH.find(t => t.id === g.resCur).name.slice(0, 16) : 'IDLE', g.resCur ? C.ink : C.red);
  panel(S, x, AY + 118, AW - 244, 110, 'HOW TO PLAY'); ['1 ENGINES: DESIGN + TOOL UP', '2 GEARBOX: PICK TYPE + RATIOS', '3 CAR DESIGN: BODY, ENGINE,', '  SEGMENT, PRICE -> LAUNCH', '4 PRODUCTION: MONTHLY OUTPUT', '5 RESEARCH NEW TECH', '6 NEXT MONTH. SURVIVE TO 1950.', '', 'OLD TECH LOSES APPEAL OVER', 'TIME - KEEP MODERNISING.'].forEach((s, i) => text(S, s, x + 5, AY + 130 + i * 9, C.ink)); }

function engines(g) { windowBox(S, AX, AY, AW, AH, 'ENGINE DESIGN - FAMILY + VARIANT');
  const e = app.edraft || (app.edraft = { ...g.engines[0], id: null, name: 'NEW ENGINE', quality: 0 });
  panel(S, AX + 6, AY + 20, 112, AH - 26, 'YOUR ENGINES'); scrollArea(S, 'englist', AX + 7, AY + 29, 110, AH - 46, g.engines.length * 15 + 4, dy => g.engines.forEach((x, i) => { const y = AY + 31 + i * 15 - dy, rdy = x.readyAt <= dateNum(g);
    if (button(S, AX + 9, y, 106, 13, `${x.name.slice(0, 13)} ${rdy ? '' : '*'}`, { active: app.edraft?.from === x.id })) app.edraft = { ...x, from: x.id, id: null, name: x.name + ' B' }; }));
  text(S, '* = TOOLING IN PROGRESS', AX + 9, AY + AH - 14, C.inkSoft);
  const x0 = AX + 124, lay = Object.keys(LAYOUTS).filter(k => LAYOUTS[k].year <= g.year), heads = ['sv', 'fh', 'ohv', 'sohc', 'dohc'];
  const headOK = h => h === 'sv' || h === 'fh' || (h === 'ohv' && has(g, 'ohv')) || (h === 'sohc' && has(g, 'ohv') && g.year >= 1946);
  e.layout = cycler(S, x0, AY + 22, 110, 'LAYOUT', lay, e.layout);
  const h2 = cycler(S, x0, AY + 46, 110, 'VALVETRAIN', heads, e.head, { names: h => HEADS[h].name, lock: h => !headOK(h) }); if (headOK(h2)) e.head = h2; else if (h2 !== e.head) toast('RESEARCH NEEDED FOR ' + HEADS[h2].name);
  e.bore = Math.round(slider(S, x0, AY + 72, 110, 'BORE MM', e.bore, 65, 105, { step: 0.5, fmt: v => v.toFixed(1) }) * 2) / 2;
  e.stroke = Math.round(slider(S, x0, AY + 92, 110, 'STROKE MM', e.stroke, 70, 130, { step: 0.5, fmt: v => v.toFixed(1) }) * 2) / 2;
  const crMax = maxCR(g.year, e.head); e.cr = slider(S, x0, AY + 112, 110, `COMPRESSION (MAX ${crMax.toFixed(1)})`, Math.min(e.cr, crMax), 4.5, crMax, { step: 0.1, fmt: v => v.toFixed(1) + ':1' });
  e.cam = slider(S, x0, AY + 132, 110, 'CAM: TORQUE..REVS', e.cam, 0, 1, { step: 0.05 });
  e.carbs = cycler(S, x0, AY + 152, 110, 'CARBURETTORS', has(g, 'twincarb') ? [1, 2] : [1], e.carbs, { names: n => n + 'X DOWNDRAFT' });
  e.carbSize = slider(S, x0, AY + 176, 110, 'CARB SIZE', e.carbSize, 0.6, 1.4, { step: 0.05 });
  e.quality = Math.round(slider(S, x0, AY + 196, 110, 'BUILD QUALITY', e.quality, -3, 3, { step: 1, fmt: v => (v > 0 ? '+' : '') + Math.round(v) }));
  const es = engineStats({ ...e, year: g.year }), x1 = AX + 242;
  panel(S, x1, AY + 20, AW - 248, 76, 'OUTPUT');
  // dyno run: starter (1.1 s) + idle (0.6 s), then the curve is traced while the engine sweeps to redline (2.6 s)
  const dy = app.dyno, pr = dy ? Math.max(0, Math.min(1, (app.t - dy.f0 - 102) / 156)) : 1, cur = dy?.curve || es.curve, k = Math.max(1, Math.round(pr * cur.length));
  const mxT = Math.max(...cur.map(p => Math.max(p.T, p.hp * 2))) * 1.08, ghost = app.lastDyno && app.lastDyno !== cur ? [{ pts: app.lastDyno.map(p => p.T), c: C.paperDark }] : [];
  graph(S, x1 + 4, AY + 30, 66, 62, [...ghost, { pts: cur.slice(0, k).map(p => p.T).concat(Array(Math.max(0, cur.length - k)).fill(NaN)), c: C.teal }, { pts: cur.slice(0, k).map(p => p.hp * 2).concat(Array(Math.max(0, cur.length - k)).fill(NaN)), c: C.red }], { max: mxT, labels: [{ t: 'NM', c: C.teal }, { t: 'HP', c: C.red }] });
  if (dy && pr > 0 && pr < 1) { const p = cur[k - 1]; S.fill(x1 + 5 + Math.round((k - 1) / Math.max(1, cur.length - 1) * 63), AY + 31, 1, 60, C.oxblood); text(S, `${p.rpm} RPM`, x1 + 6, AY + 84, C.oxblood); }
  if (dy && app.t - dy.f0 > 300) { app.lastDyno = dy.curve; app.dyno = null; }
  const sx = x1 + 73; [['DISPLACE', `${es.litres.toFixed(2)}L ${Math.round(es.cid)}CI`], ['POWER', `${es.hp.toFixed(0)}HP @${es.hpRpm}`], ['TORQUE', `${es.torque.toFixed(0)}NM @${es.tRpm}`], ['REDLINE', es.redline + ' RPM'],
    ['MASS', es.mass + ' KG'], ['SMOOTH', Math.round(es.smooth * 100) + '%'], ['RELIABLE', Math.round(es.reliability * 100) + '%'], ['UNIT COST', money(es.cost)]].forEach(([l, v], i) => stat(S, sx, AY + 30 + i * 8, l, v, C.ink, 38));
  const vw = app.engView || 'cut'; panel(S, x1, AY + 100, AW - 248, 100, vw === 'cut' ? 'CUTAWAY' : 'SIDE VIEW (SCALE)');
  if (button(S, x1 + AW - 302, AY + 101, 26, 7, 'CUT', { active: vw === 'cut' })) app.engView = 'cut'; if (button(S, x1 + AW - 274, AY + 101, 26, 7, 'EXT', { active: vw === 'ext' })) app.engView = 'ext';
  if (vw === 'ext') { const spr = engineSprite(e, AW - 256, 80); if (spr) { drawPix(S, spr, P, x1 + 4 + Math.max(0, (AW - 256 - spr.w) / 2) | 0, AY + 108 + Math.max(0, 84 - spr.h) | 0, 1); text(S, `1PX = ${spr.mm}MM`, x1 + 4, AY + 110, C.inkSoft); } }
  else { const live = dy ? (app.t - dy.f0 < 66 ? 0 : app.t - dy.f0 < 102 ? 40 : 40 + pr * 200) : app.visRpm ?? 30, th0 = app.th || 0; app.th = th0 + live * 6 / 60;
    drawCutaway(S, x1 + 4, AY + 110, AW - 256, 74, e, app.th); if (live && live <= 90 && fired(e.layout, th0, app.th).length) AU.sfx('pop');
    if (!dy) app.visRpm = slider(S, x1 + 4, AY + 184, 76, 'CRANK SPEED', app.visRpm ?? 30, 0, 160, { step: 5, fmt: v => (v ? Math.round(v) + '' : 'STOP'), id: 'visrpm' }); }
  if (vw === 'ext') text(S, `${es.len}MM LONG  ${es.height}MM TALL`, x1 + 4, AY + 188, C.inkSoft, 1, AW - 330);
  if (button(S, AX + AW - 70, AY + 186, 62, 12, 'DYNO TEST', { tone: 'teal', disabled: !!app.dyno })) { AU.dyno({ ...e, litres: es.litres }, g.year, es.redline); app.dyno = { f0: app.t, curve: es.curve }; app.engView = 'cut'; }
  const cost = es.tooling, can = g.cash >= cost; text(S, `TOOLING ${money(cost)} / ${es.engMonths} MONTHS`, x1, AY + 206, C.ink);
  if (button(S, x1, AY + 214, 120, 16, 'TOOL UP FAMILY', { tone: 'ox', disabled: !can })) { const id = 'E' + g.serial++; g.engines.push({ ...e, id, from: undefined, name: `${e.layout}-${HEADS[e.head].name.split(' ')[0]} ${es.litres.toFixed(1)}`, readyAt: dateNum(g) + es.engMonths, tooling: cost }); g.cash -= cost; toast('ENGINE TOOLING STARTED'); }
}
function gearbox(g) { windowBox(S, AX, AY, AW, AH, 'GEARBOX + DRIVELINE');
  const d = app.gdraft || (app.gdraft = { type: g.gearboxes[0].type, gears: 3, first: 2.9, top: 1.0 });
  panel(S, AX + 6, AY + 20, 112, AH - 26, 'YOUR GEARBOXES'); g.gearboxes.forEach((x, i) => text(S, `${x.name.slice(0, 16)}${x.readyAt > dateNum(g) ? '*' : ''}`, AX + 10, AY + 32 + i * 10, C.ink));
  const x0 = AX + 124, types = Object.keys(GEARBOX).filter(k => GEARBOX[k].year <= g.year), ok = k => k === 'crash3' || has(g, { sync3: 'sync3', sync4: 'sync4', od3: 'od', fluid: 'fluid', hydra4: 'hydra', tc2: 'hydra' }[k]);
  const t2 = cycler(S, x0, AY + 22, 160, 'TYPE', types, d.type, { names: k => GEARBOX[k].name, lock: k => !ok(k) }); if (ok(t2)) d.type = t2; else if (t2 !== d.type) toast('RESEARCH NEEDED');
  const G = GEARBOX[d.type]; d.gears = Math.max(G.gears[0], Math.min(G.gears[1], d.gears));
  d.gears = cycler(S, x0, AY + 48, 160, 'FORWARD GEARS', Array.from({ length: G.gears[1] - G.gears[0] + 1 }, (_, i) => G.gears[0] + i), d.gears, { names: n => n + ' SPEEDS' });
  d.first = slider(S, x0, AY + 76, 160, '1ST GEAR RATIO', d.first, 2.0, 4.0, { step: 0.05 }); d.top = slider(S, x0, AY + 96, 160, 'TOP GEAR RATIO', d.top, d.type === 'od3' ? 0.7 : 0.9, 1.0, { step: 0.01 });
  const R = proposeRatios(d.gears, d.first, d.top); text(S, 'RATIOS: ' + R.join(' / '), x0, AY + 118, C.oxblood);
  [['EFFICIENCY', Math.round(G.eff * 100) + '%'], ['MASS', G.mass + ' KG'], ['COMFORT', Math.round(G.comfort * 100) + '%'], ['SHIFT TIME', G.shift + ' S'], ['UNIT COST', money(G.cost)]].forEach(([l, v], i) => stat(S, x0, AY + 132 + i * 9, l, v));
  panel(S, AX + 300, AY + 20, AW - 306, 120, 'RATIO LADDER'); R.forEach((r, i) => { const h = Math.round(r / 4 * 90); S.fill(AX + 310 + i * 18, AY + 130 - h, 12, h, C.teal); text(S, String(i + 1), AX + 313 + i * 18, AY + 133, C.ink); });
  if (button(S, x0, AY + 186, 140, 16, `BUILD ($15,000 / 3 MO)`, { tone: 'ox', disabled: g.cash < 15000 })) { g.gearboxes.push({ id: 'G' + g.serial++, name: `${d.gears}-SPD ${G.name.split(' ').slice(-1)[0]}`, type: d.type, gears: d.gears, ratios: R, readyAt: dateNum(g) + 3 }); g.cash -= 15000; toast('GEARBOX TOOLING STARTED'); }
}
function cars(g) { windowBox(S, AX, AY, AW, AH, 'CAR DESIGN STUDIO');
  const readyE = g.engines.filter(e => e.readyAt <= dateNum(g)), readyG = g.gearboxes.filter(x => x.readyAt <= dateNum(g));
  const d = app.draft || (app.draft = { name: 'MODEL ' + String.fromCharCode(65 + g.models.length), type: 'sedan4d', seg: 'family', engineId: readyE[0]?.id, gbId: readyG[0]?.id, final: 4.1, price: 850, trim: 1, paint: 0, feats: {},
    body: { style: 'box', wb: 2800, rake: 0.5, roofR: 0.5, noseR: 0.5, bodyR: 0.5, height: 0.5, hood: 0.5, nose: 0.5, belt: 0.5, blackFenders: true } });
  // ---- body designer v3: one record in mm, three views, era / measured limits; symmetric front & rear parts ----
  let des = d.v3 || (d.v3 = newDesign(g.year, 'sedan4d')); if (des.year !== g.year) des.year = g.year;
  const view = app.dview || 'side', tabs = [['side', 'SIDE'], ['front', 'FRONT'], ['rear', 'REAR']];
  tabs.forEach(([k, l], i) => { if (button(S, AX + 6 + i * 31, AY + 19, 29, 11, l, { active: view === k })) app.dview = k; });
  const R0 = ranges(g.year), opt = (k, key) => optionsFor(key || k, g.year), NM = { sedan4d: '4-DOOR SEDAN', coupe2d: '2-DOOR COUPE' };
  const ctl = [];                                   // [kind, key, label, a, b, fmt]
  if (view === 'side') ctl.push(['cyc', 'type', 'BODY TYPE', ['sedan4d', 'coupe2d'], null, t => NM[t]], ['sl', 'wb', 'WHEELBASE', 1867, 4430, v => Math.round(v) + 'MM', 25], ['sl', 'frontOH', 'FRONT OVERHANG', 380, 1400, v => Math.round(v) + 'MM', 10],
    ['sl', 'rearOH', 'REAR OVERHANG', 300, 1700, v => Math.round(v) + 'MM', 10], ['sl', 'width', 'WIDTH', 1146, 2215, v => Math.round(v) + 'MM', 10], ['sl', 'roof', 'ROOF HEIGHT', ...R0.roof, v => Math.round(v) + 'MM', 5],
    ['sl', 'belt', 'BELT LINE', ...R0.belt, v => Math.round(v * des.roof) + 'MM', 0.005], ['sl', 'hood', 'HOOD HEIGHT', ...R0.hood, v => Math.round(v * des.roof) + 'MM', 0.005], ['sl', 'rake', 'SCREEN RAKE', ...R0.rake, v => Math.round(v) + ' DEG', 1],
    ['sl', 'cowl', 'COWL FROM FRONT AXLE', 500, des.wb * 0.55, v => Math.round(v) + 'MM', 10], ['sl', 'cabin', 'ROOF LENGTH', ...R0.cabin, v => Math.round(v) + 'MM', 10], ['sl', 'crown', 'ROOF CURVE', ...R0.crown, v => Math.round(v) + 'MM', 5],
    ['sl', 'noseRound', 'NOSE ROUND', ...R0.noseRound, v => Math.round(v) + 'MM', 5], ['cyc', 'tail', 'TAIL', opt('tail')], ['sl', 'deck', 'DECK HEIGHT', 0.5, 0.72, v => Math.round(v * des.roof) + 'MM', 0.005],
    ['cyc', 'frontFender', 'FRONT FENDER', opt('frontFender')], ['cyc', 'rearFender', 'REAR FENDER', opt('rearFender')], ['sl', 'fenderCrown', 'FENDER CROWN', 40, 260, v => Math.round(v) + 'MM', 5], ['cyc', 'board', 'RUNNING BOARD', [true, false]],
    ['sl', 'frontDoor', 'FRONT DOOR LENGTH', 800, 1150, v => Math.round(v) + 'MM', 10], ['sl', 'pillarB', 'B PILLAR', 70, 160, v => Math.round(v) + 'MM', 5], ['cyc', 'vent', 'VENT WINGS', [true, false]], ['cyc', 'splitScreen', 'SPLIT SCREEN', [true, false]],
    ['sl', 'louvres', 'HOOD LOUVRES', 0, 16, v => Math.round(v) + '', 1], ['cyc', 'spear', 'SIDE SPEAR', [true, false]], ['cyc', 'spare', 'SPARE', opt('spare')], ['cyc', 'wheel', 'WHEELS', opt('wheel')], ['sl', 'whitewall', 'WHITEWALL', 0, 0.45, v => Math.round(v * 100) + '%', 0.05],
    ['cyc', 'fenderBlack', 'FENDERS BLACK', [true, false]], ['cyc', 'roofTone', 'BLACK ROOF', [true, false]]);
  if (view === 'front') ctl.push(['cyc', 'grille', 'GRILLE', opt('grille')], ['cyc', 'gpattern', 'GRILLE PATTERN', opt('gpattern')], ['sl', 'grilleW', 'GRILLE WIDTH', 0.25, 0.75, v => Math.round(v * des.width) + 'MM', 0.01], ['sl', 'grilleH', 'GRILLE HEIGHT', 0.3, 0.8, v => Math.round(v * 100) + '%', 0.01],
    ['cyc', 'lamp', 'HEADLAMPS', opt('lamp')], ['sl', 'lampR', 'LAMP SIZE', 70, 135, v => Math.round(v * 2) + 'MM', 1], ['sl', 'lampY', 'LAMP SPACING (MIRRORED)', 0.3, 0.9, v => Math.round(v * des.width) + 'MM', 0.01], ['sl', 'lampZ', 'LAMP HEIGHT', 0.5, 0.95, v => Math.round(v * 100) + '%', 0.01],
    ['sl', 'bumperBars', 'BUMPER BARS', 1, 2, v => Math.round(v) + '', 1], ['cyc', 'guards', 'BUMPER GUARDS', [0, 2, 3]], ['cyc', 'fog', 'FOG LAMPS', [false, true]], ['cyc', 'ornament', 'HOOD ORNAMENT', [true, false]]);
  if (view === 'rear') ctl.push(['cyc', 'tailLamp', 'TAIL LAMPS', opt('tailLamp')], ['sl', 'tailY', 'TAIL LAMP SPACING (MIRRORED)', 0.4, 0.95, v => Math.round(v * des.width) + 'MM', 0.01], ['cyc', 'rearWindow', 'REAR WINDOW', opt('rearWindow')], ['cyc', 'spare', 'SPARE', opt('spare')], ['cyc', 'guards', 'BUMPER GUARDS', [0, 2, 3]]);
  const before = JSON.stringify(des);
  scrollArea(S, 'design-' + view, AX + 4, AY + 32, 94, 168, ctl.length * 19 + 6, dy => ctl.forEach(([kind, key, label, a, b, fmt, step], i) => { const y = AY + 34 + i * 19 - dy;
    if (kind === 'sl') des[key] = slider(S, AX + 6, y, 86, label, des[key], a, b, { step: step || 0, fmt: fmt || (v => v.toFixed(2)), id: 'd3' + key });
    else { const list = a.length ? a : [des[key]]; des[key] = cycler(S, AX + 6, y - 2, 86, label, list, list.includes(des[key]) ? des[key] : list[0], { names: fmt || (v => (v === true ? 'YES' : v === false ? 'NO' : String(v).toUpperCase())) }); } }));
  des.doors = des.type === 'coupe2d' ? 2 : 4; des.bumperBars = Math.round(des.bumperBars); des.louvres = Math.round(des.louvres); const notes = clampDesign(des);
  if (JSON.stringify(des) !== before) app.bpT = app.t;                                                          // design changed -> new blueprint scan
  d.paint = cycler(S, AX + 6, AY + 201, 86, 'PAINT', PAINTS.map((_, i) => i), d.paint, { names: i => 'COLOUR ' + (i + 1) }); S.fill(AX + 98 - 10, AY + 210, 6, 7, hex(PAINTS[d.paint]));
  d.type = des.type;
  // preview: blueprint scan after every change, then the rendered car
  const cx = AX + 100, pw = 200, sp = v3Sprite(des, d.paint, 'side'), shown = view === 'side' ? sp : v3Sprite(des, d.paint, view), px = shown.px, spec = sp.spec;
  const dm = { len: spec ? Math.round(spec.len) : 0, width: Math.round(des.width), height: Math.round(des.roof), wb: Math.round(des.wb) };
  panel(S, cx, AY + 20, pw, 92, `L${dm.len} W${dm.width} H${dm.height} WB${dm.wb} MM`);
  if (px) { const ox = cx + Math.max(2, (pw - px.w) / 2) | 0, oy = AY + 108 - px.h, prog = Math.min(1, (app.t - (app.bpT ?? -999)) / 40);
    if (prog < 1) { blueprint(px, ox, oy, prog); if ((app.t - app.bpT) % 8 === 0) AU.sfx('wrench'); } else drawPix(S, px, P, ox, oy, 1); }
  if (notes.length) text(S, 'ERA LIMIT: ' + notes.join(', ').toUpperCase(), cx + 3, AY + 104, C.red, 1, pw - 6);
  const style = des.frontFender === 'integrated' ? 'pontoon' : des.rake > 18 || des.tail === 'fastback' ? 'stream' : 'box', q = { style, notes: [] }, tpl = { style }, v = des;
  // mechanicals
  if (!readyE.length || !readyG.length) { text(S, 'NEED A READY ENGINE AND GEARBOX', cx + 4, AY + 120, C.red); return; }
  d.engineId = cycler(S, cx, AY + 116, 97, 'ENGINE', readyE.map(e => e.id), d.engineId, { names: id => g.engines.find(e => e.id === id).name });
  d.gbId = cycler(S, cx + 103, AY + 116, 97, 'GEARBOX', readyG.map(x => x.id), d.gbId, { names: id => g.gearboxes.find(x => x.id === id).name });
  d.final = slider(S, cx, AY + 140, 97, 'FINAL DRIVE', d.final, 3.0, 5.5, { step: 0.05 }); d.trim = Math.round(slider(S, cx + 103, AY + 140, 97, 'TRIM LEVEL', d.trim, 0, 3, { step: 1, fmt: v => ['BASIC', 'STANDARD', 'DE LUXE', 'CUSTOM'][Math.round(v)] }));
  const fe = [['hydbrake', 'HYD.BRAKES'], ['ifs', 'IND.FRONT'], ['steelroof', 'STEEL ROOF'], ['unibody', 'UNIT BODY']].filter(([k]) => has(g, k));
  fe.forEach(([k, l], i) => { if (button(S, cx + i * 50, AY + 160, 48, 12, l, { active: d.feats[k] })) d.feats[k] = !d.feats[k]; });
  d.seg = cycler(S, cx, AY + 176, 97, 'TARGET SEGMENT', Object.keys(SEGS), d.seg, { names: k => k.toUpperCase() });
  d.price = Math.round(slider(S, cx + 103, AY + 176, 97, 'LIST PRICE', d.price, 350, 5000, { step: 10, fmt: money }));
  const hoodLen = spec ? spec.geo.cowlX - 250 : 1200, b = { belt: 0.5 };
  const car = { ...d, dims: dm, v3: JSON.parse(JSON.stringify(des)), body: { style, wb: dm.wb, hood: hoodLen / Math.max(1, dm.wb), height: dm.height / Math.max(1, dm.wb) }, designScore: 0.68 + (style !== 'box' ? 0.06 : 0) - notes.length * 0.02 + 0 * (1 - Math.abs(b.belt - 0.5)) * 0.08 };
  const ev = evaluate(g, car), x2 = cx + pw + 6, pw2 = AX + AW - x2 - 6;
  panel(S, x2, AY + 20, pw2, 210, 'ENGINEERING REPORT');
  if (ev) { const sm = ev.sim; [['TOP SPEED', `${sm.topMph.toFixed(0)} MPH`], ['0-60 MPH', sm.zeroSixty ? sm.zeroSixty.toFixed(1) + ' S' : 'NEVER'], ['ECONOMY', sm.mpg.toFixed(1) + ' MPG'], ['MAX GRADE', Math.round(sm.grade * 100) + '%'], ['WEIGHT', sm.mass + ' KG'], ['UNIT COST', money(ev.unit)]].forEach(([l, v], i) => stat(S, x2 + 4, AY + 31 + i * 8, l, v, C.ink, 44));
    text(S, ev.fit ? 'ENGINE FITS THE BAY' : 'ENGINE TOO BIG - LONGER HOOD!', x2 + 4, AY + 82, ev.fit ? C.green : C.red, 1, pw2 - 6);
    [['PERFORMANCE', ev.perf], ['ECONOMY', ev.econ], ['COMFORT', ev.comfort], ['RELIABILITY', ev.rel], ['DESIGN', ev.design], ['MODERNITY', ev.modern]].forEach(([l, v], i) => { text(S, l, x2 + 4, AY + 92 + i * 12, C.inkSoft); bar(S, x2 + 4, AY + 98 + i * 12, pw2 - 10, 4, v, v < 0.4 ? C.red : C.teal); });
    const a = appeal(ev, d.seg, d.price); text(S, `APPEAL ${Math.round(a * 100)}`, x2 + 4, AY + 166, a > 0.45 ? C.green : C.oxblood); text(S, `MARGIN ${money(d.price - ev.unit)}`, x2 + 4, AY + 174, d.price > ev.unit ? C.green : C.red);
    const tool = 40000 + dm.wb * 8 + (q.style !== 'box' ? 20000 : 0) + (d.feats.unibody ? 30000 : 0), months = 6 + (q.style === 'stream' ? 2 : q.style === 'pontoon' ? 3 : 0);
    if (button(S, cx, AY + 200, 97, 13, 'WATCH BUILD', { tone: 'teal' })) startAssembly(g, sp.spec, d, 'cars');
    if (button(S, cx + 103, AY + 200, 97, 13, 'TEST DRIVE', { tone: 'teal' })) { const eng = g.engines.find(x => x.id === d.engineId), gbx = g.gearboxes.find(x => x.id === d.gbId); AU.drive({ ...eng, litres: ev.es.litres }, g.year, rpmTrace({ es: ev.es, engine: eng, gearbox: gbx, final: d.final, tyreR: 0.36, mass: ev.sim.mass - ev.es.mass - GEARBOX[gbx.type].mass })); }
    text(S, `TOOLING ${money(tool)}`, x2 + 4, AY + 182, C.ink, 1, pw2 - 6); text(S, `${months} MONTHS TO LAUNCH`, x2 + 4, AY + 190, C.ink, 1, pw2 - 6);
    if (button(S, x2 + 4, AY + 198, pw2 - 8, 16, 'LAUNCH MODEL', { tone: 'ox', disabled: g.cash < tool || !ev.fit })) {
      g.models.push({ ...JSON.parse(JSON.stringify(car)), sprite: { v3: JSON.parse(JSON.stringify(des)), paint: d.paint }, id: 'M' + g.serial++, plan: Math.round(g.factory / Math.max(1, g.models.length + 1)), readyAt: dateNum(g) + months, sold: 0, stock: 0 });
      g.cash -= tool; app.draft = null; toast('MODEL IN DEVELOPMENT'); app.tab = 'prod'; startAssembly(g, sp.spec, d, 'prod'); } }
}
function prod(g) { windowBox(S, AX, AY, AW, AH, 'PRODUCTION PLANNING');
  text(S, `FACTORY CAPACITY ${g.factory} CARS / MONTH`, AX + 8, AY + 22, C.ink);
  if (button(S, AX + 200, AY + 19, 120, 12, 'EXPAND +500 ($40,000)', { disabled: g.cash < 40000 })) { g.factory += 500; g.cash -= 40000; }
  const live = g.models.filter(m => !m.dead); if (!live.length) text(S, 'NO MODELS YET - USE CAR DESIGN.', AX + 8, AY + 50, C.oxblood);
  scrollArea(S, 'prod', AX + 4, AY + 34, AW - 8, AH - 38, live.length * 54 + 6, dy => live.forEach((m, i) => { const y = AY + 36 + i * 54 - dy; panel(S, AX + 6, y, AW - 12, 50, `${m.name} - ${m.seg.toUpperCase()}`);
    const sp = m.sprite.v3 ? v3Sprite(m.sprite.v3, m.sprite.paint).px : m.sprite.v2 ? v2Sprite(m.sprite.v2, m.sprite.paint).px : carSprite(m.sprite.year, m.sprite.body, m.sprite.paint, m.sprite.type).px; if (sp) drawPix(S, sp, P, AX + 10, y + 48 - Math.min(sp.h, 40), 1);
    const x = AX + 230, ready = m.readyAt <= dateNum(g); if (!ready) { text(S, `IN DEVELOPMENT - ${m.readyAt - dateNum(g)} MONTHS`, x, y + 14, C.oxblood); return; }
    m.price = Math.round(slider(S, x, y + 10, 70, 'PRICE', m.price, 350, 5000, { step: 10, fmt: money, id: m.id + 'p' }));
    m.plan = Math.round(slider(S, x + 80, y + 10, 70, 'OUTPUT/MO', m.plan, 0, g.factory, { step: 10, fmt: v => String(Math.round(v)), id: m.id + 'o' }));
    text(S, `SOLD LAST ${m.lastSold || 0}  TOTAL ${m.sold || 0}  STOCK ${m.stock || 0}`, x, y + 30, C.ink); text(S, `APPEAL ${Math.round((m.appeal || 0) * 100)}`, x, y + 39, C.teal); if ((m.stock || 0) > (m.lastSold || 0) * 2 + 50) text(S, 'STOCK PILING UP - CUT OUTPUT', x + 40, y + 39, C.red);
    if (button(S, x + 110, y + 36, 48, 11, 'RETIRE', { tone: 'ox' })) m.dead = true;
    const fc = m.demandHist?.length ? Math.round(m.demandHist.reduce((a, b) => a + b, 0) / m.demandHist.length * 1.05) : null; if (fc != null && button(S, x + 160, y + 10, 60, 11, 'MATCH DEMAND', { tone: 'teal' })) m.plan = Math.min(g.factory, fc);
    if (fc != null) text(S, `FORECAST ${fc}`, x + 160, y + 24, C.inkSoft); })); 
}
function research(g) { windowBox(S, AX, AY, AW, AH, `RESEARCH & DEVELOPMENT - ${g.research.toUpperCase()} DEPT (${RES_SCALE[g.research].pts} PTS/MO)`);
  const av = TECH.filter(t => t.year <= g.year && !has(g, t.id)), done = TECH.filter(t => has(g, t.id));
  scrollArea(S, 'research', AX + 6, AY + 20, AW - 12, AH - 44, av.length * 18 + 6, dy => { av.forEach((t, i) => { const y = AY + 22 + i * 18 - dy, cur = g.resCur === t.id; if (button(S, AX + 8, y, 150, 15, t.name, { active: cur })) { if (!cur) { g.resCur = t.id; g.resPts = 0; } }
    bar(S, AX + 162, y + 5, 80, 6, cur ? g.resPts / t.pts : 0, C.teal); text(S, `${t.pts} PTS  MAINSTREAM ${t.main}`, AX + 248, y + 5, C.inkSoft); }); });
  text(S, 'KNOWN: ' + done.map(t => t.name).join(', ').slice(0, 95), AX + 8, AY + AH - 20, C.green); text(S, 'TECH OLDER THAN ITS ERA LOSES APPEAL - GRACE SHRINKS EACH DECADE.', AX + 8, AY + AH - 11, C.inkSoft); }
function market(g) { windowBox(S, AX, AY, AW, AH, `MARKET - ${COUNTRIES[g.country].name}`); const M = COUNTRIES[g.country].market;
  graph(S, AX + 8, AY + 22, 180, 90, [{ pts: Object.values(M), c: C.teal }], { labels: [{ t: 'NEW CARS / YEAR 1930-49', c: C.ink }] });
  text(S, `${g.year}: ${(M[g.year] || 0)}K CARS`, AX + 8, AY + 116, C.oxblood); S.fill(AX + 8 + Math.round((g.year - 1930) / 19 * 178), AY + 22, 1, 90, C.red);
  Object.entries(SEGS).forEach(([k, s], i) => { const y = AY + 22 + i * 22, x = AX + 200; text(S, k.toUpperCase(), x, y, C.ink); bar(S, x, y + 7, 100, 6, s.share / 0.45, C.teal);
    text(S, `${money(s.price[0])}-${money(s.price[1])}`, x + 106, y + 7, C.inkSoft); });
  text(S, 'BUYERS WEIGH PRICE, ECONOMY, RELIABILITY, SPEED, COMFORT,', AX + 8, AY + 140, C.inkSoft); text(S, 'DESIGN AND MODERNITY DIFFERENTLY PER SEGMENT.', AX + 8, AY + 149, C.inkSoft); }
function finance(g) { windowBox(S, AX, AY, AW, AH, 'FINANCE'); graph(S, AX + 8, AY + 22, AW - 16, 100, [{ pts: g.hist.cash, c: C.green }], { min: Math.min(0, ...g.hist.cash), labels: [{ t: 'CASH', c: C.green }] });
  graph(S, AX + 8, AY + 128, AW - 16, 70, [{ pts: g.hist.sales, c: C.teal }], { labels: [{ t: 'CARS SOLD / MONTH', c: C.teal }] });
  text(S, `RESEARCH ${money(RES_SCALE[g.research].cost)}/MO   OVERHEAD ${money(4000 + g.factory * 3.2)}/MO`, AX + 8, AY + 204, C.ink);
  text(S, `BANK LOAN ${money(g.loan || 0)} / CREDIT LINE ${money(g.credit || g.factory * 60)}  (0.6%/MO)`, AX + 8, AY + 214, C.oxblood);
  if (button(S, AX + 250, AY + 222, 70, 13, 'BORROW 10K', { disabled: (g.loan || 0) + 10000 > (g.credit || g.factory * 60) })) { g.loan = (g.loan || 0) + 10000; g.cash += 10000; }
  if (button(S, AX + 325, AY + 222, 70, 13, 'REPAY 10K', { disabled: !(g.loan >= 10000) || g.cash < 10000 })) { g.loan -= 10000; g.cash -= 10000; } }
function save(g) { windowBox(S, AX, AY, AW, AH, 'SAVE COMPANY'); for (let i = 1; i <= 3; i++) { const sv = store.get('gh_slot_' + i), y = AY + 26 + (i - 1) * 34; panel(S, AX + 10, y, 260, 28);
  text(S, sv ? `${sv.name} - ${MONTHS[sv.month - 1]} ${sv.year}` : `SLOT ${i} - EMPTY`, AX + 15, y + 11, sv ? C.ink : C.inkSoft);
  if (button(S, AX + 220, y + 7, 44, 14, 'SAVE')) toast(store.set('gh_slot_' + i, g) ? 'SAVED TO SLOT ' + i : 'SAVE FAILED (STORAGE BLOCKED)'); } }
function menu(g) { windowBox(S, AX + 120, AY + 50, 160, 110, 'MENU'); if (button(S, AX + 135, AY + 75, 130, 16, 'SETTINGS')) app.scene = 'settings'; if (button(S, AX + 135, AY + 97, 130, 16, 'QUIT TO TITLE')) { app.scene = 'title'; app.g = null; }
  if (button(S, AX + 135, AY + 119, 130, 16, 'BACK TO OFFICE')) app.tab = 'news'; }

// ---------- assembly line (first car of a design) ----------
function startAssembly(g, spec, d, back) { const eng = g.engines.find(x => x.id === d.engineId); if (!eng || !spec) return; try { app.asm = makeAssembly(P, { spec }, eng, g.year, d.paint); app.asmBack = back; app.scene = 'assembly'; } catch (e) { console.warn(e); } }
function assembly() { const st = drawAssembly(S, P, app.asm, AU.sfx); if (button(S, W - 70, 4, 62, 14, st >= 9 ? 'DONE' : 'SKIP', { tone: 'ox' }) || app.asm.t > 9 * 110 + 100) { app.scene = 'hq'; app.tab = app.asmBack || 'cars'; app.asm = null; }
  if (button(S, W - 136, 4, 62, 14, 'FASTER')) app.asm.t = Math.min(9 * 110, app.asm.t + 40); }

// ---------- end of game: newspaper front page ----------
function end() { const g = app.g; desk(S); S.fill(60, 10, 360, 250, C.paper); S.fill(64, 14, 352, 242, C.white);
  text(S, 'THE MOTOR GAZETTE', 240 - tw('THE MOTOR GAZETTE', 3) / 2, 20, C.ink, 3); S.fill(70, 38, 340, 1, C.ink); text(S, `${MONTHS[g.month - 1]} ${g.year}`, 72, 41, C.inkSoft);
  const head = g.over === 'BANKRUPT' ? `${g.name} CLOSES ITS DOORS` : g.over.startsWith('MERGED') ? `${g.name} SOLD TO RIVAL` : `${g.name} ENTERS THE FIFTIES`;
  text(S, head, 72, 52, C.oxblood, 1, 336); S.fill(70, 62, 340, 1, C.ink);
  const total = g.models.reduce((a, m) => a + (m.sold || 0), 0); [['CARS SOLD', total.toLocaleString('en-US')], ['FINAL CASH', money(g.cash)], ['BANK LOAN', money(g.loan || 0)], ['REPUTATION', Math.round(g.rep * 100)], ['MODELS', g.models.length]].forEach(([l, v], i) => stat(S, 72, 68 + i * 9, l, v));
  graph(S, 200, 66, 205, 52, [{ pts: g.hist.sales, c: C.teal }], { labels: [{ t: 'CARS SOLD / MONTH', c: C.teal }] });
  text(S, 'MILESTONES', 72, 126, C.ink); const AN = { first: 'FIRST CAR SOLD', '10k': '10,000 CARS SOLD', '100k': '100,000 CARS SOLD', depr: 'SURVIVED THE DEPRESSION', war: 'WAR PRODUCTION' }; (g.ach || []).forEach((a, i) => text(S, '* ' + (AN[a] || a), 72, 136 + i * 8, C.green, 1, 120));
  text(S, 'FROM THE WIRE', 200, 126, C.ink); g.news.slice(0, 11).forEach((n, i) => text(S, n.t, 200, 136 + i * 8, C.inkSoft, 1, 205));
  if (g.over.startsWith('END') && button(S, 72, 232, 120, 16, 'KEEP PLAYING (1950+)', { tone: 'teal' })) { g.over = false; g.sandbox = true; app.scene = 'hq'; }
  if (button(S, 290, 232, 110, 16, 'TITLE', { tone: 'ox' })) { app.scene = 'title'; app.g = null; } }

// ---------- loop / input ----------
function cursor() { const x = input.x, y = input.y; if (x < 0) return; const A = ['1000000', '1100000', '1210000', '1221000', '1222100', '1222210', '1222221', '1221111', '1101210', '1000121', '0000011'];
  A.forEach((r, j) => [...r].forEach((c, i) => c !== '0' && S.fill(x + i, y + j, 1, 1, c === '1' ? C.black : C.brassL))); }
function music() { const g = app.g; if (app.scene !== 'hq' || !g) return AU.setSong('title'); if (['engines', 'gearbox', 'cars'].includes(app.tab)) return AU.setSong('design');
  const C2 = COUNTRIES[g.country]; AU.setSong(g.year < 1940 ? 'office30' : g.year >= C2.war[0] && g.year <= C2.war[1] ? 'war40' : 'office40'); }
function frame() { app.t++; music(); if (app.scene !== 'title') AU.passEnd(); ({ title, settings, newgame, load, hq, end, assembly })[app.scene]();
  if (app.toast && app.t < app.toast.until) { const w = tw(app.toast.t) + 16; bevel(S, (W - w) / 2, H - 22, w, 14, C.teal, C.tealL, hex('#1b3f3e')); text(S, app.toast.t, (W - w) / 2 + 8, H - 17, C.white); }
  cursor(); input.clicked = false; input.wheel = 0; ctx.putImageData(img, 0, 0); requestAnimationFrame(frame); }
function resize() { const vv = window.visualViewport, vw = (vv ? vv.width : innerWidth) - 32, vh = (vv ? vv.height : innerHeight) - 8, fit = Math.max(0.3, Math.min(vw / W, vh / H));
  const k = app.settings.fill === false && fit >= 1 ? Math.floor(fit) : fit; const w = Math.floor(W * k), h = Math.floor(H * k);
  cv.style.width = w + 'px'; cv.style.height = h + 'px'; const sc = document.getElementById('scan'); sc.style.display = app.settings.scan ? 'block' : 'none'; sc.style.width = w + 'px'; sc.style.height = h + 'px'; }
window.visualViewport?.addEventListener('resize', () => resize());
const pos = e => { const r = cv.getBoundingClientRect(); input.x = Math.floor((e.clientX - r.left) / r.width * W); input.y = Math.floor((e.clientY - r.top) / r.height * H); };
cv.addEventListener('pointermove', pos); cv.addEventListener('pointerdown', e => { pos(e); input.down = true; input.clicked = true; AU.unlock(); });
hooks.click = () => AU.sfx('click'); lang.ko = app.settings.lang === 'ko'; Object.assign(AU.vol, { music: app.settings.music ?? 0.6, sfx: app.settings.sfx ?? 0.8 });
addEventListener('pointerup', () => { input.down = false; input.drag = null; }); cv.addEventListener('pointerleave', () => { input.x = -1; });
cv.addEventListener('wheel', e => { e.preventDefault(); input.wheel = e.deltaY; }, { passive: false }); addEventListener('resize', resize);
addEventListener('keydown', e => { if (e.key === 'Escape' && app.scene === 'hq') app.tab = 'menu'; if (e.key === ' ' && app.scene === 'hq' && !app.g.over) { e.preventDefault(); stepMonth(app.g); } });
window.__gh = { app, input, stepMonth, lang, AU };
// keep the running company across page updates in the viewer
window.claude?.hot?.snapshot?.(() => ({ g: app.g, scene: app.scene, tab: app.tab }));
const start = d => { if (d && d.g) Object.assign(app, { g: d.g, scene: d.scene || 'hq', tab: d.tab || 'news' }); resize(); frame(); };
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
