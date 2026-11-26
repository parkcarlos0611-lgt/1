// The design system's parts as elements (docs/systems/110 G2): a button by role (with its icon and its click), a panel,
// a stat bar that grows and shrinks with its figure, a tilted badge, a stripe band, the top band (back, title, money,
// slots), and the slide transitions. Their look is ui/kit/style.ts; the game shell's own parts (ui/shell/ui.ts) put the
// same classes on its buttons, panels and bars.
import { icon, type IconName } from './icons';
import { ROLE_KEY, type Role } from './tokens';
import { statShare, barDelta, tweenValue, statText, moneyText, type StatDef } from './logic';
import { blip } from './sound';

type Kid = Node | string | null | undefined | false;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...kids: Kid[]): HTMLElementTagNameMap[K] { const e = document.createElement(tag); if (cls) e.className = cls; for (const k of kids) if (k) e.append(k); return e; }
const svg = (s: string): SVGSVGElement => { const t = document.createElement('template'); t.innerHTML = s; return t.content.firstElementChild as SVGSVGElement; };
/** the role class of a role */
export const roleClass = (r: Role) => `gk-${ROLE_KEY[r]}`;

export interface KBtnOpts { role?: Role; icon?: IconName; big?: boolean; tilt?: boolean; square?: boolean; locked?: boolean; title?: string }
/** a chunky button: its role's colour, an icon before the words (alone when square), the click sound on press */
export function kbutton(label: string, onClick: () => void, o: KBtnOpts = {}): HTMLButtonElement {
  const b = el('button', ['gk-btn', roleClass(o.role ?? 'yellow'), o.big && 'gk-big', o.tilt && 'gk-tilt', o.square && 'gk-sq', o.locked && 'gk-locked'].filter(Boolean).join(' ')); b.type = 'button';
  if (o.icon) b.append(svg(icon(o.icon, o.locked ? { accent: '#c3c5c8' } : {}))); if (o.square) b.setAttribute('aria-label', label); else b.append(el('span', '', label));
  if (o.title) b.title = o.title; if (o.locked) b.setAttribute('aria-disabled', 'true');
  pressable(b); b.addEventListener('click', () => { if (!o.locked) onClick(); }); return b; }
/** the click sound as the button goes down (pointer or key) */
export function pressable(b: HTMLElement): void { b.addEventListener('pointerdown', () => blip('press')); b.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) blip('press'); }); }

/** a panel: cut corners, a thick outline, a face and its band; `kind` a well, the selected green, a yellow or blue face */
export function panel(kind: '' | 'well' | 'sel' | 'y' | 'b', ...kids: Kid[]): HTMLElement { return el('div', `gk-panel${kind ? ` gk-${kind}` : ''}`, ...kids); }

/** a stat bar: icon, name, the bar, the figure; set() moves it, the bar growing or shrinking to its new share (the part
 *  gained shown white for a moment, the part lost red) and the figure counting there */
export function statBar(s: StatDef, value: number): HTMLElement & { set(v: number): void; value: number } {
  const fill = el('i', 'gk-fill'), gain = el('i', 'gk-gain'), lost = el('i', 'gk-lost'), track = el('div', 'gk-track', lost, gain, fill), num = el('span', 'gk-stat-n gk-num');
  const row = el('div', `gk-stat ${roleClass(s.role)}`, svg(icon(s.icon as IconName)), el('span', 'gk-stat-l', s.name), track, num) as unknown as HTMLElement & { set(v: number): void; value: number };
  const write = (v: number) => { num.textContent = statText(v, s); num.append(el('small', '', s.unit)); };
  let shown = value, raf = 0; row.value = value; fill.style.setProperty('--k', String(statShare(value, s))); write(value); row.setAttribute('role', 'meter'); row.setAttribute('aria-label', s.name);
  row.set = (v: number) => { const from = statShare(row.value, s), to = statShare(v, s), d = barDelta(from, to), a = shown; row.value = v;
    for (const [e, w] of [[gain, d.gained], [lost, d.lost]] as const) { e.style.left = `${d.base * 100}%`; e.style.width = `${w * 100}%`; }
    track.classList.add('gk-ch'); requestAnimationFrame(() => requestAnimationFrame(() => track.classList.remove('gk-ch')));
    fill.style.setProperty('--k', String(to)); row.setAttribute('aria-valuenow', String(v));
    cancelAnimationFrame(raf); const t0 = performance.now(), T = 450, step = (t: number) => { const k = (t - t0) / T; shown = tweenValue(a, v, k); write(shown); if (k < 1) raf = requestAnimationFrame(step); else { shown = v; write(v); } }; raf = requestAnimationFrame(step); };
  return row; }

