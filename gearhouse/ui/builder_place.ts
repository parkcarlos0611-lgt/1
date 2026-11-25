// The builder's free placing of a part on the body (docs/systems/115 P1a, P1, §5-5): the number plates and the free
// surface parts (mirrors, wings, exhaust tips, the crest, markers, stick-on vents and louvres). A part's card in step ③
// starts "놓기" (a new free part is put on first, at its lump's stock place or a default one): the part leaves the
// car's mesh and is drawn apart over it (its triangles made again at each move, the car itself not rebuilt), and a bar
// of its own appears over the view:
//   - one finger (or the mouse) on the part drags it along the skin, the offset from where it was grabbed kept (a pair's
//     twin dragged moves the pair mirrored); a tap on the body elsewhere puts it there; a drag off it turns the camera;
//   - a second finger while dragging it: pinch for its size, twist for its turn;
//   - the size, the depth, the turn and the tilt on sliders, each within its kind's range (PC: wheel the size, Shift +
//     wheel the turn, the arrows nudge it 5 mm, Shift 20 mm); nudge buttons for a phone;
//   - the centre line pulls it on within 30 mm (a switch; a wing is always on it); a pair's "한쪽만" leaves its twin off;
//   - undo, back to the stock place (a plate) or off (a free part), done.
// A place that breaks a rule (render/car/p959/plates.ts, render/car/attach) shows the part red and the reason; let go
// there, it goes back to the last good place. An overlap with another surface part is shown, not refused. Each good
// place is kept in the design (core/placed.ts, format 6 body.parts).
import { Build, type Mesh, type V } from '../render/car/mesh';
import { modelSkin } from '../render/car/bodies';
import { fitPlate, drawPlate, stockPlace, snapCentre, plateText, PLATE_W, PLATE_H, type PlateFit } from '../render/car/p959';
import { crestUV } from '../render/car/p959/badge';
import { fitPart, fitAll, drawFit, footprints, type PartFit, type Footprint } from '../render/car/attach';
import { newPart } from '../render/car/attach/stock';
import { vdot, vsub, vmadd, type Skin, type PartFrame } from '../render/car/skin';
import { MODEL_OWN, type Design } from '../core/design';
import { PLACED_LIMITS, PART_KINDS, placedOf, withPlaced, nextN, isPlate, type Placed, type PlacedId, type PlateId, type FreeId } from '../core/placed';

export interface PlaceHost { /** the design on the bench */ design(): Design; /** the design changed (its parts or swaps): kept, the figures, the link */ changed(): void;
  flash(t: string): void; redraw(): void; /** the ray under a point of the page (the body's axes), or null with no picture */ ray(clientX: number, clientY: number): { o: V; d: V } | null;
  /** the bar's place on the page */ bar: HTMLElement; /** the mode on or off (the page hides what the bar covers) */ mode(on: boolean): void }
export interface PlaceTool { readonly id: PlacedId | null; readonly n: number; start(id: PlacedId, n?: number): void; /** a new free part put on and placed */ add(id: FreeId): void; end(): void;
  /** the design as the car's mesh is built while placing: the part being placed taken off (it is drawn apart) */ shown(d: Design): Design;
  /** the part being placed, drawn alone for the overlay (the car's length: placed as the car is); a new mesh when it moved */ overlay(len: number): Mesh | null;
  /** a pointer on the picture: true when the part takes it (the camera then leaves it alone) */ down(e: PointerEvent): boolean; move(e: PointerEvent): boolean; up(e: PointerEvent): boolean;
  key(e: KeyboardEvent): boolean; wheel(e: WheelEvent): boolean }
const PLATE_NAME: Record<PlateId, string> = { plateF: '앞 번호판', plateR: '뒤 번호판' };
export const partName = (id: PlacedId) => isPlate(id) ? PLATE_NAME[id] : PART_KINDS[id].name;
const RED = [208, 22, 27];
/** what the tool reads of a fitted plate or part: its frame, its footprint, the verdict, its grab sphere, how to draw it */
interface View { F: PartFrame; hw: number; hh: number; ok: boolean; why: string | null; warn: string | null; info: string; twin: boolean; c: V; r: number; mesh(len: number): Mesh }
const mir = (a: V): V => [a[0], -a[1], a[2]];

