// GEARHOUSE 1930-1949 test build: scenes, designers, monthly loop, save/load. All UI is pixel-drawn (ui.mjs).
import * as AU from './audio.mjs';
import { lang, hooks, clip } from './ui.mjs';
import { tr } from './i18n.mjs';
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
import { drawFit } from './fitfx.mjs';
import { TEMPLATES, available, makeBody, landmarks } from '../tools/pixel/gen/v2/template.mjs';
import { newDesign, sideSpec, frontSpec, rearSpec, optionsFor, ranges, clampDesign } from '../tools/pixel/gen/v3/design.mjs';
import { baseList, baseName, measuredDesign, measuredSide, measuredView, measuredRanges, clampMeasured, shapeRanges, SHAPE_KEYS } from '../tools/pixel/gen/v3/base.mjs';
import { buildFront } from '../tools/pixel/gen/front.mjs';
import { FRAME_TYPES, GRADES, platformDefault, typesFor, gradesFor, clampPlatform, platformStats, platformPlan, platformSide, unitShell } from '../tools/pixel/gen/v3/platform.mjs';
import { Pix } from '../tools/pixel/pix.mjs';
import { stripBody } from './assembly.mjs';
import { baseWidth } from '../sim/dims.mjs';
import { LIMITS, dimsFor, SIZE } from '../sim/dims.mjs';
import { GEARBOX, proposeRatios, rpmTrace } from '../sim/drive.mjs';
import { COUNTRIES, SEGS, TECH, RES_SCALE, newGame, stepMonth, evaluate, appeal, dateNum, has, BANK_OPTS, bankOption } from './world.mjs';

const PAINTS = ['#2f3a4a', '#5c1c27', '#3f5a40', '#7d3a2c', '#4b6283', '#d8c9a0', '#1d1d22', '#6b5a3a', '#8c2a24', '#6b6e70'];
const P = ptPalette(eraPalette()); PAINTS.forEach((h, i) => P.auto('paint.c' + i, h)); P.auto('paint.enginecream', '#b9ae8e'); P.auto('bare', '#9aa0a6', { sat: 0.2 }); P.auto('primerRed', '#8a3b2a'); P.auto('primerGrey', '#7d8085'); P.auto('paint.clay', '#b49a74', { sat: 0.4 }); P.auto('paint.mockwood', '#8a6a44', { sat: 0.5 }); P.auto('canvas', '#3b3631', { sat: 0.5 });
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
// platform preview: plan + rail profile (frames) or floor plan + bare-steel body shell (unit body)
function platSprite(des, spec, paintIdx) { const key = 'PL' + JSON.stringify(des) + paintIdx; if (app.cache.has(key)) return app.cache.get(key); let out = { px: null };
  try { const pl = des.plat, geo = spec.geo, T = spec.tire || '6.00-16', width = des.width || 1800, track = Math.round(width - 300);
    if (pl.type === 'unibody') { const b = unitShell(P, buildCar(P, stripBody({ ...spec, under: [], fenders: [], boards: [], anchor: false }, 'bare'), 52), spec), pla = platformPlan(P, pl, geo, { track, tireCode: T, width }, 64); const px = new Pix(Math.max(b.w, pla.w), b.h + pla.h + 2); px.blit(pla, 0, 0); px.blit(b, 0, pla.h + 2); out = { px }; }
    else { const a = platformPlan(P, pl, geo, { track, tireCode: T, width }, 45), b = platformSide(P, pl, geo, T, 45), px = new Pix(Math.max(a.w, b.w), a.h + b.h + 2); px.blit(a, 0, 0); px.blit(b, 0, a.h + 2); out = { px }; } } catch (e) { console.warn(e); }
  app.cache.set(key, out); return out; }
const PARTK = { grilleFrom: 'grille', lampFrom: 'lamps', bumperFrom: 'bumpers', guards: 'bumpers', tailFrom: 'tail', wheelFrom: 'wheel', whitewall: 'wheel', ornament: 'ornament', fog: 'fog' };   // part swaps -> fitting effect
function v3Sprite(des, paintIdx, view = 'side', rot = 0, strip = null) {
  const key = 'V3' + view + JSON.stringify(des) + paintIdx + rot + (strip || ''); if (app.cache.has(key)) return app.cache.get(key);
  let out = { px: null }; try { const paint = typeof paintIdx === 'string' ? paintIdx : 'paint.c' + paintIdx;
    const meas = des.base && des.base !== 'free';                                                       // measured base car -> warped replica
    if (view === 'side') { const spec = meas ? measuredSide(des, paint, strip) : sideSpec(des, paint); spec.wheel = { ...spec.wheel, rot }; out = { px: buildCar(P, spec, Math.max(25, Math.ceil(spec.len / 190))), spec }; }
    else out = { px: buildFront(P, meas ? measuredView(des, paint, view === 'rear', strip) : (view === 'front' ? frontSpec : rearSpec)(des, paint), 25) }; } catch (e) { console.warn(e); }
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
  devTick(g); ({ news, engines, gearbox, cars, prod, research, market, finance, save, menu })[app.tab]?.(g);
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
// ---------- car development: 9 stages in their real order, each in its own place, with time and cost ----------
// brief -> platform -> engine -> driveline -> body -> mock-up (executive review) -> detail -> prototype & test (defects) -> production prep (tooling)
const DEV = [
  { id: 'brief', name: 'BRIEF', mo: 1, cost: 2000, where: 'PLANNING OFFICE' },
  { id: 'platform', name: 'PLATFORM', mo: 1, cost: 6000, where: 'DRAWING OFFICE - CHASSIS' },
  { id: 'engine', name: 'ENGINE', mo: 0, cost: 0, where: 'ENGINE TEST ROOM' },
  { id: 'driveline', name: 'DRIVELINE', mo: 0, cost: 1500, where: 'DRAWING OFFICE - DRIVELINE' },
  { id: 'body', name: 'BODY', mo: 1, cost: 8000, where: 'STYLING STUDIO' },
  { id: 'mockup', name: 'MOCK-UP', mo: 1, cost: 5000, where: 'MOCK-UP ROOM' },
  { id: 'detail', name: 'DETAIL', mo: 1, cost: 4000, where: 'DRAWING OFFICE - DETAIL' },
  { id: 'proto', name: 'PROTOTYPE', mo: 2, cost: 12000, where: 'PROVING GROUND' },
  { id: 'prep', name: 'TOOLING', mo: 3, cost: 0, where: 'FACTORY - PRODUCTION PREP' }];
// a stage that finished this month: mock-up waits for the review, prototype for the defect decision, tooling launches the model
function devTick(g) { const d = g.proj; if (!d || !d.busy || dateNum(g) < d.busy.until) return; const { i, fix } = d.busy; d.busy = null; AU.sfx('stamp');
  if (i === 8 && d.launch) { const L = d.launch; g.models.push({ ...L, id: 'M' + g.serial++, plan: Math.min(Math.round((d.volume || 3000) / 12), g.factory), readyAt: dateNum(g), sold: 0, stock: 0 });   // monthly plan from the brief's annual volume
    g.news.unshift({ t: L.name + ' ENTERS PRODUCTION', d: dateNum(g) }); g.proj = null; app.draft = null; app.dstage = null; toast('MODEL IN PRODUCTION'); return; }
  d.done[i] = true;
  if (i === 7 && fix) { d.relMod = (d.relMod || 0) + 0.015 * (d.defects?.length || 0); d.defects = null; d.testDue = false; d.stage = 8; toast('DEFECTS FIXED'); return; }
  if (i === 5) d.reviewDue = true; else if (i === 7) d.testDue = true; else d.stage = i + 1; toast(DEV[i].name + ' COMPLETE'); }
const tr2 = s => (lang.ko ? tr(s) : s);
function briefDoc(g, d, x, y, w, h) {                                       // typed project brief
  S.fill(x, y, w, h, C.white); S.fill(x, y, w, 1, C.paperDark); const sg = SEGS[d.seg], top = Object.entries(sg.w).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k.toUpperCase()).join(', ');
  const lines = ['PROJECT BRIEF - ' + d.name, MONTHS[g.month - 1] + ' ' + g.year + '  ' + COUNTRIES[g.country].name, '', 'SEGMENT: ' + d.seg.toUpperCase(), 'TARGET PRICE: ' + money(d.price), 'VOLUME: ' + d.volume + ' CARS / YEAR', 'BUYERS VALUE: ' + top].map(tr2);
  const key = lines.join('|'); if (app.briefKey !== key) { app.briefKey = key; app.briefT = app.t; }
  let n = Math.floor((app.t - app.briefT) * 1.4); const total = lines.join('').length;
  lines.forEach((l, i) => { const s = l.slice(0, Math.max(0, n)); n -= l.length; if (s) text(S, s, x + 6, y + 5 + i * 10, i ? C.ink : C.oxblood, 1, w - 10); });
  if ((app.t - app.briefT) * 1.4 < total && (app.t - app.briefT) % 5 === 0) AU.sfx('type'); }
