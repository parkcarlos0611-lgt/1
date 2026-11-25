// The design system's style sheet (docs/systems/110 G2): every token and part on one page, to judge on a phone: the
// palettes (switchable), the type, the role colours, the buttons (pressed, locked, with icons), the panels, the stat
// bars (try the part swaps: the bars grow and shrink), the top band, the badges, the stripes, the icons at two sizes,
// the transitions, and the parts put together as a menu would use them. ui/uikit.ts shows it as its own page; the game
// shows it from the about screen.
import { PALETTES, PALETTE_IDS, ROLE, ROLE_KEY, INK, type PaletteId, type Role } from './tokens';
import { ICON_NAMES, ICON_KO, icon } from './icons';
import { STATS } from './logic';
import { kbutton, panel, statBar, badge, stripes, topBand, slideIn, slideOut, stagger } from './parts';
import { installKit, setPalette } from './style';
import { uiSounds, uiSoundsOn } from './sound';

type Kid = Node | string | null | undefined | false;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...kids: Kid[]): HTMLElementTagNameMap[K] { const e = document.createElement(tag); if (cls) e.className = cls; for (const k of kids) if (k) e.append(k); return e; }
const svg = (s: string): Element => { const t = document.createElement('template'); t.innerHTML = s; return t.content.firstElementChild!; };

const SHEET_CSS = `
.gks{min-height:100%;box-sizing:border-box;background:radial-gradient(ellipse at 50% 0%,var(--gk-ground2),var(--gk-ground) 70%);color:var(--gk-text);font-family:var(--gk-body);padding:0 0 40px}
.gks *{box-sizing:border-box}
.gks-body{max-width:1100px;margin:0 auto;padding:16px;display:grid;gap:18px}
.gks-sec{display:grid;gap:10px}
.gks-h{font-size:1.35rem;margin:6px 0 0}
.gks-note{font-size:.85rem;color:var(--gk-soft);margin:0;line-height:1.5}
.gks-row{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:center}
.gks-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.gks-sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.gks-chipc{border:3px solid var(--gk-ink);border-radius:4px;height:52px;background:linear-gradient(var(--a) 0 66%,var(--b) 66%)}
.gks-cap{font-size:.74rem;color:var(--gk-soft);margin-top:3px;line-height:1.3}
.gks-icons{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px}
.gks-icon{display:grid;justify-items:center;gap:4px;padding:8px 4px;text-align:center}
.gks-icon .gk-ic{width:52px;height:52px}.gks-icon .gks-small{display:flex;gap:6px}.gks-icon .gks-small .gk-ic{width:22px;height:22px}
.gks-type .gk-head{margin:0}
.gks-mode{display:grid;gap:0;padding:0;--cut:18px}
.gks-mode-in{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px;padding:16px}
.gks-mode-in .gk-btn{width:100%}
.gks-menu{display:grid;gap:10px;max-width:360px}
.gks-menu .gk-btn{width:100%}
.gks-slide{display:flex;gap:10px;align-items:flex-start;min-height:120px;overflow:hidden}
.gks-pal{display:flex;flex-wrap:wrap;gap:10px}
@media (max-width:760px){.gks-body{padding:12px;gap:14px}.gks-mode-in{gap:10px;padding:12px}.gk-stat{grid-template-columns:auto 3.9em minmax(40px,1fr) 4.8em;gap:6px}}
`;

