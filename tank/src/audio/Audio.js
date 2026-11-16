// Synthesised sound (Web Audio, no sample files). The listener is the player's tank: every world sound
// arrives after distance / 343 m/s, quieter and duller with distance (air absorbs the highs).
// Continuous layers: turbine / diesel engine, track clatter at the link rate, gun-laying hydraulics, fire bed,
// wind and the ambience of the place.
//   S1 space: every sound is panned by where it is (left / right of our tank); the open desert has almost
//      no reverberation, the town a short slap off the walls; with the hatch shut everything is heard
//      through a small ringing steel room. Fast movers (helicopters, jets) are Doppler-shifted.
//   S2 guns: each main gun has its own voice (calibre, pressure, smooth-bore crack or rifled boom, muzzle
//      brake, low-pressure gun with a rocket-assisted round); sabot petals flutter off an APFSDS round.
//   S3 hits: penetration (dull blow, spall rattling inside), ricochet, holding plate (a bell), ERA (an
//      explosive crack), HESH (a heavy slap), HEAT (jet hiss), a round leaving through the far side.
//   S4 loading, by drill: M1A1 (stub base dropping, the ammunition door's hydraulics, the round drawn and
//      rammed), cased guns (the hot brass case clanging onto the floor), Challenger (projectile, then the bag
//      charge and the vent tube), the T-72's carousel autoloader, the BMP-1's loader.
//   S5 engines: the AGT1500 turbine with its spool lag and whistle, the diesels by cylinder count and revs,
//      transmission whine, US rubber-padded double-pin track against Soviet dry single-pin, sand or asphalt.
//   S7 ambience: the burning oil fields' rumble, desert wind, the town (generators, dogs), aircraft passing.
//   S8 mix: effects / engine / ambience buses with their own volume, a cap on simultaneous voices, the rest
//      ducked under a close gun or blast, ringing ears and dulled hearing after a blast close by.
// (S6 crew voices: recorded files, to come.)
DS.Audio = {
  ctx: null, on: true, vol: 0.8, hatch: true, mix: { fx: 1, eng: 1, amb: 1 },
  // gun voices: f0 thump (Hz), crack (sharpness), hi (brightness Hz), tail (s), body (weight), brake, pop
  GUNS: {
    m1a1: { f0: 72, crack: 1.35, hi: 5400, tail: 2.8, body: 1.0 },              // M256 120 mm smooth-bore: very sharp
    challenger1: { f0: 58, crack: 1.0, hi: 3800, tail: 3.2, body: 1.15 },       // L11A5 120 mm rifled: deeper boom
    m60a1: { f0: 86, crack: 1.1, hi: 4600, tail: 2.3, body: 0.8 },              // M68 105 mm
    amx30b2: { f0: 84, crack: 1.05, hi: 4400, tail: 2.3, body: 0.8 },           // CN-105-F1
    t72: { f0: 62, crack: 1.2, hi: 4300, tail: 3.0, body: 1.1 },                // 2A46 125 mm
    t62: { f0: 68, crack: 1.15, hi: 4500, tail: 2.6, body: 0.95 },              // U-5TS 115 mm smooth-bore
    t55: { f0: 78, crack: 1.0, hi: 4000, tail: 2.4, body: 0.85 },               // D-10T 100 mm
    bmp1: { f0: 150, crack: 0.55, hi: 2400, tail: 1.2, body: 0.45, pop: 1 },    // 2A28 73 mm low-pressure + PG-15V motor
    '2s1': { f0: 56, crack: 0.9, hi: 3200, tail: 3.4, body: 1.15, brake: 1 },   // howitzers: muzzle brake side blast
    m109a3: { f0: 50, crack: 0.95, hi: 3200, tail: 3.6, body: 1.25, brake: 1 },
  },
  // engines: diesel cylinders, idle and full revs (rpm); turbines have none
  ENGINES: { m60a1: [12, 700, 2400], t72: [12, 800, 2000], t62: [12, 700, 2000], t55: [12, 700, 2000], challenger1: [12, 700, 2300],
    amx30b2: [12, 700, 2400], bmp1: [6, 800, 2600], m2a2: [8, 800, 2600], '2s1': [8, 700, 2100], m109a3: [8, 700, 2300], m270: [8, 800, 2600] },
  SOVIET_TRACK: { t72: 1, t62: 1, t55: 1, bmp1: 1, '2s1': 1 },

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.ratio.value = 6; this.comp.attack.value = 0.003; this.comp.release.value = 0.25;
    // after the compressor: the "dulled hearing" low-pass (open unless a blast was close), then the master
    this.muffle = c.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.Q.value = 0.5;
    this.master = c.createGain(); this.master.gain.value = this.on ? this.vol : 0;
    this.comp.connect(this.muffle); this.muffle.connect(this.master); this.master.connect(c.destination);
    // buses
    const bus = v => { const g = c.createGain(); g.gain.value = v; g.connect(this.comp); return g; };
    this.fxBus = bus(this.mix.fx); this.engBus = bus(this.mix.eng); this.ambBus = bus(this.mix.amb);
    // reverberation: one send, an open-air tail and a small steel room (hatch shut), and a slap off walls (town)
    this.revSend = c.createGain(); this.revSend.gain.value = 1;
    this.convOut = c.createConvolver(); this.convOut.buffer = this.ir(1.6, 0.45, false);
    this.convIn = c.createConvolver(); this.convIn.buffer = this.ir(0.5, 0.12, true);
    this.gOut = c.createGain(); this.gOut.gain.value = 0.08; this.gIn = c.createGain(); this.gIn.gain.value = 0;
    this.revSend.connect(this.convOut); this.convOut.connect(this.gOut); this.gOut.connect(this.comp);
    this.revSend.connect(this.convIn); this.convIn.connect(this.gIn); this.gIn.connect(this.comp);
    this.slap = c.createDelay(0.5); this.slap.delayTime.value = 0.11;
    const fb = c.createGain(), slF = c.createBiquadFilter(); fb.gain.value = 0.28; slF.type = 'lowpass'; slF.frequency.value = 2400;
    this.gSlap = c.createGain(); this.gSlap.gain.value = 0;
    this.revSend.connect(this.slap); this.slap.connect(slF); slF.connect(fb); fb.connect(this.slap); slF.connect(this.gSlap); this.gSlap.connect(this.comp);
    // 2 s of white noise shared by every noise voice
    const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    this.dummy = c.createBiquadFilter();                       // handed back when a voice is dropped (callers may automate it)
    this.nv = 0; this.curPan = 0; this.curBus = this.fxBus; this.curDry = false;
    this.loops();
  },
  // an impulse response: decaying stereo noise (open air: soft and dark; steel room: short, with ringing modes)
  ir(dur, decay, metal) {
    const c = this.ctx, n = Math.round(c.sampleRate * dur), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / c.sampleRate, e = Math.exp(-t / decay);
        lp += ((Math.random() * 2 - 1) - lp) * (metal ? 0.5 : 0.18);                 // darker for the open air
        d[i] = lp * e * (metal ? 0.6 + 0.4 * Math.sin(t * 2 * Math.PI * (190 + ch * 7)) * Math.sin(t * 2 * Math.PI * 433) : 1);
      }
      if (!metal) for (let k = 0; k < 6; k++) { const j = Math.round((0.02 + Math.random() * 0.12) * c.sampleRate); if (j < n) d[j] += (Math.random() - 0.5) * 0.6; }   // early reflections (ground, crests)
    }
    return b;
  },
  toggle() { this.on = !this.on; if (this.master) this.master.gain.setTargetAtTime(this.on ? this.vol : 0, this.ctx.currentTime, 0.05); return this.on; },
  setMix(m) {
    Object.assign(this.mix, m); if (!this.ctx) return;
    const t = this.ctx.currentTime; this.fxBus.gain.setTargetAtTime(this.mix.fx, t, 0.05);
    this.engBus.gain.setTargetAtTime(this.mix.eng, t, 0.05); this.ambBus.gain.setTargetAtTime(this.mix.amb, t, 0.05);
  },

  // ---------- building blocks ----------
  noise(loop) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = !!loop; s.loopStart = Math.random(); return s; },
  env(g, t, a, peak, decay) {             // attack a s to peak, then exponential decay
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  },
  // where/when a sound at world (x, y) is heard: delay, gain, low-pass cutoff, pan; (vx, vy): the source's
  // velocity, for the Doppler factor dop
  place(x, y, vx, vy) {
    const me = this.world && this.world.vehicles[0];
    const dx = me ? x - me.pos.x : 0, dy = me ? y - me.pos.y : 0, d = Math.hypot(dx, dy);
    const p = { d, t: this.ctx.currentTime + d / DS.T.sound, g: 30 / (d + 30), cut: Math.max(300, 16000 / (1 + d / 250)), pan: Math.max(-1, Math.min(1, dx / (Math.abs(dx) + 45))) * 0.85, dop: 1 };
    if (vx != null && d > 1) { const vr = -(vx * dx + vy * dy) / d; p.dop = DS.T.sound / Math.max(60, DS.T.sound - vr); }
    if (!this.hatch && d > 8) { p.cut = Math.min(p.cut, 900); p.g *= 0.55; p.pan *= 0.4; }      // hatch closed: the outside comes through the armour
    this.curPan = p.pan;
    return p;
  },
  // route through an air-absorption filter and the pan to the current bus, and into the reverberation
  out(node, cut) {
    const c = this.ctx, f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut;
    node.connect(f); let o = f;
    if (this.curPan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = this.curPan; f.connect(p); o = p; }
    o.connect(this.curBus || this.fxBus); if (!this.curDry) o.connect(this.revSend);
    return f;
  },
  // S8: a cap on simultaneous voices; past it, faint sounds are dropped
  room(gain) { return this.nv < 70 || (this.nv < 140 && gain > 0.06) || gain > 0.4; },
  burst(t, dur, type, freq, q, gain, cut, a = 0.002) {
    if (!this.room(gain)) return this.dummy;
    const c = this.ctx, s = this.noise(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    s.connect(f); f.connect(g); this.out(g, cut); this.env(g, t, a, gain, dur);
    this.nv++; s.onended = () => this.nv--;
    s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
    return f;
  },
  tone(t, f0, f1, dur, gain, cut, type = 'sine', a = 0.003) {
    if (!this.room(gain)) return this.dummy;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    o.connect(g); this.out(g, cut); this.env(g, t, a, gain, dur);
    this.nv++; o.onended = () => this.nv--;
    o.start(t); o.stop(t + a + dur + 0.05);
    return o;
  },
  // S8: the engine and the ambience dip under a close gun or blast, and come back
  duck(k, dur) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [b, base] of [[this.engBus, this.mix.eng], [this.ambBus, this.mix.amb]]) {
      b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t);
      b.gain.linearRampToValueAtTime(base * (1 - 0.7 * k), t + 0.02); b.gain.setTargetAtTime(base, t + 0.2, dur / 3);
    }
  },
  // S8: a blast close by: ears ring and hearing goes dull, recovering over a few seconds
  ears(k) {
    if (!this.ok() || k <= 0.05) return;
    const c = this.ctx, t = c.currentTime;
    if (this._earsAt && t - this._earsAt < 0.6) return; this._earsAt = t;
    for (const [f, a] of [[3900 + Math.random() * 600, 0.05], [6200 + Math.random() * 500, 0.02]]) {
      const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a * k, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 + 3.5 * k);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 4.2 * k + 0.6);
    }
    const m = this.muffle.frequency; m.cancelScheduledValues(t); m.setValueAtTime(m.value, t);
    m.exponentialRampToValueAtTime(500 + 1800 * (1 - k), t + 0.03); m.setTargetAtTime(20000, t + 0.5, 0.9 * k + 0.2);
  },

  // ---------- one-shot events ----------
  ok() { const r = this.ctx && this.on && this.ctx.state === 'running'; if (r) { this.curPan = 0; this.curBus = this.fxBus; this.curDry = false; } return r; },
  isMe(v) { return v && this.world && v === this.world.vehicles[0]; },
  // S2: main gun — pressure thump, the sharp crack of the muzzle blast, the blast itself and a rolling tail
  gun(x, y, cal, v, A) {
    if (!this.ok()) return;
    const p = this.place(x, y), G = (v && this.GUNS[v.def.id]) || { f0: cal >= 115 ? 66 : 82, crack: 1, hi: 4200, tail: 2.6, body: cal >= 115 ? 1 : 0.85 };
    const k = p.g * G.body;
    this.tone(p.t, G.f0, G.f0 * 0.42, 0.6, 1.6 * k, p.cut);
    this.burst(p.t, 0.03, 'highpass', Math.min(G.hi, p.cut), 0.7, 1.3 * G.crack * p.g, p.cut, 0.0008);            // the crack
    const f = this.burst(p.t, 0.9, 'lowpass', 4000, 0.7, 1.4 * k, p.cut);
    f.frequency.setValueAtTime(Math.min(G.hi, p.cut), p.t); f.frequency.exponentialRampToValueAtTime(260, p.t + 0.7);
    this.burst(p.t + 0.05, G.tail, 'lowpass', 180, 0.5, 0.5 * k, p.cut, 0.08);
    if (G.brake) this.burst(p.t, 0.18, 'bandpass', 1800, 0.8, 0.8 * p.g, p.cut, 0.001);                            // muzzle brake: side blast
    if (G.pop) { const w = p.t + 0.12; const ff = this.burst(w, 0.9, 'bandpass', 1700, 0.7, 0.5 * p.g, p.cut, 0.02); ff.frequency.exponentialRampToValueAtTime(700, w + 0.9); }   // PG-15V motor lights
    if (A && (A.type === 'APFSDS' || A.type === 'APDS') && p.d < 150)                                             // sabot petals flying off
      for (let i = 0; i < 3; i++) this.tone(p.t + 0.12 + i * 0.03, 900 + Math.random() * 500, 260, 0.35, 0.05 * p.g, p.cut, 'triangle', 0.01);
    const me = this.isMe(v);
    if (!this.hatch && p.d < 8) this.clang(p.t, 0.6, 3000, 70);             // inside: the whole hull rings
    if (p.d < 40) this.duck(me ? 0.8 : 0.5, 1.4);
    this.echoes(x, y, 0.5 * k);
    if (v && !v.def.gun.autoloader && p.d < 60) this.loadDrill(v, p);
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
      this.curPan = Math.max(-0.8, Math.min(0.8, (cx - lx) / (Math.abs(cx - lx) + 45)));
      const f = this.burst(t, 1.4, 'lowpass', 600, 0.6, g, this.hatch ? 2000 : 700, 0.04); f.frequency.exponentialRampToValueAtTime(180, t + 1.2);
    }
  },
  // S4: the loading drill after a shot (player's tank, or one close by), timed to the gun's reload; the breech
  // closing at the end is breech()
  loadDrill(v, p) {
    const id = v.def.id, T = v.gun.reload || v.def.gun.reload, g = this.isMe(v) ? 1 : 0.6 * p.g, t = p.t, cut = p.cut;
    this.curPan = p.pan;
    const clunk = (at, k, f = 170) => { this.clang(t + at, 0.45 * k * g, cut, f); this.tone(t + at, 95, 55, 0.12, 0.45 * k * g, cut); };
    const scrape = (at, dur, k, f = 1100) => this.burst(t + at, dur, 'bandpass', f, 0.9, 0.22 * k * g, cut, dur * 0.3);
    const hiss = (at, dur, k, f0 = 500, f1 = 1400) => { const f = this.burst(t + at, dur, 'bandpass', f0, 1.1, 0.28 * k * g, cut, dur * 0.4); f.frequency.exponentialRampToValueAtTime(f1, t + at + dur); };
    const brass = (at, k) => {                       // a hot brass case clanging onto the turret floor and rolling
      for (const m of [1, 2.32, 3.9, 5.6]) this.tone(t + at, 420 * m, 410 * m, 0.9 / m + 0.2, 0.35 * k * g / m, cut, 'triangle', 0.001);
      for (let i = 0; i < 5; i++) this.clang(t + at + 0.18 + i * (0.08 + Math.random() * 0.1), 0.1 * k * g * (1 - i / 6), cut, 380 + Math.random() * 120);
    };
    const s = Math.min(1, T / 6.5);                   // a quicker drill on a quicker gun
    if (id === 'm1a1') {
      // M829's combustible case leaves only its stub base; the loader hits the knee switch, the ready-rack door
      // slides open on its hydraulics, the round comes out, the door slams, the round is rammed by hand
      clunk(0.35, 0.5, 520); this.tick(v.pos.x, v.pos.y, 0.5);
      hiss(1.0 * s, 0.45, 1); clunk(1.45 * s, 0.9, 140);
      scrape(1.9 * s, 0.5, 1); hiss(2.7 * s, 0.4, 0.9, 1300, 500); clunk(3.1 * s, 1.2, 120);
      scrape(3.8 * s, 0.35, 1.2, 800); this.tone(t + 4.2 * s, 80, 45, 0.15, 0.5 * g, cut);
    } else if (id === 'challenger1') {
      // separate loading: the vent tube pops out, projectile rammed, then the bag charge, a fresh vent tube
      clunk(0.3, 0.7, 300); this.tone(t + 0.45, 2400, 1800, 0.05, 0.08 * g, cut, 'triangle', 0.001);
      scrape(1.6 * s, 0.4, 1); this.tone(t + 2.0 * s, 85, 45, 0.15, 0.5 * g, cut);
      this.burst(t + 3.2 * s, 0.35, 'bandpass', 2200, 0.7, 0.12 * g, cut, 0.08); this.tone(t + 3.5 * s, 70, 50, 0.12, 0.3 * g, cut);   // the bag going in
      this.tone(t + 4.6 * s, 3100, 2600, 0.04, 0.09 * g, cut, 'triangle', 0.001); this.tone(t + 4.65 * s, 2400, 2000, 0.04, 0.08 * g, cut, 'triangle', 0.001);   // vent tube
    } else if (id === 'bmp1') {
      // the 2A28's loader: the conveyor turns and the round is rammed
      this.tone(t + 0.5, 130, 150, 1.4, 0.1 * g, cut, 'sawtooth', 0.1);
      for (let i = 0; i < 8; i++) this.burst(t + 0.55 + i * 0.16, 0.025, 'highpass', 2000, 0.8, 0.15 * g, cut);
      clunk(2.1, 0.8, 220); scrape(2.4, 0.3, 0.8);
    } else if (/^(m60a1|amx30b2|t55|t62)$/.test(id)) {
      // cased rounds: the breech drops open on the run-out and throws the case out; the loader swings the next
      // round in and rams it with his fist (the T-62's case goes out of the rear port: src/fx/Effects.js)
      clunk(0.25, 0.9, 210);
      if (id !== 't62') brass(0.35, 1); else hiss(0.4, 0.5, 0.8, 300, 900);
      scrape(2.2 * s, 0.4, 0.9); this.tone(t + 2.9 * s, 85, 50, 0.12, 0.4 * g, cut);
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
    const G = v.def.gun, T = G.reload, g = p.g * (this.isMe(v) ? 1 : 0.7), cut = p.cut, t = p.t;
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
  rotorBeat(x, y, k, two, vx, vy) {         // one blade pass: a soft thump (two-blade rotor: a deeper, heavier whop), Doppler-shifted
    if (!this.ok()) return;
    const p = this.place(x, y, vx, vy); if (p.d > (two ? 3500 : 2500)) return;
    const D = p.dop;
    if (two) { this.tone(p.t, 52 * D, 30 * D, 0.15, 0.85 * k * p.g, Math.min(p.cut, 700)); this.burst(p.t, 0.09, 'bandpass', 300 * D, 0.7, 0.3 * k * p.g, p.cut, 0.01); return; }
    this.tone(p.t, 62 * D, 40 * D, 0.09, 0.5 * k * p.g, Math.min(p.cut, 900)); this.burst(p.t, 0.05, 'bandpass', 420 * D, 0.8, 0.22 * k * p.g, p.cut);
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
    this.curDry = true;
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
    if (p.d < 120) this.duck(0.6, 3);
  },
  glass(x, y) {                             // every pane of a building going at once, then the fall of shards
    if (!this.ok()) return;
    const p = this.place(x, y); if (p.d > 1500) return;
    this.burst(p.t, 0.5, 'highpass', 3500, 0.7, 1.1 * p.g, p.cut, 0.005);
    for (let i = 0; i < 26; i++) this.tone(p.t + 0.1 + Math.random() * 1.9, 2200 + Math.random() * 3800, 1500, 0.05 + Math.random() * 0.06, 0.12 * p.g * (1 - i / 34), p.cut, 'triangle', 0.001);
  },
  creak(x, y, k, dur) {                     // a storey giving way: groaning steel and concrete cracking, for dur seconds
    if (!this.ok()) return;
    const p = this.place(x, y); if (p.d > 3000) return;
    for (let i = 0; i < 3; i++) { const t = p.t + Math.random() * dur * 0.7; this.tone(t, 90 + Math.random() * 60, 45 + Math.random() * 20, 0.5 + Math.random() * 0.5, 0.35 * k * p.g, Math.min(p.cut, 1200), 'sawtooth', 0.15); }
    for (let i = 0; i < 6 + 6 * k; i++) this.burst(p.t + Math.random() * dur, 0.04, 'highpass', 1800, 0.8, 0.5 * k * p.g, p.cut, 0.001);
  },
  collapse(x, y, dur) {                     // a building coming down: long rumble with cracks and thumps in it
    if (!this.ok()) return;
    const p = this.place(x, y); if (p.d > 4000) return;
    const f = this.burst(p.t, dur + 1.5, 'lowpass', 260, 0.6, 1.6 * p.g, p.cut, 0.3); f.frequency.exponentialRampToValueAtTime(90, p.t + dur + 1.5);
    for (let i = 0; i < 16; i++) { const t = p.t + Math.random() * dur; this.tone(t, 60 + Math.random() * 50, 30, 0.3, 0.9 * p.g, p.cut); this.burst(t, 0.2, 'lowpass', 900, 0.7, 0.6 * p.g, p.cut); }
    for (let i = 0; i < 10; i++) this.clang(p.t + Math.random() * dur, 0.35 * p.g, p.cut, 100 + Math.random() * 160);
    if (p.d < 200) this.duck(0.6, dur + 1);
  },
  thud(x, y, k) {                           // a heavy object (thrown turret) landing in sand
    if (!this.ok()) return;
    const p = this.place(x, y); this.tone(p.t, 70, 30, 0.4, 1.2 * k * p.g, p.cut); this.burst(p.t, 0.4, 'lowpass', 500, 0.6, 0.8 * k * p.g, p.cut);
    this.clang(p.t + 0.02, 0.4 * k * p.g, p.cut, 120);
  },
  tick(x, y, k) {                           // small metal debris hitting the ground
    if (!this.ctx || !this.on || this.ctx.state !== 'running') return;
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
    if (heat && p.d < 150) this.duck(0.5, 1.2);
    if (heat && p.d < 25) this.ears((25 - p.d) / 25 * (this.hatch ? 1 : 0.4));
  },
  bullet(x, y) { if (!this.ok()) return; const p = this.place(x, y); if (p.d > 400) return; this.burst(p.t, 0.05, 'bandpass', 2500, 1.2, 0.15 * p.g, p.cut); },
  clang(t, g, cut, base) {                 // struck armour plate: inharmonic partials
    for (const m of [1, 2.71, 4.45, 6.98]) this.tone(t, base * m * (0.95 + Math.random() * 0.1), base * m * 0.97, 0.25 + 0.5 / m, g / m, cut, 'triangle', 0.001);
  },
  // S3: a hit on armour, by what happened
  armor(r, mine) {
    if (!this.ok()) return;
    const p = this.place(r.x, r.y), g = mine ? 1.4 : p.g, t = mine ? this.ctx.currentTime : p.t, cut = mine ? 9000 : p.cut;
    if (mine) this.curPan = 0;
    const A = r.ammo || {}, big = (A.d || 0.1) > 0.09, base = big ? 1 : 1.6;           // a smaller round rings higher
    if (r.era) {                                                                          // reactive tile going off
      this.burst(t, 0.05, 'highpass', 1500, 0.7, 1.2 * g, cut, 0.0008); this.tone(t, 110, 40, 0.3, 1.0 * g, cut);
      this.burst(t + 0.01, 0.4, 'lowpass', 2200, 0.7, 0.7 * g, cut);
    }
    if (mine) { this.tone(t, 60, 40, 0.5, 1.6, cut); this.clang(t, 0.9, cut, 180); }       // inside: a heavy bell-like blow and the hull ringing
    if (r.result === 'ricochet') {
      this.clang(t, 0.5 * g, cut, 420 * base);
      const c = this.ctx, o = c.createOscillator(), gg = c.createGain(), w = t + 0.03, f0 = 2400 + Math.random() * 900;
      o.type = 'sine'; o.frequency.setValueAtTime(f0, w); o.frequency.exponentialRampToValueAtTime(600, w + 0.55);
      o.connect(gg); this.out(gg, cut); this.env(gg, w, 0.01, 0.35 * g, 0.55); o.start(w); o.stop(w + 0.65);
    } else if (r.result === 'pen') {
      // a dull, heavy blow (the plate gives), then spall rattling round the inside
      this.tone(t, 75, 34, 0.35, 1.0 * g, cut); this.clang(t, 0.55 * g, cut, 210 * base);
      this.burst(t, 0.3, 'bandpass', 1300, 0.6, 0.8 * g, cut);
      if (r.scab) { this.burst(t, 0.22, 'lowpass', 1200, 0.6, 1.1 * g, cut, 0.002); this.tone(t, 55, 30, 0.4, 0.9 * g, cut); }   // HESH: a slap
      const n = mine ? 16 : 7;
      for (let i = 0; i < n; i++) this.burst(t + 0.02 + Math.random() * 0.45, 0.02, 'bandpass', 2500 + Math.random() * 2500, 1.2, (mine ? 0.3 : 0.12) * g * Math.random(), cut);
      if (r.exit) this.clang(t + 0.012, 0.3 * g, Math.min(cut, 2500), 180);              // out through the far side
      if (mine) this.ears(0.85);
    } else {                                                                              // the plate holds: a bell
      this.clang(t, 0.7 * g, cut, 330 * base); this.tone(t, 90, 50, 0.2, 0.4 * g, cut);
      if (mine) this.ears(0.35);
    }
    if (A.type === 'HEAT' && r.result !== 'ricochet') { this.burst(t, 0.04, 'bandpass', 4200, 1, 0.5 * g, cut, 0.001); this.ground(r.x, r.y, true); }   // the jet's hiss
  },
  explode(x, y) {                          // ammunition cook-off
    if (!this.ok()) return;
    const p = this.place(x, y);
    this.tone(p.t, 55, 22, 1.8, 2.2 * p.g, p.cut);
    const f = this.burst(p.t, 2.4, 'lowpass', 3000, 0.6, 2.0 * p.g, p.cut);
    f.frequency.setValueAtTime(Math.min(3000, p.cut), p.t); f.frequency.exponentialRampToValueAtTime(150, p.t + 2);
    for (let i = 0; i < 14; i++) this.burst(p.t + 0.2 + Math.random() * 2.5, 0.05, 'highpass', 1800, 0.7, 0.5 * p.g * Math.random(), p.cut);
    if (p.d < 300) this.duck(0.8, 2.5);
    if (p.d < 40) this.ears((40 - p.d) / 40);
  },
  breech() {                               // the breech block closing: round loaded
    if (!this.ok()) return;
    this.curDry = true;
    const t = this.ctx.currentTime; this.clang(t, 0.35, 6000, 150); this.burst(t, 0.06, 'bandpass', 3000, 2, 0.3, 8000);
  },
  // S7: an aircraft going over (day): jet roar sweeping across with its Doppler drop; an A-10's fan whine on top
  flyover() {
    const c = this.ctx, t = c.currentTime, dir = Math.random() < 0.5 ? -1 : 1, dur = 7 + Math.random() * 3, a10 = Math.random() < 0.5, k = 0.18 + Math.random() * 0.12;
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { pan.pan.setValueAtTime(-0.9 * dir, t); pan.pan.linearRampToValueAtTime(0.9 * dir, t + dur); pan.connect(this.ambBus); }
    const dest = pan || this.ambBus;
    const s = this.noise(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.Q.value = 0.6;
    f.frequency.setValueAtTime(1500, t); f.frequency.linearRampToValueAtTime(1500, t + dur * 0.45); f.frequency.exponentialRampToValueAtTime(600, t + dur * 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(k, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.1);
    if (a10) {
      const o = c.createOscillator(), go = c.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(3100, t); o.frequency.linearRampToValueAtTime(3000, t + dur * 0.45); o.frequency.exponentialRampToValueAtTime(2200, t + dur * 0.6);
      go.gain.setValueAtTime(0.0001, t); go.gain.exponentialRampToValueAtTime(k * 0.08, t + dur * 0.5); go.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(go); go.connect(dest); o.start(t); o.stop(t + dur + 0.1);
    }
  },
  // S7: a dog somewhere in the town: two or three barks
  bark() {
    const t = this.ctx.currentTime + Math.random() * 0.3, n = 1 + Math.floor(Math.random() * 3), f = 420 + Math.random() * 260, g = 0.03 + Math.random() * 0.04;
    this.curBus = this.ambBus; this.curPan = Math.random() * 1.6 - 0.8; this.curDry = false;
    for (let i = 0; i < n; i++) { const w = t + i * (0.22 + Math.random() * 0.1); this.tone(w, f, f * 0.7, 0.1, g, 2400, 'sawtooth', 0.01); this.burst(w, 0.08, 'bandpass', f * 2.2, 1.5, g * 0.8, 2400, 0.005); }
    this.curBus = this.fxBus; this.curPan = 0;
  },

  // ---------- continuous layers ----------
  loops() {
    const c = this.ctx;
    const mk = (src, type, f, q, bus) => { const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(bus || this.engBus); return { f: fl, g }; };
    // AGT1500 turbine: two detuned whine tones, its high whistle, intake rush, exhaust rumble
    this.wh1 = c.createOscillator(); this.wh1.type = 'sawtooth'; this.wh2 = c.createOscillator(); this.wh2.type = 'sawtooth';
    this.whine = mk(this.wh1, 'bandpass', 1200, 5); this.wh2.connect(this.whine.f);
    this.wh3 = c.createOscillator(); this.wh3.type = 'sine'; this.whistleL = mk(this.wh3, 'highpass', 3000, 0.7);
    const n1 = this.noise(true); this.rush = mk(n1, 'bandpass', 2200, 0.8);
    const n2 = this.noise(true); this.rumble = mk(n2, 'lowpass', 140, 0.7);
    // track clatter: band-passed noise chopped by a square wave at the link-strike rate
    const n3 = this.noise(true); this.trk = mk(n3, 'bandpass', 950, 1.4);
    this.trkAM = c.createGain(); this.trkAM.gain.value = 0.5;
    this.trk.g.disconnect(); this.trk.g.connect(this.trkAM); this.trkAM.connect(this.engBus);
    this.lfo = c.createOscillator(); this.lfo.type = 'square'; this.lfo.frequency.value = 10;
    const lfoG = c.createGain(); lfoG.gain.value = 0.5; this.lfo.connect(lfoG); lfoG.connect(this.trkAM.gain);
    // gun-laying hydraulics, transmission whine, track squeal
    this.hyd = c.createOscillator(); this.hyd.type = 'triangle'; this.hydL = mk(this.hyd, 'bandpass', 700, 3);
    this.gear = c.createOscillator(); this.gear.type = 'triangle'; this.gearL = mk(this.gear, 'bandpass', 600, 4);
    const n6 = this.noise(true); this.squeal = mk(n6, 'bandpass', 3200, 18);
    // diesel firing pulses (cylinders × revs) and their harmonics
    this.dsl = c.createOscillator(); this.dsl.type = 'sawtooth'; this.dslL = mk(this.dsl, 'lowpass', 220, 1);
    // ambience: the fire bed (burning wrecks, cook-off jets), wind, the oil fields' rumble, a town generator
    const n4 = this.noise(true); this.fire = mk(n4, 'lowpass', 500, 0.6, this.ambBus);
    const n5 = this.noise(true); this.wind = mk(n5, 'bandpass', 500, 0.4, this.ambBus);
    const n7 = this.noise(true); this.oilRoar = mk(n7, 'lowpass', 70, 0.7, this.ambBus);
    this.gen = c.createOscillator(); this.gen.type = 'sawtooth'; this.gen.frequency.value = 50; this.genL = mk(this.gen, 'lowpass', 320, 2, this.ambBus);   // 50 Hz mains, Kuwait
    for (const s of [this.wh1, this.wh2, this.wh3, n1, n2, n3, this.lfo, this.hyd, this.gear, n4, n5, n6, n7, this.dsl, this.gen]) s.start();
    this.battleT = 3; this.flyT = 30 + Math.random() * 60; this.barkT = 6;
  },

  // called every frame with the world
  update(world, dt) {
    this.world = world;
    if (!this.ok() || !this.wh1) return;
    const c = this.ctx, t = c.currentTime, me = world.vehicles[0], set = (p, v, tc = 0.08) => p.setTargetAtTime(v, t, tc);
    if (!me) return;
    const alive = me.alive || me.burning < 2, id = me.def.id;
    const rpm = alive ? Math.min(1, 0.25 + 0.75 * me.spool + Math.abs(me.vt) / 40) : 0;
    const turbine = me.def.engine.type === 'turbine', turb = turbine ? 1 : 0.12, dz = turbine ? 1 : 1.9;     // diesel: little whine, more rumble
    // S5 turbine: the spool lags the throttle; a thin whistle over it
    const tc = turbine ? 0.6 : 0.08;
    set(this.wh1.frequency, 420 + 900 * rpm, tc); set(this.wh2.frequency, (420 + 900 * rpm) * 1.507, tc);
    set(this.whine.f.frequency, (420 + 900 * rpm) * 2, tc); set(this.whine.g.gain, alive ? (0.02 + 0.05 * rpm) * turb : 0);
    set(this.wh3.frequency, 5200 + 2400 * rpm, tc); set(this.whistleL.g.gain, alive && turbine ? 0.006 + 0.008 * rpm : 0);
    set(this.rush.g.gain, alive ? 0.03 + 0.09 * rpm : 0); set(this.rush.f.frequency, 1600 + 1600 * rpm);
    set(this.rumble.g.gain, alive ? (0.12 + 0.25 * me.spool) * dz : 0); set(this.rumble.f.frequency, turbine ? 140 : 95 + 80 * rpm);
    // S5 diesel: firing frequency = revs / 60 × cylinders / 2 (a V-12 at 700 rpm: 70 Hz)
    const E = this.ENGINES[id] || [8, 750, 2300], revs = E[1] + (E[2] - E[1]) * rpm, ff = revs / 60 * E[0] / 2;
    set(this.dsl.frequency, ff); set(this.dslL.f.frequency, ff * 3); set(this.dslL.g.gain, alive && !turbine ? 0.05 + 0.08 * me.spool : 0);
    // S5 track: US rubber-padded double pin (softer, lower) or Soviet dry single pin (sharp, higher); asphalt rings out
    const v = Math.abs(me.vt), rate = v / me.def.track.pitch / 4;          // audible clank: every 4th link
    const R = DS.MAP, road = !!(R && R.road && me.pos.x >= R.road[0] && me.pos.x <= R.road[1]);
    const sov = this.SOVIET_TRACK[id], sf = road ? 1.3 : 0.8;
    set(this.lfo.frequency, Math.max(2, Math.min(120, rate)));
    set(this.trk.f.frequency, (sov ? 1500 : 700) * sf); this.trk.f.Q.value = sov ? 1.6 : 1.0;
    set(this.trk.g.gain, Math.min(0.5, v / 6) * (sov ? 0.65 : 0.45) * sf);
    set(this.gear.frequency, 260 + v * 55); set(this.gearL.f.frequency, 260 + v * 55); set(this.gearL.g.gain, alive && v > 0.5 ? Math.min(0.02, v * 0.002) : 0);
    const elev = Math.abs(me.input.elevRate) + (me.input.elevStep ? 0.02 : 0);
    set(this.hydL.g.gain, alive ? Math.min(0.05, elev * 1.5) : 0); set(this.hyd.frequency, 520 + elev * 2000);
    // fire bed: every burning vehicle, by distance; cook-off jets roar
    let fire = 0;
    for (const w of world.vehicles) {
      if (!w.burning && !(w.jet > 0)) continue;
      const d = Math.hypot(w.pos.x - me.pos.x, w.pos.y - me.pos.y), g = 30 / (d + 30);
      fire += g * (0.25 + (w.jet > 0 ? 1.2 : 0));
      if (w.burning && Math.random() < dt * 14 * Math.min(1, 300 / (d + 1))) {
        const p = this.place(w.pos.x, w.pos.y); this.curBus = this.ambBus; this.burst(p.t, 0.02 + Math.random() * 0.04, 'highpass', 2000, 0.7, 0.3 * p.g, p.cut); this.curBus = this.fxBus;
      }
    }
    set(this.fire.g.gain, Math.min(0.9, fire));
    // track: idler and sprocket squeal at walking pace, some irregular link knocks (more off a dry pin)
    set(this.squeal.g.gain, v > 0.5 && v < 5 ? 0.025 * Math.sin(t * 2.3) ** 2 * (this.hatch ? 1 : 0.4) : 0);
    set(this.squeal.f.frequency, 2800 + 600 * Math.sin(t * 0.7));
    if (v > 1 && Math.random() < dt * v * (sov ? 1.3 : 0.6)) { const q = me.local(0, -1); this.tick(q.x, q.y, sov ? 0.8 : 0.5); }
    // S7 ambience. Wind over the sand: a hiss that swells and dies away; the sandstorm roars
    const env = world.env || {}, wv = Math.abs(world.wind || 0), gust = 0.6 + 0.4 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1), hk = this.hatch ? 1 : 0.3;
    set(this.wind.g.gain, Math.min(0.5, (0.01 + wv * wv * 0.0035) * gust * hk)); set(this.wind.f.frequency, env.visibility ? 900 : 450);
    // the burning oil fields over the horizon: a deep, steady rumble
    set(this.oilRoar.g.gain, env.visibility || env.oilfires === false ? 0 : 0.05 * (0.8 + 0.2 * Math.sin(t * 0.21)) * hk);
    // the town: a generator somewhere, dogs now and then (most at dusk and at night)
    const district = R && R.town ? R.district(me.pos.x)[2] : null, urban = district && !/^highway/.test(district);
    set(this.genL.g.gain, urban && district !== 'ruins' ? 0.008 * hk : 0, 1);
    this.barkT -= dt;
    if (this.barkT <= 0) { this.barkT = 8 + Math.random() * 20; if (urban && Math.random() < 0.3 + 0.5 * (env.night || 0)) this.bark(); }
    // aircraft overhead in daylight
    this.flyT -= dt;
    if (this.flyT <= 0) { this.flyT = 45 + Math.random() * 90; if (!env.visibility && (env.night || 0) < 0.5) this.flyover(); }
    // S1 space: open desert — barely any tail; the town — a slap off the walls; hatch shut — the steel room
    set(this.gOut.gain, (urban ? 0.16 : 0.07) * (this.hatch ? 1 : 0.4), 0.5);
    set(this.gSlap.gain, urban ? (district === 'centre' ? 0.22 : 0.14) * (this.hatch ? 1 : 0.3) : 0, 0.5);
    set(this.slap.delayTime, district === 'centre' ? 0.085 : 0.12, 0.5);
    set(this.gIn.gain, this.hatch ? 0 : 0.28, 0.2);
    // the rest of the war: distant guns and artillery somewhere over the horizon
    this.battleT -= dt;
    if (this.battleT <= 0) {
      this.battleT = 2 + Math.random() * 9;
      this.curBus = this.ambBus; this.curPan = Math.random() * 1.4 - 0.7; this.curDry = false;
      const tt = c.currentTime, g = (0.08 + Math.random() * 0.18) * (this.hatch ? 1 : 0.5);
      const f = this.burst(tt, 2.5 + Math.random() * 2, 'lowpass', 160, 0.6, g, 400, 0.08); f.frequency.exponentialRampToValueAtTime(70, tt + 2);
      if (Math.random() < 0.3) for (let i = 1; i < 4; i++) this.burst(tt + i * (0.4 + Math.random() * 0.5), 1.5, 'lowpass', 140, 0.6, g * 0.6, 400, 0.05);
      this.curBus = this.fxBus; this.curPan = 0;
    }
    // round loaded
    if (me.gun.reload > 0) this._loading = true;
    else if (this._loading && me.alive) { this._loading = false; this.breech(); }
  },
};
