// The icon set (docs/systems/110 G2): simple pictures in the interface's cartoon manner, read without words: a solid
// face (white by default), one accent colour, a thick black outline with round joins, drawn on a 48-unit square as
// inline SVG text (no picture files). icon(name) gives an <svg class="gk-ic">; its colours can be changed per use.
import { INK, ROLE } from './tokens';

export const ICON_NAMES = ['engine', 'steering', 'wheel', 'suspension', 'spray', 'wrench', 'gearbox', 'turbo', 'body', 'interior', 'settings', 'back', 'trophy', 'flag', 'money', 'lock', 'play', 'info'] as const;
export type IconName = typeof ICON_NAMES[number];
/** the icons' names in Korean (the style sheet's captions, the buttons' accessible names) */
export const ICON_KO: Record<IconName, string> = { engine: '엔진', steering: '핸들', wheel: '휠', suspension: '서스펜션', spray: '스프레이·칠', wrench: '렌치', gearbox: '변속기', turbo: '터보', body: '차체',
  interior: '실내', settings: '설정', back: '뒤로', trophy: '트로피', flag: '깃발', money: '돈', lock: '잠김', play: '시작', info: '정보' };

const K = INK, MET = ROLE.metal[0];
const st = (w = 3) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
/** a thick line with a black rim: the rim drawn wide, the colour over it */
const rimLine = (d: string, col: string, w: number) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 5}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const r1 = (x: number) => Math.round(x * 10) / 10;
let uid = 0;

/** the default accent of each icon (its face is white unless asked) */
const ACCENT: Record<IconName, string> = { engine: ROLE.yellow[0], steering: ROLE.yellow[0], wheel: ROLE.yellow[0], suspension: ROLE.yellow[0], spray: ROLE.red[0], wrench: ROLE.yellow[0], gearbox: ROLE.yellow[0],
  turbo: ROLE.orange[0], body: ROLE.blue[0], interior: ROLE.red[0], settings: ROLE.grey[0], back: ROLE.yellow[0], trophy: ROLE.yellow[0], flag: ROLE.yellow[0], money: ROLE.yellow[0], lock: ROLE.yellow[0], play: ROLE.yellow[0], info: ROLE.blue[0] };

function cog(): string { let d = ''; const n = 8;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, p = (r: number, da: number) => `${r1(24 + Math.sin(a + da) * r)} ${r1(24 - Math.cos(a + da) * r)}`, t = 0.17, b = 0.27;
    d += `${i ? 'L' : 'M'}${p(14.5, -b)}L${p(20.5, -t)}L${p(20.5, t)}L${p(14.5, b)}`; }
  return d + 'Z'; }

