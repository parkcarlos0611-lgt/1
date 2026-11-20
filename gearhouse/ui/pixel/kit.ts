// The pixel interface's shared parts (review 27, roadmap step 1): one set of period-object widgets every screen uses.
// Immediate mode: a screen calls ui.button(...) and friends every frame; each call draws the widget, says whether it
// was clicked, and leaves its rectangle in a registry. The registry is what the UI check (tools/uicheck.mjs) reads to
// find text that runs over, widgets that overlap and touch targets that are too small.
import { Screen, hex, type RGB } from './screen';

export type Rect = { x: number; y: number; w: number; h: number };
export interface Rec { id: string; kind: string; x: number; y: number; w: number; h: number; tap: boolean; text?: string; textW?: number; over?: boolean }
export const BRASS = ['#4a3410', '#7a5a22', '#a37c34', '#c9a052', '#e4c47a', '#fbeab2'].map(hex);
export const COL = { wood: hex('#5a3b26'), wood2: hex('#4a2f1e'), wood3: hex('#6b4730'), ink: hex('#2b2620'), inkSoft: hex('#6b5d48'), ok: hex('#3f6e3a'), bad: hex('#a8402c'),
  card: hex('#f2ead2'), card2: hex('#e2d6b6'), shadow: hex('#2e1d12'), red: hex('#b8322a'), red2: hex('#d0614f'), lit: hex('#fff1c0'), well: hex('#1a120b'),
  enamel: hex('#5a1e1a'), enamel2: hex('#7a2a22'), cream: hex('#f4e7c4') };
