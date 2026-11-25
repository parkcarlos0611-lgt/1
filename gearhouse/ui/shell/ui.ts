// The game page's own parts (docs/systems/101 3-2, 공통 디자인 체계): buttons, tabs, sliders, switches, chips, cards, a
// dialog and a toast, all drawn by the page's tokens (ui/shell/game.page.html: the builder's palette, Oswald and Noto Sans
// KR, light and dark); the menus walked with the arrow keys (and a pad's cross, where one is held); short sounds for the
// menus, off unless the settings turn them on. Every class here starts 'gh-' so the builder's and the drive's own
// styles (they come on with their screens) never meet these.

type Kids = (Node | string | null | undefined | false)[];
/** an element with its class and children */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...kids: Kids): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (cls) e.className = cls; for (const k of kids) if (k) e.append(k); return e; }

// ---- the menus' sounds: the design system's (ui/kit/sound.ts), off unless the settings turn them on ----
import { blip, uiSounds } from '../kit/sound';
import { icon, type IconName } from '../kit/icons';
import { pressable, slideIn } from '../kit/parts';
import { moneyText } from '../kit/logic';
export { blip, uiSounds };
const svgOf = (s: string): Element => { const t = document.createElement('template'); t.innerHTML = s; return t.content.firstElementChild!; };

// ---- buttons ----
// the design system's buttons (docs/systems/110 G2, ui/kit): the kind sets the role colour. main yellow (the main
// action), ok green (confirm), alt blue (secondary, also the default), watch orange, danger red, ghost dark, menu the
// big yellow menu button
export type BtnKind = 'main' | 'ok' | 'alt' | 'watch' | 'ghost' | 'danger' | 'menu';
const KIND_ROLE: Record<BtnKind | '', string> = { main: 'gk-y', ok: 'gk-g', alt: 'gk-b', watch: 'gk-o', ghost: 'gk-dark', danger: 'gk-r', menu: 'gk-y gk-big', '': 'gk-b' };
/** big: a menu-sized button in its kind's colour (docs/systems/110 G4); tilt: slanted as the title's menu; square: the
 *  icon alone (the label its accessible name and tip) */
export interface BtnOpts { kind?: BtnKind; title?: string; id?: string; sub?: string; disabled?: boolean; icon?: IconName; big?: boolean; tilt?: boolean; square?: boolean }
export function button(label: string, onClick: () => void, o: BtnOpts = {}): HTMLButtonElement {
  const b = el('button', `gh-btn${o.kind ? ` gh-${o.kind}` : ''}${o.big && o.kind !== 'menu' ? ' gh-menu gk-big' : ''} gk-btn ${KIND_ROLE[o.kind ?? '']}${o.tilt ? ' gk-tilt' : ''}${o.square ? ' gk-sq' : ''}`); b.type = 'button'; if (o.id) b.id = o.id; if (o.title) b.title = o.title; b.disabled = !!o.disabled;
  if (o.icon) b.append(svgOf(icon(o.icon)));
  if (o.square && o.icon) { b.setAttribute('aria-label', label); if (!o.title) b.title = label; }
  else if (o.sub) b.append(el('span', 'gh-btn-ts', el('span', 'gh-btn-t', label), el('small', 'gh-btn-s', o.sub))); else if (o.icon) b.append(el('span', '', label)); else b.textContent = label;
  pressable(b); b.addEventListener('click', () => onClick()); return b; }

// ---- tabs: one panel shown at a time ----
/** items: id, name, pane and, if given, the tab's icon */
export function tabs(items: [string, string, HTMLElement, IconName?][], first = items[0]?.[0]): { el: HTMLElement; select(id: string): void } {
  const bar = el('div', 'gh-tabs'), box = el('div', 'gh-tabpanes'), btns = new Map<string, HTMLButtonElement>(); bar.setAttribute('role', 'tablist');
  const select = (id: string) => { for (const [k, b] of btns) b.setAttribute('aria-selected', String(k === id)); for (const [k, , p] of items) p.hidden = k !== id; };
  for (const [id, name, pane, ic] of items) { const b = el('button', 'gh-tab', ...(ic ? [svgOf(icon(ic)), el('span', '', name)] : [name])); b.type = 'button'; b.setAttribute('role', 'tab'); b.addEventListener('click', () => { blip('move'); select(id); }); btns.set(id, b); bar.append(b); pane.classList.add('gh-pane'); pane.setAttribute('role', 'tabpanel'); box.append(pane); }
  if (first) select(first); return { el: el('div', 'gh-tabbox', bar, box), select }; }

