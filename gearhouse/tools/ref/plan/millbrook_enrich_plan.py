import json, math, random
d=json.load(open('site.json')); W2=d['W2']; P=d['props']; L=d['L']
Lft=d['left']; Rgt=d['right']; N=len(Lft)
def frame(i):
  i=i%N; l=Lft[i]; r=Rgt[i]; c=((l[0]+r[0])/2,(l[1]+r[1])/2); nx=(l[0]-r[0])/(2*W2); ny=(l[1]-r[1])/(2*W2); return c,(nx,ny)
def pt(s,o):
  i=int(round(s/5))%N; c,n=frame(i); return (c[0]+n[0]*o, c[1]+n[1]*o)
start=d['start']
HOME=659.1; R1=305+W2; ME=HOME+R1*math.radians(165); RA=ME+956.3; R2=457+W2; BY=RA+R2*math.radians(213)
random.seed(4)
# ---------- overall plan ----------
xs=[p[0] for p in Lft+Rgt]; ys=[p[1] for p in Lft+Rgt]
pad=190; X0=min(xs)-pad; X1=max(xs)+pad; Y0=min(ys)-pad; Y1=max(ys)+pad
S=0.52
def T1(x,y): return ((x-X0)*S, (Y1-y)*S)
def poly(pts,T,**a):
  s=' '.join(f'{T(*p)[0]:.1f},{T(*p)[1]:.1f}' for p in pts); at=' '.join(f'{k.replace("_","-")}="{v}"' for k,v in a.items()); return f'<polygon points="{s}" {at}/>'
def line(pts,T,**a):
  s=' '.join(f'{T(*p)[0]:.1f},{T(*p)[1]:.1f}' for p in pts); at=' '.join(f'{k.replace("_","-")}="{v}"' for k,v in a.items()); return f'<polyline points="{s}" fill="none" {at}/>'
def band(s0,s1,o0,o1,step=10):
  a=[pt(s,o0) for s in range(int(s0),int(s1)+1,step)]; b=[pt(s,o1) for s in range(int(s1),int(s0)-1,-step)]; return a+b
W1=(X1-X0)*S; H1=(Y1-Y0)*S
o=[]
o.append(f'<rect width="{W1:.0f}" height="{H1:.0f}" fill="#dfe6cf"/>')
# existing ground
for a in d['areas']: o.append(poly(a['pts'],T1,fill='#cfdcb4' if a['kind']=='mown' else '#d8cfb8'))
for ln in d['lines']: o.append(line(ln['pts'],T1,stroke={'rail':'#6d5a4a','river':'#7fb2d6','road':'#bbb'}[ln['kind']],stroke_width=max(1.5,ln['width']*S)))
# PROPOSED woodland belt (outer) and inner groves
busy=lambda s: (start-160)%L < s < (start+420)%L if (start-160)%L < (start+420)%L else False
rail=(ME-60, RA+60)
segs=[]; cur=None
for s in range(0,L,10):
  ok=not (start-160 <= s <= start+420) and not (rail[0]<=s<=rail[1])
  if ok and cur is None: cur=s
  if not ok and cur is not None: segs.append((cur,s)); cur=None
if cur is not None: segs.append((cur,L))
for a,b in segs: o.append(poly(band(a,b,-(W2+55),-(W2+150)),T1,fill='#5f8f4e',fill_opacity='0.55',stroke='#3d6b32',stroke_dasharray='4 3'))
o.append(poly(band(rail[0],rail[1],-(W2+60),-(W2+130)),T1,fill='#5f8f4e',fill_opacity='0.35',stroke='#3d6b32',stroke_dasharray='4 3'))
# track
o.append(poly(Lft+Rgt[::-1],T1,fill='#b9b3a6',stroke='#7a746a',stroke_width='0.8'))
# existing props
for p in P:
  x,y=T1(p['x'],p['y']); k=p['kind']
  if k.startswith('tree') or k=='bush': o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.6" fill="#4d7a3a"/>')
  elif k=='telegraphPole': o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="0.9" fill="#555"/>')
  elif k in ('hayBales',): o.append(f'<rect x="{x-1.5:.1f}" y="{y-1.5:.1f}" width="3" height="3" fill="#d9b44a"/>')
  else: o.append(f'<rect x="{x-2.5:.1f}" y="{y-2.5:.1f}" width="5" height="5" fill="#333"/>')
