// The interface's design system (docs/systems/110 G2): the stat bars' scale and their change, the count, the palettes,
// the tokens as CSS, the icons' drawings, and the HUD reading the same tokens.
import { describe, it, expect } from 'vitest';
import { statShare, barDelta, tweenValue, statText, moneyText, STATS, SLIVER } from '../ui/kit/logic';
import { PALETTES, PALETTE_IDS, DEFAULT_PALETTE, paletteOf, tokenCss, ROLE, INK } from '../ui/kit/tokens';
import { ICON_NAMES, icon } from '../ui/kit/icons';
import { KIT_CSS } from '../ui/kit/style';
import * as hudDraw from '../ui/hud/draw';
import { asSettings, DEFAULTS } from '../ui/shell/settings';

describe('stat bars', () => {
  it('fill by the figure within the stat span, held to the ends', () => {
    expect(statShare(350, STATS.power)).toBeCloseTo(0.5); expect(statShare(700, STATS.power)).toBe(1); expect(statShare(900, STATS.power)).toBe(1);
    expect(statShare(0, STATS.power)).toBe(0); expect(statShare(-5, STATS.power)).toBe(0); expect(statShare(NaN, STATS.power)).toBe(0);
    expect(statShare(1250, STATS.weight)).toBeCloseTo(0.5); expect(statShare(1.0, STATS.grip)).toBeCloseTo(0.5);
    expect(statShare(1, STATS.power)).toBe(SLIVER);   // a small figure still shows
    expect(statShare(5, { min: 1, max: 1 })).toBe(0); });
  it('a change shows the part gained or lost', () => {
    expect(barDelta(0.4, 0.7)).toEqual({ base: 0.4, gained: expect.closeTo(0.3, 9), lost: 0 });
    expect(barDelta(0.7, 0.4)).toEqual({ base: 0.4, gained: 0, lost: expect.closeTo(0.3, 9) });
    expect(barDelta(NaN, 2)).toEqual({ base: 0, gained: 1, lost: 0 }); });
  it('the figure counts to its value and is written by its stat', () => {
    expect(tweenValue(100, 200, 0)).toBe(100); expect(tweenValue(100, 200, 1)).toBe(200); expect(tweenValue(100, 200, 2)).toBe(200);
    expect(tweenValue(100, 200, 0.5)).toBeGreaterThan(150);   // eased out
    expect(statText(0.918, STATS.grip)).toBe('0.92'); expect(statText(412.4, STATS.power)).toBe('412'); expect(moneyText(1250000)).toBe('₩1,250,000'); });
});

describe('tokens and palettes', () => {
  it('three palettes, the workshop the default, rubbish read as the default', () => {
    expect(PALETTE_IDS).toEqual(['workshop', 'toolbox', 'concrete']); expect(DEFAULT_PALETTE).toBe('workshop');
    expect(paletteOf('toolbox')).toBe('toolbox'); expect(paletteOf('navy')).toBe('workshop'); expect(paletteOf(3)).toBe('workshop');
    for (const id of PALETTE_IDS) expect(PALETTES[id].panel[0]).toMatch(/^#[0-9a-f]{6}$/); });
  it('the CSS holds the roles, the outline and every palette', () => {
    const c = tokenCss(); expect(c).toContain(`--gk-y0:${ROLE.yellow[0]}`); expect(c).toContain(`--gk-ink:${INK}`);
    for (const id of PALETTE_IDS) expect(c).toContain(`:root[data-kit="${id}"]`);
    expect(KIT_CSS).toContain('.gk-btn'); expect(KIT_CSS).toContain('.gk-panel'); expect(KIT_CSS).toContain('prefers-reduced-motion');
    expect(KIT_CSS.lastIndexOf('.gk-g{')).toBeGreaterThan(KIT_CSS.indexOf('.gk-btn{'));   // the roles after the parts' defaults
  });
  it('the HUD draws with the same tokens', () => { expect(hudDraw.ROLE).toBe(ROLE); expect(hudDraw.INK).toBe(INK); });
  it('the settings keep a palette and mend a wrong one', () => {
    expect(DEFAULTS.screen.palette).toBe('workshop'); expect(asSettings({ screen: { palette: 'concrete' } }).screen.palette).toBe('concrete'); expect(asSettings({ screen: { palette: 'x' } }).screen.palette).toBe('workshop'); });
});

describe('icons', () => {
  it('each is an outlined drawing on the 48 square, with its colours given', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(17);
    for (const n of ICON_NAMES) { const s = icon(n); expect(s).toMatch(/^<svg class="gk-ic" viewBox="0 0 48 48"/); expect(s).toContain(INK); expect(s).not.toMatch(/NaN|undefined/); }
    expect(icon('lock', { accent: '#c3c5c8' })).toContain('#c3c5c8'); expect(icon('play', { title: '시작' })).toContain('aria-label="시작"'); });
});
