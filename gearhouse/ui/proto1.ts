// Prototype 1 page, round 2: measured base cars as the starting point, edited in three layers
// (proportions, parts from other cars, panel points). Every change rebuilds and redraws the car.
import { rasterize, MM_PER_PX, type CarImage } from '../render/car/raster';
import { buildCar, newEdit, PROP_RANGE, SLOTS, type CarEdit } from '../render/car/edit';
import type { CarDesign, Panel, Slot } from '../render/car/types';

const files = import.meta.glob('../data/cars/*.json', { eager: true, import: 'default' }) as Record<string, CarDesign>;
const bases: Record<string, CarDesign> = {}; for (const d of Object.values(files)) bases[d.id!] = d;
const KO: Record<string, string> = { sedan30: '1930 타운 세단', coupe30: '1930 쿠페', cabrio33: '1933 카브리올레', airflow34: '1934 유선형 세단', town34: '1934 V12 타운카', zephyr37: '1937 유선형 쿠페', coupe40: '1940 V8 쿠페', cont40: '1940 V12 롱데크 쿠페', lux41: '1941 V8 고급 세단' };
const SLOT_KO: Record<string, string> = { grille: '라디에이터 그릴', lamp: '헤드램프', tail: '테일램프', bumperF: '앞 범퍼', bumperR: '뒤 범퍼', wheel: '휠' };
const PROP_KO: Record<string, string> = { frontOH: '앞 오버행', hood: '후드 길이', cabin: '객실 길이', rearOH: '뒤 오버행', body: '차체 높이', green: '창·지붕 높이' };
const ids = Object.keys(bases).sort((a, b) => bases[a]!.year - bases[b]!.year);
const edits: Record<string, CarEdit> = {}; for (const id of ids) edits[id] = newEdit(id);
let cur = ids[0]!, tab = 1, sel: string | null = null, slotSel: Slot | null = null, car: CarDesign, img: CarImage;
let drag: { kind: 'pt'; i: number } | { kind: 'slot'; x: number; y: number; ox: number; oz: number } | null = null;
const $ = (id: string) => document.getElementById(id)!, cv = $('cv') as HTMLCanvasElement, ctx = cv.getContext('2d')!;
const E = () => edits[cur]!;
const scale = () => Math.max(1, Math.min(4, Math.floor(Math.max(320, ($('stage').clientWidth || 800) - 8) / (img?.w ?? 400))));
function toCanvas(im: CarImage) { const c = document.createElement('canvas'); c.width = im.w; c.height = im.h; c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(im.rgba), im.w, im.h), 0, 0); return c; }