# PROPOSED: inner groves (Members' hill already has trees; add groves inside Byfleet & around aerodrome edge)
for (s,off,r) in [(RA+500,W2+110,45),(RA+1100,W2+130,55),(BY-300,W2+90,40),(ME-300,W2+140,40),(HOME+300,W2+180,35)]:
  c=pt(s,off); x,y=T1(*c); o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r*S:.1f}" fill="#5f8f4e" fill-opacity="0.55" stroke="#3d6b32" stroke-dasharray="4 3"/>')
# PROPOSED: marshal posts and hay bales at corner entries/exits
corners=[HOME+20, (HOME+ME)/2, ME-20, RA+20, (RA+BY)/2, BY-20, BY+60]
for s in corners:
  x,y=T1(*pt(s,W2+5)); o.append(f'<polygon points="{x:.1f},{y-6:.1f} {x-5:.1f},{y+4:.1f} {x+5:.1f},{y+4:.1f}" fill="#d0342c" stroke="#fff" stroke-width="0.8"/>')
for s in [ME+30, BY+30, BY+90, RA-40, HOME-60]:
  for k in range(3):
    x,y=T1(*pt(s+k*8,W2+3)); o.append(f'<rect x="{x-2:.1f}" y="{y-2:.1f}" width="4" height="4" fill="#f2c94c" stroke="#8a6d1c" stroke-width="0.6"/>')
# PROPOSED: advertising hoardings along straights
for s in list(range(int(start+220),int(HOME-40),30))+list(range(int(ME+120),int(RA-120),45)):
  x,y=T1(*pt(s,-(W2+5))); o.append(f'<rect x="{x-3:.1f}" y="{y-1.2:.1f}" width="6" height="2.4" fill="#2f6fb5"/>')
# PROPOSED: spectator enclosures (areas with fence, benches, tents) on Members' hill and Byfleet inside
for (s0,s1,o0,o1) in [(HOME+120,HOME+420,W2+8,W2+40),(RA+200,RA+700,W2+8,W2+35),(BY-700,BY-250,W2+8,W2+35)]:
  o.append(poly(band(s0,s1,o0,o1),T1,fill='#9b6fc9',fill_opacity='0.35',stroke='#6b3fa0'))
# PROPOSED: car park and access road behind the stands
cp=band(start-120,start+140,-(W2+45),-(W2+110)); o.append(poly(cp,T1,fill='#a9a39a',stroke='#6b665c'))
road=[pt(start+10,-(W2+110))]+[pt(start+10,-(W2+110+k*40)) for k in range(1,6)]
o.append(line(road,T1,stroke='#8c8576',stroke_width='5'))
# start line, clock marker
x,y=T1(*pt(start,0)); o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="none" stroke="#c0392b" stroke-width="2"/>')
# detail frame
fr=band(start-70,start+260,W2+90,-(W2+120)); o.append(poly(fr,T1,fill='none',stroke='#c0392b',stroke_width='1.5',stroke_dasharray='6 4'))
lab=T1(*pt(start+260,W2+95)); o.append(f'<text x="{lab[0]+6:.0f}" y="{lab[1]:.0f}" font-size="13" fill="#c0392b" font-weight="600">상세도 범위</text>')
for name,s,off in [("Home Straight",HOME*0.55,-(W2+70)),("Members' Banking",(HOME+ME)/2,-(W2+180)),("Railway Straight",(ME+RA)/2,-(W2+175)),("Byfleet Banking",(RA+BY)/2,-(W2+185)),("The Fork",BY+60,W2+60)]:
  x,y=T1(*pt(s,off)); o.append(f'<text x="{x:.0f}" y="{y:.0f}" font-size="12" fill="#444" text-anchor="middle" font-style="italic">{name}</text>')