const DRAW: Record<IconName, (f: string, a: string) => string> = {
  engine: (f, a) => `<rect x="20" y="4" width="8" height="6" rx="1.5" fill="${a}" ${st(2.5)}/>`
    + `<path d="M5 21h4v-4h6v-4h4v-3h10v3h3v4h4l3 4h4v-4h3v18h-3v-4h-4l-4 6H15l-4-4H9v4H5Z" fill="${f}" ${st()}/><path d="M18 24h14M18 30h14" ${st()}/>`,
  steering: (f, a) => rimLine('M7.5 25H40.5M24 25V41', f, 5)
    + `<circle cx="24" cy="24" r="17" fill="none" stroke="${K}" stroke-width="10"/><circle cx="24" cy="24" r="17" fill="none" stroke="${f}" stroke-width="4.5"/>`
    + `<rect x="21" y="3.5" width="6" height="6.5" rx="1" fill="${a}" ${st(2.5)}/><circle cx="24" cy="25" r="7" fill="${a}" ${st()}/>`,
  wheel: (f, a) => `<circle cx="24" cy="24" r="20.5" fill="${K}"/>` + Array.from({ length: 10 }, (_, i) => { const t = i / 10 * Math.PI * 2; return `<path d="M${r1(24 + Math.sin(t) * 15.5)} ${r1(24 - Math.cos(t) * 15.5)}L${r1(24 + Math.sin(t) * 19)} ${r1(24 - Math.cos(t) * 19)}" stroke="#4a4e55" stroke-width="3" stroke-linecap="round"/>`; }).join('')
    + `<circle cx="24" cy="24" r="12.5" fill="${f}" ${st()}/>` + Array.from({ length: 5 }, (_, i) => { const t = i / 5 * Math.PI * 2; return `<circle cx="${r1(24 + Math.sin(t) * 7.5)}" cy="${r1(24 - Math.cos(t) * 7.5)}" r="2.6" fill="${K}"/>`; }).join('')
    + `<circle cx="24" cy="24" r="3.2" fill="${a}" ${st(2)}/>`,
  suspension: (f, a) => `<circle cx="24" cy="42" r="4" fill="${f}" ${st(2.5)}/><rect x="21" y="8" width="6" height="16" fill="${MET}" ${st(2.5)}/><rect x="17.5" y="22" width="13" height="17" rx="2" fill="${f}" ${st()}/>`
    + rimLine('M14 13L34 17L14 21L34 25L14 29L34 33', a, 4) + `<rect x="11" y="4" width="26" height="7" rx="2" fill="${f}" ${st()}/>`,
  spray: (f, a) => [[31.5, 8, 1.8], [36.5, 4.5, 2], [37.5, 11, 2], [43, 7.5, 2.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${a}" ${st(1.6)}/>`).join('')
    + `<rect x="20" y="6" width="7" height="6" rx="1" fill="${f}" ${st(2.5)}/><path d="M13 19Q13 11.5 23.5 11.5Q34 11.5 34 19Z" fill="${a}" ${st()}/>`
    + `<rect x="12" y="18" width="23" height="26" rx="3" fill="${f}" ${st()}/><rect x="12" y="25" width="23" height="10" fill="${a}" ${st()}/>`,
  wrench: f => `<g transform="rotate(45 24 24)"><path d="M20 44L20 19.5A10 10 0 0 1 20.5 1.6L20.5 10L27.5 10L27.5 1.6A10 10 0 0 1 28 19.5L28 44A4 4 0 0 1 20 44Z" fill="${f}" ${st()}/><circle cx="24" cy="39" r="2.2" fill="${K}"/></g>`,
  gearbox: (f, a) => rimLine('M13 12V36M24 12V36M35 12V36M13 24H35', f, 4.5)
    + [[13, 12], [24, 12], [13, 36], [24, 36], [35, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${f}" ${st(2.5)}/>`).join('') + `<circle cx="35" cy="12" r="7" fill="${a}" ${st()}/><path d="M32 9.5a4 4 0 0 1 4 -1.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8"/>`,
  turbo: (f, a) => `<rect x="25" y="7" width="18" height="11" rx="2" fill="${f}" ${st()}/><path d="M38 7v11" ${st(2.5)}/><circle cx="21" cy="28" r="16" fill="${f}" ${st()}/><circle cx="21" cy="28" r="9.5" fill="${a}" ${st(2.5)}/>`
    + Array.from({ length: 6 }, (_, i) => { const t = i / 6 * Math.PI * 2; return `<path d="M${r1(21 + Math.sin(t) * 2.5)} ${r1(28 - Math.cos(t) * 2.5)}Q${r1(21 + Math.sin(t + 0.5) * 6)} ${r1(28 - Math.cos(t + 0.5) * 6)} ${r1(21 + Math.sin(t + 0.9) * 8.5)} ${r1(28 - Math.cos(t + 0.9) * 8.5)}" fill="none" stroke="${K}" stroke-width="2" stroke-linecap="round"/>`; }).join('')
    + `<circle cx="21" cy="28" r="2.6" fill="${K}"/>`,
  body: (f, a) => `<path d="M3.5 32C3.5 27 6 25 11 24L17 23C21 16 26 13.5 32 13.5C37 13.5 40.5 16.5 43 21.5C45.5 22.5 46 25.5 46 29V34H3.5Z" fill="${f}" ${st()}/>`
    + `<path d="M20.5 22.5C23.5 18 27.5 16.5 31.5 16.5C35 16.5 37.5 18.5 39.5 22.5Z" fill="${a}" ${st(2.5)}/>`
    + [13.5, 36].map(x => `<circle cx="${x}" cy="34" r="6.5" fill="${K}"/><circle cx="${x}" cy="34" r="2.8" fill="${MET}"/>`).join(''),
  interior: (f, a) => `<path d="M11 8C11 5 13 4 16 4H23C26 4 27.2 6 26.8 9L24.5 30H38C41 30 42.5 32 42.5 35V38C42.5 41 40.5 43 37.5 43H15C11 43 9 40.5 9.5 36.5Z" fill="${f}" ${st()}/>`
    + `<path d="M24.5 30H38C41 30 42.5 32 42.5 35V36H24Z" fill="${a}" ${st(2.5)}/><path d="M14.5 15.5H23.5L22.5 27H13.5Z" fill="${a}" ${st(2.5)}/><rect x="14.5" y="7.5" width="8" height="4" rx="2" fill="${K}"/>`,
  settings: f => `<path d="${cog()}" fill="${f}" ${st()}/><circle cx="24" cy="24" r="6" fill="${K}"/><circle cx="24" cy="24" r="10" fill="none" stroke="${K}" stroke-width="2" opacity="0.35"/>`,
  back: f => `<path d="M5 24L21 8V17H42V31H21V40Z" fill="${f}" ${st(3.2)}/>`,
  trophy: (f, a) => rimLine('M14 11H8C8 20 11 23.5 16 23.5M34 11H40C40 20 37 23.5 32 23.5', a, 3.5)
    + `<path d="M13 6H35V14C35 22 30 27.5 24 27.5C18 27.5 13 22 13 14Z" fill="${a}" ${st()}/><rect x="21" y="27" width="6" height="7.5" fill="${a}" ${st(2.5)}/>`
    + `<rect x="13.5" y="34" width="21" height="9" rx="1.5" fill="${ROLE.dark[0]}" ${st()}/><path d="M18 10.5V16" stroke="${f}" stroke-width="3" stroke-linecap="round" opacity="0.85"/>`,
  flag: f => { const id = `gkf${++uid}`, flag = 'M12 7C19 3.5 25 10.5 32 7C36 5.5 39 5.5 42 7V27C39 25.5 36 25.5 32 27C25 30.5 19 23.5 12 27Z';
    let sq = ''; for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) if ((r + c) % 2 === 0) sq += `<rect x="${12 + c * 6}" y="${3 + r * 6.4}" width="6" height="6.4" fill="${K}"/>`;
    return `<rect x="7.5" y="4" width="4.5" height="40" rx="2" fill="${MET}" ${st(2.5)}/><clipPath id="${id}"><path d="${flag}"/></clipPath><path d="${flag}" fill="${f}"/><g clip-path="url(#${id})">${sq}</g><path d="${flag}" fill="none" ${st()}/>`; },
  money: (f, a) => `<rect x="3.5" y="9" width="31" height="20" rx="2" fill="${ROLE.green[0]}" ${st()}/><rect x="7.5" y="13" width="23" height="12" rx="1" fill="none" stroke="${ROLE.green[1]}" stroke-width="2"/><circle cx="19" cy="19" r="4.5" fill="${f}" ${st(2.2)}/>`
    + `<circle cx="32" cy="31" r="12.5" fill="${a}" ${st()}/><circle cx="32" cy="31" r="8" fill="none" stroke="${ROLE.yellow[1]}" stroke-width="2.5"/>`
    + `<path d="M27.5 27L29.6 35L32 29.5L34.4 35L36.5 27M27 31.3H37" fill="none" stroke="${K}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  lock: (f, a) => rimLine('M15.5 22V15.5A8.5 8.5 0 0 1 32.5 15.5V22', MET, 4.5) + `<rect x="9.5" y="20.5" width="29" height="23" rx="3" fill="${a}" ${st()}/><path d="M9.5 37.5H38.5" stroke="${K}" stroke-width="1.6" opacity="0.3"/>`
    + `<circle cx="24" cy="30" r="3.4" fill="${K}"/><rect x="22.6" y="31" width="2.8" height="6.5" rx="1" fill="${K}"/>`,
  play: f => `<path d="M14 7L41 24L14 41Z" fill="${f}" ${st(3.4)}/>`,
  info: (f, a) => `<circle cx="24" cy="24" r="19" fill="${a}" ${st()}/><circle cx="24" cy="14" r="3.4" fill="${f}" ${st(2)}/><rect x="20.5" y="20" width="7" height="17" rx="1.5" fill="${f}" ${st(2)}/>`,
};

export interface IconOpts { face?: string; accent?: string; /** the size (CSS length) set on the svg; default the class's */ size?: string; /** an accessible name; none: hidden from readers */ title?: string; cls?: string }
/** an icon as SVG text */
export function icon(name: IconName, o: IconOpts = {}): string {
  const body = DRAW[name](o.face ?? '#fff', o.accent ?? ACCENT[name]), sz = o.size ? ` width="${o.size}" height="${o.size}"` : '';
  const a = o.title ? ` role="img" aria-label="${o.title}"` : ' aria-hidden="true"';
  return `<svg class="gk-ic${o.cls ? ` ${o.cls}` : ''}" viewBox="0 0 48 48"${sz}${a} data-icon="${name}">${body}</svg>`; }
/** an icon as an element */
export function iconEl(name: IconName, o: IconOpts = {}): SVGSVGElement {
  const t = document.createElement('template'); t.innerHTML = icon(name, o); return t.content.firstElementChild as SVGSVGElement; }
