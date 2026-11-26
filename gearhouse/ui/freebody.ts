// The free body prototype's dev page (freebody.html, docs/systems/106): a silhouette from the presets (two blended, or
// pieces of three joined), its side profile and plan with draggable keypoints, the harvested fixtures switched on and
// moved over the skin; the car drawn by drawMesh, turned by dragging.
import { drawMesh } from '../render/car/mesh';
import { buildFree, type FreeCar } from '../render/car/free/build';
import { blend, joinPieces, lengthOf, moveKey, pieceOf, xOf, sOf, type CurveName, type Silhouette } from '../render/car/free/curves';
import { PRESETS } from '../render/car/free/presets';
import { FIXTURE_SET } from '../render/car/free/library';
import type { Placed } from '../render/car/free/fixture';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const view = $<HTMLCanvasElement>('view'), prof = $<HTMLCanvasElement>('prof'), plan = $<HTMLCanvasElement>('plan');
const fx = FIXTURE_SET.map(f => ({ def: f, on: true, s: f.defaults.s ?? 0, a: f.defaults.a ?? 0, scale: 1, rot: 0 }));
const st = { yaw: 32, pitch: 20, mode: 'blend', a: 0, b: 3, t: 0, pn: 0, pc: 1, pt: 2, curve: 'top' as CurveName, paint: '#c8281e', sel: 0 };
let edit: Silhouette | null = null, car: FreeCar | null = null, dirty = true;

for (const id of ['a', 'b', 'pn', 'pc', 'pt']) { const s = $<HTMLSelectElement>(id); PRESETS.forEach((p, k) => s.add(new Option(p.name, String(k)))); s.value = String((st as unknown as Record<string, number>)[id]); }
FIXTURE_SET.forEach((f, k) => { $<HTMLSelectElement>('sel').add(new Option(f.name, String(k)));
  const l = document.createElement('label'); l.className = 'chk'; l.innerHTML = `<input type="checkbox" checked> ${f.name} <small>(${f.kind === 'cut' ? '관입형' : '표면형'})</small>`;
  l.querySelector('input')!.addEventListener('change', e => { fx[k]!.on = (e.target as HTMLInputElement).checked; dirty = true; }); $('fx').append(l); });

/** the silhouette the controls give (the drags kept until a control above them changes) */
function silhouette(): Silhouette { if (edit) return edit; const P = PRESETS;
  return st.mode === 'blend' ? blend(P[st.a]!, P[st.b]!, st.t) : joinPieces(pieceOf(P[st.pn]!, 'nose'), pieceOf(P[st.pc]!, 'cabin'), pieceOf(P[st.pt]!, 'tail')); }
function rebuild() { const placed: Placed[] = fx.filter(f => f.on).map(f => ({ fixture: f.def, ...(f.def.defaults.face === 'tail' ? {} : { s: f.s, a: f.a }), scale: f.scale * (f.def.defaults.scale ?? 1), rot: f.rot }));
  const t = performance.now(); car = buildFree(silhouette(), { fixtures: placed, colours: { paint: st.paint } });
  $('stat').textContent = `삼각형 ${car.mesh.n.toLocaleString()} · 껍질 열린 변 ${car.closure.open} · ${Math.round(performance.now() - t)} ms · ` + car.fixtures.map(f => f.ok ? '' : `${f.id}: ${f.why}`).filter(Boolean).join(' · '); }

const ink = () => getComputedStyle(document.body).color;
function drawCar() { if (!car) return; const W = view.width, H = view.height, p = drawMesh(car.mesh, st.yaw, st.pitch, 5200 / W, W, H, { outline: 1, glass: 0.7, cy: 0.62 }); view.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.rgba), W, H), 0, 0); }
/** the side profile (top, crest, floor) and the plan (half-width), with the chosen curve's keypoints */
function drawLines() { const s = silhouette(), L = lengthOf(s.chassis), g = prof.getContext('2d')!, W = prof.width, H = prof.height, k = (W - 20) / L, X = (x: number) => 10 + x * k, Z = (z: number) => H - 10 - z * k;
  g.clearRect(0, 0, W, H); const fn = (n: CurveName) => { const t = s.curves[n]; return (q: number) => { let i = 0; while (i + 1 < t.length && t[i + 1]![0] < q) i++; const a = t[i]!, b = t[Math.min(t.length - 1, i + 1)]!; return b[0] === a[0] ? a[1] : a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, (q - a[0]) / (b[0] - a[0]))); }; };
  const line = (c: HTMLCanvasElement, f: (q: number) => number, Y: (v: number) => number, col: string, w = 1) => { const ctx = c.getContext('2d')!; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); for (let q = 0; q <= 3.0001; q += 0.02) { const x = X(xOf(s.chassis, q)), y = Y(f(q)); if (q === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); };
  for (const n of ['top', 'crest', 'floor'] as CurveName[]) line(prof, fn(n), Z, n === st.curve ? '#a0522d' : ink(), n === st.curve ? 2 : 1);
  for (const w of [1, 2]) { g.beginPath(); g.arc(X(xOf(s.chassis, w)), Z(s.chassis.r), s.chassis.r * k, 0, Math.PI * 2); g.strokeStyle = ink(); g.stroke(); }
  g.fillStyle = '#a0522d'; for (const [q, v] of s.curves[st.curve]) { g.beginPath(); g.arc(X(xOf(s.chassis, q)), Z(v), 4, 0, Math.PI * 2); g.fill(); }
  const h = plan.getContext('2d')!, PH = plan.height, Yp = (y: number) => PH / 2 - y * k; h.clearRect(0, 0, W, PH); line(plan, fn('half'), Yp, '#a0522d', 2); line(plan, q => -fn('half')(q), Yp, ink());
  h.fillStyle = '#a0522d'; for (const [q, v] of s.curves.half) { h.beginPath(); h.arc(X(xOf(s.chassis, q)), Yp(v), 4, 0, Math.PI * 2); h.fill(); } }

