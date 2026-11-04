/* ===== Fighters.js : real body measurements, stance label + stance switch, refined faces =====
   SIZE: height and reach (cm) from publicly listed fight records for the roster fighters known here; the
   others fall back to their weight-class average. Weight is the division limit. The model uses them as:
     height → look.h (whole figure scale), reach / height → arm length, weight / height² → body bulk (bw). */
(function(){
if(typeof lookFor!=='function')return;
const SIZE={
'Fedor Emelianenko':[183,188],'Mirko Cro Cop':[188,185],'Antonio Rodrigo Nogueira':[191,196],'Josh Barnett':[191,203],'Sergei Kharitonov':[193,196],'Fabricio Werdum':[193,196],'Tim Sylvia':[203,203],'Andrei Arlovski':[191,196],'Frank Mir':[191,201],
'Brock Lesnar':[191,206],'Cain Velasquez':[185,196],'Junior dos Santos':[193,196],'Alistair Overeem':[193,203],'Shane Carwin':[188,203],'Roy Nelson':[183,188],'Stipe Miocic':[193,203],'Daniel Cormier':[180,183],'Francis Ngannou':[193,211],
'Ciryl Gane':[193,206],'Tom Aspinall':[196,198],'Curtis Blaydes':[193,203],'Sergei Pavlovich':[191,213],'Alexander Volkov':[201,203],'Jairzinho Rozenstruik':[188,196],'Derrick Lewis':[191,201],'Mark Hunt':[178,183],'Ben Rothwell':[193,203],
'Travis Browne':[201,201],'Antonio Silva':[193,206],'Gabriel Gonzaga':[188,198],'Cheick Kongo':[193,208],'Renan Ferreira':[203,211],'Arjan Bhullar':[185,191],'Brandon Vera':[191,196],'Choi Hong-man':[218,220],'Bob Sapp':[200,203],'Mariusz Pudzianowski':[186,190],'Phil De Fries':[196,201],
'Chuck Liddell':[188,193],'Tito Ortiz':[188,188],'Randy Couture':[185,191],'Quinton Jackson':[183,188],'Wanderlei Silva':[180,188],'Dan Henderson':[180,180],'Mauricio Rua':[185,193],'Forrest Griffin':[191,196],'Stephan Bonnar':[193,198],
'Rashad Evans':[180,191],'Lyoto Machida':[185,188],'Jon Jones':[193,215],'Alexander Gustafsson':[196,201],'Glover Teixeira':[188,193],'Jiri Prochazka':[193,203],'Alex Pereira':[193,203],'Magomed Ankalaev':[191,191],'Jamahal Hill':[193,201],
'Jan Blachowicz':[188,198],'Dominick Reyes':[193,196],'Anthony Smith':[193,193],'Thiago Santos':[188,193],'Volkan Oezdemir':[185,191],'Aleksandar Rakic':[196,198],'Khalil Rountree':[185,193],'Ryan Bader':[188,188],'Phil Davis':[188,201],
'Corey Anderson':[191,198],'Anthony Johnson':[188,198],'Ovince Saint Preux':[191,203],'Johnny Walker':[198,208],
'Anderson Silva':[188,197],'Rich Franklin':[185,193],'Nate Marquardt':[183,188],'Chael Sonnen':[185,188],'Vitor Belfort':[183,188],'Yushin Okami':[188,191],'Chris Weidman':[188,198],'Luke Rockhold':[191,196],'Michael Bisping':[185,191],
'Ronaldo Souza':[185,185],'Yoel Romero':[183,185],'Robert Whittaker':[183,187],'Israel Adesanya':[193,203],'Paulo Costa':[185,183],'Jared Cannonier':[180,196],'Marvin Vettori':[183,188],'Sean Strickland':[185,193],'Dricus du Plessis':[185,193],
'Khamzat Chimaev':[188,191],'Nassourdine Imavov':[191,191],'Brendan Allen':[188,191],'Gegard Mousasi':[188,193],'Hector Lombard':[175,180],'Tim Kennedy':[180,180],'Cung Le':[178,178],
'Georges St-Pierre':[178,193],'Matt Hughes':[175,185],'Matt Serra':[168,170],'Jon Fitch':[183,188],'Josh Koscheck':[178,185],'Carlos Condit':[188,191],'Johny Hendricks':[175,175],'Robbie Lawler':[180,188],'Rory MacDonald':[183,193],
'Tyron Woodley':[175,188],'Stephen Thompson':[183,191],'Kamaru Usman':[183,193],'Colby Covington':[180,183],'Jorge Masvidal':[180,188],'Leon Edwards':[183,188],'Belal Muhammad':[180,183],'Gilbert Burns':[178,180],'Shavkat Rakhmonov':[185,196],
'Jack Della Maddalena':[180,185],'Ian Garry':[191,188],'Sean Brady':[178,183],'Nick Diaz':[185,193],'Paul Daley':[178,183],'Michael Page':[191,201],'Ben Askren':[178,183],'Jake Shields':[183,183],'Kim Dong-hyun':[188,193],'Thiago Alves':[175,178],'Diego Sanchez':[178,183],'Mike Perry':[178,180],
'B.J. Penn':[175,178],'Takanori Gomi':[173,175],'Shinya Aoki':[180,183],'Gilbert Melendez':[175,180],'Josh Thomson':[178,183],'Eddie Alvarez':[175,175],'Michael Chandler':[173,180],'Frankie Edgar':[168,173],'Benson Henderson':[175,178],
'Anthony Pettis':[178,183],'Rafael dos Anjos':[173,178],'Conor McGregor':[175,188],'Khabib Nurmagomedov':[178,178],'Tony Ferguson':[180,193],'Dustin Poirier':[175,183],'Justin Gaethje':[180,178],'Charles Oliveira':[178,188],'Islam Makhachev':[178,178],
'Arman Tsarukyan':[170,183],'Beneil Dariush':[178,183],'Mateusz Gamrot':[178,180],'Paddy Pimblett':[178,185],'Renato Moicano':[180,183],'Nate Diaz':[183,193],'Kenny Florian':[178,188],'Gray Maynard':[173,178],'Donald Cerrone':[185,185],'Usman Nurmagomedov':[180,183],
'Urijah Faber':[168,170],'Jose Aldo':[170,178],'Chad Mendes':[168,168],'Max Holloway':[180,175],'Alexander Volkanovski':[168,180],'Ilia Topuria':[170,175],'Brian Ortega':[173,175],'Yair Rodriguez':[180,180],'Movsar Evloev':[170,183],'Diego Lopes':[180,183],
'Arnold Allen':[173,178],'Josh Emmett':[168,178],'Calvin Kattar':[180,183],'Zabit Magomedsharipov':[185,185],'Chan Sung Jung':[175,183],'Doo Ho Choi':[175,178],'Patricio Pitbull':[165,165],'AJ McKee':[178,180],
'Dominick Cruz':[173,173],'Renan Barao':[170,178],'TJ Dillashaw':[168,170],'Cody Garbrandt':[173,165],'Henry Cejudo':[163,163],'Petr Yan':[170,170],'Aljamain Sterling':[170,180],"Sean O'Malley":[180,183],'Merab Dvalishvili':[168,173],
'Umar Nurmagomedov':[173,175],'Cory Sandhagen':[180,178],'Marlon Vera':[173,178],'Song Yadong':[173,170],'Kyoji Horiguchi':[165,168],'Tenshin Nasukawa':[165,170],
'Demetrious Johnson':[160,168],'Joseph Benavidez':[163,165],'John Dodson':[160,168],'Deiveson Figueiredo':[165,173],'Brandon Moreno':[170,178],'Alexandre Pantoja':[165,170],'Kai Kara-France':[170,175],'Brandon Royval':[175,173],'Manel Kape':[165,173],'Tatsuro Taira':[170,178],
'Floyd Mayweather':[173,183],'Jake Paul':[185,193]};
window.SIZE=SIZE;
const lf=lookFor;window.lookFor=function(f){const o=lf(f);const wc=WC[f.wc]||{};const sz=SIZE[f.n];
  const hcm=sz?sz[0]:Math.round(((wc.h||1.78)+(hsh(f.n+'hh')-.5)*.06)*100),rcm=sz?sz[1]:Math.round(hcm*(1+(hsh(f.n+'rr')-.45)*.06));
  const kg=(wc.lb||170)/2.2046,h=hcm/100;const bmi=kg/(h*h);
  o.h=h;o.apeK=rcm/hcm;o.bw=clamp(Math.pow(bmi/24,.75),.82,1.34)*(o.body==='broad'?1.03:1);o.hcm=hcm;o.rcm=rcm;o.kg=Math.round(kg);return o};

/* ---------- stance: label next to the name, switch button (C key) ---------- */
const STN=s=>s<0?'사우스포':'오소독스';
{const bh=Match.prototype.buildHUD;Match.prototype.buildHUD=function(){const r=bh.apply(this,arguments);this.f.forEach((f,i)=>{const n=this.root.querySelector(`.hp2.s${i} .hname`);if(n&&!n.querySelector('.stn')){const e=document.createElement('em');e.className='stn';e.dataset.stn=i;e.textContent=STN(f.stance||1);n.appendChild(e)}});return r}}
Match.prototype.switchStance=function(f){if(!f||f.state!=='stand'||f._sw||(f.act&&f.act.c&&f.act.c.hit))return;f._sw={t:0,flip:0};SFXI.play&&SFXI.play('step',.3)};
{const fw=F2.prototype.footwork;F2.prototype.footwork=function(p,dt){fw.call(this,p,dt);const S=this._sw;if(!S)return;S.t+=dt;const u=Math.min(1,S.t/.35);const k=Math.sin(Math.PI*u);
    /* feet come together, a small hop, and they land in the other stance: the switch happens mid-air */
    const c=(p.ll_h+p.rl_h)/2;p.ll_h+=(c-p.ll_h)*k*.9;p.rl_h+=(c-p.rl_h)*k*.9;p.ll_k+=.22*k;p.rl_k+=.22*k;p.y=(p.y||0)+.022*this.H*k;p.tw-=.25*k*(this.stance||1);
    this.body._swing={l:k,r:k};
    if(!S.flip&&u>=.5){S.flip=1;this.stance=-(this.stance||1);this.body.stance=this.stance;const M=window.__curMatch;if(M&&M.root){const i=M.f.indexOf(this);const e=M.root.querySelector(`[data-stn="${i}"]`);if(e)e.textContent=STN(this.stance)}}
    if(u>=1)this._sw=null}}
if(typeof In2!=='undefined'){const bt=In2.prototype.buildTouch;In2.prototype.buildTouch=function(){bt.call(this);const tc=this.tc;if(!tc)return;const box=tc.querySelector('.tr4');if(!box)return;
    const b=document.createElement('button');b.className='b4 stc';b.innerHTML='<b>⇆</b><small>스탠스</small>';box.appendChild(b);
    const go=()=>{const M=window.__curMatch;if(M&&M.pi!=null)M.switchStance(M.f[M.pi])};b.addEventListener('touchstart',e=>{e.preventDefault();b.classList.add('on');go();if(navigator.vibrate)try{navigator.vibrate(6)}catch(_){}},{passive:false});b.addEventListener('touchend',()=>b.classList.remove('on'));b.addEventListener('click',go)}
  addEventListener('keydown',e=>{if((e.key==='c'||e.key==='C')&&!/INPUT|SELECT|TEXTAREA/.test((e.target||{}).tagName||'')){const M=window.__curMatch;if(M&&M.pi!=null)M.switchStance(M.f[M.pi])}})}
{const css=document.createElement('style');css.textContent=`.hname .stn{font-style:normal;font:600 11px 'Noto Sans KR',sans-serif;margin-left:8px;padding:1px 7px;border-radius:999px;background:rgba(255,255,255,.18);letter-spacing:0}.b4.stc{border-color:rgba(200,160,255,.9)}`;document.head.appendChild(css)}

/* ---------- refined faces for well-known fighters whose face was generic before (distinct traits) ---------- */
Object.assign(FACES,{
 'Curtis Blaydes':{n:.6,nf:.7,br:.7,jw:.85,ch:.6,lp:.7,ey:2,ck:.6,eb:.6},'Alexander Volkov':{n:.75,nh:.2,br:.55,jw:.55,ch:.6,lp:.3,ey:0,ck:.7,eb:.4},
 'Gilbert Burns':{n:.55,nf:.6,br:.65,jw:.85,ch:.55,lp:.55,ey:1,ck:.6,eb:.7},'Ian Garry':{n:.6,br:.45,jw:.6,ch:.6,lp:.4,ey:0,ck:.65,eb:.45},
 'Shavkat Rakhmonov':{n:.6,nh:.3,br:.6,jw:.7,ch:.55,lp:.35,ey:1,ck:.75,eb:.7},'Jack Della Maddalena':{n:.6,br:.5,jw:.65,ch:.6,lp:.4,ey:0,ck:.6,eb:.5},
 'Umar Nurmagomedov':{n:.62,nh:.35,br:.6,jw:.7,ch:.5,lp:.4,ey:1,ck:.7,eb:.75},'Cory Sandhagen':{n:.6,br:.45,jw:.55,ch:.6,lp:.4,ey:0,ck:.6,eb:.45},
 'Marlon Vera':{n:.55,nf:.55,br:.6,jw:.7,ch:.55,lp:.5,ey:1,ck:.65,eb:.6},'Brandon Royval':{n:.6,br:.45,jw:.55,ch:.55,lp:.4,ey:0,ck:.55,eb:.45},
 'Kai Kara-France':{n:.55,nf:.5,br:.55,jw:.7,ch:.55,lp:.55,ey:0,ck:.65,eb:.55},'Khalil Rountree':{n:.55,nf:.7,br:.7,jw:.8,ch:.6,lp:.75,ey:2,ck:.6,eb:.55},
 'Dominick Reyes':{n:.6,br:.5,jw:.65,ch:.6,lp:.5,ey:0,ck:.65,eb:.5},'Anthony Smith':{n:.65,nf:.4,br:.6,jw:.75,ch:.6,lp:.4,ey:1,ck:.55,eb:.55},
 'Aleksandar Rakic':{n:.65,nh:.25,br:.6,jw:.75,ch:.65,lp:.35,ey:1,ck:.6,eb:.55},'Rory MacDonald':{n:.6,br:.55,jw:.65,ch:.65,lp:.35,ey:2,ck:.6,eb:.5},
 'Paul Daley':{n:.55,nf:.6,br:.6,jw:.7,ch:.55,lp:.55,ey:1,ck:.6,eb:.55},'Michael Page':{n:.55,nf:.6,br:.55,jw:.6,ch:.55,lp:.65,ey:0,ck:.7,eb:.5},
 'Ben Askren':{n:.55,nf:.4,br:.45,jw:.5,ch:.4,lp:.5,ey:0,ck:.4,eb:.4},'Jake Shields':{n:.6,br:.45,jw:.5,ch:.5,lp:.4,ey:0,ck:.5,eb:.4},
 'Josh Barnett':{n:.55,nf:.5,br:.7,jw:.85,ch:.6,lp:.45,ey:2,ck:.55,eb:.6},'Travis Browne':{n:.6,br:.55,jw:.7,ch:.6,lp:.5,ey:1,ck:.65,eb:.55},
 'Ovince Saint Preux':{n:.55,nf:.7,br:.6,jw:.75,ch:.55,lp:.75,ey:1,ck:.6,eb:.5},'Johnny Walker':{n:.65,br:.5,jw:.55,ch:.6,lp:.5,ey:0,ck:.7,eb:.5},
 'Paddy Pimblett':{n:.55,nf:.35,br:.45,jw:.6,ch:.45,lp:.5,ey:0,ck:.5,eb:.45},'Renato Moicano':{n:.6,br:.55,jw:.7,ch:.6,lp:.45,ey:1,ck:.6,eb:.6},
 'Beneil Dariush':{n:.65,nh:.35,br:.55,jw:.65,ch:.55,lp:.45,ey:1,ck:.6,eb:.65},'Mateusz Gamrot':{n:.55,br:.5,jw:.7,ch:.55,lp:.4,ey:0,ck:.55,eb:.5},
 'Calvin Kattar':{n:.6,br:.55,jw:.75,ch:.6,lp:.45,ey:1,ck:.6,eb:.6},'Movsar Evloev':{n:.62,nh:.3,br:.6,jw:.7,ch:.55,lp:.4,ey:1,ck:.7,eb:.75}});

/* ---------- off-stance skill (반대 스탠스): known switch hitters high, one-stance fighters low ---------- */
const SWITCH={'Anderson Silva':19,'Dominick Cruz':19,'TJ Dillashaw':18,'Max Holloway':17,'Petr Yan':18,'Israel Adesanya':18,'Cory Sandhagen':18,"Sean O'Malley":18,'Stephen Thompson':17,'Jon Jones':17,'Marlon Vera':16,
 'Aljamain Sterling':16,'Merab Dvalishvili':13,'Henry Cejudo':14,'Conor McGregor':14,'Robert Whittaker':15,'Kai Kara-France':14,'Brandon Moreno':15,'Alexandre Pantoja':13,'Demetrious Johnson':17,'Georges St-Pierre':15,
 'Lyoto Machida':15,'Alex Pereira':12,'Jiri Prochazka':16,'Yair Rodriguez':16,'Tony Ferguson':15,'Justin Gaethje':9,'Dustin Poirier':12,'Charles Oliveira':11,'Islam Makhachev':12,'Khabib Nurmagomedov':9,
 'Brock Lesnar':3,'Mark Hunt':4,'Derrick Lewis':4,'Roy Nelson':4,'Francis Ngannou':5,'Ben Askren':4,'Colby Covington':7,'Cain Velasquez':7,'Daniel Cormier':7,'Stipe Miocic':10,'Jose Aldo':8,'Chuck Liddell':6,'Quinton Jackson':5,
 'Wanderlei Silva':6,'Mirko Cro Cop':5,'Fedor Emelianenko':8,'Matt Hughes':5,'Chael Sonnen':5,'Tito Ortiz':5,'Paulo Costa':6,'Nate Diaz':8,'Nick Diaz':8,'Kamaru Usman':11,'Leon Edwards':13,'Belal Muhammad':10};
window.SWITCH_SK=(f,A)=>SWITCH[f.n]!=null?SWITCH[f.n]:clamp((A.footwork||10)*.55+4+(hsh(f.n+'sw')-.5)*5,3,17);
const swSkill=f=>(f.A&&f.A.switch)||10;
window.offStanceMul=f=>{if(f.natStance==null)f.natStance=f.stance||1;if((f.stance||1)===f.natStance)return 1;const sk=clamp(swSkill(f),1,20);return 1-(.05+.25*(1-(sk-1)/19))};
/* ---------- weight-class scaling (welterweight = current numbers): damage dealt 60 % -> 200 %, durability 60 % -> 150 % ---------- */
const lbOf=f=>{const kg=f.look&&f.look.kg;if(kg)return kg*2.2046;const bw=(f.look&&f.look.bw)||1;return 170*Math.pow(bw,2)};
const lerpC=(a,b,t)=>a+(b-a)*clamp(t,0,1);
window.wcDmgMul=f=>{const lb=lbOf(f);return lb<=170?lerpC(.6,1,(lb-125)/45):lerpC(1,2,(lb-170)/95)};
window.wcHpMul=f=>{const lb=lbOf(f);return lb<=170?lerpC(.6,1,(lb-125)/45):lerpC(1,1.5,(lb-170)/95)};
{const ad=Match.prototype.applyDmg;Match.prototype.applyDmg=function(att,def,o){if(o&&o.dmg!=null&&!(this.cfg&&this.cfg.training==="bag")){o.dmg*=wcDmgMul(att)/wcHpMul(def)*(att.state==="stand"?offStanceMul(att):1)}return ad.call(this,att,def,o)}}
/* natural stance remembered at the start of a match */
{const st=Match.prototype.step;Match.prototype.step=function(dt){for(const f of this.f)if(f.natStance==null)f.natStance=f.stance||1;return st.call(this,dt)}}
})();
