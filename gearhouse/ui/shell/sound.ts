// The game's sounds, made on the spot (no sound files yet): a few textured noises looped through filters for the tools
// that are held (wire wool, spray gun, masking tape, the lead's flux), the place's sounds (rain, wind, an engine, the
// telephone line) and short sounds made once (a spray can shaken, a knock, a cup set down, tea poured, the telephone
// dial's clicks, the ringing tone, the handset, a voice's murmur). The textures matter more than the filters:
// - grit: sparse sharp grains (steel wool catching on metal, a pencil on paper)
// - crackle: dense tiny clicks (adhesive letting go as tape comes off the roll)
// - hiss: smooth broad noise with a flutter (air and paint through a nozzle)
// The game's own version will use recorded, licensed sounds (docs/version_list.md); these show where they go.

type Tool = 'pencil' | 'eraser' | 'scrape' | 'spray' | 'tape' | 'lead';
export type SoundKind = '' | Tool;
type Once = 'shake' | 'knock' | 'clink' | 'pour' | 'tick' | 'pulses' | 'pickup' | 'hangup' | 'paper' | 'peel' | 'blip' | 'chime' | 'drip' | 'chain' | 'sash' | 'ignite' | 'rattle' | 'bird' | 'creak' | 'car' | 'train' | 'murmur' | 'step';

export class Sound {
  on = true; private ac: AudioContext | null = null; private buf: Record<string, AudioBuffer> = {}; private t = 0;
  private tools: Record<string, { g: GainNode; src: AudioBufferSourceNode[]; base: number; rate: number }> = {};
  private amb: Record<string, { g: GainNode; o?: OscillatorNode; base: number }> = {};
  private ringing: { stop: () => void } | null = null;

  /** browsers let sound start only from a real gesture: on touch screens a press (pointerdown) does not count, the lift
   *  (pointerup, touchend, click) does; an AudioContext made too early stays suspended. So every input calls this: it
   *  makes the context once and resumes it while it is not running. On iPhone and iPad the 'playback' session plays
   *  even with the silent switch on (web audio is muted by it otherwise). */
  unlock() { try { const n = navigator as Navigator & { audioSession?: { type: string } }; if (n.audioSession && n.audioSession.type !== 'playback') n.audioSession.type = 'playback'; } catch { /* older browsers */ }
    this.start(); if (this.ac && this.ac.state !== 'running') void this.ac.resume().catch(() => undefined); }
  get state() { return this.ac?.state ?? 'none'; }

