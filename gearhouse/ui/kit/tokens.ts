// The interface's design tokens (docs/systems/110 G2): one source for the cartoon manner the menus, the HUD and the
// style sheet share. The rules come from the reference screens' principles (§7), not their art: bold condensed italic
// type with a black edge, solid faces with a darker lower band, thick black outlines, colour by role. The role colours
// stay the same in every palette (a yellow button means the same thing everywhere); a palette sets the ground, the
// panels, the top band and the stripes, the 1990s garage's mood in three tries, switched by `data-kit` on the root.

/** the outline colour: every edge, every text's rim */
export const INK = '#111214';
/** the role colours, each a face and its lower band: yellow the main action, green confirm or selected, blue the
 *  secondary, orange watch or the alternative, grey locked; red danger and warnings; metal and dark for the parts */
export const ROLE = { yellow: ['#ffd21f', '#e7a700'], green: ['#46d36b', '#229b48'], blue: ['#3d9cff', '#1f6fd0'], orange: ['#ff9a1f', '#d66b00'], grey: ['#c3c5c8', '#8f9296'], red: ['#ff5a3c', '#c8301c'],
  metal: ['#dfe3e8', '#a8aeb6'], dark: ['#3b3e44', '#26282c'] } as const;
export type Role = keyof typeof ROLE;
/** the roles' short names in the CSS variables (--gk-y0, --gk-y1 ...) and classes (.gk-y ...) */
export const ROLE_KEY: Record<Role, string> = { yellow: 'y', green: 'g', blue: 'b', orange: 'o', grey: 'grey', red: 'r', metal: 'metal', dark: 'dark' };

/** the class ladder's colours (docs/systems/115 §3-7), a face and its lower band each, kept apart from the role colours:
 *  they are for a class card's border, band and glow only (a locked rung is the lock and a darkened card, never grey),
 *  so the role grey (locked) and red (danger) keep their meaning. N grey, S blue, P purple, H red, R gold */
export const TIER_COLOUR = { N: ['#aab3bd', '#737d88'], S: ['#2f8cff', '#1a5fc4'], P: ['#b05cff', '#7b2fd0'], H: ['#ff3b54', '#c01a34'], R: ['#ffc83a', '#c98d00'] } as const;
export type TierColourKey = keyof typeof TIER_COLOUR;

/** the type: Oswald 700 for the headlines and figures (Latin), Noto Sans KR 700 taking the Hangul in the same line */
export const FONT = { head: `'Oswald', 'Noto Sans KR', 'Arial Narrow', sans-serif`, body: `'Noto Sans KR', system-ui, sans-serif`,
  /** the Google Fonts sheet both pages load */ sheet: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Noto+Sans+KR:wght@400;700&display=swap' } as const;

/** one palette: the ground behind the menus (always dark: the 3D scene and the shade over it) and its soft text line,
 *  the panels' face and lower band and the wells cut into them, the top band's two tones, the stripes' two colours,
 *  the text on a panel (and its softer line, its highlight) */
export interface Palette { name: string; note: string; scheme: 'dark' | 'light'; ground: string; ground2: string; groundSoft: string; panel: [string, string]; well: string; top: [string, string]; stripe: [string, string];
  text: string; soft: string; hi: string; rule: string }
/** the text on the ground (all palettes) */
export const GROUND_TEXT = '#f3f0e8';
export const PALETTES = {
  /** the default: the green-painted walls of an old workshop, hazard stripes, charcoal floor */
  workshop: { name: '공방 녹색', note: '페인트칠한 작업장 벽의 짙은 청록, 바닥은 숯빛, 띠는 노랑·검정 경고 줄무늬', scheme: 'dark', ground: '#141819', ground2: '#1f2b29', groundSoft: '#a9bdb7', panel: ['#2e5f57', '#224740'], well: '#142624', top: ['#1d2726', '#111716'], stripe: ['#f0b323', '#151a1a'],
    text: '#f5f2e9', soft: '#b5cbc4', hi: '#ffd21f', rule: 'rgba(255,255,255,0.16)' },
  /** a red tool chest: red drawers, black handles, a dark floor */
  toolbox: { name: '공구함 빨강', note: '빨간 공구함 서랍, 검은 손잡이와 고무 매트, 띠는 검붉은 줄무늬', scheme: 'dark', ground: '#161211', ground2: '#2a1714', groundSoft: '#d0b2a8', panel: ['#b3301f', '#86210f'], well: '#4a130b', top: ['#221d1c', '#141110'], stripe: ['#7a1c10', '#161212'],
    text: '#fff4e8', soft: '#f3c7b8', hi: '#ffd21f', rule: 'rgba(255,255,255,0.18)' },
  /** bare concrete and galvanised steel: a light grey workshop */
  concrete: { name: '콘크리트 회색', note: '콘크리트 바닥과 아연 도금 철판의 밝은 회색, 띠는 노랑·검정', scheme: 'dark', ground: '#2b2e32', ground2: '#464a50', groundSoft: '#c3c8ce', panel: ['#a9afb5', '#899097'], well: '#5d6369', top: ['#3a3e43', '#272a2e'], stripe: ['#ffd21f', '#16181b'],
    text: '#121417', soft: '#30353b', hi: '#1f5fbf', rule: 'rgba(0,0,0,0.2)' },
} as const satisfies Record<string, Palette>;
export type PaletteId = keyof typeof PALETTES;
export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];
export const DEFAULT_PALETTE: PaletteId = 'workshop';
/** a stored or asked-for palette: one of ours, else the default */
export const paletteOf = (v: unknown): PaletteId => typeof v === 'string' && (PALETTE_IDS as string[]).includes(v) ? v as PaletteId : DEFAULT_PALETTE;

