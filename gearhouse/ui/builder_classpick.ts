// The builder's class pick (docs/systems/115 C1, §3): the first screen of a new design and what the rail's class chip
// opens. Five family cards (일반 N, 스포츠 S, 슈퍼 P, 하이퍼 H, 레이싱 R), each with its three rungs as the kit's thumbnail
// cards: the rung's code and chevrons on its plate, its power cap and limiter, the kind of car it holds. The class
// colour is on the cards' borders, their bands and their glow only (§3-7); a closed rung keeps its colours, darkened,
// with a lock and its reason (H "2000년대 이후" in the 1990s' sandbox, R "준비 중"), so the ladder above reads as the
// next goal rather than a wall of greys. A move down shows first what would be held (the restrictor's cut, the
// limiter) and asks; the design is never cut back unless asked to ("엔진도 맞추기"). Its look: the page's CSS (.tp-*).
import { TIERS, TIER_GROUPS, TIER_GROUP_NAME, GROUP_NOTE, TIER_NOTE, tierFor, tierLock, tierLabel, type Tier, type TierGroup } from '../race/tiers';
import { TIER_COLOUR, INK } from './kit/tokens';
import { icon } from './kit/icons';
import { pickCard } from './kit/pick';
import { moveTo, chosenTier, freeHp } from './builder_tier';
import type { Design } from '../core/design';

export interface ClassPickOpen { design: Design; /** a new design: its class not chosen yet */ fresh: boolean; eraOpen: boolean }
export interface ClassPick { open(o: ClassPickOpen): void; close(): void; readonly isOpen: boolean }
/** what a pick does: the rung chosen, with the engine brought under its cap or left for the restrictor to hold */
export interface ClassPickHost { choose(t: Tier, fitEngine: boolean): void; /** closed without a choice (a new design keeps the rung it reaches) */ cancel(): void }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const svgEl = (s: string): Element => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild!; };
const num = (v: number) => v.toLocaleString();

