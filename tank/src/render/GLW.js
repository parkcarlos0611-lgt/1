// WebGL2 world renderer, step one of moving the picture off the 2D canvas (O1). It offers the drawing calls the
// renderer already uses — setTransform / save / restore, globalAlpha, globalCompositeOperation ('source-over',
// 'lighter'), drawImage (5 and 9 arguments), fillRect, paths (moveTo / lineTo / rect / arc / closePath) filled
// and stroked, linear gradients — so a pass moves over by handing it this context instead of the 2D one, and
// draws the same picture:
//   - images and solid fills are batched: consecutive quads with the same texture and blend are one draw call
//   - paths are filled with the stencil buffer (nonzero rule, as the 2D canvas), strokes the same way (no
//     double blending where segments overlap)
//   - gradients are evaluated per pixel in the user space at the time of the fill (as the 2D canvas)
// Textures: images are uploaded once; a canvas is uploaded again when its _v (version) changes — code that
// repaints a cached canvas bumps it. Everything is premultiplied alpha.
// The frame goes into an off-screen target (with stencil) that DS.Post composites under the 2D canvas, which
// keeps drawing what has not moved yet, on a transparent background.
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
    // textured / solid quads (a 1×1 white texture for solids); colour is a premultiplied multiplier
    this.pTex = mk(VS, `in vec2 v_uv; in vec4 v_col; uniform sampler2D u_tex; out vec4 o; void main() { o = texture(u_tex, v_uv) * v_col; }`);
    // linear gradient: v_uv carries the user-space position; stops premultiplied
    this.pGrad = mk(VS, `in vec2 v_uv; in vec4 v_col; uniform vec2 u_p0, u_p1; uniform int u_n; uniform float u_off[8]; uniform vec4 u_c[8]; uniform float u_a; out vec4 o;
      void main() { vec2 d = u_p1 - u_p0; float t = clamp(dot(v_uv - u_p0, d) / max(dot(d, d), 1e-12), 0.0, 1.0);
        vec4 c = u_c[0];
        for (int i = 1; i < 8; i++) { if (i >= u_n) break; if (t >= u_off[i - 1]) c = mix(u_c[i - 1], u_c[i], clamp((t - u_off[i - 1]) / max(u_off[i] - u_off[i - 1], 1e-6), 0.0, 1.0)); }
        if (t <= u_off[0]) c = u_c[0];
        o = c * u_a; }`);
    this.MAXQ = 4096; this.vb = new Float32Array(this.MAXQ * 6 * 8); this.nv = 0;
    this.buf = gl.createBuffer(); this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, this.vb.byteLength, gl.DYNAMIC_DRAW); this.bufLen = this.vb.length;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
    gl.bindVertexArray(null);
    this.white = this.mkTex(); gl.bindTexture(gl.TEXTURE_2D, this.white); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    this.texs = new WeakMap(); this.cols = new Map();
    this.fbo = null; this.W = 0; this.H = 0;
    this.ctx = new DS.GLCtx(this);
  }
  mkTex() {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // GL texture for an image or canvas (uploaded on first use; a canvas again whenever its _v changes)
  tex(img) {
    let r = this.texs.get(img);
    const v = img._v || 0, w = img.width, h = img.height;
    if (r && r.v === v && r.w === w && r.h === h) return r;
    const gl = this.gl;
    if (!r) { r = { t: this.mkTex() }; this.texs.set(img, r); }
    this.flush();
    gl.bindTexture(gl.TEXTURE_2D, r.t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (e) { /* unreadable image: stays blank */ }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    r.v = v; r.w = w; r.h = h;
    return r;
  }
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
    else { r = g = b = 0; }
    c = [r / 255 * a, g / 255 * a, b / 255 * a, a];
    if (this.cols.size > 4000) this.cols.clear();
    this.cols.set(s, c); return c;
  }
  // ---- frame ----
  begin(W, H) {
    const gl = this.gl;
    W = Math.max(1, W | 0); H = Math.max(1, H | 0);
    if (!this.fbo || this.W !== W || this.H !== H) {
      if (!this.fbo) { this.fbo = gl.createFramebuffer(); this.color = this.mkTex(); this.rb = gl.createRenderbuffer(); }
      gl.bindTexture(gl.TEXTURE_2D, this.color); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, W, H);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.color, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.rb);
      this.W = W; this.H = H;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 1); gl.clearStencil(0); gl.stencilMask(0xff); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); this.blend = 'source-over';
    gl.disable(gl.STENCIL_TEST);
    this.curTex = null; this.nv = 0; this.draws = 0;
    this.ctx.reset(W, H);
    return this.ctx;
  }
  end() { this.flush(); this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); }
  setBlend(op) {
    if (op === this.blend) return;
    this.flush(); const gl = this.gl; this.blend = op;
    if (op === 'lighter') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  // ---- batched quads ----
  quad(t, x0, y0, x1, y1, x2, y2, x3, y3, u0, v0, u1, v1, c) {
    if (t !== this.curTex || this.nv + 6 > this.MAXQ * 6) { this.flush(); this.curTex = t; }
    const b = this.vb; let o = this.nv * 8;
    const P = (x, y, u, v) => { b[o] = x; b[o + 1] = y; b[o + 2] = u; b[o + 3] = v; b[o + 4] = c[0]; b[o + 5] = c[1]; b[o + 6] = c[2]; b[o + 7] = c[3]; o += 8; };
    P(x0, y0, u0, v0); P(x1, y1, u1, v0); P(x2, y2, u1, v1); P(x0, y0, u0, v0); P(x2, y2, u1, v1); P(x3, y3, u0, v1);
    this.nv += 6;
  }
  flush() {
    if (!this.nv) return;
    const gl = this.gl, P = this.pTex;
    gl.useProgram(P.p); gl.uniform2f(P.u.u_res, this.W, this.H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.curTex); gl.uniform1i(P.u.u_tex, 0);
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vb, 0, this.nv * 8);
    gl.drawArrays(gl.TRIANGLES, 0, this.nv); this.draws++;
    gl.bindVertexArray(null);
    this.nv = 0;
  }
  // raw triangles (device px) through a program, outside the quad batch: used for stencil fans and covers
  tris(prog, verts, n, setU) {
    this.flush();
    const gl = this.gl;
    gl.useProgram(prog.p); gl.uniform2f(prog.u.u_res, this.W, this.H); if (setU) setU(prog.u);
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    if (n * 8 > this.bufLen) { this.bufLen = Math.max(n * 8, this.bufLen * 2); gl.bufferData(gl.ARRAY_BUFFER, this.bufLen * 4, gl.DYNAMIC_DRAW); }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts, 0, n * 8);
    gl.drawArrays(gl.TRIANGLES, 0, n); this.draws++;
    gl.bindVertexArray(null);
  }
};