export function placeTool(h: PlaceHost): PlaceTool {
  let id: PlacedId | null = null, n = 0, cur: Placed | null = null, view: View | null = null, good: Placed | null = null, snap = true, ver = 0, made = -1, mesh: Mesh | null = null, others: Footprint[] = [], plateOthers: PlateFit[] = [];
  let drag: { pid: number; off: [number, number]; x: number; y: number; moved: boolean; on: boolean; twin: boolean } | null = null;
  let gest: { pid: number; x: number; y: number; d0: number; a0: number; s0: number; r0: number } | null = null;
  const undo: (Placed[] | undefined)[] = [];
  const D = () => h.design(), skin = (): Skin | null => modelSkin(D())?.skin ?? null, base = () => D().body.base as 'p959' | 'bnr33', dims = () => D().body.frame?.dims;
  const free = () => !!id && !isPlate(id), kind = () => (id && !isPlate(id) ? PART_KINDS[id] : null);
  /** the other parts as they sit: the plates' fits (a plate's own rule) and every footprint (a free part's overlap) */
  const measure = () => { others = []; plateOthers = []; const s = modelSkin(D()); if (!s || !id) return; const d = D(), m = d.body.model;
    for (const pid of ['plateF', 'plateR'] as const) { if (pid === id || m?.[pid] === false) continue; const p = placedOf(d.body.parts, pid) ?? (() => { const mk = s.marks.find(k => k.name === pid), a = mk ? stockPlace(s.skin, mk) : null; return a ? { id: pid, at: a, rot: 0, tilt: 0, scale: 1 } : null; })();
      const f = p ? fitPlate(s.skin, p) : null; if (f) { plateOthers.push(f); others.push({ F: f.F, hw: PLATE_W / 2 * f.s, hh: PLATE_H / 2 * f.s }); } }
    for (const f of fitAll(s.skin, (d.body.parts ?? []).filter(p => !(p.id === id && (p.n ?? 0) === n)))) others.push(...footprints(f)); };
  const boxOf = (M: Mesh): { c: V; r: number } => { const lo: V = [Infinity, Infinity, Infinity], hi: V = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < M.pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k]!, M.pos[i + k]!); hi[k] = Math.max(hi[k]!, M.pos[i + k]!); }
    return M.n ? { c: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], r: Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 } : { c: [0, 0, 0], r: 0 }; };
  const viewOf = (s: Skin, p: Placed): View | null => {
    if (isPlate(p.id)) { const f = fitPlate(s, p, plateOthers); if (!f) return null; const draw = (len: number) => { const b = new Build(); drawPlate(b, f, plateText(D().body.model?.plate ?? '08루 0599')); return b.mesh(len); };
      return { F: f.F, hw: PLATE_W / 2 * f.s + 40, hh: PLATE_H / 2 * f.s + 40, ok: f.ok, why: f.why, warn: null, info: `받침 ${Math.round(f.gap)} mm`, twin: false, c: f.F.o, r: Math.hypot(PLATE_W, PLATE_H) / 2 * f.s + 30, mesh: draw }; }
    const f: PartFit | null = fitPart(s, p, others); if (!f) return null; const bx = boxOf(f.mesh);
    const draw = (len: number) => { const b = new Build(), cr = drawFit(b, f, D().body.paint, f.ok ? undefined : RED), M = b.mesh(len); if (cr.length) M.uv = crestUV(M, cr); return M; };
    return { F: f.F, hw: f.hw, hh: f.hh, ok: f.ok, why: f.why, warn: f.warn, info: f.twin ? '좌우 한 쌍' : f.kind.pair ? '한쪽만' : '하나', twin: f.twin, c: bx.c, r: bx.r + 20, mesh: draw }; };
  const refit = () => { const s = skin(); view = s && cur ? viewOf(s, cur) : null; ver++; sync(); h.redraw(); };
  /** the place kept in the design (and a step to undo); only a good one */
  const commit = (force = false) => { if (!id || !cur || (!view?.ok && !force)) return; const d = D(), now = placedOf(d.body.parts, id, n); if (now && JSON.stringify(now) === JSON.stringify(cur)) { good = structuredClone(cur); return; }
    undo.push(d.body.parts ? structuredClone(d.body.parts) : undefined); if (undo.length > 40) undo.shift(); d.body.parts = withPlaced(d.body.parts, id, cur, n); if (view?.ok) good = structuredClone(cur); h.changed(); };
  // ---- the bar ----
  const bar = h.bar; bar.textContent = ''; bar.hidden = true;
  const el = <K extends keyof HTMLElementTagNameMap>(t: K, cls = '', text = '') => { const e = document.createElement(t); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const title = el('b', 'pb-t'), why = el('p', 'pb-why'), hint = el('p', 'pb-hint', '부품을 끌어 차체 위로 옮깁니다(두 손가락: 크기·회전). 차체의 다른 곳을 누르면 그리로 갑니다. 빈 곳을 끌면 시점이 돕니다.'), rows = el('div', 'pb-rows');
  why.setAttribute('aria-live', 'polite');
  let sliders: { sync(): void }[] = [];
  const slider = (label: string, [a, b]: readonly [number, number], step: number, get: () => number, set: (v: number) => void, show: (v: number) => string) => {
    const r = el('label', 'pb-row'), l = el('span', 'pb-l', label), i = el('input', 'gk-range'), v = el('span', 'pb-v'); i.type = 'range'; i.min = String(a); i.max = String(b); i.step = String(step);
    i.addEventListener('input', () => { if (!cur) return; set(+i.value); v.textContent = show(+i.value); refit(); }); i.addEventListener('change', () => { if (view?.ok) commit(); else back(); });
    r.append(l, i, v); rows.append(r); sliders.push({ sync: () => { i.value = String(get()); v.textContent = show(get()); } }); };
  const deg = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x)}°`;
  /** the sliders of the part's kind (a plate: turn, tilt, size; a free part: size, depth and whichever angles it has) */
  function buildRows() { rows.textContent = ''; sliders = []; if (!id) return; const K = kind();
    if (!K) { slider('회전', PLACED_LIMITS.rot, 1, () => cur?.rot ?? 0, v => { cur!.rot = Math.abs(v) < 1.5 ? 0 : v; }, deg); slider('기울기', PLACED_LIMITS.tilt, 1, () => cur?.tilt ?? 0, v => { cur!.tilt = v; }, deg);
      slider('크기', PLACED_LIMITS.scale, 0.01, () => cur?.scale ?? 1, v => { cur!.scale = Math.abs(v - 1) < 0.015 ? 1 : v; }, v => `${Math.round(PLATE_W * v)}×${Math.round(PLATE_H * v)} mm`); return; }
    slider('크기', K.scale, 0.01, () => cur?.scale ?? 1, v => { cur!.scale = v; }, v => `${K.sizeOf} ${Math.round(K.size * v)} mm`);
    const dr = K.depth[1] - K.depth[0]; slider(K.depthName, K.depth, dr < 10 ? 0.1 : 1, () => cur?.depth ?? K.depth0, v => { cur!.depth = v; }, v => `${dr < 10 ? v.toFixed(1) : Math.round(v)} mm`);
    if (K.rot[1] > K.rot[0]) slider('회전', K.rot, 1, () => cur?.rot ?? 0, v => { cur!.rot = Math.abs(v) < 1.5 ? 0 : v; }, deg);
    if (K.tilt[1] > K.tilt[0]) slider(K.tiltName, K.tilt, 1, () => cur?.tilt ?? K.tilt0, v => { cur!.tilt = v; }, deg); }
  const check = (label: string, on: (v: boolean) => void) => { const l = el('label', 'check pb-snap'), cb = el('input'); cb.type = 'checkbox'; l.append(cb, ` ${label}`); cb.addEventListener('change', () => on(cb.checked)); return { l, cb }; };
  const sn = check('가운데 선에 붙이기 (30 mm 안)', v => { snap = v; }), one = check('한쪽만 (거울 짝 없음)', v => { if (!cur) return; if (v) cur.one = true; else delete cur.one; refit(); if (view?.ok) commit(); else back(); });
  sn.cb.checked = true; const toggles = el('div', 'pb-toggles'); toggles.append(sn.l, one.l);
  const btn = (t: string, f: () => void, cls = 'btn gk-btn gk-sm gk-b', label?: string) => { const b = el('button', cls, t); b.type = 'button'; if (label) b.setAttribute('aria-label', label); b.addEventListener('click', f); return b; };
  const pad = el('div', 'pb-pad'); pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', '미세 이동 (5 mm)');
  for (const [t, dx, dy, l] of [['◀', -5, 0, '왼쪽'], ['▲', 0, 5, '위'], ['▼', 0, -5, '아래'], ['▶', 5, 0, '오른쪽']] as const) pad.append(btn(t, () => nudge(dx, dy), 'btn gk-btn gk-sm gk-b pb-nudge', `${l}으로 5 mm`));
  const undoB = btn('되돌리기', () => { if (!id || !undo.length) return; const d = D(); d.body.parts = undo.pop(); h.changed(); cur = placedOf(d.body.parts, id, n) ?? stockOf(); good = cur && structuredClone(cur); measure(); refit(); });
  const offB = btn('순정 자리로', () => { if (!id) return; const d = D();
    if (free()) { undo.push(d.body.parts ? structuredClone(d.body.parts) : undefined); d.body.parts = withPlaced(d.body.parts, id, null, n); h.changed(); h.flash(`${partName(id)}을 뗐습니다`); tool.end(); return; }
    if (placedOf(d.body.parts, id)) { undo.push(structuredClone(d.body.parts)); d.body.parts = withPlaced(d.body.parts, id, null); h.changed(); }
    cur = stockOf(); good = cur && structuredClone(cur); refit(); h.flash(`${partName(id)}을 순정 자리로`); });
  const row = el('div', 'btns'); row.append(undoB, offB, btn('완료', () => tool.end(), 'btn main gk-btn gk-sm gk-y'));
  bar.append(title, hint, rows, toggles, pad, why, row);
  function sync() { if (!id) return; title.textContent = `${partName(id)}${free() && n ? ` ${n + 1}` : ''} 놓기`; for (const s of sliders) s.sync(); undoB.disabled = !undo.length;
    const K = kind(); one.l.hidden = !K?.pair; one.cb.checked = !!cur?.one; sn.l.hidden = !!K && (!K.centre || !!K.centreOnly); offB.textContent = free() ? '떼기' : '순정 자리로';
    why.textContent = !view ? '이 자리는 차체 위가 아닙니다' : view.ok ? `붙일 수 있음 · ${view.info}${view.warn ? ` · ${view.warn}` : ''}` : view.why!; why.classList.toggle('bad', !view?.ok); why.classList.toggle('warn', !!view?.ok && !!view.warn); }
  /** a plate at the car's own place, as a placed one (the place found on this skin) */
  function stockOf(): Placed | null { const s = modelSkin(D()); if (!s || !id || !isPlate(id)) return null; const mk = s.marks.find(k => k.name === id), a = mk ? stockPlace(s.skin, mk) : null; return a ? { id, at: a, rot: 0, tilt: 0, scale: 1 } : null; }
  /** back to the last good place */
  function back() { if (!cur || !good) return; if (view && !view.ok) h.flash(view.why!); cur = structuredClone(good); refit(); }
  /** a place moved onto the centre line: a wing always (straight down at the same station), a part that may sit there when near it */
  function centred(s: Skin, at: Placed['at']): Placed['at'] { const K = kind();
    if (K?.centreOnly) { const pt = s.at(at); const r = pt ? s.hit([pt.p[0], 0, pt.p[2] + 2000], [0, 0, -1], 5000) : null; return r?.at ?? at; }
    return snap && (!K || K.centre) ? snapCentre(s, at) ?? at : at; }
  /** the place under a point of the body: the part's centre `off` back from it in its plane, laid on the skin by a ray
   *  along the skin's normal there (a twin's: the point mirrored across the centre line first) */
  function placeUnder(cx: number, cy: number, off: [number, number], twin = false): boolean { const s = skin(), r = h.ray(cx, cy); if (!s || !r || !cur) return false; let hit = s.hit(r.o, r.d); if (!hit?.at) return false;
    if (twin) { const p = mir(hit.p), nn = mir(hit.n), m = s.hit(vmadd(p, nn, 200), [-nn[0], -nn[1], -nn[2]], 500); if (!m?.at) return false; hit = m; }
    let at = hit.at!; if ((off[0] || off[1]) && view) { const q = vmadd(vmadd(hit.p, view.F.u, -off[0]), view.F.up, -off[1]), h2 = s.hit(vmadd(q, hit.n, 300), [-hit.n[0], -hit.n[1], -hit.n[2]], 700); if (h2?.at) at = h2.at; }
    cur = { ...cur, at: centred(s, at) }; refit(); return true; }
  function nudge(dx: number, dy: number) { const s = skin(); if (!s || !cur || !view) return; const q = vmadd(vmadd(view.F.o, view.F.u, dx), view.F.up, dy), r = s.hit(vmadd(q, view.F.n, 300), [-view.F.n[0], -view.F.n[1], -view.F.n[2]], 700);
    if (!r?.at) return; cur = { ...cur, at: kind()?.centreOnly ? centred(s, r.at) : r.at }; refit(); if (view?.ok) commit(); else back(); }
  /** a free part's size and turn kept within its kind */
  const setSize = (v: number) => { const K = kind(); if (!cur) return; cur.scale = Math.round((K ? Math.max(K.scale[0], Math.min(K.scale[1], v)) : Math.max(PLACED_LIMITS.scale[0], Math.min(PLACED_LIMITS.scale[1], v))) * 100) / 100; };
  const setRot = (v: number) => { const L = kind()?.rot ?? PLACED_LIMITS.rot; if (cur) cur.rot = Math.round(Math.max(L[0], Math.min(L[1], v))); };
  /** the ray's nearest pass to a point (how far off it, mm) */
  const pass = (o: V, d: V, c: V) => { const w = vsub(c, o), t = Math.max(0, vdot(w, d)); return Math.hypot(...vsub(w, [d[0] * t, d[1] * t, d[2] * t])); };
  const tool: PlaceTool = {
    get id() { return id; }, get n() { return n; },
    start(p, k = 0) { if (id === p && n === k) return; if (id) tool.end(); const d = D(); if (!modelSkin(d)) return; id = p; n = k;
      // a plate taken off is put back to be placed
      if (isPlate(p)) { const m = (d.body.model ??= { ...MODEL_OWN.p959 }); if (m[p] === false) delete m[p]; }
      cur = placedOf(d.body.parts, p, k) ? structuredClone(placedOf(d.body.parts, p, k)!) : stockOf(); good = cur && structuredClone(cur); undo.length = 0;
      buildRows(); bar.hidden = false; h.mode(true); measure(); h.changed(); refit(); good = view?.ok ? structuredClone(cur) : good; },
    add(p) { const d = D(), s = modelSkin(d); if (!s) return; const k = nextN(d.body.parts, p); if (k === null) { h.flash(`${partName(p)}은 더 달 수 없습니다`); return; }
      const e = newPart(base(), s.skin, p, k, d.body.parts, dims()); if (!e) { h.flash('붙일 자리를 찾지 못했습니다'); return; }
      if (id) tool.end(); const was = d.body.parts ? structuredClone(d.body.parts) : undefined; d.body.parts = withPlaced(d.body.parts, p, e, k); tool.start(p, k); undo.push(was); sync(); },
    end() { if (!id) return; id = null; cur = null; view = null; drag = null; gest = null; bar.hidden = true; ver++; h.mode(false); h.changed(); h.redraw(); },
    shown(d) { if (!id) return d; return isPlate(id) ? { ...d, body: { ...d.body, model: { ...(d.body.model ?? MODEL_OWN.p959), [id]: false }, parts: withPlaced(d.body.parts, id, null) } } : { ...d, body: { ...d.body, parts: withPlaced(d.body.parts, id, null, n) } }; },
    overlay(len) { if (!id || !view) return null; if (made === ver && mesh) return mesh; const M = view.mesh(len);
      if (!view.ok && isPlate(id)) for (let t = 0; t < M.n; t++) if (/^plate(Plinth|Bracket|Frame)$/.test(M.names![M.part[t]!] ?? '')) M.col.set(RED, t * 3);
      made = ver; mesh = M; return M; },
    down(e) { if (!id || !view) return false;
      // a second finger while the part is held: pinch and twist
      if (drag && drag.pid !== e.pointerId) { if (!drag.on) { drag = null; return false; } if (gest || !cur) return true; const d = Math.hypot(e.clientX - drag.x, e.clientY - drag.y), a = Math.atan2(e.clientY - drag.y, e.clientX - drag.x);
        gest = { pid: e.pointerId, x: e.clientX, y: e.clientY, d0: Math.max(20, d), a0: a, s0: cur.scale, r0: cur.rot }; drag.moved = true; return true; }
      if (drag) return false; const s = skin(), r = h.ray(e.clientX, e.clientY); if (!s || !r) return false; const hit = s.hit(r.o, r.d);
      // on the part: the ray passes its drawn shape (or its twin's), or meets the skin inside its footprint
      const near = (c: V) => pass(r.o, r.d, c) < view!.r, onTwin = !!view.twin && near(mir(view.c)) && !near(view.c);
      let on = near(view.c) || onTwin, off: [number, number] = [0, 0];
      if (hit) { const p = onTwin ? mir(hit.p) : hit.p, dv = vsub(p, view.F.o), x = vdot(dv, view.F.u), y = vdot(dv, view.F.up); if (Math.abs(x) < view.hw + 30 && Math.abs(y) < view.hh + 30 && Math.abs(vdot(dv, view.F.n)) < 150) on = true; if (on && (Math.abs(x) < view.hw * 2 && Math.abs(y) < view.hh * 2)) off = [x, y]; }
      if (!hit && !on) return false;
      drag = { pid: e.pointerId, off, x: e.clientX, y: e.clientY, moved: false, on, twin: onTwin }; return on; },
    move(e) { if (gest && drag && cur) { if (e.pointerId === gest.pid) { gest.x = e.clientX; gest.y = e.clientY; } else if (e.pointerId === drag.pid) { drag.x = e.clientX; drag.y = e.clientY; } else return false;
        const d = Math.hypot(gest.x - drag.x, gest.y - drag.y), a = Math.atan2(gest.y - drag.y, gest.x - drag.x); setSize(gest.s0 * d / gest.d0); setRot(gest.r0 - (a - gest.a0) * 180 / Math.PI); refit(); return true; }
      if (!drag || drag.pid !== e.pointerId) return false; if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
      if (!drag.on) { if (drag.moved) drag = null; return false; } placeUnder(e.clientX, e.clientY, drag.off, drag.twin); return true; },
    up(e) { if (gest && (e.pointerId === gest.pid || e.pointerId === drag?.pid)) { gest = null; drag = null; if (view?.ok) commit(); else back(); return true; }
      if (!drag || drag.pid !== e.pointerId) return false; const g = drag; drag = null;
      if (!g.on && !g.moved) placeUnder(e.clientX, e.clientY, [0, 0]); else if (!g.on) return false;
      if (view?.ok) commit(); else back(); return true; },
    key(e) { if (!id) return false; const k = e.key, st = e.shiftKey ? 20 : 5;
      if (k === 'Escape' || k === 'Enter') { tool.end(); return true; }
      if ((k === 'Delete' || k === 'Backspace') && free()) { offB.click(); return true; }
      const mv: Record<string, [number, number]> = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }; if (!mv[k]) return false; nudge(...mv[k]!); return true; },
    wheel(e) { if (!id || !cur) return false; if (e.shiftKey) setRot(cur.rot + (e.deltaY > 0 ? -1 : 1)); else if (free()) setSize(cur.scale * (e.deltaY > 0 ? 1 / 1.04 : 1.04)); else return false;
      refit(); if (view?.ok) commit(); else back(); return true; } };
  return tool; }