/** the style sheet built into `root` */
export function buildSheet(root: HTMLElement, o: { onBack?: () => void } = {}): void {
  installKit(); if (!document.getElementById('gks-style')) { const s = document.createElement('style'); s.id = 'gks-style'; s.textContent = SHEET_CSS; document.head.append(s); }
  root.classList.add('gks'); root.textContent = '';
  const sec = (title: string, note: string, ...kids: Kid[]) => el('section', 'gks-sec', el('h2', 'gks-h gk-head', title), note ? el('p', 'gks-note', note) : null, ...kids);
  const cur = (): PaletteId => (document.documentElement.dataset.kit as PaletteId) || 'workshop';

  // the palettes
  const pal = el('div', 'gks-pal'), palNote = el('p', 'gks-note');
  const drawPal = () => { pal.textContent = ''; for (const id of PALETTE_IDS) { const p = PALETTES[id], on = id === cur();
      pal.append(kbutton(`${p.name}${id === 'workshop' ? ' (기본)' : ''}`, () => { setPalette(id); drawPal(); }, { role: on ? 'green' : 'dark' })); }
    palNote.textContent = PALETTES[cur()].note; };
  drawPal();
  const snd = kbutton(uiSoundsOn() ? '버튼 소리 켜짐' : '버튼 소리 꺼짐', () => { uiSounds(!uiSoundsOn()); snd.querySelector('span')!.textContent = uiSoundsOn() ? '버튼 소리 켜짐' : '버튼 소리 꺼짐'; }, { role: 'blue', icon: 'settings' });

  // the colours
  const roles: [Role, string][] = [['yellow', '주 버튼'], ['green', '확인·선택'], ['blue', '보조'], ['orange', '보기·대안'], ['grey', '잠김'], ['red', '위험·경고'], ['metal', '금속 부품'], ['dark', '어두운 부품']];
  const sw = el('div', 'gks-sw', ...roles.map(([r, n]) => { const c = el('div', 'gks-chipc'); c.style.setProperty('--a', ROLE[r][0]); c.style.setProperty('--b', ROLE[r][1]); return el('div', '', c, el('div', 'gks-cap', `${n} · ${ROLE[r][0]}`)); }));
  const pv = ['--gk-ground', '--gk-p0', '--gk-p1', '--gk-well', '--gk-t0', '--gk-sa', '--gk-sb'], pn = ['바탕', '패널 면', '패널 아래 띠', '홈(우물)', '상단 띠', '줄무늬 A', '줄무늬 B'];
  const psw = el('div', 'gks-sw', ...pv.map((v, i) => { const c = el('div', 'gks-chipc'); c.style.setProperty('--a', `var(${v})`); c.style.setProperty('--b', `var(${v})`); return el('div', '', c, el('div', 'gks-cap', pn[i]!)); }),
    (() => { const c = el('div', 'gks-chipc'); c.style.setProperty('--a', INK); c.style.setProperty('--b', INK); return el('div', '', c, el('div', 'gks-cap', `외곽선 · ${INK}`)); })());

  // the type
  const type = el('div', 'gks-type gk-panel', el('p', 'gk-head', 'GEARHOUSE 차고'), (() => { const h = el('p', 'gk-head', '굵은 압축 기울임 제목 · HEADLINE'); h.style.fontSize = '1.6rem'; return h; })(),
    (() => { const n = el('p', 'gk-num', '412 hp  1,280 kg  288 km/h'); n.style.fontSize = '2.2rem'; n.style.margin = '6px 0'; return n; })(),
    el('p', '', '본문은 Noto Sans KR. 설명과 긴 글은 이 글꼴로 읽기 쉽게 쓴다. 제목·버튼·숫자만 Oswald 700 기울임에 검은 테를 두른다.'),
    (() => { const l = el('p', 'gk-logo', 'GEARHOUSE'); l.style.fontSize = 'clamp(2.4rem, 9vw, 4.2rem)'; l.style.margin = '8px 0 4px'; return l; })());

  // the buttons
  const btnRoles: [Role, string, string?][] = [['yellow', '시작', 'play'], ['green', '확인'], ['blue', '보조'], ['orange', '보기'], ['red', '삭제'], ['dark', '취소']];
  const btns = el('div', 'gks-row', ...btnRoles.map(([r, t, i]) => kbutton(t, () => {}, { role: r, icon: i as never })), kbutton('잠김', () => {}, { role: 'grey', icon: 'lock', locked: true }));
  const pressed = kbutton('눌린 상태', () => {}, { role: 'yellow' }); pressed.classList.add('gk-down');
  const sq = el('div', 'gks-row', ...(['settings', 'back', 'play', 'wrench'] as const).map((i, k) => kbutton(ICON_KO[i], () => {}, { role: (['dark', 'dark', 'yellow', 'blue'] as Role[])[k], icon: i, square: true })), pressed);
  const menu = el('div', 'gks-menu', kbutton('주행 시작', () => {}, { big: true, icon: 'play' }), kbutton('차고', () => {}, { big: true, icon: 'wrench' }), kbutton('레이스', () => {}, { big: true, icon: 'trophy' }),
    (() => { const b = kbutton('챔피언십', () => {}, { big: true, icon: 'flag', locked: true }); b.append(badge('lock', '곧', true)); return b; })());

  // panels
  const panels = el('div', 'gks-grid2', panel('', el('b', 'gk-head', '기본 패널'), el('p', 'gks-note', '잘린 모서리, 굵은 검은 외곽선, 단색 면과 아래쪽의 어두운 띠.')),
    panel('sel', el('b', 'gk-head', '선택된 패널'), el('p', 'gks-note', '선택은 초록 면으로.')), panel('well', el('b', 'gk-head', '홈 패널'), el('p', 'gks-note', '목록과 수치를 담는 패인 바탕.')),
    panel('y', el('b', 'gk-head', '노란 패널'), el('p', '', '강조 카드 (상금, 목표).')));

  // stat bars
  const bars = { power: statBar(STATS.power, 280), weight: statBar(STATS.weight, 1280), grip: statBar(STATS.grip, 0.92), top: statBar(STATS.top, 246) };
  const swaps: [string, Partial<Record<keyof typeof bars, number>>, Role][] = [['터보 달기', { power: 412, top: 288 }, 'orange'], ['경량화', { weight: 1090, top: 296 }, 'blue'], ['세미 슬릭', { grip: 1.18 }, 'green'], ['순정으로', { power: 280, weight: 1280, grip: 0.92, top: 246 }, 'dark']];
  const statBox = el('div', 'gk-panel', el('div', '', ...Object.values(bars).map(b => { b.style.marginBottom = '10px'; return b; })),
    el('div', 'gks-row', ...swaps.map(([t, v, r]) => kbutton(t, () => { for (const [k, x] of Object.entries(v)) bars[k as keyof typeof bars].set(x!); }, { role: r }))));

  // badges, stripes
  const badges = el('div', 'gks-row', badge('new'), badge('beta'), badge('lock'), badge('hot'), badge('new', '신품'), (() => { const b = kbutton('멀티플레이', () => {}, { role: 'yellow' }); b.append(badge('beta', 'BETA', true)); return b; })());

  // icons
  const icons = el('div', 'gks-icons', ...ICON_NAMES.map(n => el('div', 'gks-icon gk-panel gk-well', svg(icon(n)), el('div', 'gks-small', svg(icon(n)), svg(icon(n, { face: ROLE.yellow[0], accent: ROLE.blue[0] }))), el('div', 'gks-cap', `${ICON_KO[n]} · ${n}`))));

  // transitions
  const stage = el('div', 'gks-slide'); let card: HTMLElement | null = null;
  const tbtns = el('div', 'gks-row', kbutton('들어오기', () => { if (card) return; card = panel('', el('b', 'gk-head', '미끄러져 들어옴'), el('p', 'gks-note', '휴대폰에서는 짧고 가볍게.')); stage.append(card); slideIn(card, 'r'); }, { role: 'green' }),
    kbutton('나가기', () => { const c = card; if (!c) return; card = null; void slideOut(c, 'r').then(() => c.remove()); }, { role: 'dark' }),
    kbutton('차례로', () => { const g = el('div', 'gks-row', ...['엔진', '변속기', '터보'].map(t => kbutton(t, () => {}, { role: 'blue' }))); stage.textContent = ''; card = null; stage.append(g); stagger(g, 'u'); }, { role: 'blue' }));

  // put together: a mode select as a menu would draw it
  const mode = el('div', 'gk-panel gks-mode', stripes(), el('div', 'gks-mode-in', kbutton('시험장', () => {}, { icon: 'flag' }), kbutton('레이스', () => {}, { icon: 'trophy' }), kbutton('자유 설계', () => {}, { icon: 'wrench' }),
    kbutton('엔진 공방', () => {}, { icon: 'engine' }), kbutton('챔피언십', () => {}, { icon: 'lock', locked: true }), (() => { const b = kbutton('온라인', () => {}, { icon: 'play' }); b.append(badge('beta', 'BETA', true)); return b; })()), stripes());

  const body = el('div', 'gks-body',
    sec('팔레트', '역할 색(노랑·초록·파랑·주황·회색)은 그대로 두고 바탕·패널·상단 띠·줄무늬만 바뀐다. 1990년대 차고·공방 분위기의 시안 세 가지.', pal, palNote, el('div', 'gks-row', snd)),
    sec('조합 예: 모드 선택', 'FR 참고 화면의 원리(사선 줄무늬 띠, 2열 노란 버튼, 잠긴 회색, 기울어진 배지)를 우리 색으로.', mode),
    sec('글꼴', '', type),
    sec('역할 색', '면과 아래 띠의 두 톤. 버튼, 막대, 배지, 아이콘이 같은 값을 쓴다.', sw),
    sec('팔레트 색', '', psw),
    sec('버튼', '누르면 그림자가 닫히며 3px 내려간다. 메뉴 소리를 켜면 짧은 딸깍 소리.', btns, sq, menu),
    sec('패널', '', panels),
    sec('수치 막대', '출력·무게·그립·최고 속도. 아래 부품 버튼을 눌러 보면 막대가 늘고 줄고(늘어난 부분은 흰색, 줄어든 부분은 빨강으로 잠깐), 숫자가 따라 센다.', statBox),
    sec('배지', '', badges),
    sec('사선 줄무늬 띠', '', stripes(), stripes(true)),
    sec('아이콘', '굵은 외곽선의 단순한 그림. 52px와 22px, 색 바꾼 예.', icons),
    sec('전환', '패널이 미끄러져 들어오고 나간다. 움직임 줄이기 설정과 기기 설정을 따른다.', tbtns, stage));
  root.append(topBand({ title: 'UI KIT', onBack: o.onBack, money: 1250000, slots: [3, 8] }), body);
  void ROLE_KEY; }
