// The test drive's sounds (review 87, a first pass: synthesised, to be replaced by recordings later). The engine by its
// kind: the firing note (revs x cylinders / 2) as a pulse rich in harmonics, its tone opening with the throttle; a four
// beats unevenly and buzzes, a six is smoother, an eight burbles; overhead valves tick (tappets at the camshaft's
// speed), side valves less, a Knight sleeve-valve engine hardly at all (its famous quiet); a supercharger whines; the
// exhaust crackles on the overrun. Tyres squeal by their slip, the wind rises with speed. Around the track: the crowd by
// the paddock and stands, birds over the grass, now and then a train on the line beside the Railway Straight; knocks,
// gear changes, a blown engine. Opponents' engines by their distance, left and right as they sit on the screen.
// Alpha 0.12 (M2): a designed engine's voice follows its design (designVoice): the cylinders, the banks' firing (an
// in-line engine's even, buzzing note; a cross-plane V8's burble; a flat engine's unequal-header rumble; a V12's smooth
// high wail), the turbos' whoosh and whistle with a blow-off when the throttle shuts, the induction roar of a throttle a
// cylinder; the engine designer revs it on its stand (no tyres, no wind, no surroundings: Sound's `scene` off).
import type { Design } from '../core/design';
export interface EngineVoiceSpec { cylinders: number; kind: 'sv' | 'ohv' | 'sleeve'; supercharged: boolean;
  /** a designed engine's (alpha 0.12; the period cars leave these out and sound as before): how its banks stand and
   *  their angle, its turbos, a throttle a cylinder, its red line */
  banks?: 'I' | 'V' | 'flat'; bankDeg?: number; turbos?: number; itb?: boolean; redline?: number }
/** a designed engine's voice (pure) */
export function designVoice(e: Pick<Design['engine'], 'layout' | 'turbo' | 'intake' | 'redline'>): EngineVoiceSpec {
  const n = +e.layout.replace(/\D/g, '') || 6, banks = e.layout[0] === 'I' ? 'I' : e.layout[0] === 'F' ? 'flat' : 'V';
  return { cylinders: n, kind: 'ohv', supercharged: false, banks, bankDeg: banks === 'I' ? 0 : banks === 'flat' ? 180 : n === 8 || n === 6 ? 90 : n === 10 ? 72 : 60, turbos: e.turbo, itb: e.intake === 'itb', redline: e.redline }; }
/** what the voice is made of, worked out from its spec (pure: the tests read it): the firing note's harmonics' fall (a
 *  higher exponent, a rounder, smoother note), the even harmonics' weight, the half-order beat's depth (an uneven firing:
 *  the cross-plane V8's burble, a flat engine's rumble), the crank's sub-note, the tone's brightness, and the turbos'
 *  whoosh and whistle and the induction roar (0 when there are none) */
export interface VoiceCharacter { fall: number; even: number; beat: number; sub: number; bright: number; whoosh: number; whistle: number; roar: number }
export function voiceCharacter(s: EngineVoiceSpec): VoiceCharacter {
  const cyl = s.cylinders, old = { fall: cyl >= 8 ? 1.1 : cyl >= 6 ? 0.95 : 0.8, even: cyl === 4 ? 0.8 : 0.6, beat: cyl === 4 ? 0.35 : cyl === 6 ? 0.15 : 0.08, sub: cyl >= 8 ? 0.5 : 0.3, bright: 1 };
  if (!s.banks) return { ...old, whoosh: 0, whistle: 0, roar: 0 };
  const t = Math.max(0, s.turbos ?? 0), boosted = t > 0 ? 1 : 0;
  let c = old;
  if (s.banks === 'I') c = { ...old, fall: cyl >= 6 ? 0.9 : 0.75, even: cyl === 4 ? 0.85 : 0.55, beat: cyl === 4 ? 0.3 : 0.06, bright: 1.15 };              // even firing: a straight six the smoothest, a four buzzes
  else if (s.banks === 'flat') c = { ...old, fall: 0.85, even: 0.75, beat: cyl === 4 ? 0.42 : 0.24, sub: 0.55, bright: 0.8 };                        // unequal headers: the rumble, a duller tone
  else if (cyl === 8) c = { ...old, fall: 1.0, even: 0.7, beat: (s.bankDeg ?? 90) === 90 ? 0.26 : 0.1, sub: 0.55 };                                  // the cross-plane burble
  else if (cyl >= 10) c = { ...old, fall: cyl === 12 ? 1.25 : 1.15, even: 0.5, beat: cyl === 12 ? 0.04 : 0.07, sub: 0.35, bright: 1.25 };          // the V12's wail, the V10's scream
  else c = { ...old, fall: 0.95, beat: (s.bankDeg ?? 90) === 90 ? 0.18 : 0.12 };
  // turbos muffle the exhaust (the turbines in its way): less bright, and their own sounds
  return { ...c, bright: c.bright * (boosted ? 0.8 : 1), whoosh: boosted * Math.min(1, 0.5 + 0.15 * t), whistle: boosted * (t >= 3 ? 0.7 : 1), roar: s.itb ? 1 : 0 }; }
