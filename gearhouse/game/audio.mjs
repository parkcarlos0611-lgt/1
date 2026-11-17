// Audio: original synthesized background music (no samples, no copyrighted material) + engine / vehicle sounds built
// from the engine design itself (firing pulses per cylinder, era muffler, intake and valvetrain noise).
let ctx = null, master, musicBus, sfxBus, radio, noiseBuf;
export const vol = { music: 0.6, sfx: 0.8, muted: false };
export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  radio = ctx.createBiquadFilter(); radio.type = 'lowpass'; radio.frequency.value = 5200;            // gentle "period radio" top end
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70; radio.connect(hp); hp.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(radio); sfxBus = ctx.createGain(); sfxBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolume(); setInterval(tick, 25);
}
export function applyVolume() { if (!ctx) return; master.gain.value = vol.muted ? 0 : 1; musicBus.gain.value = vol.music * 0.5; sfxBus.gain.value = vol.sfx; }
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// ---------------- instruments ----------------
function env(g, t, a, peak, decay, end) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + decay); return t + (end ?? decay) + 0.05; }
function piano(t, n, vel = 0.5, len = 1.4) { const f = midi(n), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o1.type = 'triangle'; o1.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2.003; lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(9000, f * 8), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 2), t + len);
  const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(lp); o1.connect(lp); lp.connect(g); g.connect(musicBus);
  const e = env(g, t, 0.006, vel * 0.22, len); o1.start(t); o2.start(t); o1.stop(e); o2.stop(e); }
function bass(t, n, vel = 0.6) { const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = midi(n); lp.type = 'lowpass'; lp.frequency.value = 600;
  o.connect(lp); lp.connect(g); g.connect(musicBus); const e = env(g, t, 0.01, vel * 0.35, 0.55); o.start(t); o.stop(e); }
function brush(t, vel = 0.3, len = 0.09) { const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.7;
  s.connect(bp); bp.connect(g); g.connect(musicBus); const e = env(g, t, len > 0.15 ? 0.06 : 0.003, vel * 0.08, len); s.start(t, Math.random()); s.stop(e); }
function reed(t, n, dur, vel = 0.45) { const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  o.type = 'square'; o.frequency.value = midi(n); lfo.frequency.value = 5.2; lg.gain.value = midi(n) * 0.006; lfo.connect(lg); lg.connect(o.frequency);
  lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 1.2; o.connect(lp); lp.connect(g); g.connect(musicBus);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * 0.09, t + 0.06); g.gain.setValueAtTime(vel * 0.08, t + Math.max(0.07, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.2); lfo.stop(t + dur + 0.2); }

// ---------------- songs: chord charts (root midi, chord tones) ----------------
const CH = { '6': [0, 4, 7, 9], 'maj7': [0, 4, 7, 11], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'm6': [0, 3, 7, 9], 'dim': [0, 3, 6, 9], 'm7b5': [0, 3, 6, 10] };
const C = (r, q) => ({ r, q: CH[q] });
// F major turnaround-rich 16-bar form; D minor wartime variant; C major title; Bb ballad for the drawing office
const SONGS = {
  office30: { bpm: 82, swing: 0.62, style: 'stride', bars: [C(53, '6'), C(50, '7'), C(55, 'm7'), C(48, '7'), C(53, '6'), C(53, '7'), C(58, '6'), C(58, 'm6'), C(53, '6'), C(50, '7'), C(55, '7'), C(48, '7'), C(53, '6'), C(50, '7'), C(55, 'm7'), C(48, '7')] },
  office40: { bpm: 90, swing: 0.6, style: 'combo', bars: [C(53, 'maj7'), C(50, 'm7'), C(55, 'm7'), C(48, '7'), C(57, 'm7'), C(50, '7'), C(55, 'm7'), C(48, '7'), C(58, 'maj7'), C(58, 'm6'), C(57, 'm7'), C(50, '7'), C(55, 'm7'), C(48, '7'), C(53, '6'), C(48, '7')] },
  war40: { bpm: 78, swing: 0.58, style: 'combo', bars: [C(50, 'm6'), C(50, 'm6'), C(55, 'm7'), C(45, '7'), C(50, 'm6'), C(52, 'm7b5'), C(45, '7'), C(50, 'm6'), C(55, 'm7'), C(48, '7'), C(53, 'maj7'), C(46, 'maj7'), C(52, 'm7b5'), C(45, '7'), C(50, 'm6'), C(45, '7')] },
  design: { bpm: 64, swing: 0.55, style: 'ballad', bars: [C(46, 'maj7'), C(55, 'm7'), C(48, 'm7'), C(53, '7'), C(46, 'maj7'), C(51, 'maj7'), C(48, 'm7'), C(53, '7')] },
  title: { bpm: 96, swing: 0.62, style: 'combo', bars: [C(48, '6'), C(57, '7'), C(50, 'm7'), C(55, '7'), C(48, '6'), C(48, '7'), C(53, '6'), C(53, 'm6'), C(48, '6'), C(57, '7'), C(50, '7'), C(55, '7')] } };
