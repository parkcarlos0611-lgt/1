// WebGL2 world renderer (O1: moving the picture off the 2D canvas). It offers the drawing calls the renderer
// already uses, so a pass moves over by handing it this context instead of the 2D one, and draws the same picture:
//   state       setTransform / transform / translate / scale / rotate / save / restore, globalAlpha,
//               globalCompositeOperation (source-over, lighter, source-atop, source-in, destination-in,
//               destination-out), filter (grayscale / blur, for images)
//   drawing     drawImage (5 and 9 arguments), fillRect, clearRect, paths (moveTo / lineTo / rect / arc /
//               ellipse / quadraticCurveTo / bezierCurveTo / closePath) filled and stroked (dashes too), clip
//   styles      colours, linear and radial gradients (evaluated per pixel in user space, as the 2D canvas),
//               patterns
//   - images and solid fills are batched: consecutive quads with the same texture and blend are one draw call
//   - paths are filled through the stencil (nonzero rule), strokes the same way (no double blending)
//   - clips are mask targets; nested clips intersect; restore() pops them
// Render targets: the frame (begin / end) and off-screen layers (layer(key, w, h)), each with its own context;
// a layer's canvas can be drawn with drawImage like any canvas. Contexts bind their own target before drawing,
// so they can be used in any order.
// Textures: images are uploaded once; a 2D canvas again whenever it has been drawn on (every 2D context call
// counts its canvas's changes, _v). Mipmapped; premultiplied alpha throughout.
DS.GLW = class GLW {
  constructor(post) {
    this.post = post; this.gl = this.rgl = post.gl; this.ok = false; this.enabled = true;
    try { this.init(); this.recorder(); this.ok = true; } catch (e) { this.gl = this.rgl; console.warn('WebGL world renderer off:', e.message); }
  }
  // Deferred drawing. On the iPad (WebKit → ANGLE → Metal) writing a buffer or a texture while a render pass is
  // drawing ends the pass: the whole target is stored and loaded again. Uploading each batch's vertices as it was
  // drawn did that hundreds of times a frame. So this.gl records every draw-time call (state, binds, uniforms,
  // draws, clears, blits) and this.rgl does resources and uploads at once; play() then uploads the frame's
  // vertices in one go and replays the record, with nothing uploaded in between.
  recorder() {
    const real = this.rgl, L = this.rec = [];
    const REC = ['useProgram', 'uniform1f', 'uniform1i', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform1fv', 'uniform4fv', 'uniformMatrix4fv',
      'bindVertexArray', 'bindBuffer', 'drawArrays', 'bindTexture', 'activeTexture', 'enable', 'disable', 'blendFunc', 'blendFuncSeparate',
      'stencilFunc', 'stencilOp', 'stencilOpSeparate', 'stencilMask', 'colorMask', 'bindFramebuffer', 'viewport', 'scissor', 'clear',
      'clearColor', 'clearStencil', 'blitFramebuffer', 'generateMipmap'];
    // a plain object (no Proxy): the context's constants and other methods copied over, the draw-time ones
    // recorded into one flat array (name, argument count, arguments) — nothing allocated per call
    const R = {};
    for (let o = Object.getPrototypeOf(real); o && o !== Object.prototype; o = Object.getPrototypeOf(o))
      for (const k of Object.getOwnPropertyNames(o)) { if (k in R || k === 'constructor') continue; let v; try { v = real[k]; } catch (e) { continue; } R[k] = typeof v === 'function' ? v.bind(real) : v; }
    for (const k of REC) R[k] = function (a, b, c, d, e, f, g, h, i, j) { const n = arguments.length; L.push(k, n, a, b, c, d, e, f, g, h, i, j); };
    this.gl = R;
    this.fv = new Float32Array(262144 * 8); this.fn = 0;
  }
  play() {
    const L = this.rec; if (!L || !L.length) { this.fn = 0; return; }
    const gl = this.rgl;
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.fv.subarray(0, Math.max(8, this.fn * 8)), gl.STREAM_DRAW);
    for (let i = 0; i < L.length; i += 12) {
      const f = gl[L[i]], n = L[i + 1];
      switch (n) {
        case 0: f.call(gl); break; case 1: f.call(gl, L[i + 2]); break; case 2: f.call(gl, L[i + 2], L[i + 3]); break;
        case 3: f.call(gl, L[i + 2], L[i + 3], L[i + 4]); break; case 4: f.call(gl, L[i + 2], L[i + 3], L[i + 4], L[i + 5]); break;
        case 5: f.call(gl, L[i + 2], L[i + 3], L[i + 4], L[i + 5], L[i + 6]); break;
        default: f.call(gl, L[i + 2], L[i + 3], L[i + 4], L[i + 5], L[i + 6], L[i + 7], L[i + 8], L[i + 9], L[i + 10], L[i + 11]);
      }
    }
    L.length = 0; this.fn = 0;
  }
  rbind(t) { this.rgl.bindTexture(this.rgl.TEXTURE_2D, t); }     // (resources: bound at once, not recorded)
  init() {
    const gl = this.gl;
    const mk = (vs, fs) => {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, '#version 300 es\n' + vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\n' + fs));
      gl.bindAttribLocation(p, 0, 'a_pos'); gl.bindAttribLocation(p, 1, 'a_uv'); gl.bindAttribLocation(p, 2, 'a_col'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace('[0]', '')] = gl.getUniformLocation(p, a.name); }
      return { p, u };
    };
    const VS = `in vec2 a_pos; in vec2 a_uv; in vec4 a_col; uniform vec2 u_res; out vec2 v_uv; out vec4 v_col;
      void main() { v_uv = a_uv; v_col = a_col; gl_Position = vec4(a_pos.x / u_res.x * 2.0 - 1.0, 1.0 - a_pos.y / u_res.y * 2.0, 0.0, 1.0); }`;
    // (clips are in the stencil: no mask texture is sampled — a sampler left bound to unit 3 could form a feedback loop with the layer being drawn)
    const MASK = `float M() { return 1.0; }`;
    // textured / solid quads (a 1×1 white texture for solids); colour is a premultiplied multiplier. Mip bias
    // -0.6: as sharp as the 2D canvas's high-quality smoothing; grey: the 'grayscale()' filter
    this.pTex = mk(VS, `in vec2 v_uv; in vec4 v_col; uniform sampler2D u_tex; uniform float u_bias, u_gray; ${MASK} out vec4 o;
      void main() { vec4 c = texture(u_tex, v_uv, u_bias); c.rgb = mix(c.rgb, vec3(dot(c.rgb, vec3(0.299, 0.587, 0.114))), u_gray); o = c * v_col * M(); }`);
    // clip mask: 1 inside, times the enclosing clip (the previous mask) when there is one
    this.pMask = mk(VS, `in vec2 v_uv; in vec4 v_col; ${MASK} out vec4 o; void main() { o = vec4(M(), 0.0, 0.0, 1.0); }`);
    // gradients: v_uv carries the user-space position. Linear: projection on the axis. Radial (two circles, as the
    // 2D canvas): the largest t for which the point is on the circle c(t), r(t) ≥ 0; none → transparent
    this.pGrad = mk(VS, `in vec2 v_uv; in vec4 v_col; uniform int u_kind; uniform vec2 u_p0, u_p1; uniform vec3 u_c0, u_c1; uniform int u_n; uniform float u_off[8]; uniform vec4 u_c[8]; uniform float u_a; ${MASK} out vec4 o;
      void main() {
        float t;
        if (u_kind == 0) { vec2 d = u_p1 - u_p0; t = dot(v_uv - u_p0, d) / max(dot(d, d), 1e-12); }
        else {
          vec2 cd = u_c1.xy - u_c0.xy, pd = v_uv - u_c0.xy; float dr = u_c1.z - u_c0.z;
          float a = dot(cd, cd) - dr * dr, b = dot(pd, cd) + u_c0.z * dr, c = dot(pd, pd) - u_c0.z * u_c0.z;
          if (abs(a) < 1e-9) { t = c / (2.0 * b); if (u_c0.z + t * dr < 0.0) discard; }
          else { float D = b * b - a * c; if (D < 0.0) discard; float s = sqrt(D), t1 = (b + s) / a, t2 = (b - s) / a;
            t = max(t1, t2); if (u_c0.z + t * dr < 0.0) { t = min(t1, t2); if (u_c0.z + t * dr < 0.0) discard; } }
        }
        t = clamp(t, 0.0, 1.0);
        vec4 c = u_c[0];
        for (int i = 1; i < 8; i++) { if (i >= u_n) break; if (t >= u_off[i - 1]) c = mix(u_c[i - 1], u_c[i], clamp((t - u_off[i - 1]) / max(u_off[i] - u_off[i - 1], 1e-6), 0.0, 1.0)); }
        if (t <= u_off[0]) c = u_c[0];
        o = c * u_a * M(); }`);
    // gunner's sight, put into the finished picture (after DS.Post): its view (a layer, rows bottom up) inside the
    // eyepiece circle, through the sight's colour filter (the CSS filter chain as affine steps, each clamped, as the
    // browser applies them), with the heat shimmer of long daylight views (rows slid sideways)
    this.pSight = mk(VS, `in vec2 v_uv; in vec4 v_col; uniform sampler2D u_tex; uniform vec4 u_rect; uniform float u_H; uniform mat4 u_m[6]; uniform int u_n; uniform vec4 u_sh; out vec4 o;
      void main() {
        vec2 p = vec2(gl_FragCoord.x, u_H - gl_FragCoord.y) - u_rect.xy, q = p / u_rect.zw;
        float r = length((q - 0.5) * 2.0), e = 1.0 - smoothstep(1.0 - 2.0 / u_rect.z, 1.0, r);
        if (e <= 0.0) discard;
        vec2 ts = vec2(textureSize(u_tex, 0)), tp = q * ts;
        if (u_sh.x > 0.0 && tp.y > ts.y * 0.25 && tp.y < ts.y * 0.85) { float y = floor(tp.y / u_sh.w) * u_sh.w; tp.x -= sin(y * 0.11 / u_sh.z + u_sh.y * 9.0) * u_sh.x * (0.5 + 0.5 * sin(y * 0.031 / u_sh.z - u_sh.y * 3.0)); }
        vec3 c = texture(u_tex, vec2(tp.x / ts.x, 1.0 - tp.y / ts.y)).rgb;
        for (int i = 0; i < 6; i++) { if (i >= u_n) break; c = clamp((u_m[i] * vec4(c, 1.0)).rgb, 0.0, 1.0); }
        o = vec4(c * e, e); }`);
    // round the enlarged sight: the rest of the screen blurred (a reduced copy of the picture, mip-filtered and
    // sampled in a ring of taps) and dimmed, or black; feathered at the eyepiece rim
    this.pBg = mk(VS, `in vec2 v_uv; in vec4 v_col; uniform sampler2D u_scr; uniform vec4 u_rect; uniform float u_H, u_mode, u_lod; out vec4 o;
      void main() {
        vec2 p = vec2(gl_FragCoord.x, u_H - gl_FragCoord.y), c = u_rect.xy + u_rect.zw * 0.5;
        float r = length(p - c) / (u_rect.z * 0.5); if (r < 0.985) discard;
        float k = smoothstep(0.985, 1.06, r);
        if (u_mode > 0.5) { o = vec4(0.0, 0.0, 0.0, k); return; }
        vec2 uv = gl_FragCoord.xy / vec2(textureSize(u_scr, 0)) / 4.0, d = exp2(u_lod) * 1.5 / vec2(textureSize(u_scr, 0));
        vec3 s = textureLod(u_scr, uv, u_lod).rgb * 0.2;
        for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; s += textureLod(u_scr, uv + vec2(cos(a), sin(a)) * d, u_lod).rgb * 0.1; }
        o = vec4(s * 0.62 * k, k); }`);
    // samplers never change unit: set once (u_tex / u_scr on 0, the clip mask on 3); other uniforms are cached per
    // program and texture bindings per unit, so a draw issues only the calls that change something
    for (const P of [this.pTex, this.pMask, this.pGrad, this.pSight, this.pBg]) {
      gl.useProgram(P.p); P.c = {};
      if (P.u.u_tex) gl.uniform1i(P.u.u_tex, 0); if (P.u.u_scr) gl.uniform1i(P.u.u_scr, 0); if (P.u.u_mask) gl.uniform1i(P.u.u_mask, 3);
    }
    this.inval();
    this.MAXQ = 4096; this.vb = new Float32Array(this.MAXQ * 6 * 8); this.nv = 0;
    this.buf = gl.createBuffer(); this.vao = gl.createVertexArray();
    // vertices go into one large buffer used as a ring: every draw writes past the last one, so no write waits for
    // the GPU to finish reading earlier vertices; when it runs out the storage is replaced (orphaned), and each frame
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, 1 << 20, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.bindVertexArray(null);
    this.white = this.mkTex(); this.rbind(this.white); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    this.texs = new WeakMap(); this.texsR = new WeakMap(); this.cols = new Map();
    // atlas pages for small images (particle puffs, debris shards, small props…): many images on one texture, so
    // the quad batch is not broken by texture changes. 2048² pages, slots 8 px aligned with 8 px of empty border
    // and mip levels 0–3 only, so no slot ever bleeds into its neighbour; a white block at (0, 0) for solids.
    // When the last page is full the oldest one is wiped and its images are uploaded again as they are drawn.
    this.ATL = 2048; this.atl = []; this.atlI = 0; this.atlDirty = new Set(); this.atlT = new Map();
    this.main = { clipD: 0, clipBox: [], ms: true }; this.T = null; this.W = 1; this.H = 1;
    this.maxSamples = Math.max(1, Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 1)); this.setMsaa('auto');
    this.layers = {}; this.scope = ''; this.fx = { bias: -0.6, gray: 0 };
    this.ctx = new DS.GLCtx(this, 'main');
    DS.GLW.trackCanvases();
  }
  // ---- render targets ----
  // The frame and the sight may draw multisampled (t.ms: 4× MSAA, resolved into the texture when it is read);
  // off-screen layers draw straight into their texture. Every target has its own stencil (paths and clips).
  // On tiled GPUs (iPad) switching targets in mid-frame stores and reloads the whole target, so layers are made
  // before the frame starts (see phase) and clips stay in the target's own stencil.
  mkTarget(t, W, H) {
    const gl = this.rgl, S = t.ms ? this.msaa : 0;
    if (!t.fbo) { t.fbo = gl.createFramebuffer(); t.rfbo = gl.createFramebuffer(); t.color = this.mkTex(); t.crb = gl.createRenderbuffer(); t.rb = gl.createRenderbuffer(); t.clipD = 0; t.clipBox = []; }
    if (t.W !== W || t.H !== H || t.S !== S) {
      this.flush();
      this.rbind(t.color); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      if (S > 1) {
        gl.bindRenderbuffer(gl.RENDERBUFFER, t.crb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, S, gl.RGBA8, W, H);
        gl.bindRenderbuffer(gl.RENDERBUFFER, t.rb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, S, gl.DEPTH24_STENCIL8, W, H);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, t.crb);
      } else {
        gl.bindRenderbuffer(gl.RENDERBUFFER, t.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, W, H);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.color, 0);
      }
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, t.rb);
      gl.disable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true); gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.stencilMask(0xff); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT); this._st = -1;
      if (S > 1) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.rfbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.color, 0); }
      t.W = W; t.H = H; t.S = S; t.dirty = S > 1; t.clipD = 0;
      if (this.T === t) this.T = null;                           // rebind on next use
    }
    return t;
  }
  // multisampled buffer → texture
  resolve(t) {
    if (!t.dirty || !(t.S > 1)) return;
    if (this.T === t) this.flush();
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, t.rfbo);
    gl.blitFramebuffer(0, 0, t.W, t.H, 0, 0, t.W, t.H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.T ? this.T.fbo : null);
    t.dirty = false;
  }
  bind(t) {
    t.dirty = t.S > 1;
    if (!this.blendOn) { this.flush(); this.inval(); this.gl.enable(this.gl.BLEND); this.blendOn = true; this.blend = null; this.setBlend('source-over'); }
    if (this.T === t) return;
    this.flush();
    const gl = this.gl; this.T = t; this.W = t.W; this.H = t.H;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.viewport(0, 0, t.W, t.H); this._st = -1;
  }
  // an off-screen layer of its own (kept between frames; cleared with clearRect as a 2D canvas is).
  // Phases (Renderer.frame): in 'pre', before the frame's target is bound, the passes run against a context that
  // draws nothing (nullCtx) and build their layers — each use of a key its own instance (key#0, key#1…); in
  // 'main' the same passes run again for real and get, in the same order, a context that draws nothing but whose
  // canvas is the layer already made, so they only lay it on the picture. grow: the target may be larger than
  // asked (rounded up, kept while it fits), so a layer that changes size every frame is not reallocated.
  layer(key, W, H, grow, ms) {
    W = Math.max(1, W | 0); H = Math.max(1, H | 0);
    key += this.scope;                                         // each view (main, sight, thermal) its own set
    if (this.phase) { const c = this.lcount; const n = c[key] = (c[key] || 0) + 1; key += '#' + (n - 1); }
    let L = this.layers[key];
    if (!L) { L = this.layers[key] = { t: { clipD: 0, clipBox: [] } }; L.ctx = new DS.GLCtx(this, L.t); L.ctx.canvas._glTarget = L.t; }
    L.t.ms = !!ms;
    if (this.phase === 'main' && L.built === this.frameNo) { L.nul = L.nul || new DS.GLNull(this, L.ctx.canvas); L.nul.reset(L.ctx.canvas.width, L.ctx.canvas.height); L.nul.canvas = L.ctx.canvas; return L.nul; }
    let aw = W, ah = H;
    if (grow) { const t = L.t; aw = t.W >= W && t.W <= W * 2 + 64 ? t.W : Math.ceil(W * 1.25 / 32) * 32; ah = t.H >= H && t.H <= H * 2 + 64 ? t.H : Math.ceil(H * 1.25 / 32) * 32; }
    this.mkTarget(L.t, aw, ah); L.ctx.canvas.width = aw; L.ctx.canvas.height = ah;
    if (this.phase === 'pre') L.built = this.frameNo;
    return L.ctx;
  }
  // 4× MSAA on the frame and the sight: 'on', 'off', or 'auto' — off on high-density screens (2× and up, the
  // iPad's): edges there are already finer than the eye resolves, and the multisampled frame is four times the
  // memory traffic of a plain one on a tiled GPU
  setMsaa(m) { this.msaaMode = m; this.msaa = m === 'on' || (m === 'auto' && (window.devicePixelRatio || 1) < 1.75) ? this.maxSamples : 0; }
  setPhase(p) { this.phase = p; this.lcount = {}; if (p === 'pre') this.frameNo = (this.frameNo || 0) + 1; }
  // a context that draws nothing, with the frame's size (the pre phase's stand-in for the frame)
  nullCtx(W, H) { const n = this._nullMain || (this._nullMain = new DS.GLNull(this, { width: 1, height: 1, _gl: true })); n.reset(W, H); return n; }
  // the sight into the finished picture on screen (W × H device px). S: { cv (its layer's canvas), x, y, w, h (px,
  // y down), m (Float32Array of affine colour steps, 16 each), n, sh: [amp, t, dpr, row] | null, big, bg: 'blur' | 'black' }
  sightComposite(S, W, H) {
    const gl = this.gl; this.flush();
    const t = S.cv._glTarget; if (!t) return; this.resolve(t); this.inval();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); this.T = null; this.W = W; this.H = H;
    const quad = (x0, y0, x1, y1) => { const v = this.qv || (this.qv = new Float32Array(48)); let o = 0; for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]]) { v[o] = x; v[o + 1] = y; o += 8; } return v; };
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); this.blend = null;
    if (S.big) {
      let B = this.bgT;
      const bw = Math.max(1, W >> 2), bh = Math.max(1, H >> 2);
      if (!B || B.w !== bw || B.h !== bh) {
        const rg = this.rgl;
        if (!B) B = this.bgT = { t: this.mkTex(), f: rg.createFramebuffer() };
        this.rbind(B.t); rg.texImage2D(rg.TEXTURE_2D, 0, rg.RGBA8, bw, bh, 0, rg.RGBA, rg.UNSIGNED_BYTE, null);
        rg.texParameteri(rg.TEXTURE_2D, rg.TEXTURE_MIN_FILTER, rg.LINEAR_MIPMAP_LINEAR);
        rg.bindFramebuffer(rg.FRAMEBUFFER, B.f); rg.framebufferTexture2D(rg.FRAMEBUFFER, rg.COLOR_ATTACHMENT0, rg.TEXTURE_2D, B.t, 0);
        B.w = bw; B.h = bh;
      }
      if (S.bg !== 'black') {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, B.f);
        gl.blitFramebuffer(0, 0, W, H, 0, 0, bw, bh, gl.COLOR_BUFFER_BIT, gl.LINEAR);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.bind0(B.t); gl.generateMipmap(gl.TEXTURE_2D);
      }
      this.tris(this.pBg, quad(0, 0, W, H), 6, u => { this.bind0(B.t);
        gl.uniform4f(u.u_rect, S.x, S.y, S.w, S.h); gl.uniform1f(u.u_H, H); gl.uniform1f(u.u_mode, S.bg === 'black' ? 1 : 0); gl.uniform1f(u.u_lod, 1.6); });
    }
    this.tris(this.pSight, quad(S.x - 2, S.y - 2, S.x + S.w + 2, S.y + S.h + 2), 6, u => {
      this.bind0(t.color);
      gl.uniform4f(u.u_rect, S.x, S.y, S.w, S.h); gl.uniform1f(u.u_H, H); gl.uniformMatrix4fv(u.u_m, false, S.m); gl.uniform1i(u.u_n, S.n);
      const sh = S.sh || [0, 0, 1, 1]; gl.uniform4f(u.u_sh, sh[0], sh[1], sh[2], sh[3]); });
    gl.disable(gl.BLEND); this.blendOn = false; this.play();
  }
  // (clips are in the stencil now: the shaders' mask input stays off)
  maskU(u, P) { this.u1f(P, 'u_useMask', 0); }
  // stencil: bits 0–5 count path windings, bits 6–7 hold the clip depth (up to three nested clips). Outside a
  // fill, draws pass only where the clip depth is the current one.
  clipTest() {
    if (this.rawStencil) return;
    const gl = this.gl, D = this.T ? Math.min(3, this.T.clipD | 0) : 0;
    if (D === this._st) return;
    this._st = D;
    if (!D) { gl.disable(gl.STENCIL_TEST); return; }
    gl.enable(gl.STENCIL_TEST); gl.stencilMask(0); gl.stencilFunc(gl.EQUAL, D << 6, 0xC0); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  }
  // ---- cached GL state ----
  // everything another user of the context (DS.Post) may have changed: forget it
  inval() { const gl = this.gl; this.prog = null; this.b0 = null; this.b3 = null; this.vaoOn = false; this._st = -1; this.rawStencil = false; gl.activeTexture(gl.TEXTURE0); }
  use(P) {
    const gl = this.gl;
    if (this.prog !== P) { gl.useProgram(P.p); this.prog = P; }
    if (!this.vaoOn) { gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); this.vaoOn = true; }
    const c = P.c; if (c.rw !== this.W || c.rh !== this.H) { c.rw = this.W; c.rh = this.H; gl.uniform2f(P.u.u_res, this.W, this.H); }
  }
  u1f(P, n, v) { if (P.c[n] !== v && P.u[n]) { P.c[n] = v; this.gl.uniform1f(P.u[n], v); } }
  u1i(P, n, v) { if (P.c[n] !== v && P.u[n]) { P.c[n] = v; this.gl.uniform1i(P.u[n], v); } }
  bind0(t) { if (this.b0 !== t) { this.gl.bindTexture(this.gl.TEXTURE_2D, t); this.b0 = t; } }
  // clip: the path's fan winds into the low bits where the current clip holds, then wherever it wound the depth
  // goes up one (and the count back to zero); restore() lowers the depth again over the clip's box
  bbQuad(x0, y0, x1, y1) { const q = this.qv2 || (this.qv2 = new Float32Array(48)); let o = 0; for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]]) { q[o] = x; q[o + 1] = y; o += 8; } return q; }
  pushClip(ctx, v, n, x0, y0, x1, y1) {
    this.flush();
    const gl = this.gl, T = this.T, d = T.clipD | 0;
    if (d >= 3) { T.clipD = d + 1; return; }                    // (deeper than three: not clipped further)
    ctx.stencilFill(v, n, true);
    this.rawStencil = true;
    gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false); gl.stencilMask(0xff);
    gl.stencilFunc(gl.NOTEQUAL, (d + 1) << 6, 0x3f); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    this.tris(this.pTex, this.bbQuad(x0, y0, x1, y1), 6, () => this.bind0(this.white));
    gl.colorMask(true, true, true, true); this.rawStencil = false; this._st = -1;
    T.clipBox[d] = [x0, y0, x1, y1]; T.clipD = d + 1;
  }
  popClip(d) {
    const T = this.T; if (!T || (T.clipD | 0) === d) return;
    this.flush();
    const from = Math.min(3, T.clipD | 0), to = Math.min(3, d);
    if (from > to) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = to; k < from; k++) { const b = T.clipBox[k]; if (b) { x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); } }
      if (x1 > x0) {
        const gl = this.gl; this.rawStencil = true;
        gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false); gl.stencilMask(0xc0);
        gl.stencilFunc(gl.LESS, to << 6, 0xc0); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        this.tris(this.pTex, this.bbQuad(x0, y0, x1, y1), 6, () => this.bind0(this.white));
        gl.colorMask(true, true, true, true); this.rawStencil = false; this._st = -1;
      }
    }
    T.clipD = d;
  }
  // every 2D canvas counts its own changes (_v), so a repainted canvas is uploaded again (and only then)
  static trackCanvases() {
    if (DS.GLW._tracked) return; DS.GLW._tracked = true;
    const P = CanvasRenderingContext2D.prototype;
    for (const k of ['drawImage', 'fillRect', 'fill', 'stroke', 'strokeRect', 'clearRect', 'putImageData', 'fillText', 'strokeText']) {
      const f = P[k]; P[k] = function () { const c = this.canvas; c._v = (c._v || 0) + 1; return f.apply(this, arguments); };
    }
  }
  texRep(img) {
    const r = this.tex(img, true);
    if (!r.rep) { const gl = this.rgl; this.rbind(r.t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); r.rep = true; }
    return r;
  }
  atlasPage(i) {
    const gl = this.rgl, A = this.ATL; let pg = this.atl[i];
    if (pg) { this.flush(); this.play(); this.atlT.delete(pg.t); gl.deleteTexture(pg.t); pg.gen++; } else pg = this.atl[i] = { gen: 0 };   // (what was drawn from the old page goes out first)
    const t = pg.t = gl.createTexture(); this.rbind(t);
    gl.texStorage2D(gl.TEXTURE_2D, 4, gl.RGBA8, A, A);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 3);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(16 * 16 * 4).fill(255));
    pg.x = 16; pg.y = 0; pg.rowH = 16; this.atlT.set(t, pg); this.atlDirty.add(pg);
    return pg;
  }
  atlasAlloc(w, h) {
    const A = this.ATL, W = 16 + Math.ceil(w / 8) * 8, H = 16 + Math.ceil(h / 8) * 8;
    let pg = this.atl[this.atlI] || this.atlasPage(this.atlI);
    if (pg.x + W > A) { pg.y += pg.rowH; pg.x = 0; pg.rowH = 0; }
    if (pg.y + H > A) { this.atlI = (this.atlI + 1) % 3; pg = this.atlasPage(this.atlI); }
    const x = pg.x + 8, y = pg.y + 8; pg.x += W; pg.rowH = Math.max(pg.rowH, H);
    return { pg, x, y };
  }
  mkTex() {
    const gl = this.rgl, t = gl.createTexture(); this.rbind(t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // GL texture for an image, a 2D canvas (uploaded again when it changed) or a layer's canvas (its target)
  tex(img, rep) {
    if (img._glTarget) { const t = img._glTarget; this.resolve(t); return { t: t.color, w: t.W, h: t.H, flip: true, ou: 0, ov: 0, su: 1 / t.W, sv: 1 / t.H }; }
    const M = rep ? this.texsR : this.texs;
    let r = M.get(img);
    const v = img._v || 0, w = img.width, h = img.height;
    if (r && r.v === v && r.w === w && r.h === h && (!r.pg || r.pg.gen === r.gen)) return r;
    const gl = this.rgl;
    if (!rep && w <= 128 && h <= 128) {
      // small: a slot on an atlas page (a new one when the size changed or the page was wiped)
      if (!r || !r.pg || r.w !== w || r.h !== h || r.pg.gen !== r.gen) {
        const a = this.atlasAlloc(w, h), A = this.ATL;
        r = { pg: a.pg, gen: a.pg.gen, t: a.pg.t, x: a.x, y: a.y, ou: a.x / A, ov: a.y / A, su: 1 / A, sv: 1 / A }; M.set(img, r);
      }
      this.rbind(r.t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      this.upN = (this.upN || 0) + 1; this.upPx = (this.upPx || 0) + w * h;
      try { gl.texSubImage2D(gl.TEXTURE_2D, 0, r.x, r.y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (e) { /* unreadable image: stays blank */ }
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      this.atlDirty.add(r.pg);
      r.v = v; r.w = w; r.h = h;
      return r;
    }
    if (!r || r.pg) { r = { t: this.mkTex() }; M.set(img, r); }
    // a canvas that says which part changed (a building's face): only that rectangle goes up
    const d = img._dtrack && img._dirty;
    if (d && d !== 'all' && r.w === w && r.h === h && r.v != null) {
      const x0 = Math.max(0, d[0]), y0 = Math.max(0, d[1]), x1 = Math.min(w, d[2]), y1 = Math.min(h, d[3]);
      img._dirty = null; r.v = v;
      if (x1 > x0 && y1 > y0) {
        this.rbind(r.t);
        try {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
          gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, y0);
          this.upN = (this.upN || 0) + 1; this.upPx = (this.upPx || 0) + (x1 - x0) * (y1 - y0);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x1 - x0, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, img);
        } catch (e) { img._dtrack = false; }               // (not supported here: whole uploads from now on)
        gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        if (w > 1 && h > 1) gl.generateMipmap(gl.TEXTURE_2D);
      }
      return r;
    }
    if (img._dtrack) img._dirty = null;
    this.rbind(r.t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    this.upN = (this.upN || 0) + 1; this.upPx = (this.upPx || 0) + w * h;
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (e) { /* unreadable image: stays blank */ }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (w > 1 && h > 1) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    if (r.rep) { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); }
    r.v = v; r.w = w; r.h = h; r.ou = 0; r.ov = 0; r.su = 1 / w; r.sv = 1 / h;
    return r;
  }
  // a white texel for solid quads: on the atlas page being batched if there is one (no batch break)
  solidT() { const p = this.curTex && this.atlT.get(this.curTex); return p ? p.t : this.white; }
  solidUV() { return this.curTex && this.atlT.has(this.curTex) ? 8 / this.ATL : 0.5; }
  // CSS colour → premultiplied [r, g, b, a] (cached)
  col(s) {
    let c = this.cols.get(s); if (c) return c;
    let r = 0, g = 0, b = 0, a = 1, m;
    if (s[0] === '#') {
      const h = s.slice(1);
      if (h.length === 3 || h.length === 4) { r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16); if (h.length === 4) a = parseInt(h[3] + h[3], 16) / 255; }
      else { r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255; }
    } else if ((m = /rgba?\(([^)]+)\)/.exec(s))) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); r = p[0]; g = p[1]; b = p[2]; a = p.length > 3 ? p[3] : 1;
    } else if (s === 'transparent') a = 0;
    else if (s === 'white') { r = g = b = 255; }
    c = [r / 255 * a, g / 255 * a, b / 255 * a, a];
    if (this.cols.size > 4000) this.cols.clear();
    this.cols.set(s, c); return c;
  }
  // ---- frame ----
  begin(W, H) {
    const gl = this.gl;
    W = Math.max(1, W | 0); H = Math.max(1, H | 0);
    this.play(); this.inval();
    this.main.ms = true; this.mkTarget(this.main, W, H); this.T = null; this.bind(this.main);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 1); gl.clearStencil(0); gl.stencilMask(0xff); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.BLEND); this.blendOn = true; this.blend = null; this.setBlend('source-over');
    gl.disable(gl.STENCIL_TEST); this._st = 0;
    this.curTex = null; this.nv = 0; this.draws = 0; this.main.clipD = 0;
    this.ctx.reset(W, H);
    this.color = this.main.color;
    return this.ctx;
  }
  // off-screen work done outside begin/end (the sight): send what is batched, leave the context to DS.Post
  finish() { this.flush(); this.setBlend('source-over'); this.gl.disable(this.gl.BLEND); this.blendOn = false; this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); this.T = null; this.play(); }
  end() { this.flush(); this.setBlend('source-over'); this.gl.disable(this.gl.BLEND); this.blendOn = false; this.resolve(this.main); this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); this.T = null; this.play(); }   // (blending off: DS.Post draws after)
  setBlend(op) {
    if (op === this.blend) return;
    this.flush(); const gl = this.gl; this.blend = op;
    switch (op) {
      case 'lighter': gl.blendFunc(gl.ONE, gl.ONE); break;
      case 'light': gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE, gl.ZERO, gl.ONE); break;            // dst × (1 + src): light falling on the picture
      case 'source-atop': gl.blendFuncSeparate(gl.DST_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); break;
      case 'source-in': gl.blendFunc(gl.DST_ALPHA, gl.ZERO); break;
      case 'destination-in': gl.blendFunc(gl.ZERO, gl.SRC_ALPHA); break;
      case 'destination-out': gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA); break;
      default: gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }
  // ---- batched quads ----
  quad(t, x0, y0, x1, y1, x2, y2, x3, y3, u0, v0, u1, v1, c) {
    if (t !== this.curTex || this.nv + 6 > this.MAXQ * 6) { this.flush(); this.curTex = t; }
    const b = this.vb; let o = this.nv * 8;
    b[o] = x0; b[o + 1] = y0; b[o + 2] = u0; b[o + 3] = v0; b[o + 4] = c[0]; b[o + 5] = c[1]; b[o + 6] = c[2]; b[o + 7] = c[3]; o += 8;
    b[o] = x1; b[o + 1] = y1; b[o + 2] = u1; b[o + 3] = v0; b[o + 4] = c[0]; b[o + 5] = c[1]; b[o + 6] = c[2]; b[o + 7] = c[3]; o += 8;
    b[o] = x2; b[o + 1] = y2; b[o + 2] = u1; b[o + 3] = v1; b[o + 4] = c[0]; b[o + 5] = c[1]; b[o + 6] = c[2]; b[o + 7] = c[3]; o += 8;
    b[o] = x0; b[o + 1] = y0; b[o + 2] = u0; b[o + 3] = v0; b[o + 4] = c[0]; b[o + 5] = c[1]; b[o + 6] = c[2]; b[o + 7] = c[3]; o += 8;
    b[o] = x2; b[o + 1] = y2; b[o + 2] = u1; b[o + 3] = v1; b[o + 4] = c[0]; b[o + 5] = c[1]; b[o + 6] = c[2]; b[o + 7] = c[3]; o += 8;
    b[o] = x3; b[o + 1] = y3; b[o + 2] = u0; b[o + 3] = v1; b[o + 4] = c[0]; b[o + 5] = c[1]; b[o + 6] = c[2]; b[o + 7] = c[3];
    this.nv += 6;
  }
  texU(P) { this.u1f(P, 'u_bias', this.fx.bias); this.u1f(P, 'u_gray', this.fx.gray); }
  flush() {
    if (!this.nv) return;
    const gl = this.gl, P = this.pTex;
    if (this.atlDirty.size) this.atlMips();
    this.use(P); this.maskU(P.u, P); this.texU(P); this.bind0(this.curTex); this.clipTest();
    gl.drawArrays(gl.TRIANGLES, this.put(this.vb, this.nv), this.nv); this.draws++;
    this.nv = 0;
  }
  atlMips() { const gl = this.rgl; for (const pg of this.atlDirty) { this.rbind(pg.t); gl.generateMipmap(gl.TEXTURE_2D); } this.atlDirty.clear(); }
  // one triangle into the quad batch (solid fills of convex paths, opaque strokes)
  tri3(t, x0, y0, x1, y1, x2, y2, u, v, c) {
    if (t !== this.curTex || this.nv + 3 > this.MAXQ * 6) { this.flush(); this.curTex = t; }
    const b = this.vb; let o = this.nv * 8;
    b[o] = x0; b[o + 1] = y0; b[o + 2] = u; b[o + 3] = v; b[o + 4] = c[0]; b[o + 5] = c[1]; b[o + 6] = c[2]; b[o + 7] = c[3]; o += 8;
    b[o] = x1; b[o + 1] = y1; b[o + 2] = u; b[o + 3] = v; b[o + 4] = c[0]; b[o + 5] = c[1]; b[o + 6] = c[2]; b[o + 7] = c[3]; o += 8;
    b[o] = x2; b[o + 1] = y2; b[o + 2] = u; b[o + 3] = v; b[o + 4] = c[0]; b[o + 5] = c[1]; b[o + 6] = c[2]; b[o + 7] = c[3];
    this.nv += 3;
  }
  // raw triangles (device px) through a program, outside the quad batch: stencil fans, covers, gradients
  tris(prog, verts, n, setU) {
    this.flush();
    const gl = this.gl; if (this.atlDirty.size) this.atlMips();
    this.use(prog); this.maskU(prog.u, prog); if (prog === this.pTex) this.texU(prog); if (setU) setU(prog.u, prog); this.clipTest();
    gl.drawArrays(gl.TRIANGLES, this.put(verts, n), n); this.draws++;
  }
  // n vertices into the ring; returns the index of the first
  put(verts, n) {
    if (!this.fv) {                                            // (not recording: straight into the buffer)
      const gl = this.gl; gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, n * 8), gl.STREAM_DRAW); return 0;
    }
    if ((this.fn + n) * 8 > this.fv.length) { const nv = new Float32Array(Math.max(this.fv.length * 2, (this.fn + n) * 8)); nv.set(this.fv.subarray(0, this.fn * 8)); this.fv = nv; }
    this.fv.set(verts.subarray(0, n * 8), this.fn * 8);
    const f = this.fn; this.fn += n; return f;
  }
};

