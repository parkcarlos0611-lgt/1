// The front of the house on the GPU (review 54). The same picture as render/place/front2.ts, made by two fragment
// shaders on a 480x270 target, then read back into the pixel screen (the interface and the falling rain and snow are
// drawn over it there, as before):
// - pass A: the sky (the painted skies blended by cloud and scrolled with the wind, graded to the hour, the sun behind
//   the house, the moon in its phase, stars), the layers made by Front2.layers() (ground, buildings, doors, snow) and
//   the tree swaying row by row, lit: the sky's light, the street lamp and its pool, the lamplit windows' light on the
//   lawn, the rooms behind open doors, the hall's light spilling out, glints on snow, the windows at night, the lantern
// - pass B: the wet road and paths mirroring what stands above them, long streaks of the lights down them, the puddles
// The CPU builds the layers only when they change (a new day, more snow, a door moving), so a quiet frame is the GPU's
// alone. Where WebGL2 is missing, the scene draws itself on the CPU as before.
import type { Front2, Front2Env } from './front2';
import { W, H, clamp, mix3, skyColours, type V3 } from './room';

const N = W * H;
const VS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
const COMMON = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
out vec4 o;
float hash2(int x, int y) { uint h = uint(x) * 374761393u + uint(y) * 668265263u; h = (h ^ (h >> 13u)) * 1274126177u; h ^= h >> 16u; return float(h) / 4294967296.0; }
`;
const FS_A = COMMON + `
uniform sampler2D uAlb, uInfo, uLight, uTree, uSkyC, uSkyO, uNight;
uniform float uT, uOff, uMixO, uKeep, uDay, uSunAlt, uCloud, uMoonPhase, uMoonUp, uLevel, uLampOn, uWinLit, uWl, uHouseLit, uWet, uSparkle, uAmp;
uniform vec3 uTop, uHor, uSunCol, uAmb, uNb;
uniform vec2 uSun, uMoon, uLamp, uPool;
uniform vec4 uWin[4], uNightUV[4], uDoorGlass, uTreeRect, uLampRect;
vec3 skyAt(int x, int y) {
  float v = float(y) / 150.0, u = mod(float(x) + uOff, 480.0); int u0 = int(floor(u)); float f = u - float(u0); int u1 = (u0 + 1) % 480;
  vec3 c = mix(texelFetch(uSkyC, ivec2(u0, y), 0).rgb, texelFetch(uSkyC, ivec2(u1, y), 0).rgb, f) * 255.0;
  vec3 ov = mix(texelFetch(uSkyO, ivec2(u0, y), 0).rgb, texelFetch(uSkyO, ivec2(u1, y), 0).rgb, f) * 255.0;
  vec3 r = mix(c, ov, uMixO); float lum = (r.r + r.g + r.b) / 3.0;
  vec3 gr = mix(uTop, uHor, pow(min(1.0, v), 0.8)); r = mix(gr * (lum / 160.0), r, uKeep);
  float thin = clamp((lum - 110.0) / 90.0, 0.0, 1.0) * uMixO + (1.0 - uMixO);
  float ds = length(vec2(float(x), float(y)) - uSun);
  if (uSunAlt > -2.0) { float gl = (exp(-ds / 20.0) * 0.5 + exp(-ds / 70.0) * 0.22) * (0.35 + 0.65 * thin); r = mix(r, uSunCol, gl);
    if (ds < 5.5 && thin > 0.6 && uCloud < 0.8) { float d2 = clamp(5.5 - ds, 0.0, 1.0) * thin * clamp((0.8 - uCloud) / 0.25, 0.0, 1.0); r = mix(r, vec3(255.0, 252.0, 238.0), d2); } }
  if (uMoonUp > 0.5) { float dm = length(vec2(float(x), float(y)) - uMoon), lit = 1.0 - abs(uMoonPhase - 0.5) * 2.0;
    if (dm < 16.0) r = mix(r, vec3(210.0, 214.0, 230.0), exp(-dm / 6.0) * 0.3 * lit * thin);
    if (dm < 4.2 && thin > 0.5) { float uu = (float(x) - uMoon.x) / 4.2, kk = cos(uMoonPhase * 6.2831853), side = sqrt(max(0.0, 1.0 - pow((float(y) - uMoon.y) / 4.2, 2.0)));
      bool on = uMoonPhase < 0.5 ? uu > kk * side : uu < -kk * side; r = mix(r, vec3(236.0, 236.0, 226.0), clamp(4.2 - dm, 0.0, 1.0) * (on ? 1.0 : 0.12)); } }
  if (uDay < 0.2 && uMixO < 0.6 && hash2(x, y) > 0.9962) { float tw = (0.6 + 0.4 * sin(uT * 3.0 + float(x) * 7.0 + float(y))) * (1.0 - uDay * 5.0) * (1.0 - uMixO); r = mix(r, vec3(232.0, 234.0, 246.0), tw); }
  return r; }
