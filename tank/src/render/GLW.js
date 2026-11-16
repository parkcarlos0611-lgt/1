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
    this.post = post; this.gl = post.gl; this.ok = false; this.enabled = true;
    try { this.init(); this.ok = true; } catch (e) { console.warn('WebGL world renderer off:', e.message); }
  }
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
    const MASK = `uniform sampler2D u_mask; uniform float u_useMask; float M() { return u_useMask > 0.5 ? texelFetch(u_mask, ivec2(gl_FragCoord.xy), 0).r : 1.0; }`;
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
    this.MAXQ = 4096; this.vb = new Float32Array(this.MAXQ * 6 * 8); this.nv = 0;
    this.buf = gl.createBuffer(); this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, this.vb.byteLength, gl.DYNAMIC_DRAW); this.bufLen = this.vb.length;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.bindVertexArray(null);
    this.white = this.mkTex(); gl.bindTexture(gl.TEXTURE_2D, this.white); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    this.texs = new WeakMap(); this.texsR = new WeakMap(); this.cols = new Map();
    // atlas pages for small images (particle puffs, debris shards, small props…): many images on one texture, so
    // the quad batch is not broken by texture changes. 2048² pages, slots 8 px aligned with 8 px of empty border
    // and mip levels 0–3 only, so no slot ever bleeds into its neighbour; a white block at (0, 0) for solids.
    // When the last page is full the oldest one is wiped and its images are uploaded again as they are drawn.
    this.ATL = 2048; this.atl = []; this.atlI = 0; this.atlDirty = new Set(); this.atlT = new Map();
    this.main = { masks: [], clipD: 0 }; this.T = null; this.W = 1; this.H = 1;
    this.layers = {}; this.fx = { bias: -0.6, gray: 0 };
    this.ctx = new DS.GLCtx(this, 'main');
    DS.GLW.trackCanvases();
  }
  // ---- render targets ----
  // a target draws into multisampled buffers (4× MSAA: path and stroke edges smoothed as the 2D canvas
  // smooths them; cheap on tiled GPUs) and is resolved into its texture when the texture is read
  mkTarget(t, W, H) {
    const gl = this.gl;
    if (!t.fbo) {
      t.fbo = gl.createFramebuffer(); t.rfbo = gl.createFramebuffer(); t.color = this.mkTex();
      t.crb = gl.createRenderbuffer(); t.rb = gl.createRenderbuffer(); t.mrb = gl.createRenderbuffer();
      t.masks = t.masks || []; t.clipD = 0;
    }
    if (t.W !== W || t.H !== H) {
      this.flush();
      const S = this.samples || (this.samples = Math.max(1, Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 1)));
      gl.bindTexture(gl.TEXTURE_2D, t.color); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, t.crb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, S, gl.RGBA8, W, H);
      gl.bindRenderbuffer(gl.RENDERBUFFER, t.rb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, S, gl.DEPTH24_STENCIL8, W, H);
      gl.bindRenderbuffer(gl.RENDERBUFFER, t.mrb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, W, H);     // (clip masks: single-sample)
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, t.crb);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, t.rb);
      gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.rfbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.color, 0);
      for (const m of t.masks) if (m) m.w = -1;                  // masks are rebuilt at the new size
      t.W = W; t.H = H; t.dirty = true;
      if (this.T === t) this.T = null;                           // rebind on next use
      else if (this.T) gl.bindFramebuffer(gl.FRAMEBUFFER, this.T.fbo);
    }
    return t;
  }
  // multisampled buffer → texture
  resolve(t) {
    if (!t.dirty) return;
    if (this.T === t) this.flush();
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, t.rfbo);
    gl.blitFramebuffer(0, 0, t.W, t.H, 0, 0, t.W, t.H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.T ? this.T.fbo : null);
    t.dirty = false;
  }
  bind(t) {
    t.dirty = true;
    if (this.T === t) return;
    this.flush();
    const gl = this.gl; this.T = t; this.W = t.W; this.H = t.H;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.viewport(0, 0, t.W, t.H);
  }
  // an off-screen layer of its own (kept between frames; cleared with clearRect as a 2D canvas is)
  layer(key, W, H) {
    W = Math.max(1, W | 0); H = Math.max(1, H | 0);
    let L = this.layers[key];
    if (!L) { L = this.layers[key] = { t: { masks: [], clipD: 0 } }; L.ctx = new DS.GLCtx(this, L.t); L.ctx.canvas._glTarget = L.t; }
    this.mkTarget(L.t, W, H); L.ctx.canvas.width = W; L.ctx.canvas.height = H;
    return L.ctx;
  }
  // ---- clip masks (texture unit 3) ----
  maskU(u) {
    const gl = this.gl, T = this.T, m = T && T.clipD > 0 ? T.masks[T.clipD - 1] : null;
    gl.uniform1f(u.u_useMask, m ? 1 : 0);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, m ? m.t : this.white); gl.uniform1i(u.u_mask, 3); gl.activeTexture(gl.TEXTURE0);
  }
  // clip: the path's fan triangles (device px) into the stencil of a mask target, covered with the enclosing
  // mask's value; the new mask becomes current until the matching restore()
  pushClip(ctx, v, n, x0, y0, x1, y1) {
    this.flush();
    const gl = this.gl, T = this.T, d = T.clipD, W = this.W, H = this.H;
    let m = T.masks[d];
    if (!m || m.w !== W || m.h !== H) {
      if (!m) m = T.masks[d] = { t: this.mkTex(), f: gl.createFramebuffer() };
      gl.bindTexture(gl.TEXTURE_2D, m.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, W, H, 0, gl.RED, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, m.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, m.t, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, T.mrb);
      m.w = W; m.h = H;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, m.f); gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    ctx.stencilFill(v, n, true);
    gl.stencilFunc(gl.NOTEQUAL, 0, 0xff); gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);
    const q = ctx.tmp; let o = 0;
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]]) { q[o] = x; q[o + 1] = y; o += 8; }
    this.tris(this.pMask, q, 6);
    gl.disable(gl.STENCIL_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo); gl.enable(gl.BLEND); const b = this.blend; this.blend = null; this.setBlend(b || 'source-over');
    T.clipD = d + 1;
  }
  popClip(d) { const T = this.T; if (T && T.clipD !== d) { this.flush(); T.clipD = d; } }
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
    if (!r.rep) { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, r.t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); r.rep = true; }
    return r;
  }
  atlasPage(i) {
    const gl = this.gl, A = this.ATL; let pg = this.atl[i];
    if (pg) { this.flush(); this.atlT.delete(pg.t); gl.deleteTexture(pg.t); pg.gen++; } else pg = this.atl[i] = { gen: 0 };
    const t = pg.t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
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
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
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
    const gl = this.gl;
    if (!rep && w <= 128 && h <= 128) {
      // small: a slot on an atlas page (a new one when the size changed or the page was wiped)
      if (!r || !r.pg || r.w !== w || r.h !== h || r.pg.gen !== r.gen) {
        const a = this.atlasAlloc(w, h), A = this.ATL;
        r = { pg: a.pg, gen: a.pg.gen, t: a.pg.t, x: a.x, y: a.y, ou: a.x / A, ov: a.y / A, su: 1 / A, sv: 1 / A }; M.set(img, r);
      }
      gl.bindTexture(gl.TEXTURE_2D, r.t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      try { gl.texSubImage2D(gl.TEXTURE_2D, 0, r.x, r.y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (e) { /* unreadable image: stays blank */ }
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      this.atlDirty.add(r.pg);
      r.v = v; r.w = w; r.h = h;
      return r;
    }
    if (!r || r.pg) { r = { t: this.mkTex() }; M.set(img, r); }
    this.flush();
    gl.bindTexture(gl.TEXTURE_2D, r.t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
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
    this.mkTarget(this.main, W, H); this.T = null; this.bind(this.main);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 1); gl.clearStencil(0); gl.stencilMask(0xff); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.BLEND); this.blend = null; this.setBlend('source-over');
    gl.disable(gl.STENCIL_TEST);
    this.curTex = null; this.nv = 0; this.draws = 0; this.main.clipD = 0;
    this.ctx.reset(W, H);
    this.color = this.main.color;
    return this.ctx;
  }
  end() { this.flush(); this.resolve(this.main); this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); this.T = null; }
  setBlend(op) {
    if (op === this.blend) return;
    this.flush(); const gl = this.gl; this.blend = op;
    switch (op) {
      case 'lighter': gl.blendFunc(gl.ONE, gl.ONE); break;
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
  texU(u) { const gl = this.gl; gl.uniform1f(u.u_bias, this.fx.bias); gl.uniform1f(u.u_gray, this.fx.gray); }
  flush() {
    if (!this.nv) return;
    const gl = this.gl, P = this.pTex;
    if (this.atlDirty.size) this.atlMips();
    gl.useProgram(P.p); gl.uniform2f(P.u.u_res, this.W, this.H); this.maskU(P.u); this.texU(P.u);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.curTex); gl.uniform1i(P.u.u_tex, 0);
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vb, 0, this.nv * 8);
    gl.drawArrays(gl.TRIANGLES, 0, this.nv); this.draws++;
    gl.bindVertexArray(null);
    this.nv = 0;
  }
  atlMips() { const gl = this.gl; gl.activeTexture(gl.TEXTURE0); for (const pg of this.atlDirty) { gl.bindTexture(gl.TEXTURE_2D, pg.t); gl.generateMipmap(gl.TEXTURE_2D); } this.atlDirty.clear(); }
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
    gl.useProgram(prog.p); gl.uniform2f(prog.u.u_res, this.W, this.H); this.maskU(prog.u); if (prog === this.pTex) this.texU(prog.u); if (setU) setU(prog.u);
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    if (n * 8 > this.bufLen) { this.bufLen = Math.max(n * 8, this.bufLen * 2); gl.bufferData(gl.ARRAY_BUFFER, this.bufLen * 4, gl.DYNAMIC_DRAW); }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts, 0, n * 8);
    gl.drawArrays(gl.TRIANGLES, 0, n); this.draws++;
    gl.bindVertexArray(null);
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
    R.quad(t.t, this.X(dx, dy), this.Y(dx, dy), this.X(dx + dw, dy), this.Y(dx + dw, dy), this.X(dx + dw, dy + dh), this.Y(dx + dw, dy + dh), this.X(dx, dy + dh), this.Y(dx, dy + dh), u0, v0, u1, v1, [ga, ga, ga, ga]);
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
    const a = G.a; gl.uniform1i(u.u_kind, G.kind);
    if (G.kind === 0) { gl.uniform2f(u.u_p0, a[0], a[1]); gl.uniform2f(u.u_p1, a[2], a[3]); }
    else { gl.uniform3f(u.u_c0, a[0], a[1], a[2]); gl.uniform3f(u.u_c1, a[3], a[4], a[5]); }
    gl.uniform1i(u.u_n, Math.max(1, n)); gl.uniform1fv(u.u_off, off); gl.uniform4fv(u.u_c, cs); gl.uniform1f(u.u_a, this.globalAlpha);
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
    const disc = (cx, cy) => { const k = Math.max(6, Math.min(20, Math.ceil(hw * 1.5))); for (let i = 0; i < k; i++) { const a = i / k * 6.2832, b = (i + 1) / k * 6.2832; tri(cx, cy, cx + Math.cos(a) * hw, cy + Math.sin(a) * hw, cx + Math.cos(b) * hw, cy + Math.sin(b) * hw); } };
    const dash = this.dash ? this.dash.map(d => d * sc) : null, dl = dash ? dash.reduce((p, q) => p + q, 0) : 0;
    for (const s of this.path) {
      const pts = s.closed ? s.concat([s[0], s[1]]) : s;
      if (pts.length < 4) continue;
      if (dash && dl > 0) {                                // split into the dashes (device px along the line)
        let pos = 0;
        for (let i = 0; i + 3 < pts.length; i += 2) {
          const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3], L = Math.hypot(bx - ax, by - ay); let u = 0;
          while (u < L) {
            let ph = pos % dl, k = 0; while (ph >= dash[k]) { ph -= dash[k]; k = (k + 1) % dash.length; }
            const step = Math.min(L - u, dash[k] - ph);
            if (k % 2 === 0) seg(ax + (bx - ax) * u / L, ay + (by - ay) * u / L, ax + (bx - ax) * (u + step) / L, ay + (by - ay) * (u + step) / L);
            u += step; pos += step;
          }
        }
        continue;
      }
      for (let i = 0; i + 3 < pts.length; i += 2) seg(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
      if (round) for (let i = 0; i < pts.length; i += 2) disc(pts[i], pts[i + 1]);
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
  stencilFill(v, n, nonzero) {
    const R = this.r, gl = R.gl;
    gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false); gl.stencilMask(0xff);
    if (nonzero) { gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP); }
    else { gl.stencilFunc(gl.ALWAYS, 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); }
    R.tris(R.pTex, v, n, u => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.white); gl.uniform1i(u.u_tex, 0); });
    gl.colorMask(true, true, true, true);
  }
  cover(x0, y0, x1, y1, style) {
    const R = this.r, gl = R.gl;
    gl.stencilFunc(gl.NOTEQUAL, 0, 0xff); gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);
    x0 = Math.floor(x0) - 1; y0 = Math.floor(y0) - 1; x1 = Math.ceil(x1) + 1; y1 = Math.ceil(y1) + 1;
    if (typeof style === 'string') {
      const c = this.solid(style), v = this.tmp; let o = 0;
      for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]]) { v[o] = x; v[o + 1] = y; v[o + 2] = 0; v[o + 3] = 0; v[o + 4] = c[0]; v[o + 5] = c[1]; v[o + 6] = c[2]; v[o + 7] = c[3]; o += 8; }
      R.tris(R.pTex, v, 6, u => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.white); gl.uniform1i(u.u_tex, 0); });
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
    gl.disable(gl.STENCIL_TEST);
  }
};
DS.GLPat = class GLPat {
  constructor(img) { this.img = img; this.m = [1, 0, 0, 1, 0, 0]; }
  setTransform(M) { this.m = M ? [M.a, M.b, M.c, M.d, M.e, M.f] : [1, 0, 0, 1, 0, 0]; }
};
DS.GLGrad = class GLGrad {
  constructor(kind, a) { this.kind = kind; this.a = a; this.stops = []; }
  addColorStop(o, c) { this.stops.push([o, c]); this.sorted = false; }
};