function gearMesh(x, y, ratio, t) {                                         // final drive: pinion turning the crown wheel
  const draw = (cx, cy, R, n, ang, c1, c2) => { for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) { const r = Math.hypot(xx, yy); if (r <= R - 2) S.fill(cx + xx, cy + yy, 1, 1, r < R * 0.3 ? c2 : c1); }
    for (let k = 0; k < n; k++) { const a = ang + k * 6.2832 / n; for (let q = R - 2; q <= R + 2; q++) S.fill(Math.round(cx + Math.cos(a) * q), Math.round(cy + Math.sin(a) * q), 2, 2, c1); } S.fill(cx - 1, cy - 1, 3, 3, C.ink); };
  const R2 = Math.round(Math.min(34, 8 * ratio)), R1 = 8, ox = x + 60, oy = y + 40;
  draw(ox, oy, R2, Math.round(9 * ratio), -t * 0.06 / ratio, C.brassD, C.brass); draw(ox + R2 + R1 + 3, oy, R1, 9, t * 0.06 + 0.35, C.brass, C.brassL); }
function dashboard(x, y, w, h, trim) {                                      // instrument panel by trim level
  const wood = trim >= 2, face = wood ? hex('#6b4a2a') : hex('#3a3632'); S.fill(x, y, w, h, hex('#cfc5b0')); S.fill(x + 8, y + 18, w - 16, 34, face); S.fill(x + 8, y + 18, w - 16, 1, wood ? hex('#9a7046') : hex('#5a5550'));
  const n = 1 + Math.min(3, trim); for (let k = 0; k < n; k++) { const cx = x + w / 2 + (k - (n - 1) / 2) * 30, cy = y + 34, R = k === 0 ? 11 : 8;
    for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) { const r = Math.hypot(xx, yy); if (r <= R) S.fill(cx + xx, cy + yy, 1, 1, r > R - 1.5 ? C.brassL : hex('#efe6cf')); }
    lineTo(S, cx, cy, cx + Math.cos(-2.4 + k + app.t * 0.01) * (R - 2), cy + Math.sin(-2.4 + k + app.t * 0.01) * (R - 2), C.red); }
  for (let a = 3.5; a < 5.95; a += 0.02) S.fill(Math.round(x + w / 2 + Math.cos(a) * 34), Math.round(y + h + 22 + Math.sin(a) * 34), 2, 2, C.black);   // steering wheel rim
  text(S, ['BASIC', 'STANDARD', 'DE LUXE', 'CUSTOM'][trim], x + 4, y + 4, C.ink); }