/** dragging a keypoint: the nearest one under the pointer, moved with it (the curve stays smooth and both sides follow) */
function keyDrag(c: HTMLCanvasElement, curveOf: () => CurveName, Yinv: (py: number, k: number) => number) { let hit = -1, last: [number, number] = [0, 0];
  const at = (e: PointerEvent): [number, number] => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.addEventListener('pointerdown', e => { const s = silhouette(), k = (c.width - 20) / lengthOf(s.chassis), [px, py] = at(e); let best = 14;
    s.curves[curveOf()].forEach(([q, v], i) => { const d = Math.hypot(10 + xOf(s.chassis, q) * k - px, Yinv(v, k) - py); if (d < best) { best = d; hit = i; } }); last = [px, py]; if (hit >= 0) c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => { if (hit < 0) return; const s = silhouette(), k = (c.width - 20) / lengthOf(s.chassis), [px, py] = at(e), q = s.curves[curveOf()][hit]![0], x = xOf(s.chassis, q);
    const ds = sOf(s.chassis, x + (px - last[0]) / k) - q, dv = -(py - last[1]) / k * (curveOf() === 'half' ? 1 : 1); last = [px, py]; edit = moveKey(s, curveOf(), hit, ds, dv); dirty = true; });
  c.addEventListener('pointerup', () => { hit = -1; }); }
keyDrag(prof, () => st.curve, (v, k) => prof.height - 10 - v * k); keyDrag(plan, () => 'half', (v, k) => plan.height / 2 - v * k);

let turn: [number, number] | null = null;
view.addEventListener('pointerdown', e => { turn = [e.clientX, e.clientY]; view.setPointerCapture(e.pointerId); });
view.addEventListener('pointermove', e => { if (!turn) return; st.yaw = (st.yaw + (e.clientX - turn[0]) * 0.6 + 360) % 360; st.pitch = Math.max(0, Math.min(89, st.pitch + (e.clientY - turn[1]) * 0.4)); turn = [e.clientX, e.clientY]; drawCar(); });
view.addEventListener('pointerup', () => { turn = null; });

const reset = () => { edit = null; dirty = true; };
for (const id of ['a', 'b', 'pn', 'pc', 'pt']) $(id).addEventListener('change', e => { (st as unknown as Record<string, number>)[id] = +(e.target as HTMLSelectElement).value; reset(); });
$('t').addEventListener('input', e => { st.t = +(e.target as HTMLInputElement).value; reset(); });
$('mode').addEventListener('change', e => { st.mode = (e.target as HTMLSelectElement).value; const b = st.mode === 'blend'; $('blendRow').hidden = !b; $('tRow').hidden = !b; $('pieceRow').hidden = b; reset(); });
$('curve').addEventListener('change', e => { st.curve = (e.target as HTMLSelectElement).value as CurveName; drawLines(); });
$('paint').addEventListener('change', e => { st.paint = (e.target as HTMLSelectElement).value; dirty = true; });
const syncSel = () => { const f = fx[st.sel]!; ($('fs') as HTMLInputElement).value = String(f.s); ($('fa') as HTMLInputElement).value = String(f.a); ($('fk') as HTMLInputElement).value = String(f.scale); ($('fr') as HTMLInputElement).value = String(f.rot);
  const face = f.def.defaults.face === 'tail'; ($('fs') as HTMLInputElement).disabled = face; ($('fa') as HTMLInputElement).disabled = face; };
$('sel').addEventListener('change', e => { st.sel = +(e.target as HTMLSelectElement).value; syncSel(); });
for (const [id, key] of [['fs', 's'], ['fa', 'a'], ['fk', 'scale'], ['fr', 'rot']] as const) $(id).addEventListener('input', e => { fx[st.sel]![key] = +(e.target as HTMLInputElement).value; dirty = true; });
syncSel();
function frame() { if (dirty) { dirty = false; rebuild(); drawCar(); drawLines(); } requestAnimationFrame(frame); }
frame();
