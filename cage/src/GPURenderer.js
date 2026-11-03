/* ===== GPURenderer.js : WebGL compositor + dynamic resolution =====
   The scene is drawn by the Canvas 2D code into three layers, then composited on the GPU:
     far  — arena backdrop + crowd (half resolution; blurred in the shader = depth of field)
     near — cage fence, mat, referee
     fig  — fighters, particles, labels, overlays
   Fragment shader (one full-screen pass, ~8 texture reads per pixel): low-res far layer (bilinear upscale +
   4 taps = depth of field), bloom from a 1/16-size copy of the far layer (lights, LED screens), near over far, fighters over that with a rim light computed from the
   fighter layer's alpha edges (overhead back-light on top edges, softer side rim), colour grade
   (contrast, saturation, warm highlights / cool shadows), vignette and impact flash.
   Canvas 2D work that used to run per pixel on the CPU (rim passes, ctx.filter brightness) is gone.
   Dynamic resolution keeps 60 fps on weak devices instead of turning effects off: render scale moves
   between 0.5 and 1 × devicePixelRatio (capped at 2) based on measured frame times.
   Falls back to the plain Canvas 2D path if WebGL is unavailable. */
const GPU=tuneSection('gpu',{on:true,farScale:.35,bloomScale:.0625,startPixels:2.2e6,dof:1.4,bloom:.4,rim:.6,rimPx:2,contrast:1.06,saturation:1.08,vignette:.42,
  dyn:{on:true,min:.5,max:1,targetMs:16.9,upMs:14.5,step:.1,holdS:1.2}});
