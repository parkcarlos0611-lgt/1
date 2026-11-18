// GEARHOUSE 1930-1949 test build: scenes, designers, monthly loop, save/load. All UI is pixel-drawn (ui.mjs).
import * as AU from './audio.mjs';
import { lang, hooks, clip } from './ui.mjs';
import { tr } from './i18n.mjs';
import { textField, N, editing } from './ui.mjs';
import { suggest } from './names.mjs';
import { drawCity, drawWorks, drawPlant, drawDealer } from './places.mjs';
import { drawMockRoom, makeRun, drawTrack } from './track.mjs';
import { POS0, POS_R, clampPos, placeFront, placeSide } from '../tools/pixel/gen/v3/place.mjs';
import { TRIM_NAMES, wheelsFor, WHEEL_NAMES, wwMax, trimSide, trimFront } from '../tools/pixel/gen/v3/trim.mjs';
import { scrollArea } from './ui.mjs';
import { W, H, C, Sheet, drawPix, input, text, tw, windowBox, panel, button, slider, cycler, bar, stat, graph, desk, bevel, rivet, lineTo } from './ui.mjs';
import { eraPalette, hex } from '../tools/pixel/color.mjs';
import { buildCar } from '../tools/pixel/gen/car.mjs';
import { genBody, clampParams, limits } from '../tools/pixel/gen/bodygen.mjs';
import { engineSV } from '../tools/pixel/gen/engineSV.mjs';
import { flatheadV8, ohvI6, ptPalette } from '../tools/pixel/gen/engine40.mjs';
import { engineSide } from '../tools/pixel/gen/props.mjs';
import { engineStats, LAYOUTS, HEADS, maxCR, MATERIALS, PART_GROUPS, PART_OPTS, optsFor, devCost, durability, octane } from '../sim/engine.mjs';
import { drawLongPix, drawCrossPix, drawOutsidePix, engPalette, STAGE_NAMES } from './engdraw.mjs';
import { drawGearboxPix, GB_STEPS } from './gbdraw.mjs';
import { makeAssembly, drawAssembly } from './assembly.mjs';
import { drawFit } from './fitfx.mjs';
import { TEMPLATES, available, makeBody, landmarks } from '../tools/pixel/gen/v2/template.mjs';
import { newDesign, sideSpec, frontSpec, rearSpec, optionsFor, ranges, clampDesign } from '../tools/pixel/gen/v3/design.mjs';
import { baseList, baseName, measuredDesign, measuredSide, measuredView, measuredRanges, clampMeasured, shapeRanges, SHAPE_KEYS } from '../tools/pixel/gen/v3/base.mjs';
import { buildFront } from '../tools/pixel/gen/front.mjs';
import { FRAME_TYPES, GRADES, platformDefault, typesFor, gradesFor, clampPlatform, platformStats, platformPlan, platformSide, unitShell } from '../tools/pixel/gen/v3/platform.mjs';
import { Pix } from '../tools/pixel/pix.mjs';
import { stripBody } from './assembly.mjs';
import { isLadder, clampFrame, frameGeo, framePlan, frameSide, frameSection, frameZones } from '../tools/pixel/gen/v3/frame.mjs';
import { baseWidth } from '../sim/dims.mjs';
import { LIMITS, dimsFor, SIZE } from '../sim/dims.mjs';
import { GEARBOX, proposeRatios, rpmTrace } from '../sim/drive.mjs';
import { COUNTRIES, SEGS, TECH, RES_SCALE, newGame, stepMonth, evaluate, appeal, dateNum, has, BANK_OPTS, bankOption } from './world.mjs';

const PAINTS = ['#2f3a4a', '#5c1c27', '#3f5a40', '#7d3a2c', '#4b6283', '#d8c9a0', '#1d1d22', '#6b5a3a', '#8c2a24', '#6b6e70'];
const P = ptPalette(eraPalette()); PAINTS.forEach((h, i) => P.auto('paint.c' + i, h)); P.auto('paint.enginecream', '#b9ae8e'); P.auto('bare', '#9aa0a6', { sat: 0.2 }); P.auto('primerRed', '#8a3b2a'); P.auto('primerGrey', '#7d8085'); P.auto('paint.clay', '#b49a74', { sat: 0.4 }); P.auto('paint.mockwood', '#8a6a44', { sat: 0.5 }); engPalette(P); P.auto('canvas', '#3b3631', { sat: 0.5 });
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
    if (view === 'side') { const spec = meas ? measuredSide(des, paint, strip) : sideSpec(des, paint); trimSide(spec, des.tv, paint); placeSide(spec, des.pos); if (strip === 'wheel') spec.wheel = { style: 'disc', paint: 'black', whitewall: 0, cap: false }; spec.wheel = { ...spec.wheel, rot }; out = { px: buildCar(P, spec, Math.max(25, Math.ceil(spec.len / 190))), spec }; }
    else { const fs = placeFront(trimFront(meas ? measuredView(des, paint, view === 'rear', strip) : (view === 'front' ? frontSpec : rearSpec)(des, paint), des.tv, paint, view === 'rear'), des.pos, view === 'rear'); out = { px: buildFront(P, fs, 25), handles: fs.handles || [], warn: fs.warn || [], grilleArea: fs.grilleArea ?? 1 }; } } catch (e) { console.warn(e); }
  app.cache.set(key, out); if (app.cache.size > 160) app.cache.delete(app.cache.keys().next().value); return out; }
// blueprint re-scan: white linework on blue paper revealed by a moving scan bar
function blueprint(px, x0, y0, prog0) { const un = Math.min(1, prog0 / 0.14), prog = Math.max(0, (prog0 - 0.14) / 0.86), sy = Math.round(px.h * prog);   // the sheet unrolls, then the scan bar prints it
  if (un < 1) { const w = Math.round((px.w + 4) * un); S.fill(x0 - 2, y0 - 2, w, px.h + 4, hex('#1f4e8c')); S.fill(x0 - 2 + w - 2, y0 - 3, 3, px.h + 6, hex('#16386a')); return; }
  S.fill(x0 - 2, y0 - 2, px.w + 4, px.h + 4, hex('#1f4e8c'));
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
  n.name = nameField('ngname', 75, 40, 200, 'COMPANY NAME', n.name, 'company', 24);
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
    if (sv) { text(S, N(sv.name), 140, y + 5, C.ink); text(S, `${MONTHS[sv.month - 1]} ${sv.year}  ${money(sv.cash)}`, 140, y + 14, C.inkSoft); if (button(S, 290, y + 8, 48, 15, 'LOAD')) { app.g = sv; app.scene = 'hq'; app.tab = 'news'; } }
    else text(S, `SLOT ${i} - EMPTY`, 140, y + 12, C.inkSoft); }
  if (button(S, 135, 196, 80, 16, 'BACK')) app.scene = 'title';
}
// ---------- HQ ----------
const TABS = [['news', 'OFFICE'], ['engines', 'ENGINES'], ['gearbox', 'GEARBOX'], ['cars', 'CAR DESIGN'], ['prod', 'PRODUCTION'], ['research', 'RESEARCH'], ['market', 'MARKET'], ['finance', 'FINANCE'], ['save', 'SAVE'], ['menu', 'MENU']];
// name field + dice (suggestion) button
function nameField(id, x, y, w, label, value, kind, max = 16) { const v = textField(S, id, x, y, w - 13, label, value, { max }); if (button(S, x + w - 12, y + 7, 12, 11, '?', { tone: 'teal' })) { AU.sfx('click'); return suggest(kind, lang.ko); } return v; }
function confirmBox(title, lines, yes) { app.ask = { title, lines: lines.filter(Boolean), yes }; AU.sfx('click'); }
function hq() { const ask = app.ask, saved = ask ? { ...input } : null; if (ask) Object.assign(input, { clicked: false, down: false, x: -99, y: -99, wheel: 0 });
  hqBody(); if (ask && app.ask === ask) { Object.assign(input, saved);
    windowBox(S, 116, 72, 248, 112, ask.title); text(S, 'ARE YOU SURE?', 128, 94, C.oxblood); ask.lines.forEach((l, i) => text(S, l, 128, 106 + i * 10, C.ink, 1, 224));
    if (button(S, 128, 160, 106, 16, 'YES', { tone: 'ox' })) { app.ask = null; ask.yes(); } if (button(S, 246, 160, 106, 16, 'NO') || input.key === 'Escape') app.ask = null; } }