// The drawing context (the subset of CanvasRenderingContext2D the renderer uses).
DS.GLCtx = class GLCtx {
  constructor(r) { this.r = r; this.canvas = { width: 1, height: 1, _gl: true }; this.reset(1, 1); this.tmp = new Float32Array(4096 * 8); }
  reset(W, H) {
    this.canvas.width = W; this.canvas.height = H;
    this.m = [1, 0, 0, 1, 0, 0]; this.stack = [];
    this.globalAlpha = 1; this.globalCompositeOperation = 'source-over';
    this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1; this.lineCap = 'butt'; this.lineJoin = 'miter';
    this.imageSmoothingEnabled = true; this.imageSmoothingQuality = 'low'; this.filter = 'none';
    this.path = []; this.sub = null;
  }
  // ---- state ----
  save() { this.stack.push([this.m.slice(), this.globalAlpha, this.globalCompositeOperation, this.fillStyle, this.strokeStyle, this.lineWidth, this.lineCap, this.lineJoin]); }
  restore() { const s = this.stack.pop(); if (!s) return; [this.m, this.globalAlpha, this.globalCompositeOperation, this.fillStyle, this.strokeStyle, this.lineWidth, this.lineCap, this.lineJoin] = s; }
  setTransform(a, b, c, d, e, f) { if (typeof a === 'object') { const M = a; this.m = [M.a, M.b, M.c, M.d, M.e, M.f]; } else this.m = [a, b, c, d, e, f]; }
  getTransform() { const m = this.m; return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }; }
  resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
  transform(a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.transform(c, s, -s, c, 0, 0); }
  X(x, y) { const m = this.m; return m[0] * x + m[2] * y + m[4]; }
  Y(x, y) { const m = this.m; return m[1] * x + m[3] * y + m[5]; }
  inv() { const m = this.m, det = m[0] * m[3] - m[1] * m[2] || 1e-12; return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det]; }
  // premultiplied colour of a solid style times the global alpha
  solid(style) { const c = this.r.col(style), a = this.globalAlpha; return a === 1 ? c : [c[0] * a, c[1] * a, c[2] * a, c[3] * a]; }
  // ---- images ----
  drawImage(img, a, b, c, d, e, f, g, h) {
    if (!img || !img.width || !img.height) return;
    let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
    if (e === undefined) { dx = a; dy = b; dw = c === undefined ? img.width : c; dh = d === undefined ? img.height : d; }
    else { sx = a; sy = b; sw = c; sh = d; dx = e; dy = f; dw = g; dh = h; }
    const R = this.r; R.setBlend(this.globalCompositeOperation);
    const t = R.tex(img), u0 = sx / t.w, v0 = sy / t.h, u1 = (sx + sw) / t.w, v1 = (sy + sh) / t.h, ga = this.globalAlpha;
    R.quad(t.t, this.X(dx, dy), this.Y(dx, dy), this.X(dx + dw, dy), this.Y(dx + dw, dy), this.X(dx + dw, dy + dh), this.Y(dx + dw, dy + dh), this.X(dx, dy + dh), this.Y(dx, dy + dh), u0, v0, u1, v1, [ga, ga, ga, ga]);
  }
  // ---- rectangles ----
  fillRect(x, y, w, h) {
    const R = this.r; R.setBlend(this.globalCompositeOperation);
    if (typeof this.fillStyle === 'string') {
      R.quad(R.white, this.X(x, y), this.Y(x, y), this.X(x + w, y), this.Y(x + w, y), this.X(x + w, y + h), this.Y(x + w, y + h), this.X(x, y + h), this.Y(x, y + h), 0, 0, 1, 1, this.solid(this.fillStyle));
    } else this.gradQuad(this.fillStyle, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  }
  clearRect() { /* the world target is cleared once at the start of the frame */ }
  // ---- gradients ----
  createLinearGradient(x0, y0, x1, y1) { return new DS.GLGrad(x0, y0, x1, y1); }
  // a gradient over user-space corners (drawn now, outside the batch)
  gradQuad(G, U) {
    const R = this.r, v = this.tmp; let o = 0;
    const P = (q) => { v[o] = this.X(q[0], q[1]); v[o + 1] = this.Y(q[0], q[1]); v[o + 2] = q[0]; v[o + 3] = q[1]; v[o + 4] = v[o + 5] = v[o + 6] = v[o + 7] = 1; o += 8; };
    P(U[0]); P(U[1]); P(U[2]); P(U[0]); P(U[2]); P(U[3]);
    R.tris(R.pGrad, v, 6, u => this.gradUniforms(u, G));
  }
  gradUniforms(u, G) {
    const gl = this.r.gl, n = Math.min(8, G.stops.length), off = new Float32Array(8), cs = new Float32Array(32);
    G.stops.sort((p, q) => p[0] - q[0]);
    for (let i = 0; i < n; i++) { off[i] = G.stops[i][0]; cs.set(this.r.col(G.stops[i][1]), i * 4); }
    gl.uniform2f(u.u_p0, G.x0, G.y0); gl.uniform2f(u.u_p1, G.x1, G.y1); gl.uniform1i(u.u_n, Math.max(1, n));
    gl.uniform1fv(u.u_off, off); gl.uniform4fv(u.u_c, cs); gl.uniform1f(u.u_a, this.globalAlpha);
  }
  // ---- paths (points stored in device space, as the 2D canvas transforms them when they are added) ----
  beginPath() { this.path = []; this.sub = null; }
  moveTo(x, y) { this.sub = [this.X(x, y), this.Y(x, y)]; this.sub.closed = false; this.path.push(this.sub); }
  lineTo(x, y) { if (!this.sub) return this.moveTo(x, y); this.sub.push(this.X(x, y), this.Y(x, y)); }
  closePath() { if (this.sub) { this.sub.closed = true; const s = this.sub; this.sub = [s[0], s[1]]; this.sub.closed = false; this.path.push(this.sub); } }
  rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  arc(cx, cy, r, a0, a1, ccw) {
    let d = a1 - a0; if (ccw) { if (d > 0) d -= Math.PI * 2 * Math.ceil(d / (Math.PI * 2)); } else if (d < 0) d += Math.PI * 2 * Math.ceil(-d / (Math.PI * 2));
    if (Math.abs(d) > Math.PI * 2) d = Math.sign(d) * Math.PI * 2;
    const m = this.m, rs = r * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])), n = Math.max(6, Math.min(96, Math.ceil(Math.abs(d) * Math.sqrt(rs) * 1.2)));
    for (let i = 0; i <= n; i++) { const a = a0 + d * i / n, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (i === 0 && !this.sub) this.moveTo(x, y); else this.lineTo(x, y); }
  }
  // nonzero fill through the stencil: each subpath as a triangle fan from its first point (front faces add,
  // back faces subtract), then the bounding box drawn where the count is not zero (and the count cleared)
  fill() {
    const subs = this.path.filter(s => s.length >= 6); if (!subs.length) return;
    const R = this.r, gl = R.gl; R.setBlend(this.globalCompositeOperation); R.flush();
    let n = 0, v = this.tmp, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const push = (x, y) => { if (n * 8 + 8 > v.length) { const nv = new Float32Array(v.length * 2); nv.set(v); this.tmp = v = nv; } v[n * 8] = x; v[n * 8 + 1] = y; n++; };
    for (const s of subs) {
      for (let i = 2; i + 3 < s.length; i += 2) { push(s[0], s[1]); push(s[i], s[i + 1]); push(s[i + 2], s[i + 3]); }
      for (let i = 0; i < s.length; i += 2) { x0 = Math.min(x0, s[i]); x1 = Math.max(x1, s[i]); y0 = Math.min(y0, s[i + 1]); y1 = Math.max(y1, s[i + 1]); }
    }
    if (!n) return;
    this.stencilFill(v, n, true);
    this.cover(x0, y0, x1, y1, this.fillStyle);
  }
  // stroke: each segment a quad (butt ends) into the stencil, then the cover — overlaps are not blended twice
  stroke() {
    const R = this.r; R.setBlend(this.globalCompositeOperation); R.flush();
    const m = this.m, hw = Math.max(0.35, this.lineWidth * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) / 2);
    let n = 0, v = this.tmp, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const grow = () => { const nv = new Float32Array(v.length * 2); nv.set(v); this.tmp = v = nv; };
    const tri = (ax, ay, bx, by, cx, cy) => { if ((n + 3) * 8 > v.length) grow(); for (const [x, y] of [[ax, ay], [bx, by], [cx, cy]]) { v[n * 8] = x; v[n * 8 + 1] = y; n++; } };
    for (const s of this.path) {
      const pts = s.closed ? s.concat([s[0], s[1]]) : s;
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3], L = Math.hypot(bx - ax, by - ay); if (L < 1e-6) continue;
        const nx = -(by - ay) / L * hw, ny = (bx - ax) / L * hw;
        tri(ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny); tri(ax + nx, ay + ny, bx - nx, by - ny, ax - nx, ay - ny);
        x0 = Math.min(x0, ax - hw, bx - hw); x1 = Math.max(x1, ax + hw, bx + hw); y0 = Math.min(y0, ay - hw, by - hw); y1 = Math.max(y1, ay + hw, by + hw);
      }
    }
    if (!n) return;
    this.stencilFill(v, n, false);
    this.cover(x0, y0, x1, y1, this.strokeStyle);
  }
  stencilFill(v, n, nonzero) {
    const R = this.r, gl = R.gl;
    gl.enable(gl.STENCIL_TEST); gl.colorMask(false, false, false, false); gl.stencilMask(0xff);
    gl.stencilFunc(gl.ALWAYS, 0, 0xff);
    if (nonzero) { gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP); gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP); }
    else gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE), gl.stencilFunc(gl.ALWAYS, 1, 0xff);
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
    } else {
      // gradient: corners carried back into the user space of the fill
      const I = this.inv(), U = q => [I[0] * q[0] + I[2] * q[1] + I[4], I[1] * q[0] + I[3] * q[1] + I[5]];
      const save = this.m; this.m = [1, 0, 0, 1, 0, 0];
      const v = this.tmp; let o = 0;
      for (const q of [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]]) { const u = U(q); v[o] = q[0]; v[o + 1] = q[1]; v[o + 2] = u[0]; v[o + 3] = u[1]; v[o + 4] = v[o + 5] = v[o + 6] = v[o + 7] = 1; o += 8; }
      this.m = save;
      R.tris(R.pGrad, v, 6, u => this.gradUniforms(u, style));
    }
    gl.disable(gl.STENCIL_TEST);
  }
};
DS.GLGrad = class GLGrad {
  constructor(x0, y0, x1, y1) { this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1; this.stops = []; }
  addColorStop(o, c) { this.stops.push([o, c]); }
};