// ---- a labelled row; a slider, a switch, chips (one of several), a select ----
export function row(label: string, control: HTMLElement, note?: string): HTMLElement {
  const r = el('div', 'gh-row'), l = el('span', 'gh-label', label); r.append(l, control); if (note) r.append(el('small', 'gh-note', note)); return r; }
export function slider(label: string, [a, b, step]: [number, number, number], value: number, onInput: (v: number) => void, show: (v: number) => string = v => String(v)): HTMLElement {
  const i = el('input', 'gh-slider'); i.type = 'range'; i.min = String(a); i.max = String(b); i.step = String(step); i.value = String(value); i.setAttribute('aria-label', label);
  const v = el('span', 'gh-val', show(value)); i.addEventListener('input', () => { v.textContent = show(+i.value); onInput(+i.value); });
  const r = row(label, i); r.querySelector('.gh-label')!.append(v); return r; }
export function toggle(label: string, value: boolean, onChange: (v: boolean) => void, note?: string): HTMLElement {
  const l = el('label', 'gh-switch'), i = el('input'); i.type = 'checkbox'; i.checked = value; i.addEventListener('change', () => { blip('move'); onChange(i.checked); });
  l.append(i, el('span', 'gh-knob'), el('span', 'gh-switch-t', label)); if (note) l.append(el('small', 'gh-note', note)); return l; }
export function chips<T extends string | number>(label: string, opts: [T, string][], value: T, onChange: (v: T) => void): HTMLElement & { set(v: T): void } {
  const box = el('div', 'gh-chips'); box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', label);
  const bs = opts.map(([v, t]) => { const b = el('button', 'gh-chip', t); b.type = 'button'; b.setAttribute('role', 'radio'); b.addEventListener('click', () => { blip('move'); set(v); onChange(v); }); box.append(b); return [v, b] as const; });
  const set = (v: T) => { for (const [k, b] of bs) b.setAttribute('aria-checked', String(k === v)); }; set(value);
  const r = row(label, box) as HTMLElement & { set(v: T): void }; r.set = set; return r; }

// ---- a card: a picture, a title, lines under it, buttons ----
export function card(o: { pic?: HTMLElement | null; title: string; tag?: string; lines?: (string | HTMLElement)[]; actions?: HTMLElement[]; onPick?: () => void; selected?: boolean }): HTMLElement {
  const c = el('article', `gh-card gk-panel${o.selected ? ' gh-on gk-sel' : ''}`); if (o.pic) c.append(el('div', 'gh-card-pic', o.pic));
  const h = el('h3', 'gh-card-t', o.title); if (o.tag) h.append(' ', el('span', 'gh-tag', o.tag)); const body = el('div', 'gh-card-b', h);
  for (const l of o.lines ?? []) body.append(typeof l === 'string' ? el('p', 'gh-card-l', l) : l); c.append(body);
  if (o.actions?.length) c.append(el('div', 'gh-card-a', ...o.actions));
  if (o.onPick) { c.tabIndex = 0; c.classList.add('gh-pick'); c.setAttribute('role', 'button'); c.addEventListener('click', e => { if ((e.target as HTMLElement).closest('button')) return; blip('ok'); o.onPick!(); });
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onPick!(); } }); }
  return c; }