export const mix = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
export const rnd = (i: number) => { let x = (i * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };
const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

// ---------------- layout: rectangles cut from rectangles, never hand-placed numbers ----------------
/** split a rectangle along x ('h') or y ('v'): numbers are pixels, '*' shares what is left equally */
export function split(r: Rect, spec: (number | '*')[], gap = 2, dir: 'h' | 'v' = 'h'): Rect[] {
  const total = dir === 'h' ? r.w : r.h, fixed = spec.reduce<number>((a, s) => a + (s === '*' ? 0 : s), 0) + gap * (spec.length - 1), stars = spec.filter(s => s === '*').length;
  const each = stars ? Math.floor((total - fixed) / stars) : 0; let at = dir === 'h' ? r.x : r.y;
  return spec.map(s => { const len = s === '*' ? each : s, out = dir === 'h' ? { x: at, y: r.y, w: len, h: r.h } : { x: r.x, y: at, w: r.w, h: len }; at += len + gap; return out; });
}
export const rows = (r: Rect, n: number, h: number, gap = 1): Rect[] => Array.from({ length: n }, (_, i) => ({ x: r.x, y: r.y + i * (h + gap), w: r.w, h }));
export const pad = (r: Rect, p: number, py = p): Rect => ({ x: r.x + p, y: r.y + py, w: r.w - 2 * p, h: r.h - 2 * py });

export class UI {
  recs: Rec[] = []; hover = ''; pressed = ''; focus: string | null = null; typed = '';
  private mx = -1; private my = -1; private click: { x: number; y: number } | null = null; private taken = false;
  private commit: ((v: string | null) => void) | null = null; private allow = /[^0-9-]/g;
  constructor(public S: Screen, private typer: HTMLInputElement | null = null) {
    const t = typer; if (!t) return;
    t.addEventListener('input', () => { this.typed = t.value.replace(this.allow, '').slice(0, 24); t.value = this.typed; });
    t.addEventListener('keydown', e => { if (e.key === 'Enter') { this.endTyping(true); e.preventDefault(); } else if (e.key === 'Escape') { this.endTyping(false); e.preventDefault(); } });
    t.addEventListener('blur', () => this.endTyping(true));
  }
  // ---- input, fed by the shell ----
  move(x: number, y: number) { this.mx = x; this.my = y; }
  down(x: number, y: number) { this.click = { x, y }; this.taken = false; this.isDown = true; }
  up() { this.pressed = ''; this.isDown = false; }
  isDown = false;
  /** where the pointer is and whether it is held (tools that are dragged: brushes, tape, spray) */
  pointer() { return { x: this.mx, y: this.my, down: this.isDown }; }
  /** whether a widget took this frame's click (a tool should not paint under a button) */
  get tookClick() { return this.taken; }
  get hoverAny() { return this.recs.some(r => r.tap && inside(r, this.mx, this.my)); }
  /** a click this frame that no widget took (the drawing board uses it to hurry the pencil) */
  missed(): boolean { return !!this.click && !this.taken; }
  begin() { this.recs = []; this.hover = ''; }
  end() { if (this.click && !this.taken && this.focus) this.endTyping(true); this.click = null; this.taken = false;
    (globalThis as { __ui?: Rec[] }).__ui = this.recs; }
  private hit(id: string, r: Rect, tap = true, kind = 'button', text?: string, textW?: number): boolean {
    this.recs.push({ id, kind, ...r, tap, text, textW, over: textW !== undefined && textW > r.w });
    if (inside(r, this.mx, this.my) && tap) this.hover = id;
    if (tap && this.click && !this.taken && inside(r, this.click.x, this.click.y)) { this.taken = true; this.pressed = id; return true; }
    return false; }
  // ---- typing through a hidden input (phones get their keyboard) ----
  startTyping(id: string, initial: string, commit: (v: string | null) => void, allow = /[^0-9-]/g) {
    this.endTyping(true); this.focus = id; this.typed = initial; this.commit = commit; this.allow = allow;
    if (this.typer) { this.typer.value = initial; this.typer.focus({ preventScroll: true }); this.typer.select(); } }
  endTyping(ok: boolean) { if (this.focus === null) return; const c = this.commit, v = this.typed; this.focus = null; this.commit = null; this.typer?.blur(); c?.(ok ? v : null); }
  key(e: KeyboardEvent): boolean { if (this.focus === null || this.typer) return false;   // no hidden input (tests): type into the field directly
    if (e.key === 'Enter') this.endTyping(true); else if (e.key === 'Escape') this.endTyping(false); else if (e.key === 'Backspace') this.typed = this.typed.slice(0, -1); else if (e.key.length === 1) this.typed = (this.typed + e.key).replace(this.allow, ''); return true; }

  // ---- materials ----
  panel(r: Rect, kind: 'plate' | 'card' | 'enamel' = 'plate') { const S = this.S, { x, y, w, h } = r;
    S.fill(x + 2, y + 2, w, h, COL.shadow);
    if (kind === 'card') { S.fill(x, y, w, h, COL.card); for (let i = 0; i < w; i++) if (rnd(i * 31 + y) < 0.3) S.px(x + i, y, COL.card2); }
    else if (kind === 'enamel') { S.fill(x, y, w, h, COL.enamel); S.hline(x, x + w - 1, y, COL.enamel2); for (let j = 1; j < h; j++) if (rnd(j * 7 + x) < 0.5) S.px(x + ((rnd(j) * w) | 0), y + j, COL.enamel2);
      S.hline(x + 2, x + w - 3, y + 2, BRASS[3]!); S.hline(x + 2, x + w - 3, y + h - 3, BRASS[1]!); S.vline(x + 2, y + 2, y + h - 3, BRASS[3]!); S.vline(x + w - 3, y + 2, y + h - 3, BRASS[1]!); }
    else { S.fill(x, y, w, h, COL.wood2); S.hline(x, x + w - 1, y, COL.wood3); for (const [sx, sy] of [[x + 2, y + h - 4], [x + w - 4, y + h - 4]] as const) { S.px(sx, sy, BRASS[4]!); S.px(sx + 1, sy + 1, BRASS[1]!); } }
    this.recs.push({ id: '', kind: 'panel:' + kind, ...r, tap: false }); }
  /** text in a box: left, centred or right; marks itself when it runs over */
  label(r: Rect, s: string, c: RGB = COL.ink, align: 'l' | 'c' | 'r' = 'l', id = '') { const tw = this.S.tw(s), x = align === 'l' ? r.x : align === 'c' ? r.x + ((r.w - tw) >> 1) : r.x + r.w - tw;
    this.S.text(s, x, r.y + ((r.h - 8) >> 1), c, Math.max(1, r.x + r.w - x)); this.recs.push({ id, kind: 'label', ...r, tap: false, text: s, textW: tw, over: tw > r.w }); }
  /** lines broken to the width; returns the lines (the check marks text that does not fit the height) */
  paragraph(r: Rect, s: string, c: RGB = COL.ink, lh = 10): number { const lines = this.wrap(s, r.w), n = Math.floor(r.h / lh);
    lines.slice(0, n).forEach((l, i) => this.S.text(l, r.x, r.y + i * lh, c)); this.recs.push({ id: '', kind: 'paragraph', ...r, tap: false, text: s, textW: lines.length > n ? r.w + 1 : 0, over: lines.length > n }); return lines.length; }
  wrap(s: string, w: number): string[] { const out: string[] = [];
    for (const para of s.split('\n')) { let line = ''; for (const word of para.split(' ')) { const t = line ? line + ' ' + word : word; if (this.S.tw(t) <= w) { line = t; continue; } if (line) out.push(line); line = word;
        while (this.S.tw(line) > w) { let k = line.length - 1; while (k > 1 && this.S.tw(line.slice(0, k)) > w) k--; out.push(line.slice(0, k)); line = line.slice(k); } } out.push(line); }
    return out; }

  /** a brass plate: rounded corners, lit from the top left, a polished streak, an engraved label. Held down (or the
   *  tab you are on) it sits in the panel: darker, lit from below, the letters bright */
  plate(r: Rect, label: string, hot: boolean, down: boolean, dim = false) { const S = this.S, R = BRASS, { x, y, w, h } = r, P = down ? 1 : 0;
    if (!down) S.fill(x + 1, y + 2, w, h - 1, COL.shadow);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const cx = Math.min(i, w - 1 - i), cy = Math.min(j, h - 1 - j); if (cx + cy < 2 && !(cx === 1 && cy === 1)) continue;
      const t = j / Math.max(1, h - 1); let k = down ? (t < 0.25 ? 0 : t < 0.6 ? 1 : 2) : t < 0.18 ? 4 : t < 0.55 ? 3 : t < 0.85 ? 2 : 1; if (hot && !down) k = Math.min(5, k + 1);
      if (!down && (i + j * 0.6) % 17 < 1.2 && t > 0.15 && t < 0.7) k = Math.min(5, k + 1);
      const edge = cx === 0 || cy === 0 || (cx + cy === 2 && cx === 1); if (edge) k = down ? (j > h / 2 ? 3 : 0) : (i < w / 2 && j < h / 2) ? 4 : 0; if (cx + cy === 2 && cx !== 1 && edge) k = 0;
      if (dim) k = Math.max(0, k - 2); S.px(x + i, y + j + P, R[k]!); }
    if (!down) S.px(x + 2, y + 2, R[5]!);
    const tw = S.tw(label), tx = x + ((w - tw) >> 1), ty = y + ((h - 8) >> 1) + P;
    if (down) S.text(label, tx, ty, COL.lit); else { S.text(label, tx, ty + 1, R[dim ? 2 : 4]!); S.text(label, tx, ty, R[0]!); } }

  // ---- widgets ----
  button(id: string, r: Rect, label: string, o: { down?: boolean; disabled?: boolean; mark?: boolean } = {}): boolean {
    const clicked = this.hit(id, r, true, 'button', label, this.S.tw(label) + 4) && !o.disabled;
    this.plate(r, label, this.hover === id && !o.disabled, !!o.down || (this.pressed === id && !o.disabled), o.disabled);
    if (o.mark) { const S = this.S; S.fill(r.x + r.w - 4, r.y + 3, 2, 2, COL.red); S.px(r.x + r.w - 4, r.y + 3, COL.red2); }      // a red pip: changed, not yet drawn in
    return clicked; }
  /** a tab: the one you are on stays pressed in; with `to` it opens into the card below like a folder tab */
  tab(id: string, r: Rect, label: string, on: boolean, to?: number, fill: RGB = COL.card): boolean {
    const c = this.hit(id, r, true, 'tab', label, this.S.tw(label) + 4); this.plate(r, label, this.hover === id && !on, on);
    if (on && to !== undefined) { this.S.fill(r.x + 1, r.y + r.h + 1, r.w - 2, to - r.y - r.h - 1, fill); this.S.vline(r.x, r.y + r.h, to, COL.shadow); }
    return c; }
  /** a figure in a dark window; click to type it */
  field(id: string, r: Rect, text: string, o: { changed?: boolean; onType?: (v: string | null) => void } = {}) { const S = this.S;
    const c = this.hit(id, r, !!o.onType, 'field', text, S.tw(text) + 2);
    S.fill(r.x, r.y, r.w, r.h, COL.well); S.hline(r.x, r.x + r.w - 1, r.y + r.h - 1, BRASS[2]!); S.vline(r.x + r.w - 1, r.y, r.y + r.h - 1, BRASS[2]!);
    const typing = this.focus === id, s = typing ? this.typed : text, tw = S.tw(s), tx = r.x + ((r.w - tw) >> 1), ty = r.y + ((r.h - 8) >> 1);
    S.text(s, tx, ty, typing ? COL.lit : o.changed ? COL.red2 : BRASS[4]!);
    if (typing && (performance.now() / 400 | 0) % 2) S.vline(tx + tw + 1, ty, ty + 7, COL.lit);
    if (c && o.onType) this.startTyping(id, text.replace(/[^0-9-]/g, ''), o.onType); }
  /** − [figure] + : returns the new value when it changed (buttons or typing), else null */
  stepper(id: string, r: Rect, value: number, range: { min: number; max: number; step: number }, show: (v: number) => string, base = 0, changed = false): number | null {
    const [m, f, p] = split(r, [16, '*', 16], 1); let out: number | null = null;
    if (this.button(id + '-', m!, '-', { disabled: value <= range.min })) out = Math.max(range.min, value - range.step);
    if (this.button(id + '+', p!, '+', { disabled: value >= range.max })) out = Math.min(range.max, value + range.step);
    this.field(id + '=', f!, show(value), { changed, onType: v => { const n = v === null ? NaN : parseInt(v, 10); if (Number.isFinite(n)) { const x = Math.round(Math.max(range.min, Math.min(range.max, n - base))); if (x !== value) this.typedFor = { id, v: x }; } } });
    if (this.typedFor?.id === id) { out = this.typedFor.v; this.typedFor = null; }
    return out; }
  /** a figure typed into a stepper arrives between frames; the stepper picks it up on its next call */
  private typedFor: { id: string; v: number } | null = null;
  /** a list of rows; returns the row clicked */
  list(id: string, r: Rect, items: { text: string; sub?: string; mark?: RGB }[], selected: number, rowH = 18): number { const S = this.S; let out = -1;
    S.fill(r.x, r.y, r.w, r.h, COL.card); this.recs.push({ id, kind: 'list', ...r, tap: false });
    items.slice(0, Math.floor(r.h / rowH)).forEach((it, i) => { const rr = { x: r.x, y: r.y + i * rowH, w: r.w, h: rowH }, sel = i === selected;
      if (this.hit(`${id}:${i}`, rr, true, 'row', it.text, S.tw(it.text) + 12)) out = i;
      if (sel) S.fill(rr.x, rr.y, rr.w, rr.h, COL.card2); else if (this.hover === `${id}:${i}`) S.fill(rr.x, rr.y, rr.w, rr.h, mix(COL.card, COL.card2, 0.5));
      if (it.mark) S.fill(rr.x + 3, rr.y + 4, 3, 3, it.mark);
      S.text(it.text, rr.x + 9, rr.y + 1, COL.ink, rr.w - 12); if (it.sub) S.text(it.sub, rr.x + 9, rr.y + 9, COL.inkSoft, rr.w - 12); S.hline(rr.x + 2, rr.x + rr.w - 3, rr.y + rr.h - 1, COL.card2); });
    if (items.length > Math.floor(r.h / rowH)) this.recs.push({ id: id + ':more', kind: 'paragraph', ...r, tap: false, text: '…', over: true });
    return out; }
  /** a tick box: ok, not ok, or not known yet (null) */
  tick(x: number, y: number, ok: boolean | null, col: RGB) { const S = this.S;
    S.fill(x, y, 9, 9, hex('#fbf6e6')); S.line(x, y, x + 8, y, COL.ink); S.line(x, y + 8, x + 8, y + 8, COL.ink); S.line(x, y, x, y + 8, COL.ink); S.line(x + 8, y, x + 8, y + 8, COL.ink);
    if (ok === null) S.hline(x + 2, x + 6, y + 4, COL.inkSoft); else if (ok) { S.line(x + 2, y + 4, x + 3, y + 6, col); S.line(x + 3, y + 6, x + 7, y + 1, col); } else { S.line(x + 2, y + 2, x + 6, y + 6, col); S.line(x + 6, y + 2, x + 2, y + 6, col); } }
  /** a short message on an enamel strip that fades */
  toast(text: string, age: number) { if (age > 3) return; const tw = this.S.tw(text), w = Math.min(this.S.w - 20, tw + 16), r = { x: (this.S.w - w) >> 1, y: this.S.h - 30, w, h: 16 };
    this.panel(r, 'enamel'); this.S.text(text, r.x + 8, r.y + 4, COL.cream, w - 16); }
}