function hqBody() {
  const g = app.g; desk(S);
  bevel(S, 0, 0, W, 16, C.oxblood, C.oxL, C.oxD); rivet(S, 4, 7); rivet(S, W - 6, 7);
  text(S, N(g.name), 10, 6, C.brassL); const dt = `${MONTHS[g.month - 1]} ${g.year}`; text(S, dt, 200, 6, C.white);
  text(S, money(g.cash), 280, 6, g.cash < 0 ? hex('#ffb0a0') : C.brassL); text(S, `REP ${Math.round(g.rep * 100)}`, 360, 6, C.white); if (g.loan > 0) text(S, `LOAN ${money(g.loan)}`, 280, 0 + 11, hex('#ffb0a0'));
  if (button(S, W - 52, 2, 44, 12, AU.vol.muted ? 'SOUND' : 'MUTE', { tone: 'ox' })) { AU.vol.muted = !AU.vol.muted; AU.applyVolume(); }
  TABS.forEach(([k, l], i) => { if (button(S, 3, 19 + i * 18, 66, 16, l, { active: app.tab === k, tone: k === 'menu' || k === 'save' ? 'teal' : 'brass' })) app.tab = k; });
  if (!g.over && button(S, 3, 222, 66, 22, 'NEXT MONTH', { tone: 'ox' })) { const n0 = g.news[0]; stepMonth(g); AU.sfx(g.news[0] !== n0 ? 'wire' : 'type'); if (g.last?.sales) AU.sfx('till'); }
  if (!g.over && button(S, 3, 246, 66, 16, '+6 MONTHS')) { for (let i = 0; i < 6 && !g.over; i++) stepMonth(g); }
  devTick(g); ({ map: cityTab, news, engines, gearbox, cars, prod, research, market, finance, save, menu })[app.tab]?.(g);
  if (g.meeting && !g.over) { windowBox(S, 120, 60, 260, 150, 'MEETING AT THE BANK'); text(S, 'YOUR CREDIT IS EXHAUSTED FOR 3 MONTHS.', 134, 84, C.ink); text(S, 'CHOOSE A RESCUE PLAN:', 134, 94, C.oxblood);
    BANK_OPTS.forEach(([k, l], i) => { if (button(S, 134, 108 + i * 22, 232, 17, l, { tone: k === 'merge' ? 'ox' : 'brass' })) confirmBox(l, ['THIS DECISION CANNOT BE UNDONE.'], () => { bankOption(g, k); AU.sfx('wire'); }); }); return; }
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

// ---------- engine designer: part groups, five views (exterior, cutaway, exploded, build-up, durability), family / variant ----------
// ---------- engine designer, one step at a time (plan 21): block -> head -> bottom end -> top end -> fuel -> exhaust -> cooling -> test and release ----------
const ESTEPS = [['family', ['layout', 'material', 'maxBore', 'maxStroke', 'mains']], ['head', ['head', 'chamber']], ['bottom', ['bore', 'stroke', 'crank', 'rods', 'pistons', 'cwt', 'balancer']], ['valve', ['cr', 'cam', 'springs', 'lifters']],
  ['fuel', ['carbType', 'carbs', 'carbSize', 'manifold', 'mixture', 'advance', 'rpmLimit']], ['exhaust', ['exhManifold', 'exhaust', 'exhDia', 'muffler']], ['cooling', ['cooling', 'radiator', 'lube', 'oil']], ['release', []]];
const ESTEP_HELP = ['THE CASTING: CYLINDERS, LAYOUT AND HOW BIG THE FAMILY MAY GROW.', 'THE HEAD: WHERE THE VALVES SIT AND THE SHAPE OF THE CHAMBER.', 'CRANK, RODS AND PISTONS: DISPLACEMENT AND HOW FAST IT MAY SPIN.',
  'COMPRESSION, CAM AND VALVE GEAR: WHERE THE TORQUE COMES IN.', 'CARBURETTORS, MIXTURE AND SPARK.', 'MANIFOLDS, PIPES AND MUFFLER.', 'WATER, FAN AND OIL.', 'RUN IT ON THE BENCH, NAME IT AND TOOL UP.'];
function para(s, str, x, y, c, w, lh = 9) { const t = lang.ko ? tr(String(str).toUpperCase()) : String(str); let line = '', yy = y; for (const wd of t.split(' ')) { const nx = line ? line + ' ' + wd : wd; if (line && tw(nx) > w) { text(s, line, x, yy, c); yy += lh; line = wd; } else line = nx; } if (line) text(s, line, x, yy, c); return yy + lh; }
function engDrawing(view, e, th, w, h, stage) { const D = (view === 'cross' ? drawCrossPix : view === 'ext' ? drawOutsidePix : drawLongPix)(P, e, th, w, h, stage); return D; }
function engines(g) { windowBox(S, AX, AY, AW, AH, 'ENGINE DESIGN');
  const e = app.edraft || (app.edraft = { ...JSON.parse(JSON.stringify(g.engines[0])), id: null, from: g.engines[0].id, name: 'NEW ENGINE', quality: 0 });
  if (!e.gq) e.gq = Object.fromEntries(PART_GROUPS.map(([k]) => [k, e.quality || 0])); if (e.maxBore == null) e.maxBore = e.bore + 4; if (e.maxStroke == null) e.maxStroke = e.stroke + 6;
  const variant = !!e.from, first = variant ? 2 : 0; let st = Math.max(first, app.estep ?? first); app.emax = Math.max(app.emax ?? st, st);
  // step bar
  const bw = Math.floor((AW - 12) / 8); ESTEPS.forEach(([k], i) => { const lock = i < first, done = i < st; if (button(S, AX + 6 + i * bw, AY + 18, bw - 2, 12, STAGE_NAMES[i], { tone: done ? 'teal' : i === st ? 'brass' : 'ox', active: i === st, disabled: lock || i > app.emax })) { app.estep = i; AU.sfx('click'); } });
  st = Math.max(first, app.estep ?? first);
  const lay = Object.keys(LAYOUTS).filter(k => LAYOUTS[k].year <= g.year), heads = ['sv', 'fh', 'ohv', 'sohc', 'dohc'];
  const headOK = h => h === 'sv' || h === 'fh' || (h === 'ohv' && has(g, 'ohv')) || (h === 'sohc' && has(g, 'ohv') && g.year >= 1946);
  const opt = (k, label) => ['cyc', k, label, optsFor(k, g.year), v => PART_OPTS[k][v][0]], es0 = engineStats({ ...e, rpmLimit: undefined, year: g.year });
  const C2 = { layout: ['cyc', 'layout', 'LAYOUT', lay], material: ['cyc', 'material', 'MATERIAL', Object.keys(MATERIALS).filter(k => MATERIALS[k].year <= g.year), v => ({ iron: 'CAST IRON', alHead: 'ALUMINIUM HEAD', alBlock: 'ALUMINIUM BLOCK' })[v]],
    maxBore: ['sl', 'maxBore', 'FAMILY MAX BORE', 65, 110, 0.5, v => v.toFixed(1) + 'MM'], maxStroke: ['sl', 'maxStroke', 'FAMILY MAX STROKE', 70, 135, 0.5, v => v.toFixed(1) + 'MM'], mains: opt('mains', 'MAIN BEARINGS'), head: ['head'], chamber: opt('chamber', 'COMBUSTION CHAMBER'),
    bore: ['sl', 'bore', 'BORE MM', 65, e.maxBore, 0.5, v => v.toFixed(1)], stroke: ['sl', 'stroke', 'STROKE MM', 70, e.maxStroke, 0.5, v => v.toFixed(1)], crank: opt('crank', 'CRANKSHAFT'), rods: opt('rods', 'CONNECTING RODS'), pistons: opt('pistons', 'PISTONS'), cwt: opt('cwt', 'COUNTERWEIGHTS'), balancer: opt('balancer', 'CRANK DAMPER'),
    cr: ['cr'], cam: ['sl', 'cam', 'CAM: TORQUE..REVS', 0, 1, 0.05], springs: opt('springs', 'VALVE SPRINGS'), lifters: opt('lifters', 'TAPPETS'),
    carbType: opt('carbType', 'CARBURETTOR TYPE'), carbs: ['cyc', 'carbs', 'CARBURETTORS', has(g, 'twincarb') ? [1, 2] : [1], n => n + ' X'], carbSize: ['sl', 'carbSize', 'CARB SIZE', 0.6, 1.4, 0.05], manifold: opt('manifold', 'INTAKE MANIFOLD'),
    mixture: ['sl', 'mixture', 'FUEL MIXTURE', 0, 1, 0.05, v => (v < 0.35 ? 'LEAN' : v < 0.65 ? 'NORMAL' : 'RICH')], advance: ['sl', 'advance', 'SPARK ADVANCE', 0, 1, 0.05, v => (v < 0.35 ? 'SAFE' : v < 0.65 ? 'NORMAL' : 'HOT')], rpmLimit: ['sl', 'rpmLimit', 'RPM LIMIT', 2000, es0.mechLimit, 50, v => String(Math.round(v))],
    exhManifold: opt('exhManifold', 'EXHAUST MANIFOLD'), exhaust: opt('exhaust', 'EXHAUST'), exhDia: ['sl', 'exhDia', 'EXHAUST PIPE SIZE', 0.7, 1.4, 0.05, v => Math.round(v * 100) + '%'], muffler: opt('muffler', 'MUFFLER'),
    cooling: opt('cooling', 'COOLING'), radiator: ['sl', 'radiator', 'RADIATOR SIZE', 0.7, 1.4, 0.05, v => Math.round(v * 100) + '%'], lube: opt('lube', 'LUBRICATION'), oil: ['sl', 'oil', 'OIL CAPACITY', 0.7, 1.4, 0.05, v => Math.round(v * 100) + '%'] };
  // left column: what this step decides
  const x0 = AX + 6, rows = st === 0 ? ['from', ...ESTEPS[0][1], 'q'] : st === 7 ? ['name'] : [...ESTEPS[st][1], 'q'], gkey = PART_GROUPS.find(p => p[2].some(k => ESTEPS[st][1].includes(k)))?.[0] || 'family';
  panel(S, x0 - 2, AY + 32, 114, AH - 36, ''); para(S, ESTEP_HELP[st], x0, AY + 34, C.inkSoft, 108);
  scrollArea(S, 'estep' + st, x0 - 2, AY + 54, 114, st === 7 ? 26 : AH - 76, rows.length * 22 + 4, dy => rows.forEach((k, i) => { const y = AY + 58 + i * 22 - dy, c = C2[k];
    if (k === 'from') { const ids = ['new', ...g.engines.map(x => x.id)], cur = e.from || 'new', v = cycler(S, x0, y, 108, 'START FROM', ids, cur, { names: id => (id === 'new' ? 'NEW FAMILY' : N(g.engines.find(x => x.id === id).name)) });
      if (v !== cur) { if (v === 'new') { e.from = null; } else { const src = g.engines.find(x => x.id === v); app.edraft = { ...JSON.parse(JSON.stringify(src)), from: v, id: null, name: src.name + ' B' }; app.estep = 2; } } return; }
    if (k === 'name') { e.name = nameField('ename', x0, y - 2, 108, 'ENGINE NAME', e.name, 'engine'); return; }
    if (k === 'q') { e.gq[gkey] = Math.round(slider(S, x0, y + 2, 108, 'GROUP QUALITY', e.gq[gkey] ?? 0, -3, 3, { step: 1, fmt: v => (v > 0 ? '+' : '') + Math.round(v), id: 'gq' + st })); return; }
    if (c[0] === 'head') { const h2 = cycler(S, x0, y, 108, 'VALVETRAIN', heads, e.head, { names: h => HEADS[h].name, lock: h => !headOK(h) }); if (headOK(h2)) e.head = h2; else if (h2 !== e.head) toast('RESEARCH NEEDED FOR ' + HEADS[h2].name); return; }
    if (c[0] === 'cr') { const crMax = maxCR(g.year, e.head, e.chamber); e.cr = slider(S, x0, y + 2, 108, `COMPRESSION (MAX ${crMax.toFixed(1)})`, Math.min(e.cr, crMax), 4.5, crMax, { step: 0.1, fmt: v => v.toFixed(1) + ':1', id: 'ecr' }); return; }
    if (c[0] === 'sl') { const v0 = e[k] ?? ({ advance: 0.5, mixture: 0.5, radiator: 1, oil: 1, exhDia: 1, rpmLimit: es0.mechLimit })[k] ?? c[3]; e[k] = slider(S, x0, y + 2, 108, c[2], Math.min(v0, c[4]), c[3], c[4], { step: c[5], fmt: c[6] || (v => v.toFixed(2)), id: 'e' + k }); if (k === 'bore' || k === 'stroke' || k === 'maxBore' || k === 'maxStroke') e[k] = Math.round(e[k] * 2) / 2; return; }
    const list = c[3]; e[k] = cycler(S, x0, y, 108, c[2], list, list.includes(e[k]) ? e[k] : list[0], { names: c[4] || (v => String(v)) }); }));
  e.quality = Math.round(Object.values(e.gq).reduce((a, b) => a + b, 0) / Object.keys(e.gq).length); e.maxBore = Math.max(e.maxBore, 65); e.bore = Math.min(e.bore, e.maxBore); e.stroke = Math.min(e.stroke, e.maxStroke); if (e.rpmLimit != null) e.rpmLimit = Math.min(e.rpmLimit, es0.mechLimit);
  const es = engineStats({ ...e, year: g.year }), ed = { ...e, year: g.year };
  // right: the engine as built so far, three views
  const x1 = AX + 122, pw1 = AX + AW - 6 - x1, VW = [['long', 'SECTION'], ['cross', 'CROSS'], ['ext', 'OUTSIDE']], vw = VW.some(v => v[0] === app.engView) ? app.engView : 'long';
  const dyn = app.dyno, pr = dyn ? Math.max(0, Math.min(1, (app.t - dyn.f0 - 102) / 156)) : 1, B = app.bench || (app.bench = { rpm: 0, thr: 0, temp: 20, on: false });
  const live = st === 7 ? (B.on ? B.rpm / 25 : 0) : dyn ? (app.t - dyn.f0 < 66 ? 0 : 40 + pr * 200) : app.visRpm ?? 30; app.th = (app.th || 0) + live * 6 / 60;
  const ph = st === 7 ? 110 : 150; panel(S, x1, AY + 32, pw1, ph, ''); VW.forEach(([k2, l], i) => { if (button(S, x1 + 2 + i * 44, AY + 33, 43, 9, l, { active: vw === k2 })) app.engView = k2; });
  const D = engDrawing(vw, ed, app.th, pw1 - 4, ph - 14, st + 1); drawPix(S, D.px, P, x1 + 2, AY + 44, 1);
  { const mx = input.x - x1 - 2, my = input.y - AY - 44; if (mx >= 0 && my >= 0 && mx < D.px.w && my < D.px.h) { const t = D.px.t[my * D.px.w + mx], nm = D.names[t]; if (nm) { const w2 = tw(nm) + 6; S.fill(input.x + 6, input.y - 10, w2, 9, C.ink); text(S, nm, input.x + 9, input.y - 8, C.brassL); } } }
  if (st >= 3 && st < 7) [['INTAKE STROKE', 'eng.in'], ['COMPRESSION STROKE', 'eng.cmp'], ['POWER STROKE', 'eng.pow'], ['EXHAUST STROKE', 'eng.exh']].forEach(([l, r], i) => { S.fill(x1 + pw1 - 124 + i * 31, AY + 35, 4, 4, P.ramps[P.id(r)].c[3]); text(S, l, x1 + pw1 - 119 + i * 31, AY + 35, C.inkSoft, 1, 25); });
  // below: running speed, the figures known so far, previous / next
  const yb = AY + 32 + ph + 4, known = { disp: st >= 2, red: st >= 3, power: st >= 4, rel: st >= 6 }, dash = '-';
  if (st < 7) { app.visRpm = slider(S, x1, yb + 2, 90, 'CRANK SPEED', app.visRpm ?? 30, 0, 160, { step: 5, fmt: v => (v ? Math.round(v) + '' : 'STOP'), id: 'visrpm' });
    [['DISPLACE', known.disp ? es.litres.toFixed(2) + 'L' : dash], ['POWER', known.power ? es.hp.toFixed(0) + 'HP' : dash], ['RED LINE', known.red ? String(es.redline) : dash], ['MASS', es.mass + 'KG'], ['RELIABLE', known.rel ? Math.round(es.reliability * 100) + '%' : dash], ['UNIT COST', st >= 2 ? money(es.cost) : dash]]
      .forEach(([l, v], i) => stat(S, x1 + 98 + (i % 3) * 60, yb + (i >> 1 & 0) + Math.floor(i / 3) * 9, l, v, C.ink, 32)); }
  else { // test and release: bench, curve, every figure, tooling
    const bx = x1 + 2, by = yb; B.thr = slider(S, bx + 40, by, 64, 'THROTTLE', B.thr, 0, 1, { step: 0.02, fmt: v => Math.round(v * 100) + '%', id: 'bthr' });
    if (button(S, bx, by + 1, 36, 12, B.on ? 'STOP' : 'START', { tone: B.on ? 'ox' : 'teal' })) { B.on = !B.on; if (B.on) { AU.unlock(); AU.sfx('start'); } }
    const idle = 550, target = B.on ? idle + B.thr * (es.redline - idle) : 0; B.rpm += (target - B.rpm) * (0.02 + es.response * 0.05); const c0 = es.curve, ci = Math.max(0, Math.min(c0.length - 1, Math.round((B.rpm - c0[0].rpm) / 100))), tq = B.on ? c0[ci].T * (0.15 + 0.85 * B.thr) : 0, hp = tq * B.rpm * Math.PI / 30 / 745.7;
    B.temp += ((B.on ? 75 + hp / Math.max(1, es.hp) * 25 * (1 + es.overheat * 2) : 20) - B.temp) * 0.004; if (B.on && AU.ready()) { if (!app.bv) app.bv = AU.engineVoice({ ...e, litres: es.litres }, g.year); app.bv.set(Math.max(idle, B.rpm), 0.2 + B.thr * 0.8, 0.8); }
    [['RPM', String(Math.round(B.rpm / 10) * 10)], ['HP', hp.toFixed(0)], ['NM', tq.toFixed(0)], ['WATER', Math.round(B.temp) + 'C']].forEach(([l, v], i) => stat(S, bx + 110 + (i % 2) * 74, by + 1 + (i >> 1) * 9, l, v, i === 3 && B.temp > 98 ? C.red : C.ink, 26));
    Object.entries(es.bars).forEach(([l, v], i) => { const u = v * (B.rpm / Math.max(1, es.redline)) ** (i === 1 ? 2 : 1); text(S, l, bx, by + 22 + i * 8, C.inkSoft, 1, 54); bar(S, bx + 56, by + 23 + i * 8, 48, 4, Math.min(1, u), u > 0.97 ? C.red : u > 0.8 ? C.amber : C.teal); });
    const gx = bx + 110, gw = pw1 - 114, cur = es.curve, mxT = Math.max(...cur.map(p => Math.max(p.T, p.hp * 2))) * 1.08; graph(S, gx, by + 20, gw, 34, [{ pts: cur.map(p => p.T), c: C.teal }, { pts: cur.map(p => p.hp * 2), c: C.red }], { max: mxT }); if (B.rpm > 600) S.fill(gx + 1 + Math.round((B.rpm - cur[0].rpm) / Math.max(1, cur.at(-1).rpm - cur[0].rpm) * (gw - 3)), by + 21, 1, 32, C.oxblood);
    const ST = [['POWER', `${es.hp.toFixed(0)}HP @${es.hpRpm}`], ['TORQUE', `${es.torque.toFixed(0)}NM @${es.tRpm}`], ['DISPLACE', `${es.litres.toFixed(2)}L`], ['RED LINE', `${es.redline}`], ['LIMITED BY', es.redline < es.mechLimit ? 'RPM LIMIT' : es.limitBy], ['MASS', es.mass + ' KG'], ['SMOOTH', Math.round(es.smooth * 100) + '%'],
      ['RELIABLE', Math.round(es.reliability * 100) + '%'], ['RESPONSE', Math.round(es.response * 100) + '%'], ['NOISE', Math.round(es.noise * 100) + '%'], ['EFFICIENCY', Math.round(es.thermal * 100) + '%'], ['COOLING', es.coolKW + ' KW'], ['OCTANE NEED', `${es.octaneReq} (${Math.round(octane(g.year))})`], ['UNIT COST', money(es.cost)], ['SERVICE/YR', money(es.service)]];
    scrollArea(S, 'estats', x0 - 2, AY + 84, 114, AH - 112, ST.length * 9 + 2, dy2 => ST.forEach(([l, v], i) => stat(S, x0, AY + 86 + i * 9 - dy2, l, v, (l === 'RELIABLE' && es.reliability < 0.7) || (l === 'OCTANE NEED' && es.octaneReq > octane(g.year)) ? C.red : C.ink, 50)));
    const dc = devCost(e, g.year, g.engines), can = g.cash >= dc.cost; text(S, `${dc.kind}${dc.of ? ' (' + N(dc.of.name) + ')' : ''}`, x0, AY + AH - 24, C.inkSoft, 1, 108); text(S, `${money(dc.cost)} / ${dc.months} MO`, x0, AY + AH - 14, can ? C.ink : C.red, 1, 108);
    if (button(S, AX + AW - 128, AY + AH - 18, 120, 14, dc.kind === 'VARIANT' ? 'DEVELOP VARIANT' : 'TOOL UP FAMILY', { tone: 'ox', disabled: !can })) confirmBox(dc.kind === 'VARIANT' ? 'DEVELOP ENGINE VARIANT' : 'TOOL UP ENGINE FAMILY', [`COST ${money(dc.cost)}`, `TAKES ${dc.months} MONTHS`, dc.kind === 'VARIANT' ? 'SAME BLOCK AND HEAD CASTINGS.' : 'NEW BLOCK AND HEAD TOOLING.'], () => {
      const id = 'E' + g.serial++, auto = !e.name || e.name === 'NEW ENGINE' || / B$/.test(e.name); g.engines.push({ ...JSON.parse(JSON.stringify(e)), id, from: undefined, name: auto ? `${e.layout}-${HEADS[e.head].name.split(' ')[0]} ${es.litres.toFixed(1)}` : e.name, readyAt: dateNum(g) + dc.months, tooling: dc.cost,
        maxBore: dc.of ? dc.of.maxBore ?? dc.of.bore + 4 : e.maxBore, maxStroke: dc.of ? dc.of.maxStroke ?? dc.of.stroke + 6 : e.maxStroke }); g.cash -= dc.cost; toast(dc.kind === 'VARIANT' ? 'ENGINE VARIANT STARTED' : 'ENGINE TOOLING STARTED'); app.edraft = null; app.estep = 0; app.emax = 0; }); }
  if (app.bv && !(st === 7 && B.on)) { app.bv.stop(); app.bv = null; B.on = false; }
  if (st > first && button(S, x1, AY + AH - 18, 50, 14, 'BACK')) app.estep = st - 1;
  if (st < 7 && button(S, AX + AW - 70, AY + AH - 18, 62, 14, 'NEXT STEP', { tone: 'teal' })) { app.estep = st + 1; app.emax = Math.max(app.emax, st + 1); AU.sfx(st === 0 ? 'clunk' : 'ratchet'); }
}
// ---------- gearbox designer in steps (plan 21-1): type -> gears and ratios -> test and release ----------
const gearName = n => (lang.ko ? n + '단 기어' : n + ' GEAR');
const GB_HELP = ['THE KIND OF GEARBOX: HOW IT SHIFTS, HOW MUCH IT LOSES, WHAT IT COSTS.', 'HOW MANY SPEEDS AND HOW WIDE THE SPREAD FROM FIRST TO TOP.', 'TRY EACH GEAR, CHECK THE SPEEDS, NAME IT AND TOOL UP.'];
function gearbox(g) { windowBox(S, AX, AY, AW, AH, 'GEARBOX + DRIVELINE');
  const d = app.gdraft || (app.gdraft = { type: g.gearboxes[0].type, gears: 3, first: 2.9, top: 1.0, test: -1 });
  let st = app.gstep ?? 0; app.gmax = Math.max(app.gmax ?? 0, st);
  const bw = Math.floor((AW - 12) / 3); GB_STEPS.forEach((l, i) => { if (button(S, AX + 6 + i * bw, AY + 18, bw - 2, 12, l, { tone: i < st ? 'teal' : i === st ? 'brass' : 'ox', active: i === st, disabled: i > app.gmax })) { app.gstep = i; AU.sfx('click'); } });
  st = app.gstep ?? 0;
  const types = Object.keys(GEARBOX).filter(k => GEARBOX[k].year <= g.year), ok = k => k === 'crash3' || has(g, { sync3: 'sync3', sync4: 'sync4', od3: 'od', fluid: 'fluid', hydra4: 'hydra', tc2: 'hydra' }[k]);
  const G = GEARBOX[d.type]; d.gears = Math.max(G.gears[0], Math.min(G.gears[1], d.gears)); d.top = Math.max(d.type === 'od3' ? 0.7 : 0.9, Math.min(1, d.top)); const R = proposeRatios(d.gears, d.first, d.top); d.ratios = R;
  // left column
  const x0 = AX + 6; panel(S, x0 - 2, AY + 32, 114, AH - 36, ''); para(S, GB_HELP[st], x0, AY + 34, C.inkSoft, 108); const y0 = AY + 70;
  if (st === 0) { const t2 = cycler(S, x0, y0, 108, 'TYPE', types, d.type, { names: k => GEARBOX[k].name, lock: k => !ok(k) }); if (ok(t2)) d.type = t2; else if (t2 !== d.type) toast('RESEARCH NEEDED');
    text(S, 'YOUR GEARBOXES', x0, y0 + 30, C.inkSoft); g.gearboxes.forEach((x, i) => text(S, N(x.name.slice(0, 16)) + (x.readyAt > dateNum(g) ? '*' : ''), x0, y0 + 40 + i * 9, C.ink, 1, 108)); }
  if (st === 1) { d.gears = cycler(S, x0, y0, 108, 'FORWARD GEARS', Array.from({ length: G.gears[1] - G.gears[0] + 1 }, (_, i) => G.gears[0] + i), d.gears, { names: n => n + ' SPEEDS' });
    d.first = slider(S, x0, y0 + 26, 108, '1ST GEAR RATIO', d.first, 2.0, 4.0, { step: 0.05, id: 'gfirst' }); d.top = slider(S, x0, y0 + 48, 108, 'TOP GEAR RATIO', d.top, d.type === 'od3' ? 0.7 : 0.9, 1.0, { step: 0.01, id: 'gtop' });
    text(S, 'RATIOS', x0, y0 + 72, C.inkSoft); R.forEach((r, i) => stat(S, x0, y0 + 82 + i * 9, gearName(i + 1), r.toFixed(2) + ':1', C.ink, 40)); }
  const engs = g.engines.filter(e => !(e.readyAt > dateNum(g))), eng = engs.find(e => e.id === app.gEng) || engs[0] || g.engines[0];
  if (st === 2) { d.name = nameField('gname', x0, y0 - 2, 108, 'GEARBOX NAME', d.name || '', 'gearbox');
    const sel = [-1, ...R.map((_, i) => i), -2]; d.test = cycler(S, x0, y0 + 26, 108, 'TEST GEAR', sel, sel.includes(d.test) ? d.test : -1, { names: v => (v === -1 ? 'NEUTRAL' : v === -2 ? 'REVERSE' : gearName(v + 1)) });
    if (engs.length) { const id = cycler(S, x0, y0 + 52, 108, 'WITH ENGINE', engs.map(e => e.id), eng.id, { names: id2 => N(g.engines.find(e => e.id === id2).name) }); app.gEng = id; } }
  // right: drawing
  const x1 = AX + 122, pw1 = AX + AW - 6 - x1, ph = 132; panel(S, x1, AY + 32, pw1, ph, '');
  app.gang = (app.gang || 0) + (st === 2 && d.test === -1 ? 0.06 : 0.12); const D = drawGearboxPix(P, d, app.gang, pw1 - 4, ph - 4, st + 1, st === 2 ? d.test : -1); drawPix(S, D.px, P, x1 + 2, AY + 34, 1);
  { const mx = input.x - x1 - 2, my = input.y - AY - 34; if (mx >= 0 && my >= 0 && mx < D.px.w && my < D.px.h) { const nm = D.names[D.px.t[my * D.px.w + mx]]; if (nm) { S.fill(input.x + 6, input.y - 10, tw(nm) + 6, 9, C.ink); text(S, nm, input.x + 9, input.y - 8, C.brassL); } } }
  // below the drawing
  const yb = AY + 32 + ph + 4;
  if (st === 0) [['EFFICIENCY', Math.round(G.eff * 100) + '%'], ['MASS', G.mass + ' KG'], ['COMFORT', Math.round(G.comfort * 100) + '%'], ['SHIFT TIME', G.shift + ' S'], ['UNIT COST', money(G.cost)], ['SPEEDS', G.gears[0] === G.gears[1] ? String(G.gears[0]) : G.gears[0] + '-' + G.gears[1]]].forEach(([l, v], i) => stat(S, x1 + (i % 3) * 88, yb + Math.floor(i / 3) * 10, l, v, C.ink, 46));
  if (st === 1) { const bwid = Math.min(22, Math.floor((pw1 - 10) / R.length)); R.forEach((r, i) => { const h2 = Math.round(r / 4 * 34); S.fill(x1 + 4 + i * bwid, yb + 36 - h2, bwid - 6, h2, C.teal); text(S, String(i + 1), x1 + 4 + i * bwid, yb + 38, C.ink); });
    const spread = R[0] / R.at(-1), steps = R.slice(1).map((r, i) => R[i] / r); stat(S, x1 + 130, yb, 'SPREAD', spread.toFixed(2), C.ink, 60); stat(S, x1 + 130, yb + 10, 'LARGEST STEP', Math.max(...steps, 1).toFixed(2), Math.max(...steps, 1) > 1.9 ? C.red : C.ink, 60); stat(S, x1 + 130, yb + 20, 'MASS', G.mass + ' KG', C.ink, 60); }
  if (st === 2 && eng) { const es = engineStats({ ...eng, year: g.year }), fd = 4.1, tr0 = 0.33, mph = r => es.redline * 2 * Math.PI / 60 * tr0 / (r * fd) * 2.237;
    text(S, `SPEED AT RED LINE: ${es.redline} RPM / FINAL DRIVE 4.1`, x1, yb, C.inkSoft, 1, pw1); R.forEach((r, i) => stat(S, x1 + (i % 3) * 88, yb + 10 + Math.floor(i / 3) * 9, gearName(i + 1), Math.round(mph(r)) + ' MPH', i === d.test ? C.oxblood : C.ink, 40)); }
  // footer
  if (st > 0 && button(S, x1, AY + AH - 18, 50, 14, 'BACK')) app.gstep = st - 1;
  if (st < 2 && button(S, AX + AW - 70, AY + AH - 18, 62, 14, 'NEXT STEP', { tone: 'teal' })) { app.gstep = st + 1; app.gmax = Math.max(app.gmax, st + 1); AU.sfx('ratchet'); }
  if (st === 2 && button(S, AX + AW - 128, AY + AH - 18, 120, 14, `BUILD ($15,000 / 3 MO)`, { tone: 'ox', disabled: g.cash < 15000 })) confirmBox('BUILD GEARBOX', ['COST $15,000', 'TAKES 3 MONTHS'], () => {
    g.gearboxes.push({ id: 'G' + g.serial++, name: d.name || `${d.gears}-SPD ${G.name.split(' ').slice(-1)[0]}`, type: d.type, gears: d.gears, ratios: R, readyAt: dateNum(g) + 3 }); g.cash -= 15000; toast('GEARBOX TOOLING STARTED'); app.gstep = 0; app.gmax = 0; app.gdraft = null; });
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
    g.news.unshift({ t: N(L.name) + ' ENTERS PRODUCTION', d: dateNum(g) }); g.proj = null; app.draft = null; app.dstage = null; toast('MODEL IN PRODUCTION'); return; }
  d.done[i] = true;
  if (i === 7 && fix) { d.relMod = (d.relMod || 0) + 0.015 * (d.defects?.length || 0); d.defects = null; d.testDue = false; d.stage = 8; toast('DEFECTS FIXED'); return; }
  if (i === 5) d.reviewDue = true; else if (i === 7) d.testDue = true; else d.stage = i + 1; toast(DEV[i].name + ' COMPLETE'); }