function cars(g) {
  if (!g.proj && app.draft) g.proj = app.draft;
  const readyE = g.engines.filter(e => e.readyAt <= dateNum(g)), readyG = g.gearboxes.filter(x => x.readyAt <= dateNum(g));
  let d = g.proj || (g.proj = { name: 'MODEL ' + String.fromCharCode(65 + g.models.length), type: 'sedan4d', seg: 'family', engineId: readyE[0]?.id, gbId: readyG[0]?.id, final: 4.1, price: 850, volume: 3000, trim: 1, paint: 0, feats: {}, stage: 0, done: [], busy: null, spent: 0 });
  if (d.stage == null) Object.assign(d, { stage: 0, done: [], busy: null, spent: 0, volume: 3000 }); app.draft = d;
  devTick(g); if (g.proj !== d) { app.tab = 'prod'; return; }
  windowBox(S, AX, AY, AW, AH, 'NEW CAR PROJECT - ' + d.name);
  const vs = app.dstage != null && app.dstage <= d.stage ? app.dstage : d.stage, st = DEV[vs], ro = vs < d.stage || !!d.busy, snap = ro ? JSON.stringify(d) : null;
  // ---- body design record (v3 / measured base) and platform ----
  let des = d.v3 || (d.v3 = measuredDesign(baseList(g.year).includes('sedan30') ? 'sedan30' : baseList(g.year)[0], g.year)); if (des.year !== g.year) des.year = g.year;
  const meas = des.base && des.base !== 'free', baseOpts = ['free', ...baseList(g.year)], prevBase = des.base || 'free'; if (!des.base) des.base = 'free';
  if (!des.plat) des.plat = platformDefault(des.base, g.year);
  const isMeas = meas, tabs = st.id === 'body' ? [['side', 'SIDE'], ...(isMeas ? [['shape', 'SHAPE']] : []), ['front', 'FRONT'], ['rear', 'REAR']] : [];
  if ((!isMeas && app.dview === 'shape') || app.dview === 'frame') app.dview = 'side';
  const view = st.id === 'platform' ? 'frame' : st.id === 'body' ? app.dview || 'side' : st.id === 'mockup' ? ['side', 'front', 'rear'][Math.floor(app.t / 110) % 3] : 'side', tbw = 34;
  tabs.forEach(([k, l], i) => { if (button(S, AX + 120 + i * tbw, AY + 2, tbw - 2, 10, l, { active: view === k })) app.dview = k; });
  const R0 = ranges(g.year), opt = (k, key) => optionsFor(key || k, g.year), NM = { sedan4d: '4-DOOR SEDAN', coupe2d: '2-DOOR COUPE' };
  const ctl = [];   // [kind, key, label, a, b, fmt, step]
  const MR = meas ? measuredRanges(des) : null, srcs = baseList(g.year), sn = id => baseName(id), mm = v => Math.round(v) + 'MM', yn = (a, b) => v => (v ? b : a);
  if (st.id === 'brief') ctl.push(['dcyc', 'seg', 'TARGET SEGMENT', Object.keys(SEGS), null, k => k.toUpperCase()], ['dsl', 'price', 'TARGET PRICE', 350, 5000, money, 10], ['dsl', 'volume', 'ANNUAL VOLUME', 500, 30000, v => Math.round(v) + ' CARS', 100]);
  if (st.id === 'platform') { const pl = des.plat, uni = pl.type === 'unibody';
    ctl.push(['cyc', 'base', 'BASE CAR', baseOpts, null, id => id === 'free' ? 'FREE DESIGN' : baseName(id)]);
    if (meas) ctl.push(['sl', 'wb', 'WHEELBASE', ...MR.wb, mm, 10], ['sl', 'width', 'WIDTH', ...MR.width, mm, 10]); else ctl.push(['sl', 'wb', 'WHEELBASE', 1867, 4430, mm, 25], ['sl', 'width', 'WIDTH', 1146, 2215, mm, 10]);
    ctl.push(['pl', 'type', 'FRAME TYPE', typesFor(g.year, k => has(g, k)), null, k => FRAME_TYPES[k].name], ['pl', 'grade', 'STEEL GRADE', gradesFor(g.year), null, k => GRADES[k].name]);
    if (uni) ctl.push(['pls', 'railT', 'PANEL GAUGE', 0.9, 2.5, v => v.toFixed(1) + 'MM', 0.1]);
    else if (pl.type === 'platform') ctl.push(['pls', 'railH', 'TUBE DIAMETER', 90, 200, mm, 5], ['pls', 'railT', 'TUBE WALL', 2.5, 5, v => v.toFixed(2) + 'MM', 0.25]);
    else ctl.push(['pls', 'railH', 'RAIL DEPTH', 90, 280, mm, 5], ['pls', 'railT', 'STEEL GAUGE', 2.5, 8, v => v.toFixed(2) + 'MM', 0.25], ['pls', 'cross', 'CROSS-MEMBERS', 3, 8, v => Math.round(v) + '', 1], ['pls', 'kick', 'KICK-UP OVER AXLE', 0, 260, mm, 5]);
    if (has(g, 'ifs')) ctl.push(['fcyc', 'ifs', 'FRONT SUSPENSION', [false, true], null, yn('BEAM AXLE', 'INDEPENDENT')]);
    if (has(g, 'hydbrake')) ctl.push(['fcyc', 'hydbrake', 'BRAKES', [false, true], null, yn('MECHANICAL', 'HYDRAULIC')]); }
  if (st.id === 'engine' && readyE.length) ctl.push(['dcyc', 'engineId', 'ENGINE', readyE.map(e => e.id), null, id => g.engines.find(e => e.id === id).name]);
  if (st.id === 'driveline' && readyG.length) ctl.push(['dcyc', 'gbId', 'GEARBOX', readyG.map(x => x.id), null, id => g.gearboxes.find(x => x.id === id).name], ['dsl', 'final', 'FINAL DRIVE', 3.0, 5.5, v => v.toFixed(2), 0.05]);
  if (st.id === 'detail') { ctl.push(['dsl', 'trim', 'TRIM LEVEL', 0, 3, v => ['BASIC', 'STANDARD', 'DE LUXE', 'CUSTOM'][Math.round(v)], 1]); if (has(g, 'steelroof')) ctl.push(['fcyc', 'steelroof', 'ROOF', [false, true], null, yn('FABRIC INSERT', 'ALL STEEL')]);
    ctl.push(['dcyc', 'paint', 'PAINT', PAINTS.map((_, i) => i), null, i => 'COLOUR ' + (i + 1)], ['dsl', 'price', 'LIST PRICE', 350, 5000, money, 10]); }
  if (st.id === 'prep') ctl.push(['dsl', 'volume', 'ANNUAL VOLUME', 500, 30000, v => Math.round(v) + ' CARS', 100]);
  if (st.id === 'body') {
    if (meas) {
      if (view === 'shape') { const SR = shapeRanges(des), SL = { screen: 'WINDSHIELD TOP', crown: 'ROOF CROWN', back: 'REAR WINDOW TOP', deck: 'DECK HEIGHT', nose: 'NOSE RAKE', fTail: 'FRONT FENDER TAIL', fCrown: 'FRONT FENDER CROWN' };
        for (const k of SHAPE_KEYS) if (SR[k][1] > SR[k][0]) ctl.push(['sh', k, SL[k], SR[k][0], SR[k][1], v => (v > 0 ? '+' : '') + Math.round(v) + 'MM', 5]); }
      if (view === 'side') ctl.push(['sl', 'frontOH', 'FRONT OVERHANG', ...MR.frontOH, mm, 10], ['sl', 'rearOH', 'REAR OVERHANG', ...MR.rearOH, mm, 10], ['sl', 'belt', 'BODY HEIGHT', ...MR.belt, mm, 5],
        ['sl', 'roof', 'ROOF HEIGHT', ...MR.roof, mm, 5], ['cyc', 'wheelFrom', 'WHEELS FROM', srcs, null, sn], ['sl', 'whitewall', 'WHITEWALL', 0, 0.45, v => Math.round(v * 100) + '%', 0.05],
        ['cyc', 'lampFrom', 'HEADLAMPS FROM', srcs, null, sn], ['cyc', 'bumperFrom', 'BUMPERS FROM', srcs, null, sn], ['cyc', 'tailFrom', 'TAIL LAMPS FROM', srcs, null, sn], ['cyc', 'fenderBlack', 'FENDERS BLACK', [false, true]]);
      if (view === 'front') ctl.push(['cyc', 'grilleFrom', 'GRILLE FROM', srcs, null, sn], ['cyc', 'lampFrom', 'HEADLAMPS FROM', srcs, null, sn], ['cyc', 'bumperFrom', 'BUMPERS FROM', srcs, null, sn], ['cyc', 'guards', 'BUMPER GUARDS', [0, 2]],
        ['cyc', 'fog', 'FOG LAMPS', [false, true]], ['cyc', 'ornament', 'HOOD ORNAMENT', [true, false]]);
      if (view === 'rear') ctl.push(['cyc', 'tailFrom', 'TAIL LAMPS FROM', srcs, null, sn], ['cyc', 'bumperFrom', 'BUMPERS FROM', srcs, null, sn]);
    } else {
      if (view === 'side') ctl.push(['cyc', 'type', 'BODY TYPE', ['sedan4d', 'coupe2d'], null, t => NM[t]], ['sl', 'frontOH', 'FRONT OVERHANG', 380, 1400, mm, 10], ['sl', 'rearOH', 'REAR OVERHANG', 300, 1700, mm, 10], ['sl', 'roof', 'ROOF HEIGHT', ...R0.roof, mm, 5],
        ['sl', 'belt', 'BELT LINE', ...R0.belt, v => Math.round(v * des.roof) + 'MM', 0.005], ['sl', 'hood', 'HOOD HEIGHT', ...R0.hood, v => Math.round(v * des.roof) + 'MM', 0.005], ['sl', 'rake', 'SCREEN RAKE', ...R0.rake, v => Math.round(v) + ' DEG', 1],
        ['sl', 'cowl', 'COWL FROM FRONT AXLE', 500, des.wb * 0.55, mm, 10], ['sl', 'cabin', 'ROOF LENGTH', ...R0.cabin, mm, 10], ['sl', 'crown', 'ROOF CURVE', ...R0.crown, mm, 5],
        ['sl', 'noseRound', 'NOSE ROUND', ...R0.noseRound, mm, 5], ['cyc', 'tail', 'TAIL', opt('tail')], ['sl', 'deck', 'DECK HEIGHT', 0.5, 0.72, v => Math.round(v * des.roof) + 'MM', 0.005],
        ['cyc', 'frontFender', 'FRONT FENDER', opt('frontFender')], ['cyc', 'rearFender', 'REAR FENDER', opt('rearFender')], ['sl', 'fenderCrown', 'FENDER CROWN', 40, 260, mm, 5], ['cyc', 'board', 'RUNNING BOARD', [true, false]],
        ['sl', 'frontDoor', 'FRONT DOOR LENGTH', 800, 1150, mm, 10], ['sl', 'pillarB', 'B PILLAR', 70, 160, mm, 5], ['cyc', 'vent', 'VENT WINGS', [true, false]], ['cyc', 'splitScreen', 'SPLIT SCREEN', [true, false]],
        ['sl', 'louvres', 'HOOD LOUVRES', 0, 16, v => Math.round(v) + '', 1], ['cyc', 'spear', 'SIDE SPEAR', [true, false]], ['cyc', 'spare', 'SPARE', opt('spare')], ['cyc', 'wheel', 'WHEELS', opt('wheel')], ['sl', 'whitewall', 'WHITEWALL', 0, 0.45, v => Math.round(v * 100) + '%', 0.05],
        ['cyc', 'fenderBlack', 'FENDERS BLACK', [true, false]], ['cyc', 'roofTone', 'BLACK ROOF', [true, false]]);
      if (view === 'front') ctl.push(['cyc', 'grille', 'GRILLE', opt('grille')], ['cyc', 'gpattern', 'GRILLE PATTERN', opt('gpattern')], ['sl', 'grilleW', 'GRILLE WIDTH', 0.25, 0.75, v => Math.round(v * des.width) + 'MM', 0.01], ['sl', 'grilleH', 'GRILLE HEIGHT', 0.3, 0.8, v => Math.round(v * 100) + '%', 0.01],
        ['cyc', 'lamp', 'HEADLAMPS', opt('lamp')], ['sl', 'lampR', 'LAMP SIZE', 70, 135, v => Math.round(v * 2) + 'MM', 1], ['sl', 'lampY', 'LAMP SPACING (MIRRORED)', 0.3, 0.9, v => Math.round(v * des.width) + 'MM', 0.01], ['sl', 'lampZ', 'LAMP HEIGHT', 0.5, 0.95, v => Math.round(v * 100) + '%', 0.01],
        ['sl', 'bumperBars', 'BUMPER BARS', 1, 2, v => Math.round(v) + '', 1], ['cyc', 'guards', 'BUMPER GUARDS', [0, 2, 3]], ['cyc', 'fog', 'FOG LAMPS', [false, true]], ['cyc', 'ornament', 'HOOD ORNAMENT', [true, false]]);
      if (view === 'rear') ctl.push(['cyc', 'tailLamp', 'TAIL LAMPS', opt('tailLamp')], ['sl', 'tailY', 'TAIL LAMP SPACING (MIRRORED)', 0.4, 0.95, v => Math.round(v * des.width) + 'MM', 0.01], ['cyc', 'rearWindow', 'REAR WINDOW', opt('rearWindow')], ['cyc', 'spare', 'SPARE', opt('spare')], ['cyc', 'guards', 'BUMPER GUARDS', [0, 2, 3]]);
    } }
  const before = JSON.stringify(des);
  scrollArea(S, 'design-' + st.id + view, AX + 4, AY + 19, 94, 210, ctl.length * 19 + 6, dy => ctl.forEach(([kind, key, label, a, b, fmt, step], i) => { const y = AY + 23 + i * 19 - dy, nm = fmt || (v => (v === true ? 'YES' : v === false ? 'NO' : String(v).toUpperCase()));
    if (kind === 'pls') des.plat[key] = slider(S, AX + 6, y, 86, label, des.plat[key], a, b, { step, fmt, id: 'd3p' + key });
    else if (kind === 'pl') des.plat[key] = cycler(S, AX + 6, y - 2, 86, label, a, a.includes(des.plat[key]) ? des.plat[key] : a[0], { names: fmt });
    else if (kind === 'sh') des.shape[key] = slider(S, AX + 6, y, 86, label, des.shape[key] || 0, a, b, { step, fmt, id: 'd3s' + key });
    else if (kind === 'sl') des[key] = slider(S, AX + 6, y, 86, label, des[key], a, b, { step: step || 0, fmt: fmt || (v => v.toFixed(2)), id: 'd3' + key });
    else if (kind === 'dsl') d[key] = slider(S, AX + 6, y, 86, label, d[key], a, b, { step, fmt, id: 'dd' + key });
    else if (kind === 'dcyc') d[key] = cycler(S, AX + 6, y - 2, 86, label, a, a.includes(d[key]) ? d[key] : a[0], { names: nm });
    else if (kind === 'fcyc') d.feats[key] = cycler(S, AX + 6, y - 2, 86, label, a, !!d.feats[key], { names: nm });
    else { const list = a.length ? a : [des[key]]; des[key] = cycler(S, AX + 6, y - 2, 86, label, list, list.includes(des[key]) ? des[key] : list[0], { names: nm }); } }));
  if (ro) { const o = JSON.parse(snap); for (const k of Object.keys(d)) delete d[k]; Object.assign(d, o); des = d.v3; }        // looking back / work in progress: nothing changes
  d.trim = Math.round(d.trim); if (!readyE.some(e => e.id === d.engineId)) d.engineId = readyE[0]?.id; if (!readyG.some(x => x.id === d.gbId)) d.gbId = readyG[0]?.id;
  if ((des.base || 'free') !== prevBase) { const nb = des.base, keep = des.plat.type; des = d.v3 = nb === 'free' ? { ...newDesign(g.year, 'sedan4d'), base: 'free' } : measuredDesign(nb, g.year); des.plat = platformDefault(nb === 'free' ? null : nb, g.year); }
  clampPlatform(des.plat, g.year, k => has(g, k)); let notes; if (des.base !== 'free') notes = clampMeasured(des); else { des.doors = des.type === 'coupe2d' ? 2 : 4; des.bumperBars = Math.round(des.bumperBars); des.louvres = Math.round(des.louvres); notes = clampDesign(des); }
  if (JSON.stringify(des) !== before) {                                                                       // design changed: a part swap is fitted, anything else is re-scanned
    const o = JSON.parse(before), ch = Object.keys(des).filter(k => JSON.stringify(des[k]) !== JSON.stringify(o[k])), kinds = [...new Set(ch.map(k => PARTK[k] || 'shape'))];
    if (app.t - (app.lastEdit ?? -99) > 30) { (app.undo = app.undo || []).push(before); if (app.undo.length > 40) app.undo.shift(); app.redo = []; } app.lastEdit = app.t;
    if (ch.length === 1 && ch[0] === 'shape') { /* live reshaping */ }
    else if (des.base !== 'free' && o.base === des.base && kinds.length === 1 && kinds[0] !== 'shape') { app.fit = { t: app.t, old: o, strip: kinds[0], view }; app.bpT = -999; } else { app.bpT = app.t; app.fit = null; } }
  d.type = des.type; d.feats.unibody = des.plat.type === 'unibody';
  const cx = AX + 100, pw = 200;
  if (!ro && (st.id === 'body' || st.id === 'platform')) {
    if (button(S, AX + AW - 62, AY + 3, 28, 9, 'UNDO', { disabled: !(app.undo || []).length })) { (app.redo = app.redo || []).push(JSON.stringify(des)); des = d.v3 = JSON.parse(app.undo.pop()); app.bpT = app.t; app.fit = null; app.lastEdit = -99; }
    if (button(S, AX + AW - 32, AY + 3, 28, 9, 'REDO', { disabled: !(app.redo || []).length })) { app.undo.push(JSON.stringify(des)); des = d.v3 = JSON.parse(app.redo.pop()); app.bpT = app.t; app.fit = null; app.lastEdit = -99; } }
  // ---- evaluation (shared by every stage) ----
  const sp = v3Sprite(des, d.paint, 'side'), spec = sp.spec, pst = spec ? platformStats(des.plat, spec.geo, { heavy: des.base === 'truck40' }) : null;
  const dm = { len: spec ? Math.round(spec.len) : 0, width: Math.round(des.width), height: Math.round(des.roof), wb: Math.round(des.wb) };
  const style = des.base !== 'free' ? (TEMPLATES.find(t => t.id === des.base)?.style || 'box') : des.frontFender === 'integrated' ? 'pontoon' : des.rake > 18 || des.tail === 'fastback' ? 'stream' : 'box';
  const hoodLen = spec ? spec.geo.cowlX - 250 : 1200;
  const car = { ...d, v3: undefined, launch: undefined, dims: dm, platStats: pst, plat: JSON.parse(JSON.stringify(des.plat)), relMod: d.relMod || 0, body: { style, wb: dm.wb, hood: hoodLen / Math.max(1, dm.wb), height: dm.height / Math.max(1, dm.wb) }, designScore: 0.68 + (style !== 'box' ? 0.06 : 0) - notes.length * 0.02 + (d.reviewBonus || 0) };
  const ev = readyE.length && readyG.length ? evaluate(g, car) : null;
  const tool = 40000 + dm.wb * 8 + (style !== 'box' ? 20000 : 0) + (d.feats.unibody ? 30000 : 0), prepMo = 2 + (style === 'stream' ? 1 : style === 'pontoon' ? 2 : 0) + (d.feats.unibody ? 1 : 0);
  const costOf = i => (i === 8 ? tool : DEV[i].cost), moOf = i => (i === 8 ? prepMo : DEV[i].mo);
  // ---- preview (what this place shows) ----
  panel(S, cx, AY + 20, pw, 92, st.id === 'platform' && pst ? pst.kg + ' KG  STIFFNESS ' + Math.round(pst.stiff * 100) + '  STRENGTH X' + pst.margin.toFixed(2) + '  $' + pst.cost : st.id === 'body' ? `L${dm.len} W${dm.width} H${dm.height} WB${dm.wb} MM` : st.where);
  if (st.id === 'brief') briefDoc(g, d, cx + 3, AY + 29, pw - 6, 80);
  else if (st.id === 'engine') { const e = g.engines.find(x => x.id === d.engineId); const es = e && engineSprite(e, 190, 76); if (es) drawPix(S, es, P, cx + ((pw - es.w) >> 1), AY + 106 - es.h, 1); else text(S, 'NO ENGINE READY', cx + 6, AY + 50, C.red); }
  else if (st.id === 'driveline') { gearMesh(cx + 10, AY + 26, d.final, app.t); text(S, 'FINAL DRIVE ' + d.final.toFixed(2) + ' : 1', cx + 120, AY + 40, C.ink); text(S, 'PINION AND CROWN WHEEL', cx + 120, AY + 50, C.inkSoft, 1, 76); }
  else if (st.id === 'detail') dashboard(cx + 3, AY + 29, pw - 6, 60, d.trim);
  else if (st.id === 'proto') { const p2 = v3Sprite(des, d.paint, 'side', Math.floor(app.t / 3) % 8).px; if (p2) { const span = pw + p2.w, x = cx - p2.w + (app.t * 1.2) % span; S.fill(cx + 1, AY + 104, pw - 2, 2, hex('#8a7a62'));
      for (let k = 0; k < 6; k++) S.fill(cx + 1 + ((k * 37 - app.t * 2) % (pw - 4) + pw - 4) % (pw - 4), AY + 106, 6, 1, hex('#6b5d4a'));
      Object.assign(clip, { on: true, x0: cx + 1, y0: AY + 28, x1: cx + pw - 1, y1: AY + 111 }); drawPix(S, p2, P, Math.round(x), AY + 104 - p2.h + ((app.t >> 3) % 2), 1); for (let k = 0; k < 4; k++) S.fill(Math.round(x) - 3 - k * 4, AY + 100 - ((app.t + k * 3) % 6), 2, 2, hex('#b8aa90')); clip.on = false; } }
  else if (st.id === 'prep') { const fr = spec && platformSide(P, des.plat, spec.geo, spec.tire || '6.00-16', 45); if (fr) { S.fill(cx + 1, AY + 100, pw - 2, 3, hex('#5a5550')); for (let k = 0; k < 3; k++) { const x = cx + ((k * (fr.w + 20) + app.t * 0.4) % (pw + fr.w)) - fr.w; Object.assign(clip, { on: true, x0: cx + 1, y0: AY + 28, x1: cx + pw - 1, y1: AY + 111 }); drawPix(S, fr, P, Math.round(x), AY + 100 - fr.h, 1); clip.on = false; } }
    text(S, 'UNPAINTED FRAMES ON THE LINE', cx + 3, AY + 30, C.inkSoft, 1, pw - 6); }
  else {                                                                                                         // platform, body, mock-up: the sprite views
    const mock = st.id === 'mockup', mp = mock ? (g.year < 1938 ? 'paint.mockwood' : 'paint.clay') : d.paint;
    const shown = view === 'side' || view === 'shape' ? (mock ? v3Sprite(des, mp, 'side') : sp) : view === 'frame' ? platSprite(des, spec, d.paint) : v3Sprite(des, mp, view), px = shown.px;
    if (mock) { for (let k = 0; k < 2; k++) { const lx = cx + 50 + k * 100; for (let yy = AY + 30; yy < AY + 108; yy++) { const hw = (yy - AY - 30) * 0.45; for (let xx = -hw; xx <= hw; xx += 1) S.blend(Math.round(lx + xx), yy, [255, 244, 210], 0.07); } }
      for (let xx = -70; xx <= 70; xx++) { const hh = Math.round(Math.sqrt(1 - (xx / 70) ** 2) * 5); S.fill(cx + 100 + xx, AY + 104 - hh, 1, hh * 2, hex('#6b5a46')); } }
    if (px) { const ox = cx + Math.max(2, (pw - px.w) / 2) | 0, oy = view === 'frame' ? AY + 29 : AY + 106 - px.h, prog = mock ? 1 : Math.min(1, (app.t - (app.bpT ?? -999)) / 40);
      const fit = !mock && app.fit && app.fit.view === view ? app.fit : null;
      if (prog < 1) { blueprint(px, ox, oy, prog); if ((app.t - app.bpT) % 8 === 0) AU.sfx('wrench'); }
      else if (fit) { if (!fit.fx) fit.fx = { bare: v3Sprite(des, d.paint, view, 0, fit.strip).px, old: v3Sprite(fit.old, d.paint, view).px, now: px, small: fit.strip === 'ornament' || fit.strip === 'fog' };
        if (!drawFit(S, P, fit.fx, ox, oy, 1, app.t - fit.t, AU.sfx)) { app.fit = null; drawPix(S, px, P, ox, oy, 1); } }
      else { drawPix(S, px, P, ox, oy, 1);
        if (view === 'frame' && pst && pst.margin < 1) for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) { const i = y * px.w + x; if (px.r[i] === P.byName.bare) S.blend(ox + x, oy + y, [220, 40, 30], 0.55); } }   // under-strength steel in red
      if (view === 'shape' && !ro && prog >= 1 && spec?.geo?.handles) for (const h of spec.geo.handles) {   // control points: drag along their axis
        const hx = ox + Math.round(px.X(h.x)), hy = oy + Math.round(px.Y(h.z)), id = 'H' + h.k, near = Math.abs(input.x - hx) <= 4 && Math.abs(input.y - hy) <= 4;
        if (near && input.clicked && !input.drag) { input.drag = id; app.hd = { x0: input.x, y0: input.y, v0: des.shape[h.k] || 0 }; (app.undo = app.undo || []).push(JSON.stringify(des)); app.redo = []; app.lastEdit = app.t; AU.sfx('click'); }
        const act = input.drag === id; if (act) { if (!input.down) input.drag = null; else { const SR = shapeRanges(des)[h.k]; des.shape[h.k] = Math.max(SR[0], Math.min(SR[1], app.hd.v0 + (h.ax === 'x' ? input.x - app.hd.x0 : app.hd.y0 - input.y) * px.mm)); app.lastEdit = app.t; } }
        S.fill(hx - 3, hy - 3, 7, 7, C.ink); S.fill(hx - 2, hy - 2, 5, 5, act ? C.red : near ? C.brassL : C.brass); S.fill(h.ax === 'x' ? hx - 5 : hx, h.ax === 'x' ? hy : hy - 5, h.ax === 'x' ? 11 : 1, h.ax === 'x' ? 1 : 11, act || near ? C.red : C.inkSoft);
        if (near || act) text(S, ({ screen: 'WINDSHIELD TOP', crown: 'ROOF CROWN', back: 'REAR WINDOW TOP', deck: 'DECK HEIGHT', nose: 'NOSE RAKE', fTail: 'FRONT FENDER TAIL', fCrown: 'FRONT FENDER CROWN' })[h.k], cx + 3, AY + 29, C.red, 1, pw - 60); } }
    if (view === 'shape') text(S, 'DRAG THE HANDLES', cx + 3, AY + 104, C.inkSoft, 1, pw - 6);
    if (view === 'frame' && pst && pst.margin < 1) text(S, 'FRAME TOO WEAK - CRACKS IN SERVICE', cx + 3, AY + 104, C.red, 1, pw - 6);
    if (st.id === 'body' && notes.length) text(S, 'ERA LIMIT: ' + notes.join(', ').toUpperCase(), cx + 3, AY + 104, C.red, 1, pw - 6); }
  // ---- engineering report (always) ----
  const x2 = cx + pw + 6, pw2 = AX + AW - x2 - 6; panel(S, x2, AY + 20, pw2, 210, 'ENGINEERING REPORT');
  if (ev) { const sm = ev.sim; [['TOP SPEED', `${sm.topMph.toFixed(0)} MPH`], ['0-60 MPH', sm.zeroSixty ? sm.zeroSixty.toFixed(1) + ' S' : 'NEVER'], ['ECONOMY', sm.mpg.toFixed(1) + ' MPG'], ['MAX GRADE', Math.round(sm.grade * 100) + '%'], ['WEIGHT', sm.mass + ' KG'], ['UNIT COST', money(ev.unit)]].forEach(([l, v], i) => stat(S, x2 + 4, AY + 31 + i * 8, l, v, C.ink, 44));
    text(S, ev.fit ? 'ENGINE FITS THE BAY' : 'ENGINE TOO BIG - LONGER HOOD!', x2 + 4, AY + 82, ev.fit ? C.green : C.red, 1, pw2 - 6);
    [['PERFORMANCE', ev.perf], ['ECONOMY', ev.econ], ['COMFORT', ev.comfort], ['RELIABILITY', ev.rel], ['DESIGN', ev.design], ['MODERNITY', ev.modern]].forEach(([l, v], i) => { text(S, l, x2 + 4, AY + 92 + i * 12, C.inkSoft); bar(S, x2 + 4, AY + 98 + i * 12, pw2 - 10, 4, v, v < 0.4 ? C.red : C.teal); });
    const a = appeal(ev, d.seg, d.price); text(S, `APPEAL ${Math.round(a * 100)}`, x2 + 4, AY + 166, a > 0.45 ? C.green : C.oxblood); text(S, `MARGIN ${money(d.price - ev.unit)}`, x2 + 4, AY + 174, d.price > ev.unit ? C.green : C.red); }
  else text(S, 'NEED A READY ENGINE AND GEARBOX', x2 + 4, AY + 31, C.red, 1, pw2 - 6);
  text(S, `TOOLING ${money(tool)}`, x2 + 4, AY + 184, C.ink, 1, pw2 - 6); text(S, `SPENT ${money(d.spent || 0)}`, x2 + 4, AY + 192, C.inkSoft, 1, pw2 - 6);
  const left = DEV.reduce((a, s2, i) => a + (i >= d.stage ? moOf(i) : 0), 0) - (d.busy ? dateNum(g) - d.busy.from : 0); text(S, `ABOUT ${Math.max(0, left)} MONTHS TO PRODUCTION`, x2 + 4, AY + 200, C.ink, 1, pw2 - 6);
  // ---- this place: what the stage does, and its action ----
  panel(S, cx, AY + 116, pw, 98, st.where); const tx = (s, y, c = C.ink) => text(S, s, cx + 4, AY + y, c, 1, pw - 8);
  const finishNow = i => { d.done[i] = true; if (i === 5) d.reviewDue = true; else if (i === 7) d.testDue = true; else d.stage = i + 1; AU.sfx('stamp'); };
  const reopen = i => { d.stage = i; d.done = d.done.slice(0, i); d.reviewDue = d.testDue = false; d.review = null; d.defects = null; d.busy = null; app.dstage = i; AU.sfx('stamp'); };
  const actBtn = (l, o) => button(S, cx + 2, AY + 198, pw - 4, 14, l, o);
  const info = { brief: ['SET THE TARGET: SEGMENT, PRICE AND VOLUME.', `${SEGS[d.seg].price.map(money).join(' - ')} IS THIS SEGMENT'S PRICE BAND.`, `OUR MODELS IN IT: ${g.models.filter(m => m.seg === d.seg && !m.dead).map(m => m.name).join(', ') || 'NONE'}`],
    platform: ['CHOOSE THE BASE CAR, WHEELBASE AND FRAME.', 'WEAK STEEL SHOWS RED ON THE DRAWING.', 'IT CARRIES EVERYTHING THAT FOLLOWS.'],
    engine: [ev ? `${ev.es.hp.toFixed(0)} HP  ${ev.es.litres.toFixed(2)} L  ${Math.round(ev.es.mass)} KG` : 'NO ENGINE READY', ev && ev.fit ? 'FITS BETWEEN THE FRAME RAILS.' : 'TOO LONG FOR THIS BAY.', 'NEW ENGINES ARE DESIGNED IN THE ENGINES ROOM.'],
    driveline: [ev ? `TOP ${ev.sim.topMph.toFixed(0)} MPH  0-60 ${ev.sim.zeroSixty ? ev.sim.zeroSixty.toFixed(1) + ' S' : '-'}  ${ev.sim.mpg.toFixed(1)} MPG` : '-', 'HIGHER RATIO: QUICKER, THIRSTIER.', ''],
    body: ['SHAPE THE BODY ON THE MEASURED CAR.', 'EVERY CHANGE IS RE-DRAWN ON A NEW BLUEPRINT.', ''],
    mockup: [g.year < 1938 ? 'FULL-SIZE WOODEN MOCK-UP ON THE TURNTABLE.' : 'FULL-SIZE CLAY MODEL ON THE TURNTABLE.', 'THE BOARD REVIEWS IT WHEN IT IS READY.', ''],
    detail: ['INTERIOR, TRIM, PAINT AND LIST PRICE.', `TRIM ${['BASIC', 'STANDARD', 'DE LUXE', 'CUSTOM'][d.trim]}: ${1 + Math.min(3, d.trim)} DIALS`, ''],
    proto: ['HAND-BUILT PROTOTYPES, TEST DRIVES', 'AND A DURABILITY RUN ON THE PROVING GROUND.', ''],
    prep: ['PRESS DIES, JIGS AND LINE LAYOUT.', `TOOLING ${money(tool)} - ${prepMo} MONTHS`, 'THE MODEL ENTERS PRODUCTION WHEN IT IS DONE.'] }[st.id];
  info.forEach((s, i) => tx(s, 126 + i * 9, i ? C.inkSoft : C.ink));
  if (st.id === 'engine' && !ro && button(S, cx + 4, AY + 156, 96, 12, 'DESIGN AN ENGINE')) app.tab = 'engines';
  if (st.id === 'proto' && ev) { if (button(S, cx + 4, AY + 144, 94, 11, 'WATCH BUILD', { tone: 'teal' })) startAssembly(g, spec, d, 'cars', des.plat);
    if (button(S, cx + 102, AY + 144, 94, 11, 'TEST DRIVE', { tone: 'teal' })) { const eng = g.engines.find(x => x.id === d.engineId), gbx = g.gearboxes.find(x => x.id === d.gbId); AU.drive({ ...eng, litres: ev.es.litres }, g.year, rpmTrace({ es: ev.es, engine: eng, gearbox: gbx, final: d.final, tyreR: 0.36, mass: ev.sim.mass - ev.es.mass - GEARBOX[gbx.type].mass })); } }
  if (vs === 5 && d.reviewDue && ev) {                                                                    // the board looks at the mock-up
    if (!d.review) { const t = TEMPLATES.find(x => x.id === des.base), L = t && landmarks(t.spec), n = [];
      if (L && des.roof > L.roof + 50) n.push('ROOF LOOKS TALL'); if (L && des.roof < L.roof - 50) n.push('LOW AND SLEEK - THE BOARD LIKES IT');
      if (ev.modern < 0.5) n.push('LOOKS DATED NEXT TO RIVALS'); if (style !== 'box' && g.year < 1935) n.push('TOO DARING FOR THE DEALERS?'); if (notes.length) n.push('OUTSIDE CURRENT PRACTICE');
      if (L && des.frontOH > L.frontOH * 1.15) n.push('LONG NOSE - LOOKS POWERFUL'); if (!n.length) n.push('A HANDSOME, HONEST CAR');
      d.review = { score: Math.max(0.2, Math.min(0.98, ev.design * 0.6 + ev.modern * 0.3 + (n.some(s => s.includes('LIKES') || s.includes('POWERFUL')) ? 0.08 : 0) - (n.includes('ROOF LOOKS TALL') ? 0.06 : 0))), notes: n }; AU.sfx('type'); }
    tx(`BOARD SCORE ${Math.round(d.review.score * 100)} / 100`, 156, d.review.score > 0.6 ? C.green : C.oxblood); d.review.notes.slice(0, 3).forEach((s, i) => tx('- ' + s, 165 + i * 9, C.ink));
    if (button(S, cx + 2, AY + 198, 97, 14, 'APPROVE', { tone: 'teal' })) { d.reviewBonus = (d.review.score - 0.6) * 0.15; d.reviewDue = false; d.stage = 6; app.dstage = null; AU.sfx('stamp'); }
    if (button(S, cx + 101, AY + 198, 97, 14, 'REVISE THE BODY', { tone: 'ox' })) reopen(4); }
  else if (vs === 7 && d.testDue && ev) {                                                                 // durability run results
    if (!d.defects) { let s = [...JSON.stringify(des) + d.engineId + d.gbId].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
      const cand = [[pst && pst.margin < 1.15, 'FRAME CRACK AT THE KICK-UP'], [!d.feats.hydbrake, 'BRAKE FADE ON LONG DESCENTS'], [pst && pst.stiff < 0.6, 'DOOR RATTLE ON ROUGH ROADS'], [ev.es.reliability < 0.75, 'OVERHEATING ON THE HILL CLIMB'],
        [true, 'WATER LEAK AT THE WINDSHIELD'], [true, 'GEARBOX WHINE IN SECOND'], [d.feats.unibody && g.year < 1945, 'SHELL CORROSION AT THE SILLS']];
      d.defects = cand.filter(([c]) => c && rnd() < 0.35 + (1 - ev.rel) * 0.8).map(([, s2]) => s2).slice(0, 4); AU.sfx('type'); }
    tx(d.defects.length ? `${d.defects.length} DEFECTS FOUND` : 'NO DEFECTS FOUND', 159, d.defects.length ? C.oxblood : C.green); d.defects.forEach((s2, i) => tx('- ' + s2, 167 + i * 8, C.ink));
    const fixCost = 2500 * d.defects.length;
    if (d.defects.length && button(S, cx + 2, AY + 198, 97, 14, `FIX ALL ${money(fixCost)} +1 MO`, { tone: 'teal', disabled: g.cash < fixCost })) { g.cash -= fixCost; d.spent = (d.spent || 0) + fixCost; d.busy = { i: 7, from: dateNum(g), until: dateNum(g) + 1, fix: true }; AU.sfx('wrench'); }
    if (button(S, d.defects.length ? cx + 101 : cx + 2, AY + 198, d.defects.length ? 97 : pw - 4, 14, d.defects.length ? 'SHIP AS IS' : 'CONTINUE', { tone: 'ox' })) { d.relMod = (d.relMod || 0) - 0.03 * d.defects.length; d.testDue = false; d.defects = null; d.stage = 8; app.dstage = null; AU.sfx('stamp'); } }
  else if (vs < d.stage) { tx('DONE. REOPENING IT MEANS THE LATER STAGES', 156, C.inkSoft); tx('MUST BE DONE AGAIN (AND PAID AGAIN).', 165, C.inkSoft); if (actBtn('REOPEN THIS STAGE', { tone: 'ox', disabled: !!d.busy })) reopen(vs); }
  else if (d.busy) { const k = d.busy.until - dateNum(g); actBtn(`${DEV[d.busy.i].name} IN PROGRESS - ${k} MO LEFT`, { disabled: true }); }
  else { const c = costOf(vs), m = moOf(vs), ok = (vs !== 2 || readyE.length) && (vs !== 3 || readyG.length) && (vs !== 8 || (ev && ev.fit));
    if (actBtn(`START ${st.name}  ${money(c)}  ${m ? m + ' MO' : 'NOW'}`, { tone: 'ox', disabled: g.cash < c || !ok })) { g.cash -= c; d.spent = (d.spent || 0) + c;
      if (vs === 8) d.launch = JSON.parse(JSON.stringify({ ...car, name: d.name, sprite: { v3: des, paint: d.paint } }));
      if (m) { d.busy = { i: vs, from: dateNum(g), until: dateNum(g) + m }; AU.sfx('type'); } else finishNow(vs); app.dstage = null; } }
  // ---- the pipeline: nine places in order ----
  const bw = Math.floor((AW - 8) / 9), by = AY + AH - 17;
  DEV.forEach((s2, i) => { const x = AX + 4 + i * bw, done = i < d.stage || d.done[i], cur = i === d.stage;
    if (button(S, x, by, bw - 2, 13, s2.name, { tone: done ? 'teal' : cur ? 'brass' : 'ox', active: i === vs, disabled: i > d.stage })) app.dstage = i;
    if (d.busy && d.busy.i === i) { const p = Math.min(1, (dateNum(g) - d.busy.from + 0.5) / Math.max(1, d.busy.until - d.busy.from)); S.fill(x + 1, by + 11, Math.round((bw - 4) * p), 2, C.amber); } });
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
function startAssembly(g, spec, d, back, plat = null) { const eng = g.engines.find(x => x.id === d.engineId); if (!eng || !spec) return; try { app.asm = makeAssembly(P, { spec, plat }, eng, g.year, d.paint); app.asmBack = back; app.scene = 'assembly'; } catch (e) { console.warn(e); } }
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
