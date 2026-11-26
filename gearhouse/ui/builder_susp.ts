// The builder's ③ 서스펜션 step's small graphs (docs/systems/102, M4 ⑥): from the design's own linkage, as the physics
// reads it (race/kin.ts): each axle's camber through the wheel's travel, its roll centre's height as the body rises and
// falls (and how far across it goes in a roll), the wheels' natural frequencies on their springs, the side view's anti
// shares. Data from suspFigures (pure), drawn as inline SVG by the svg helpers; the page's colours from its tokens.
import type { Design } from '../core/design';
import { designSpec } from '../race/design';
import { kinRig, type KinRig } from '../race/kin';
import { lookup, rollCentre, TABLE_TRAVEL } from '../render/car/suspension/tables';

export interface SuspFigures {
  /** travel (mm) against camber (degrees, - the top in), front and rear */ camber: { f: [number, number][]; r: [number, number][] };
  /** heave (mm, both wheels up) against the roll centre's height (mm over the ground), front and rear */ rc: { f: [number, number][]; r: [number, number][] };
  /** the roll centre at the static ride (mm) and how far across it moves in a 2-degree roll (mm) */ rc0: { f: number; r: number }; rcShift: { f: number; r: number };
  /** the wheels' natural frequencies (Hz) and the camber gain at the static ride (degrees per 50 mm of bump) */ hz: { f: number; r: number }; gain: { f: number; r: number };
  /** the side view (%) */ anti: { dive: number; lift: number; squat: number };
  /** the bump steer over 50 mm (degrees of toe, + in) */ bumpToe: { f: number; r: number } }

/** the figures of a design's suspension; null for a car with no rig (a beam axle's stub at both ends) */
export function suspFigures(d: Design): SuspFigures | null {
  const s = designSpec(d); if (!s.kin) return null; const K: KinRig = kinRig(s.kin, s.cgH, s.wheelbase, s.tech?.drive?.front ?? 0), D = 180 / Math.PI;
  const ts: number[] = []; for (let t = TABLE_TRAVEL.from; t <= TABLE_TRAVEL.to; t += 10) ts.push(t);
  const cam = (A: KinRig['front']) => A.tables ? ts.map(t => [t, lookup(A.tables![0], A.tables![0].camber, t) * D] as [number, number]) : [];
  const rc = (A: KinRig['front']) => A.tables ? ts.map(t => [t, rollCentre(A.tables![0], A.tables![1], t, t).z] as [number, number]) : [];
  const half = (A: KinRig['front']) => A.tables ? A.tables[0].cpY : 700, shift = (A: KinRig['front']) => { if (!A.tables) return 0; const a = Math.tan(2 / D) * half(A); return rollCentre(A.tables[0], A.tables[1], a, -a).y; };
  const gain = (A: KinRig['front']) => A.tables ? (lookup(A.tables[0], A.tables[0].camber, 25) - lookup(A.tables[0], A.tables[0].camber, -25)) * D : 0;
  const toe = (A: KinRig['front']) => A.tables ? (lookup(A.tables[0], A.tables[0].toe, 25) - lookup(A.tables[0], A.tables[0].toe, -25)) * D : 0;
  return { camber: { f: cam(K.front), r: cam(K.rear) }, rc: { f: rc(K.front), r: rc(K.rear) }, rc0: { f: K.rc.front, r: K.rc.rear }, rcShift: { f: shift(K.front), r: shift(K.rear) },
    hz: { f: d.susp.front.hz, r: d.susp.rear.hz }, gain: { f: gain(K.front), r: gain(K.rear) }, anti: K.anti, bumpToe: { f: toe(K.front), r: toe(K.rear) } }; }

const fmt = (v: number, n = 0) => (Math.abs(v) < 0.5 * 10 ** -n ? 0 : v).toFixed(n);
/** a small line graph: series of points (front solid, rear dashed), the x and y ranges, the axes' labels */
export function lineSvg(title: string, series: { name: string; pts: [number, number][]; dash?: boolean }[], x: [number, number], y: [number, number], xl: string, yl: string): string {
  const W = 280, H = 126, L = 34, R = 8, T = 16, B = 22, px = (v: number) => L + (v - x[0]) / (x[1] - x[0]) * (W - L - R), py = (v: number) => T + (1 - (Math.max(y[0], Math.min(y[1], v)) - y[0]) / (y[1] - y[0])) * (H - T - B);
  const grid = [y[0], (y[0] + y[1]) / 2, y[1]].map(v => `<line x1="${L}" x2="${W - R}" y1="${py(v)}" y2="${py(v)}" class="g"/><text x="${L - 4}" y="${py(v) + 3}" text-anchor="end">${fmt(v, Math.abs(y[1] - y[0]) < 8 ? 1 : 0)}</text>`).join('')
    + [x[0], 0, x[1]].map(v => `<line x1="${px(v)}" x2="${px(v)}" y1="${T}" y2="${H - B}" class="g"/><text x="${px(v)}" y="${H - B + 12}" text-anchor="middle">${fmt(v)}</text>`).join('');
  const lines = series.filter(s => s.pts.length).map((s, i) => `<polyline class="s${i}"${s.dash ? ' stroke-dasharray="5 3"' : ''} points="${s.pts.map(([a, b]) => `${px(a).toFixed(1)},${py(b).toFixed(1)}`).join(' ')}"/>`).join('');
  const key = series.map((s, i) => `<tspan class="k${i}">${s.dash ? '╌' : '━'} ${s.name}</tspan>`).join(' ');
  return `<figure class="graph"><figcaption>${title}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">${grid}${lines}<text x="${W - R}" y="10" text-anchor="end" class="key">${key}</text>`
    + `<text x="${(L + W - R) / 2}" y="${H - 2}" text-anchor="middle" class="ax">${xl}</text><text x="4" y="10" class="ax">${yl}</text></svg></figure>`; }