/** a rung's plate: its code large, its chevrons in the class colour, a strip of how far up the power scale its cap is */
function plate(t: Tier): string {
  const [c0, c1] = TIER_COLOUR[t.group], cap = Number.isFinite(t.hpMax) ? t.hpMax : 2000, k = t.pending ? 1 : Math.min(1, Math.log(cap / 40) / Math.log(2000 / 40));
  const chev = Array.from({ length: t.n }, (_, i) => { const x = 60 - (t.n - 1) * 8 + i * 16, d = `M${x + 4} 38 L${x - 3} 44 L${x + 4} 50`;
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c0}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`; }).join('');
  return `<svg viewBox="0 0 120 60" aria-hidden="true"><text x="60" y="32" text-anchor="middle" font-family="Oswald, 'Arial Narrow', sans-serif" font-weight="700" font-style="italic" font-size="32" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${t.id}</text>${chev}`
    + `<rect x="20" y="53" width="80" height="5" rx="1" fill="${INK}"/><rect x="21" y="54" width="${(78 * k).toFixed(1)}" height="3" fill="${c0}"/><rect x="21" y="56" width="${(78 * k).toFixed(1)}" height="1" fill="${c1}"/></svg>`; }

export function classPick(root: HTMLElement, host: ClassPickHost): ClassPick {
  root.classList.add('tierpick'); root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'tpTitle');
  const box = el('div', 'tp-box gk-panel'), head = el('div', 'tp-head'), title = el('h2', '', '차급 고르기'), lead = el('p', 'tp-lead'), close = el('button', 'btn gk-btn gk-sm gk-b tp-close', '닫기');
  title.id = 'tpTitle'; close.type = 'button'; head.append(title, lead, close);
  const fams = el('div', 'tp-fams'), foot = el('div', 'tp-foot'), confirm = el('div', 'tp-confirm'); confirm.hidden = true; confirm.setAttribute('aria-live', 'polite');
  box.append(head, fams, confirm, foot); root.append(box);
  let cur: ClassPickOpen | null = null;
  const cards = new Map<string, { card: HTMLButtonElement; lock: HTMLElement; now: HTMLElement }>(), famEls = new Map<TierGroup, { fam: HTMLElement; why: HTMLElement }>();
  for (const g of TIER_GROUPS) {
    const fam = el('section', `tp-fam gk-tier-${g}`), band = el('div', 'tp-band'), why = el('span', 'tp-why');
    band.append(el('b', 'tp-g', g), el('span', 'tp-gn', TIER_GROUP_NAME[g]), el('small', 'tp-gs', GROUP_NOTE[g]), why);
    const rungs = el('div', 'tp-rungs');
    for (const t of TIERS.filter(x => x.group === g)) {
      const name = t.pending ? '규정' : Number.isFinite(t.hpMax) ? `${num(t.hpMax)} hp까지` : '상한 없음';
      const sub = t.pending ? TIER_NOTE[t.id] : `${Number.isFinite(t.topMax) ? `제한기 ${t.topMax}` : '제한기 없음'} · ${TIER_NOTE[t.id]}`;
      const card = pickCard({ pic: plate(t), name, sub }); card.classList.add('gk-tcard', `gk-tier-${g}`); card.dataset.tier = t.id;
      const lock = el('span', 'tp-lock'); lock.append(svgEl(icon('lock', { accent: TIER_COLOUR[g][0] })), el('span', 'tp-lt')); lock.hidden = true;
      const now = el('span', 'gk-badge gk-beta tp-now', '지금 차'); now.hidden = true;
      card.addEventListener('click', () => pick(t));
      // the lock and the mark sit over the card (not in it: a closed card is darkened, its lock is not)
      const slot = el('div', 'tp-slot'); slot.append(card, lock, now); rungs.append(slot); cards.set(t.id, { card, lock, now }); }
    fam.append(band, rungs); fams.append(fam); famEls.set(g, { fam, why }); }
  close.addEventListener('click', () => { api.close(); host.cancel(); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); api.close(); host.cancel(); } });

  function pick(t: Tier) { if (!cur) return; const L = tierLock(t, cur.eraOpen); if (L) return;
    if (cur.fresh) { api.close(); host.choose(t, true); return; }
    const m = moveTo(cur.design, t);
    if (!m.down || (!m.cut && !m.limiter)) { api.close(); host.choose(t, false); return; }
    // a move down: what it would hold, asked first
    confirm.textContent = ''; confirm.hidden = false;
    const h = el('p', 'tp-cq'); h.append(el('b', '', `${tierLabel(t)}로 내릴까요?`)); confirm.append(h);
    const ul = el('ul', 'tp-cl');
    if (m.cut) ul.append(el('li', '', `리스트릭터 −${num(m.cut)} hp: 엔진 ${num(m.hp)} hp를 ${num(m.hp - m.cut)} hp로 묶습니다`));
    if (m.limiter) ul.append(el('li', '', `제한기 ${m.limiter} km/h: 최고 속도 ${m.top} km/h를 ${m.limiter}에서 묶습니다`));
    ul.append(el('li', 'tp-soft', '설계는 지우지 않습니다. 차급을 다시 올리면 제한이 풀립니다.')); confirm.append(ul);
    const row = el('div', 'btns'), b = (text: string, cls: string, f: () => void) => { const x = el('button', `btn gk-btn gk-sm ${cls}`, text); x.type = 'button'; x.addEventListener('click', f); row.append(x); return x; };
    b(`${t.id}로 내리기`, 'gk-y', () => { api.close(); host.choose(t, false); }).dataset.act = 'down';
    if (m.cut) b(`엔진도 ${t.id}에 맞추기`, 'gk-b', () => { api.close(); host.choose(t, true); }).dataset.act = 'fit';
    b('취소', 'gk-dark', () => { confirm.hidden = true; });
    confirm.append(row); (row.firstElementChild as HTMLElement).focus(); confirm.scrollIntoView({ block: 'nearest' }); }

  const api: ClassPick = {
    get isOpen() { return !root.hidden; },
    open(o) { cur = o; confirm.hidden = true; const chosen = o.fresh ? null : chosenTier(o.design), reach = tierFor(freeHp(o.design));
      lead.textContent = o.fresh ? '새 설계는 차급부터 고릅니다. 고른 칸의 출력 상한과 제한기 안에서만 개발합니다. 차는 실제로 닿은 칸의 이름으로 불립니다.'
        : `목표 ${chosen!.id} · 지금 차 ${reach.id}. 올리면 제한이 풀리고, 내리면 무엇이 묶이는지 먼저 보여 드립니다.`;
      close.textContent = o.fresh ? `지금 차 그대로 (${reach.id})` : '닫기';
      foot.textContent = o.fresh ? '시작 엔진이 고른 칸보다 세면 칸에 맞게 줄여서 시작합니다. 차급은 나중에 레일 위의 칩으로 바꿀 수 있습니다.'
        : '위는 벽, 아래는 이름표: 고른 칸을 넘는 출력은 막고, 아래 칸에 머물면 그 칸의 이름으로 부릅니다.';
      for (const t of TIERS) { const c = cards.get(t.id)!, L = tierLock(t, o.eraOpen);
        c.card.setAttribute('aria-pressed', String(!!chosen && chosen.id === t.id)); c.card.disabled = !!L; c.card.classList.toggle('gk-locked', !!L);
        c.card.title = L ? `${tierLabel(t)}: ${L}` : tierLabel(t); c.lock.hidden = !L; c.lock.querySelector('.tp-lt')!.textContent = L ?? '';
        c.now.hidden = t.id !== reach.id || (!!chosen && chosen.id === reach.id && !o.fresh); }
      for (const [g, f] of famEls) { const ts = TIERS.filter(x => x.group === g), Ls = ts.map(t => tierLock(t, o.eraOpen)), all = Ls.every(Boolean);
        f.fam.classList.toggle('tp-closed', all); f.why.textContent = all && g === 'H' ? '설정 > 샌드박스 "시대 잠금 풀기"로 열기' : ''; }
      root.hidden = false; root.scrollTop = 0; fams.scrollTop = 0;
      (cards.get((chosen ?? reach).id)!.card).focus({ preventScroll: true }); },
    close() { root.hidden = true; confirm.hidden = true; } };
  return api; }