  private make(ac: AudioContext) {
    const sr = ac.sampleRate, mk = (sec: number, f: (i: number, d: Float32Array) => number) => { const b = ac.createBuffer(1, Math.floor(sr * sec), sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = f(i, d); return b; };
    this.buf.white = mk(2, () => Math.random() * 2 - 1);
    // grit: grains 1-4 ms long at random, each a sharp attack decaying, of random loudness
    { const b = ac.createBuffer(1, sr * 2, sr), d = b.getChannelData(0); for (let i = 0; i < d.length;) { const len = Math.floor(sr * (0.001 + Math.random() * 0.003)), amp = Math.random() ** 2; for (let k = 0; k < len && i + k < d.length; k++) d[i + k] = (Math.random() * 2 - 1) * amp * Math.exp(-k / (len * 0.35)); i += len + Math.floor(sr * Math.random() * 0.004); } this.buf.grit = b; }
    // crackle: thousands of tiny clicks a second, a few louder ones (the adhesive's stick-slip)
    { const b = ac.createBuffer(1, sr * 2, sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i += 1 + Math.floor(Math.random() * sr / 2600)) { const amp = Math.random() < 0.06 ? 1 : Math.random() * 0.35, len = 6 + Math.floor(Math.random() * 18); for (let k = 0; k < len && i + k < d.length; k++) d[i + k] = d[i + k]! + (k % 2 ? -1 : 1) * amp * Math.exp(-k / 3); } this.buf.crackle = b; }
    // hiss: noise softened towards pink, with a slow flutter of loudness
    { let p = 0; this.buf.hiss = mk(2, i => { p = p * 0.86 + (Math.random() * 2 - 1) * 0.14; return (p * 2.2 + (Math.random() * 2 - 1) * 0.35) * (0.85 + 0.15 * Math.sin(i / sr * 2 * Math.PI * 7)); }); }
    // sizzle: flux boiling under the soldering iron: crackle and soft noise
    { let p = 0; this.buf.sizzle = mk(2, () => { p = p * 0.97 + (Math.random() * 2 - 1) * 0.03; return p * 3 + (Math.random() < 0.02 ? (Math.random() * 2 - 1) : 0); }); }
    // brown: a slow wandering rumble, a room's air
    { let p = 0; this.buf.brown = mk(3, () => { p = (p + (Math.random() * 2 - 1) * 0.02) * 0.995; return p * 6; }); }
  }
  start() { if (this.ac) return; try { const ac = new AudioContext(); this.make(ac); this.ac = ac;
    const chain = (buf: string, filters: [BiquadFilterType, number, number][], gain: GainNode) => { const s = ac.createBufferSource(); s.buffer = this.buf[buf]!; s.loop = true; let node: AudioNode = s; for (const [type, f, q] of filters) { const bq = ac.createBiquadFilter(); bq.type = type; bq.frequency.value = f; bq.Q.value = q; node.connect(bq); node = bq; } node.connect(gain); s.start(0, Math.random() * 1.5); return s; };
    const tool = (name: Tool, base: number, layers: [string, [BiquadFilterType, number, number][], number][]) => { const g = ac.createGain(); g.gain.value = 0; g.connect(ac.destination); const src = layers.map(([b, f, v]) => { const lg = ac.createGain(); lg.gain.value = v; lg.connect(g); return chain(b, f, lg); }); this.tools[name] = { g, src, base, rate: 1 }; };
    tool('pencil', 0.16, [['grit', [['bandpass', 4200, 1.2]], 1]]);
    tool('eraser', 0.22, [['white', [['bandpass', 900, 0.8]], 1], ['grit', [['lowpass', 1800, 0.7]], 0.5]]);
    tool('scrape', 0.42, [['grit', [['highpass', 1600, 0.7], ['peaking', 4800, 1.2]], 1], ['white', [['bandpass', 380, 1.4]], 0.18]]);   // steel wool: bright grains, a little body
    tool('spray', 0.2, [['hiss', [['highpass', 2200, 0.6], ['lowpass', 10500, 0.5]], 1], ['white', [['bandpass', 600, 0.8]], 0.12]]);   // air and paint, the gun's low rush
    tool('tape', 0.5, [['crackle', [['highpass', 900, 0.7], ['peaking', 2600, 1.4]], 1], ['white', [['bandpass', 1800, 2.5]], 0.15]]);   // adhesive letting go
    tool('lead', 0.22, [['sizzle', [['highpass', 1200, 0.7]], 1], ['crackle', [['highpass', 4000, 0.7]], 0.25]]);                          // flux sizzling under the iron
    const amb = (name: string, base: number, buf: string, filters: [BiquadFilterType, number, number][]) => { const g = ac.createGain(); g.gain.value = 0; g.connect(ac.destination); chain(buf, filters, g); this.amb[name] = { g, base }; };
    amb('rain', 0.3, 'white', [['lowpass', 1500, 0.4]]); amb('drops', 0.12, 'crackle', [['bandpass', 3000, 0.6]]); amb('wind', 0.16, 'white', [['lowpass', 380, 0.7]]); amb('line', 0.035, 'hiss', [['bandpass', 1800, 0.4]]);
    { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 38; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; const g = ac.createGain(); g.gain.value = 0; o.connect(lp).connect(g).connect(ac.destination); o.start(); this.amb.engine = { g, o, base: 0.12 }; }
    amb('simmer', 0.16, 'sizzle', [['bandpass', 650, 0.5]]);
    // the quiet of a place: a room's low air (brown-ish noise), the outdoors far off (air and distant traffic)
    amb('room', 0.09, 'brown', [['lowpass', 220, 0.5]]); amb('outside', 0.07, 'white', [['lowpass', 900, 0.4], ['highshelf', 3000, -12]]);
    { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; const o2 = ac.createOscillator(); o2.frequency.value = 120; const g2 = ac.createGain(); g2.gain.value = 0.35; o2.connect(g2);
      const g = ac.createGain(); g.gain.value = 0; o.connect(lp).connect(g); g2.connect(g); g.connect(ac.destination); o.start(); o2.start(); this.amb.fridge = { g, o, base: 0.018 }; }   // the refrigerator's motor
    { const o = ac.createOscillator(); o.frequency.value = 4500; const am = ac.createGain(); am.gain.value = 0; const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 28; const lg = ac.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
      const lfo2 = ac.createOscillator(); lfo2.type = 'square'; lfo2.frequency.value = 0.9; const lg2 = ac.createGain(); lg2.gain.value = 0.5; lfo2.connect(lg2).connect(am.gain); const g = ac.createGain(); g.gain.value = 0; o.connect(am).connect(g).connect(ac.destination); o.start(); lfo.start(); lfo2.start(); this.amb.crickets = { g, o, base: 0.012 }; }   // crickets: a trill in bursts
    { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 1850; const lfo = ac.createOscillator(); lfo.frequency.value = 5.5; const lg = ac.createGain(); lg.gain.value = 28; lfo.connect(lg).connect(o.frequency); lfo.start(); const g = ac.createGain(); g.gain.value = 0; o.connect(g).connect(ac.destination); o.start(); this.amb.whistle = { g, o, base: 0.03 }; }   // a kettle's whistle, wavering
    { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 60; const g = ac.createGain(); g.gain.value = 0; o.connect(g).connect(ac.destination); o.start(); this.amb.hum = { g, o, base: 0.02 }; }
  } catch { this.ac = null; } }

  /** the tool held this frame ('' for none); amount 0..1 its loudness, pitch its speed (the grains come faster) */
  play(kind: SoundKind, amount = 1, pitch = 1) { const ac = this.ac; if (!ac) return; this.t += 1; const now = ac.currentTime;
    for (const [k, c] of Object.entries(this.tools)) { const on = this.on && k === kind, flutter = k === 'spray' ? 0.9 + Math.random() * 0.2 : 1;
      c.g.gain.setTargetAtTime(on ? c.base * Math.min(1, amount) * flutter : 0, now, on ? 0.015 : 0.04); if (on && Math.abs(pitch - c.rate) > 0.02) { c.rate = pitch; for (const s of c.src) s.playbackRate.setTargetAtTime(pitch, now, 0.05); } } }
  /** the place: rain (with drops), wind, an engine (pitch for its revs), the open telephone line (its hiss and hum) */
  ambient(kind: 'rain' | 'wind' | 'engine' | 'line' | 'simmer' | 'whistle' | 'room' | 'fridge' | 'outside' | 'crickets', amount: number, pitch = 1) { const ac = this.ac; if (!ac) return; const now = ac.currentTime, set = (k: string, a: number) => { const c = this.amb[k]; if (c) c.g.gain.setTargetAtTime(this.on ? a * c.base : 0, now, 0.15); };
    if (kind === 'rain') { set('rain', amount); set('drops', amount); } else if (kind === 'line') { set('line', amount); set('hum', amount); } else set(kind, amount);
    if (kind === 'engine' && this.amb.engine?.o) this.amb.engine.o.frequency.setTargetAtTime(32 * pitch, now, 0.2); }

  /** short sounds made once. `n` for the dial's pulses (the digit), `pitch` for a voice's murmur */
  once(kind: Once, o: { n?: number; pitch?: number; vol?: number } = {}) { const ac = this.ac, nb = this.buf.white; if (!ac || !nb || !this.on) return; const t0 = ac.currentTime, V = o.vol ?? 1;
    const burst = (at: number, f: number, q: number, dur: number, vol: number, type: BiquadFilterType = 'bandpass', buf = nb) => { const s = ac.createBufferSource(); s.buffer = buf; const bp = ac.createBiquadFilter(); bp.type = type; bp.frequency.value = f; bp.Q.value = q; const g = ac.createGain();
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol * V, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, at + dur); s.connect(bp).connect(g).connect(ac.destination); s.start(at, Math.random() * 1.5); s.stop(at + dur + 0.02); };
    const tone = (at: number, f: number, dur: number, vol: number, type: OscillatorType = 'sine', bend = 1) => { const os = ac.createOscillator(); os.type = type; os.frequency.setValueAtTime(f, at); if (bend !== 1) os.frequency.exponentialRampToValueAtTime(f * bend, at + dur); const g = ac.createGain();
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol * V, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, at + dur); os.connect(g).connect(ac.destination); os.start(at); os.stop(at + dur + 0.02); };
    switch (kind) {
      case 'shake': for (let k = 0; k < 9; k++) { const at = t0 + k * 0.085 + Math.random() * 0.012; burst(at, 3200 + Math.random() * 900, 4, 0.05, 0.35); tone(at, 2300 + Math.random() * 500, 0.04, 0.05); if (k % 2) burst(at + 0.02, 900, 1.5, 0.06, 0.12); } break;   // the mixing ball clacking in the can
      case 'step': burst(t0, 520 + Math.random() * 160, 1.4, 0.05, 0.11, 'lowpass'); burst(t0 + 0.01, 2600, 2, 0.015, 0.03, 'bandpass', this.buf.grit); break;   // a leather sole on stone
      case 'knock': for (const [k, at] of [[0, 0], [1, 0.22], [2, 0.38]] as const) { burst(t0 + at, 180 + k * 10, 1.2, 0.12, 0.9); tone(t0 + at, 95, 0.14, 0.35, 'triangle'); } break;
      case 'clink': tone(t0, 2630, 0.35, 0.09); tone(t0, 3950, 0.22, 0.05); tone(t0, 1310, 0.18, 0.04); burst(t0, 5000, 2, 0.02, 0.2); break;          // china on a saucer
      case 'pour': for (let k = 0; k < 14; k++) burst(t0 + k * 0.06, 700 + k * 45 + Math.random() * 80, 3, 0.09, 0.18); burst(t0, 400, 0.7, 0.9, 0.08, 'lowpass'); break;   // the pitch rises as the cup fills
      case 'tick': burst(t0, 3800, 3, 0.012, 0.35); tone(t0, 1900, 0.01, 0.05, 'square'); break;                                                     // the dial's ratchet passing a hole
      case 'pulses': { const n = o.n ?? 1; burst(t0, 300, 0.8, 0.12 + n * 0.1, 0.05, 'lowpass'); for (let k = 0; k < n; k++) { const at = t0 + 0.06 + k * 0.1; burst(at, 2400, 2, 0.015, 0.4); tone(at, 1200, 0.012, 0.07, 'square'); } break; }   // ten pulses a second as the dial runs home
      case 'pickup': burst(t0, 220, 1, 0.08, 0.7); burst(t0 + 0.03, 1800, 2, 0.03, 0.25); break;
      case 'hangup': burst(t0, 160, 1, 0.12, 0.9); tone(t0 + 0.01, 1600, 0.25, 0.06); tone(t0 + 0.01, 2100, 0.2, 0.04); break;                     // the hook and the ringer's tick
      case 'paper': for (let k = 0; k < 5; k++) burst(t0 + k * 0.035 + Math.random() * 0.02, 2500 + Math.random() * 2500, 0.9, 0.05, 0.12, 'bandpass', this.buf.crackle); break;
      case 'peel': burst(t0, 2200, 0.9, 0.25, 0.4, 'bandpass', this.buf.crackle); burst(t0 + 0.2, 1400, 0.9, 0.12, 0.3, 'bandpass', this.buf.crackle); break;
      case 'blip': { const p = o.pitch ?? 1; tone(t0, (210 + Math.random() * 40) * p, 0.05, 0.035, 'triangle', 0.9); break; }                     // a voice's murmur, one syllable
      case 'chime': tone(t0, 1320, 0.6, 0.06); tone(t0 + 0.12, 1760, 0.7, 0.05); break;
      case 'drip': tone(t0, 1050, 0.07, 0.045, 'sine', 1.8); burst(t0, 3200, 4, 0.02, 0.04); break;                                                   // a drop into the basin
      case 'chain': burst(t0, 4200, 6, 0.02, 0.22); tone(t0, 3100, 0.05, 0.025, 'triangle'); burst(t0 + 0.09, 3600, 6, 0.02, 0.16); tone(t0 + 0.1, 900, 0.03, 0.03, 'square'); break;   // the pull chain and the switch inside the socket
      case 'sash': burst(t0, 260, 0.8, 0.5, 0.32, 'lowpass', this.buf.grit); burst(t0 + 0.05, 900, 1.2, 0.35, 0.07, 'bandpass', this.buf.grit); burst(t0 + 0.5, 140, 1, 0.12, 0.45); break;   // wood in its runners, the bump at the end
      case 'ignite': burst(t0, 2800, 0.8, 0.18, 0.32, 'bandpass', this.buf.crackle); burst(t0 + 0.14, 1200, 0.6, 0.35, 0.1); burst(t0 + 0.6, 180, 0.8, 0.4, 0.55, 'lowpass'); burst(t0 + 0.6, 900, 0.5, 0.5, 0.07); break;   // a match struck, the gas catching
      case 'bird': { const n = 2 + Math.floor(Math.random() * 4), f = 2600 + Math.random() * 1800; for (let k = 0; k < n; k++) tone(t0 + k * (0.09 + Math.random() * 0.05), f * (0.9 + Math.random() * 0.25), 0.06 + Math.random() * 0.05, 0.02, 'sine', 1.15 + Math.random() * 0.3); break; }   // a sparrow's few notes
      case 'creak': burst(t0, 380 + Math.random() * 200, 3, 0.45, 0.06, 'bandpass', this.buf.crackle); burst(t0 + 0.2, 300, 4, 0.3, 0.04, 'bandpass', this.buf.crackle); break;   // the house's boards
      case 'car': { const os = ac.createOscillator(); os.type = 'sawtooth'; os.frequency.setValueAtTime(30, t0); os.frequency.linearRampToValueAtTime(44, t0 + 2.2); os.frequency.linearRampToValueAtTime(34, t0 + 4.5); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; const g = ac.createGain();
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05 * V, t0 + 2.2); g.gain.linearRampToValueAtTime(0, t0 + 4.8); os.connect(lp).connect(g).connect(ac.destination); os.start(t0); os.stop(t0 + 5); burst(t0 + 1.2, 700, 0.6, 2.4, 0.02, 'bandpass'); break; }   // a car going by in the street, far off
      case 'train': for (const [f, d] of [[440, 0], [554, 0], [659, 0]] as const) { const os = ac.createOscillator(); os.frequency.value = f; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; const g = ac.createGain();
        g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(0.012 * V, t0 + 0.35); g.gain.setValueAtTime(0.012 * V, t0 + 1.4); g.gain.linearRampToValueAtTime(0, t0 + 2.4); os.connect(lp).connect(g).connect(ac.destination); os.start(t0); os.stop(t0 + 2.5); } break;   // a steam whistle miles away
      case 'murmur': { // one syllable of a voice down the line: no words, only its sound. A buzz at the voice's pitch through two
        // vowel bands chosen at random, then squeezed into the telephone's narrow band, with a little line noise
        const f0 = (112 + Math.random() * 28) * (o.pitch ?? 1), dur = 0.06 + Math.random() * 0.08, os = ac.createOscillator(); os.type = 'sawtooth';
        os.frequency.setValueAtTime(f0, t0); os.frequency.linearRampToValueAtTime(f0 * (0.88 + Math.random() * 0.26), t0 + dur);
        const band = (f: number, q: number, v: number) => { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; const g = ac.createGain(); g.gain.value = v; os.connect(b).connect(g); return g; };
        const tel = ac.createBiquadFilter(); tel.type = 'bandpass'; tel.frequency.value = 1300; tel.Q.value = 0.8; const out = ac.createGain();
        out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(0.32 * V, t0 + 0.012); out.gain.setValueAtTime(0.3 * V, t0 + dur * 0.65); out.gain.exponentialRampToValueAtTime(0.0008, t0 + dur + 0.05);
        band(300 + Math.random() * 550, 5, 1).connect(tel); band(900 + Math.random() * 1400, 6, 0.7).connect(tel); tel.connect(out).connect(ac.destination); os.start(t0); os.stop(t0 + dur + 0.07);
        burst(t0, 2600, 1.2, dur * 0.6, 0.01, 'bandpass'); break; }
      case 'rattle': tone(t0, 1600 + Math.random() * 260, 0.04, 0.022, 'triangle'); burst(t0, 2600, 3, 0.02, 0.05); break;                               // the kettle's lid on the boil
    } }
  private dt: { stop: () => void } | null = null;
  /** the dial tone when the handset is lifted: 350 and 440 Hz, steady (the American 'precise' tone) */
  dialTone(on: boolean) { const ac = this.ac; if (!on) { this.dt?.stop(); this.dt = null; return; } if (!ac || this.dt || !this.on) return;
    const g = ac.createGain(); g.gain.value = 0.025; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; g.connect(lp).connect(ac.destination); const os = [350, 440].map(f => { const o = ac.createOscillator(); o.frequency.value = f; o.connect(g); o.start(); return o; });
    this.dt = { stop: () => { for (const o of os) o.stop(); g.disconnect(); } }; }
  /** the ringing tone heard while the other end rings: 440 and 480 Hz, two seconds on, four off (the American pattern) */
  ring(on: boolean) { const ac = this.ac; if (!on) { this.ringing?.stop(); this.ringing = null; return; } if (!ac || this.ringing || !this.on) return;
    const g = ac.createGain(); g.gain.value = 0; g.connect(ac.destination); const os = [440, 480].map(f => { const o = ac.createOscillator(); o.frequency.value = f; o.connect(g); o.start(); return o; }), t0 = ac.currentTime;
    for (let k = 0; k < 20; k++) { const at = t0 + 0.2 + k * 6; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.035, at + 0.02); g.gain.setValueAtTime(0.035, at + 2); g.gain.linearRampToValueAtTime(0, at + 2.02); }
    this.ringing = { stop: () => { for (const o of os) o.stop(); g.disconnect(); } }; }
}
