// Synthesised sound (Web Audio, no sample files). The listener is the player's tank: every world sound
// arrives after distance / 343 m/s, quieter and duller with distance (air absorbs the highs).
// Continuous layers: turbine engine, track clatter at the link rate, gun-laying hydraulics, fire bed.
DS.Audio = {
  ctx: null, on: true, vol: 0.8,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.ratio.value = 6; this.comp.attack.value = 0.003; this.comp.release.value = 0.25;
    this.master = c.createGain(); this.master.gain.value = this.on ? this.vol : 0;
    this.comp.connect(this.master); this.master.connect(c.destination);
    // 2 s of white noise shared by every noise voice
    const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    this.loops();
  },
  toggle() { this.on = !this.on; if (this.master) this.master.gain.setTargetAtTime(this.on ? this.vol : 0, this.ctx.currentTime, 0.05); return this.on; },

  // ---------- building blocks ----------
  noise(loop) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = !!loop; s.loopStart = Math.random(); return s; },
  env(g, t, a, peak, decay) {             // attack a s to peak, then exponential decay
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  },
  // where/when a sound at world (x, y) is heard: delay, gain, low-pass cutoff
  place(x, y) {
    const me = this.world && this.world.vehicles[0];
    const d = me ? Math.hypot(x - me.pos.x, y - me.pos.y) : 0;
    return { d, t: this.ctx.currentTime + d / DS.T.sound, g: 30 / (d + 30), cut: Math.max(300, 16000 / (1 + d / 250)) };
  },
  out(node, cut) {                         // route through an air-absorption filter to the compressor
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut;
    node.connect(f); f.connect(this.comp); return f;
  },
  burst(t, dur, type, freq, q, gain, cut, a = 0.002) {
    const c = this.ctx, s = this.noise(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    s.connect(f); f.connect(g); this.out(g, cut); this.env(g, t, a, gain, dur);
    s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
    return f;
  },
  tone(t, f0, f1, dur, gain, cut, type = 'sine', a = 0.003) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    o.connect(g); this.out(g, cut); this.env(g, t, a, gain, dur);
    o.start(t); o.stop(t + a + dur + 0.05);
  },

  // ---------- one-shot events ----------
  ok() { return this.ctx && this.on && this.ctx.state === 'running'; },
  gun(x, y, cal) {                         // main gun: pressure thump + blast + rolling tail
    if (!this.ok()) return;
    const p = this.place(x, y), k = p.g * (cal >= 115 ? 1 : 0.85);
    this.tone(p.t, 75, 32, 0.6, 1.6 * k, p.cut);
    const f = this.burst(p.t, 0.9, 'lowpass', 4000, 0.7, 1.4 * k, p.cut);
    f.frequency.setValueAtTime(Math.min(4000, p.cut), p.t); f.frequency.exponentialRampToValueAtTime(260, p.t + 0.7);
    this.burst(p.t + 0.05, 2.6, 'lowpass', 180, 0.5, 0.5 * k, p.cut, 0.08);          // echo off the dunes
  },
  mg(x, y, heavy) {                        // one round of machine-gun fire
    if (!this.ok()) return;
    const p = this.place(x, y), k = p.g;
    if (heavy) { this.tone(p.t, 140, 60, 0.09, 0.55 * k, p.cut); this.burst(p.t, 0.07, 'bandpass', 900, 0.8, 0.7 * k, p.cut); }
    else { this.tone(p.t, 220, 110, 0.05, 0.25 * k, p.cut); this.burst(p.t, 0.045, 'bandpass', 1700, 0.9, 0.5 * k, p.cut); }
  },
  cannon(x, y) {                           // 25 mm chain gun
    if (!this.ok()) return;
    const p = this.place(x, y), k = p.g;
    this.tone(p.t, 110, 45, 0.14, 0.9 * k, p.cut); this.burst(p.t, 0.12, 'lowpass', 2600, 0.7, 0.9 * k, p.cut);
  },
  tow(x, y) {                              // launch motor bang, then the flight motor's hiss
    if (!this.ok()) return;
    const p = this.place(x, y);
    this.tone(p.t, 150, 60, 0.2, 0.9 * p.g, p.cut); this.burst(p.t, 0.25, 'lowpass', 3000, 0.7, 1.0 * p.g, p.cut);
    const f = this.burst(p.t + 0.1, 1.6, 'bandpass', 2400, 0.8, 0.5 * p.g, p.cut, 0.15); f.frequency.exponentialRampToValueAtTime(900, p.t + 1.6);
  },
  ground(x, y, heat) {                     // shell striking sand
    if (!this.ok()) return;
    const p = this.place(x, y);
    if (heat) { this.tone(p.t, 90, 35, 0.5, 1.1 * p.g, p.cut); this.burst(p.t, 0.8, 'lowpass', 1800, 0.7, 1.0 * p.g, p.cut); }
    else { this.tone(p.t, 120, 50, 0.18, 0.6 * p.g, p.cut); this.burst(p.t, 0.3, 'lowpass', 900, 0.7, 0.5 * p.g, p.cut); }
  },
  bullet(x, y) { if (!this.ok()) return; const p = this.place(x, y); if (p.d > 400) return; this.burst(p.t, 0.05, 'bandpass', 2500, 1.2, 0.15 * p.g, p.cut); },
  clang(t, g, cut, base) {                 // struck armour plate: inharmonic partials
    for (const m of [1, 2.71, 4.45, 6.98]) this.tone(t, base * m * (0.95 + Math.random() * 0.1), base * m * 0.97, 0.25 + 0.5 / m, g / m, cut, 'triangle', 0.001);
  },
  armor(r, mine) {
    if (!this.ok()) return;
    const p = this.place(r.x, r.y), g = mine ? 1.4 : p.g, t = mine ? this.ctx.currentTime : p.t, cut = mine ? 9000 : p.cut;
    if (mine) {                            // inside the tank: a heavy bell-like blow and the hull ringing
      this.tone(t, 60, 40, 0.5, 1.6, cut); this.clang(t, 0.9, cut, 180);
    }
    if (r.result === 'ricochet') {
      this.clang(t, 0.5 * g, cut, 420);
      const c = this.ctx, o = c.createOscillator(), gg = c.createGain(), w = t + 0.03;
      o.type = 'sine'; o.frequency.setValueAtTime(2800, w); o.frequency.exponentialRampToValueAtTime(650, w + 0.55);
      o.connect(gg); this.out(gg, cut); this.env(gg, w, 0.01, 0.35 * g, 0.55); o.start(w); o.stop(w + 0.65);
    } else if (r.result === 'pen') {
      this.clang(t, 0.8 * g, cut, 260); this.burst(t, 0.35, 'bandpass', 1400, 0.6, 0.9 * g, cut);
      this.tone(t, 80, 40, 0.3, 0.8 * g, cut);
    } else this.clang(t, 0.7 * g, cut, 330);
    if (r.ammo.type === 'HEAT' && r.result !== 'ricochet') this.ground(r.x, r.y, true);
  },
  explode(x, y) {                          // ammunition cook-off
    if (!this.ok()) return;
    const p = this.place(x, y);
    this.tone(p.t, 55, 22, 1.8, 2.2 * p.g, p.cut);
    const f = this.burst(p.t, 2.4, 'lowpass', 3000, 0.6, 2.0 * p.g, p.cut);
    f.frequency.setValueAtTime(Math.min(3000, p.cut), p.t); f.frequency.exponentialRampToValueAtTime(150, p.t + 2);
    for (let i = 0; i < 14; i++) this.burst(p.t + 0.2 + Math.random() * 2.5, 0.05, 'highpass', 1800, 0.7, 0.5 * p.g * Math.random(), p.cut);
  },
  breech() {                               // loader closing the breech: round loaded
    if (!this.ok()) return;
    const t = this.ctx.currentTime; this.clang(t, 0.35, 6000, 150); this.burst(t, 0.06, 'bandpass', 3000, 2, 0.3, 8000);
  },

  // ---------- continuous layers ----------
  loops() {
    const c = this.ctx;
    const mk = (src, type, f, q) => { const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(this.comp); return { f: fl, g }; };
    // AGT1500 turbine: two detuned whine tones, intake rush, exhaust rumble
    this.wh1 = c.createOscillator(); this.wh1.type = 'sawtooth'; this.wh2 = c.createOscillator(); this.wh2.type = 'sawtooth';
    this.whine = mk(this.wh1, 'bandpass', 1200, 5); this.wh2.connect(this.whine.f);
    const n1 = this.noise(true); this.rush = mk(n1, 'bandpass', 2200, 0.8);
    const n2 = this.noise(true); this.rumble = mk(n2, 'lowpass', 140, 0.7);
    // track clatter: band-passed noise chopped by a square wave at the link-strike rate
    const n3 = this.noise(true); this.trk = mk(n3, 'bandpass', 950, 1.4);
    this.trkAM = c.createGain(); this.trkAM.gain.value = 0.5;
    this.trk.g.disconnect(); this.trk.g.connect(this.trkAM); this.trkAM.connect(this.comp);
    this.lfo = c.createOscillator(); this.lfo.type = 'square'; this.lfo.frequency.value = 10;
    const lfoG = c.createGain(); lfoG.gain.value = 0.5; this.lfo.connect(lfoG); lfoG.connect(this.trkAM.gain);
    // gun-laying hydraulics and the fire bed (burning wrecks, cook-off jets)
    this.hyd = c.createOscillator(); this.hyd.type = 'triangle'; this.hydL = mk(this.hyd, 'bandpass', 700, 3);
    const n4 = this.noise(true); this.fire = mk(n4, 'lowpass', 500, 0.6);
    for (const s of [this.wh1, this.wh2, n1, n2, n3, this.lfo, this.hyd, n4]) s.start();
  },

  // called every frame with the world
  update(world, dt) {
    this.world = world;
    if (!this.ok() || !this.wh1) return;
    const c = this.ctx, t = c.currentTime, me = world.vehicles[0], set = (p, v) => p.setTargetAtTime(v, t, 0.08);
    if (!me) return;
    const alive = me.alive || me.burning < 2;
    const rpm = alive ? Math.min(1, 0.25 + 0.75 * me.spool + Math.abs(me.vt) / 40) : 0;
    const turb = me.def.engine.type === 'turbine' ? 1 : 0.12, dz = turb === 1 ? 1 : 1.9;     // diesel: little whine, more rumble
    set(this.wh1.frequency, 420 + 900 * rpm); set(this.wh2.frequency, (420 + 900 * rpm) * 1.507);
    set(this.whine.f.frequency, (420 + 900 * rpm) * 2); set(this.whine.g.gain, alive ? (0.02 + 0.05 * rpm) * turb : 0);
    set(this.rush.g.gain, alive ? 0.03 + 0.09 * rpm : 0); set(this.rush.f.frequency, 1600 + 1600 * rpm);
    set(this.rumble.g.gain, alive ? (0.12 + 0.25 * me.spool) * dz : 0); set(this.rumble.f.frequency, turb === 1 ? 140 : 95 + 80 * rpm);
    const v = Math.abs(me.vt), rate = v / me.def.track.pitch / 4;          // audible clank: every 4th link
    set(this.lfo.frequency, Math.max(2, Math.min(120, rate)));
    set(this.trk.g.gain, Math.min(0.5, v / 6) * 0.55);
    const elev = Math.abs(me.input.elevRate) + (me.input.elevStep ? 0.02 : 0);
    set(this.hydL.g.gain, alive ? Math.min(0.05, elev * 1.5) : 0); set(this.hyd.frequency, 520 + elev * 2000);
    // fire bed: every burning vehicle, by distance; cook-off jets roar
    let fire = 0;
    for (const w of world.vehicles) {
      if (!w.burning && !(w.jet > 0)) continue;
      const d = Math.hypot(w.pos.x - me.pos.x, w.pos.y - me.pos.y), g = 30 / (d + 30);
      fire += g * (0.25 + (w.jet > 0 ? 1.2 : 0));
      if (w.burning && Math.random() < dt * 14 * Math.min(1, 300 / (d + 1))) {
        const p = this.place(w.pos.x, w.pos.y); this.burst(p.t, 0.02 + Math.random() * 0.04, 'highpass', 2000, 0.7, 0.3 * p.g, p.cut);
      }
    }
    set(this.fire.g.gain, Math.min(0.9, fire));
    // round loaded
    if (me.gun.reload > 0) this._loading = true;
    else if (this._loading && me.alive) { this._loading = false; this.breech(); }
  },
};
