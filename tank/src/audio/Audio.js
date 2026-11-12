// Synthesised sound (Web Audio, no sample files). The listener is the player's tank: every world sound
// arrives after distance / 343 m/s, quieter and duller with distance (air absorbs the highs).
// Continuous layers: turbine engine, track clatter at the link rate, gun-laying hydraulics, fire bed.
DS.Audio = {
  ctx: null, on: true, vol: 0.8, hatch: true,

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
    const p = { d, t: this.ctx.currentTime + d / DS.T.sound, g: 30 / (d + 30), cut: Math.max(300, 16000 / (1 + d / 250)) };
    if (!this.hatch && d > 8) { p.cut = Math.min(p.cut, 900); p.g *= 0.55; }      // hatch closed: the outside comes through the armour
    return p;
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
    this.burst(p.t + 0.05, 2.6, 'lowpass', 180, 0.5, 0.5 * k, p.cut, 0.08);
    if (!this.hatch && p.d < 8) this.clang(p.t, 0.6, 3000, 70);             // inside: the whole hull rings
    this.echoes(x, y, 0.5 * k);
  },
  // echoes off the dune crests on either side: delay = there and back at 343 m/s, louder off higher crests
  echoes(x, y, k) {
    const T = this.world && this.world.terrain; if (!T) return;
    const me = this.world.vehicles[0], lx = me ? me.pos.x : x, ly = me ? me.pos.y : y;
    for (const side of [-1, 1]) {
      let best = null;
      for (let d = 60; d < 900; d += 20) { const h = T.height(x + side * d) - y; if (h > 2 && (!best || h > best.h)) best = { d, h }; }
      if (!best) continue;
      const cx = x + side * best.d, path = best.d + Math.hypot(cx - lx, T.height(cx) - ly);
      const t = this.ctx.currentTime + path / DS.T.sound, g = k * Math.min(1, best.h / 12) * 60 / (path + 60);
      if (g < 0.01) continue;
      const f = this.burst(t, 1.4, 'lowpass', 600, 0.6, g, this.hatch ? 2000 : 700, 0.04); f.frequency.exponentialRampToValueAtTime(180, t + 1.2);
    }
  },
  trackSnap(x, y) {                         // a link pin shears: metallic crack, then the run slapping down
    if (!this.ok()) return;
    const p = this.place(x, y);
    this.clang(p.t, 0.8 * p.g, p.cut, 380); this.burst(p.t, 0.08, 'highpass', 2500, 0.8, 0.8 * p.g, p.cut);
    for (let i = 0; i < 7; i++) this.clang(p.t + 0.15 + i * (0.06 + Math.random() * 0.07), 0.25 * p.g, p.cut, 200 + Math.random() * 150);
  },
  // T-72 autoloader cycle, timed to the gun's reload: the elevation drive hauls the gun up to the loading
  // angle (much louder than ordinary laying) and locks it, the carousel turns, the hoist lifts the cassette,
  // the rammer goes in twice (projectile, then charge), the breech closes, the lock lets go and the gun
  // drives back onto the lay.
  autoload(v) {
    if (!this.ok()) return;
    const p = this.place(v.pos.x, v.pos.y); if (p.d > 600) return;
    const G = v.def.gun, T = G.reload, g = p.g * (this.world && v === this.world.vehicles[0] ? 1 : 0.7), cut = p.cut, t = p.t;
    const whine = (at, dur, f0, f1, k) => { this.tone(t + at, f0, f1, dur, 0.16 * k * g, cut, 'sawtooth', 0.04); this.tone(t + at, f0 * 2.02, f1 * 2.02, dur, 0.07 * k * g, cut, 'square', 0.04); this.burst(t + at, dur, 'bandpass', 1500, 1.2, 0.2 * k * g, cut, 0.05); };
    const clunk = (at, k, f = 170) => { this.clang(t + at, 0.5 * k * g, cut, f); this.tone(t + at, 95, 55, 0.12, 0.5 * k * g, cut); };
    whine(0.12, 0.75, 380, 620, 1.5); clunk(0.9, 1.1);                          // gun up, lock
    this.tone(t + 1.1, 150, 135, 1.5, 0.12 * g, cut, 'sawtooth', 0.1);           // carousel turning
    for (let i = 0; i < 11; i++) this.burst(t + 1.15 + i * 0.13, 0.025, 'highpass', 2200, 0.8, 0.22 * g, cut);   // ratchet
    clunk(2.65, 0.7, 240);                                                       // carousel stops
    whine(2.8, 0.55, 300, 520, 0.9); clunk(3.4, 0.6, 300);                       // hoist up
    this.burst(t + 3.55, 0.35, 'bandpass', 900, 0.8, 0.55 * g, cut, 0.02); clunk(3.9, 1.0, 140);                 // rammer: projectile
    whine(4.15, 0.3, 420, 330, 0.6);                                             // cassette to the charge
    this.burst(t + 4.6, 0.3, 'bandpass', 900, 0.8, 0.5 * g, cut, 0.02); clunk(4.9, 0.9, 150);                    // rammer: charge
    whine(5.1, 0.5, 520, 300, 0.8); clunk(5.7, 1.2, 110);                        // hoist down, breech closes
    clunk(T - G.autoloader.out, 0.9, 200); whine(T - G.autoloader.out + 0.05, 0.8, 600, 400, 1.3);                // unlock, gun back to the lay
  },
  rotorBeat(x, y, k, two) {                 // one blade pass: a soft thump (two-blade rotor: a deeper, heavier whop)
    if (!this.ok()) return;
    const p = this.place(x, y); if (p.d > (two ? 3500 : 2500)) return;
    if (two) { this.tone(p.t, 52, 30, 0.15, 0.85 * k * p.g, Math.min(p.cut, 700)); this.burst(p.t, 0.09, 'bandpass', 300, 0.7, 0.3 * k * p.g, p.cut, 0.01); return; }
    this.tone(p.t, 62, 40, 0.09, 0.5 * k * p.g, Math.min(p.cut, 900)); this.burst(p.t, 0.05, 'bandpass', 420, 0.8, 0.22 * k * p.g, p.cut);
  },
  rocket(x, y, light) {                     // rocket motor: a hard crack, then a tearing roar that climbs away
    if (!this.ok()) return;
    const p = this.place(x, y);
    if (light) { this.burst(p.t, 0.6, 'bandpass', 1100, 0.6, 0.8 * p.g, p.cut, 0.01); return; }
    this.burst(p.t, 0.12, 'highpass', 1200, 0.7, 1.4 * p.g, p.cut);
    const f = this.burst(p.t, 3.2, 'bandpass', 700, 0.5, 1.5 * p.g, p.cut, 0.03); f.frequency.exponentialRampToValueAtTime(240, p.t + 3);
    this.burst(p.t, 2.6, 'lowpass', 160, 0.6, 1.0 * p.g, p.cut, 0.05);
  },
  crack(d, cal) {                           // a supersonic round passing close: the sharp N-wave of its shock
    if (!this.ok()) return;
    const t = this.ctx.currentTime, g = Math.min(1.6, 40 / (d + 8)) * (cal > 0.02 ? 1 : 0.45);
    this.burst(t, 0.022, 'highpass', 2200, 0.7, g, 16000, 0.0008);
    this.burst(t + 0.004, 0.05, 'bandpass', 900, 0.9, g * 0.45, 9000, 0.001);
  },
  whistle(x, y, dur) {                      // an artillery shell coming down: a falling whistle that swells to impact
    if (!this.ok()) return;
    const p = this.place(x, y), c = this.ctx, t = c.currentTime, peak = Math.min(0.5, 0.5 * p.g * 3);
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(1500 + Math.random() * 300, t); o.frequency.exponentialRampToValueAtTime(420, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.97); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    o.connect(g); this.out(g, p.cut); o.start(t); o.stop(t + dur + 0.1);
    const f = this.burst(t, dur, 'bandpass', 2400, 3, peak * 0.5, p.cut, dur * 0.9); f.frequency.exponentialRampToValueAtTime(700, t + dur);
  },
  crackle(x, y, n, dur) {                   // a bomblet strip going off: dozens of small sharp bursts
    if (!this.ok()) return;
    const p = this.place(x, y); if (p.d > 6000) return;
    for (let i = 0; i < n; i++) { const t = p.t + Math.random() * dur; this.burst(t, 0.06, 'bandpass', 1400 + Math.random() * 1200, 0.9, 0.5 * p.g, p.cut); this.tone(t, 130, 60, 0.07, 0.35 * p.g, p.cut); }
  },
  glass(x, y) {                             // every pane of a building going at once, then the fall of shards
    if (!this.ok()) return;
    const p = this.place(x, y); if (p.d > 1500) return;
    this.burst(p.t, 0.5, 'highpass', 3500, 0.7, 1.1 * p.g, p.cut, 0.005);
    for (let i = 0; i < 26; i++) this.tone(p.t + 0.1 + Math.random() * 1.9, 2200 + Math.random() * 3800, 1500, 0.05 + Math.random() * 0.06, 0.12 * p.g * (1 - i / 34), p.cut, 'triangle', 0.001);
  },
  collapse(x, y, dur) {                     // a building coming down: long rumble with cracks and thumps in it
    if (!this.ok()) return;
    const p = this.place(x, y); if (p.d > 4000) return;
    const f = this.burst(p.t, dur + 1.5, 'lowpass', 260, 0.6, 1.6 * p.g, p.cut, 0.3); f.frequency.exponentialRampToValueAtTime(90, p.t + dur + 1.5);
    for (let i = 0; i < 16; i++) { const t = p.t + Math.random() * dur; this.tone(t, 60 + Math.random() * 50, 30, 0.3, 0.9 * p.g, p.cut); this.burst(t, 0.2, 'lowpass', 900, 0.7, 0.6 * p.g, p.cut); }
    for (let i = 0; i < 10; i++) this.clang(p.t + Math.random() * dur, 0.35 * p.g, p.cut, 100 + Math.random() * 160);
  },
  thud(x, y, k) {                           // a heavy object (thrown turret) landing in sand
    if (!this.ok()) return;
    const p = this.place(x, y); this.tone(p.t, 70, 30, 0.4, 1.2 * k * p.g, p.cut); this.burst(p.t, 0.4, 'lowpass', 500, 0.6, 0.8 * k * p.g, p.cut);
    this.clang(p.t + 0.02, 0.4 * k * p.g, p.cut, 120);
  },
  tick(x, y, k) {                           // small metal debris hitting the ground
    if (!this.ok()) return;
    const p = this.place(x, y); if (p.d > 250) return;
    this.tone(p.t, 900 + Math.random() * 900, 600, 0.06, 0.15 * k * p.g, p.cut, 'triangle', 0.001);
  },
  blastRoll(x, y, k) {                      // the low roll of a blast wave going past
    if (!this.ok()) return;
    const p = this.place(x, y); this.burst(p.t + 0.05, 1.8, 'lowpass', 90, 0.5, 0.7 * k * p.g, p.cut, 0.12);
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
    const n5 = this.noise(true); this.wind = mk(n5, 'bandpass', 500, 0.4);
    const n6 = this.noise(true); this.squeal = mk(n6, 'bandpass', 3200, 18);
    this.dsl = c.createOscillator(); this.dsl.type = 'square'; this.dslL = mk(this.dsl, 'lowpass', 220, 1);   // diesel firing pulses
    for (const s of [this.wh1, this.wh2, n1, n2, n3, this.lfo, this.hyd, n4, n5, n6, this.dsl]) s.start();
    this.battleT = 3;
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
    // diesel firing pulses (Bradley, Iraqi tanks): 8 cylinders at idle to full revs
    set(this.dsl.frequency, 25 + 60 * rpm); set(this.dslL.g.gain, alive && turb < 1 ? 0.05 + 0.08 * me.spool : 0);
    // track: idler and sprocket squeal at walking pace, some irregular link knocks
    set(this.squeal.g.gain, v > 0.5 && v < 5 ? 0.025 * Math.sin(t * 2.3) ** 2 * (this.hatch ? 1 : 0.4) : 0);
    set(this.squeal.f.frequency, 2800 + 600 * Math.sin(t * 0.7));
    if (v > 1 && Math.random() < dt * v * 0.8) { const q = me.local(0, -1); this.tick(q.x, q.y, 0.6); }
    // wind over the sand: a hiss that swells and dies away; the sandstorm roars
    const env = world.env || {}, wv = Math.abs(world.wind || 0), gust = 0.6 + 0.4 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1);
    set(this.wind.g.gain, Math.min(0.5, (0.01 + wv * wv * 0.0035) * gust * (this.hatch ? 1 : 0.3))); set(this.wind.f.frequency, env.visibility ? 900 : 450);
    // the rest of the war: distant guns and artillery somewhere over the horizon
    this.battleT -= dt;
    if (this.battleT <= 0) {
      this.battleT = 2 + Math.random() * 9;
      const tt = c.currentTime, g = (0.08 + Math.random() * 0.18) * (this.hatch ? 1 : 0.5);
      const f = this.burst(tt, 2.5 + Math.random() * 2, 'lowpass', 160, 0.6, g, 400, 0.08); f.frequency.exponentialRampToValueAtTime(70, tt + 2);
      if (Math.random() < 0.3) for (let i = 1; i < 4; i++) this.burst(tt + i * (0.4 + Math.random() * 0.5), 1.5, 'lowpass', 140, 0.6, g * 0.6, 400, 0.05);
    }
    // round loaded
    if (me.gun.reload > 0) this._loading = true;
    else if (this._loading && me.alive) { this._loading = false; this.breech(); }
  },
};
