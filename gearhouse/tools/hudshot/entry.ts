// The HUD's pictures without the 3D scene (docs/systems/110 G3): the drive page's markup and style with a plain painted
// backdrop (sky, road, a car's silhouette where the drive aims it), the HUD posed from a fixed state. Bundled and shot
// by tools/hudshot/shot.mjs. Query: left=1 (left-handed), shifter=buttons, f1=1 (paddles), off=1 (ignition off)
import { Hud } from '../../ui/hud/hud';
const q = new URLSearchParams(location.search), on = q.get('off') !== '1';
const hud = new Hud(document, { shift() { /* a picture */ } });
const cv = document.getElementById('view') as HTMLCanvasElement, W = innerWidth, H = innerHeight; cv.width = W; cv.height = H; cv.style.width = `${W}px`; cv.style.height = `${H}px`;
const g = cv.getContext('2d')!, sky = g.createLinearGradient(0, 0, 0, H * 0.45); sky.addColorStop(0, '#7fb6e8'); sky.addColorStop(1, '#cfe3f2'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
g.fillStyle = '#6f9a4e'; g.fillRect(0, H * 0.42, W, H); g.fillStyle = '#55585c'; g.beginPath(); g.moveTo(W * 0.42, H * 0.42); g.lineTo(W * 0.58, H * 0.42); g.lineTo(W * 1.1, H); g.lineTo(-W * 0.1, H); g.fill();
g.strokeStyle = '#e8e4d8'; g.lineWidth = 4; g.setLineDash([24, 22]); g.beginPath(); g.moveTo(W / 2, H * 0.43); g.lineTo(W / 2, H); g.stroke(); g.setLineDash([]);
// the car where the drive aims it (about 58 % down): a plain silhouette from behind
{ const cx = W / 2, cy = H * 0.58, w = Math.min(W, H) * 0.34, h = w * 0.42; g.fillStyle = '#1b1b1d'; g.fillRect(cx - w * 0.46, cy + h * 0.32, w * 0.16, h * 0.34); g.fillRect(cx + w * 0.3, cy + h * 0.32, w * 0.16, h * 0.34);
  g.fillStyle = '#d8d9dc'; g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.roundRect(cx - w / 2, cy - h * 0.1, w, h * 0.5, 10); g.fill(); g.stroke(); g.beginPath(); g.roundRect(cx - w * 0.32, cy - h * 0.55, w * 0.64, h * 0.5, 14); g.fill(); g.stroke();
  g.fillStyle = '#3c5468'; g.beginPath(); g.roundRect(cx - w * 0.26, cy - h * 0.47, w * 0.52, h * 0.34, 8); g.fill(); g.fillStyle = '#e0392b'; g.fillRect(cx - w * 0.45, cy + h * 0.02, w * 0.16, h * 0.1); g.fillRect(cx + w * 0.29, cy + h * 0.02, w * 0.16, h * 0.1); }
// the minimap: a plain loop and the car's dot
{ const m = (document.getElementById('mini') as HTMLCanvasElement).getContext('2d')!; m.lineJoin = 'round'; m.beginPath(); m.ellipse(75, 75, 55, 38, 0.3, 0, Math.PI * 2); m.strokeStyle = '#111'; m.lineWidth = 7; m.stroke(); m.strokeStyle = 'rgba(245,242,235,0.95)'; m.lineWidth = 3; m.stroke();
  m.fillStyle = '#ffb347'; m.beginPath(); m.arc(122, 82, 4, 0, Math.PI * 2); m.fill(); m.strokeStyle = '#000'; m.lineWidth = 1; m.stroke(); m.fillStyle = '#9fc3ff'; m.beginPath(); m.arc(40, 50, 3, 0, Math.PI * 2); m.fill(); }
const set = (id: string, h: string) => { const e = document.getElementById(id); if (e) e.innerHTML = h; };
set('lap', '<i>LAP</i><b>2/3 · 1:12.48</b>'); set('last', '<i>POS</i><b>2/4</b>'); document.getElementById('last')!.classList.add('pos'); set('best', '<i>BEST</i><b>1:31.07</b>'); set('where', 'Members\' 다리');
set('heat', '<span>물 86°</span><span>오일 94°</span><span>부스트 0.80 bar</span>');
if (q.get('touch') === '1') document.body.classList.add('touch');
hud.setPrefs({ left: q.get('left') === '1', shifter: q.get('shifter') === 'buttons' ? 'buttons' : 'lever', size: +(q.get('size') ?? 1), alpha: 0.92 });
hud.setCar({ gauges: { redline: 7300, topKmh: 317, boostBar: q.get('na') === '1' ? undefined : 1.0 }, wheel: q.get('stock') === '1' ? 'stock' : 'drift', gearbox: q.get('f1') === '1' ? 'f1' : 'manual' });
const f = { rpm: on ? 5600 : 0, kmh: on ? 142 : 0, boost: on ? 0.8 : 0, gear: 3, reverse: false, auto: false, phase: on ? 'running' as const : 'off' as const, on, sweep: 0, lamps: !on, gas: 0.7, brake: 0.25, hand: 0, wheelRad: -0.5 };
for (let i = 0; i < 21; i++) hud.frame(f);
document.getElementById('tw')?.style.setProperty('--a', '-28deg');
if (q.get('pull') === '1') document.getElementById('hhand')?.classList.add('pulled');
document.body.dataset.ready = '1';
