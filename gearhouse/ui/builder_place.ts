// The builder's free placing of a part on the body (docs/systems/115 P1a, §5-5): the pilot with the number plates. A
// plate's card in step ③ starts "놓기": the plate leaves the car's mesh and is drawn apart over it (a few hundred
// triangles made again at each move, the car itself not rebuilt), and a bar of its own appears over the view:
//   - one finger (or the mouse) on the plate drags it along the skin, the offset from where it was grabbed kept; a tap
//     on the body elsewhere puts it there; a drag off the plate turns the camera as before;
//   - the turn, the tilt and the size on sliders (PC: Shift + wheel turns it, the arrows nudge it 5 mm);
//   - the centre line pulls it on within 30 mm (a switch); undo, the stock place, done.
// A place that breaks a rule (render/car/p959/plates.ts) shows the plate's plinth red and the reason; let go there, the
// plate goes back to the last good place. Each good place is kept in the design (core/placed.ts, format 6 body.parts).
import { Build, type Mesh, type V } from '../render/car/mesh';
import { modelSkin } from '../render/car/bodies';
import { fitPlate, drawPlate, stockPlace, snapCentre, plateText, PLATE_W, PLATE_H, PLATE_RULES, type PlateFit } from '../render/car/p959';
import { vdot, vsub, vmadd, type Skin } from '../render/car/skin';
import { MODEL_OWN, type Design } from '../core/design';
import { PLACED_LIMITS, placedOf, withPlaced, type Placed, type PlacedId } from '../core/placed';

export interface PlaceHost { /** the design on the bench */ design(): Design; /** the design changed (its parts or swaps): kept, the figures, the link */ changed(): void;
  flash(t: string): void; redraw(): void; /** the ray under a point of the page (the body's axes), or null with no picture */ ray(clientX: number, clientY: number): { o: V; d: V } | null;
  /** the bar's place on the page */ bar: HTMLElement; /** the mode on or off (the page hides what the bar covers) */ mode(on: boolean): void }
export interface PlaceTool { readonly id: PlacedId | null; start(id: PlacedId): void; end(): void;
  /** the design as the car's mesh is built while placing: the plate being placed taken off (it is drawn apart) */ shown(d: Design): Design;
  /** the plate being placed, drawn alone for the overlay (the car's length: placed as the car is); a new mesh when it moved */ overlay(len: number): Mesh | null;
  /** a pointer on the picture: true when the plate takes it (the camera then leaves it alone) */ down(e: PointerEvent): boolean; move(e: PointerEvent): boolean; up(e: PointerEvent): boolean;
  key(e: KeyboardEvent): boolean; wheel(e: WheelEvent): boolean }
const NAME: Record<PlacedId, string> = { plateF: '앞 번호판', plateR: '뒤 번호판' };
const RED = [208, 22, 27];

