// The drive's cameras and touch pedals (alpha 0.12, ui/drivecam.ts) and the camera kept in the game's settings.
import { describe, it, expect } from 'vitest';
import { pedalValue, spring, angSpring, fovTan, aimPitch, nextView, carEyes, DriveCam, CAM_DEFAULT, type CamCar } from '../ui/drivecam';
import { loadSettings, saveSettings, asSettings, DEFAULTS, SETTINGS_KEY, type KeyStore } from '../ui/shell/settings';
import { Build } from '../render/car/mesh';

describe('touch pedals', () => {
  it('maps the finger\'s height on the pedal to its opening', () => {
    // a pedal 200 px tall from y 100: the bottom closed, the top wide open, the middle half
    expect(pedalValue(300, 100, 200)).toBe(0); expect(pedalValue(290, 100, 200)).toBe(0);   // the bottom's dead band
    expect(pedalValue(100, 100, 200)).toBe(1); expect(pedalValue(110, 100, 200)).toBe(1);
    expect(pedalValue(200, 100, 200)).toBeCloseTo(0.5, 6);
    expect(pedalValue(250, 100, 200)).toBeCloseTo((0.25 - 0.08) / 0.84, 6);
  });
  it('holds the end a finger slid off by, and a pedal with no size gives nothing', () => {
    expect(pedalValue(-50, 100, 200)).toBe(1); expect(pedalValue(900, 100, 200)).toBe(0); expect(pedalValue(150, 100, 0)).toBe(0);
  });
});

describe('camera springs', () => {
  it('settles on the target without overshooting, even at a long frame', () => {
    for (const dt of [1 / 120, 1 / 30, 0.1, 0.5]) { let x = 0, v = 0, max = 0; for (let t = 0; t < 6; t += dt) { [x, v] = spring(x, v, 1, 3, dt); max = Math.max(max, x); }
      expect(max).toBeLessThanOrEqual(1 + 1e-9); expect(x).toBeCloseTo(1, 3); }
  });
  it('is the same path whatever the frame rate', () => {
    let a = 0, va = 0, b = 0, vb = 0; for (let k = 0; k < 60; k++) [a, va] = spring(a, va, 5, 4, 1 / 60); for (let k = 0; k < 10; k++) [b, vb] = spring(b, vb, 5, 4, 1 / 10);
    expect(a).toBeCloseTo(b, 6); expect(va).toBeCloseTo(vb, 6);
  });
  it('turns an angle the short way round', () => {
    let x = 3.0, v = 0; for (let k = 0; k < 400; k++) [x, v] = angSpring(x, v, -3.0, 3, 1 / 60);
    expect(Math.cos(x - -3.0)).toBeCloseTo(1, 4); expect(x).toBeGreaterThan(3.0);   // went on past π, not back through 0
  });
});

describe('framing', () => {
  it('keeps the vertical angle in a wide picture and widens it in a tall one', () => {
    expect(fovTan(16 / 9, 62)).toBeCloseTo(Math.tan(31 * Math.PI / 180), 6);
    const tall = fovTan(390 / 844, 62); expect(tall).toBeGreaterThan(Math.tan(31 * Math.PI / 180));
    expect(Math.atan(tall * 390 / 844) * 360 / Math.PI).toBeGreaterThan(40);   // still about the road's width across
    expect(tall).toBeLessThanOrEqual(Math.tan(48 * Math.PI / 180) + 1e-9);
  });
  it('tilts so the car sits where asked on the picture', () => {
    const tv = Math.tan(31 * Math.PI / 180), drop = 2, dist = 8, p = aimPitch(drop, dist, tv, 0.65);
    // the car's ray below the view's axis, projected: (0.65 - 0.5) * 2 of the half-height
    const below = Math.atan2(drop, dist) - p * Math.PI / 180; expect(Math.tan(below) / tv).toBeCloseTo(0.3, 6);
    expect(aimPitch(drop, dist, tv, 0.5)).toBeCloseTo(Math.atan2(drop, dist) * 180 / Math.PI, 6);
  });
});

describe('the views', () => {
  it('goes round the views, skipping those the car cannot have', () => {
    expect(nextView('far')).toBe('near'); expect(nextView('top')).toBe('far');
    expect(nextView('hood', v => v !== 'cabin')).toBe('cine'); expect(CAM_DEFAULT).toBe('far');
  });
  it('finds the bonnet\'s eye and a seat\'s', () => {
    const b = new Build(); b.name('body').mat('#888888').box(0, 4000, -800, 800, 200, 1000); const plain = carEyes(b.mesh(4000));
    expect(plain.seat).toBeNull(); expect(plain.hood[0]).toBeCloseTo(1600); expect(plain.height).toBe(1000);
    b.name('seat').mat('#553322').box(2200, 2700, 100, 600, 300, 900); const e = carEyes(b.mesh(4000));
    expect(e.seat).not.toBeNull(); const [sx, sy, sz] = e.seat!; expect(sx).toBeGreaterThan(2200); expect(sx).toBeLessThan(2700); expect(sy).toBeCloseTo(350); expect(sz).toBeGreaterThan(900);
  });
  it('chases from behind and above, further and wider at speed, never into the ground', () => {
    const b = new Build(); b.name('body').mat('#888888').box(0, 4000, -400, 400, 200, 1300); const E = carEyes(b.mesh(4000));
    const car = (speed: number): CamCar => ({ x: 0, y: 0, z: 0, yaw: 0, vx: speed, vy: 0, speed, r: 0, pitch: 0, roll: 0 });
    const cam = new DriveCam(), still = cam.step('far', car(0), E, () => 0, 16 / 9, 1 / 60);
    expect(still.eye[0]).toBeLessThan(-2 - 4); expect(still.eye[2]).toBeGreaterThan(1.8); expect(still.pitch).toBeGreaterThan(0); expect(still.pitch).toBeLessThan(20);
    let fast = still; for (let k = 0; k < 600; k++) fast = cam.step('far', car(60), E, () => 0, 16 / 9, 1 / 60);
    expect(fast.eye[0]).toBeLessThan(still.eye[0]); expect(fast.fov).toBeGreaterThan(still.fov);
    const low = new DriveCam().step('near', car(0), E, () => 3, 16 / 9, 1 / 60); expect(low.eye[2]).toBeGreaterThanOrEqual(3.7 - 1e-9);   // a rise behind the car
    const hood = new DriveCam().step('hood', car(0), E, () => 0, 16 / 9, 1 / 60); expect(hood.eye[0]).toBeGreaterThan(0); expect(hood.eye[2]).toBeGreaterThan(1.3); expect(hood.near).toBeLessThan(0.1);
  });
});

describe('the camera kept in the settings', () => {
  const mem = (): KeyStore & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: k => { m.delete(k); } }; };
  it('defaults to the far chase, keeps a choice, and reads rubbish as the default', () => {
    expect(DEFAULTS.camera.view).toBe('far'); const st = mem(), s = loadSettings(st); expect(s.camera.view).toBe('far');
    s.camera.view = 'hood'; expect(saveSettings(st, s)).toBe(true); expect(loadSettings(st).camera.view).toBe('hood');
    expect(asSettings({ camera: { view: 'sideways' } }).camera.view).toBe('far'); expect(asSettings({ graphics: { look: 'toon' } }).camera.view).toBe('far');
    st.m.set(SETTINGS_KEY, '{not json'); expect(loadSettings(st).camera.view).toBe('far');
  });
  it('survives a storage that throws', () => {
    const bad: KeyStore = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    expect(loadSettings(bad).camera.view).toBe('far'); expect(saveSettings(bad, loadSettings(null))).toBe(false);
  });
});