void main() {
  int x = int(gl_FragCoord.x), y = int(gl_FragCoord.y); ivec2 p = ivec2(x, y);
  vec4 al = texelFetch(uAlb, p, 0), inf = texelFetch(uInfo, p, 0), li = texelFetch(uLight, p, 0);
  int kind = int(inf.r * 255.0 + 0.5), gw = int(inf.g * 255.0 + 0.5) - 1, inside = int(inf.a * 255.0 + 0.5); bool snowy = inf.b > 0.5; vec3 alb = al.rgb * 255.0; float cover = al.a;
  // the tree, swaying: each row shifted by its own sub-pixel amount, the crown most, the trunk not at all
  if (y >= int(uTreeRect.y) && y < int(uTreeRect.y + uTreeRect.w)) { float sy = float(y) - uTreeRect.y, up = clamp(1.0 - sy / (uTreeRect.w * 0.62), 0.0, 1.0);
    float dx = uAmp * up * up * (sin(uT * 0.9 + sy * 0.015) * 0.75 + sin(uT * 2.1 + sy * 0.04) * 0.25), fx = float(x) - dx; int x0 = int(floor(fx)); float f = fx - float(x0);
    vec4 c0 = x0 >= 0 && x0 < 480 ? texelFetch(uTree, ivec2(x0, y), 0) : vec4(0.0), c1 = x0 + 1 >= 0 && x0 + 1 < 480 ? texelFetch(uTree, ivec2(x0 + 1, y), 0) : vec4(0.0);
    float a0 = c0.a > 0.1 ? 1.0 : 0.0, a1 = c1.a > 0.1 ? 1.0 : 0.0;
    if (mix(a0, a1, f) >= 0.5) { vec3 tc = a0 > 0.0 && a1 > 0.0 ? mix(c0.rgb, c1.rgb, f) : (a0 > 0.0 ? c0.rgb : c1.rgb); alb = tc * 255.0; kind = 2; cover = 1.0; inside = 0; gw = -1; snowy = (a0 > 0.0 ? c0.a : c1.a) < 0.9; } }
  if (kind == 0) { o = vec4(skyAt(x, min(y, 179)) / 255.0, 1.0); return; }
  vec3 rgb = uNb + uLevel * uAmb; float fxp = float(x), fyp = float(y);
  if (uLampOn > 0.5) { float d2 = pow(fxp - uLamp.x, 2.0) + pow(fyp - uLamp.y, 2.0), kk = 0.45 / (1.0 + d2 / 900.0);
    if (kind == 5 || kind == 1) { float ex = (fxp - uPool.x) / 60.0, ey = (fyp - uPool.y) / 15.0; kk += 1.05 * exp(-(ex * ex + ey * ey) * 1.6); } rgb += kk * vec3(1.0, 0.78, 0.5); }
  if (uWinLit > 0.5 && (kind == 1 || kind == 5)) for (int k = 0; k < 4; k++) { vec4 wb = uWin[k]; float cx = (wb.x + wb.z) * 0.5, d = (fxp - cx) / 22.0, dy = (fyp - (wb.w + 26.0)) / 12.0; rgb += 0.22 * uWl * exp(-(d * d + dy * dy)) * vec3(1.0, 0.72, 0.42); }
  if (inside > 0) { float lv = li.r * 1.5; rgb *= vec3(lv, lv, lv * 0.97); if (inside == 1 && uHouseLit > 0.5) rgb += 0.7 * max(uWl, 0.25) * vec3(1.0, 0.72, 0.42); }
  rgb *= li.g;
  if (li.b > 0.0 && uHouseLit > 0.5) rgb += li.b * max(uWl, 0.15) * vec3(1.0, 0.72, 0.42);
  if (kind == 5 && uWet > 0.0) alb *= 1.0 - 0.32 * uWet;
  vec3 c = alb * rgb;
  if (snowy && uSparkle > 0.0 && hash2(x * 7 + int(floor(uT * 1.7 + hash2(x, y) * 9.0)), y * 13) > 0.9975) c = vec3(255.0, 254.0, 248.0);
  if (kind == 1 && cover < 1.0) c = mix(skyAt(x, min(y, 179)), c, cover);
  if (gw >= 0 && uWinLit > 0.5) {
    if (gw == 9) { float u = (fxp - uDoorGlass.x) / (uDoorGlass.z - uDoorGlass.x), v = (fyp - uDoorGlass.y) / (uDoorGlass.w - uDoorGlass.y), fold = 0.82 + 0.18 * sin(u * 22.0), glowk = exp(-(pow(u - 0.5, 2.0) * 6.0 + pow(v - 0.75, 2.0) * 4.0)), k = uWl * (0.55 + 0.45 * glowk) * fold;
      c = vec3(mix(c.r, 240.0, k), mix(c.g, 176.0, k), mix(c.b, 104.0, k * 0.9)); }
    else if (gw < 4) { vec4 wb = uWin[gw], nu = uNightUV[gw]; float u = clamp((fxp - wb.x) / (wb.z - wb.x), 0.0, 0.999), v = clamp((fyp - wb.y) / (wb.w - wb.y), 0.0, 0.999);
      vec3 nw = texelFetch(uNight, ivec2(int(nu.x + u * nu.z), int(nu.y + v * nu.w)), 0).rgb * 255.0; c = mix(c, nw * vec3(1.05, 1.0, 0.95), uWl); } }
  if (uLampOn > 0.5) { if (fxp >= uLampRect.x && fxp < uLampRect.x + uLampRect.z && fyp >= uLampRect.y && fyp < uLampRect.y + 18.0 && kind == 2 && (alb.r + alb.g + alb.b) / 3.0 >= 120.0) c = vec3(255.0, 232.0, 170.0);
    float d2 = pow(fxp - uLamp.x, 2.0) + pow(fyp - uLamp.y, 2.0); if (d2 < 729.0) c += 0.55 * exp(-d2 / 81.0) * vec3(255.0, 214.0, 140.0); }
  o = vec4(clamp(c, 0.0, 255.0) / 255.0, 1.0); }`;
const FS_B = COMMON + `
uniform sampler2D uA, uInfo, uLight; uniform float uWet, uRain, uT, uLampOn, uWinLit, uWl; uniform vec2 uLamp; uniform vec4 uWin[4];
void main() { int x = int(gl_FragCoord.x), y = int(gl_FragCoord.y); vec3 c = texelFetch(uA, ivec2(x, y), 0).rgb * 255.0; vec4 inf = texelFetch(uInfo, ivec2(x, y), 0);
  int kind = int(inf.r * 255.0 + 0.5); float pr = texelFetch(uLight, ivec2(x, y), 0).a * 255.0;
  if (uWet > 0.05 && kind == 5 && y >= 168) { int my = clamp(2 * (y < 203 ? 168 : 203) - y - 2, 0, 179); float k = uWet * (y >= 222 ? 0.22 : 0.14); c = mix(c, texelFetch(uA, ivec2(x, my), 0).rgb * 255.0, k);
    float jit = sin(float(y) * 1.3 + uT * (uRain > 0.0 ? 7.0 : 1.5)) * (uRain > 0.0 ? 1.4 : 0.4);
    for (int n = 0; n < 5; n++) { vec3 L; if (n == 0) { if (uLampOn < 0.5) continue; L = vec3(uLamp, 1.0); } else { if (uWinLit < 0.5) continue; vec4 wb = uWin[n - 1]; L = vec3((wb.x + wb.z) * 0.5, wb.w, 0.55 * uWl); }
      float dx = (float(x) - L.x + jit) / (L.z >= 1.0 ? 4.5 : 6.0), down = float(y) - max(L.y, 200.0), fade = down > 0.0 ? exp(-down / 46.0) : 0.0, kk = L.z * uWet * 0.75 * exp(-dx * dx) * fade;
      c += kk * vec3(255.0, 206.0, 130.0); } }
  if (pr >= 1.0) c = texelFetch(uA, ivec2(x, int(pr)), 0).rgb * 255.0 * vec3(0.8, 0.82, 0.88);   // a puddle's water
  o = vec4(clamp(c, 0.0, 255.0) / 255.0, 1.0); }`;

export class Front2GL {
  private gl: WebGL2RenderingContext; private progA: WebGLProgram; private progB: WebGLProgram; private tex: Record<string, WebGLTexture> = {}; private fbA: WebGLFramebuffer; private texA: WebGLTexture;
  private albBuf = new Uint8Array(N * 4); private infoBuf = new Uint8Array(N * 4); private lightBuf = new Uint8Array(N * 4); private read = new Uint8Array(N * 4); private nightUV: number[][] = [];
  static make(scene: Front2): Front2GL | null { try { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false }); return gl ? new Front2GL(gl, scene) : null; } catch { return null; } }
  private constructor(gl: WebGL2RenderingContext, private s: Front2) { this.gl = gl;
    const sh = (type: number, src: string) => { const x = gl.createShader(type)!; gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x) ?? 'shader'); return x; };
    const prog = (fs: string) => { const p = gl.createProgram()!; gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link'); return p; };
    this.progA = prog(FS_A); this.progB = prog(FS_B);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const P = s.P; for (const n of ['sky_summer', 'sky_spring', 'sky_autumn', 'sky_winter']) this.upload(n, P[n]!.px, P[n]!.w, P[n]!.h);
    // the lamplit window insides side by side in one picture
    const ws = [0, 1, 2, 3].map(k => P['nightwin_' + k]!), aw = ws.reduce((t, p) => t + p.w, 0), ah = Math.max(...ws.map(p => p.h)), atlas = new Uint8Array(aw * ah * 4); let ox = 0;
    for (const p of ws) { for (let y = 0; y < p.h; y++) atlas.set(p.px.subarray(y * p.w * 4, (y + 1) * p.w * 4), (y * aw + ox) * 4); this.nightUV.push([ox, 0, p.w, p.h]); ox += p.w; }
    this.upload('night', atlas, aw, ah);
    this.texA = this.blank(); this.fbA = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbA); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texA, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const n of ['alb', 'info', 'light', 'tree']) this.upload(n, new Uint8Array(N * 4), W, H); }
  private blank(): WebGLTexture { const gl = this.gl, t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST); return t; }
  private upload(name: string, px: Uint8Array | Uint8ClampedArray, w: number, h: number) { const gl = this.gl; let t = this.tex[name]; const fresh = !t; if (!t) { t = gl.createTexture()!; this.tex[name] = t; } gl.bindTexture(gl.TEXTURE_2D, t);
    const data = px instanceof Uint8Array ? px : new Uint8Array(px.buffer, px.byteOffset, px.byteLength);
    if (fresh) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data); for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST); }
    else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data); }
  /** the layers as textures (only after they were made again) */
  private pack(ch: { base: boolean; tree: boolean }) { const s = this.s;
    if (ch.base) { for (let i = 0; i < N; i++) { const a = i * 4;
        this.albBuf[a] = s.alb[i * 3]!; this.albBuf[a + 1] = s.alb[i * 3 + 1]!; this.albBuf[a + 2] = s.alb[i * 3 + 2]!; this.albBuf[a + 3] = Math.round(s.cover[i]! * 255);
        this.infoBuf[a] = s.kind[i]!; this.infoBuf[a + 1] = s.glass[i]! + 1; this.infoBuf[a + 2] = s.snowy[i] ? 255 : 0; this.infoBuf[a + 3] = s.inside[i]!;
        this.lightBuf[a] = Math.min(255, Math.round(s.inLevel[i]! / 1.5 * 255)); this.lightBuf[a + 1] = Math.round(s.dShade[i]! * 255); this.lightBuf[a + 2] = Math.min(255, Math.round(s.dWarm[i]! * 255)); this.lightBuf[a + 3] = s.pudRow[i]!; }
      this.upload('alb', this.albBuf, W, H); this.upload('info', this.infoBuf, W, H); this.upload('light', this.lightBuf, W, H); }
    if (ch.tree) this.upload('tree', s.tree, W, H); }

  draw(out: Uint8ClampedArray, e: Front2Env): void { const gl = this.gl, s = this.s, a = e.air, C = s.C, t = e.t;
    this.pack(s.layers(e));
    const day = a.daylight, dusk = clamp(1 - Math.abs(a.sunAlt - 2) / 10) * (1 - a.cloud * 0.5), [top, hor] = skyColours(a.sunAlt, a.cloud), mixO = clamp((a.cloud - 0.32) / 0.3);
    const season = e.doy < 80 || e.doy > 330 ? 'winter' : e.doy > 255 ? 'autumn' : 'spring', sunCol: V3 = mix3([255, 160, 80], [255, 246, 220], clamp(a.sunAlt / 20));
    const place = (alt: number, az: number) => [240 + (az - 180) * 4.2, 150 - 140 * clamp(alt / (alt + 14) * 1.3, -0.3, 1.02)];
    const lampOn = day < 0.32 || (a.rain > 0 && day < 0.55), lampP = C.lamp!.at as [number, number], lx = lampP[0] + 10.5, ly = lampP[1] + 8, winLit = e.houseLit && day < 0.5, wl = (1 - day * 2) * 0.95;
    const ambC = mix3(mix3([1, 1, 1], [0.95, 0.97, 1.02], a.cloud), [1.06, 0.82, 0.68], dusk * 0.6), level = 0.1 + 0.95 * day * (0.92 + 0.1 * (1 - a.cloud));
    const bindT = (prog: WebGLProgram, name: string, tex: WebGLTexture, unit: number) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(gl.getUniformLocation(prog, name), unit); };
    const u1 = (p: WebGLProgram, n: string, v: number) => gl.uniform1f(gl.getUniformLocation(p, n), v), u2 = (p: WebGLProgram, n: string, v: number[]) => gl.uniform2fv(gl.getUniformLocation(p, n), v), u3 = (p: WebGLProgram, n: string, v: number[]) => gl.uniform3fv(gl.getUniformLocation(p, n), v), u4 = (p: WebGLProgram, n: string, v: number[]) => gl.uniform4fv(gl.getUniformLocation(p, n), v);
    const wins = C.windows.flatMap(b => [b[0]!, b[1]!, b[2]!, b[3]!]);
    // pass A
    let p = this.progA; gl.useProgram(p); gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbA); gl.viewport(0, 0, W, H);
    bindT(p, 'uAlb', this.tex.alb!, 0); bindT(p, 'uInfo', this.tex.info!, 1); bindT(p, 'uLight', this.tex.light!, 2); bindT(p, 'uTree', this.tex.tree!, 3); bindT(p, 'uSkyC', this.tex.sky_summer!, 4); bindT(p, 'uSkyO', this.tex['sky_' + season]!, 5); bindT(p, 'uNight', this.tex.night!, 6);
    u1(p, 'uT', t); u1(p, 'uOff', t * (1.8 + a.wind * 8)); u1(p, 'uMixO', mixO); u1(p, 'uKeep', clamp(day * 1.1 - dusk * 0.35)); u1(p, 'uDay', day); u1(p, 'uSunAlt', a.sunAlt); u1(p, 'uCloud', a.cloud);
    u1(p, 'uMoonPhase', e.moon.phase); u1(p, 'uMoonUp', e.moon.alt > 0 && day < 0.6 ? 1 : 0); u1(p, 'uLevel', level); u1(p, 'uLampOn', lampOn ? 1 : 0); u1(p, 'uWinLit', winLit ? 1 : 0); u1(p, 'uWl', wl); u1(p, 'uHouseLit', e.houseLit ? 1 : 0);
    u1(p, 'uWet', e.wet); u1(p, 'uSparkle', clamp(a.sunAlt / 8) * (1 - a.cloud) + (lampOn ? 0.3 : 0)); u1(p, 'uAmp', 0.35 + 1.4 * a.wind);
    u3(p, 'uTop', top); u3(p, 'uHor', hor); u3(p, 'uSunCol', sunCol); u3(p, 'uAmb', ambC); u3(p, 'uNb', [0.05, 0.06, 0.11]);
    u2(p, 'uSun', place(a.sunAlt, a.sunAz)); u2(p, 'uMoon', place(e.moon.alt, e.moon.az)); u2(p, 'uLamp', [lx, ly]); u2(p, 'uPool', [453, 214]);
    u4(p, 'uWin', wins); u4(p, 'uNightUV', this.nightUV.flat()); u4(p, 'uDoorGlass', C.doorGlass); u4(p, 'uTreeRect', s.treeRect); u4(p, 'uLampRect', [Math.round(lampP[0]), Math.round(lampP[1]), s.P.lamp!.w, s.P.lamp!.h]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // pass B
    p = this.progB; gl.useProgram(p); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    bindT(p, 'uA', this.texA, 0); bindT(p, 'uInfo', this.tex.info!, 1); bindT(p, 'uLight', this.tex.light!, 2);
    u1(p, 'uWet', e.wet); u1(p, 'uRain', a.rain); u1(p, 'uT', t); u1(p, 'uLampOn', lampOn ? 1 : 0); u1(p, 'uWinLit', winLit ? 1 : 0); u1(p, 'uWl', wl); u2(p, 'uLamp', [lx, ly]); u4(p, 'uWin', wins);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, this.read);
    // the rain, the snow, the smoke and the birds over it, on the CPU as before
    const lit = s.lit; for (let i = 0; i < N; i++) { lit[i * 3] = this.read[i * 4]!; lit[i * 3 + 1] = this.read[i * 4 + 1]!; lit[i * 3 + 2] = this.read[i * 4 + 2]!; }
    s.chimney(e); s.birds(e); s.weather(e);
    for (let i = 0; i < N; i++) { out[i * 4] = Math.min(255, Math.max(0, lit[i * 3]!)); out[i * 4 + 1] = Math.min(255, Math.max(0, lit[i * 3 + 1]!)); out[i * 4 + 2] = Math.min(255, Math.max(0, lit[i * 3 + 2]!)); out[i * 4 + 3] = 255; } }
}