let song = null, want = 'title', bar = 0, beat = 0, nextT = 0, rng = 1;
const R = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
export const setSong = id => { want = id; };
const near = (n, lo) => { while (n < lo) n += 12; while (n >= lo + 12) n -= 12; return n; };
function tick() {
  if (!ctx || vol.muted || vol.music <= 0) { if (ctx) nextT = ctx.currentTime + 0.1; return; }
  if (!song) { song = SONGS[want]; bar = 0; beat = 0; }
  const spb = 60 / song.bpm; if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.2) { playBeat(nextT, spb); nextT += spb; beat++; if (beat >= 4) { beat = 0; bar = (bar + 1) % song.bars.length; if (SONGS[want] !== song) { song = SONGS[want]; bar = 0; rng = 7 + bar; } } }
}
function playBeat(t, spb) {
  const ch = song.bars[bar], nx = song.bars[(bar + 1) % song.bars.length], root = ch.r, tones = ch.q, off = spb * song.swing;
  const voic = lo => tones.map(i => near(root + i, lo)).sort((a, b) => a - b);
  if (song.style === 'ballad') {                                   // drawing office: soft broken chords, sparse melody
    const v = voic(55); piano(t, v[beat % v.length], 0.32, 2.2); if (beat === 0) piano(t, near(root, 36), 0.4, 3);
    if (beat === 2 || (beat === 3 && R() < 0.4)) piano(t + off, near(root + tones[Math.floor(R() * 4)], 67), 0.3, 1.8); return; }
  // walking / two-feel bass
  const walk = beat === 0 ? root : beat === 2 ? root + tones[2] : beat === 3 ? nx.r + (R() < 0.5 ? 1 : -1) : root + tones[1];
  bass(t, near(walk, 36), beat === 0 ? 0.7 : 0.55);
  // brushes: swish on 1 & 3, tap on 2 & 4 plus swung ghost
  brush(t, beat % 2 ? 0.55 : 0.3, beat % 2 ? 0.08 : 0.32); if (R() < 0.5) brush(t + off, 0.18, 0.05);
  if (song.style === 'stride') {                                   // 1930s stride: left hand bass/chord, right hand melody
    if (beat % 2) voic(57).forEach(n => piano(t, n, 0.3, 0.5)); else piano(t, near(beat === 0 ? root : root + 7, 41), 0.45, 0.9);
    const m = near(root + tones[Math.floor(R() * 4)], 70); if (R() < 0.75) piano(t, m, 0.38, 0.9); if (R() < 0.45) piano(t + off, near(m + (R() < 0.5 ? 2 : -1), 70), 0.3, 0.6); return; }
  // 1940s combo: Charleston comping + reed melody phrases (2-bar call, rest)
  if (beat === 0 || (beat === 1 && R() < 0.5)) voic(55).slice(1).forEach(n => piano(beat ? t + off : t, n, 0.26, 0.6));
  if (bar % 4 < 3 && R() < 0.7) { const n = near(root + tones[Math.floor(R() * 4)] + (R() < 0.2 ? 2 : 0), 65); reed(t, n, spb * (R() < 0.5 ? 0.9 : 1.6), 0.5); }
}

