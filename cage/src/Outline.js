/* ===== Outline.js : a very thin dark line around the whole body (silhouette only, nothing inside) =====
   Every whole-body draw goes to a scratch canvas first; the silhouette of that picture, grown by about one pixel in a dark colour,
   is drawn on the real canvas and the body on top of it. Parts, layers and partial draws (ground, clinch) are left alone. */
(function(){
if(typeof Body==='undefined'||!window.FLAT_STYLE)return;
const OL=window.BODY_OUTLINE={on:true,w:1.5,col:'rgba(18,10,6,.92)'};
let off=null,sil=null;
const d0=Body.prototype.draw;
Body.prototype.draw=function(ctx,o){o=o||{};
  if(!OL.on||o.only||o.part||o.onlyArm||o.noOutline||!this.J||!this.J.hip||!ctx.getTransform||!window.FLAT_STYLE.floorShadow)return d0.call(this,ctx,o);
  const cv=ctx.canvas;if(!cv)return d0.call(this,ctx,o);
  const T=ctx.getTransform(),J=this.J,H=this.H;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const k in J){const p=J[k];if(!p)continue;for(const[dx,dy]of[[-.3,-.3],[.3,.3]]){const X=T.a*(p.x+dx*H)+T.c*(p.y+dy*H)+T.e,Y=T.b*(p.x+dx*H)+T.d*(p.y+dy*H)+T.f;x0=Math.min(x0,X);x1=Math.max(x1,X);y0=Math.min(y0,Y);y1=Math.max(y1,Y)}}
  x0=Math.max(0,Math.floor(x0));y0=Math.max(0,Math.floor(y0));x1=Math.min(cv.width,Math.ceil(x1));y1=Math.min(cv.height,Math.ceil(y1));const w=x1-x0,h=y1-y0;if(w<8||h<8)return d0.call(this,ctx,o);
  if(!off||off.width!==cv.width||off.height!==cv.height){off=document.createElement('canvas');off.width=cv.width;off.height=cv.height}
  const g=off.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(x0,y0,w,h);g.save();g.beginPath();g.rect(x0,y0,w,h);g.clip();g.setTransform(T);
  try{window.FLAT_STYLE.floorShadow(ctx,this)}catch(e){}/* the floor shadow stays outside the outline */
  g.imageSmoothingEnabled=true;
  d0.call(this,g,Object.assign({},o,{noFloorShadow:true}));g.restore();
  /* the silhouette in the outline colour (inside the box only), stamped around the body at +-1 px */
  if(!sil||sil.width!==cv.width||sil.height!==cv.height){sil=document.createElement('canvas');sil.width=cv.width;sil.height=cv.height}
  const q=sil.getContext('2d');q.setTransform(1,0,0,1,0,0);q.globalCompositeOperation='source-over';q.clearRect(x0,y0,w,h);q.drawImage(off,x0,y0,w,h,x0,y0,w,h);q.globalCompositeOperation='source-in';q.fillStyle=OL.col;q.fillRect(x0,y0,w,h);q.globalCompositeOperation='source-over';
  ctx.save();ctx.setTransform(1,0,0,1,0,0);const s=OL.w;
  for(const[dx,dy]of[[s,0],[-s,0],[0,s],[0,-s]])ctx.drawImage(sil,x0,y0,w,h,x0+dx,y0+dy,w,h);
  ctx.drawImage(off,x0,y0,w,h,x0,y0,w,h);ctx.restore()};
})();
