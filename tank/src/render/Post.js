// Post-processing (WebGL2) laid over the Canvas2D frame. Each frame the finished 2D canvas is uploaded as a
// texture and composited with: bloom (bright pass → blurred at ¼ size → added), heat shimmer (horizon band and
// hot spots: exhausts, fires, muzzles), shock-wave rings, colour grade per conditions, vignette, film grain and
// a hit pulse (colour fringing). Quality: 0 off · 1 low (bloom at ⅛, fewer taps) · 2 high. When off, or when
// WebGL2 is missing, the GL canvas is hidden and the 2D canvas shows as before.
DS.Post = class Post {
  constructor(src) {
    this.src = src; this.q = 2; this.ok = false;
    const cv = this.cv = document.createElement('canvas');
    cv.id = 'post'; cv.style.cssText = 'position:fixed;inset:0;display:block;pointer-events:none;';
    src.after(cv);
    const gl = this.gl = cv.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) { cv.remove(); return; }
    try { this.init(); this.ok = true; } catch (e) { console.warn('post-processing disabled:', e.message); cv.remove(); }
  }

  init() {
    const gl = this.gl;
    const vs = `#version 300 es
      in vec2 p; out vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
    const prog = fs => {
      const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
      const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\n' + fs));
      gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      const u = {}; const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(pr, i); u[a.name.replace('[0]', '')] = gl.getUniformLocation(pr, a.name); }
      return { pr, u };
    };
    // bright pass: keeps what is brighter than the threshold (soft knee)
    this.pBright = prog(`in vec2 uv; out vec4 o; uniform sampler2D t, world; uniform float th;
      void main() { vec4 ov = texture(t, uv); vec3 c = ov.rgb + texture(world, uv).rgb * (1.0 - ov.a); float l = max(c.r, max(c.g, c.b));
        float k = smoothstep(th, th + 0.15, l); o = vec4(c * k, 1.0); }`);
    // separable 9-tap gaussian
    this.pBlur = prog(`in vec2 uv; out vec4 o; uniform sampler2D t; uniform vec2 d;
      void main() { vec3 s = texture(t, uv).rgb * 0.227;
        s += (texture(t, uv + d).rgb + texture(t, uv - d).rgb) * 0.316;
        s += (texture(t, uv + 2.0 * d).rgb + texture(t, uv - 2.0 * d).rgb) * 0.07;
        o = vec4(s, 1.0); }`);
    this.pComp = prog(`in vec2 uv; out vec4 o;
      uniform sampler2D scene, bloom, world; uniform vec2 res; uniform float time, bloomK, hazeK, horizon, hit, grain;
      uniform vec4 hot[16]; uniform int nHot; uniform vec4 wave[8]; uniform int nWave;
      uniform vec3 lift, gain; uniform float sat, contrast, vig; uniform float sharp;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      // the picture: the 2D layer (premultiplied) over the WebGL world (black when the GL renderer is off: the 2D
      // layer is then opaque)
      vec3 S(vec2 p) { vec4 ov = texture(scene, p); return ov.rgb + texture(world, p).rgb * (1.0 - ov.a); }
      void main() {
        vec2 px = uv * res, off = vec2(0.0);
        // heat shimmer: a band over the horizon plus hot spots; rising, wavy noise
        float hz = hazeK * exp(-pow((px.y - horizon) / (res.y * 0.06), 2.0));
        for (int i = 0; i < 16; i++) { if (i >= nHot) break; vec4 h = hot[i];
          vec2 q = (px - h.xy) / h.z; q.y = max(q.y * 0.6, q.y);          // plume rises (screen y up in GL)
          hz += h.w * exp(-dot(q, q)); }
        if (hz > 0.001) {
          vec2 n = vec2(vn(px * vec2(0.035, 0.09) + vec2(0.0, -time * 3.0)), vn(px * vec2(0.05, 0.11) + vec2(7.0, -time * 3.7))) - 0.5;
          off += n * hz * 6.0;
        }
        // shock-wave rings
        for (int i = 0; i < 8; i++) { if (i >= nWave) break; vec4 w = wave[i];
          vec2 d = px - w.xy; float r = length(d) + 0.001, x = (r - w.z) / (8.0 + w.z * 0.08);
          off += d / r * w.w * exp(-x * x) * 10.0; }
        vec2 suv = clamp((px + off) / res, vec2(0.0), vec2(1.0));
        vec3 c;
        if (hit > 0.001) {                                       // impact on our tank: colour fringing
          vec2 ca = (suv - 0.5) * 0.012 * hit;
          c = vec3(S(suv + ca).r, S(suv).g, S(suv - ca).b);
        } else c = S(suv);
        // the picture is rendered below the screen's resolution: a contrast-limited sharpen restores the edges
        // (never past the brightest / darkest neighbour, so no halos)
        if (sharp > 0.001) { vec2 t = 1.0 / res;
          vec3 n0 = S(suv + vec2(t.x, 0.0)), n1 = S(suv - vec2(t.x, 0.0)), n2 = S(suv + vec2(0.0, t.y)), n3 = S(suv - vec2(0.0, t.y));
          vec3 mn = min(min(min(n0, n1), min(n2, n3)), c), mx = max(max(max(n0, n1), max(n2, n3)), c);
          c = clamp(c + sharp * 2.0 * (c - (n0 + n1 + n2 + n3) * 0.25), mn, mx); }
        vec3 bl = texture(bloom, suv).rgb * bloomK;
        c = 1.0 - (1.0 - c) * (1.0 - min(bl, vec3(1.0)));                // screen blend: glows, never clips flat
        // grade: lift / gain, contrast, saturation
        c = lift + c * (gain - lift);
        c = (c - 0.5) * contrast + 0.5;
        float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, sat);
        // vignette (+ red edge when hit), grain
        vec2 v = uv - 0.5; float e = dot(v, v);
        c *= 1.0 - vig * smoothstep(0.08, 0.55, e);
        c = mix(c, vec3(0.75, 0.08, 0.02), hit * 0.55 * smoothstep(0.12, 0.5, e));
        c += (h21(px + fract(time) * 97.0) - 0.5) * grain;
        o = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.sceneTex = this.tex();
    this.black = this.tex(); gl.bindTexture(gl.TEXTURE_2D, this.black); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    this.fb = [];
  }
  tex() {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  target(i, w, h) {
    const gl = this.gl; let f = this.fb[i];
    if (f && f.w === w && f.h === h) return f;
    if (!f) { f = this.fb[i] = { t: this.tex(), f: gl.createFramebuffer() }; }
    f.w = w; f.h = h;
    gl.bindTexture(gl.TEXTURE_2D, f.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, f.t, 0);
    return f;
  }
  pass(p, out, w, h, set) {
    const gl = this.gl; gl.useProgram(p.pr); gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.f : null); gl.viewport(0, 0, w, h);
    set(p.u); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  bind(unit, t, loc) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); }

  setQuality(q) { this.q = q; this.show(); }
  show() { if (this.ok) this.cv.style.display = this.q || this.worldOn ? 'block' : 'none'; }

  // P: per-frame parameters from the game (screen-space, device pixels, y down as in the 2D canvas)
  render(P) {
    // world: the WebGL world renderer's frame (DS.GLW) or null. With effects off but the GL renderer on, the two
    // layers are still put together here, with every effect at zero
    const world = P.world || null; if (!!world !== !!this.worldOn) { this.worldOn = !!world; this.show(); }
    if (!this.ok || (!this.q && !world)) return;
    if (!this.q) P = Object.assign({}, P, { bloom: 0, haze: 0, hot: [], waves: [], hit: 0, grain: 0, vig: 0, lift: [0, 0, 0], gain: [1, 1, 1], sat: 1, contrast: 1 });
    const gl = this.gl, src = this.src, W = src.width, H = src.height;
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; this.cv.style.width = src.style.width; this.cv.style.height = src.style.height; }
    gl.bindVertexArray(this.vao);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    if (P.overlayAbove) {
      // the whole picture is in the GL world frame; the 2D canvas (marks, text) sits above this one: nothing to
      // upload — the 'scene' layer is one transparent pixel
      if (!this._clear) { this._clear = this.tex(); gl.bindTexture(gl.TEXTURE_2D, this._clear); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0])); }
    }
    const scene = P.overlayAbove ? this._clear : this.sceneTex;
    if (!P.overlayAbove) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const tu = DS.Perf.on ? performance.now() : 0;
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); if (tu) DS.Perf.sub('upload', performance.now() - tu); }
    catch (e) {
      // pages opened straight from disk (file://) count their own images as foreign, so the 2D canvas
      // cannot be handed to WebGL: switch the layer off and keep playing with the plain 2D picture
      this.ok = false; this.cv.remove(); console.warn('post-processing off:', e.message); return;
    }
    }
    const ds = this.q === 2 ? 4 : 8, bw = Math.max(1, Math.ceil(W / ds)), bh = Math.max(1, Math.ceil(H / ds));
    const A = this.target(0, bw, bh), B = this.target(1, bw, bh);
    const wt = world || this.black;
    if (this.q) this.pass(this.pBright, A, bw, bh, u => { this.bind(0, scene, u.t); this.bind(1, wt, u.world); gl.uniform1f(u.th, P.threshold); });
    const it = this.q === 2 ? 2 : 1;
    for (let k = 0; k < (this.q ? it : 0); k++) {
      this.pass(this.pBlur, B, bw, bh, u => { this.bind(0, A.t, u.t); gl.uniform2f(u.d, (1 + k) / bw, 0); });
      this.pass(this.pBlur, A, bw, bh, u => { this.bind(0, B.t, u.t); gl.uniform2f(u.d, 0, (1 + k) / bh); });
    }
    this.pass(this.pComp, null, W, H, u => {
      this.bind(0, scene, u.scene); this.bind(1, A.t, u.bloom); this.bind(2, wt, u.world);
      gl.uniform2f(u.res, W, H); gl.uniform1f(u.time, P.time); gl.uniform1f(u.bloomK, P.bloom);
      gl.uniform1f(u.hazeK, P.haze); gl.uniform1f(u.horizon, H - P.horizon); gl.uniform1f(u.hit, P.hit); gl.uniform1f(u.grain, P.grain); gl.uniform1f(u.sharp, P.sharp || 0);
      const hot = this._hot || (this._hot = new Float32Array(64)), nh = Math.min(16, P.hot.length);
      for (let i = 0; i < nh; i++) { const h = P.hot[i]; hot.set([h[0], H - h[1], h[2], h[3]], i * 4); }
      gl.uniform4fv(u.hot, hot); gl.uniform1i(u.nHot, nh);
      const wv = this._wv || (this._wv = new Float32Array(32)), nw = Math.min(8, P.waves.length);
      for (let i = 0; i < nw; i++) { const w = P.waves[i]; wv.set([w[0], H - w[1], w[2], w[3]], i * 4); }
      gl.uniform4fv(u.wave, wv); gl.uniform1i(u.nWave, nw);
      gl.uniform3fv(u.lift, P.lift); gl.uniform3fv(u.gain, P.gain); gl.uniform1f(u.sat, P.sat); gl.uniform1f(u.contrast, P.contrast); gl.uniform1f(u.vig, P.vig);
    });
  }
};
