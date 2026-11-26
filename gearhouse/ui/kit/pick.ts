// The design system's picking parts (docs/systems/110 G4), added beside the G2 parts: a grid of thumbnail cards (a
// picture, a name, a badge; the chosen one green, a locked one grey with its lock), a rail of icon tabs (a vertical
// rail on a wide window, a strip on a phone: the builder's steps), a smaller button size, and a few big-number
// figures for an info card. Their look is the CSS here, put on the page once with installPick(); it reads the G2
// tokens (ui/kit/tokens.ts) and touches none of the G2 classes' own rules.
import { icon } from './icons';

const cut = (c: string) => `polygon(${c} 0,100% 0,100% calc(100% - ${c}),calc(100% - ${c}) 100%,0 100%,0 ${c})`;

export const PICK_CSS = `
/* ---- a smaller button (tool rows, lists): the same face, outline and press, less height ---- */
.gk-btn.gk-sm{min-height:36px;padding:4px 11px;font-size:.92rem;gap:6px;box-shadow:0 3px 0 var(--gk-ink),inset 0 2px 0 rgba(255,255,255,.4)}
.gk-btn.gk-sm .gk-ic{width:1.4em;height:1.4em}
.gk-btn.gk-sm:active:not(:disabled),.gk-btn.gk-sm.gk-down{transform:translateY(2px);box-shadow:0 1px 0 var(--gk-ink)}
/* ---- thumbnail cards: cut corners, a thick outline, a picture plate, the name; chosen green, locked grey ---- */
.gk-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(var(--gk-card-w,96px),100%),1fr));gap:10px;min-width:0}
.gk-card{--face:var(--gk-dark0);--band:var(--gk-dark1);--plate:linear-gradient(180deg,#4a4f55,#2a2d31);position:relative;isolation:isolate;display:grid;grid-template-rows:auto 1fr;gap:0;
  min-width:0;padding:var(--gk-bw);border:0;background:var(--gk-ink);clip-path:${cut('11px')};cursor:pointer;color:#fff;font:inherit;text-align:center;
  transition:transform 60ms,filter 80ms;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.gk-card::before{content:'';position:absolute;inset:var(--gk-bw);z-index:-1;clip-path:${cut('9px')};background:linear-gradient(var(--face) 0 calc(100% - 7px),var(--band) 0)}
.gk-card-pic{display:grid;place-items:center;aspect-ratio:4/3;background:var(--plate);border-bottom:var(--gk-bw) solid var(--gk-ink);clip-path:${cut('8px')}}
.gk-card-pic svg{width:76%;height:76%;overflow:visible}
.gk-card-n{display:block;padding:5px 5px 9px;font-family:var(--gk-head);font-weight:700;font-style:italic;font-size:.84rem;line-height:1.15;letter-spacing:.02em;color:#fff;text-shadow:var(--gk-edge-s);overflow-wrap:anywhere;word-break:keep-all}
.gk-card-s{display:block;margin-top:2px;font-family:var(--gk-body);font-style:normal;font-weight:700;font-size:.68rem;letter-spacing:0;text-shadow:none;color:var(--gk-psoft)}
.gk-card:hover:not(:disabled){filter:brightness(1.1)}
.gk-card:active:not(:disabled){transform:translateY(2px)}
.gk-card[aria-pressed="true"],.gk-card[aria-checked="true"]{--face:var(--gk-g0);--band:var(--gk-g1);--plate:linear-gradient(180deg,#5fe083,#2a9c4c)}
.gk-card[aria-pressed="true"] .gk-card-s,.gk-card[aria-checked="true"] .gk-card-s{color:#0d3a1b}
.gk-card[aria-pressed="true"]::after,.gk-card[aria-checked="true"]::after{content:'';position:absolute;left:7px;top:7px;width:18px;height:18px;border:2.5px solid var(--gk-ink);border-radius:50%;
  background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M4 10.5l4 4 8-9' fill='none' stroke='%23111214' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/80% no-repeat}
.gk-card:disabled,.gk-card.gk-locked{--face:var(--gk-grey1);--band:#6f7276;--plate:linear-gradient(180deg,#8f9296,#6b6e72);cursor:not-allowed}
.gk-card:disabled .gk-card-pic svg,.gk-card.gk-locked .gk-card-pic svg{filter:grayscale(1) brightness(.92);opacity:.75}
.gk-card:disabled .gk-card-n,.gk-card.gk-locked .gk-card-n{color:#eceef0}
.gk-card .gk-badge{position:absolute;right:3px;top:5px;font-size:.66rem;padding:2px 5px 3px;box-shadow:0 2px 0 var(--gk-ink)}
.gk-card:focus-visible{outline:none;filter:brightness(1.18)}.gk-card:focus-visible .gk-card-pic{box-shadow:inset 0 0 0 3px #fff}
/* ---- a rail of icon tabs: vertical by default, .gk-h a strip; the current tab yellow, seen ones ticked green ---- */
.gk-rail{display:flex;flex-direction:column;gap:7px;margin:0;padding:8px 7px;list-style:none;background:linear-gradient(90deg,var(--gk-t0) 0 78%,var(--gk-t1) 78%);border:var(--gk-bw) solid var(--gk-ink);border-radius:6px}
.gk-rail.gk-h{flex-direction:row;background:linear-gradient(var(--gk-t0) 0 76%,var(--gk-t1) 76%)}
.gk-rail>li{display:block;min-width:0}
.gk-railtab{--f0:var(--gk-dark0);--f1:var(--gk-dark1);position:relative;display:grid;justify-items:center;align-content:center;gap:1px;width:100%;min-width:56px;padding:6px 3px 7px;
  border:var(--gk-bw) solid var(--gk-ink);border-radius:4px;background:linear-gradient(var(--f0) 0 70%,var(--f1) 70%);box-shadow:0 3px 0 var(--gk-ink),inset 0 2px 0 rgba(255,255,255,.18);
  color:#fff;cursor:pointer;font:inherit;transition:transform 60ms,box-shadow 60ms,filter 80ms;-webkit-tap-highlight-color:transparent}
.gk-railtab .gk-ic{width:34px;height:34px}
.gk-railtab-l{font-family:var(--gk-head);font-weight:700;font-style:italic;font-size:.74rem;line-height:1.1;letter-spacing:.02em;color:#fff;text-shadow:var(--gk-edge-s);white-space:nowrap}
.gk-railtab-n{position:absolute;left:3px;top:1px;font-family:var(--gk-head);font-weight:700;font-style:italic;font-size:.72rem;line-height:1;color:var(--gk-y0);text-shadow:var(--gk-edge-s)}
.gk-railtab:hover{filter:brightness(1.12)}
.gk-railtab:active{transform:translateY(2px);box-shadow:0 1px 0 var(--gk-ink)}
.gk-railtab:focus-visible{outline:3px solid #fff;outline-offset:2px}
.gk-railtab[aria-current]{--f0:var(--gk-y0);--f1:var(--gk-y1)}
.gk-railtab[aria-current] .gk-railtab-n{color:#fff}
.gk-railtab.gk-seen::after{content:'';position:absolute;right:3px;bottom:5px;width:9px;height:9px;border:2px solid var(--gk-ink);border-radius:50%;background:var(--gk-g0)}
.gk-railtab.gk-unseen .gk-ic{opacity:.62}.gk-railtab.gk-unseen .gk-railtab-l{color:#c9ccd0}
/* ---- an option chip (one of a few words), a slider, a field: the shell's manner for pages of their own ---- */
.gk-opt{font-family:var(--gk-head);font-weight:700;font-style:italic;font-size:.88rem;letter-spacing:.02em;line-height:1.15;padding:5px 11px;min-height:34px;border:var(--gk-bw) solid var(--gk-ink);border-radius:4px;
  background:linear-gradient(var(--gk-dark0) 0 66%,var(--gk-dark1) 66%);color:#fff;text-shadow:var(--gk-edge-s);box-shadow:0 3px 0 var(--gk-ink);cursor:pointer;transform:skewX(-8deg);transition:transform 60ms,box-shadow 60ms;max-width:100%}
.gk-opt:active:not(:disabled){transform:skewX(-8deg) translateY(2px);box-shadow:0 1px 0 var(--gk-ink)}
.gk-opt[aria-pressed="true"],.gk-opt[aria-checked="true"]{background:linear-gradient(var(--gk-g0) 0 66%,var(--gk-g1) 66%)}
.gk-opt:disabled{background:linear-gradient(var(--gk-grey0) 0 66%,var(--gk-grey1) 66%);color:#f2f3f4;cursor:not-allowed}
.gk-opt:focus-visible{outline:3px solid #fff;outline-offset:2px}
.gk-range{width:100%;margin:6px 0;-webkit-appearance:none;appearance:none;height:14px;border:var(--gk-bw) solid var(--gk-ink);border-radius:3px;background:var(--gk-well);box-sizing:border-box}
.gk-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:28px;border:var(--gk-bw) solid var(--gk-ink);border-radius:4px;background:linear-gradient(var(--gk-y0) 0 66%,var(--gk-y1) 66%);cursor:pointer}
.gk-range::-moz-range-thumb{width:16px;height:24px;border:var(--gk-bw) solid var(--gk-ink);border-radius:4px;background:linear-gradient(var(--gk-y0) 0 66%,var(--gk-y1) 66%);cursor:pointer}
.gk-range:disabled{opacity:.45}.gk-range:focus-visible{outline:3px solid #fff;outline-offset:2px}
.gk-field{font:inherit;font-weight:700;padding:6px 9px;border:var(--gk-bw) solid var(--gk-ink);border-radius:4px;background:var(--gk-well);color:var(--gk-text);box-sizing:border-box}
.gk-field:focus-visible{outline:3px solid #fff;outline-offset:1px}
/* ---- big figures for an info card: a number, its unit, a line under it ---- */
.gk-bigs{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.gk-big{--f0:var(--gk-y0);display:grid;gap:1px;padding:6px 10px 8px;border:var(--gk-bw) solid var(--gk-ink);border-radius:4px;background:var(--gk-well);box-shadow:inset 0 -6px 0 rgba(0,0,0,.25);min-width:0}
.gk-big-l{font-family:var(--gk-head);font-weight:700;font-style:italic;font-size:.8rem;letter-spacing:.03em;color:var(--f0);text-shadow:var(--gk-edge-s)}
.gk-big-n{font-family:var(--gk-head);font-weight:700;font-style:italic;font-size:2.1rem;line-height:1;font-variant-numeric:tabular-nums;color:#fff;text-shadow:var(--gk-edge)}
.gk-big-n small{font-size:.45em;margin-left:3px;color:var(--f0)}
.gk-big-s{font-size:.72rem;font-weight:700;color:var(--gk-psoft);font-variant-numeric:tabular-nums}
@media (prefers-reduced-motion:reduce){.gk-card,.gk-railtab{transition:none}}
`;
/** the picking parts' style put on the page once (later calls do nothing) */
export function installPick(doc: Document = document): void { if (doc.getElementById('gk-pick-style')) return; const s = doc.createElement('style'); s.id = 'gk-pick-style'; s.textContent = PICK_CSS; doc.head.append(s); }