// ---- a dialog: a question over the page, answered by one of its buttons (Esc: none) ----
const open: { box: HTMLElement; close: (v: string | null) => void }[] = [];
export function dialog(title: string, body: (string | HTMLElement)[], actions: [string, string, BtnOpts?][]): Promise<string | null> {
  return new Promise(res => { const was = document.activeElement as HTMLElement | null, shade = el('div', 'gh-shade'), box = el('div', 'gh-dialog gk-panel'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    const close = (v: string | null) => { const i = open.findIndex(d => d.box === box); if (i >= 0) open.splice(i, 1); shade.remove(); was?.focus?.(); res(v); };
    box.append(el('h2', 'gh-dialog-t gk-head', title), ...body.map(b => typeof b === 'string' ? el('p', 'gh-dialog-p', b) : b), el('div', 'gh-dialog-a', ...actions.map(([v, t, o]) => button(t, () => close(v), o))));
    shade.append(box); shade.addEventListener('click', e => { if (e.target === shade) close(null); }); document.getElementById('gh-app')!.append(shade); slideIn(box, 'pop'); open.push({ box, close });
    (box.querySelector<HTMLElement>('.gh-main, .gh-btn'))?.focus(); }); }
/** the top dialog closed as if Esc were pressed; false when none is open */
export function closeDialog(): boolean { const d = open[open.length - 1]; if (!d) return false; blip('back'); d.close(null); return true; }
export const dialogBox = (): HTMLElement | null => open[open.length - 1]?.box ?? null;

// ---- a toast: a line for a moment ----
let toastT = 0;
export function toast(text: string) { let t = document.getElementById('gh-toast'); if (!t) { t = el('div', 'gh-toast'); t.id = 'gh-toast'; t.setAttribute('role', 'status'); document.getElementById('gh-app')!.append(t); }
  t.textContent = text; t.classList.add('gh-show'); clearTimeout(toastT); toastT = setTimeout(() => t!.classList.remove('gh-show'), 2600) as unknown as number; }

// ---- the menus walked by keys: the arrows move between the box's buttons and fields, Home and End to the ends ----
const FOCUSABLE = 'button:not([disabled]):not([hidden]), [tabindex="0"], input:not([disabled]), select:not([disabled]), a[href]';
export function focusables(box: ParentNode): HTMLElement[] { return Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(e => e.offsetParent !== null || e === document.activeElement); }
/** a key for the box: true when it moved the focus */
export function navKey(box: ParentNode, e: KeyboardEvent): boolean { const t = e.target as HTMLElement;
  // a slider, a select and a text field keep their own arrows (left and right on a slider; all on a text field)
  const own = t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && (t.type === 'text' || t.type === 'number' || (t.type === 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))));
  if (own) return false; const all = focusables(box); if (!all.length) return false; const i = all.indexOf(t);
  let j = -1; if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = i < 0 ? 0 : Math.min(all.length - 1, i + 1); else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = i < 0 ? 0 : Math.max(0, i - 1); else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = all.length - 1;
  if (j < 0) return false; if (j !== i) { all[j]!.focus(); all[j]!.scrollIntoView?.({ block: 'nearest' }); blip('move'); } return true; }

// ---- a pad's buttons as keys for the menus (where the browser has a pad and one is held): the cross, A, B ----
export function padKeys(send: (key: string) => void): void { if (!('getGamepads' in navigator)) return; let was: boolean[] = [];
  const MAP: Record<number, string> = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 0: 'Enter', 1: 'Escape', 9: 'Escape' };
  const poll = () => { const p = Array.from(navigator.getGamepads?.() ?? []).find(g => g?.connected); if (p) { const now = p.buttons.map(b => b.pressed); for (const k of Object.keys(MAP)) { const i = +k; if (now[i] && !was[i]) send(MAP[i]!); } was = now; }
    requestAnimationFrame(poll); };
  addEventListener('gamepadconnected', () => { was = []; }, { once: false }); requestAnimationFrame(poll); }

/** a car's side seen small, in the interface's cartoon manner (docs/systems/110 G4): a thick black outline, its paint
 *  over a darker lower band, the side glass with a glint, outlined wheels. The 959 (the model-built body) has its own
 *  line (the long low nose, the round roof, the deck rising to the looped wing); the old bases share a generic one.
 *  A placeholder until the garage's own rendered pictures. */