svg1=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W1:.0f}" height="{H1:.0f}" viewBox="0 0 {W1:.0f} {H1:.0f}">{"".join(o)}</svg>'
# ---------- detail: start / clock tower area, local frame u along track, v left ----------
h=d['marks']['start'][2]; ux,uy=math.cos(h),math.sin(h); sx,sy=d['marks']['start'][0],d['marks']['start'][1]
def loc(x,y): dx,dy=x-sx,y-sy; return (dx*ux+dy*uy, -dx*uy+dy*ux)
U0,U1,V0,V1=-70,260,-(W2+120),W2+90; S2=4.0
def T2(u,v): return ((u-U0)*S2, (V1-v)*S2)
W2p=(U1-U0)*S2; H2p=(V1-V0)*S2
q=[f'<rect width="{W2p:.0f}" height="{H2p:.0f}" fill="#dfe6cf"/>']
def R(u0,u1,v0,v1,**a): pts=[(u0,v0),(u1,v0),(u1,v1),(u0,v1)]; return poly(pts,T2,**a)
# existing apron
q.append(R(120,380,W2+8,W2+52,fill='#d8cfb8'))
# proposed car park + road
q.append(R(-60,140,-(W2+45),-(W2+110),fill='#bdb7ac',stroke='#6b665c'))
for k in range(9):
  for row,v in enumerate([-(W2+55),-(W2+72),-(W2+88),-(W2+102)]):
    u=-50+k*20+(row%2)*6; q.append(R(u,u+4.6,v,v+1.8,fill=['#7a2f2f','#2d4a6b','#2f2f2f','#5d6b3a','#7b6a4a'][(k+row)%5],stroke='#222',stroke_width='0.6'))
q.append(R(5,15,-(W2+110),V0,fill='#8c8576'))
q.append(f'<text x="{T2(40,-(W2+112))[0]:.0f}" y="{T2(40,-(W2+112))[1]+16:.0f}" font-size="13" fill="#333">진입로 · 전신주</text>')
for k in range(4): x,y=T2(19,-(W2+112)-k*8); q.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="3" fill="#555"/>')
# track
q.append(R(U0,U1,-W2,W2,fill='#b9b3a6'))
for v in (W2,-W2): q.append(line([(U0,v),(U1,v)],T2,stroke='#7a746a',stroke_width='2'))
q.append(line([(0,-W2),(0,W2)],T2,stroke='#fff',stroke_width='4'))
q.append(f'<text x="{T2(2,0)[0]:.0f}" y="{T2(2,0)[1]:.0f}" font-size="14" fill="#fff" font-weight="600">출발선</text>')
# verges / fences
for v in (W2+2.2,-(W2+2.2)): q.append(line([(U0,v),(U1,v)],T2,stroke='#6b4f2a',stroke_width='1.5',stroke_dasharray='6 4'))
cu,cv=loc(55.43,133.01)
# PROPOSED plaza around the clock tower
q.append(R(cu-24,cu+30,W2+3.5,W2+30,fill='#cdbfa6',stroke='#8b6b45',stroke_width='1.5'))  # paved plaza
for (a,b,c,e) in [(cu-24,cu+30,W2+30,W2+31),(cu-24,cu-23,W2+3.5,W2+30),(cu+29,cu+30,W2+3.5,W2+30)]: q.append(R(a,b,c,e,fill='#9c4a32'))  # low brick wall
q.append(R(cu-3,cu+3,W2+30,W2+31,fill='#cdbfa6'))  # gate

# paths
q.append(R(cu+30,140,W2+15,W2+19,fill='#cdbfa6'))  # path to the paddock
q.append(R(-10,cu-24,W2+15,W2+19,fill='#cdbfa6'))  # path along to timing box

