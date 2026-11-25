// The builder's pictures in the design system's cartoon manner (docs/systems/110 G4): the steps' rail icons (the kit's
// icons, plus a chassis frame drawn here) and the parts library's thumbnails for the model body's swaps (bumpers,
// lamps, wheels): a white or metal face, one accent, a thick black outline, as inline SVG text (no picture files).
import { INK, ROLE } from './kit/tokens';
import { icon, type IconName } from './kit/icons';
import type { StepId } from './builder_steps';

const K = INK, MET = ROLE.metal[0], DARK = ROLE.dark[0], st = (w = 3) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const r1 = (x: number) => Math.round(x * 10) / 10;
/** a thick line with a black rim */
const rim = (d: string, col: string, w: number) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 5}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const svg48 = (body: string) => `<svg class="gk-ic" viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
const svg64 = (body: string) => `<svg viewBox="0 0 64 48" aria-hidden="true">${body}</svg>`;

/** a chassis from above: two side rails, the cross members, the four wheels */
const chassis = () => svg48([[5, 5], [35, 5], [5, 31], [35, 31]].map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="12" rx="2" fill="${K}"/>`).join('')
  + rim('M17 4V44M31 4V44', MET, 4) + rim('M17 11H31M17 24H31M17 37H31', ROLE.yellow[0], 3.5) + rim('M13 11H17M31 11H35M13 37H17M31 37H35', MET, 2.5));
/** the steps' icons on the rail */
/** the glass step's icon: a windscreen and its side window over the body's roof line */
const glassIc = () => svg48(`<path d="M4 34C4 29 7 27 12 26L18 25C22 17 27 14 33 14C38 14 41.5 17 44 22C46 23 46 26 46 30V36H4Z" fill="${MET}" ${st()}/>`
  + `<path d="M20 25C23 19 27 17 31 17V25Z" fill="${ROLE.blue[0]}" ${st(2.5)}/><path d="M34 17C37.5 17.5 40 19.5 41.5 23L34 24Z" fill="${ROLE.blue[0]}" ${st(2.5)}/><path d="M23 22L26 19.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`);
const STEP_ICON: Record<StepId, IconName | 'chassis' | 'glass'> = { frame: 'body', glass: 'glass', parts: 'wheel', engine: 'engine', susp: 'suspension', kit: 'wrench', paint: 'spray', check: 'flag' };
/** the steps' short names on the rail (the full names stay in the step bar's line and the readers' labels) */
export const STEP_SHORT: Record<StepId, string> = { frame: '차체', glass: '창문', parts: '부품', engine: '엔진', susp: '서스', kit: '장비', paint: '칠', check: '검사' };
export const stepIcon = (id: StepId): string => { const n = STEP_ICON[id]; return n === 'chassis' ? chassis() : n === 'glass' ? glassIc() : icon(n); };

/** a model body's bumper seen head on (the rear one with its lamp band): `std` with corner vents, `aero` a deep lip
 *  and fins, `clean` the vents left out */
export function bumperPic(kind: 'std' | 'aero' | 'clean' | 'blank', rear = false): string {
  let b = `<path d="M4 32Q4 19 14 17H50Q60 19 60 32V38Q60 42 56 42H8Q4 42 4 38Z" fill="#fff" ${st()}/>`;
  if (kind === 'blank') return svg64(b + `<path d="M10 24H54" stroke="${K}" stroke-width="1.4" opacity="0.35"/>`);   // the lump's: all body colour, a faint seam
  if (rear) b += `<rect x="8" y="21" width="48" height="6" rx="2" fill="${ROLE.red[0]}" ${st(2.5)}/><rect x="24" y="30" width="16" height="7" rx="1" fill="${ROLE.yellow[0]}" ${st(2.2)}/>`;
  else b += `<rect x="21" y="29" width="22" height="7" rx="2" fill="${DARK}" ${st(2.5)}/><path d="M25 32.5H39" stroke="#6b7077" stroke-width="1.6"/>`;
  if (kind !== 'clean') b += [8, 50].map(x => `<rect x="${x}" y="${rear ? 31 : 29}" width="6" height="${kind === 'aero' ? 9 : 6}" rx="1.5" fill="${DARK}" ${st(2.2)}/>`).join('');
  if (kind === 'aero') b += `<path d="M3 41H61L57 46H7Z" fill="${DARK}" ${st(2.5)}/>` + [16, 26, 38, 48].map(x => `<path d="M${x} 41V46" ${st(2)}/>`).join('');
  return svg64(b); }