// The drawing context (the subset of CanvasRenderingContext2D the renderer uses), bound to a render target.
DS.GLCtx = class GLCtx {
  constructor(r, tg) { this.r = r; this.tg = tg; this.canvas = { width: 1, height: 1, _gl: true }; this.reset(1, 1); this.tmp = new Float32Array(4096 * 8); }
  T() { return this.tg === 'main' ? this.r.main : this.tg; }
  _b() { this.r.bind(this.T()); }
  reset(W, H) {
    this.canvas.width = W; this.canvas.height = H;
    this.m = [1, 0, 0, 1, 0, 0]; this.stack = [];
    this.globalAlpha = 1; this.globalCompositeOperation = 'source-over';
    this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1; this.lineCap = 'butt'; this.lineJoin = 'miter';
    this.imageSmoothingEnabled = true; this.imageSmoothingQuality = 'low'; this.filter = 'none';
    this.path = []; this.sub = null; this.dash = null;
  }
  // ---- state ----
  save() { this.stack.push([this.m.slice(), this.globalAlpha, this.globalCompositeOperation, this.fillStyle, this.strokeStyle, this.lineWidth, this.lineCap, this.lineJoin, this.dash, this.T().clipD || 0, this.filter]); }
  restore() {
    const s = this.stack.pop(); if (!s) return; let d;
    [this.m, this.globalAlpha, this.globalCompositeOperation, this.fillStyle, this.strokeStyle, this.lineWidth, this.lineCap, this.lineJoin, this.dash, d, this.filter] = s;
    const T = this.T(); if ((T.clipD || 0) !== d) { this._b(); this.r.popClip(d); }
  }
  setLineDash(a) { this.dash = a && a.length ? a.slice() : null; }
  getLineDash() { return this.dash ? this.dash.slice() : []; }
  createPattern(img) { return new DS.GLPat(img); }
  setTransform(a, b, c, d, e, f) { if (a === undefined) { this.m = [1, 0, 0, 1, 0, 0]; return; } if (typeof a === 'object') { const M = a; this.m = [M.a, M.b, M.c, M.d, M.e, M.f]; } else this.m = [a, b, c, d, e, f]; }
  getTransform() { const m = this.m; return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }; }
  resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
  transform(a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(x, y) { const m = this.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.transform(c, s, -s, c, 0, 0); }
  X(x, y) { const m = this.m; return m[0] * x + m[2] * y + m[4]; }
  Y(x, y) { const m = this.m; return m[1] * x + m[3] * y + m[5]; }
  inv() { const m = this.m, det = m[0] * m[3] - m[1] * m[2] || 1e-12; return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det]; }
  solid(style) { const c = this.r.col(style), a = this.globalAlpha; return a === 1 ? c : [c[0] * a, c[1] * a, c[2] * a, c[3] * a]; }
  // ---- images ----
  drawImage(img, a, b, c, d, e, f, g, h) {
    if (!img || !img.width || !img.height) return;
    let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
    if (e === undefined) { dx = a; dy = b; dw = c === undefined ? img.width : c; dh = d === undefined ? img.height : d; }
    else { sx = a; sy = b; sw = c; sh = d; dx = e; dy = f; dw = g; dh = h; }
    this._b(); const R = this.r; R.setBlend(this.globalCompositeOperation);
    const t = R.tex(img); let u0 = t.ou + sx * t.su, v0 = t.ov + sy * t.sv, u1 = t.ou + (sx + sw) * t.su, v1 = t.ov + (sy + sh) * t.sv, ga = this.globalAlpha;
    if (t.flip) { v0 = 1 - v0; v1 = 1 - v1; }                 // a layer: rows stored bottom up
    // filter: grayscale(k) and blur (a softer mip level) for this image
    let fx = null;
    if (this.filter && this.filter !== 'none') { const gm = /grayscale\(([\d.]+)\)/.exec(this.filter), bm = /blur\(([\d.]+)px\)/.exec(this.filter); fx = { gray: gm ? +gm[1] : 0, bias: bm ? Math.log2(1 + +bm[1]) * 1.5 : -0.6 }; }
    if (fx) { R.flush(); R.fx = fx; }
    const gc = this._gac && this._gac[0] === ga ? this._gac : (this._gac = [ga, ga, ga, ga]);       // (quad copies it: reused while the opacity stays)
    R.quad(t.t, this.X(dx, dy), this.Y(dx, dy), this.X(dx + dw, dy), this.Y(dx + dw, dy), this.X(dx + dw, dy + dh), this.Y(dx + dw, dy + dh), this.X(dx, dy + dh), this.Y(dx, dy + dh), u0, v0, u1, v1, gc);
    if (fx) { R.flush(); R.fx = { bias: -0.6, gray: 0 }; }
  }
  // ---- rectangles ----
  fillRect(x, y, w, h) {
    this._b(); const R = this.r; R.setBlend(this.globalCompositeOperation);
    if (typeof this.fillStyle === 'string') {
      const wu = R.solidUV();
      R.quad(R.solidT(), this.X(x, y), this.Y(x, y), this.X(x + w, y), this.Y(x + w, y), this.X(x + w, y + h), this.Y(x + w, y + h), this.X(x, y + h), this.Y(x, y + h), wu, wu, wu, wu, this.solid(this.fillStyle));
    } else if (this.fillStyle instanceof DS.GLPat || (typeof CanvasPattern !== 'undefined' && this.fillStyle instanceof CanvasPattern)) {
      // pattern: tiled in the pattern's space (its own transform, as set on the 2D pattern, times the user space)
      const P = this.fillStyle, img = P.img || P._src; if (!img) return;
      const t = R.texRep(img), pm = P.m || (P._m ? [P._m.a, P._m.b, P._m.c, P._m.d, P._m.e, P._m.f] : [1, 0, 0, 1, 0, 0]);
      const det = pm[0] * pm[3] - pm[1] * pm[2] || 1e-12, U = (px, py) => { const qx = px - pm[4], qy = py - pm[5]; return [(pm[3] * qx - pm[2] * qy) / det / t.w, (-pm[1] * qx + pm[0] * qy) / det / t.h]; };
      const c = [this.globalAlpha, this.globalAlpha, this.globalAlpha, this.globalAlpha], a = U(x, y), b = U(x + w, y), cc = U(x + w, y + h), d = U(x, y + h);
      R.flush(); R.curTex = t.t;
      const vb = R.vb; let o = R.nv * 8;
      const Pt = (px, py, uv) => { vb[o] = this.X(px, py); vb[o + 1] = this.Y(px, py); vb[o + 2] = uv[0]; vb[o + 3] = uv[1]; vb[o + 4] = c[0]; vb[o + 5] = c[1]; vb[o + 6] = c[2]; vb[o + 7] = c[3]; o += 8; };
      Pt(x, y, a); Pt(x + w, y, b); Pt(x + w, y + h, cc); Pt(x, y, a); Pt(x + w, y + h, cc); Pt(x, y + h, d); R.nv += 6; R.flush();
    } else this.gradQuad(this.fillStyle, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  }
  strokeRect(x, y, w, h) { const p = this.path, s = this.sub; this.beginPath(); this.rect(x, y, w, h); this.stroke(); this.path = p; this.sub = s; }
  // clear to transparent (the rectangle's device-space bounds)
  clearRect(x, y, w, h) {
    this._b(); const R = this.r, gl = R.gl; R.flush();
    const xs = [this.X(x, y), this.X(x + w, y), this.X(x, y + h), this.X(x + w, y + h)], ys = [this.Y(x, y), this.Y(x + w, y), this.Y(x, y + h), this.Y(x + w, y + h)];
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(R.W, Math.ceil(Math.max(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(R.H, Math.ceil(Math.max(...ys)));
    if (x1 <= x0 || y1 <= y0) return;
    gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, R.H - y1, x1 - x0, y1 - y0);         // (GL rows count from the bottom)
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.disable(gl.SCISSOR_TEST);
  }
  // ---- gradients ----
  createLinearGradient(x0, y0, x1, y1) { return new DS.GLGrad(0, [x0, y0, x1, y1]); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new DS.GLGrad(1, [x0, y0, r0, x1, y1, r1]); }
  gradQuad(G, U) {
    const R = this.r, v = this.tmp; let o = 0;
    const P = (q) => { v[o] = this.X(q[0], q[1]); v[o + 1] = this.Y(q[0], q[1]); v[o + 2] = q[0]; v[o + 3] = q[1]; v[o + 4] = v[o + 5] = v[o + 6] = v[o + 7] = 1; o += 8; };
    P(U[0]); P(U[1]); P(U[2]); P(U[0]); P(U[2]); P(U[3]);
    R.tris(R.pGrad, v, 6, u => this.gradUniforms(u, G));
  }
  gradUniforms(u, G) {
    const gl = this.r.gl, n = Math.min(8, G.stops.length), off = new Float32Array(8), cs = new Float32Array(32);
    if (!G.sorted) { G.stops.sort((p, q) => p[0] - q[0]); G.sorted = true; }
    for (let i = 0; i < n; i++) { off[i] = G.stops[i][0]; cs.set(this.r.col(G.stops[i][1]), i * 4); }
    const a = G.a, R = this.r, P = R.pGrad; R.u1i(P, 'u_kind', G.kind);
    if (G.kind === 0) { gl.uniform2f(u.u_p0, a[0], a[1]); gl.uniform2f(u.u_p1, a[2], a[3]); }
    else { gl.uniform3f(u.u_c0, a[0], a[1], a[2]); gl.uniform3f(u.u_c1, a[3], a[4], a[5]); }
    R.u1i(P, 'u_n', Math.max(1, n)); gl.uniform1fv(u.u_off, off, 0, Math.max(1, n)); gl.uniform4fv(u.u_c, cs, 0, Math.max(1, n) * 4); R.u1f(P, 'u_a', this.globalAlpha);
  }
  // ---- paths (points stored in device space, as the 2D canvas transforms them when they are added) ----
  beginPath() { this.path = []; this.sub = null; }
  moveTo(x, y) { this.sub = [this.X(x, y), this.Y(x, y)]; this.sub.closed = false; this.path.push(this.sub); }
  lineTo(x, y) { if (!this.sub) return this.moveTo(x, y); this.sub.push(this.X(x, y), this.Y(x, y)); }
  lineToD(x, y) { if (!this.sub) { this.sub = [x, y]; this.sub.closed = false; this.path.push(this.sub); } else this.sub.push(x, y); }
  closePath() { if (this.sub) { this.sub.closed = true; const s = this.sub; this.sub = [s[0], s[1]]; this.sub.closed = false; this.path.push(this.sub); } }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  scaleOf() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])); }
  arc(cx, cy, r, a0, a1, ccw) { this.ellipse(cx, cy, r, r, 0, a0, a1, ccw); }
  ellipse(cx, cy, rx, ry, rot, a0, a1, ccw) {
    let d = a1 - a0; const T = Math.PI * 2;
    if (ccw) { if (d > 0) d -= T * Math.ceil(d / T); if (a0 - a1 >= T) d = -T; } else { if (d < 0) d += T * Math.ceil(-d / T); if (a1 - a0 >= T) d = T; }
    if (Math.abs(d) > T) d = Math.sign(d) * T;
    const rs = Math.max(rx, ry) * this.scaleOf(), n = Math.max(6, Math.min(128, Math.ceil(Math.abs(d) * Math.sqrt(Math.max(1, rs)) * 1.3)));
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const a = a0 + d * i / n, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry, x = cx + ex * cr - ey * sr, y = cy + ex * sr + ey * cr;
      if (i === 0 && !this.sub) this.moveTo(x, y); else this.lineTo(x, y);
    }
  }
  quadraticCurveTo(qx, qy, x, y) {
    if (!this.sub) this.moveTo(qx, qy);
    const s = this.sub, x0 = s[s.length - 2], y0 = s[s.length - 1], X1 = this.X(qx, qy), Y1 = this.Y(qx, qy), X2 = this.X(x, y), Y2 = this.Y(x, y);
    const n = Math.max(4, Math.min(40, Math.ceil((Math.hypot(X1 - x0, Y1 - y0) + Math.hypot(X2 - X1, Y2 - Y1)) / 6)));
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.lineToD(u * u * x0 + 2 * u * t * X1 + t * t * X2, u * u * y0 + 2 * u * t * Y1 + t * t * Y2); }
  }
  bezierCurveTo(ax, ay, bx, by, x, y) {
    if (!this.sub) this.moveTo(ax, ay);
    const s = this.sub, x0 = s[s.length - 2], y0 = s[s.length - 1], X1 = this.X(ax, ay), Y1 = this.Y(ax, ay), X2 = this.X(bx, by), Y2 = this.Y(bx, by), X3 = this.X(x, y), Y3 = this.Y(x, y);
    const n = Math.max(4, Math.min(48, Math.ceil((Math.hypot(X1 - x0, Y1 - y0) + Math.hypot(X2 - X1, Y2 - Y1) + Math.hypot(X3 - X2, Y3 - Y2)) / 6)));
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.lineToD(u * u * u * x0 + 3 * u * u * t * X1 + 3 * u * t * t * X2 + t * t * t * X3, u * u * u * y0 + 3 * u * u * t * Y1 + 3 * u * t * t * Y2 + t * t * t * Y3); }
  }
  fanOf() {
    const subs = this.path.filter(s => s.length >= 6);
    let n = 0, v = this.tmp, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const push = (x, y) => { if (n * 8 + 8 > v.length) { const nv = new Float32Array(v.length * 2); nv.set(v); this.tmp = v = nv; } v[n * 8] = x; v[n * 8 + 1] = y; n++; };
    for (const s of subs) {
      for (let i = 2; i + 3 < s.length; i += 2) { push(s[0], s[1]); push(s[i], s[i + 1]); push(s[i + 2], s[i + 3]); }
      for (let i = 0; i < s.length; i += 2) { x0 = Math.min(x0, s[i]); x1 = Math.max(x1, s[i]); y0 = Math.min(y0, s[i + 1]); y1 = Math.max(y1, s[i + 1]); }
    }
    return { v, n, x0, y0, x1, y1 };
  }
  clip() {
    this._b(); const F = this.fanOf();
    if (!F.n) { F.x0 = F.y0 = F.x1 = F.y1 = -10; }       // an empty clip: nothing is drawn until restore
    this.r.pushClip(this, F.v, F.n, Math.floor(F.x0) - 1, Math.floor(F.y0) - 1, Math.ceil(F.x1) + 1, Math.ceil(F.y1) + 1);
  }
  // nonzero fill through the stencil: each subpath as a triangle fan from its first point (front faces add,
  // back faces subtract), then the bounding box drawn where the count is not zero (and the count cleared)
  fill() {
    this._b(); const R = this.r; R.setBlend(this.globalCompositeOperation);
    if (typeof this.fillStyle === 'string' && this.fastFill()) return;
    R.flush();
    const F = this.fanOf(); if (!F.n) return;
    this.stencilFill(F.v, F.n, true);
    this.cover(F.x0, F.y0, F.x1, F.y1, this.fillStyle);
  }
  // a solid fill of one convex outline needs no stencil: its fan goes straight into the quad batch
  fastFill() {
    let s = null;
    for (const q of this.path) if (q.length >= 6) { if (s) return false; s = q; }
    if (!s) return true;
    const n = s.length >> 1; let sg = 0, turn = 0;
    for (let i = 0; i < n; i++) {
      const a = i * 2, b = ((i + 1) % n) * 2, c = ((i + 2) % n) * 2;
      const ux = s[b] - s[a], uy = s[b + 1] - s[a + 1], vx = s[c] - s[b], vy = s[c + 1] - s[b + 1];
      const cr = ux * vy - uy * vx; if (Math.abs(cr) < 1e-6) continue;
      const k = cr > 0 ? 1 : -1; if (sg && k !== sg) return false; sg = k;
      turn += Math.atan2(cr, ux * vx + uy * vy);
    }
    if (Math.abs(turn) > 6.3) return false;                  // winds round more than once (a star): stencil
    const R = this.r, t = R.solidT(), wu = R.solidUV(), c = this.solid(this.fillStyle);
    for (let i = 2; i < n; i++) R.tri3(t, s[0], s[1], s[i * 2 - 2], s[i * 2 - 1], s[i * 2], s[i * 2 + 1], wu, wu, c);
    return true;
  }
  // stroke: each segment a quad (butt ends, plus round caps/joins when asked) into the stencil, then the cover
  stroke() {
    this._b(); const R = this.r; R.setBlend(this.globalCompositeOperation);
    const sc = this.scaleOf(), hw = Math.max(0.35, this.lineWidth * sc / 2), round = this.lineCap === 'round' || this.lineJoin === 'round';
    let n = 0, v = this.tmp, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const grow = () => { const nv = new Float32Array(v.length * 2); nv.set(v); this.tmp = v = nv; };
    const tri = (ax, ay, bx, by, cx, cy) => { if ((n + 3) * 8 > v.length) grow(); v[n * 8] = ax; v[n * 8 + 1] = ay; n++; v[n * 8] = bx; v[n * 8 + 1] = by; n++; v[n * 8] = cx; v[n * 8 + 1] = cy; n++; };
    const seg = (ax, ay, bx, by) => {
      const L = Math.hypot(bx - ax, by - ay); if (L < 1e-6) return;
      const nx = -(by - ay) / L * hw, ny = (bx - ax) / L * hw;
      tri(ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny); tri(ax + nx, ay + ny, bx - nx, by - ny, ax - nx, ay - ny);
      x0 = Math.min(x0, ax - hw, bx - hw); x1 = Math.max(x1, ax + hw, bx + hw); y0 = Math.min(y0, ay - hw, by - hw); y1 = Math.max(y1, ay + hw, by + hw);
    };
    const disc = (cx, cy) => { const k = Math.max(6, Math.min(16, Math.ceil(hw * 1.2))); for (let i = 0; i < k; i++) { const a = i / k * 6.2832, b = (i + 1) / k * 6.2832; tri(cx, cy, cx + Math.cos(a) * hw, cy + Math.sin(a) * hw, cx + Math.cos(b) * hw, cy + Math.sin(b) * hw); } };
    const dash = this.dash ? this.dash.map(d => d * sc) : null, dl = dash ? dash.reduce((p, q) => p + q, 0) : 0;
    for (const s of this.path) {
      const pts = s.closed ? s.concat([s[0], s[1]]) : s;
      if (pts.length < 4) continue;
      if (dash && dl > 0) {                                // split into the dashes (device px along the line)
        let pos = 0;
        for (let i = 0; i + 3 < pts.length; i += 2) {
          const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3], L = Math.hypot(bx - ax, by - ay);
          // only the part on the target is cut into dashes (a flight path kilometres long made tens of thousands
          // of them and stalled the GPU); off it the dash phase just moves on
          const cl = this.clipSeg(ax, ay, bx, by, hw + 2); if (!cl) { pos = (pos + L) % dl; continue; }
          let u = cl[0] * L; pos = (pos + u) % dl; const uEnd = cl[1] * L;
          // the phase is kept within one pattern (a long flight path summed to a huge pos, and a phase a rounding
          // error short of a dash end gave a zero step: the loop never moved on and the game froze); every step
          // moves at least a thousandth of a pixel, and the count is capped
          for (let guard = 0; u < uEnd && guard < 8192; guard++) {
            let ph = pos, k = 0; while (ph >= dash[k] && k < 64) { ph -= dash[k]; k++; } k %= dash.length;
            const step = Math.min(uEnd - u, Math.max(1e-3, dash[k] - ph));
            if (k % 2 === 0) seg(ax + (bx - ax) * u / L, ay + (by - ay) * u / L, ax + (bx - ax) * (u + step) / L, ay + (by - ay) * (u + step) / L);
            u += step; pos = (pos + step) % dl;
          }
          pos = (pos + L - uEnd) % dl;
        }
        continue;
      }
      for (let i = 0; i + 3 < pts.length; i += 2) { const cl = this.clipSeg(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], hw + 2); if (cl) seg(pts[i] + (pts[i + 2] - pts[i]) * cl[0], pts[i + 1] + (pts[i + 3] - pts[i + 1]) * cl[0], pts[i] + (pts[i + 2] - pts[i]) * cl[1], pts[i + 1] + (pts[i + 3] - pts[i + 1]) * cl[1]); }
      // round caps and joins: invisible on a line under ~2.5 px, and a straight-on joint needs none — discs only at the
      // ends and where the line turns by more than ~8°
      if (round && hw > 1.2) for (let i = 0; i < pts.length; i += 2) {
        const end = !s.closed && (i === 0 || i === pts.length - 2);
        if (!end && i >= 2 && i + 3 < pts.length) { const ax = pts[i] - pts[i - 2], ay = pts[i + 1] - pts[i - 1], bx = pts[i + 2] - pts[i], by = pts[i + 3] - pts[i + 1];
          const cr = ax * by - ay * bx, dt = ax * bx + ay * by; if (dt > 0 && Math.abs(cr) < 0.14 * dt) continue; }
        if (this.clipSeg(pts[i], pts[i + 1], pts[i], pts[i + 1] + 0.01, hw + 2)) disc(pts[i], pts[i + 1]);
      }
    }
    if (!n) return;
    // opaque solid: overlaps between the pieces cannot show, so they go straight into the batch
    if (typeof this.strokeStyle === 'string') { const c = this.solid(this.strokeStyle);
      if (c[3] >= 0.999 && this.globalCompositeOperation === 'source-over') { const t = R.solidT(), wu = R.solidUV();
        for (let i = 0; i + 2 < n; i += 3) R.tri3(t, v[i * 8], v[i * 8 + 1], v[i * 8 + 8], v[i * 8 + 9], v[i * 8 + 16], v[i * 8 + 17], wu, wu, c); return; } }
    R.flush();
    this.stencilFill(v, n, false);
    this.cover(x0, y0, x1, y1, this.strokeStyle);
  }
  // the part of a segment (device px) inside the target grown by m: [t0, t1] along it, or null (Liang–Barsky)
  clipSeg(ax, ay, bx, by, m) {
    const T = this.T(), x0 = -m, y0 = -m, x1 = (T.W || this.canvas.width) + m, y1 = (T.H || this.canvas.height) + m, dx = bx - ax, dy = by - ay;
    let t0 = 0, t1 = 1;
    for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]]) {
      if (p === 0) { if (q < 0) return null; continue; }
      const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return t1 > t0 ? [t0, t1] : null;
  }
  stencilFill(v, n, nonzero) {
    const R = this.r, gl = R.gl, D = Math.min(3, this.T().clipD | 0) << 6;
    R.flush(); R.rawStencil = true;
    gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false); gl.stencilMask(0x3f);
    if (nonzero) { gl.stencilFunc(gl.EQUAL, D, 0xc0); gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP); }
    else { gl.stencilFunc(gl.EQUAL, D | 1, 0xc0); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); }
    R.tris(R.pTex, v, n, () => R.bind0(R.white));
    gl.colorMask(true, true, true, true); R.rawStencil = false; R._st = -1;
  }
  cover(x0, y0, x1, y1, style) {
    const R = this.r, gl = R.gl;
    R.rawStencil = true; gl.enable(gl.STENCIL_TEST); gl.stencilMask(0x3f);
    gl.stencilFunc(gl.NOTEQUAL, 0, 0x3f); gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);
    x0 = Math.floor(x0) - 1; y0 = Math.floor(y0) - 1; x1 = Math.ceil(x1) + 1; y1 = Math.ceil(y1) + 1;
    if (typeof style === 'string') {
      const c = this.solid(style), v = this.tmp; let o = 0;
      for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]]) { v[o] = x; v[o + 1] = y; v[o + 2] = 0; v[o + 3] = 0; v[o + 4] = c[0]; v[o + 5] = c[1]; v[o + 6] = c[2]; v[o + 7] = c[3]; o += 8; }
      R.tris(R.pTex, v, 6, () => R.bind0(R.white));
    } else if (style instanceof DS.GLGrad) {
      // gradient: corners carried back into the user space of the fill
      const I = this.inv(), U = q => [I[0] * q[0] + I[2] * q[1] + I[4], I[1] * q[0] + I[3] * q[1] + I[5]];
      const v = this.tmp; let o = 0;
      for (const q of [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]]) { const u = U(q); v[o] = q[0]; v[o + 1] = q[1]; v[o + 2] = u[0]; v[o + 3] = u[1]; v[o + 4] = v[o + 5] = v[o + 6] = v[o + 7] = 1; o += 8; }
      R.tris(R.pGrad, v, 6, u => this.gradUniforms(u, style));
    } else {
      // a pattern fill over a path: drawn as a pattern rectangle under the stencil test
      const I = this.inv(), U = q => [I[0] * q[0] + I[2] * q[1] + I[4], I[1] * q[0] + I[3] * q[1] + I[5]];
      const a = U([x0, y0]), b = U([x1, y1]), save = this.fillStyle; this.fillStyle = style;
      const lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1])], hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
      this.fillRect(lo[0], lo[1], hi[0] - lo[0], hi[1] - lo[1]); R.flush(); this.fillStyle = save;
    }
    R.rawStencil = false; R._st = -1;
  }
};
// a CSS filter chain (grayscale, sepia, saturate, hue-rotate, brightness, contrast, invert) as affine colour steps
// for the sight shader: column-major mat4s (rgb rows, offset in the fourth column), at most six
DS.GLW.filterMats = function (css) {
  const out = new Float32Array(96); let n = 0;
  const put = (R, off = [0, 0, 0]) => { if (n >= 6) return; const b = n * 16; for (let r = 0; r < 3; r++) { for (let c = 0; c < 3; c++) out[b + c * 4 + r] = R[r * 3 + c]; out[b + 12 + r] = off[r]; } out[b + 15] = 1; n++; };
  for (const m of (css || '').matchAll(/([a-z-]+)\(([-\d.]+)(deg)?\)/g)) {
    const f = m[1], v = +m[2];
    if (f === 'grayscale') { const a = 1 - Math.min(1, v); put([0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a, 0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a, 0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a]); }
    else if (f === 'sepia') { const a = 1 - Math.min(1, v); put([0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a, 0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a, 0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a]); }
    else if (f === 'saturate') put([0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v, 0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v, 0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v]);
    else if (f === 'hue-rotate') { const a = v * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      put([0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]); }
    else if (f === 'brightness') put([v, 0, 0, 0, v, 0, 0, 0, v]);
    else if (f === 'contrast') put([v, 0, 0, 0, v, 0, 0, 0, v], [0.5 - 0.5 * v, 0.5 - 0.5 * v, 0.5 - 0.5 * v]);
    else if (f === 'invert') { const a = Math.min(1, v), k = 1 - 2 * a; put([k, 0, 0, 0, k, 0, 0, 0, k], [a, a, a]); }
  }
  return { m: out, n };
};
// draws nothing (keeps transforms and state): the stand-in frame of the pre phase, and a made layer's context in
// the main phase
DS.GLNull = class GLNull extends DS.GLCtx {
  constructor(r, canvas) { super(r, { clipD: 0, clipBox: [] }); this.canvas = canvas; }
  reset(W, H) { const c = this.canvas; super.reset(W, H); if (c) this.canvas = c; }
  _b() {} drawImage() {} fillRect() {} clearRect() {} fill() {} stroke() {} strokeRect() {} clip() {} fillText() {} strokeText() {}
};
DS.GLPat = class GLPat {
  constructor(img) { this.img = img; this.m = [1, 0, 0, 1, 0, 0]; }
  setTransform(M) { this.m = M ? [M.a, M.b, M.c, M.d, M.e, M.f] : [1, 0, 0, 1, 0, 0]; }
};
DS.GLGrad = class GLGrad {
  constructor(kind, a) { this.kind = kind; this.a = a; this.stops = []; }
  addColorStop(o, c) { this.stops.push([o, c]); this.sorted = false; }
};