# existing props
for p in P:
  u,v=loc(p['x'],p['y'])
  if not (U0<u<U1 and V0<v<V1): continue
  k=p['kind']; x,y=T2(u,v)
  if k.startswith('tree') or k=='bush': q.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{10 if k!="bush" else 6}" fill="#4d7a3a" opacity="0.8"/>')
  elif k=='hayBales': q.append(f'<rect x="{x-6:.0f}" y="{y-6:.0f}" width="12" height="12" fill="#d9b44a"/>')
  else:
    sz={'grandstandBay':(15.6,8),'garageBay':(14.5,8),'clubhouseCentre':(12,10),'clubhouseWing':(12,9),'clockTower':(3.6,3.6),'timingBox':(5,4),'scoreboard':(8,2),'hoarding':(9,0.6),'teaHut':(6,5),'fuelPumps':(5,2)}.get(k,(4,4))
    q.append(R(u-sz[0]/2,u+sz[0]/2,v-sz[1]/2,v+sz[1]/2,fill='#3a3a3a' if k!='clockTower' else '#8b2e1f',stroke='#000',stroke_width='0.8'))
for (fu,fv) in [(cu-16,W2+20),(cu+16,W2+20)]: q.append(f'<ellipse cx="{T2(fu,fv)[0]:.0f}" cy="{T2(fu,fv)[1]:.0f}" rx="{6*S2:.0f}" ry="{3*S2:.0f}" fill="#d0607a" stroke="#6b8f3a" stroke-width="3"/>')  # flower beds
for (bu,bv) in [(cu-10,W2+27),(cu+10,W2+27),(cu-20,W2+12),(cu+24,W2+12)]: q.append(R(bu-1.8,bu+1.8,bv-0.4,bv+0.4,fill='#8a5a2b'))  # benches
for (lu,lv) in [(cu-22,W2+5),(cu+28,W2+5),(cu-22,W2+28),(cu+28,W2+28),(cu,W2+28)]: q.append(f'<circle cx="{T2(lu,lv)[0]:.0f}" cy="{T2(lu,lv)[1]:.0f}" r="4" fill="#f5d76e" stroke="#333"/>')  # lamps
for k in range(3): x,y=T2(cu+6+k*4,W2+7); q.append(f'<line x1="{x:.0f}" y1="{y:.0f}" x2="{x:.0f}" y2="{y-26:.0f}" stroke="#555" stroke-width="2"/><rect x="{x:.0f}" y="{y-26:.0f}" width="14" height="9" fill="{["#c0392b","#1f4e8c","#e8e0c8"][k]}"/>')  # flagpoles
q.append(R(cu-8,cu-5,W2+5,W2+5.6,fill='#2f2f2f'))  # notice board

labels={'grandstandBay':'관람석(기존)','clockTower':'시계탑','timingBox':'타이밍','scoreboard':'점수판','clubhouseCentre':'클럽하우스','garageBay':'차고','teaHut':'찻집 ','fuelPumps':'급유기','hoarding':'간판(기존)'}
seen=set()
for p in P:
  k=p['kind']
  if k in labels and k not in seen:
    u,v=loc(p['x'],p['y'])
    if U0<u<U1 and V0<v<V1: seen.add(k); x,y=T2(u,v); q.append(f'<text x="{x:.0f}" y="{y-14 if k not in ("clockTower","teaHut","timingBox") else y+28:.0f}" font-size="12" fill="#111" text-anchor="middle" font-weight="600">{labels[k]}</text>')
# PROPOSED spectator side: tents, bunting, more hoardings
for (tu,tv) in [(-55,-(W2+30)),(105,-(W2+30)),(125,-(W2+30))]:
  q.append(R(tu-5,tu+5,tv-4,tv+4,fill='#f3efe4',stroke='#b04a3a',stroke_width='2')); q.append(line([(tu-5,tv),(tu+5,tv)],T2,stroke='#b04a3a',stroke_width='1'))
q.append(f'<text x="{T2(-55,-(W2+36))[0]:.0f}" y="{T2(-55,-(W2+36))[1]+12:.0f}" font-size="11" fill="#333" text-anchor="middle">천막·매점</text>')
for v in (W2+3,-(W2+3)):
  pts=[]; 
  for k in range(0,41):
    u=-60+k*5; pts.append((u, v+(0.8 if k%2 else -0.8)))
  q.append(line(pts,T2,stroke='#e2574c',stroke_width='1.5'))
