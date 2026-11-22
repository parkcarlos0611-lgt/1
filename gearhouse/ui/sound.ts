// The test drive's sounds (review 87, a first pass: synthesised, to be replaced by recordings later). The engine by its
// kind: the firing note (revs x cylinders / 2) as a pulse rich in harmonics, its tone opening with the throttle; a four
// beats unevenly and buzzes, a six is smoother, an eight burbles; overhead valves tick (tappets at the camshaft's
// speed), side valves less, a Knight sleeve-valve engine hardly at all (its famous quiet); a supercharger whines; the
// exhaust crackles on the overrun. Tyres squeal by their slip, the wind rises with speed. Around the track: the crowd by
// the paddock and stands, birds over the grass, now and then a train on the line beside the Railway Straight; knocks,
// gear changes, a blown engine. Opponents' engines by their distance, left and right as they sit on the screen.
export interface EngineVoiceSpec { cylinders: number; kind: 'sv' | 'ohv' | 'sleeve'; supercharged: boolean }
export class Sound {
  ctx: AudioContext; master: GainNode; private noise: AudioBuffer; private voices = new Map<unknown, Voice>(); private amb: Ambience;
  private tyre: { g: GainNode; f: BiquadFilterNode }; private wind: { g: GainNode; f: BiquadFilterNode };
  constructor() { this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ctx.destination);
    const n = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = n;
    this.tyre = this.band(1100, 4, 'bandpass'); this.wind = this.band(420, 0.7, 'lowpass'); this.amb = new Ambience(this); }
  /** a looping noise through a filter, silent until set */
  band(freq: number, q: number, type: BiquadFilterType, out: AudioNode = this.master): { g: GainNode; f: BiquadFilterNode } { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = this.ctx.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(out); s.start(); return { g, f }; }
  get noiseBuffer(): AudioBuffer { return this.noise; }
  voice(key: unknown, spec: EngineVoiceSpec): Voice { let v = this.voices.get(key); if (!v) { v = new Voice(this, spec); this.voices.set(key, v); } return v; }
  dropVoices(keep: Set<unknown>): void { for (const [k, v] of this.voices) if (!keep.has(k)) { v.stop(); this.voices.delete(k); } }
  /** the player's car each frame: tyres and wind; and the surroundings by where on the track */
  update(slip: number, speed: number, where: { piece: string; s: number; startDist: number }): void { const t = this.ctx.currentTime;
    this.tyre.g.gain.setTargetAtTime(Math.min(0.35, Math.max(0, slip - 0.8) * 0.25), t, 0.04); this.tyre.f.frequency.setTargetAtTime(900 + Math.min(600, speed * 8), t, 0.1);
    this.wind.g.gain.setTargetAtTime(Math.min(0.45, (speed / 60) ** 2 * 0.45), t, 0.2); this.wind.f.frequency.setTargetAtTime(300 + speed * 6, t, 0.2);
    this.amb.update(where, speed); }
  /** one-off: a knock, a gear change, a bang */
  hit(kind: 'knock' | 'shift' | 'bang' | 'thud', strength = 1): void { const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = kind === 'bang' ? 0.5 : 1;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'shift' ? 1800 : kind === 'bang' ? 900 : 400; const g = c.createGain(); const dur = kind === 'bang' ? 0.9 : kind === 'shift' ? 0.06 : 0.18;
    g.gain.setValueAtTime(Math.min(1, (kind === 'bang' ? 0.9 : kind === 'shift' ? 0.25 : 0.6) * strength), t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + dur + 0.05); }
  set volume(v: number) { this.master.gain.value = v; }
  close(): void { void this.ctx.close(); }
}
/** one engine */
export class Voice {
  private osc: OscillatorNode; private sub: OscillatorNode; private lp: BiquadFilterNode; private g: GainNode; private pan: StereoPannerNode; private tick: { g: GainNode; f: BiquadFilterNode }; private tickLfo: OscillatorNode; private tickDepth: GainNode;
  private whine: OscillatorNode | null = null; private whineG: GainNode | null = null; private crackle: { g: GainNode; f: BiquadFilterNode }; private rough: OscillatorNode; private roughDepth: GainNode;
  constructor(readonly snd: Sound, readonly spec: EngineVoiceSpec) { const c = snd.ctx;
    this.pan = c.createStereoPanner(); this.pan.connect(snd.master); this.g = c.createGain(); this.g.gain.value = 0; this.g.connect(this.pan);
    // the firing note: a pulse, harmonics falling slowly; a four adds its half-orders (it beats), an eight is rounder
    const n = 24, re = new Float32Array(n), im = new Float32Array(n), cyl = spec.cylinders; for (let k = 1; k < n; k++) im[k] = (1 / k ** (cyl >= 8 ? 1.1 : cyl >= 6 ? 0.95 : 0.8)) * (k % 2 ? 1 : cyl === 4 ? 0.8 : 0.6);
    this.osc = c.createOscillator(); this.osc.setPeriodicWave(c.createPeriodicWave(re, im)); this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 1.2;
    const shaper = c.createWaveShaper(), curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); } shaper.curve = curve;
    this.osc.connect(shaper).connect(this.lp).connect(this.g);
    this.sub = c.createOscillator(); this.sub.type = 'sine'; const subG = c.createGain(); subG.gain.value = cyl >= 8 ? 0.5 : 0.3; this.sub.connect(subG).connect(this.lp);   // the half-speed thump of the crank
    // uneven beat: the note's loudness wobbled at the half-order (rough four, smoother six and eight)
    this.rough = c.createOscillator(); this.rough.type = 'triangle'; this.roughDepth = c.createGain(); this.roughDepth.gain.value = cyl === 4 ? 0.35 : cyl === 6 ? 0.15 : 0.08; this.rough.connect(this.roughDepth).connect(this.g.gain);
    // the valve gear's tick at the camshaft's speed
    this.tick = snd.band(3200, 2.5, 'bandpass', this.g); this.tickLfo = c.createOscillator(); this.tickLfo.type = 'square'; this.tickDepth = c.createGain(); this.tickLfo.connect(this.tickDepth).connect(this.tick.g.gain);
    this.tick.g.gain.value = spec.kind === 'ohv' ? 0.05 : spec.kind === 'sv' ? 0.025 : 0.006; this.tickDepth.gain.value = this.tick.g.gain.value;
    this.crackle = snd.band(700, 1.5, 'bandpass', this.pan);
    if (spec.supercharged) { this.whine = c.createOscillator(); this.whine.type = 'sine'; this.whineG = c.createGain(); this.whineG.gain.value = 0; this.whine.connect(this.whineG).connect(this.pan); this.whine.start(); }
    this.osc.start(); this.sub.start(); this.rough.start(); this.tickLfo.start(); }
  /** revs, throttle 0..1, loudness 0..1 (distance), pan -1..1, running */
  set(rpm: number, throttle: number, loud: number, pan: number, running: boolean): void { const c = this.snd.ctx, t = c.currentTime, cyl = this.spec.cylinders, fire = Math.max(4, rpm / 60 * cyl / 2);
    this.osc.frequency.setTargetAtTime(fire, t, 0.03); this.sub.frequency.setTargetAtTime(fire / 2, t, 0.03); this.rough.frequency.setTargetAtTime(rpm / 120, t, 0.05); this.tickLfo.frequency.setTargetAtTime(rpm / 120 * 2, t, 0.05);
    this.lp.frequency.setTargetAtTime(Math.min(5000, 250 + fire * (1.5 + throttle * 4) * (this.spec.kind === 'sleeve' ? 0.6 : 1)), t, 0.05);
    const base = running ? (0.12 + throttle * 0.22 + Math.min(0.15, rpm / 6000 * 0.15)) * loud : 0; this.g.gain.setTargetAtTime(base, t, 0.04);
    this.crackle.g.gain.setTargetAtTime(running && throttle < 0.1 && rpm > 1800 ? 0.08 * loud * Math.random() : 0, t, 0.02);   // popping on the overrun
    if (this.whine && this.whineG) { this.whine.frequency.setTargetAtTime(rpm / 60 * 5, t, 0.05); this.whineG.gain.setTargetAtTime(running ? Math.min(0.12, (rpm / 4500) ** 2 * 0.1 * (0.4 + throttle)) * loud : 0, t, 0.05); }
    this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.05); }
  stop(): void { for (const o of [this.osc, this.sub, this.rough, this.tickLfo, this.whine]) try { o?.stop(); } catch { /* stopped */ } this.pan.disconnect(); }
}
/** around the track (temporary: synthesised) */
class Ambience {
  private crowd: { g: GainNode; f: BiquadFilterNode }[]; private breeze: { g: GainNode; f: BiquadFilterNode }; private nextBird = 0; private train = -1; private trainBus: GainNode;
  constructor(readonly snd: Sound) { this.crowd = [500, 900, 1500].map(f => snd.band(f, 1.2, 'bandpass')); this.breeze = snd.band(250, 0.5, 'lowpass'); this.breeze.g.gain.value = 0.05; this.trainBus = snd.ctx.createGain(); this.trainBus.gain.value = 0; this.trainBus.connect(snd.master); }
  update(where: { piece: string; s: number; startDist: number }, speed: number): void { const c = this.snd.ctx, t = c.currentTime;
    // the crowd: loudest by the stands at the start, a murmur that swells and falls
    const near = Math.max(0, 1 - where.startDist / 500), swell = 0.6 + 0.4 * Math.sin(t * 0.37) * Math.sin(t * 0.11);
    this.crowd.forEach((b, k) => b.g.gain.setTargetAtTime((0.02 + near * 0.12) * swell * (k === 1 ? 1 : 0.6), t, 0.4));
    this.breeze.g.gain.setTargetAtTime(0.04 + 0.03 * Math.sin(t * 0.21), t, 1);
    // birds over the grass when it is quiet
    if (t > this.nextBird) { this.nextBird = t + 2 + Math.random() * 6; if (speed < 35) this.bird(); }
    // a train on the line beside the Railway Straight, now and then
    if (where.piece === 'Railway Straight' && this.train < 0 && Math.random() < 0.002) this.train = t;
    if (this.train >= 0) { const age = t - this.train; if (age > 18) { this.train = -1; this.trainBus.gain.setTargetAtTime(0, t, 0.5); } else { this.trainBus.gain.setTargetAtTime(Math.sin(age / 18 * Math.PI) * 0.25, t, 0.3); if (Math.random() < 0.08) this.chuff(); } } }
  private bird(): void { const c = this.snd.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; const f0 = 2800 + Math.random() * 1800; g.gain.value = 0; o.connect(g).connect(this.snd.master);
    for (let k = 0; k < 2 + Math.floor(Math.random() * 4); k++) { const a = t + k * 0.14; o.frequency.setValueAtTime(f0, a); o.frequency.exponentialRampToValueAtTime(f0 * 1.4, a + 0.08); g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(0.05, a + 0.02); g.gain.linearRampToValueAtTime(0, a + 0.1); }
    o.start(t); o.stop(t + 1.2); }
  private chuff(): void { const c = this.snd.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.snd.noiseBuffer; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; const g = c.createGain();
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); s.connect(f).connect(g).connect(this.trainBus); s.start(t); s.stop(t + 0.3); }
}