// ---------------- engines ----------------
// firing pattern of one 720-degree cycle: angle list + per-pulse strength (bank / exhaust merge makes some pulses weaker)
function pattern(layout) {
  const even = (n, amp) => ({ ang: Array.from({ length: n }, (_, i) => i * 720 / n), amp: Array.from({ length: n }, (_, i) => (amp ? amp[i % amp.length] : 1)) });
  return { I4: even(4, [1, 0.82]), I6: even(6), I8: even(8), V8: even(8, [1, 0.62, 0.9, 0.58, 1, 0.7, 0.86, 0.6]), V12: even(12), V16: even(16), F4: even(4, [1, 0.9, 0.8, 0.95]), I3: even(3), V6: even(6, [1, 0.8, 0.9]) }[layout] || even(4); }
function cycleWave(layout, head) {
  const p = pattern(layout), N = 48, re = new Float32Array(N), im = new Float32Array(N), width = head === 'sv' ? 34 : 24;   // L-heads: softer, longer pulses
  for (let k = 1; k < N; k++) { let a = 0, b = 0; for (let i = 0; i < p.ang.length; i++) for (let s = 0; s < 6; s++) { const th = (p.ang[i] + s * width / 6) / 720 * 2 * Math.PI, w = p.amp[i] * Math.exp(-s * 0.6);
      a += w * Math.cos(k * th); b += w * Math.sin(k * th); } re[k] = a / (k ** 0.35); im[k] = b / (k ** 0.35); }
  return ctx.createPeriodicWave(re, im); }
// engine voice: e = engine design (layout, head, cyl, litres), era year -> muffler character
export function engineVoice(e, year = 1935, { pan = 0 } = {}) {
  if (!ctx) return null; const cyl = { I4: 4, I6: 6, I8: 8, V8: 8, V12: 12, V16: 16, F4: 4, I3: 3, V6: 6 }[e.layout] || 4;
  const o = ctx.createOscillator(); o.setPeriodicWave(cycleWave(e.layout, e.head));
  const muff = ctx.createBiquadFilter(); muff.type = 'lowpass'; muff.frequency.value = year < 1940 ? 900 : 750; muff.Q.value = 2.2;     // pre-war mufflers: rawer, brighter
  const pipe = ctx.createBiquadFilter(); pipe.type = 'peaking'; pipe.frequency.value = 140 + 40 / (e.litres || 3); pipe.gain.value = 7;
  const nz = ctx.createBufferSource(); nz.buffer = noiseBuf; nz.loop = true; const nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 1800; const ng = ctx.createGain(); ng.gain.value = 0.02;
  const tick = ctx.createOscillator(); tick.type = 'square'; const tg = ctx.createGain(); tg.gain.value = e.head === 'sv' ? 0.004 : 0.012; const thp = ctx.createBiquadFilter(); thp.type = 'highpass'; thp.frequency.value = 2500;
  const g = ctx.createGain(); g.gain.value = 0; const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  o.connect(pipe); pipe.connect(muff); muff.connect(g); nz.connect(nbp); nbp.connect(ng); ng.connect(g); tick.connect(thp); thp.connect(tg); tg.connect(g);
  if (pn) { pn.pan.value = pan; g.connect(pn); pn.connect(sfxBus); } else g.connect(sfxBus);
  o.start(); nz.start(); tick.start(); const size = Math.min(1.2, 0.55 + (e.litres || 3) * 0.12);
  return { cyl,
    set(rpm, load = 0.3, level = 1, at = ctx.currentTime) { const f = rpm / 120; o.frequency.setTargetAtTime(f, at, 0.04); tick.frequency.setTargetAtTime(rpm / 120 * cyl / 2, at, 0.04);
      muff.frequency.setTargetAtTime((year < 1940 ? 500 : 420) + rpm * 0.32 + load * 900, at, 0.05); ng.gain.setTargetAtTime(0.01 + load * 0.03 + rpm / 90000, at, 0.05);
      g.gain.setTargetAtTime(level * size * (0.16 + load * 0.22), at, 0.05); },
    pan(v) { if (pn) pn.pan.value = Math.max(-1, Math.min(1, v)); },
    stop(at = ctx.currentTime) { g.gain.setTargetAtTime(0, at, 0.08); [o, nz, tick].forEach(n => n.stop(at + 0.6)); } };
}
// dyno: idle -> redline -> idle over ~5 s
export function dyno(e, year, redline) { unlock(); const v = engineVoice(e, year); if (!v) return; const t0 = ctx.currentTime + 0.05;
  starter(t0, year); const s = t0 + 1.1; v.set(600, 0.1, 1, s);
  for (let i = 0; i <= 30; i++) { const u = i / 30; v.set(650 + (redline - 650) * u * u, 0.9, 1, s + 0.6 + u * 2.6); }
  v.set(700, 0.05, 0.9, s + 3.5); v.set(650, 0.05, 0.7, s + 4.6); v.stop(s + 5.4); }