export class Sound {
  ctx: AudioContext; master: GainNode; private noise: AudioBuffer; private voices = new Map<unknown, Voice>(); private amb: Ambience;
  private squeal: Squeal[]; private wind: { g: GainNode; f: BiquadFilterNode }; private grass: { g: GainNode; f: BiquadFilterNode }; private others: Squeal;
  /** `scene` false: no surroundings (the engine designer's stand: no breeze under the engine) */
  constructor(o: { scene?: boolean } = {}) { this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ctx.destination);
    const n = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = n;
    this.squeal = [new Squeal(this, -0.5), new Squeal(this, 0.5)]; this.others = new Squeal(this, 0); this.wind = this.band(420, 0.7, 'lowpass'); this.grass = this.band(110, 0.8, 'lowpass'); this.amb = new Ambience(this); if (o.scene === false) this.amb.quiet(); }
  /** a looping noise through a filter, silent until set */
  band(freq: number, q: number, type: BiquadFilterType, out: AudioNode = this.master): { g: GainNode; f: BiquadFilterNode } { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = this.ctx.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(out); s.start(); return { g, f }; }
  get noiseBuffer(): AudioBuffer { return this.noise; }
  voice(key: unknown, spec: EngineVoiceSpec): Voice { let v = this.voices.get(key); if (!v) { v = new Voice(this, spec); this.voices.set(key, v); } return v; }
  dropVoices(keep: Set<unknown>): void { for (const [k, v] of this.voices) if (!keep.has(k)) { v.stop(); this.voices.delete(k); } }
  /** the player's car each frame: tyres and wind; and the surroundings by where on the track */
  /** skid: each side's tyres (left, right), the same strength that lays the marks, and how they slide (sideways, locked, spinning) */
  update(skid: { left: Skid; right: Skid; others: number }, grass: number, speed: number, where: { piece: string; s: number; startDist: number }): void { const t = this.ctx.currentTime;
    this.squeal[0]!.set(skid.left); this.squeal[1]!.set(skid.right); this.others.set({ amount: skid.others, kind: 'side', load: 1 });
    this.grass.g.gain.setTargetAtTime(Math.min(0.4, grass * speed / 30 * 0.4), t, 0.05);
    this.wind.g.gain.setTargetAtTime(Math.min(0.45, (speed / 60) ** 2 * 0.45), t, 0.2); this.wind.f.frequency.setTargetAtTime(300 + speed * 6, t, 0.2);
    this.amb.update(where, speed); }
  /** the train's nearness, 0..1 */
  set train(v: number) { this.amb.trainNear = v; }
  /** one-off: a knock, a gear change, a bang */
  hit(kind: 'knock' | 'shift' | 'bang' | 'thud' | 'joint', strength = 1): void { const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = kind === 'bang' ? 0.5 : 1;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'shift' ? 1800 : kind === 'bang' ? 900 : kind === 'joint' ? 260 : 400; const g = c.createGain(); const dur = kind === 'bang' ? 0.9 : kind === 'shift' ? 0.06 : kind === 'joint' ? 0.05 : 0.18;
    g.gain.setValueAtTime(Math.min(1, (kind === 'bang' ? 0.9 : kind === 'shift' ? 0.25 : kind === 'joint' ? 0.12 : 0.6) * strength), t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + dur + 0.05); }
  /** timber breaking: a thump, then a run of cracks and splinters, the bits landing */
  crash(strength = 1): void { const c = this.ctx, t = c.currentTime, burst = (at: number, f: number, q: number, dur: number, vol: number, type: BiquadFilterType = 'bandpass') => { const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.7 + Math.random() * 0.6;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(vol, t + at + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + at + dur); s.connect(fl).connect(g).connect(this.master); s.start(t + at); s.stop(t + at + dur + 0.05); };
    const v = Math.min(1.3, strength); burst(0, 180, 0.7, 0.25, 0.9 * v, 'lowpass');                         // the blow
    for (let k = 0; k < 7; k++) burst(0.01 + Math.random() * 0.12, 1800 + Math.random() * 2600, 3, 0.04 + Math.random() * 0.05, 0.5 * v);   // the timber cracking
    for (let k = 0; k < 6; k++) burst(0.35 + Math.random() * 0.9, 900 + Math.random() * 900, 4, 0.03, 0.18 * v); }   // pieces landing
  set volume(v: number) { this.master.gain.value = v; }
  close(): void { void this.ctx.close(); }
}
/** a skid: 0..1 (as the marks), how: sliding sideways (a high squeal), locked under brakes (a low groan), spinning (rough) */
export interface Skid { amount: number; kind: 'side' | 'lock' | 'spin'; load: number }
/** one side's tyre noise: a tone that wavers with the slide over a rasp of noise, panned to its side */
class Squeal { private o: OscillatorNode; private bp: BiquadFilterNode; private g: GainNode; private n: { g: GainNode; f: BiquadFilterNode }; private wob: OscillatorNode; private wobD: GainNode;
  constructor(readonly snd: Sound, pan: number) { const c = snd.ctx, p = c.createStereoPanner(); p.pan.value = pan; p.connect(snd.master);
    this.g = c.createGain(); this.g.gain.value = 0; this.g.connect(p); this.o = c.createOscillator(); this.o.type = 'sawtooth'; this.bp = c.createBiquadFilter(); this.bp.type = 'bandpass'; this.bp.Q.value = 6; this.o.connect(this.bp).connect(this.g);
    this.wob = c.createOscillator(); this.wob.frequency.value = 9; this.wobD = c.createGain(); this.wobD.gain.value = 60; this.wob.connect(this.wobD).connect(this.o.frequency);   // the squeal wavers
    this.n = snd.band(1500, 2, 'bandpass', p); this.o.start(); this.wob.start(); }
  set(k: Skid): void { const t = this.snd.ctx.currentTime, a = Math.min(1, k.amount), f = k.kind === 'lock' ? 520 + 180 * k.load : k.kind === 'spin' ? 850 : 1350 + 450 * a + 150 * k.load;
    this.o.frequency.setTargetAtTime(f, t, 0.05); this.bp.frequency.setTargetAtTime(f * 1.2, t, 0.05); this.wob.frequency.setTargetAtTime(k.kind === 'lock' ? 5 : 9 + a * 6, t, 0.1);
    const up = a > 0.01 ? 0.03 : 0.08;   // in with the marks, out a moment after them
    this.g.gain.setTargetAtTime(a * (k.kind === 'spin' ? 0.1 : 0.22), t, up); this.n.g.gain.setTargetAtTime(a * (k.kind === 'spin' ? 0.25 : 0.1), t, up); this.n.f.frequency.setTargetAtTime(k.kind === 'lock' ? 700 : 1600, t, 0.05); } }
