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
export interface BtnOpts { kind?: BtnKind; title?: string; id?: string; sub?: string; disabled?: boolean; icon?: IconName }
export function button(label: string, onClick: () => void, o: BtnOpts = {}): HTMLButtonElement {
  const b = el('button', `gh-btn${o.kind ? ` gh-${o.kind}` : ''} gk-btn ${KIND_ROLE[o.kind ?? '']}`); b.type = 'button'; if (o.id) b.id = o.id; if (o.title) b.title = o.title; b.disabled = !!o.disabled;
  if (o.icon) b.append(svgOf(icon(o.icon)));
  if (o.sub) b.append(el('span', 'gh-btn-ts', el('span', 'gh-btn-t', label), el('small', 'gh-btn-s', o.sub))); else if (o.icon) b.append(el('span', '', label)); else b.textContent = label;
  pressable(b); b.addEventListener('click', () => onClick()); return b; }

// ---- tabs: one panel shown at a time ----
export function tabs(items: [string, string, HTMLElement][], first = items[0]?.[0]): { el: HTMLElement; select(id: string): void } {
  const bar = el('div', 'gh-tabs'), box = el('div', 'gh-tabpanes'), btns = new Map<string, HTMLButtonElement>(); bar.setAttribute('role', 'tablist');
  const select = (id: string) => { for (const [k, b] of btns) b.setAttribute('aria-selected', String(k === id)); for (const [k, , p] of items) p.hidden = k !== id; };
  for (const [id, name, pane] of items) { const b = el('button', 'gh-tab', name); b.type = 'button'; b.setAttribute('role', 'tab'); b.addEventListener('click', () => { blip('move'); select(id); }); btns.set(id, b); bar.append(b); pane.classList.add('gh-pane'); pane.setAttribute('role', 'tabpanel'); box.append(pane); }
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

/** a car's side seen small (a placeholder until the garage's own pictures, U3): its paint, its base's line */
export function carPic(paint: string, base: string): HTMLElement {
  const long = base === 'f355' ? 0 : base === 'eb110' ? 6 : 3, s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 200 80'); s.setAttribute('aria-hidden', 'true'); s.classList.add('gh-carpic');
  s.innerHTML = `<ellipse cx="100" cy="66" rx="88" ry="6" fill="rgba(0,0,0,0.25)"/>`
    + `<path d="M${14 - long} 56 C${14 - long} 46 22 42 40 40 L${66 - long} 36 C78 24 96 20 116 21 C134 22 146 30 158 38 L${178 + long} 42 C${188 + long} 44 ${190 + long} 50 ${189 + long} 57 L${14 - long} 58 Z" fill="${paint}" stroke="rgba(0,0,0,0.45)" stroke-width="1.2"/>`
    + `<path d="M76 37 C86 27 100 24 114 25 C128 26 138 31 146 38 Z" fill="rgba(30,40,50,0.75)"/>`
    + `<circle cx="${50 - long / 2}" cy="57" r="11" fill="#1d1c1a"/><circle cx="${50 - long / 2}" cy="57" r="5.5" fill="#9aa1a6"/><circle cx="${154 + long / 2}" cy="57" r="11.5" fill="#1d1c1a"/><circle cx="${154 + long / 2}" cy="57" r="5.8" fill="#9aa1a6"/>`;
  return s as unknown as HTMLElement; }

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
