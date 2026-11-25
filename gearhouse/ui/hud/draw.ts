// The driving HUD's drawings (docs/systems/110 G3), made by rule as SVG text: no pictures are loaded. One cartoon
// manner for all of them (docs/systems/110 §2-2, §7): solid faces, a thick black outline, a slightly darker lower band
// (two tones), bold condensed italic figures with a black edge. Role colours: yellow the main control, green confirm or
// running, blue the secondary, grey locked. Each function returns an <svg> string; the parts that move carry a class
// (`plate`, `pbar`, `knob`, `nd`) that ui/hud/hud.ts turns or moves.
import type { GaugeFace, DialScale } from '../../render/car/interior/gauges';
import { dialAngle } from '../../render/car/interior/gauges';
import type { HudWheel } from './logic';

export const INK = '#111214';
/** the role colours: the face and its lower band */
export const ROLE = { yellow: ['#ffd21f', '#e7a700'], green: ['#46d36b', '#229b48'], blue: ['#3d9cff', '#1f6fd0'], grey: ['#c3c5c8', '#8f9296'], red: ['#ff5a3c', '#c8301c'],
  metal: ['#dfe3e8', '#a8aeb6'], dark: ['#3b3e44', '#26282c'] } as const;
const f1 = (x: number) => Math.round(x * 10) / 10;
let uid = 0;
/** a unique prefix for one drawing's clip paths (several drawings sit on one page) */
const nid = (p: string) => `${p}${++uid}`;
/** a shape in two tones: its face, the lower band clipped to it, then its outline over both */
function twoTone(id: string, shape: string, face: readonly [string, string], band: [number, number, number, number], line = 5): string {
  const [x, y, w, h] = band;
  return `<clipPath id="${id}">${shape}</clipPath>${shape.replace('/>', ` fill="${face[0]}"/>`)}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${face[1]}" clip-path="url(#${id})"/>${shape.replace('/>', ` fill="none" stroke="${INK}" stroke-width="${line}" stroke-linejoin="round"/>`)}`; }
/** bold condensed italic text with a black edge (the page's display face, Oswald) */
export const label = (t: string, x: number, y: number, size: number, fill = '#fff', edge = size * 0.22, anchor = 'middle'): string =>
  `<text x="${f1(x)}" y="${f1(y)}" font-size="${f1(size)}" fill="${fill}" stroke="${INK}" stroke-width="${f1(edge)}" paint-order="stroke" stroke-linejoin="round" text-anchor="${anchor}" dominant-baseline="central" class="hx">${t}</text>`;

// ---- the pedals: perforated racing plates over a dark well, a fill bar beside ----
/** a pedal: the accelerator's narrow plate (its bar on the right) or the brake's wide one (its bar on the left). The
 *  plate group (`plate`) is moved by its press (ui/hud/logic.ts pedalPress) about its foot at y 200 */
export function pedalSVG(kind: 'gas' | 'brake'): string {
  const wide = kind === 'brake', W = wide ? 150 : 118, bw = 16, pw = W - bw - 22, px = wide ? bw + 16 : 6, bx = wide ? 6 : px + pw + 8, id = nid('pd');
  const plate = `<rect x="${px}" y="10" width="${pw}" height="188" rx="14"/>`;
  // the holes: rows of round holes, a slot every third row (the plate's grip)
  const cols = wide ? 5 : 3, gx = pw / (cols + 0.6); let holes = '';
  for (let r = 0; r < 9; r++) { const y = 30 + r * 19; if (r % 3 === 1) { holes += `<rect x="${f1(px + gx * 0.55)}" y="${y - 3.5}" width="${f1(pw - gx * 1.1)}" height="7" rx="3.5" fill="#2a2d31"/>`; continue; }
    for (let c = 0; c < cols; c++) { const x = px + gx * (c + 0.8) + (r % 2 ? gx * 0.0 : 0); holes += `<circle cx="${f1(x)}" cy="${y}" r="5.2" fill="#2a2d31"/><path d="M${f1(x - 4.4)} ${y + 1.6}a4.6 4.6 0 0 0 8.8 0" fill="none" stroke="#f7f9fb" stroke-width="1.6"/>`; } }
  const fill = kind === 'gas' ? ROLE.green : ROLE.red;
  return `<svg viewBox="0 0 ${W} 220" class="hsvg pedalsvg" aria-hidden="true">`
    + `<rect x="${px + 3}" y="22" width="${pw - 6}" height="190" rx="12" fill="#16181b" stroke="${INK}" stroke-width="5"/>`   // the well under the plate
    + `<g class="plate">${twoTone(id, plate, ROLE.metal, [0, 150, W, 60])}<rect x="${px + 8}" y="16" width="${pw - 16}" height="6" rx="3" fill="#fff" opacity="0.55"/>${holes}</g>`
    + `<rect x="${bx}" y="10" width="${bw}" height="200" rx="7" fill="#1b1d20" stroke="${INK}" stroke-width="4"/>`
    + `<rect class="pbar" x="${bx + 3}" y="207" width="${bw - 6}" height="0" rx="4" fill="${fill[0]}"/>`
    + [0.25, 0.5, 0.75].map(t => `<rect x="${bx + 2}" y="${f1(207 - t * 194)}" width="${bw - 4}" height="1.6" fill="#fff" opacity="0.35"/>`).join('')
    + `</svg>`; }