for u in range(220,U1,22): q.append(R(u,u+9,-(W2+5.3),-(W2+4.7),fill='#2f6fb5'))
for u in [-62,-30,150]: x,y=T2(u,-(W2+6)); q.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="3" fill="#555"/>')
for k in range(3): q.append(R(-40+k*6,-36+k*6,W2+2.6,W2+4.6,fill='#f2c94c',stroke='#8a6d1c'))
# PROPOSED tree line behind the paddock and plaza
for u in range(-60,U1,9):
  x,y=T2(u+random.uniform(-2,2),W2+62+random.uniform(0,18)); q.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{random.uniform(9,14):.0f}" fill="#5f8f4e" opacity="0.75" stroke="#3d6b32" stroke-dasharray="3 2"/>')
svg2=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W2p:.0f}" height="{H2p:.0f}" viewBox="0 0 {W2p:.0f} {H2p:.0f}">{"".join(q)}</svg>'
def key(c,shape,t): return f'<li><svg width="22" height="14">{shape.replace("C",c)}</svg>{t}</li>'
sq='<rect x="4" y="2" width="12" height="10" fill="C"/>'; ci='<circle cx="10" cy="7" r="5" fill="C"/>'; tr='<polygon points="10,1 3,13 17,13" fill="C"/>'
legend1=''.join([key('#333',sq,'기존 건물'),key('#4d7a3a',ci,'기존 나무'),key('#5f8f4e',sq,'<b>제안</b> 숲 띠·나무 군락'),key('#9b6fc9',sq,'<b>제안</b> 관람 구역(울타리, 벤치, 천막)'),key('#a9a39a',sq,'<b>제안</b> 주차장(시대 차)'),key('#2f6fb5',sq,'<b>제안</b> 광고 간판'),key('#f2c94c',sq,'<b>제안</b> 짚단(코너 출입구)'),key('#d0342c',tr,'<b>제안</b> 진행 요원 초소(깃발 판)')])
legend2=''.join([key('#cdbfa6',sq,'<b>제안</b> 시계탑 광장(석재 포장)과 길'),key('#9c4a32',sq,'<b>제안</b> 낮은 벽돌 담'),key('#d0607a',ci,'<b>제안</b> 화단'),key('#8a5a2b',sq,'<b>제안</b> 벤치'),key('#f5d76e',ci,'<b>제안</b> 가로등'),key('#c0392b',sq,'<b>제안</b> 깃대(3)·안내판'),key('#e2574c',sq,'<b>제안</b> 줄 장식(번팅)'),key('#bdb7ac',sq,'<b>제안</b> 주차장·진입로·전신주'),key('#f3efe4',sq,'<b>제안</b> 천막·매점'),key('#5f8f4e',ci,'<b>제안</b> 패독 뒤 나무 줄')])
html=f'''<!doctype html><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{{margin:0;padding:24px;background:#f4f1ea;font-family:'Noto Sans KR',sans-serif;color:#222}} h1{{font-size:24px;margin:0 0 4px}} h2{{font-size:18px;margin:22px 0 8px}} p{{margin:0 0 10px;color:#555;font-size:14px}} .row{{display:flex;gap:20px;align-items:flex-start}} ul{{list-style:none;padding:0;margin:0;font-size:13px;line-height:1.9}} li svg{{vertical-align:middle;margin-right:6px}} .box{{background:#fff;border:1px solid #d8d2c4;border-radius:6px;padding:10px}}</style>
<h1>Millbrook 배경 보강 계획 — 조감 평면도 (사람 제외)</h1><p>위가 북쪽 방향 아님 · 실제 트랙 좌표(미터)로 그림 · 회색·짙은 표시는 지금 있는 것, 색 표시는 제안</p>
<h2>1. 전체 배치</h2><div class="row"><div class="box">{svg1}</div><ul>{legend1}</ul></div>
<h2>2. 상세: 출발선·시계탑·패독 (트랙 방향을 가로로 펼침, 왼쪽이 출발 전)</h2><div class="row"><div class="box">{svg2}</div><ul>{legend2}</ul></div>'''
open('plan/plan.html','w').write(html); print(W1,H1,W2p,H2p)