// test drive: follow an rpm trace [{t, rpm, load}] from the drive simulation
export function drive(e, year, trace) { unlock(); const v = engineVoice(e, year); if (!v) return; const t0 = ctx.currentTime + 0.05; starter(t0, year); const s = t0 + 1.1;
  for (const p of trace) v.set(p.rpm, p.load, 1, s + p.t); const end = trace.at(-1).t; v.set(700, 0.05, 0.8, s + end + 0.3); v.stop(s + end + 1.5); horn(s + end + 0.4, year); }
// passing car for the title screen
let passer = null;
export function passBy(e, year, x01) { if (!ctx || vol.muted || vol.sfx <= 0) return; if (!passer) { passer = engineVoice(e, year); if (!passer) return; }
  const d = Math.abs(x01 - 0.5); passer.set(1700 - (x01 - 0.5) * 220, 0.35, Math.max(0, 1 - d * 1.8) * 0.8); passer.pan((0.5 - x01) * -1.6); }
export function passEnd() { if (passer) { passer.stop(); passer = null; } }

// ---------------- period effects ----------------
function tone(t, f, dur, type = 'square', vel = 0.1, bus = sfxBus, f2 = null) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  o.connect(g); g.connect(bus); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.01); g.gain.setValueAtTime(vel, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur + 0.05); }
export function starter(t, year) { const slow = year < 1955 ? 3.2 : 5.5; for (let i = 0; i < 4; i++) { const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 260; bp.Q.value = 3;
    s.connect(bp); bp.connect(g); g.connect(sfxBus); env(g, t + i / slow, 0.02, 0.35, 0.22); s.start(t + i / slow, Math.random()); s.stop(t + i / slow + 0.3); } tone(t, 90, 4 / slow, 'sawtooth', 0.03, sfxBus, 110); }
export function horn(t, year) { if (year < 1938) { tone(t, 330, 0.28, 'sawtooth', 0.12, sfxBus, 210); tone(t + 0.3, 210, 0.4, 'sawtooth', 0.12, sfxBus, 330); }   // mechanical klaxon "aa-oo-ga"
  else { tone(t, 392, 0.45, 'square', 0.06); tone(t, 494, 0.45, 'square', 0.05); } }                                                   // electric trumpet pair
export function sfx(kind) { unlock(); if (!ctx || vol.muted) return; const t = ctx.currentTime + 0.01;
  if (kind === 'click') tone(t, 1900, 0.025, 'square', 0.04);
  if (kind === 'type') for (let i = 0; i < 5; i++) tone(t + i * 0.07 + Math.random() * 0.02, 2600 + Math.random() * 600, 0.02, 'square', 0.05);
  if (kind === 'till') { tone(t, 1568, 0.6, 'sine', 0.12); tone(t, 2093, 0.5, 'sine', 0.06); tone(t + 0.02, 3136, 0.3, 'sine', 0.03); }
  if (kind === 'wire') [0, 0.12, 0.2, 0.36].forEach((d, i) => tone(t + d, 760, i % 2 ? 0.06 : 0.11, 'sine', 0.06)); }
export const ready = () => !!ctx;
