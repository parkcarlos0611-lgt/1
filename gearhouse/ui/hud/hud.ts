// The driving HUD (docs/systems/110 G3): the touch controls drawn as the real things (ui/hud/draw.ts) and the car's
// own tachometer with the speed in big digits and the gear, on the drive page's markup (ui/drive.page.html: #pad, #hcl).
// The page keeps its own input handling (the wheel #tw, the pedals, the buttons with data-key); this adds the gear
// lever's drag, puts the drawings in, poses them each frame from the car's state, and keeps the layout: a phone upright,
// a phone on its side, or a computer (the touch controls hidden while a keyboard or a gamepad is being used).
import { pedalSVG, pedalPose, wheelSVG, leverSVG, paddleSVG, handbrakeSVG, startSVG, tachSVG } from './draw';
import { ROLE } from '../kit/tokens';
import { installKit } from '../kit/style';
import { leverDown, leverMove, leverKnob, pedalPress, tachFace, tachScales, needleDeg, speedDigits, gearLabel, gearLabelAuto, revLight, hudLayout, hudScale, hudAlpha, shifterOf, type LeverState, type HudWheel, type HudLayout, type Shifter } from './logic';
import type { GaugeCar, DialScale } from '../../render/car/interior/gauges';
import type { EnginePhase } from '../../race/ignition';

/** the car the HUD is drawn for */
export interface HudCar { gauges: GaugeCar; wheel: HudWheel; gearbox: 'manual' | 'f1' | 'auto' }
/** the HUD's settings (ui/shell/settings.ts controls) */
export interface HudPrefs { size: number; alpha: number; left: boolean; shifter: 'lever' | 'buttons' }
/** one frame's state */
export interface HudFrame { rpm: number; kmh: number; /** bar over the air's */ boost: number; gear: number; reverse: boolean; auto: boolean; phase: EnginePhase; on: boolean; sweep: number; lamps: boolean;
  /** the touch pedals' amounts (0..1), the handbrake (0..1), the steering wheel's turn (rad, the driver's) */ gas: number; brake: number; hand: number; wheelRad: number }
export interface HudHooks { /** a gear up (+1) or down (-1) from the lever */ shift(dir: 1 | -1): void }