/** the wheels' frequencies as two bars on a 0.8..2.8 Hz scale, the old physics' 1.35 / 1.5 marked */
export function hzSvg(f: number, r: number): string {
  const W = 280, H = 62, L = 34, R = 8, px = (v: number) => L + (v - 0.8) / 2 * (W - L - R);
  const bar = (v: number, yy: number, name: string, i: number) => `<text x="${L - 4}" y="${yy + 9}" text-anchor="end">${name}</text><rect class="b${i}" x="${L}" y="${yy}" width="${Math.max(1, px(v) - L)}" height="12" rx="2"/><text x="${px(v) + 4}" y="${yy + 10}">${v.toFixed(2)} Hz</text>`;
  const ticks = [1, 1.5, 2, 2.5].map(v => `<line x1="${px(v)}" x2="${px(v)}" y1="4" y2="${H - 16}" class="g"/><text x="${px(v)}" y="${H - 4}" text-anchor="middle">${v}</text>`).join('');
  return `<figure class="graph"><figcaption>바퀴 고유 진동수</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="바퀴 고유 진동수 앞 ${f.toFixed(2)} Hz, 뒤 ${r.toFixed(2)} Hz">${ticks}${bar(f, 6, '앞', 0)}${bar(r, 24, '뒤', 1)}</svg></figure>`; }
/** the step's graphs and figures as the page shows them */
export function suspPanel(F: SuspFigures | null): string {
  if (!F) return '<p class="note">이 차의 서스펜션은 아직 기구학 표가 없습니다.</p>';
  const camY: [number, number] = [Math.min(-4, ...F.camber.f.map(p => p[1]), ...F.camber.r.map(p => p[1])), Math.max(3, ...F.camber.f.map(p => p[1]), ...F.camber.r.map(p => p[1]))].map(v => Math.round(v)) as [number, number];
  const rcY: [number, number] = [Math.min(-50, ...F.rc.f.map(p => p[1]), ...F.rc.r.map(p => p[1])), Math.max(250, ...F.rc.f.map(p => p[1]), ...F.rc.r.map(p => p[1]))].map(v => Math.round(v / 50) * 50) as [number, number];
  const d = (v: number, n = 1) => `${v > 0 ? '+' : ''}${fmt(v, n)}`;
  return lineSvg('캠버 (바퀴 높이에 따라)', [{ name: '앞', pts: F.camber.f }, { name: '뒤', pts: F.camber.r, dash: true }], [TABLE_TRAVEL.from, TABLE_TRAVEL.to], camY, '바퀴 높이 mm (+ 범프)', '°')
    + lineSvg('롤 센터 높이 (차체가 오르내릴 때)', [{ name: '앞', pts: F.rc.f }, { name: '뒤', pts: F.rc.r, dash: true }], [TABLE_TRAVEL.from, TABLE_TRAVEL.to], rcY, '범프 mm', 'mm')
    + hzSvg(F.hz.f, F.hz.r)
    + `<dl class="suspfig"><dt>롤 센터 (정지)</dt><dd>앞 ${fmt(F.rc0.f)} · 뒤 ${fmt(F.rc0.r)} <small>mm</small></dd>`
    + `<dt>2° 롤 때 옆 이동</dt><dd>앞 ${fmt(Math.abs(F.rcShift.f))} · 뒤 ${fmt(Math.abs(F.rcShift.r))} <small>mm</small></dd>`
    + `<dt>캠버 변화 (50 mm 범프)</dt><dd>앞 ${d(F.gain.f)} · 뒤 ${d(F.gain.r)} <small>°</small></dd>`
    + `<dt>범프 스티어 (50 mm)</dt><dd>앞 ${d(F.bumpToe.f, 2)} · 뒤 ${d(F.bumpToe.r, 2)} <small>° 토인</small></dd>`
    + `<dt>앤티다이브 · 앤티스쿼트</dt><dd>${fmt(F.anti.dive)} · ${fmt(F.anti.squat)} <small>%</small></dd></dl>`; }