/** the palette's variables, as a declaration list */
function paletteVars(p: Palette): string {
  return `color-scheme:${p.scheme};--gk-ground:${p.ground};--gk-ground2:${p.ground2};--gk-p0:${p.panel[0]};--gk-p1:${p.panel[1]};--gk-well:${p.well};--gk-t0:${p.top[0]};--gk-t1:${p.top[1]};`
    + `--gk-sa:${p.stripe[0]};--gk-sb:${p.stripe[1]};--gk-text:${GROUND_TEXT};--gk-soft:${p.groundSoft};--gk-ptext:${p.text};--gk-psoft:${p.soft};--gk-hi:${p.hi};--gk-rule:${p.rule};--gk-shade:${p.ground}e0;`; }
/** the tokens as CSS: the role colours, the class colours (--gk-cls-n0 ...), the type, the outline, the motion, the default palette on :root and each
 *  palette under :root[data-kit="..."] */
export function tokenCss(): string {
  const roles = (Object.keys(ROLE) as Role[]).map(r => `--gk-${ROLE_KEY[r]}0:${ROLE[r][0]};--gk-${ROLE_KEY[r]}1:${ROLE[r][1]};`).join('');
  const tiers = (Object.keys(TIER_COLOUR) as TierColourKey[]).map(k => `--gk-cls-${k.toLowerCase()}0:${TIER_COLOUR[k][0]};--gk-cls-${k.toLowerCase()}1:${TIER_COLOUR[k][1]};`).join('');
  const e = (w: number, d: number) => [[w, 0], [-w, 0], [0, w], [0, -w], [w * 0.7, w * 0.7], [-w * 0.7, w * 0.7], [w * 0.7, -w * 0.7], [-w * 0.7, -w * 0.7], [0, d]].map(([x, y]) => `${x}px ${y}px 0 ${INK}`).join(',');
  return `:root{--gk-ink:${INK};${roles}${tiers}--gk-head:${FONT.head};--gk-body:${FONT.body};--gk-bw:3px;--gk-bwp:4px;--gk-cut:14px;`
    + `--gk-edge:${e(2, 4)};--gk-edge-s:${e(1.4, 2.4)};--gk-slide:44px;--gk-t:220ms;${paletteVars(PALETTES[DEFAULT_PALETTE])}}`
    + PALETTE_IDS.map(id => `:root[data-kit="${id}"]{${paletteVars(PALETTES[id])}}`).join('')
    + `@media (max-width:760px){:root{--gk-slide:18px;--gk-t:150ms}}`; }