/** a tilted badge: NEW (red), BETA (green), LOCKED (grey, with the lock), HOT (orange) */
export function badge(kind: 'new' | 'beta' | 'lock' | 'hot', text?: string, pin = false): HTMLElement {
  const b = el('span', `gk-badge gk-${kind === 'lock' ? 'lockb' : kind}${pin ? ' gk-pin' : ''}`); if (kind === 'lock') b.append(svg(icon('lock', { accent: '#c3c5c8' })));
  b.append(text ?? ({ new: 'NEW', beta: 'BETA', lock: 'LOCKED', hot: 'HOT' })[kind]); return b; }
/** a diagonal stripe band */
export const stripes = (thin = false): HTMLElement => el('div', `gk-stripes${thin ? ' gk-thin' : ''}`);

/** the top band: a back button, the title, the money and the slots (either left out when not given), more on the right */
export function topBand(o: { title: string; onBack?: () => void; money?: number; slots?: [number, number]; right?: HTMLElement[] }): HTMLElement {
  const h = el('header', 'gk-top');
  if (o.onBack) h.append(kbutton('뒤로', o.onBack, { role: 'dark', icon: 'back', title: '뒤로 (Esc)' }));
  h.append(el('h1', 'gk-top-t gk-head', o.title));
  if (o.money !== undefined) { const c = el('span', 'gk-chip'); c.append(svg(icon('money')), el('b', 'gk-num', moneyText(o.money))); c.setAttribute('aria-label', `돈 ${moneyText(o.money)}`); h.append(c); }
  if (o.slots) { const c = el('span', 'gk-chip'); c.append(svg(icon('wrench')), el('b', 'gk-num', `${o.slots[0]}/${o.slots[1]}`)); c.setAttribute('aria-label', `슬롯 ${o.slots[0]}/${o.slots[1]}`); h.append(c); }
  for (const r of o.right ?? []) h.append(r);
  return el('div', 'gk-topwrap', h, stripes(true)); }

/** an element slid in from a side (or popped); the classes come off when it ends so it can slide again */
export function slideIn(e: HTMLElement, from: 'r' | 'l' | 'u' | 'd' | 'pop' = 'r'): void { const c = from === 'pop' ? 'gk-pop' : `gk-in-${from}`; e.classList.remove('gk-out-r', 'gk-out-l', c); void e.offsetWidth; e.classList.add(c);
  e.addEventListener('animationend', () => e.classList.remove(c), { once: true }); }
/** an element slid out to a side; resolves when it has gone (at once when motion is off) */
export function slideOut(e: HTMLElement, to: 'r' | 'l' = 'r'): Promise<void> { return new Promise(res => { const c = `gk-out-${to}`; e.classList.add(c);
  const anim = getComputedStyle(e).animationName; if (!anim || anim === 'none') { res(); return; } e.addEventListener('animationend', () => res(), { once: true }); setTimeout(res, 400); }); }
/** a group whose children come in one after another */
export function stagger(box: HTMLElement, from: 'r' | 'l' | 'u' = 'u'): void { Array.from(box.children).forEach((c, i) => { (c as HTMLElement).style.animationDelay = `${i * 35}ms`; slideIn(c as HTMLElement, from); }); }