const svgEl = (s: string): Element => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild!; };
/** a thumbnail card: its picture (SVG text), its name and a short line; a button whose aria-pressed is the choice */
export function pickCard(o: { pic: string; name: string; sub?: string; title?: string }): HTMLButtonElement {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'gk-card'; b.setAttribute('aria-pressed', 'false');
  const pic = document.createElement('span'); pic.className = 'gk-card-pic'; pic.append(svgEl(o.pic));
  const n = document.createElement('span'); n.className = 'gk-card-n'; n.textContent = o.name;
  if (o.sub) { const s = document.createElement('span'); s.className = 'gk-card-s'; s.textContent = o.sub; n.append(s); }
  b.append(pic, n); if (o.title) b.title = o.title; return b; }
/** a card's state: chosen (green), locked (grey, a lock badge, its reason as the title) */
export function setCard(b: HTMLButtonElement, chosen: boolean, lock: string | null): void {
  b.setAttribute('aria-pressed', String(chosen)); b.disabled = !!lock; b.title = lock ?? '';
  let badge = b.querySelector<HTMLElement>(':scope > .gk-badge');
  if (lock && !badge) { badge = document.createElement('span'); badge.className = 'gk-badge gk-lockb'; badge.append(svgEl(icon('lock', { accent: '#c3c5c8' })), '잠김'); b.append(badge); }
  else if (!lock && badge) badge.remove(); }
