const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(''+(process.argv[2]||'http://localhost:8765/index.html')+'');await p.waitForTimeout(1500);
const url=await p.evaluate(()=>{const names=['Jon Jones','Anderson Silva','Alex Pereira','Israel Adesanya','Fedor Emelianenko','Mirko Cro Cop'];const cases=[{hp:100,blink:0},{hp:100,blink:1},{hp:35,blink:0,cuts:[{at:'brow',sev:1.2},{at:'cheek',sev:.8}],swell:1},{hp:100,blink:0,hurt:1}];
 const cw=300,ch=300;const sh=document.createElement('canvas');sh.width=cw*cases.length;sh.height=ch*names.length;const g=sh.getContext('2d');g.fillStyle='#626266';g.fillRect(0,0,sh.width,sh.height);const ob=FACEFX.blink;
 names.forEach((n,r)=>{const f=FDB.find(x=>x.n===n);const look=lookFor(f);look.name=n;const bd=new Body(look,1);
  cases.forEach((cs,i)=>{bd.solve({lean:0,chest:0,head:0,la_s:.1,la_e:.1,ra_s:.1,ra_e:.1,x:0,y:0,free:0,lo:0,ro:0},0,1);bd._owner={hp:{head:cs.hp,body:100,legs:100},hitF:cs.hurt?.14:0};bd._hurt=cs.hurt?1:0;bd.swell=cs.swell||0;bd.redness=1-cs.hp/100;bd.cuts=(cs.cuts||[]).map(c=>Object.assign({},c));FACEFX.blink=cs.blink?()=>1:ob;
   const c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d');x.fillStyle='#626266';x.fillRect(0,0,cw,ch);const s=ch*.62/(bd.H*.1);const J=bd.J;x.setTransform(s,0,0,-s,cw/2-J.hd.x*s,ch*.5+J.hd.y*s);bd.draw(x,{noShadow:true});g.drawImage(c,i*cw,r*ch)})});FACEFX.blink=ob;return sh.toDataURL('image/png')});
fs.writeFileSync(process.argv[3]||'face_check.png',Buffer.from(url.split(',')[1],'base64'));console.log(errs.join('\n')||'no errors');await b.close()})();