const GL_VS=`attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
/* ~8 texture reads per pixel: far layer is low-res (bilinear upscale = depth of field) + 4 small taps;
   bloom comes from a 1/16-size copy of the far layer (1 tap); rim 3 taps on the fighter layer. */
const GL_FS=`precision mediump float;varying vec2 uv;uniform sampler2D tFar,tNear,tFig,tBloom;uniform vec2 px,pxFar;uniform float dof,bloom,rim,rimPx,contrast,sat,vig,flash,hurt;
vec3 bright(vec3 c){float l=dot(c,vec3(.299,.587,.114));return c*smoothstep(.5,.95,l);}
void main(){
 vec2 d=pxFar*dof*.5;vec3 col=(texture2D(tFar,uv+d).rgb+texture2D(tFar,uv-d).rgb+texture2D(tFar,uv+vec2(d.x,-d.y)).rgb+texture2D(tFar,uv+vec2(-d.x,d.y)).rgb)*.25;
 vec3 b=bright(texture2D(tBloom,uv).rgb);
 vec4 nr=texture2D(tNear,uv);col=mix(col,nr.rgb,nr.a);
 vec4 fg=texture2D(tFig,uv);
 float up=texture2D(tFig,uv+vec2(0.,px.y*rimPx)).a;float sl=texture2D(tFig,uv+vec2(px.x*rimPx,0.)).a;float sr=texture2D(tFig,uv-vec2(px.x*rimPx,0.)).a;
 float r=clamp(fg.a-up,0.,1.)+clamp(fg.a-min(sl,sr),0.,1.)*.25;vec3 fc=fg.rgb+vec3(1.,.88,.72)*r*rim*fg.a;
 col=mix(col,fc,fg.a);
 col+=b*bloom*(1.-fg.a*.85);
 col=(col-.5)*contrast+.5;float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,sat);
 col+=vec3(.03,.012,-.01)*smoothstep(.5,1.,l)-vec3(.0,.004,-.018)*(1.-smoothstep(0.,.35,l));
 vec2 q=uv-.5;float e=smoothstep(.25,.85,length(q*vec2(1.25,1.)));col*=1.-vig*e;col=mix(col,vec3(.45,0.,0.),hurt*e*.6);
 col+=vec3(flash);gl_FragColor=vec4(clamp(col,0.,1.),1.);}`;
const GPUR={
  init(S,root){if(!GPU.on||S.gpu!==undefined)return;S.gpu=null;try{
      const gc=document.createElement('canvas');gc.className='stg glstg';const gl=gc.getContext('webgl',{alpha:false,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance',desynchronized:true});if(!gl)return;
      const sh=(t,src)=>{const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
      const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,GL_VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,GL_FS));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);
      const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
      const tex=i=>{const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);for(const[k,v]of[[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);return t};
      const T=[tex(0),tex(1),tex(2),tex(3)];const U={};for(const n of['tFar','tNear','tFig','tBloom','px','pxFar','dof','bloom','rim','rimPx','contrast','sat','vig','flash','hurt'])U[n]=gl.getUniformLocation(pr,n);gl.uniform1i(U.tFar,0);gl.uniform1i(U.tNear,1);gl.uniform1i(U.tFig,2);gl.uniform1i(U.tBloom,3);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      const far=document.createElement('canvas'),fig=document.createElement('canvas'),blm=document.createElement('canvas');
      S.cv.after(gc);S.cv.style.visibility='hidden';
      S.gpu={gl,gc,T,U,far,farX:far.getContext('2d'),blm,blmX:blm.getContext('2d'),fig,figX:fig.getContext('2d'),nearCv:S.cv,nearX:S.cv.getContext('2d'),lost:false};
      gc.addEventListener('webglcontextlost',e=>{e.preventDefault();S.gpu.lost=true});
      /* start large high-DPR screens at a sane pixel count; dynamic resolution raises it if there is headroom */
      {const d=Math.min(2,window.devicePixelRatio||1),px=(S.W||innerWidth)*(S.Hh||innerHeight)*d*d;if(px>GPU.startPixels)S.rscale=Math.max(GPU.dyn.min,+Math.sqrt(GPU.startPixels/px).toFixed(2))}
      this.size(S);S.ctx=S.gpu.figX}catch(e){console.warn('GPU compositor unavailable, using Canvas 2D',e);S.gpu=null}},
  size(S){const G=S.gpu;if(!G)return;const w=S.cv.width,h=S.cv.height;for(const c of[G.gc,G.fig]){if(c.width!==w||c.height!==h){c.width=w;c.height=h}}const fw=Math.max(2,Math.round(w*GPU.farScale)),fh=Math.max(2,Math.round(h*GPU.farScale));if(G.far.width!==fw||G.far.height!==fh){G.far.width=fw;G.far.height=fh}const bw=Math.max(2,Math.round(w*GPU.bloomScale)),bh=Math.max(2,Math.round(h*GPU.bloomScale));if(G.blm.width!==bw||G.blm.height!==bh){G.blm.width=bw;G.blm.height=bh}},
  composite(S){const G=S.gpu;if(!G||G.lost)return;const gl=G.gl;this.size(S);gl.viewport(0,0,G.gc.width,G.gc.height);
    G.blmX.imageSmoothingQuality='low';G.blmX.drawImage(G.far,0,0,G.blm.width,G.blm.height);
    const up=(i,c)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,G.T[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c)};up(0,G.far);up(1,G.nearCv);up(2,G.fig);up(3,G.blm);
    const U=G.U;gl.uniform2f(U.px,1/G.gc.width,1/G.gc.height);gl.uniform2f(U.pxFar,1/G.far.width,1/G.far.height);gl.uniform1f(U.dof,GPU.dof);gl.uniform1f(U.bloom,GPU.bloom);gl.uniform1f(U.rim,GPU.rim);gl.uniform1f(U.rimPx,GPU.rimPx*(S.dpr||1));
    gl.uniform1f(U.contrast,GPU.contrast);gl.uniform1f(U.sat,GPU.saturation);gl.uniform1f(U.vig,GPU.vignette);gl.uniform1f(U.flash,Math.min(.6,S.gpuFlash||0));gl.uniform1f(U.hurt,clamp(S.vig||0,0,1));gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
};
/* Stage: create the GPU path on construction; dynamic-resolution resize */
{const _S=Stage;Stage=class extends _S{constructor(root,o){super(root,o);GPUR.init(this,root);this.resize()}}}
Stage.prototype.resize=function(){const sc=this.rscale||1;const dpr=Math.min(2,window.devicePixelRatio||1)*sc;const w=this.cv.clientWidth||window.innerWidth,h=this.cv.clientHeight||window.innerHeight;this.W=w;this.Hh=h;
  this.cv.width=Math.round(w*dpr);this.cv.height=Math.round(h*dpr);this.dpr=dpr;if(this.gpu)GPUR.size(this)};
{const de=Stage.prototype.destroy;Stage.prototype.destroy=function(){const r=de.call(this);const G=this.gpu;if(G){try{G.gl.getExtension('WEBGL_lose_context')&&G.gl.getExtension('WEBGL_lose_context').loseContext()}catch(e){}G.gc.remove()}return r}}
/* draw the backdrop into far/near layers, everything else into the fighter layer */
{const db=Stage.prototype.drawBack;Stage.prototype.drawBack=function(){const G=this.gpu;if(!G)return db.apply(this,arguments);
    const fs=GPU.farScale;G.farX.setTransform(1,0,0,1,0,0);G.farX.clearRect(0,0,G.far.width,G.far.height);G.nearX.setTransform(1,0,0,1,0,0);G.nearX.clearRect(0,0,this.cv.width,this.cv.height);
    this.ctx=G.nearX;try{return db.apply(this,arguments)}finally{this.ctx=G.figX}}}
/* fighters on the GPU path: drawn straight into the fighter layer; lighting/damage FX painted with source-atop;
   the hit flash is a white source-atop wash instead of ctx.filter (which runs on the CPU) */
{const fd=F2.prototype.draw;F2.prototype.draw=function(ctx,o){if(!(ctx.canvas&&ctx.canvas===window.__gpuFig))return fd.call(this,ctx,o);
    const flt=ctx.filter;const m=/brightness\(([\d.]+)\)/.exec(flt||'');ctx.filter='none';const r=fd.call(this,ctx,o);
    if(this.name!=='ref'&&typeof paintFighterFX==='function'&&GFX.on)paintFighterFX(ctx,this);
    if(m&&this.name!=='ref'){const k=Math.min(.7,(parseFloat(m[1])-1)/4),J=this.body.J,H=this.H;ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle=`rgba(255,255,255,${k.toFixed(3)})`;ctx.fillRect(J.hip.x-H*.75,-.05,H*1.5,H*1.35);ctx.restore()}
    ctx.filter=flt;return r}}
/* per-frame: route the 2D layers, composite on the GPU, adapt resolution */
{const rd=Match.prototype.render;Match.prototype.render=function(dt){const S=this.stage,G=S.gpu;if(G&&!G.lost){S.ctx=G.figX;window.__gpuFig=G.fig;window.__gpuNearX=G.nearX}else{window.__gpuFig=null;window.__gpuNearX=null}const r=rd.call(this,dt);if(G&&!G.lost)GPUR.composite(S);return r}}
{const lp=Match.prototype.loop;Match.prototype.loop=function(now){const S=this.stage;const D=GPU.dyn;
    if(D.on&&S&&this.running&&this._lt!=null){const ms=now-this._lt;S._fms=S._fms==null?ms:S._fms*.92+ms*.08;S._hold=(S._hold||0)+ms/1000;
      if(S._hold>D.holdS){let sc=S.rscale||1;if(S._fms>D.targetMs&&sc>D.min){sc=Math.max(D.min,+(sc-D.step).toFixed(2))}else if(S._fms<D.upMs&&sc<D.max){sc=Math.min(D.max,+(sc+D.step/2).toFixed(2))}if(sc!==(S.rscale||1)){S.rscale=sc;S.resize();S._hold=0}}}
    this._lt=now;return lp.call(this,now)}}