function draw() {
  const t0 = performance.now(); car = buildCar(bases, E()); img = rasterize(car); const k = scale();
  cv.width = img.w * k; cv.height = img.h * k; ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#d6cdb8'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#b7ad96'; ctx.fillRect(0, img.groundY * k, cv.width, cv.height);
  ctx.drawImage(toCanvas(img), 0, 0, cv.width, cv.height);
  const mark = (p: Panel, col: string, dots: boolean) => { ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); p.pts.forEach((q, i) => { const x = img.X(q[0]) * k, y = img.Y(q[1]) * k; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
    if (dots) for (const q of p.pts) { const x = img.X(q[0]) * k, y = img.Y(q[1]) * k; ctx.fillStyle = '#1e5ac8'; ctx.fillRect(x - 3, y - 3, 6, 6); ctx.strokeStyle = '#fff'; ctx.strokeRect(x - 3.5, y - 3.5, 7, 7); } };
  if (tab === 3 && sel) { const p = car.panels.find(q => q.id === sel); if (p) mark(p, 'rgba(30,90,200,0.9)', true); }
  if (tab === 2 && slotSel) for (const p of car.panels) if (p.slot === slotSel) mark(p, 'rgba(200,60,30,0.9)', false);
  const n = Object.values(E().moves).reduce((a, m) => a + Object.keys(m).length, 0);
  $('info').textContent = `${KO[cur] ?? cur} · ${img.w}×${img.h}px (${MM_PER_PX} mm/px, 길이 ${car.length} mm) · 다시 그리기 ${(performance.now() - t0).toFixed(0)} ms · 패널 ${car.panels.length}개 · 손으로 옮긴 점 ${n}개`;
  $('hint').textContent = tab === 1 ? '슬라이더로 구간을 늘이고 줄입니다. 바퀴 주변은 둥근 모양을 유지합니다.' : tab === 2 ? '부품을 다른 차에서 가져오면 이 차의 장착 위치에 맞춰 붙습니다. 부품을 고른 뒤 그림에서 끌어 위치를 옮깁니다.' : '패널을 고르고 파란 점을 끌어 모양을 바꿉니다. 비례나 부품을 다시 바꿔도 옮긴 점은 유지됩니다.';
}
function gallery() { const box = $('all'); box.innerHTML = ''; for (const id of ids) { const c = toCanvas(rasterize(buildCar(bases, edits[id]!))); c.title = KO[id] ?? id; c.style.cursor = 'pointer'; c.onclick = () => { cur = id; sel = null; slotSel = null; ui(); draw(); }; box.appendChild(c); } }
function ui() {
  const cb = $('cars'); cb.innerHTML = ''; for (const id of ids) { const b = document.createElement('button'); b.textContent = KO[id] ?? id; b.className = id === cur ? 'on' : ''; b.onclick = () => { cur = id; sel = null; slotSel = null; ui(); draw(); }; cb.appendChild(b); }
  ($('c1') as HTMLInputElement).value = E().paint ?? bases[cur]!.paint; ($('c2') as HTMLInputElement).value = E().paint2 ?? bases[cur]!.paint2;
  [1, 2, 3].forEach(t => { $('t' + t).className = t === tab ? 'on' : ''; });
  const pane = $('pane'); pane.innerHTML = '';
  if (tab === 1) for (const key of Object.keys(PROP_RANGE) as (keyof typeof PROP_RANGE)[]) { const [lo, hi] = PROP_RANGE[key], scl = key === 'body' || key === 'green';
    const lab = document.createElement('label'); lab.className = 'sl'; const show = () => { const v = E().prop[key]; lab.textContent = `${PROP_KO[key]}: ${scl ? Math.round(v * 100) + '%' : (v > 0 ? '+' : '') + v + ' mm'}`; }; show();
    const r = document.createElement('input'); r.type = 'range'; r.min = String(lo); r.max = String(hi); r.step = scl ? '0.01' : '10'; r.value = String(E().prop[key]);
    r.oninput = () => { E().prop[key] = +r.value; show(); draw(); }; r.onchange = gallery; pane.append(lab, r); }
  if (tab === 2) for (const slot of SLOTS) { const have = slot === 'wheel' || bases[cur]!.panels.some(p => p.slot === slot); if (!have) continue;
    const lab = document.createElement('label'); lab.className = 'sl'; lab.textContent = SLOT_KO[slot]!; const s = document.createElement('select');
    for (const id of ids) { if (slot !== 'wheel' && !bases[id]!.panels.some(p => p.slot === slot)) continue; if (bases[id]!.year > bases[cur]!.year + 11) continue; const o = document.createElement('option'); o.value = id; o.textContent = (id === cur ? '원래 것 · ' : '') + (KO[id] ?? id); s.appendChild(o); }
    s.value = E().swaps[slot] ?? cur; s.onchange = () => { E().swaps[slot] = s.value; if (slot !== 'wheel') slotSel = slot; draw(); gallery(); };
    s.onfocus = () => { if (slot !== 'wheel') { slotSel = slot; draw(); } }; pane.append(lab, s); }
  if (tab === 3) { const box = document.createElement('div'); box.className = 'list'; const seen = new Set<string>();
    for (const p of [...(car?.panels ?? [])].sort((a, b) => b.z - a.z)) { if (seen.has(p.id) || p.material === 'shadow') continue; seen.add(p.id); const b = document.createElement('button'); b.textContent = `${p.id} · 점 ${p.pts.length}개`; b.className = p.id === sel ? 'on' : ''; b.onclick = () => { sel = sel === p.id ? null : p.id; ui(); draw(); }; box.appendChild(b); }
    pane.appendChild(box); }
}
[1, 2, 3].forEach(t => { $('t' + t).onclick = () => { tab = t; ui(); draw(); }; });
$('reset').onclick = () => { edits[cur] = newEdit(cur); sel = null; slotSel = null; ui(); draw(); gallery(); };
($('c1') as HTMLInputElement).oninput = e => { E().paint = (e.target as HTMLInputElement).value; draw(); }; ($('c2') as HTMLInputElement).oninput = e => { E().paint2 = (e.target as HTMLInputElement).value; draw(); };
($('c1') as HTMLInputElement).onchange = gallery; ($('c2') as HTMLInputElement).onchange = gallery;
const local = (e: PointerEvent) => { const r = cv.getBoundingClientRect(), k = scale(); return [(e.clientX - r.left) / k, (e.clientY - r.top) / k] as const; };
cv.addEventListener('pointerdown', e => { const [x, y] = local(e), k = scale();
  if (tab === 3 && sel) { const p = car.panels.find(q => q.id === sel); if (!p) return; let best = -1, bd = 16 / k; p.pts.forEach((q, i) => { const dd = Math.hypot(img.X(q[0]) - x, img.Y(q[1]) - y); if (dd < bd) { bd = dd; best = i; } }); if (best >= 0) { drag = { kind: 'pt', i: best }; cv.setPointerCapture(e.pointerId); } }
  if (tab === 2) { const hit = car.panels.filter(p => p.slot).reverse().find(p => { const xs = p.pts.map(q => img.X(q[0])), ys = p.pts.map(q => img.Y(q[1])); return x >= Math.min(...xs) - 3 && x <= Math.max(...xs) + 3 && y >= Math.min(...ys) - 3 && y <= Math.max(...ys) + 3; });
    if (hit) { slotSel = hit.slot!; const o = E().nudge[slotSel] ?? [0, 0]; drag = { kind: 'slot', x, y, ox: o[0], oz: o[1] }; cv.setPointerCapture(e.pointerId); draw(); } } });
cv.addEventListener('pointermove', e => { if (!drag) return; const [x, y] = local(e);
  if (drag.kind === 'pt' && sel) { const p = car.panels.find(q => q.id === sel)!, q = p.pts[drag.i]!, m = (E().moves[sel] ??= {}), o = m[drag.i] ?? [0, 0];
    const nx = Math.round((x - img.X(0)) * MM_PER_PX / 5) * 5, nz = Math.round((img.Y(0) - y) * MM_PER_PX / 5) * 5; m[drag.i] = [o[0] + nx - q[0], o[1] + nz - q[1]]; }
  if (drag.kind === 'slot' && slotSel) E().nudge[slotSel] = [Math.round(drag.ox + (x - drag.x) * MM_PER_PX / 5) * 5, Math.round(drag.oz - (y - drag.y) * MM_PER_PX / 5) * 5];
  draw(); });
const end = () => { if (drag) gallery(); drag = null; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
window.addEventListener('resize', draw);
draw(); ui(); gallery();
// for automated checks: where a panel's point is on the page
(window as unknown as { __p1: unknown }).__p1 = { point: (id: string, i: number) => { const p = car.panels.find(q => q.id === id)!, r = cv.getBoundingClientRect(), k = scale(); return [r.left + img.X(p.pts[i]![0]) * k, r.top + img.Y(p.pts[i]![1]) * k]; }, edit: () => E() };
