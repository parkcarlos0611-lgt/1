# Authoring source of data/bodies/sedan36.json, measured off a reference sheet at 12.5 mm/px (plan: review 15, first-build manner).
# python3 tools/ref/sedan36.py data/bodies/sedan36.json
import json, math, sys
def ell(cx,cz,rx,rz,n=20): return [[round(cx+math.cos(k/n*6.2832)*rx), round(cz+math.sin(k/n*6.2832)*rz)] for k in range(n)]
def sh(p): return [[x,z,1] for x,z in p]
FX,RX,R,ARCH=783,3715,400,455
P=[]
def add(id,pts,material,surface,z,**k): P.append({'id':id,'pts':pts,'material':material,'surface':surface,'z':z,**k})
add('well',sh([[FX-430,R-20]]+[[round(FX+math.cos(a)*430),round(R+math.sin(a)*430)] for a in [math.pi*k/14 for k in range(14,-1,-1)]]+[[FX+430,R-20]]),'shadow','flat',2)
add('well2',sh([[RX-430,R-20]]+[[round(RX+math.cos(a)*430),round(R+math.sin(a)*430)] for a in [math.pi*k/14 for k in range(14,-1,-1)]]+[[RX+430,R-20]]),'shadow','flat',2)
add('under',sh([[300,420],[1300,420],[1300,560],[300,560]]),'black','flat',1)
add('under2',sh([[4050,380],[4450,380],[4450,520],[4050,520]]),'black','flat',1)
# grille shell: leaning back, chrome surround with a dark core
add('grille',sh([[150,585],[128,700],[150,1000],[195,1195],[235,1290],[300,1300],[300,585]]),'black','flat',15,slot='grille')
add('grilleShell',sh([[128,700],[150,1000],[195,1195],[235,1290],[262,1290],[220,1190],[176,1000],[154,700]]),'chrome','side',15.5,slot='grille')
# the body shell from radiator to tail
body=[[300,560],[300,900],[300,1180],[300,1300],[340,1320],[700,1342],[1200,1352],[1600,1378],[1668,1400],[1740,1560],[1815,1730],[1880,1810],[1990,1862],[2200,1893],[2500,1907],[3000,1905],[3300,1890],[3480,1856],[3660,1776],[3780,1672],[3880,1520],[3960,1372],[4040,1290],[4120,1250],[4200,1120],[4290,900],[4370,760],[4420,700],[4455,640],[4440,560],[4300,440],[4150,400],[3300,300],[1760,300],[1500,400],[1300,480]]
add('body',sh(body),'paint','side',10,bevel=5,cut=[{'x':FX,'z':R,'r':ARCH},{'x':RX,'z':R,'r':ARCH}])
# glass: windscreen seen edge-on, door window with its vent pane, rear quarter window
add('glass',[[1700,1415],[1745,1400],[1890,1745],[1850,1770]],'glass','side',12,clip='body')
add('glass2',[[1880,1385],[2650,1372],[2685,1405],[2685,1640],[2625,1690],[2070,1690],[1985,1650],[1850,1420]],'glass','side',12,clip='body')
add('glass3',[[2830,1405],[2870,1372],[3520,1372],[3560,1415],[3545,1490],[3420,1610],[3260,1675],[2875,1690],[2830,1650]],'glass','side',12,clip='body')
add('inside',sh([[2060,1380],[2105,1380],[2115,1690],[2070,1690]]),'paint','side',13,clip='glass2')
add('board',sh([[1790,290],[3310,290],[3310,385],[1790,385]]),'rubber','flat',19)
add('apron',sh([[1790,250],[3310,250],[3310,292],[1790,292]]),'black','flat',18)
ff=[[140,430],[138,560],[175,700],[250,830],[380,930],[560,990],[783,1005],[980,985],[1150,915],[1330,790],[1520,620],[1700,480],[1790,420],[1790,288],[1560,288],[1300,330],[330,380]]
add('fenderF',ff,'paint','fender',20,cut=[{'x':FX,'z':R,'r':ARCH-15}])
fr=[[3290,290],[3285,520],[3325,760],[3430,905],[3590,985],[3760,1005],[3920,960],[4080,850],[4230,690],[4370,520],[4455,430],[4440,362],[4150,352]]
add('fenderR',fr,'paint','fender',20,cut=[{'x':RX,'z':R,'r':ARCH-15}])
# bumpers on their irons
add('bumperIron',sh([[95,470],[300,470],[300,520],[95,520]]),'black','flat',24,slot='bumperF')
add('bumper',[[0,405],[70,395],[112,430],[118,560],[80,615],[20,620],[0,590]],'chrome','side',25,slot='bumperF',bevel=3)
add('bumperGuard',sh([[30,560],[75,560],[75,700],[30,700]]),'chrome','side',25.5,slot='bumperF',bevel=2)
add('bumperIron2',sh([[4390,440],[4570,440],[4570,490],[4390,490]]),'black','flat',24,slot='bumperR')
add('bumper2',[[4650,365],[4580,355],[4545,390],[4540,520],[4575,580],[4635,585],[4650,555]],'chrome','side',25,slot='bumperR',bevel=3)
add('bumperGuard2',sh([[4580,520],[4625,520],[4625,650],[4580,650]]),'chrome','side',25.5,slot='bumperR',bevel=2)
# lamps: a bucket faired into the catwalk, a small stalk lamp at the tail
add('lampShell',ell(262,1000,95,105),'paint','fender',27,slot='lamp',rigid=True,bevel=6)
add('lampRim',ell(222,1000,52,98),'chrome','fender',27.5,slot='lamp',rigid=True,bevel=2)
add('lens',ell(212,1000,34,80),'lens','flat',28,slot='lamp',rigid=True)
add('tailStalk',sh([[4400,650],[4460,650],[4460,690],[4400,690]]),'black','flat',27,slot='tail',rigid=True)
add('bezel',ell(4462,690,34,62),'chrome','fender',28,slot='tail',rigid=True,bevel=2)
add('tailLens',ell(4470,690,20,46),'lensR','flat',28.5,slot='tail',rigid=True)
add('mascot',sh([[205,1322],[330,1345],[330,1372],[250,1362],[205,1345]]),'chrome','side',30,rigid=True,bevel=1.5)
F=[{'kind':'seam','pts':[[1615,560,1],[1640,1000,1],[1668,1398,1]]},                        # hood meets cowl
   {'kind':'seam','pts':[[330,1300,1],[900,1310,1],[1640,1300,1]]},                         # hood top hinge line
   {'kind':'seam','pts':[[1725,560,1],[1725,1330,1],[1800,1700,1]]},                        # door front
   {'kind':'seam','pts':[[1725,560,1],[2775,540,1]]},{'kind':'seam','pts':[[3960,1372,1],[4060,1180,1],[4140,1000,1],[4300,820,1]]},
   {'kind':'seam','pts':[[2775,540,1],[2775,1800,1]]},                                      # door rear
   {'kind':'seam','pts':[[1880,1810,1],[2200,1845,1],[3000,1855,1],[3440,1805,1],[3700,1650,1]],'lit':True},   # drip rail
   {'kind':'trim','pts':[[262,1255,1],[900,1280,1],[1640,1290,1]],'width':2},
   {'kind':'trim','pts':[[1740,1262,1],[2775,1262,1],[3500,1270,1],[3900,1305,1]],'width':2},
   {'kind':'trim','pts':[[740,1078,1],[1500,1078,1]],'width':1},{'kind':'trim','pts':[[1060,975,1],[1500,975,1]],'width':1},
   {'kind':'louvres','x0':165,'x1':290,'z0':640,'z1':1160,'n':6,'slant':-0.1},
   {'kind':'trim','pts':[[790,1150,1],[1500,1150,1]],'width':1},{'kind':'trim','pts':[[790,1100,1],[1500,1100,1]],'width':1},{'kind':'trim','pts':[[790,1050,1],[1500,1050,1]],'width':1},
   {'kind':'handle','at':[2560,1135],'len':190},
   {'kind':'hinge','at':[1728,1250]},{'kind':'hinge','at':[1728,700]}]
W=[{'x':FX,'r':R,'rim':0.6,'style':'disc','spokes':0,'rimMaterial':'paint','zOrder':5},{'x':RX,'r':R,'rim':0.6,'style':'disc','spokes':0,'rimMaterial':'paint','zOrder':5}]
d={'id':'sedan36','name':'two-door sedan, 1936','year':1936,'length':4650,'height':1908,'paint':'#0f3322','paint2':'#0f3322','panels':P,'features':F,'wheels':W,'frame':'reveal',
   'marks':{'fx':FX,'rx':RX,'r':R,'gap':ARCH,'cowl':1668,'cab':3960,'belt':1262,'roof':1907}}
json.dump(d,open(sys.argv[1],'w'),indent=0); print(len(P),'panels',sum(len(p['pts']) for p in P),'points',len(F),'features')
