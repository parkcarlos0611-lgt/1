// Prototype 1 page: the three bodies drawn from point data, a panel picker and draggable control points.
// Every drag redraws the whole car and reports the time it took (target: under 0.2 s).
import { rasterize, MM_PER_PX, type CarImage } from '../render/car/raster';
import type { CarDesign, Panel } from '../render/car/types';
import sedan from '../data/cars/1932_sedan.json';
import roadster from '../data/cars/1934_roadster.json';
import limo from '../data/cars/1936_coachbuilt_limousine.json';

const NAMES: Record<string, string> = { '1932 sedan': '1932 세단', '1934 roadster': '1934 로드스터', '1936 coachbuilt limousine': '1936 코치빌트 리무진' };
const cars = [sedan, roadster, limo].map(c => structuredClone(c) as unknown as CarDesign);
let cur = 0, sel: Panel | null = null, img: CarImage | null = null, drag = -1;
const $ = (id: string) => document.getElementById(id)!;
const cv = $('cv') as HTMLCanvasElement, ctx = cv.getContext('2d')!;

function scale(): number { const room = Math.max(320, ($('stage').clientWidth || 800) - 8); return Math.max(1, Math.min(4, Math.floor(room / (img?.w ?? 400)))); }
function toCanvas(im: CarImage): HTMLCanvasElement { const c = document.createElement('canvas'); c.width = im.w; c.height = im.h; c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(im.rgba), im.w, im.h), 0, 0); return c; }

function draw() {
  const d = cars[cur]!; img = rasterize(d); const k = scale(), src = toCanvas(img);
  cv.width = img.w * k; cv.height = img.h * k; ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#d6cdb8'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#b7ad96'; ctx.fillRect(0, img.groundY * k, cv.width, cv.height);
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  if (sel) { ctx.strokeStyle = 'rgba(30,90,200,0.8)'; ctx.lineWidth = 1; ctx.beginPath();
    sel.pts.forEach((p, i) => { const x = img!.X(p[0]) * k, y = img!.Y(p[1]) * k; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke();
    sel.pts.forEach(p => { const x = img!.X(p[0]) * k, y = img!.Y(p[1]) * k; ctx.fillStyle = p[2] === 1 ? '#c03020' : '#1e5ac8'; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.strokeStyle = '#fff'; ctx.strokeRect(x - 4.5, y - 4.5, 9, 9); }); }
  $('info').textContent = `${NAMES[d.name] ?? d.name} · ${img.w}×${img.h}px (${MM_PER_PX} mm/px, 길이 ${d.length} mm) · 다시 그리기 ${img.ms.toFixed(0)} ms` + (sel ? ` · 선택: ${sel.id} (빨간 점은 모서리)` : '');
}
function drawAll() { const box = $('all'); box.innerHTML = ''; for (const d of cars) { const c = toCanvas(rasterize(d)); c.title = NAMES[d.name] ?? d.name; box.appendChild(c); } }
function lists() {
  const cb = $('cars'); cb.innerHTML = ''; cars.forEach((d, i) => { const b = document.createElement('button'); b.textContent = NAMES[d.name] ?? d.name; b.className = i === cur ? 'on' : ''; b.onclick = () => { cur = i; sel = null; lists(); draw(); }; cb.appendChild(b); });
  const pb = $('panels'); pb.innerHTML = ''; for (const p of [...cars[cur]!.panels].sort((a, b) => b.z - a.z)) { const b = document.createElement('button'); b.textContent = `${p.id} · ${p.material}`; b.className = p === sel ? 'on' : ''; b.onclick = () => { sel = sel === p ? null : p; lists(); draw(); }; pb.appendChild(b); }
  ($('c1') as HTMLInputElement).value = cars[cur]!.paint; ($('c2') as HTMLInputElement).value = cars[cur]!.paint2;
}
($('c1') as HTMLInputElement).oninput = e => { cars[cur]!.paint = (e.target as HTMLInputElement).value; draw(); };
($('c2') as HTMLInputElement).oninput = e => { cars[cur]!.paint2 = (e.target as HTMLInputElement).value; draw(); };
($('c1') as HTMLInputElement).onchange = drawAll; ($('c2') as HTMLInputElement).onchange = drawAll;
const local = (e: PointerEvent) => { const r = cv.getBoundingClientRect(), k = scale(); return [(e.clientX - r.left) / k, (e.clientY - r.top) / k] as const; };
cv.addEventListener('pointerdown', e => { if (!sel || !img) return; const [x, y] = local(e), k = scale(); let best = -1, bd = 14 / k;
  sel.pts.forEach((p, i) => { const dd = Math.hypot(img!.X(p[0]) - x, img!.Y(p[1]) - y); if (dd < bd) { bd = dd; best = i; } }); drag = best; if (best >= 0) cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if (drag < 0 || !sel || !img) return; const [x, y] = local(e), p = sel.pts[drag]!;
  p[0] = Math.round((x - img.X(0)) * MM_PER_PX / 5) * 5; p[1] = Math.round((img.Y(0) - y) * MM_PER_PX / 5) * 5; draw(); });
const end = () => { if (drag >= 0) drawAll(); drag = -1; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
window.addEventListener('resize', draw);
lists(); draw(); drawAll();