let picN = 0;
export function carPic(paint: string, base: string): HTMLElement {
  const K = '#111214', id = `ghcp${++picN}`, s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 200 80'); s.setAttribute('aria-hidden', 'true'); s.classList.add('gh-carpic');
  const p959 = base === 'p959', long = base === 'f355' ? 0 : base === 'eb110' ? 6 : 3;
  // nose to the right; the wheels' centres; the body, the side glass, the lamps
  const body = p959 ? 'M12 57 L11 45 C11 39 15 35 22 34 L40 33 C56 30 70 21 92 19.5 C106 19 117 22 129 32 C144 36 168 39 182 43 C190 45 193 50 192 57 Z'
    : `M${14 - long} 57 C${14 - long} 46 22 42 40 40 L${66 - long} 36 C78 24 96 20 116 21 C134 22 146 30 158 38 L${178 + long} 42 C${188 + long} 44 ${190 + long} 50 ${189 + long} 57 Z`;
  const glass = p959 ? 'M66 31 C78 24 94 22 106 22.5 C115 23 120 27 124 32 Z' : 'M76 37 C86 27 100 24 114 25 C128 26 138 31 146 38 Z';
  const [wr, wf] = p959 ? [46, 157] : [50 - long / 2, 154 + long / 2];
  const wheel = (x: number) => `<circle cx="${x}" cy="57" r="12.5" fill="#1b1c1f" stroke="${K}" stroke-width="3"/><circle cx="${x}" cy="57" r="6.8" fill="#c9ced4" stroke="${K}" stroke-width="2"/><circle cx="${x}" cy="57" r="2" fill="${K}"/>`;
  s.innerHTML = `<defs><clipPath id="${id}"><path d="${body}"/></clipPath></defs><ellipse cx="100" cy="69" rx="90" ry="5" fill="rgba(0,0,0,0.35)"/>`
    + `<path d="${body}" fill="${paint}"/><g clip-path="url(#${id})"><rect x="0" y="47" width="200" height="20" fill="rgba(0,0,0,0.28)"/><rect x="0" y="0" width="200" height="${p959 ? 29 : 31}" fill="rgba(255,255,255,0.14)"/></g>`
    + `<path d="${glass}" fill="#26323c" stroke="${K}" stroke-width="2" stroke-linejoin="round"/><path d="${p959 ? 'M84 30 L96 23.5 L101 23.5 L89 30 Z' : 'M96 36 L108 27 L113 27 L101 36 Z'}" fill="rgba(255,255,255,0.55)"/>`
    + (p959 ? `<path d="M100 31 L101 52" stroke="${K}" stroke-width="1.6" fill="none"/><path d="M13 34.5 L38 32.5" stroke="${K}" stroke-width="3.2" stroke-linecap="round"/><path d="M178 44 L189 47 L190 50 L180 48 Z" fill="#fff3c4" stroke="${K}" stroke-width="1.6" stroke-linejoin="round"/><rect x="11.5" y="40" width="4" height="6" fill="#e2352a" stroke="${K}" stroke-width="1.4"/>`
      : `<path d="M112 37 L113 52" stroke="${K}" stroke-width="1.6" fill="none"/>`)
    + `<path d="${body}" fill="none" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>` + wheel(wr) + wheel(wf);
  return s as unknown as HTMLElement; }

/** a group of a screen's fields (docs/systems/110 G4): a kit panel, its name on a band across its top with an icon */
export function group(title: string, ic: IconName, ...kids: (HTMLElement | null | false)[]): HTMLElement {
  return el('section', 'gh-group gk-panel', el('h3', 'gh-group-h', svgOf(icon(ic)), el('span', 'gk-head', title)), el('div', 'gh-form', ...kids)); }
/** a big card's head (docs/systems/110 G4: the pause, the results): the top band's two tones across the card, an icon,
 *  the title in large outlined type, the stripes running on, a line on the right */
export function cardHead(title: string, ic?: IconName, sub?: string): HTMLElement {
  return el('header', 'gh-cardhead', ...(ic ? [svgOf(icon(ic))] : []), el('h2', 'gh-cardhead-t gk-head', title), el('i', 'gh-sec-s'), sub ? el('span', 'gh-cardhead-s gk-head', sub) : null); }
/** a section's heading (docs/systems/110 G4): a tilted plate with an icon, the stripes running on after it */
export function secHead(title: string, ic?: IconName, right?: HTMLElement): HTMLElement {
  return el('div', 'gh-sec', el('h2', 'gh-sec-t', ...(ic ? [svgOf(icon(ic))] : []), el('span', 'gk-head', title)), el('i', 'gh-sec-s'), right ?? null); }

/** a text handed to the viewer as a file */
export function download(name: string, text: string, type = 'application/json') { const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type }));
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
/** a file chosen by the viewer, as text (null: none chosen) */
export function pickFile(accept = '.json,application/json'): Promise<string | null> { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
  i.addEventListener('change', () => { const f = i.files?.[0]; if (!f) { res(null); return; } void f.text().then(res, () => res(null)); }); i.click(); }); }
/** a chip of the top band (docs/systems/110 G2): an icon and a figure (the money, the slots) */
export function barChip(ic: IconName, text: string, label: string): HTMLElement { const c = el('span', 'gk-chip'); c.append(svgOf(icon(ic)), el('b', 'gk-num', text)); c.setAttribute('aria-label', label); c.title = label; return c; }
export const moneyChip = (v: number) => barChip('money', moneyText(v), `돈 ${moneyText(v)}`);
export const slotsChip = (used: number, of?: number) => barChip('wrench', of ? `${used}/${of}` : String(used), of ? `슬롯 ${used}/${of}` : `설계 ${used}개`);
/** a screen's bar, the design system's top band: back, its name, things on the right (chips, buttons) */
export function topbar(title: string, onBack: () => void, ...right: HTMLElement[]): HTMLElement {
  return el('header', 'gh-bar', button('뒤로', onBack, { kind: 'ghost', title: '뒤로 (Esc)', icon: 'back' }), el('h1', 'gh-bar-t gk-head', title), el('span', 'gh-grow'), ...right); }