/** a rail tab: an icon (SVG text), a short name, its number */
export function railTab(o: { pic: string; label: string; n?: number }): HTMLButtonElement {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'gk-railtab'; b.append(svgEl(o.pic));
  const l = document.createElement('span'); l.className = 'gk-railtab-l'; l.textContent = o.label; b.append(l);
  if (o.n !== undefined) { const n = document.createElement('span'); n.className = 'gk-railtab-n'; n.textContent = String(o.n); b.append(n); }
  return b; }
/** a big figure: a label, the number with its unit, a line under it; set() writes it again */
export function bigFigure(label: string, role = 'y'): HTMLElement & { set(n: string, unit: string, sub?: string): void } {
  const box = document.createElement('div') as unknown as HTMLElement & { set(n: string, unit: string, sub?: string): void }; box.className = 'gk-big'; box.style.setProperty('--f0', `var(--gk-${role}0)`);
  const l = document.createElement('span'); l.className = 'gk-big-l'; l.textContent = label; const n = document.createElement('span'); n.className = 'gk-big-n'; const s = document.createElement('span'); s.className = 'gk-big-s';
  box.append(l, n, s);
  box.set = (num, unit, sub = '') => { n.textContent = num; const u = document.createElement('small'); u.textContent = unit; n.append(u); s.textContent = sub; s.hidden = !sub; };
  return box; }