const tr2 = s => (lang.ko ? tr(s) : s);
function briefDoc(g, d, x, y, w, h) {                                       // typed project brief
  S.fill(x, y, w, h, C.white); S.fill(x, y, w, 1, C.paperDark); const sg = SEGS[d.seg], top = Object.entries(sg.w).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k.toUpperCase()).join(', ');
  const lines = ['PROJECT BRIEF - ' + N(d.name), MONTHS[g.month - 1] + ' ' + g.year + '  ' + COUNTRIES[g.country].name, '', 'SEGMENT: ' + d.seg.toUpperCase(), 'TARGET PRICE: ' + money(d.price), 'VOLUME: ' + d.volume + ' CARS / YEAR', 'BUYERS VALUE: ' + top].map(tr2);
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
  windowBox(S, AX, AY, AW, AH, 'NEW CAR PROJECT - ' + N(d.name));
  const vs = app.dstage != null && app.dstage <= d.stage ? app.dstage : d.stage, st = DEV[vs], ro = vs < d.stage || !!d.busy, snap = ro ? JSON.stringify(d) : null;
  // ---- body design record (v3 / measured base) and platform ----
  let des = d.v3 || (d.v3 = measuredDesign(baseList(g.year).includes('sedan30') ? 'sedan30' : baseList(g.year)[0], g.year)); if (des.year !== g.year) des.year = g.year;
  const meas = des.base && des.base !== 'free', baseOpts = ['free', ...baseList(g.year)], prevBase = des.base || 'free'; if (!des.base) des.base = 'free';
  if (!des.plat) des.plat = platformDefault(des.base, g.year);
  des.pos = clampPos(des.pos || { ...POS0 });
  if (des.plat.wb == null) { des.plat.wb = des.wb; des.plat.width = des.width; } clampFrame(des.plat, g.year);
  const fitBody = nb => { if (nb === 'free') return true; const r2 = measuredRanges({ base: nb }); return des.plat.wb >= r2.wb[0] - 1 && des.plat.wb <= r2.wb[1] + 1 && des.plat.width >= r2.width[0] - 1 && des.plat.width <= r2.width[1] + 1; };
  { const wl = wheelsFor(Math.round(d.trim ?? 1), g.year); if (!wl.includes(d.wheel)) d.wheel = wl[wl.length - 1]; d.ww = Math.min(d.ww ?? 0, wwMax(Math.round(d.trim ?? 1))); des.tv = { trim: Math.round(d.trim ?? 1), wheel: d.wheel, ww: d.ww }; }
  const isMeas = meas, uniB = des.plat.type === 'unibody', ladP = isLadder(des.plat), tabs = st.id === 'body' ? [['side', 'SIDE'], ...(isMeas ? [['shape', 'SHAPE']] : []), ['front', 'FRONT'], ['rear', 'REAR'], ...(uniB ? [['frame', 'SHELL']] : [])] : st.id === 'platform' && !uniB ? [['plan', 'PLAN'], ['fside', 'SIDE'], ['sect', 'SECTION']] : [];
  if ((!isMeas && app.dview === 'shape') || (app.dview === 'frame' && !uniB)) app.dview = 'side';
  const view = st.id === 'platform' ? 'frame' : st.id === 'body' ? app.dview || 'side' : st.id === 'mockup' ? ['side', 'front', 'rear'][Math.floor(app.t / 110) % 3] : 'side', tbw = 34;
  const fview = uniB ? 'plan' : app.fview || 'plan';
  tabs.forEach(([k, l], i) => { if (button(S, AX + 120 + i * tbw, AY + 2, tbw - 2, 10, l, { active: st.id === 'platform' ? fview === k : view === k })) { if (st.id === 'platform') app.fview = k; else app.dview = k; } });
  const R0 = ranges(g.year), opt = (k, key) => optionsFor(key || k, g.year), NM = { sedan4d: '4-DOOR SEDAN', coupe2d: '2-DOOR COUPE' };
  const ctl = [];   // [kind, key, label, a, b, fmt, step]
  const MR = meas ? measuredRanges(des) : null, srcs = baseList(g.year), sn = id => baseName(id), mm = v => Math.round(v) + 'MM', yn = (a, b) => v => (v ? b : a);
  if (st.id === 'brief') ctl.push(['name', 'name', 'MODEL NAME', d, 'model'], ['dcyc', 'seg', 'TARGET SEGMENT', Object.keys(SEGS), null, k => k.toUpperCase()], ['dsl', 'price', 'TARGET PRICE', 350, 5000, money, 10], ['dsl', 'volume', 'ANNUAL VOLUME', 500, 30000, v => Math.round(v) + ' CARS', 100]);
  if (st.id === 'platform') { const pl = des.plat, uni = pl.type === 'unibody', srcM = g.models.filter(m => m.plat && m.plat.type !== 'unibody' && !m.dead), pc = v => Math.round(v * 100) + '%';
    ctl.push(['name', 'name', 'PLATFORM NAME', des.plat, 'platform']);
    if (srcM.length) ctl.push(['pl', 'from', 'PLATFORM SOURCE', ['new', ...srcM.map(m => m.id)], null, k => (k === 'new' ? 'NEW PLATFORM' : N(g.models.find(m => m.id === k)?.name || '?'))]);
    if (!pl.from || pl.from === 'new') {
      ctl.push(['pl', 'type', 'STRUCTURE', typesFor(g.year, k => has(g, k)), null, k => FRAME_TYPES[k].name], ['pls', 'wb', 'WHEELBASE', 2000, 4430, mm, 10], ['pls', 'width', 'WIDTH', 1400, 2215, mm, 10], ['pl', 'grade', 'STEEL GRADE', gradesFor(g.year), null, k => GRADES[k].name]);
      if (pl.type === 'platform') ctl.push(['pls', 'railH', 'TUBE DIAMETER', 90, 200, mm, 5], ['pls', 'railT', 'TUBE WALL', 2.5, 5, v => v.toFixed(2) + 'MM', 0.25]);
      else if (!uni) { ctl.push(['pls', 'railH', 'RAIL DEPTH', 90, 280, mm, 5], ['pls', 'railW', 'RAIL WIDTH', 40, 100, mm, 5], ['pls', 'railT', 'STEEL GAUGE', 2.5, 8, v => v.toFixed(2) + 'MM', 0.25], ['pls', 'taper', 'FRONT NARROWING', 0.6, 0.95, pc, 0.01], ['pls', 'kick', 'KICK-UP OVER AXLE', 0, 260, mm, 5]);
        if (g.year >= 1932) ctl.push(['pls', 'drop', 'DOUBLE DROP', 0, 120, mm, 5]);
        ctl.push(['pls', 'cross', 'CROSS-MEMBERS', 3, 8, v => Math.round(v) + '', 1], ['pl', 'xType', 'CROSS-MEMBER TYPE', ['channel', 'tube'], null, k => (k === 'tube' ? 'TUBE' : 'CHANNEL')], ['pl', 'join', 'JOINTS', g.year >= 1936 ? ['rivet', 'weld'] : ['rivet'], null, k => (k === 'weld' ? 'WELDED' : 'RIVETED')],
          ['pl', 'gusset', 'KICK-UP FISH PLATES', [false, true], null, yn('NO', 'YES')], ['pls', 'mounts', 'BODY MOUNTS', 6, 14, v => Math.round(v) + '', 2]); }
      if (has(g, 'ifs')) ctl.push(['fcyc', 'ifs', 'FRONT SUSPENSION', [false, true], null, yn('BEAM AXLE', 'INDEPENDENT')]);
      if (has(g, 'hydbrake')) ctl.push(['fcyc', 'hydbrake', 'BRAKES', [false, true], null, yn('MECHANICAL', 'HYDRAULIC')]); } }
  if (st.id === 'engine' && readyE.length) ctl.push(['dcyc', 'engineId', 'ENGINE', readyE.map(e => e.id), null, id => N(g.engines.find(e => e.id === id).name)]);
  if (st.id === 'driveline' && readyG.length) ctl.push(['dcyc', 'gbId', 'GEARBOX', readyG.map(x => x.id), null, id => N(g.gearboxes.find(x => x.id === id).name)], ['dsl', 'final', 'FINAL DRIVE', 3.0, 5.5, v => v.toFixed(2), 0.05]);
  if (st.id === 'detail') { const tr0 = Math.round(d.trim ?? 1); d.trimNames = d.trimNames || [...TRIM_NAMES]; g.paintNames = g.paintNames || PAINTS.map((_, i) => 'COLOUR ' + (i + 1));
    ctl.push(['dsl', 'trim', 'TRIM LEVEL', 0, 3, v => N(d.trimNames[Math.round(v)]), 1], ['name', tr0, 'TRIM NAME', d.trimNames, 'suffix'], ['dcyc', 'wheel', 'WHEELS', wheelsFor(tr0, g.year), null, k => WHEEL_NAMES[k]]);
    if (wwMax(tr0) > 0) ctl.push(['dsl', 'ww', 'WHITEWALL', 0, wwMax(tr0), v => Math.round(v * 100) + '%', 0.05]); if (has(g, 'steelroof')) ctl.push(['fcyc', 'steelroof', 'ROOF', [false, true], null, yn('FABRIC INSERT', 'ALL STEEL')]);
    ctl.push(['dcyc', 'paint', 'PAINT', PAINTS.map((_, i) => i), null, i => N(g.paintNames[i])], ['name', d.paint, 'COLOUR NAME', g.paintNames, 'colour'], ['dsl', 'price', 'LIST PRICE', 350, 5000, money, 10]); }
  if (st.id === 'prep') ctl.push(['dsl', 'volume', 'ANNUAL VOLUME', 500, 30000, v => Math.round(v) + ' CARS', 100]);
  if (st.id === 'body') { if (view === 'side') ctl.push(['name', 'bodyName', 'BODY STYLE NAME', des, 'body'], ['cyc', 'base', 'BODY SHELL', baseOpts, null, id => (id === 'free' ? 'FREE DESIGN' : baseName(id)) + (fitBody(id) ? '' : ' - NO FIT')]);
    if (view === 'frame') ctl.push(['pls', 'railT', 'PANEL GAUGE', 0.9, 2.5, v => v.toFixed(1) + 'MM', 0.1], ['pls', 'sill', 'SILL DEPTH', 0.8, 1.4, v => Math.round(v * 100) + '%', 0.05], ['pl', 'brace', 'BULKHEAD BRACE', [false, true], null, yn('NO', 'YES')]);
    if (meas) {
      if (view === 'shape') { const SR = shapeRanges(des), SL = { screen: 'WINDSHIELD TOP', crown: 'ROOF CROWN', back: 'REAR WINDOW TOP', deck: 'DECK HEIGHT', nose: 'NOSE RAKE', fTail: 'FRONT FENDER TAIL', fCrown: 'FRONT FENDER CROWN' };
        for (const k of SHAPE_KEYS) if (SR[k][1] > SR[k][0]) ctl.push(['sh', k, SL[k], SR[k][0], SR[k][1], v => (v > 0 ? '+' : '') + Math.round(v) + 'MM', 5]); }
      if (view === 'side') ctl.push(['sl', 'frontOH', 'FRONT OVERHANG', ...MR.frontOH, mm, 10], ['sl', 'rearOH', 'REAR OVERHANG', ...MR.rearOH, mm, 10], ['sl', 'belt', 'BODY HEIGHT', ...MR.belt, mm, 5],
        ['sl', 'roof', 'ROOF HEIGHT', ...MR.roof, mm, 5], ['cyc', 'lampFrom', 'HEADLAMPS FROM', srcs, null, sn], ['cyc', 'bumperFrom', 'BUMPERS FROM', srcs, null, sn], ['cyc', 'tailFrom', 'TAIL LAMPS FROM', srcs, null, sn], ['cyc', 'fenderBlack', 'FENDERS BLACK', [false, true]]);
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
        ['sl', 'louvres', 'HOOD LOUVRES', 0, 16, v => Math.round(v) + '', 1], ['cyc', 'spear', 'SIDE SPEAR', [true, false]], ['cyc', 'spare', 'SPARE', opt('spare')], 
        ['cyc', 'fenderBlack', 'FENDERS BLACK', [true, false]], ['cyc', 'roofTone', 'BLACK ROOF', [true, false]]);
      if (view === 'front') ctl.push(['cyc', 'grille', 'GRILLE', opt('grille')], ['cyc', 'gpattern', 'GRILLE PATTERN', opt('gpattern')], ['sl', 'grilleW', 'GRILLE WIDTH', 0.25, 0.75, v => Math.round(v * des.width) + 'MM', 0.01], ['sl', 'grilleH', 'GRILLE HEIGHT', 0.3, 0.8, v => Math.round(v * 100) + '%', 0.01],
        ['cyc', 'lamp', 'HEADLAMPS', opt('lamp')], ['sl', 'lampR', 'LAMP SIZE', 70, 135, v => Math.round(v * 2) + 'MM', 1], ['sl', 'lampY', 'LAMP SPACING (MIRRORED)', 0.3, 0.9, v => Math.round(v * des.width) + 'MM', 0.01], ['sl', 'lampZ', 'LAMP HEIGHT', 0.5, 0.95, v => Math.round(v * 100) + '%', 0.01],
        ['sl', 'bumperBars', 'BUMPER BARS', 1, 2, v => Math.round(v) + '', 1], ['cyc', 'guards', 'BUMPER GUARDS', [0, 2, 3]], ['cyc', 'fog', 'FOG LAMPS', [false, true]], ['cyc', 'ornament', 'HOOD ORNAMENT', [true, false]]);
      if (view === 'rear') ctl.push(['cyc', 'tailLamp', 'TAIL LAMPS', opt('tailLamp')], ['sl', 'tailY', 'TAIL LAMP SPACING (MIRRORED)', 0.4, 0.95, v => Math.round(v * des.width) + 'MM', 0.01], ['cyc', 'rearWindow', 'REAR WINDOW', opt('rearWindow')], ['cyc', 'spare', 'SPARE', opt('spare')], ['cyc', 'guards', 'BUMPER GUARDS', [0, 2, 3]]);
    } }
  if (st.id === 'body' && (view === 'front' || view === 'rear')) { const sg = v => (v > 0 ? '+' : '') + Math.round(v) + 'MM', pc = v => Math.round(v * 100) + '%', P2 = (k, l, f, stp) => ['ps', k, l, POS_R[k][0], POS_R[k][1], f, stp];   // symmetric placement
    if (view === 'front') ctl.push(P2('lampDY', 'LAMP SPACING (MIRRORED)', sg, 5), P2('lampDZ', 'LAMP HEIGHT', sg, 5), P2('lampK', 'LAMP SIZE', pc, 0.01), P2('grilleDZ', 'GRILLE POSITION', sg, 5), P2('grilleW', 'GRILLE WIDTH', pc, 0.01), P2('grilleH', 'GRILLE HEIGHT', pc, 0.01), P2('bumperDZ', 'BUMPER HEIGHT', sg, 5), P2('bumperW', 'BUMPER WIDTH', pc, 0.01));
    else ctl.push(P2('tailDY', 'TAIL LAMP SPACING (MIRRORED)', sg, 5), P2('tailDZ', 'TAIL LAMP HEIGHT', sg, 5), P2('rBumperDZ', 'BUMPER HEIGHT', sg, 5)); }
  const before = JSON.stringify(des);
  scrollArea(S, 'design-' + st.id + view, AX + 4, AY + 19, 94, 210, ctl.length * 19 + 6, dy => ctl.forEach(([kind, key, label, a, b, fmt, step], i) => { const y = AY + 23 + i * 19 - dy, nm = fmt || (v => (v === true ? 'YES' : v === false ? 'NO' : String(v).toUpperCase()));
    if (kind === 'ps') des.pos[key] = slider(S, AX + 6, y, 86, label, des.pos[key], a, b, { step, fmt, id: 'd3q' + key });
    else if (kind === 'name') { const obj = a; if (!ro) obj[key] = nameField('nm' + st.id + label, AX + 6, y - 2, 86, label, obj[key] || '', b, 16); else text(S, N(obj[key] || '-'), AX + 6, y + 5, C.ink, 1, 86); }
    else if (kind === 'pls') des.plat[key] = slider(S, AX + 6, y, 86, label, des.plat[key], a, b, { step, fmt, id: 'd3p' + key });
    else if (kind === 'pl') des.plat[key] = cycler(S, AX + 6, y - 2, 86, label, a, a.includes(des.plat[key]) ? des.plat[key] : a[0], { names: fmt });
    else if (kind === 'sh') des.shape[key] = slider(S, AX + 6, y, 86, label, des.shape[key] || 0, a, b, { step, fmt, id: 'd3s' + key });
    else if (kind === 'sl') des[key] = slider(S, AX + 6, y, 86, label, des[key], a, b, { step: step || 0, fmt: fmt || (v => v.toFixed(2)), id: 'd3' + key });
    else if (kind === 'dsl') d[key] = slider(S, AX + 6, y, 86, label, d[key], a, b, { step, fmt, id: 'dd' + key });
    else if (kind === 'dcyc') d[key] = cycler(S, AX + 6, y - 2, 86, label, a, a.includes(d[key]) ? d[key] : a[0], { names: nm });
    else if (kind === 'fcyc') d.feats[key] = cycler(S, AX + 6, y - 2, 86, label, a, !!d.feats[key], { names: nm });
    else { const list = a.length ? a : [des[key]]; des[key] = cycler(S, AX + 6, y - 2, 86, label, list, list.includes(des[key]) ? des[key] : list[0], { names: nm }); } }));
  if (ro) { const o = JSON.parse(snap); for (const k of Object.keys(d)) delete d[k]; Object.assign(d, o); des = d.v3; }        // looking back / work in progress: nothing changes
  d.trim = Math.round(d.trim); if (!readyE.some(e => e.id === d.engineId)) d.engineId = readyE[0]?.id; if (!readyG.some(x => x.id === d.gbId)) d.gbId = readyG[0]?.id;
  if ((des.base || 'free') !== prevBase) { const nb = des.base, pl0 = des.plat, tv0 = des.tv;                    // another body shell on the same frame
    if (!fitBody(nb)) { des.base = prevBase; toast('THIS BODY DOES NOT FIT THE FRAME'); } else { des = d.v3 = nb === 'free' ? { ...newDesign(g.year, 'sedan4d'), base: 'free' } : measuredDesign(nb, g.year); des.plat = pl0; des.tv = tv0; app.bpT = app.t; } }
  { const pl = des.plat; if (pl.from && pl.from !== 'new' && pl.fromOK !== pl.from) { const m = g.models.find(x => x.id === pl.from); if (m) { const nm = pl.name; Object.assign(pl, JSON.parse(JSON.stringify(m.plat)), { from: m.id, fromOK: m.id, name: nm || m.plat.name }); } } else if (pl.from === 'new') delete pl.fromOK;
    clampFrame(pl, g.year); des.wb = pl.wb; des.width = pl.width; }
  clampPlatform(des.plat, g.year, k => has(g, k)); let notes; if (des.base !== 'free') notes = clampMeasured(des); else { des.doors = des.type === 'coupe2d' ? 2 : 4; des.bumperBars = Math.round(des.bumperBars); des.louvres = Math.round(des.louvres); notes = clampDesign(des); }
  if (JSON.stringify(des) !== before) {                                                                       // design changed: a part swap is fitted, anything else is re-scanned
    const o = JSON.parse(before), ch = Object.keys(des).filter(k => JSON.stringify(des[k]) !== JSON.stringify(o[k])), kinds = [...new Set(ch.map(k => PARTK[k] || 'shape'))];
    if (app.t - (app.lastEdit ?? -99) > 30) { (app.undo = app.undo || []).push(before); if (app.undo.length > 40) app.undo.shift(); app.redo = []; } app.lastEdit = app.t;
    if (ch.length === 1 && (ch[0] === 'shape' || ch[0] === 'tv' || ch[0] === 'pos' || ch[0] === 'bodyName')) { /* live reshaping / trim: redrawn at once */ }
    else if (des.base !== 'free' && o.base === des.base && kinds.length === 1 && kinds[0] !== 'shape') { app.fit = { t: app.t, old: o, strip: kinds[0], view }; app.bpT = -999; } else { app.bpT = app.t; app.fit = null; } }
  d.type = des.type; d.feats.unibody = des.plat.type === 'unibody';
  const cx = AX + 100, pw = 200;
  if (!ro && (st.id === 'body' || st.id === 'platform')) {
    if (button(S, AX + AW - 62, AY + 3, 28, 9, 'UNDO', { disabled: !(app.undo || []).length })) { (app.redo = app.redo || []).push(JSON.stringify(des)); des = d.v3 = JSON.parse(app.undo.pop()); app.bpT = app.t; app.fit = null; app.lastEdit = -99; }
    if (button(S, AX + AW - 32, AY + 3, 28, 9, 'REDO', { disabled: !(app.redo || []).length })) { app.undo.push(JSON.stringify(des)); des = d.v3 = JSON.parse(app.redo.pop()); app.bpT = app.t; app.fit = null; app.lastEdit = -99; } }
  // ---- evaluation (shared by every stage) ----
  const sp = v3Sprite(des, d.paint, 'side'), spec = sp.spec, fg = frameGeo(des.plat, spec?.tire || '6.00-16'), heavy = des.plat.wb > 3700, pst = platformStats(des.plat, fg, { heavy });
  const zones = ladP ? frameZones(des.plat, fg, pst, { heavy }) : []; if (zones.length) pst.margin = Math.min(...zones.filter(z => z.id !== 'tors').map(z => z.margin));
  const reuse = des.plat.from && des.plat.from !== 'new';
  const dm = { len: spec ? Math.round(spec.len) : 0, width: Math.round(des.width), height: Math.round(des.roof), wb: Math.round(des.wb) };
  const style = des.base !== 'free' ? (TEMPLATES.find(t => t.id === des.base)?.style || 'box') : des.frontFender === 'integrated' ? 'pontoon' : des.rake > 18 || des.tail === 'fastback' ? 'stream' : 'box';
  const hoodLen = spec ? spec.geo.cowlX - 250 : 1200;
  const frontInfo = v3Sprite(des, d.paint, 'front');
  const car = { ...d, v3: undefined, launch: undefined, dims: dm, platStats: pst, plat: JSON.parse(JSON.stringify(des.plat)), relMod: d.relMod || 0, body: { style, wb: dm.wb, hood: hoodLen / Math.max(1, dm.wb), height: dm.height / Math.max(1, dm.wb) }, designScore: 0.68 + (style !== 'box' ? 0.06 : 0) - notes.length * 0.02 + (d.reviewBonus || 0) - (frontInfo.warn?.length ? 0.04 : 0) };
  car.relMod = (d.relMod || 0) - Math.max(0, 0.85 - (frontInfo.grilleArea ?? 1)) * 0.2;
  const ev = readyE.length && readyG.length ? evaluate(g, car) : null;
  const tool = Math.round((40000 + dm.wb * 8 + (style !== 'box' ? 20000 : 0) + (d.feats.unibody ? 30000 : 0)) * (reuse ? 0.7 : 1)), prepMo = 2 + (style === 'stream' ? 1 : style === 'pontoon' ? 2 : 0) + (d.feats.unibody ? 1 : 0);
  const costOf = i => (i === 8 ? tool : i === 1 ? (reuse ? 500 : uniB ? 1500 : DEV[1].cost) : i === 4 && uniB ? DEV[4].cost + 6000 : DEV[i].cost), moOf = i => (i === 8 ? prepMo : i === 1 && (reuse || uniB) ? 0 : i === 4 && uniB ? DEV[4].mo + 1 : DEV[i].mo);   // carried-over frame: cheap and quick; unit body: structure is done with the body
  // ---- preview (what this place shows) ----
  const wide = st.id === 'platform', pwV = wide ? AX + AW - cx - 6 : pw;
  panel(S, cx, AY + 20, pwV, wide ? 150 : 92, st.id === 'platform' && pst ? pst.kg + ' KG  STIFFNESS ' + Math.round(pst.stiff * 100) + '  STRENGTH X' + pst.margin.toFixed(2) + '  $' + pst.cost : st.id === 'body' ? `L${dm.len} W${dm.width} H${dm.height} WB${dm.wb} MM` : st.where);
  if (wide) { const pl = des.plat, key = 'FR' + JSON.stringify(pl) + fview + (spec?.tire || ''); let fs = app.cache.get(key);
    if (!fs) { fs = { px: null }; try { const len = fg.tailX - fg.noseX + 120, T2 = { track: fg.track, tireCode: fg.tire, width: fg.width };
        if (fview === 'sect' && !uniB) fs.px = frameSection(P, pl, 1.5);
        else if (ladP) { const mmF = Math.max(11, Math.ceil(Math.max(len / (pwV - 12), fview === 'plan' ? (fg.width + 200) / 132 : 1))); fs.px = fview === 'plan' ? framePlan(P, pl, fg, mmF) : frameSide(P, pl, fg, mmF); }
        else { const mmF = Math.max(13, Math.ceil(Math.max(len / (pwV - 12), (fg.width + 200) / 132))); fs.px = fview === 'fside' && !uniB ? platformSide(P, pl, fg, fg.tire, mmF) : platformPlan(P, pl, fg, T2, mmF); if (fs.px) { fs.px.mm = mmF; } } } catch (e) { console.warn(e); }
      app.cache.set(key, fs); }
    const px = fs.px; if (px) { const ox = cx + ((pwV - px.w) >> 1), oy = AY + 30 + Math.max(0, (136 - px.h) >> 1), prog = Math.min(1, (app.t - (app.bpT ?? -999)) / 100);
      if (prog < 1) { blueprint(px, ox, oy, prog); if ((app.t - app.bpT) % 7 === 0 && prog > 0.14) AU.sfx('type'); if (input.clicked && input.x >= cx && input.x < cx + pwV && input.y >= AY + 20 && input.y < AY + 170) app.bpT = -999; }
      else { drawPix(S, px, P, ox, oy, 1);
        const tt = app.ftest != null ? app.t - app.ftest : 1e9, zi = Math.floor(tt / 40);                      // load test: each zone is loaded in turn; weak steel stays red
        if (px.X && fview !== 'sect') zones.forEach((z, i) => { const act = zi === i && tt < zones.length * 40, bad = z.margin < 1; if (!bad && !act) return; if (bad && !act && (app.t >> 4) % 2) return;
          const x0 = Math.round(px.X(z.x0)), x1 = Math.round(px.X(z.x1)); for (let y = 0; y < px.h; y++) for (let x = Math.max(0, x0); x < Math.min(px.w, x1); x++) if (px.r[y * px.w + x] === P.byName.bare) S.blend(ox + x, oy + y, bad ? [225, 40, 30] : [60, 170, 80], 0.6);
          if (act) { S.fill(ox + ((x0 + x1) >> 1) - 5, oy - 2 + Math.min(6, (tt % 40) >> 2), 11, 6, C.ink); if (tt % 40 === 1) AU.sfx('clunk'); } });
        if (fview === 'sect' && !uniB) text(S, pl.type === 'platform' ? `TUBE ${Math.round(pl.railH)} X ${pl.railT.toFixed(1)} MM` : `${Math.round(pl.railH)} X ${Math.round(pl.railW * (FRAME_TYPES[pl.type].box ? 1.15 : 1))} X ${pl.railT.toFixed(1)} MM`, cx + 6, AY + 160, C.ink); } }
    if (uniB) text(S, 'THE SHELL ITSELF IS DESIGNED WITH THE BODY', cx + 4, AY + 160, C.inkSoft, 1, pwV - 8); }
  else if (st.id === 'brief') briefDoc(g, d, cx + 3, AY + 29, pw - 6, 80);
  else if (st.id === 'engine') { const e = g.engines.find(x => x.id === d.engineId); if (e) drawPix(S, drawOutsidePix(P, { ...e, year: g.year }, app.t * 4, pw - 8, 78).px, P, cx + 4, AY + 29, 1); else text(S, 'NO ENGINE READY', cx + 6, AY + 50, C.red); }   // the part-built engine
  else if (st.id === 'driveline') { gearMesh(cx + 10, AY + 26, d.final, app.t); text(S, 'FINAL DRIVE ' + d.final.toFixed(2) + ' : 1', cx + 120, AY + 40, C.ink); text(S, 'PINION AND CROWN WHEEL', cx + 120, AY + 50, C.inkSoft, 1, 76); }
  else if (st.id === 'detail') { const NP = 5, inP = input.x >= cx && input.x < cx + pw && input.y >= AY + 20 && input.y < AY + 112;   // swipe / arrows: dashboard, side, front, rear, paint board
    if (inP && input.clicked && !input.drag) app.sw = input.x; if (app.sw != null && !input.down) { const dx = input.x - app.sw; if (dx < -14) app.dpage = ((app.dpage || 0) + 1) % NP; if (dx > 14) app.dpage = ((app.dpage || 0) + NP - 1) % NP; app.sw = null; }
    const pg = app.dpage || 0, drag = app.sw != null && input.down ? input.x - app.sw : 0;
    if (pg === 0) dashboard(cx + 3 + drag, AY + 29, pw - 6, 60, d.trim);
    else if (pg <= 3) { const v2 = ['side', 'front', 'rear'][pg - 1], q = v3Sprite(des, d.paint, v2).px; if (q) drawPix(S, q, P, cx + ((pw - q.w) >> 1) + drag, AY + 104 - q.h, 1); }
    else PAINTS.forEach((h, i) => { const x = cx + 14 + (i % 5) * 36 + drag, y = AY + 34 + Math.floor(i / 5) * 34; S.fill(x - 1, y - 1, 30, 26, i === d.paint ? C.red : C.ink); S.fill(x, y, 28, 24, hex(h)); S.fill(x, y, 28, 3, hex('#ffffff')); text(S, String(i + 1), x + 2, y + 15, C.white);
      if (!ro && input.clicked && input.x >= x && input.x < x + 28 && input.y >= y && input.y < y + 24) { d.paint = i; AU.sfx('click'); } });
    { const lb = ['DASHBOARD', 'SIDE', 'FRONT', 'REAR', 'PAINT'][pg]; text(S, lb, cx + pw - 4 - tw(lb), AY + 21, C.oxblood); } for (let k = 0; k < NP; k++) S.fill(cx + pw / 2 - NP * 4 + k * 8, AY + 107, 5, 3, k === pg ? C.oxblood : C.paperDark);
    if (button(S, cx + 2, AY + 60, 9, 14, '<')) app.dpage = (pg + NP - 1) % NP; if (button(S, cx + pw - 11, AY + 60, 9, 14, '>')) app.dpage = (pg + 1) % NP; }
  else if (st.id === 'proto') { const b0 = v3Sprite(des, d.paint, 'side').px; if (b0 && spec) {
      const dist = app.t * 1.8, rpx = spec.geo.r / b0.mm, rot = Math.round(((dist / rpx) % 6.2832) / 6.2832 * 16) % 16 * 6.2832 / 16, p2 = v3Sprite(des, d.paint, 'side', rot).px;
      Object.assign(clip, { on: true, x0: cx + 1, y0: AY + 28, x1: cx + pw - 1, y1: AY + 111 });
      S.fill(cx + 1, AY + 28, pw - 2, 50, hex('#cfd9d6')); for (let k = 0; k < 4; k++) { const hx = cx + ((k * 70 + dist * 0.25) % (pw + 60)) - 30; for (let yy = 0; yy < 14; yy++) S.fill(Math.round(hx - 30 + yy), AY + 64 + yy, 60 - 2 * yy, 1, hex('#9fb0a2')); }   // far hills
      S.fill(cx + 1, AY + 78, pw - 2, 24, hex('#8d9a6a')); S.fill(cx + 1, AY + 102, pw - 2, 9, hex('#8a7a62')); for (let k = 0; k < 8; k++) S.fill(cx + ((k * 30 + dist) % (pw + 10)) - 10, AY + 106, 10, 1, hex('#b5a684'));   // verge, road, centre dashes
      for (let k = 0; k < 4; k++) { const x = cx + ((k * 64 + dist) % (pw + 20)) - 10; S.fill(x, AY + 84, 2, 18, hex('#efe6cf')); S.fill(x, AY + 84, 2, 3, hex('#b0341f')); }   // marker posts stream backwards
      const carX = Math.round(cx + (pw - p2.w) / 2 + Math.sin(app.t * 0.013) * 18), bob = (Math.floor(dist / 9) % 5 === 0) ? 1 : 0, carY = AY + 105 - p2.h + bob;
      drawPix(S, p2, P, carX, carY, 1);
      for (let k = 0; k < 5; k++) { const f = ((app.t + k * 7) % 35) / 35; S.blend(Math.round(carX + p2.w - 2 + f * 22), Math.round(AY + 99 - f * 6), [190, 186, 178], 0.6 * (1 - f)); S.blend(Math.round(carX + p2.w - 1 + f * 22), Math.round(AY + 100 - f * 6), [190, 186, 178], 0.4 * (1 - f)); }   // exhaust
      const rw = Math.round(carX + p2.X(spec.geo.R)); for (let k = 0; k < 6; k++) { const f = ((app.t * 2 + k * 11) % 40) / 40; S.blend(rw + Math.round(f * 26), AY + 104 - Math.round(f * 7), [200, 184, 150], 0.55 * (1 - f)); }   // dust off the rear wheel
      clip.on = false; } }
  else if (st.id === 'prep') { const fr = spec && platformSide(P, des.plat, spec.geo, spec.tire || '6.00-16', 45); if (fr) { S.fill(cx + 1, AY + 100, pw - 2, 3, hex('#5a5550')); for (let k = 0; k < 3; k++) { const x = cx + ((k * (fr.w + 20) + app.t * 0.4) % (pw + fr.w)) - fr.w; Object.assign(clip, { on: true, x0: cx + 1, y0: AY + 28, x1: cx + pw - 1, y1: AY + 111 }); drawPix(S, fr, P, Math.round(x), AY + 100 - fr.h, 1); clip.on = false; } }
    text(S, 'UNPAINTED FRAMES ON THE LINE', cx + 3, AY + 30, C.inkSoft, 1, pw - 6); }
  else if (!wide) {                                                                                              // body, mock-up: the sprite views
    const mock = st.id === 'mockup', mp = mock ? (g.year < 1938 ? 'paint.mockwood' : 'paint.clay') : d.paint;
    const shown = view === 'side' || view === 'shape' ? (mock ? v3Sprite(des, mp, 'side') : sp) : view === 'frame' ? platSprite(des, spec, d.paint) : v3Sprite(des, mp, view), px = shown.px;
    if (mock) { for (let k = 0; k < 2; k++) { const lx = cx + 50 + k * 100; for (let yy = AY + 30; yy < AY + 108; yy++) { const hw = (yy - AY - 30) * 0.45; for (let xx = -hw; xx <= hw; xx += 1) S.blend(Math.round(lx + xx), yy, [255, 244, 210], 0.07); } }
      for (let xx = -70; xx <= 70; xx++) { const hh = Math.round(Math.sqrt(1 - (xx / 70) ** 2) * 5); S.fill(cx + 100 + xx, AY + 104 - hh, 1, hh * 2, hex('#6b5a46')); } }
    if (px) { const ox = cx + Math.max(2, (pw - px.w) / 2) | 0, oy = view === 'frame' ? AY + 29 : AY + 106 - px.h, prog = mock ? 1 : Math.min(1, (app.t - (app.bpT ?? -999)) / 100);
      const fit = !mock && app.fit && app.fit.view === view ? app.fit : null;
      if (prog < 1) { blueprint(px, ox, oy, prog); if ((app.t - app.bpT) % 7 === 0 && prog > 0.14) AU.sfx('type');
        if (input.clicked && input.x >= cx && input.x < cx + pw && input.y >= AY + 20 && input.y < AY + 112) app.bpT = -999; }   // click to skip
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
    if (st.id === 'body' && (view === 'front' || view === 'rear') && px && !ro && shown.handles) { const ox = cx + Math.max(2, (pw - px.w) / 2) | 0, oy = AY + 106 - px.h, mx = ox + px.w / 2, SX = y => Math.round(mx + y / 25), SY = z => Math.round(oy + px.h - 3 - z / 25); let anyHot = false;
      for (const h of shown.handles) { const hx = SX(h.y), hy = SY(h.z), id = 'Q' + h.k, near = Math.abs(input.x - hx) <= 4 && Math.abs(input.y - hy) <= 4;
        if (near && input.clicked && !input.drag) { input.drag = id; app.hd = { x0: input.x, y0: input.y, p0: { ...des.pos }, old: JSON.parse(JSON.stringify(des)) }; (app.undo = app.undo || []).push(JSON.stringify(des)); app.redo = []; app.lastEdit = app.t; AU.sfx('click'); }
        const act = input.drag === id; if (act) { const dxm = (input.x - app.hd.x0) * 25, dzm = (app.hd.y0 - input.y) * 25, p0 = app.hd.p0;
          if (!input.down) { input.drag = null; const kind = h.k.startsWith('grille') ? 'grille' : h.k.includes('umper') ? 'bumpers' : h.k === 'tail' ? 'tail' : 'lamps'; app.fit = { t: app.t - 10, old: app.hd.old, strip: kind, view }; }   // dropped: the part is fitted in its new place
          else { if (h.k === 'lamp') { des.pos.lampDY = p0.lampDY + dxm; des.pos.lampDZ = p0.lampDZ + dzm; } else if (h.k === 'tail') { des.pos.tailDY = p0.tailDY + dxm; des.pos.tailDZ = p0.tailDZ + dzm; }
            else if (h.ax === 'z') des.pos[h.k] = p0[h.k] + dzm; else des.pos[h.k] = p0[h.k] + dxm / Math.max(100, h.base || 400); clampPos(des.pos); app.lastEdit = app.t; } }
        anyHot = anyHot || near || act; const col = act ? C.red : near ? C.brassL : C.brass;
        S.fill(hx - 3, hy - 3, 7, 7, C.ink); S.fill(hx - 2, hy - 2, 5, 5, col); if (h.y > 1) { const gx = SX(-h.y); S.fill(gx - 2, hy - 2, 5, 5, C.ink); S.fill(gx - 1, hy - 1, 3, 3, col); if (near || act) for (let x = gx + 3; x < hx - 3; x += 3) S.fill(x, hy, 1, 1, C.red); } }   // the mirrored twin moves with it
      if (anyHot) for (let y = oy; y < oy + px.h; y += 3) S.fill(Math.round(mx), y, 1, 2, C.red);                                                       // centre line
      if (shown.warn?.length) text(S, shown.warn[0], cx + 3, AY + 29, C.red, 1, pw - 6); }
    if (view === 'shape') text(S, 'DRAG THE HANDLES', cx + 3, AY + 104, C.inkSoft, 1, pw - 6);
    if (view === 'frame' && pst && pst.margin < 1) text(S, 'FRAME TOO WEAK - CRACKS IN SERVICE', cx + 3, AY + 104, C.red, 1, pw - 6);
    if (st.id === 'body' && notes.length) text(S, 'ERA LIMIT: ' + notes.join(', ').toUpperCase(), cx + 3, AY + 104, C.red, 1, pw - 6); }
  // ---- engineering report (always) ----
  const x2 = cx + pw + 6, pw2 = AX + AW - x2 - 6; if (!wide) panel(S, x2, AY + 20, pw2, 210, 'ENGINEERING REPORT');
  if (wide) { /* the frame drawing takes the whole width */ } else if (ev) { const sm = ev.sim; [['TOP SPEED', `${sm.topMph.toFixed(0)} MPH`], ['0-60 MPH', sm.zeroSixty ? sm.zeroSixty.toFixed(1) + ' S' : 'NEVER'], ['ECONOMY', sm.mpg.toFixed(1) + ' MPG'], ['MAX GRADE', Math.round(sm.grade * 100) + '%'], ['WEIGHT', sm.mass + ' KG'], ['UNIT COST', money(ev.unit)]].forEach(([l, v], i) => stat(S, x2 + 4, AY + 31 + i * 8, l, v, C.ink, 44));
    text(S, ev.fit ? 'ENGINE FITS THE BAY' : 'ENGINE TOO BIG - LONGER HOOD!', x2 + 4, AY + 82, ev.fit ? C.green : C.red, 1, pw2 - 6);
    [['PERFORMANCE', ev.perf], ['ECONOMY', ev.econ], ['COMFORT', ev.comfort], ['RELIABILITY', ev.rel], ['DESIGN', ev.design], ['MODERNITY', ev.modern]].forEach(([l, v], i) => { text(S, l, x2 + 4, AY + 92 + i * 12, C.inkSoft); bar(S, x2 + 4, AY + 98 + i * 12, pw2 - 10, 4, v, v < 0.4 ? C.red : C.teal); });
    const a = appeal(ev, d.seg, d.price); text(S, `APPEAL ${Math.round(a * 100)}`, x2 + 4, AY + 166, a > 0.45 ? C.green : C.oxblood); text(S, `MARGIN ${money(d.price - ev.unit)}`, x2 + 4, AY + 174, d.price > ev.unit ? C.green : C.red); }
  else text(S, 'NEED A READY ENGINE AND GEARBOX', x2 + 4, AY + 31, C.red, 1, pw2 - 6);
  if (!wide) { text(S, `TOOLING ${money(tool)}`, x2 + 4, AY + 184, C.ink, 1, pw2 - 6); text(S, `SPENT ${money(d.spent || 0)}`, x2 + 4, AY + 192, C.inkSoft, 1, pw2 - 6); }
  const left = DEV.reduce((a, s2, i) => a + (i >= d.stage ? moOf(i) : 0), 0) - (d.busy ? dateNum(g) - d.busy.from : 0); if (!wide) text(S, `ABOUT ${Math.max(0, left)} MONTHS TO PRODUCTION`, x2 + 4, AY + 200, C.ink, 1, pw2 - 6);
  // ---- this place: what the stage does, and its action ----
  panel(S, cx, wide ? AY + 172 : AY + 116, pwV, wide ? 42 : 98, wide ? '' : st.where); const tx = (s, y, c = C.ink) => { if (!wide || y <= 135) text(S, s, cx + 4, AY + y + (wide ? 48 : 0), c, 1, pwV - 8); };
  const finishNow = i => { d.done[i] = true; if (i === 5) d.reviewDue = true; else if (i === 7) d.testDue = true; else d.stage = i + 1; AU.sfx('stamp'); };
  const reopen = i => { d.stage = i; d.done = d.done.slice(0, i); d.reviewDue = d.testDue = false; d.review = null; d.defects = null; d.busy = null; app.dstage = i; AU.sfx('stamp'); };
  const actBtn = (l, o) => button(S, cx + 2, AY + 198, pwV - 4 - (wide && ladP ? 72 : 0), 14, l, o);
  if (wide && ladP && button(S, cx + pwV - 72, AY + 198, 70, 14, 'LOAD TEST', { tone: 'teal' })) { app.ftest = app.t; app.fview = app.fview === 'sect' ? 'plan' : app.fview; AU.sfx('hiss'); }
  const info = { brief: ['SET THE TARGET: SEGMENT, PRICE AND VOLUME.', `${SEGS[d.seg].price.map(money).join(' - ')} IS THIS SEGMENT'S PRICE BAND.`, `OUR MODELS IN IT: ${g.models.filter(m => m.seg === d.seg && !m.dead).map(m => N(m.name)).join(', ') || 'NONE'}`],
    platform: [reuse ? 'CARRIED-OVER FRAME: NO NEW FRAME TOOLING.' : uniB ? 'UNIT BODY: NO SEPARATE FRAME.' : zones.map(z => z.name + ' X' + z.margin.toFixed(2)).join('  ')],
    engine: [ev ? `${ev.es.hp.toFixed(0)} HP  ${ev.es.litres.toFixed(2)} L  ${Math.round(ev.es.mass)} KG` : 'NO ENGINE READY', ev && ev.fit ? 'FITS BETWEEN THE FRAME RAILS.' : 'TOO LONG FOR THIS BAY.', 'NEW ENGINES ARE DESIGNED IN THE ENGINES ROOM.'],
    driveline: [ev ? `TOP ${ev.sim.topMph.toFixed(0)} MPH  0-60 ${ev.sim.zeroSixty ? ev.sim.zeroSixty.toFixed(1) + ' S' : '-'}  ${ev.sim.mpg.toFixed(1)} MPG` : '-', 'HIGHER RATIO: QUICKER, THIRSTIER.', ''],
    body: [uniB ? 'BODY AND STRUCTURE ARE ONE WELDED SHELL.' : 'CHOOSE A BODY SHELL THAT FITS THE FRAME.', 'EVERY CHANGE IS RE-DRAWN ON A NEW BLUEPRINT.', ''],
    mockup: [g.year < 1938 ? 'FULL-SIZE WOODEN MOCK-UP ON THE TURNTABLE.' : 'FULL-SIZE CLAY MODEL ON THE TURNTABLE.', 'THE BOARD REVIEWS IT WHEN IT IS READY.', ''],
    detail: ['INTERIOR, TRIM, PAINT AND LIST PRICE.', `TRIM ${['BASIC', 'STANDARD', 'DE LUXE', 'CUSTOM'][d.trim]}: ${1 + Math.min(3, d.trim)} DIALS`, ''],
    proto: ['HAND-BUILT PROTOTYPES, TEST DRIVES', 'AND A DURABILITY RUN ON THE PROVING GROUND.', ''],
    prep: ['PRESS DIES, JIGS AND LINE LAYOUT.', `TOOLING ${money(tool)} - ${prepMo} MONTHS`, 'THE MODEL ENTERS PRODUCTION WHEN IT IS DONE.'] }[st.id];
  info.forEach((s, i) => tx(s, 126 + i * 9, i ? C.inkSoft : wide && pst.margin < 1 ? C.red : C.ink));
  if (st.id === 'mockup' && button(S, cx + 4, AY + 144, 120, 11, 'ENTER THE MOCK-UP ROOM', { tone: 'teal' })) { const dd = JSON.parse(JSON.stringify(des)), mp = g.year < 1938 ? 'paint.mockwood' : 'paint.clay';
    app.room = { t: 0, spin: true, lights: 'spot', wood: g.year < 1938, get: v => v3Sprite(dd, mp, v).px, notes: d.review?.notes, score: d.review?.score }; app.scene = 'mockroom'; }
  if (st.id === 'engine' && !ro && button(S, cx + 4, AY + 156, 96, 12, 'DESIGN AN ENGINE')) app.tab = 'engines';
  if (st.id === 'proto' && ev) { if (button(S, cx + 4, AY + 144, 94, 11, 'WATCH BUILD', { tone: 'teal' })) startAssembly(g, spec, d, 'cars', des.plat);
    if (button(S, cx + 102, AY + 144, 94, 11, 'DRIVE THE TRACK', { tone: 'teal' })) { const eng = g.engines.find(x => x.id === d.engineId), gbx = g.gearboxes.find(x => x.id === d.gbId), dd = JSON.parse(JSON.stringify(des)), pi = d.paint;
      app.trk = { run: null, mk: () => makeRun({ es: ev.es, engine: { ...eng, litres: ev.es.litres }, gearbox: gbx, final: d.final, mass: ev.sim.mass, cda: 0.6 * (dm.width / 1000) * ((dm.height - 180) / 1000) * 0.82 * 1.9, hyd: !!d.feats.hydbrake, stiff: pst.stiff, year: g.year, name: d.name }), sprite: rot => v3Sprite(dd, pi, 'side', rot).px, proj: d };
      app.trk.run = app.trk.mk(); app.scene = 'track'; AU.unlock(); }
    if (d.track) tx(`LAST DRIVE: 0-60 ${d.track.t60 ? d.track.t60.toFixed(1) + ' S' : '-'}  TOP ${d.track.top.toFixed(0)} MPH`, 135, C.inkSoft); }
  if (vs === 5 && d.reviewDue && ev) {                                                                    // the board looks at the mock-up
    if (!d.review) { const t = TEMPLATES.find(x => x.id === des.base), L = t && landmarks(t.spec), n = [];
      if (L && des.roof > L.roof + 50) n.push('ROOF LOOKS TALL'); if (L && des.roof < L.roof - 50) n.push('LOW AND SLEEK - THE BOARD LIKES IT');
      if (ev.modern < 0.5) n.push('LOOKS DATED NEXT TO RIVALS'); if (style !== 'box' && g.year < 1935) n.push('TOO DARING FOR THE DEALERS?'); if (notes.length) n.push('OUTSIDE CURRENT PRACTICE');
      if (L && des.frontOH > L.frontOH * 1.15) n.push('LONG NOSE - LOOKS POWERFUL'); if (!n.length) { n.push('A HANDSOME, HONEST CAR'); }
      d.review = { score: Math.max(0.2, Math.min(0.98, ev.design * 0.6 + ev.modern * 0.3 + (n.some(s => s.includes('LIKES') || s.includes('POWERFUL')) ? 0.08 : 0) - (n.includes('ROOF LOOKS TALL') ? 0.06 : 0))), notes: n }; AU.sfx('type'); }
    tx(`BOARD SCORE ${Math.round(d.review.score * 100)} / 100`, 156, d.review.score > 0.6 ? C.green : C.oxblood); d.review.notes.slice(0, 3).forEach((s, i) => tx('- ' + s, 165 + i * 9, C.ink));
    if (button(S, cx + 2, AY + 198, 97, 14, 'APPROVE', { tone: 'teal' })) confirmBox('APPROVE THE MOCK-UP', [`BOARD SCORE ${Math.round(d.review.score * 100)}`, 'THE BODY IS FROZEN FOR DETAIL DESIGN.'], () => { d.reviewBonus = (d.review.score - 0.6) * 0.15; d.reviewDue = false; d.stage = 6; app.dstage = null; AU.sfx('stamp'); });
    if (button(S, cx + 101, AY + 198, 97, 14, 'REVISE THE BODY', { tone: 'ox' })) confirmBox('REVISE THE BODY', ['BACK TO THE STYLING STUDIO.', 'BODY AND MOCK-UP MUST BE DONE AGAIN (AND PAID AGAIN).'], () => { reopen(4); }); }
  else if (vs === 7 && d.testDue && ev) {                                                                 // durability run results
    if (!d.defects) { let s = [...JSON.stringify(des) + d.engineId + d.gbId].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
      const cand = [[pst && pst.margin < 1.15, 'FRAME CRACK AT THE KICK-UP'], [!d.feats.hydbrake, 'BRAKE FADE ON LONG DESCENTS'], [pst && pst.stiff < 0.6, 'DOOR RATTLE ON ROUGH ROADS'], [ev.es.reliability < 0.75, 'OVERHEATING ON THE HILL CLIMB'],
        [true, 'WATER LEAK AT THE WINDSHIELD'], [true, 'GEARBOX WHINE IN SECOND'], [d.feats.unibody && g.year < 1945, 'SHELL CORROSION AT THE SILLS']];
      d.defects = cand.filter(([c]) => c && rnd() < 0.35 + (1 - ev.rel) * 0.8).map(([, s2]) => s2).slice(0, 4); AU.sfx('type'); }
    tx(d.defects.length ? `${d.defects.length} DEFECTS FOUND` : 'NO DEFECTS FOUND', 159, d.defects.length ? C.oxblood : C.green); d.defects.forEach((s2, i) => tx('- ' + s2, 167 + i * 8, C.ink));
    const fixCost = 2500 * d.defects.length;
    if (d.defects.length && button(S, cx + 2, AY + 198, 97, 14, `FIX ALL ${money(fixCost)} +1 MO`, { tone: 'teal', disabled: g.cash < fixCost })) confirmBox('FIX ALL DEFECTS', [`COST ${money(fixCost)}`, 'TAKES 1 MONTH', 'RELIABILITY GOES UP.'], () => { g.cash -= fixCost; d.spent = (d.spent || 0) + fixCost; d.busy = { i: 7, from: dateNum(g), until: dateNum(g) + 1, fix: true }; AU.sfx('wrench'); });
    if (button(S, d.defects.length ? cx + 101 : cx + 2, AY + 198, d.defects.length ? 97 : pw - 4, 14, d.defects.length ? 'SHIP AS IS' : 'CONTINUE', { tone: 'ox' })) confirmBox(d.defects.length ? 'SHIP AS IS' : 'CONTINUE', [d.defects.length ? `${d.defects.length} DEFECTS GO TO THE CUSTOMERS.` : 'NO DEFECTS.', d.defects.length ? 'RELIABILITY GOES DOWN.' : ''], () => { d.relMod = (d.relMod || 0) - 0.03 * d.defects.length; d.testDue = false; d.defects = null; d.stage = 8; app.dstage = null; AU.sfx('stamp'); }); }
  else if (vs < d.stage) { tx('DONE. REOPENING IT MEANS THE LATER STAGES', 156, C.inkSoft); tx('MUST BE DONE AGAIN (AND PAID AGAIN).', 165, C.inkSoft); if (actBtn('REOPEN THIS STAGE', { tone: 'ox', disabled: !!d.busy })) confirmBox('REOPEN ' + st.name, ['LATER STAGES MUST BE DONE AGAIN (AND PAID AGAIN).'], () => { reopen(vs); }); }
  else if (d.busy) { const k = d.busy.until - dateNum(g); actBtn(`${DEV[d.busy.i].name} IN PROGRESS - ${k} MO LEFT`, { disabled: true }); }
  else { const c = costOf(vs), m = moOf(vs), ok = (vs !== 2 || readyE.length) && (vs !== 3 || readyG.length) && (vs !== 8 || (ev && ev.fit));
    if (actBtn(`START ${st.name}  ${money(c)}  ${m ? m + ' MO' : 'NOW'}`, { tone: 'ox', disabled: g.cash < c || !ok })) confirmBox('START ' + st.name, [`COST ${money(c)}`, m ? `TAKES ${m} MONTHS` : 'DONE AT ONCE', vs === 8 ? 'THE DESIGN IS FROZEN FOR PRODUCTION.' : ''], () => { g.cash -= c; d.spent = (d.spent || 0) + c;
      if (vs === 8) d.launch = JSON.parse(JSON.stringify({ ...car, name: d.name, sprite: { v3: des, paint: d.paint } }));
      if (m) { d.busy = { i: vs, from: dateNum(g), until: dateNum(g) + m }; AU.sfx('type'); } else finishNow(vs); app.dstage = null; }); }
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
  scrollArea(S, 'prod', AX + 4, AY + 34, AW - 8, AH - 38, live.length * 54 + 6, dy => live.forEach((m, i) => { const y = AY + 36 + i * 54 - dy; panel(S, AX + 6, y, AW - 12, 50, N(m.name) + ` - ${m.seg.toUpperCase()}`);
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
  if (button(S, AX + 250, AY + 222, 70, 13, 'BORROW 10K', { disabled: (g.loan || 0) + 10000 > (g.credit || g.factory * 60) })) confirmBox('BORROW $10,000', ['INTEREST IS CHARGED EVERY MONTH.'], () => { g.loan = (g.loan || 0) + 10000; g.cash += 10000; });
  if (button(S, AX + 325, AY + 222, 70, 13, 'REPAY 10K', { disabled: !(g.loan >= 10000) || g.cash < 10000 })) { g.loan -= 10000; g.cash -= 10000; } }
function save(g) { windowBox(S, AX, AY, AW, AH, 'SAVE COMPANY'); for (let i = 1; i <= 3; i++) { const sv = store.get('gh_slot_' + i), y = AY + 26 + (i - 1) * 34; panel(S, AX + 10, y, 260, 28);
  text(S, sv ? `${N(sv.name)} - ${MONTHS[sv.month - 1]} ${sv.year}` : `SLOT ${i} - EMPTY`, AX + 15, y + 11, sv ? C.ink : C.inkSoft);
  if (button(S, AX + 220, y + 7, 44, 14, 'SAVE')) toast(store.set('gh_slot_' + i, g) ? 'SAVED TO SLOT ' + i : 'SAVE FAILED (STORAGE BLOCKED)'); } }
function menu(g) { windowBox(S, AX + 120, AY + 30, 160, 130, 'MENU'); g.name = nameField('coname', AX + 135, AY + 48, 130, 'COMPANY NAME', g.name, 'company', 24); if (button(S, AX + 135, AY + 75, 130, 16, 'SETTINGS')) app.scene = 'settings'; if (button(S, AX + 135, AY + 97, 130, 16, 'QUIT TO TITLE')) { app.scene = 'title'; app.g = null; }
  if (button(S, AX + 135, AY + 119, 130, 16, 'BACK TO OFFICE')) app.tab = 'news'; }

// ---------- assembly line (first car of a design) ----------
function startAssembly(g, spec, d, back, plat = null) { const eng = g.engines.find(x => x.id === d.engineId); if (!eng || !spec) return; try { app.asm = makeAssembly(P, { spec, plat }, eng, g.year, d.paint); app.asmBack = back; app.scene = 'assembly'; } catch (e) { console.warn(e); } }
// ---------- stage E: places ----------
const modelSprite = m => (m.sprite?.v3 ? v3Sprite(m.sprite.v3, m.sprite.paint).px : m.sprite?.v2 ? v2Sprite(m.sprite.v2, m.sprite.paint).px : null);
function cityTab(g) { windowBox(S, AX, AY, AW, AH, 'THE CITY - ' + COUNTRIES[g.country].name); const hit = drawCity(S, g, AX + 4, AY + 17, AW - 8, AH - 21, app.t);
  if (hit === 'works') app.scene = 'works'; if (hit === 'dealer') app.scene = 'dealer'; if (hit === 'office') app.tab = 'news';
  if (hit === 'track') { if (g.proj && g.proj.stage >= 7) { app.tab = 'cars'; app.dstage = 7; } else toast('NO PROTOTYPE TO TEST YET'); } }
const goMap = () => { app.scene = 'hq'; app.tab = 'map'; };
function works() { const r = drawWorks(S, P, app.g, modelSprite, app.t); if (r === 'plant') app.scene = 'plant'; if (r === 'map') goMap(); }
function plant() { const g = app.g, r = drawPlant(S, P, g, modelSprite, app.t, AU.sfx); if (r === 'works') app.scene = 'works'; if (r === 'map') goMap(); if (r === 'expand') { g.factory += 500; g.cash -= 40000; AU.sfx('stamp'); toast('FACTORY EXPANDED'); } }
function dealer() { const g = app.g, r = drawDealer(S, P, g, modelSprite, app.t, money); if (r === 'map') goMap(); else if (r?.cut) { r.cut.price = Math.max(350, Math.round(r.cut.price * 0.95 / 10) * 10); AU.sfx('till'); toast('PRICE CUT'); } }
function mockroom() { if (drawMockRoom(S, P, app.room, AU.sfx)) { app.scene = 'hq'; app.tab = 'cars'; app.room = null; } }
function track() { const K = app.trk, T = K.run; if (!K.voice && AU.ready()) { K.voice = AU.engineVoice(T.engine, T.year); }
  const r = drawTrack(S, P, T, K.sprite, AU.sfx); if (K.voice) K.voice.set(T.rpm, T.load, T.done ? 0.25 : 1);
  if (T.done && !K.saved) { K.saved = true; K.proj.track = { ...T.log }; AU.sfx('stamp'); }
  if (r === 'again') { K.run = K.mk(); K.saved = false; } if (r === 'back') { if (K.voice) K.voice.stop(); app.scene = 'hq'; app.tab = 'cars'; app.trk = null; } }
function assembly() { const st = drawAssembly(S, P, app.asm, AU.sfx); if (button(S, W - 70, 4, 62, 14, st >= 9 ? 'DONE' : 'SKIP', { tone: 'ox' }) || app.asm.t > 9 * 110 + 100) { app.scene = 'hq'; app.tab = app.asmBack || 'cars'; app.asm = null; }
  if (button(S, W - 136, 4, 62, 14, 'FASTER')) app.asm.t = Math.min(9 * 110, app.asm.t + 40); }

// ---------- end of game: newspaper front page ----------
function end() { const g = app.g; desk(S); S.fill(60, 10, 360, 250, C.paper); S.fill(64, 14, 352, 242, C.white);
  text(S, 'THE MOTOR GAZETTE', 240 - tw('THE MOTOR GAZETTE', 3) / 2, 20, C.ink, 3); S.fill(70, 38, 340, 1, C.ink); text(S, `${MONTHS[g.month - 1]} ${g.year}`, 72, 41, C.inkSoft);
  const head = g.over === 'BANKRUPT' ? `${N(g.name)} CLOSES ITS DOORS` : g.over.startsWith('MERGED') ? `${N(g.name)} SOLD TO RIVAL` : `${N(g.name)} ENTERS THE FIFTIES`;
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
function frame() { app.t++; music(); if (app.bv && !(app.scene === 'hq' && app.tab === 'engines')) { app.bv.stop(); app.bv = null; if (app.bench) app.bench.on = false; } if (app.scene !== 'title') AU.passEnd(); ({ title, settings, newgame, load, hq, end, assembly, mockroom, track, works, plant, dealer })[app.scene]();
  if (app.toast && app.t < app.toast.until) { const w = tw(app.toast.t) + 16; bevel(S, (W - w) / 2, H - 22, w, 14, C.teal, C.tealL, hex('#1b3f3e')); text(S, app.toast.t, (W - w) / 2 + 8, H - 17, C.white); }
  cursor(); input.clicked = false; input.wheel = 0; input.key = null; if (input.left) { input.left = false; input.x = -1; } ctx.putImageData(img, 0, 0); requestAnimationFrame(frame); }
function resize() { const vv = window.visualViewport, vw = (vv ? vv.width : innerWidth) - 32, vh = (vv ? vv.height : innerHeight) - 8, fit = Math.max(0.3, Math.min(vw / W, vh / H));
  const k = app.settings.fill === false && fit >= 1 ? Math.floor(fit) : fit; const w = Math.floor(W * k), h = Math.floor(H * k);
  cv.style.width = w + 'px'; cv.style.height = h + 'px'; const sc = document.getElementById('scan'); sc.style.display = app.settings.scan ? 'block' : 'none'; sc.style.width = w + 'px'; sc.style.height = h + 'px'; }
window.visualViewport?.addEventListener('resize', () => resize());
const pos = e => { const r = cv.getBoundingClientRect(); input.x = Math.floor((e.clientX - r.left) / r.width * W); input.y = Math.floor((e.clientY - r.top) / r.height * H); };
cv.addEventListener('pointermove', pos); cv.style.touchAction = 'none'; cv.addEventListener('pointerdown', e => { pos(e); input.down = true; input.clicked = true; input.left = false; try { cv.setPointerCapture(e.pointerId); } catch {} AU.unlock(); });
hooks.click = () => AU.sfx('click'); lang.ko = app.settings.lang === 'ko'; Object.assign(AU.vol, { music: app.settings.music ?? 0.6, sfx: app.settings.sfx ?? 0.8 });
addEventListener('pointerup', () => { input.down = false; input.drag = null; }); cv.addEventListener('pointerleave', () => { if (input.clicked) input.left = true; else input.x = -1; });   // a tap is kept until a frame has seen it
addEventListener('pointercancel', () => { input.down = false; input.drag = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); input.wheel = e.deltaY; }, { passive: false }); addEventListener('resize', resize);
addEventListener('keyup', e => { if (input.keys) input.keys[e.key] = false; });
addEventListener('keydown', e => { if (editing() || e.target?.tagName === 'INPUT') return; input.key = e.key; (input.keys = input.keys || {})[e.key] = true; if (app.scene === 'track') { e.preventDefault(); return; } if (e.key === 'Escape' && app.scene === 'hq' && !app.ask) app.tab = 'menu'; if (e.key === ' ' && app.scene === 'hq' && !app.g.over) { e.preventDefault(); stepMonth(app.g); } });
window.__gh = { app, input, stepMonth, lang, AU };
// keep the running company across page updates in the viewer
window.claude?.hot?.snapshot?.(() => ({ g: app.g, scene: app.scene, tab: app.tab }));
const start = d => { if (d && d.g) Object.assign(app, { g: d.g, scene: d.scene || 'hq', tab: d.tab || 'news' }); resize(); frame(); };
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