/** a model body's head lamp: one round lens, two projectors, or two square projectors in the housing */
export function lampPic(kind: 'round' | 'ellipsoid' | 'square' | 'none'): string {
  if (kind === 'none') return svg64(`<rect x="5" y="11" width="54" height="26" rx="7" fill="#fff" ${st()}/><path d="M16 18L48 30M48 18L16 30" stroke="${K}" stroke-width="1.6" opacity="0.3"/>`);   // no lamp: the socket flush, in body colour
  let b = `<rect x="5" y="11" width="54" height="26" rx="7" fill="${DARK}" ${st()}/>`;
  if (kind === 'round') b += `<circle cx="32" cy="24" r="10.5" fill="#fff" ${st()}/><circle cx="32" cy="24" r="6" fill="${ROLE.yellow[0]}" ${st(2)}/><path d="M27 19a7 7 0 0 1 5 -2" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  else if (kind === 'ellipsoid') b += [21, 43].map(x => `<circle cx="${x}" cy="24" r="8" fill="${MET}" ${st()}/><circle cx="${x}" cy="24" r="4" fill="#fff" ${st(2)}/>`).join('');
  else b += [14, 36].map(x => `<rect x="${x}" y="16" width="14" height="16" rx="2" fill="${MET}" ${st()}/><rect x="${x + 4}" y="20.5" width="6" height="7" rx="1" fill="#fff" ${st(1.8)}/>`).join('');
  return svg64(b); }
/** a model body's wheel: hollow five spokes, a deep dish of eight, a disc with five holes */
export function wheelPic(kind: 'hollow5' | 'dish' | 'hole5' | 'steel'): string {
  const c = (r: number, fill: string, w = 3) => `<circle cx="32" cy="24" r="${r}" fill="${fill}" ${st(w)}/>`, at = (i: number, n: number, r: number): [number, number] => { const t = i / n * Math.PI * 2; return [r1(32 + Math.sin(t) * r), r1(24 - Math.cos(t) * r)]; };
  let b = `<circle cx="32" cy="24" r="22" fill="${K}"/>`;
  if (kind === 'hollow5') { b += c(16, DARK); for (let i = 0; i < 5; i++) { const [x, y] = at(i, 5, 14); b += rim(`M32 24L${x} ${y}`, MET, 4.5); b += `<path d="M32 24L${x} ${y}" stroke="${DARK}" stroke-width="1.6"/>`; } b += c(4.5, '#fff', 2.5); }
  else if (kind === 'dish') { b += c(16, '#fff'); b += c(12, MET, 2); for (let i = 0; i < 8; i++) { const [x, y] = at(i, 8, 11); b += `<path d="M32 24L${x} ${y}" ${st(2.5)}/>`; } b += c(3.5, ROLE.yellow[0], 2); }
  else if (kind === 'steel') { b += c(16, '#8b9097'); b += c(10, '#a3a8ae', 2); for (let i = 0; i < 6; i++) { const [x, y] = at(i + 0.5, 6, 7.5); b += `<circle cx="${x}" cy="${y}" r="2" fill="${DARK}"/>`; } b += c(3.2, '#fff', 2); }
  else { b += c(16, '#fff'); for (let i = 0; i < 5; i++) { const [x, y] = at(i + 0.5, 5, 9.5); b += `<circle cx="${x}" cy="${y}" r="3.4" fill="${DARK}" ${st(2)}/>`; } b += c(4, MET, 2.2); }
  return svg64(b); }
/** a body base's card picture: the kit's body */
export const basePic = (): string => icon('body');
/** a free surface part's drawn card (docs/systems/115 P1), until its rendered picture comes: a mirror, a wing (ring or
 *  GT), one or two tips, the crest's shield, a marker, a vent or a louvre */
export function partPic(id: 'mirror' | 'wingRing' | 'wingGT' | 'exhaust1' | 'exhaust2' | 'badge' | 'marker' | 'vent' | 'louvre'): string {
  switch (id) {
    case 'mirror': return svg64(`<path d="M10 38L26 26" ${st(5)}/><path d="M22 14H50Q56 14 56 22V28Q56 34 50 34H26Q20 34 20 26V20Q20 14 22 14Z" fill="#fff" ${st()}/><path d="M27 19H49V29H27Z" fill="${MET}" ${st(2)}/>`);
    case 'wingRing': return svg64(`<path d="M6 40Q8 18 18 14H46Q56 18 58 40" fill="none" ${st(6)}/><path d="M6 40Q8 18 18 14H46Q56 18 58 40" fill="none" stroke="#fff" stroke-width="3"/>`);
    case 'wingGT': return svg64(`<rect x="6" y="12" width="52" height="7" rx="3" fill="#fff" ${st()}/><path d="M20 19V40M44 19V40" ${st(4)}/><path d="M5 9V24M59 9V24" ${st(4)}/>`);
    case 'exhaust1': return svg64(`<circle cx="32" cy="24" r="14" fill="${MET}" ${st()}/><circle cx="32" cy="24" r="9" fill="${DARK}" ${st(2)}/>`);
    case 'exhaust2': return svg64(`${[19, 45].map(x => `<circle cx="${x}" cy="24" r="11" fill="${MET}" ${st()}/><circle cx="${x}" cy="24" r="7" fill="${DARK}" ${st(2)}/>`).join('')}`);
    case 'badge': return svg64(`<path d="M20 8H44V26Q44 38 32 42Q20 38 20 26Z" fill="${ROLE.yellow[0]}" ${st()}/><path d="M25 16H39M32 16V34" stroke="${K}" stroke-width="2.5"/>`);
    case 'marker': return svg64(`<rect x="12" y="17" width="40" height="14" rx="7" fill="${ROLE.yellow[0]}" ${st()}/>`);
    case 'vent': return svg64(`<rect x="6" y="14" width="52" height="20" rx="7" fill="#fff" ${st()}/><rect x="12" y="19" width="40" height="10" rx="3" fill="${DARK}" ${st(2)}/>`);
    default: return svg64(`<rect x="8" y="8" width="48" height="32" rx="3" fill="${DARK}" ${st()}/>${[14, 20, 26, 32].map(y => `<path d="M12 ${y}H52" stroke="#9aa0a6" stroke-width="2.5"/>`).join('')}`); } }