/** one engine */
export class Voice {
  private osc: OscillatorNode; private sub: OscillatorNode; private lp: BiquadFilterNode; private g: GainNode; private pan: StereoPannerNode; private tick: { g: GainNode; f: BiquadFilterNode }; private tickLfo: OscillatorNode; private tickDepth: GainNode;
  private whine: OscillatorNode | null = null; private whineG: GainNode | null = null; private crackle: { g: GainNode; f: BiquadFilterNode }; private rough: OscillatorNode; private roughDepth: GainNode;
  private whoosh: { g: GainNode; f: BiquadFilterNode } | null = null; private whistle: OscillatorNode | null = null; private whistleG: GainNode | null = null; private roar: { g: GainNode; f: BiquadFilterNode } | null = null;
  private ch: VoiceCharacter; private lastThr = 0; private spool = 0; private lastT = 0;
  constructor(readonly snd: Sound, readonly spec: EngineVoiceSpec) { const c = snd.ctx, ch = this.ch = voiceCharacter(spec);
    this.pan = c.createStereoPanner(); this.pan.connect(snd.master); this.g = c.createGain(); this.g.gain.value = 0; this.g.connect(this.pan);
    // the firing note: a pulse, harmonics falling slowly; a four adds its half-orders (it beats), an eight is rounder
    const n = 24, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = (1 / k ** ch.fall) * (k % 2 ? 1 : ch.even);
    this.osc = c.createOscillator(); this.osc.setPeriodicWave(c.createPeriodicWave(re, im)); this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 1.2;
    const shaper = c.createWaveShaper(), curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); } shaper.curve = curve;
    this.osc.connect(shaper).connect(this.lp).connect(this.g);
    this.sub = c.createOscillator(); this.sub.type = 'sine'; const subG = c.createGain(); subG.gain.value = ch.sub; this.sub.connect(subG).connect(this.lp);   // the half-speed thump of the crank
    // uneven beat: the note's loudness wobbled at the half-order (rough four, smoother six and eight)
    this.rough = c.createOscillator(); this.rough.type = 'triangle'; this.roughDepth = c.createGain(); this.roughDepth.gain.value = ch.beat; this.rough.connect(this.roughDepth).connect(this.g.gain);
    // the valve gear's tick at the camshaft's speed
    this.tick = snd.band(3200, 2.5, 'bandpass', this.g); this.tickLfo = c.createOscillator(); this.tickLfo.type = 'square'; this.tickDepth = c.createGain(); this.tickLfo.connect(this.tickDepth).connect(this.tick.g.gain);
    this.tick.g.gain.value = spec.kind === 'ohv' ? 0.05 : spec.kind === 'sv' ? 0.025 : 0.006; this.tickDepth.gain.value = this.tick.g.gain.value;
    this.crackle = snd.band(700, 1.5, 'bandpass', this.pan);
    if (spec.supercharged) { this.whine = c.createOscillator(); this.whine.type = 'sine'; this.whineG = c.createGain(); this.whineG.gain.value = 0; this.whine.connect(this.whineG).connect(this.pan); this.whine.start(); }
    // the turbos: the air rushing through the compressors, the shafts' whistle; a throttle a cylinder's roar at the trumpets
    if (ch.whoosh) { this.whoosh = snd.band(2400, 1.2, 'bandpass', this.pan); this.whistle = c.createOscillator(); this.whistle.type = 'sine'; this.whistleG = c.createGain(); this.whistleG.gain.value = 0; this.whistle.connect(this.whistleG).connect(this.pan); this.whistle.start(); }
    if (ch.roar) this.roar = snd.band(600, 1.4, 'bandpass', this.pan);
    this.osc.start(); this.sub.start(); this.rough.start(); this.tickLfo.start(); }
  /** revs, throttle 0..1, loudness 0..1 (distance), pan -1..1, running */
  set(rpm: number, throttle: number, loud: number, pan: number, running: boolean): void { const c = this.snd.ctx, t = c.currentTime, cyl = this.spec.cylinders, fire = Math.max(4, rpm / 60 * cyl / 2), ch = this.ch;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT)); this.lastT = t;
    this.osc.frequency.setTargetAtTime(fire, t, 0.03); this.sub.frequency.setTargetAtTime(fire / 2, t, 0.03); this.rough.frequency.setTargetAtTime(rpm / 120, t, 0.05); this.tickLfo.frequency.setTargetAtTime(rpm / 120 * 2, t, 0.05);
    this.lp.frequency.setTargetAtTime(Math.min(5000, (250 + fire * (1.5 + throttle * 4) * (this.spec.kind === 'sleeve' ? 0.6 : 1)) * ch.bright), t, 0.05);
    const base = running ? (0.12 + throttle * 0.22 + Math.min(0.15, rpm / 6000 * 0.15)) * loud : 0; this.g.gain.setTargetAtTime(base, t, 0.04);
    this.crackle.g.gain.setTargetAtTime(running && throttle < 0.1 && rpm > 1800 ? 0.08 * loud * Math.random() : 0, t, 0.02);   // popping on the overrun
    if (this.whine && this.whineG) { this.whine.frequency.setTargetAtTime(rpm / 60 * 5, t, 0.05); this.whineG.gain.setTargetAtTime(running ? Math.min(0.12, (rpm / 4500) ** 2 * 0.1 * (0.4 + throttle)) * loud : 0, t, 0.05); }
    // the turbos spool up with the revs under throttle (about half a second), down when it shuts; shut at speed, the
    // blow-off valve dumps the charge (a hiss)
    const red = this.spec.redline ?? 7500, r = Math.min(1, rpm / red);
    if (this.whoosh && this.whistle && this.whistleG) { const want = running ? Math.min(1, throttle * Math.max(0, (r - 0.25) / 0.45)) : 0; this.spool += (want - this.spool) * Math.min(1, dt / (want > this.spool ? 0.5 : 0.2));
      this.whoosh.f.frequency.setTargetAtTime(1500 + 3500 * this.spool, t, 0.08); this.whoosh.g.gain.setTargetAtTime(0.09 * ch.whoosh * this.spool * loud, t, 0.06);
      this.whistle.frequency.setTargetAtTime(2500 + 7000 * this.spool * (0.6 + 0.4 * r), t, 0.08); this.whistleG.gain.setTargetAtTime(0.018 * ch.whistle * this.spool * loud, t, 0.06);
      if (this.lastThr > 0.5 && throttle < 0.15 && this.spool > 0.35) this.blowOff(this.spool * loud); }
    if (this.roar) { this.roar.f.frequency.setTargetAtTime(Math.min(3500, 300 + fire * 2.2), t, 0.05); this.roar.g.gain.setTargetAtTime(running ? 0.14 * throttle * (0.3 + 0.7 * r) * loud : 0, t, 0.04); }
    this.lastThr = throttle;
    this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.05); }
  /** the blow-off valve's hiss */
  private blowOff(k: number): void { const c = this.snd.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.snd.noiseBuffer; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = c.createGain();
    g.gain.setValueAtTime(0.22 * k, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45); s.connect(f).connect(g).connect(this.pan); s.start(t); s.stop(t + 0.5); }
  stop(): void { for (const o of [this.osc, this.sub, this.rough, this.tickLfo, this.whine, this.whistle]) try { o?.stop(); } catch { /* stopped */ } this.pan.disconnect(); }
}
/** around the track (temporary: synthesised) */
class Ambience {
  private crowd: { g: GainNode; f: BiquadFilterNode }[]; private breeze: { g: GainNode; f: BiquadFilterNode }; private nextBird = 0; private train = -1; private trainBus: GainNode;
  constructor(readonly snd: Sound) { this.crowd = [500, 900, 1500].map(f => snd.band(f, 1.2, 'bandpass')); this.breeze = snd.band(250, 0.5, 'lowpass'); this.breeze.g.gain.value = 0.05; this.trainBus = snd.ctx.createGain(); this.trainBus.gain.value = 0; this.trainBus.connect(snd.master); }
  /** silent (until update() is called) */
  quiet(): void { this.breeze.g.gain.value = 0; }
  update(where: { piece: string; s: number; startDist: number }, speed: number): void { const c = this.snd.ctx, t = c.currentTime;
    // the crowd: loudest by the stands at the start, a murmur that swells and falls
    const near = Math.max(0, 1 - where.startDist / 500), swell = 0.6 + 0.4 * Math.sin(t * 0.37) * Math.sin(t * 0.11);
    this.crowd.forEach((b, k) => b.g.gain.setTargetAtTime((0.02 + near * 0.12) * swell * (k === 1 ? 1 : 0.6), t, 0.4));
    this.breeze.g.gain.setTargetAtTime(0.04 + 0.03 * Math.sin(t * 0.21), t, 1);
    // birds over the grass when it is quiet
    if (t > this.nextBird) { this.nextBird = t + 2 + Math.random() * 6; if (speed < 35) this.bird(); }
    // the train on the line, as near as it is (set by the page from the train it draws)
    this.trainBus.gain.setTargetAtTime(this.trainNear * 0.3, t, 0.3); if (this.trainNear > 0.02 && Math.random() < 0.1) this.chuff(); void this.train; }
  trainNear = 0;
  private bird(): void { const c = this.snd.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; const f0 = 2800 + Math.random() * 1800; g.gain.value = 0; o.connect(g).connect(this.snd.master);
    for (let k = 0; k < 2 + Math.floor(Math.random() * 4); k++) { const a = t + k * 0.14; o.frequency.setValueAtTime(f0, a); o.frequency.exponentialRampToValueAtTime(f0 * 1.4, a + 0.08); g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(0.05, a + 0.02); g.gain.linearRampToValueAtTime(0, a + 0.1); }
    o.start(t); o.stop(t + 1.2); }
  private chuff(): void { const c = this.snd.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.snd.noiseBuffer; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; const g = c.createGain();
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); s.connect(f).connect(g).connect(this.trainBus); s.start(t); s.stop(t + 0.3); }
}