const sig = (c: HudCar) => `${c.gauges.redline}|${c.gauges.topKmh}|${c.gauges.boostBar ?? 0}|${c.wheel}|${c.gearbox}`;
export class Hud {
  private readonly q: <T extends Element = HTMLElement>(s: string) => T | null;
  private carSig = ''; private shifter: Shifter | '' = ''; private prefs: HudPrefs = { size: 1, alpha: 0.92, left: false, shifter: 'lever' };
  private tach: { el: SVGGElement; s: DialScale; last: number }[] = []; private top = 300; private redline = 7000; private n = 0; private lay: HudLayout | '' = '';
  private lever: LeverState | null = null; private last: Record<string, string | number> = {};
  constructor(private readonly root: ParentNode, private readonly hooks: HudHooks) {
    this.q = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s) as T | null; installKit();   // the design system's tokens: the page's HUD colours read them (docs/systems/110 G2)
    for (const k of ['gas', 'brake'] as const) { const b = this.q(`#pad .pedal.${k}`); if (b) b.innerHTML = pedalSVG(k); }
    const st = this.q('#startbtn'); if (st) st.innerHTML = startSVG();
    const hb = this.q('#hhand'); if (hb) hb.innerHTML = handbrakeSVG();
    const pl = this.q('#hpadL'), pr = this.q('#hpadR'); if (pl) pl.innerHTML = paddleSVG('L'); if (pr) pr.innerHTML = paddleSVG('R');
    const lv = this.q('#hlever'); if (lv) { lv.innerHTML = leverSVG(); this.leverInput(lv); }
    // the touch controls out of the way while a keyboard or a gamepad drives; back at a touch
    addEventListener('keydown', e => { if (e.isTrusted && !['Tab', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) this.keysUsed(); });
    addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.pointerType === 'pen') document.body.classList.remove('hud-keys'); }, true); }
  /** a keyboard or a gamepad in use: the touch controls hidden until the screen is touched again */
  keysUsed(): void { if (!document.body.classList.contains('hud-keys')) { document.body.classList.add('hud-keys'); this.n = 0; } }
  /** the car's drawings: its tachometer (from its red line, top speed, boost), its wheel, its shifter */
  setCar(c: HudCar): void { const s = sig(c); if (s === this.carSig) return; this.carSig = s; this.last = {};
    const face = tachFace(c.gauges), sc = tachScales(face), box = this.q('#htach'); this.top = c.gauges.topKmh; this.redline = c.gauges.redline;
    if (box) { box.innerHTML = tachSVG(face); this.tach = [sc.tach, ...(sc.boost ? [sc.boost] : [])].map(s => ({ el: box.querySelector<SVGGElement>(`.nd[data-id="${s.id}"]`)!, s, last: NaN })).filter(t => t.el); }
    const w = wheelSVG(c.wheel), tw = this.q('#tw'), pw = this.q('#hwheel .hw'); if (tw) tw.innerHTML = w; if (pw) pw.innerHTML = w;
    this.root.querySelector('#hcl')?.classList.toggle('boost', !!c.gauges.boostBar);
    this.useShifter(shifterOf(c.gearbox, this.prefs.shifter)); this.gearbox = c.gearbox; }
  private gearbox: 'manual' | 'f1' | 'auto' = 'manual';
  /** the settings: the size and opacity of the touch controls, the left-handed layout, the lever or buttons */
  setPrefs(p: Partial<HudPrefs>): void { this.prefs = { ...this.prefs, ...p }; const b = document.body, pad = this.q('#pad'), cl = this.q('#hcl');
    for (const el of [pad, cl]) { el?.style.setProperty('--hud-k', hudScale(this.prefs.size).toFixed(2)); } pad?.style.setProperty('--hud-a', hudAlpha(this.prefs.alpha).toFixed(2));
    b.classList.toggle('hud-left', !!this.prefs.left); if (this.carSig) this.useShifter(shifterOf(this.gearbox, this.prefs.shifter)); this.n = 0; }
  private useShifter(s: Shifter): void { if (s === this.shifter) return; this.shifter = s; const pad = this.q('#pad'); if (!pad) return;
    pad.dataset.shifter = s; }
  /** the layout now: re-read now and then (the window's shape, whether the touch controls show) */
  get layout(): HudLayout { return (this.lay || 'pc') as HudLayout; }
  private relayout(): void { const pad = this.q('#pad'), touch = !!pad && getComputedStyle(pad).display !== 'none', l = hudLayout(innerWidth, innerHeight, touch);
    if (l === this.lay) return; const b = document.body; for (const k of ['portrait', 'landscape', 'pc']) b.classList.toggle(`hud-${k}`, k === l); this.lay = l; }
  /** the gear lever dragged: a push up past the gate a gear up, a pull down a gear down (ui/hud/logic.ts) */
  private leverInput(lv: HTMLElement): void { const travel = () => lv.getBoundingClientRect().height * 0.28, knob = () => lv.querySelector('.knob');
    const pose = (k: number) => knob()?.setAttribute('transform', `translate(0 ${(k * 58).toFixed(1)})`);
    lv.addEventListener('pointerdown', e => { e.preventDefault(); lv.setPointerCapture(e.pointerId); this.lever = leverDown(e.clientY); lv.classList.add('on'); });
    lv.addEventListener('pointermove', e => { const s = this.lever; if (!s) return; const d = leverMove(s, e.clientY, travel()); pose(leverKnob(s, e.clientY, travel()));
      if (d) { this.hooks.shift(d === 'up' ? 1 : -1); lv.classList.add('kick'); setTimeout(() => lv.classList.remove('kick'), 120); } });
    const up = () => { this.lever = null; lv.classList.remove('on'); pose(0); };
    lv.addEventListener('pointerup', up); lv.addEventListener('pointercancel', up); lv.addEventListener('lostpointercapture', up); lv.addEventListener('contextmenu', e => e.preventDefault()); }
  private put(key: string, v: string | number, f: () => void): void { if (this.last[key] === v) return; this.last[key] = v; f(); }
  /** one frame: the needles, the digits, the gear, the lamps, the pedals' plates, the start button's colour */
  frame(f: HudFrame): void { if (this.n++ % 20 === 0) this.relayout();
    for (const t of this.tach) { const v = t.s.id === 'boost' ? f.boost : f.rpm, a = Math.round(needleDeg(t.s, v, f.sweep, f.on) * 2) / 2;
      if (a !== t.last) { t.last = a; const tr = t.el.getAttribute('transform') ?? ''; t.el.setAttribute('transform', tr.replace(/rotate\([^)]*\)/, `rotate(${a})`)); } }
    const cl = this.q('#hcl');
    this.put('spd', speedDigits(f.kmh, f.sweep, f.on, this.top), () => { const e = this.q('#hspd'); if (e) e.textContent = speedDigits(f.kmh, f.sweep, f.on, this.top); });
    const AT = this.gearbox === 'auto', g = AT ? gearLabelAuto(f.gear, f.reverse, f.auto) : gearLabel(f.gear, f.reverse);   /* the automatic: D and its gear */
    this.put('gear', g + (f.auto ? 'A' : 'M'), () => { const e = this.q('#hgear'); if (e) { e.textContent = g; e.dataset.mode = f.auto ? 'A' : 'M'; } const k = this.q('#hlever .kg'); if (k) k.textContent = AT ? (f.reverse ? 'R' : f.auto ? 'D' : 'M') : f.auto ? 'A' : g; });
    this.put('on', `${f.on}|${f.lamps}|${revLight(f.rpm, this.redline)}`, () => { cl?.classList.toggle('off', !f.on); const lp = cl?.querySelectorAll<SVGCircleElement>('.lp circle'); lp?.[0]?.setAttribute('fill', f.lamps ? ROLE.red[0] : '#3a1410'); lp?.[1]?.setAttribute('fill', f.lamps ? '#ffb020' : '#3a2a0c');
      const sl = cl?.querySelector('.sl'), r = revLight(f.rpm, this.redline); sl?.setAttribute('fill', !f.on ? '#2a2b2e' : r === 2 ? ROLE.red[0] : r === 1 ? ROLE.yellow[0] : '#2a2b2e'); sl?.classList.toggle('blink', f.on && r === 2); });
    this.put('lever', `${f.auto}`, () => { const lv = this.q('#hlever'); lv?.classList.toggle('auto', f.auto); const kf = lv?.querySelector('.kf'), kb = lv?.querySelector('.kb'), c = f.auto ? ROLE.grey : ROLE.yellow; kf?.setAttribute('fill', c[0]); kb?.setAttribute('fill', c[1]); });
    this.put('start', f.phase, () => { const b = this.q('#startbtn'); if (!b) return; const c = f.phase === 'off' || f.phase === 'power' || f.phase === 'stalled' ? ROLE.yellow : f.phase === 'cranking' || f.phase === 'firing' ? ROLE.orange : ROLE.green;
      b.querySelector('.sf')?.setAttribute('fill', c[0]); b.querySelector('.sb')?.setAttribute('fill', c[1]); b.dataset.phase = f.phase; });
    for (const k of ['gas', 'brake'] as const) { const v = Math.round((k === 'gas' ? f.gas : f.brake) * 50) / 50; this.put(k, v, () => { const s = this.q<SVGSVGElement>(`#pad .pedal.${k} svg`); if (s) pedalPose(s, pedalPress(v)); }); }
    this.put('hand', f.hand > 0.5 ? 1 : 0, () => { this.q('#hhand')?.classList.toggle('pulled', f.hand > 0.5); });
    if (this.lay === 'pc') { const a = Math.round(-f.wheelRad * 180 / Math.PI); this.put('pw', a, () => { const w = this.q('#hwheel .hw'); w?.style.setProperty('--a', `${a}deg`); const t = this.q('#hwheel b'); if (t) t.textContent = `${-a}°`; }); } }
}
