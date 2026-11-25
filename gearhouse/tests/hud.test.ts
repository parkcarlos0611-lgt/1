// The driving HUD's rules (docs/systems/110 G3, ui/hud/logic.ts): the gear lever's gate, the pedals' press, the
// tachometer's needles from the cabin's own faces, which wheel and shifter, the layouts.
import { describe, it, expect } from 'vitest';
import { leverDown, leverMove, leverKnob, LEVER, pedalPress, needleDeg, tachFace, tachScales, hudGaugeCar, speedDigits, gearLabel, revLight, wheelStyleOf, shifterOf, hudLayout, hudScale, hudAlpha } from '../ui/hud/logic';
import { dialAngle } from '../render/car/interior/gauges';
import { pedalSVG, wheelSVG, leverSVG, tachSVG, handbrakeSVG, startSVG, paddleSVG } from '../ui/hud/draw';

describe('gear lever gate', () => {
  it('shifts once a push, up when pushed away, down when pulled', () => {
    const s = leverDown(100), T = 50;
    expect(leverMove(s, 90, T)).toBeNull();                       // inside the gate
    expect(leverMove(s, 100 - T * LEVER.gate - 1, T)).toBe('up'); // past it, pushed up
    expect(leverMove(s, 40, T)).toBeNull();                       // held there: no second shift
    expect(leverMove(s, 100 + T * 0.4, T)).toBeNull();            // through the middle (not near it on the way: still disarmed past rearm)
    expect(leverMove(s, 102, T)).toBeNull();                      // back near the middle: armed again
    expect(leverMove(s, 100 + T * LEVER.gate + 1, T)).toBe('down');
  });
  it('the knob follows to the slot ends; nothing with no travel', () => {
    const s = leverDown(0); expect(leverKnob(s, -200, 50)).toBe(-1); expect(leverKnob(s, 25, 50)).toBe(0.5); expect(leverKnob(null, 25, 50)).toBe(0);
    expect(leverMove(leverDown(0), -100, 0)).toBeNull(); });
});

describe('pedal press', () => {
  it('sinks and foreshortens with the pedal, the bar the amount itself', () => {
    expect(pedalPress(0)).toEqual({ y: 0, k: 1, bar: 0 }); const f = pedalPress(1); expect(f.y).toBe(1); expect(f.k).toBeCloseTo(0.84); expect(f.bar).toBe(1);
    const h = pedalPress(0.5); expect(h.y).toBeGreaterThan(0.5); expect(h.y).toBeLessThan(1); expect(h.bar).toBe(0.5);
    for (let i = 0; i < 10; i++) expect(pedalPress((i + 1) / 10).y).toBeGreaterThan(pedalPress(i / 10).y);
    expect(pedalPress(2).bar).toBe(1); expect(pedalPress(-1).bar).toBe(0); expect(pedalPress(NaN).bar).toBe(0); });
});

describe('gauge needles', () => {
  const car = hudGaugeCar({ redline: 7300, topKmh: 317, tech: { turbo: { boost: 1 } } }), face = tachFace(car), { tach, boost } = tachScales(face);
  it('the HUD tach is the cabin\'s: its red line, its boost dial for a blown car only', () => {
    expect(tach.red?.[0]).toBe(7300); expect(boost).toBeDefined(); expect(tachScales(tachFace(hudGaugeCar({ redline: 6000, topKmh: 200 }))).boost).toBeUndefined(); });
  it('follows the revs, pinned at the ends, rests with the ignition off, swept as it comes on', () => {
    expect(needleDeg(tach, 4000, 0, true)).toBeCloseTo(dialAngle(tach, 4000)); expect(needleDeg(tach, 4000, 0, false)).toBe(tach.a0);
    expect(needleDeg(tach, 99999, 0, true)).toBe(tach.a1); expect(needleDeg(tach, -5, 0, true)).toBe(tach.a0);
    expect(needleDeg(tach, 0, 1, true)).toBe(tach.a1); expect(needleDeg(tach, 0, 0.5, true)).toBeCloseTo((tach.a0 + tach.a1) / 2);
    expect(needleDeg(boost!, 0.5, 0, true)).toBeCloseTo(dialAngle(boost!, 0.5)); });
  it('the digits, the gear, the shift light', () => {
    expect(speedDigits(141.6, 0, true, 317)).toBe('142'); expect(speedDigits(-20, 0, true, 317)).toBe('20'); expect(speedDigits(80, 0, false, 317)).toBe('---'); expect(speedDigits(0, 1, true, 317)).toBe('317');
    expect(gearLabel(3, false)).toBe('3'); expect(gearLabel(2, true)).toBe('R');
    expect(revLight(5000, 7300)).toBe(0); expect(revLight(6500, 7300)).toBe(1); expect(revLight(7300, 7300)).toBe(2); });
});

describe('which drawings, which layout', () => {
  it('the wheel and the shifter by the car and the setting', () => {
    expect(wheelStyleOf('light')).toBe('drift'); expect(wheelStyleOf('standard')).toBe('stock'); expect(wheelStyleOf(undefined)).toBe('drift');
    expect(shifterOf('manual', 'lever')).toBe('lever'); expect(shifterOf('f1', 'lever')).toBe('paddles'); expect(shifterOf('f1', 'buttons')).toBe('buttons'); });
  it('three layouts; the settings held to their ranges', () => {
    expect(hudLayout(390, 844, true)).toBe('portrait'); expect(hudLayout(844, 390, true)).toBe('landscape'); expect(hudLayout(1366, 768, false)).toBe('pc');
    expect(hudScale(3)).toBe(1.4); expect(hudScale('x')).toBe(1); expect(hudAlpha(0)).toBe(0.35); });
  it('the drawings are self-contained SVG with their moving parts', () => {
    const face = tachFace(hudGaugeCar({ redline: 7300, topKmh: 317, tech: { turbo: { boost: 1 } } }));
    const all = [pedalSVG('gas'), pedalSVG('brake'), wheelSVG('drift'), wheelSVG('stock'), leverSVG(), tachSVG(face), handbrakeSVG(), startSVG(), paddleSVG('L')];
    for (const s of all) { expect(s.startsWith('<svg')).toBe(true); expect(s).not.toMatch(/<image|href="http|NaN/); }
    expect(pedalSVG('gas')).toContain('class="plate"'); expect(pedalSVG('gas')).toContain('class="pbar"'); expect(leverSVG()).toContain('class="knob"');
    expect(tachSVG(face)).toContain('data-id="tach"'); expect(tachSVG(face)).toContain('data-id="boost"'); });
});