/** a pedal's bar and plate set for its press: y the plate's sink (shares of its travel), k its foreshortening, bar the fill */
export function pedalPose(svg: SVGSVGElement, p: { y: number; k: number; bar: number }): void {
  const plate = svg.querySelector('.plate'), bar = svg.querySelector('.pbar');
  plate?.setAttribute('transform', `translate(0 ${f1(p.y * 16)}) translate(0 200) scale(1 ${p.k.toFixed(3)}) translate(0 -200)`);
  if (bar) { const h = p.bar * 194; bar.setAttribute('y', f1(207 - h).toString()); bar.setAttribute('height', f1(h).toString()); } }

// ---- the steering wheel: the interior's two, the drift car's dished three-spoke and the stock four-spoke ----
const arc = (r: number, a0: number, a1: number): string => { const p = (a: number) => `${f1(Math.sin(a * Math.PI / 180) * r)} ${f1(-Math.cos(a * Math.PI / 180) * r)}`;
  return `M${p(a0)}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${p(a1)}`; };
/** a wheel, its top at twelve; turned whole by its holder */
export function wheelSVG(style: HudWheel): string {
  const id = nid('wh'), R = 80;
  const rim = `<circle r="${R + 16}" fill="none" stroke="#fff" stroke-width="3" opacity="0.35"/><circle r="${R}" fill="none" stroke="${INK}" stroke-width="30"/>`   // a light halo: the black rim read on a dark road
    + `<circle r="${R}" fill="none" stroke="${style === 'drift' ? '#34353a' : '#232427'}" stroke-width="20"/>`
    + `<path d="${arc(R + 4, -100, 100)}" fill="none" stroke="${style === 'drift' ? '#55575e' : '#3e4045'}" stroke-width="7" stroke-linecap="round"/>`   // the upper tone
    + `<path d="${arc(R - 5, 110, 250)}" fill="none" stroke="#1a1b1e" stroke-width="6" stroke-linecap="round"/>`;
  if (style === 'drift') {
    // the dish: the spokes run in from the rim and down to a hub that sits deeper (a ring shows the step)
    const spoke = (a: number) => { const s = Math.sin(a * Math.PI / 180), c = -Math.cos(a * Math.PI / 180), n = [-c, s];
      const P = (r: number, w: number) => `${f1(s * r + n[0]! * w)} ${f1(c * r + n[1]! * w)}`;
      return `<path d="M${P(20, 13)}L${P(70, 10)}L${P(70, -10)}L${P(20, -13)}Z" fill="${ROLE.metal[1]}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>`
        + `<path d="M${P(24, 9)}L${P(66, 7)}" stroke="${ROLE.metal[0]}" stroke-width="4" stroke-linecap="round"/>`
        + `<circle cx="${f1(s * 36)}" cy="${f1(c * 36)}" r="4.2" fill="${INK}"/><circle cx="${f1(s * 52)}" cy="${f1(c * 52)}" r="3.6" fill="${INK}"/>`; };
    return `<svg viewBox="-104 -104 208 208" class="hsvg wheelsvg" aria-hidden="true">`
      + `<circle r="62" fill="rgba(0,0,0,0.28)"/><circle r="60" fill="none" stroke="rgba(0,0,0,0.55)" stroke-width="3" stroke-dasharray="4 6"/>`
      + rim + spoke(90) + spoke(270) + spoke(180)
      + `<path d="${arc(R, -9, 9)}" fill="none" stroke="${INK}" stroke-width="30"/><path d="${arc(R, -7, 7)}" fill="none" stroke="${ROLE.yellow[0]}" stroke-width="21"/>`   // the top band
      + `<circle r="25" fill="${INK}"/>${twoTone(id, '<circle r="18"/>', ROLE.yellow, [-20, 6, 40, 16], 4)}`
      + `<path d="M-8 -3l8 -6 8 6" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
  // stock: two spokes straight across, two down to the rim's lower quarters, a big pad
  const slab = (a: number, w: number) => { const s = Math.sin(a * Math.PI / 180), c = -Math.cos(a * Math.PI / 180), n = [-c, s];
    const P = (r: number, k: number) => `${f1(s * r + n[0]! * k)} ${f1(c * r + n[1]! * k)}`;
    return `<path d="M${P(30, w)}L${P(74, w * 0.8)}L${P(74, -w * 0.8)}L${P(30, -w)}Z" fill="#2c2d31" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>`; };
  return `<svg viewBox="-104 -104 208 208" class="hsvg wheelsvg" aria-hidden="true">` + rim + slab(95, 15) + slab(265, 15) + slab(145, 9) + slab(215, 9)
    + twoTone(id, '<rect x="-44" y="-30" width="88" height="62" rx="24"/>', ROLE.dark, [-50, 14, 100, 24], 5)
    + `<rect x="-14" y="-6" width="28" height="12" rx="4" fill="${ROLE.grey[1]}" stroke="${INK}" stroke-width="3"/>`
    + `<path d="${arc(R, -3, 3)}" fill="none" stroke="${ROLE.yellow[0]}" stroke-width="8"/></svg>`; }

// ---- the shifters ----
/** the gear lever in its gate: + at the top (pushed away: up a gear), − at the bottom; the knob (`knob`) slides, the
 *  gear written on it (`kg`) */
export function leverSVG(): string { const id = nid('lv');
  return `<svg viewBox="0 0 96 210" class="hsvg leversvg" aria-hidden="true">`
    + twoTone(id, '<rect x="8" y="6" width="80" height="198" rx="16"/>', ROLE.dark, [0, 150, 96, 60], 5)
    + `<rect x="40" y="30" width="16" height="150" rx="8" fill="#0b0c0d" stroke="#55585e" stroke-width="2"/>`
    + label('+', 22, 34, 26) + label('−', 22, 176, 26)
    + [62, 105, 148].map(y => `<rect x="62" y="${y - 1.5}" width="16" height="3" rx="1.5" fill="#6b6f76"/>`).join('')
    + `<g class="knob"><rect x="42" y="96" width="12" height="18" fill="#7d828a" stroke="${INK}" stroke-width="3"/>`
    + `<circle cx="48" cy="105" r="25" fill="${INK}"/><circle class="kf" cx="48" cy="105" r="21" fill="${ROLE.yellow[0]}"/>`
    + `<path class="kb" d="M27.5 110a21 21 0 0 0 41 0z" fill="${ROLE.yellow[1]}"/><ellipse cx="41" cy="95" rx="8" ry="4.5" fill="#fff" opacity="0.6"/>`
    + `<text class="kg hx" x="48" y="106" font-size="28" fill="#fff" stroke="${INK}" stroke-width="6" paint-order="stroke" stroke-linejoin="round" text-anchor="middle" dominant-baseline="central">1</text></g></svg>`; }
/** one paddle of the F1 box behind the wheel: the left takes a gear down (−), the right up (+) */
export function paddleSVG(side: 'L' | 'R'): string { const id = nid('pl'), m = side === 'L' ? 1 : -1, x = (v: number) => side === 'L' ? v : 100 - v;
  const blade = `<path d="M${x(92)} 18 C${x(40)} 8 ${x(8)} 40 ${x(8)} 72 C${x(8)} 104 ${x(40)} 132 ${x(92)} 122 Z"/>`;
  return `<svg viewBox="0 0 100 140" class="hsvg paddlesvg" aria-hidden="true">${twoTone(id, blade, ROLE.blue, [0, 96, 100, 50], 5)}`
    + `<path d="M${x(84)} 30 C${x(46)} 24 ${x(22)} 44 ${x(20)} 62" fill="none" stroke="#fff" stroke-width="4" opacity="0.5" stroke-linecap="round"/>`
    + label(side === 'L' ? '−' : '+', x(46) + m * 0, 72, 46) + `</svg>`; }

// ---- the handbrake: the drift car's upright lever, pulled toward the driver ----
/** the handle (`hb`) comes down and toward the eye as it is pulled; the brake lamp (`hl`) lights */
export function handbrakeSVG(): string { const id = nid('hb'), id2 = nid('hg');
  return `<svg viewBox="0 0 100 210" class="hsvg handsvg" aria-hidden="true">`
    + twoTone(id, '<rect x="10" y="148" width="80" height="56" rx="14"/>', ROLE.dark, [0, 184, 100, 30], 5)
    + `<g class="hl"><circle cx="50" cy="176" r="15" fill="#1a1b1e" stroke="${INK}" stroke-width="3"/><circle cx="50" cy="176" r="9.5" fill="none" stroke="#5a5d63" stroke-width="3"/>`
    + `<text x="50" y="177" font-size="13" fill="#5a5d63" text-anchor="middle" dominant-baseline="central" class="hx">!</text></g>`
    + `<g class="hb"><rect x="38" y="70" width="24" height="96" rx="7" fill="${ROLE.metal[1]}" stroke="${INK}" stroke-width="5"/><rect x="43" y="74" width="6" height="88" rx="3" fill="${ROLE.metal[0]}"/>`
    + twoTone(id2, '<rect x="20" y="10" width="60" height="80" rx="22"/>', ROLE.yellow, [0, 64, 100, 30], 5.5)
    + [28, 42, 56].map(y => `<rect x="28" y="${y}" width="44" height="5" rx="2.5" fill="${INK}" opacity="0.45"/>`).join('')
    + `<rect x="36" y="2" width="28" height="14" rx="7" fill="${ROLE.red[0]}" stroke="${INK}" stroke-width="4"/></g></svg>`; }

// ---- the start button ----
/** the round start button: yellow while the engine is off (the thing to press), orange while it cranks, green running;
 *  its face (`sf`) and lower band (`sb`) recoloured by ui/hud/hud.ts */
export function startSVG(): string {
  return `<svg viewBox="-52 -52 104 104" class="hsvg startsvg" aria-hidden="true"><circle r="49" fill="${INK}"/>`
    + `<circle r="43" fill="${ROLE.metal[0]}"/><path d="M-43 6a43 43 0 0 0 86 0z" fill="${ROLE.metal[1]}"/><circle r="34" fill="${INK}"/>`
    + `<circle class="sf" r="30" fill="${ROLE.yellow[0]}"/><path class="sb" d="M-30 8a30 30 0 0 0 60 0z" fill="${ROLE.yellow[1]}"/>`
    + `<ellipse cx="-9" cy="-17" rx="12" ry="5" fill="#fff" opacity="0.55"/>`
    + label('ENGINE', 0, -14, 10.5, '#fff', 3) + label('시동', 0, 4, 21, '#fff', 5) + label('START', 0, 22, 9.5, '#fff', 3) + `</svg>`; }

// ---- the tachometer: the cabin's own face (render/car/interior/gauges.ts), drawn again in the HUD's manner ----
const FR = 90;   // the face's radius in the drawing (the scales' 1)
/** a point on a scale's face: its pivot `c` (face units, up positive) and a clock angle (degrees) at radius r (face units) */
const pol = (c: [number, number], r: number, deg: number): [number, number] => { const a = deg * Math.PI / 180; return [(c[0] + Math.sin(a) * r) * FR, -(c[1] + Math.cos(a) * r) * FR]; };
const fig = (v: number) => Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(1).replace(/^0\./, '.');
function bandPath(s: DialScale, from: number, to: number, r: number): string { const [x0, y0] = pol(s.c, r, dialAngle(s, from)), [x1, y1] = pol(s.c, r, dialAngle(s, to)), a0 = dialAngle(s, from), a1 = dialAngle(s, to);
  return `M${f1(x0)} ${f1(y0)}A${f1(r * FR)} ${f1(r * FR)} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${f1(x1)} ${f1(y1)}`; }
function scaleSVG(s: DialScale): string { const sub = s.r < 0.5, maj = sub ? 0.08 : 0.12, min = maj * 0.55, eps = (s.max - s.min) * 1e-6; let o = '';
  if (s.red) o += `<path d="${bandPath(s, s.red[0], s.red[1], s.r - maj * 0.45)}" fill="none" stroke="${ROLE.red[0]}" stroke-width="${f1(maj * 0.9 * FR)}"/>`;
  if (s.minor) for (let v = s.min; v <= s.max + eps; v += s.minor) { const [ax, ay] = pol(s.c, s.r - min, dialAngle(s, v)), [bx, by] = pol(s.c, s.r, dialAngle(s, v)); o += `<path d="M${f1(ax)} ${f1(ay)}L${f1(bx)} ${f1(by)}" stroke="#fff" stroke-width="${sub ? 1.4 : 2}"/>`; }
  for (let v = s.min; v <= s.max + eps; v += s.major) { const [ax, ay] = pol(s.c, s.r - maj, dialAngle(s, v)), [bx, by] = pol(s.c, s.r, dialAngle(s, v)); o += `<path d="M${f1(ax)} ${f1(ay)}L${f1(bx)} ${f1(by)}" stroke="#fff" stroke-width="${sub ? 2.4 : 4}" stroke-linecap="round"/>`; }
  if (s.num) { const from = s.numFrom ?? s.min, h = sub ? 9 : 19; for (let v = from; v <= s.max + eps; v += s.num) { const [x, y] = pol(s.c, sub ? s.r + 0.13 : s.r - maj - 0.15, dialAngle(s, v));
      o += `<text x="${f1(x)}" y="${f1(y)}" font-size="${h}" fill="${s.red && v >= s.red[0] - eps ? ROLE.red[0] : '#fff'}" text-anchor="middle" dominant-baseline="central" class="hx">${fig(v / (s.div ?? 1))}</text>`; } }
  const [cx, cy] = [s.c[0] * FR, -s.c[1] * FR];
  if (sub) o += (s.unit ? `<text x="${f1(cx)}" y="${f1(cy - 0.15 * FR)}" font-size="8" fill="#cfd3d8" text-anchor="middle" dominant-baseline="central" class="hx">${s.unit}</text>` : '');
  else { if (s.label) o += `<text x="${f1(cx)}" y="${f1(cy - 0.34 * FR)}" font-size="9" fill="#cfd3d8" text-anchor="middle" dominant-baseline="central" class="hx">${s.label}</text>`;
    if (s.unit) o += `<text x="${f1(cx)}" y="${f1(cy - 0.22 * FR)}" font-size="8" fill="#cfd3d8" text-anchor="middle" dominant-baseline="central" class="hx">${s.unit}</text>`; }
  // the needle: built pointing at twelve about its pivot, turned to its clock angle by the HUD
  const L = (s.r - (sub ? 0.02 : 0.04)) * FR, w = sub ? 3 : 4.6;
  o += `<g class="nd" data-id="${s.id}" transform="translate(${f1(cx)} ${f1(cy)}) rotate(${f1(dialAngle(s, s.rest))})"><path d="M${-w} ${f1(L * 0.16)}L${-w * 0.35} ${f1(-L)}L${w * 0.35} ${f1(-L)}L${w} ${f1(L * 0.16)}Z" fill="#ff6a1a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g>`
    + `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${sub ? 5 : 10}" fill="${INK}" stroke="#55585e" stroke-width="2"/>`;
  return o; }
/** the tachometer from its face: its bezel (yellow, two tones), the black face, each scale's ticks, figures, red band and
 *  needle (`nd`, data-id the scale's), the warning lamps (`lp`) and the shift light (`sl`) */
export function tachSVG(face: GaugeFace): string { const id = nid('tc');
  return `<svg viewBox="-106 -106 212 212" class="hsvg tachsvg" aria-hidden="true">`
    + twoTone(id, '<circle r="102"/>', ROLE.yellow, [-110, 40, 220, 80], 6)
    + `<circle r="${FR + 3}" fill="${INK}"/><circle r="${FR}" fill="#17181b"/><path d="${arc(FR - 2, -120, 120)}" fill="none" stroke="#fff" stroke-width="2" opacity="0.08"/>`
    + `<g class="face">${face.scales.map(scaleSVG).join('')}</g>`
    + `<g class="lp"><circle cx="-36" cy="62" r="5.5" fill="#3a1410" stroke="${INK}" stroke-width="2"/><circle cx="36" cy="62" r="5.5" fill="#3a2a0c" stroke="${INK}" stroke-width="2"/></g>`
    + `<circle class="sl" cx="0" cy="-${FR + 9}" r="7" fill="#2a2b2e" stroke="${INK}" stroke-width="3"/></svg>`; }
