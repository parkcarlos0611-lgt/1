// Palette + hue-shifted ramp generation (OKLab / OKLCH).
export const hex = h => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const toHex = ([r, g, b]) => '#' + [r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
const s2l = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const l2s = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function rgb2lab([r, g, b]) {
  r = s2l(r); g = s2l(g); b = s2l(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function lab2rgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [l2s(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), l2s(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), l2s(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
}
const lerpHue = (h, t, k) => { let d = ((t - h + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return h + d * k; };
// Build an n-step ramp around a base colour: darker steps drift toward blue/violet, lighter toward warm yellow.
export function autoRamp(base, { steps = 5, baseIdx = 2, dL = 0.1, shift = 0.12, sat = 1 } = {}) {
  const [L, a, b] = rgb2lab(hex(base)); const C = Math.hypot(a, b) * sat, H = Math.atan2(b, a);
  const out = [];
  for (let i = 0; i < steps; i++) {
    const k = i - baseIdx; const L2 = Math.max(0.08, Math.min(0.98, L + k * dL));
    const targ = k < 0 ? 4.6 : 1.5;                          // ~265deg (blue-violet) / ~85deg (yellow)
    const H2 = lerpHue(H, targ, Math.min(1, Math.abs(k) * shift));
    const C2 = C * (k > 0 ? 1 - 0.18 * k : 1 - 0.08 * -k) + (C < 0.02 ? 0 : 0.004 * Math.abs(k));
    out.push(toHex(lab2rgb([L2, C2 * Math.cos(H2), C2 * Math.sin(H2)])));
  }
  const [L0, a0, b0] = rgb2lab(hex(out[0])); const C0 = Math.hypot(a0, b0), H0 = Math.atan2(b0, a0);
  const o = toHex(lab2rgb([Math.max(0.06, L0 - 0.11), C0 * 0.9 * Math.cos(lerpHue(H0, 4.6, 0.3)), C0 * 0.9 * Math.sin(lerpHue(H0, 4.6, 0.3))]));
  return { c: out, o };
}

// Global palette registry: ramp id -> { name, c:[hex...], o: outline hex }
export class Palette {
  constructor() { this.ramps = [null]; this.byName = {}; }
  add(name, c, o) { const id = this.ramps.length; const r = { id, name, c: c.map(hex), o: hex(o) }; this.ramps.push(r); this.byName[name] = id; return id; }
  auto(name, base, opt) { const r = autoRamp(base, opt); return this.add(name, r.c, r.o); }
  id(name) { const i = this.byName[name]; if (!i) throw new Error('ramp ' + name); return i; }
}

export function eraPalette() {
  const P = new Palette();
  P.add('rubber', ['#16141b', '#24222b', '#36343f', '#4f4d59', '#6e6c78'], '#0b0a0f');
  P.add('chrome', ['#2a3047', '#56627e', '#93a3bb', '#cfd9e6', '#ffffff'], '#171b2a');
  P.add('glass', ['#16283a', '#22425a', '#3c6f86', '#79aab6', '#cdebeb'], '#0d1824');
  P.add('lensW', ['#5e5a48', '#9d9a80', '#d9d5b6', '#f5f2dc', '#ffffff'], '#2d2b24');
  P.add('lensR', ['#3d0a16', '#7a1522', '#c22c2b', '#f06a4a', '#ffc49a'], '#22050c');
  P.add('lensA', ['#5a2508', '#9c4b0c', '#e08a1c', '#ffc24a', '#fff0a8'], '#2d1204');
  P.add('iron', ['#202128', '#34363f', '#4f525d', '#737783', '#a1a5ae'], '#121318');
  P.add('alu', ['#3e4450', '#646c7a', '#8f98a6', '#bcc4cf', '#e6ebf0'], '#22262e');
  P.add('black', ['#0f0e14', '#1b1a22', '#2a2933', '#403f4b', '#5d5c69'], '#07060a');
  P.add('white', ['#7b7f8c', '#a9adb7', '#d4d7dc', '#eff0ef', '#ffffff'], '#3e404a');
  P.add('shadow', ['#000000', '#000000', '#000000', '#000000', '#000000'], '#000000');
  P.add('brass', ['#3d2a10', '#6e4d1a', '#a8792c', '#dcb45a', '#fff0b0'], '#22170a');
  P.auto('paint.tank', '#3b3e38', { sat: 0.6 });
  P.add('wire', ['#1c1f2a', '#3c4254', '#6f7a90', '#b3bfd0', '#eef3f8'], '#10121a');
  return P;
}
