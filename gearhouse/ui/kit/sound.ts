// The interface's short sounds (docs/systems/110 G2), made on the spot: a soft tick to move, a higher one to choose,
// a lower one back, and the chunky button's click (a short low knock and a tick). Off unless switched on (the
// settings' menu sounds). The drive's sound (ui/sound.ts) is a whole engine synthesiser on its own context; these
// few blips keep to a small context of their own so a menu never wakes the engine's.
let ac: AudioContext | null = null, soundOn = false;
export function uiSounds(on: boolean) { soundOn = on; }
export const uiSoundsOn = () => soundOn;
export type Blip = 'move' | 'ok' | 'back' | 'press';
export function blip(kind: Blip) { if (!soundOn) return;
  try { ac ??= new AudioContext(); const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    if (kind === 'press') {   // a knock: a square wave falling an octave in 45 ms, then a bright tick on top
      o.type = 'square'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.045);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      const k = ac.createOscillator(), kg = ac.createGain(); k.type = 'triangle'; k.frequency.setValueAtTime(1800, t); kg.gain.setValueAtTime(0.03, t); kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
      k.connect(kg).connect(ac.destination); k.start(t); k.stop(t + 0.03); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.07); return; }
    const f = kind === 'ok' ? 880 : kind === 'back' ? 330 : 560;
    o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (kind === 'back' ? 0.8 : 1.15), t + 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.1); } catch { /* no sound here */ } }