export function placeTool(h: PlaceHost): PlaceTool {
  let id: PlacedId | null = null, cur: Placed | null = null, fit: PlateFit | null = null, good: Placed | null = null, snap = true, ver = 0, made = -1, mesh: Mesh | null = null;
  let drag: { pid: number; off: [number, number]; x: number; y: number; moved: boolean; onPlate: boolean } | null = null;
  const undo: (Placed[] | undefined)[] = [];
  const D = () => h.design(), skin = (): Skin | null => modelSkin(D())?.skin ?? null;
  /** the other plate as it sits (placed or at its own place): the overlap rule */
  const others = (): PlateFit[] => { const s = modelSkin(D()); if (!s || !id) return []; const o: PlacedId = id === 'plateF' ? 'plateR' : 'plateF', m = D().body.model;
    if (m?.[o] === false) return []; const p = placedOf(D().body.parts, o) ?? (() => { const mk = s.marks.find(k => k.name === o), a = mk ? stockPlace(s.skin, mk) : null; return a ? { id: o, at: a, rot: 0, tilt: 0, scale: 1 } : null; })();
    const f = p ? fitPlate(s.skin, p) : null; return f ? [f] : []; };
  const refit = () => { const s = skin(); fit = s && cur ? fitPlate(s, cur, others()) : null; ver++; sync(); h.redraw(); };
  /** the place kept in the design (and a step to undo); only a good one */
  const commit = () => { if (!id || !cur || !fit?.ok) return; const d = D(), now = placedOf(d.body.parts, id); if (now && JSON.stringify(now) === JSON.stringify(cur)) { good = cur; return; }
    undo.push(d.body.parts ? structuredClone(d.body.parts) : undefined); if (undo.length > 40) undo.shift(); d.body.parts = withPlaced(d.body.parts, id, cur); good = structuredClone(cur); h.changed(); };
  // ---- the bar ----
  const bar = h.bar; bar.textContent = ''; bar.hidden = true;
  const el = <K extends keyof HTMLElementTagNameMap>(t: K, cls = '', text = '') => { const e = document.createElement(t); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const title = el('b', 'pb-t'), why = el('p', 'pb-why'), hint = el('p', 'pb-hint', '판을 끌어 차체 위로 옮깁니다. 차체의 다른 곳을 누르면 그리로 갑니다. 빈 곳을 끌면 시점이 돕니다.');
  why.setAttribute('aria-live', 'polite');
  const slider = (label: string, [a, b]: readonly [number, number], step: number, get: () => number, set: (v: number) => void, show: (v: number) => string) => {
    const r = el('label', 'pb-row'), l = el('span', 'pb-l', label), i = el('input', 'gk-range'), v = el('span', 'pb-v'); i.type = 'range'; i.min = String(a); i.max = String(b); i.step = String(step);
    i.addEventListener('input', () => { if (!cur) return; set(+i.value); v.textContent = show(+i.value); refit(); }); i.addEventListener('change', () => { if (fit?.ok) commit(); else back(); });
    r.append(l, i, v); return { r, sync: () => { i.value = String(get()); v.textContent = show(get()); } }; };
  const deg = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x)}°`;
  const S = [slider('회전', PLACED_LIMITS.rot, 1, () => cur?.rot ?? 0, v => { cur!.rot = Math.abs(v) < 1.5 ? 0 : v; }, deg),
    slider('기울기', PLACED_LIMITS.tilt, 1, () => cur?.tilt ?? 0, v => { cur!.tilt = v; }, deg),
    slider('크기', PLACED_LIMITS.scale, 0.01, () => cur?.scale ?? 1, v => { cur!.scale = Math.abs(v - 1) < 0.015 ? 1 : v; }, v => `${Math.round(PLATE_W * v)}×${Math.round(PLATE_H * v)} mm`)];
  const sn = el('label', 'check pb-snap'), cb = el('input'); cb.type = 'checkbox'; cb.checked = true; sn.append(cb, ` 가운데 선에 붙이기 (${PLATE_RULES.snap} mm 안)`); cb.addEventListener('change', () => { snap = cb.checked; });
  const btn = (t: string, f: () => void, main = false) => { const b = el('button', main ? 'btn main gk-btn gk-sm gk-y' : 'btn gk-btn gk-sm gk-b', t); b.type = 'button'; b.addEventListener('click', f); return b; };
  const undoB = btn('되돌리기', () => { if (!id || !undo.length) return; const d = D(); d.body.parts = undo.pop(); h.changed(); cur = placedOf(d.body.parts, id) ?? stockOf(); good = cur && structuredClone(cur); refit(); });
  const row = el('div', 'btns'); row.append(undoB, btn('순정 자리로', () => { if (!id) return; const d = D(); if (placedOf(d.body.parts, id)) { undo.push(structuredClone(d.body.parts)); d.body.parts = withPlaced(d.body.parts, id, null); h.changed(); }
    cur = stockOf(); good = cur && structuredClone(cur); refit(); h.flash(`${NAME[id]}을 순정 자리로`); }), btn('완료', () => tool.end(), true));
  bar.append(title, hint, ...S.map(s => s.r), sn, why, row);
  function sync() { if (!id) return; title.textContent = `${NAME[id]} 놓기`; for (const s of S) s.sync(); undoB.disabled = !undo.length;
    why.textContent = !fit ? '이 자리는 차체 위가 아닙니다' : fit.ok ? `붙일 수 있음 · 받침 ${Math.round(fit.gap)} mm` : fit.why!; why.classList.toggle('bad', !fit?.ok); }
  /** the plate at the car's own place, as a placed one (the place found on this skin) */
  function stockOf(): Placed | null { const s = modelSkin(D()); if (!s || !id) return null; const mk = s.marks.find(k => k.name === id), a = mk ? stockPlace(s.skin, mk) : null; return a ? { id, at: a, rot: 0, tilt: 0, scale: 1 } : null; }
  /** back to the last good place */
  function back() { if (!cur || !good) return; if (fit && !fit.ok) h.flash(fit.why!); cur = structuredClone(good); refit(); }
  /** the place under a point of the body: the plate's centre `off` back from it in the plate's plane, laid on the skin
   *  by a ray along the skin's normal there, pulled onto the centre line when near it */
  function placeUnder(cx: number, cy: number, off: [number, number]): boolean { const s = skin(), r = h.ray(cx, cy); if (!s || !r || !cur) return false; const hit = s.hit(r.o, r.d); if (!hit?.at) return false;
    let at = hit.at; if ((off[0] || off[1]) && fit) { const q = vmadd(vmadd(hit.p, fit.F.u, -off[0]), fit.F.up, -off[1]), h2 = s.hit(vmadd(q, hit.n, 300), [-hit.n[0], -hit.n[1], -hit.n[2]], 700); if (h2?.at) at = h2.at; }
    if (snap) at = snapCentre(s, at) ?? at; cur = { ...cur, at }; refit(); return true; }
  const nudge = (dx: number, dy: number) => { const s = skin(); if (!s || !cur || !fit) return; const q = vmadd(vmadd(fit.F.o, fit.F.u, dx), fit.F.up, dy), r = s.hit(vmadd(q, fit.F.n, 300), [-fit.F.n[0], -fit.F.n[1], -fit.F.n[2]], 700);
    if (!r?.at) return; cur = { ...cur, at: r.at }; refit(); if (fit?.ok) commit(); else back(); };
  const tool: PlaceTool = {
    get id() { return id; },
    start(p) { if (id === p) return; if (id) tool.end(); const d = D(); if (!modelSkin(d)) return; id = p;
      // a plate taken off is put back to be placed
      const m = (d.body.model ??= { ...MODEL_OWN.p959 }); if (m[p] === false) { delete m[p]; }
      cur = placedOf(d.body.parts, p) ? structuredClone(placedOf(d.body.parts, p)!) : stockOf(); good = cur && structuredClone(cur); undo.length = 0;
      bar.hidden = false; h.mode(true); h.changed(); refit(); },
    end() { if (!id) return; id = null; cur = null; fit = null; drag = null; bar.hidden = true; ver++; h.mode(false); h.changed(); h.redraw(); },
    shown(d) { if (!id) return d; return { ...d, body: { ...d.body, model: { ...(d.body.model ?? MODEL_OWN.p959), [id]: false }, parts: withPlaced(d.body.parts, id, null) } }; },
    overlay(len) { if (!id || !fit) return null; if (made === ver && mesh) return mesh; const b = new Build(); drawPlate(b, fit, plateText(D().body.model?.plate ?? '08루 0599')); const M = b.mesh(len);
      if (!fit.ok) for (let t = 0; t < M.n; t++) if (/^plate(Plinth|Bracket|Frame)$/.test(M.names![M.part[t]!] ?? '')) M.col.set(RED, t * 3);
      made = ver; mesh = M; return M; },
    down(e) { if (!id || !fit || drag) return false; const s = skin(), r = h.ray(e.clientX, e.clientY), hit = s && r ? s.hit(r.o, r.d) : null; if (!hit) return false;
      const d = vsub(hit.p, fit.F.o), x = vdot(d, fit.F.u), y = vdot(d, fit.F.up), on = Math.abs(x) < PLATE_W / 2 * fit.s + 40 && Math.abs(y) < PLATE_H / 2 * fit.s + 40 && Math.abs(vdot(d, fit.F.n)) < 120;
      drag = { pid: e.pointerId, off: on ? [x, y] : [0, 0], x: e.clientX, y: e.clientY, moved: false, onPlate: on }; return on; },
    move(e) { if (!drag || drag.pid !== e.pointerId) return false; if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) drag.moved = true;
      if (!drag.onPlate) { if (drag.moved) drag = null; return false; } placeUnder(e.clientX, e.clientY, drag.off); return true; },
    up(e) { if (!drag || drag.pid !== e.pointerId) return false; const g = drag; drag = null;
      if (!g.onPlate && !g.moved) placeUnder(e.clientX, e.clientY, [0, 0]); else if (!g.onPlate) return false;
      if (fit?.ok) commit(); else back(); return true; },
    key(e) { if (!id) return false; const k = e.key, st = e.shiftKey ? 20 : 5;
      if (k === 'Escape' || k === 'Enter') { tool.end(); return true; }
      const mv: Record<string, [number, number]> = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }; if (!mv[k]) return false; nudge(...mv[k]!); return true; },
    wheel(e) { if (!id || !cur || !e.shiftKey) return false; const L = PLACED_LIMITS.rot; cur.rot = Math.max(L[0], Math.min(L[1], Math.round(cur.rot + (e.deltaY > 0 ? -1 : 1)))); refit(); if (fit?.ok) commit(); else back(); return true; } };
  return tool; }
