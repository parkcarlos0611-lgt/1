# Authoring source of data/bodies/sedan36.json, measured off a reference sheet (drawn at 10 mm/px) (plan: review 15, first-build manner).
# python3 tools/ref/sedan36.py data/bodies/sedan36.json
import json, math, sys
def ell(cx,cz,rx,rz,n=20): return [[round(cx+math.cos(k/n*6.2832)*rx), round(cz+math.sin(k/n*6.2832)*rz)] for k in range(n)]
def sh(p): return [[x,z,1] for x,z in p]
FX,RX,R,ARCH=783,3715,400,455
P=[]
def add(id,pts,material,surface,z,**k): P.append({'id':id,'pts':pts,'material':material,'surface':surface,'z':z,**k})
add('well',sh([[FX-470,R-140]]+[[round(FX+math.cos(a)*470),round(R+math.sin(a)*470)] for a in [math.pi*k/14 for k in range(14,-1,-1)]]+[[FX+470,R-140]]),'shadow','flat',2)
add('well2',sh([[RX-470,R-140]]+[[round(RX+math.cos(a)*470),round(R+math.sin(a)*470)] for a in [math.pi*k/14 for k in range(14,-1,-1)]]+[[RX+470,R-140]]),'shadow','flat',2)
add('under',sh([[300,420],[1300,420],[1300,560],[300,560]]),'black','flat',1)
add('apronF',sh([[1150,290],[1790,290],[1790,380],[1150,380]]),'shadow','flat',2)
add('under2',sh([[4050,380],[4450,380],[4450,520],[4050,520]]),'black','flat',1)
# grille shell: leaning back, chrome surround with a dark core
add('grille',sh([[215,578],[250,800],[314,1000],[382,1245],[420,1300],[480,1300],[410,1000],[345,800],[310,578]]),'black','flat',15,slot='grille',detail={'kind':'grille','pitch':35,'shell':20})
# the body shell from radiator to tail
body=[[310,560],[345,800],[410,1000],[460,1200],[480,1300],[520,1325],[700,1342],[1200,1352],[1600,1378],[1668,1400],[1710,1560],[1780,1730],[1860,1815],[1990,1862],[2200,1893],[2500,1907],[3000,1905],[3300,1890],[3480,1856],[3660,1776],[3780,1672],[3880,1520],[3930,1372],[4000,1290],[4080,1240],[4160,1110],[4250,900],[4340,760],[4420,700],[4455,640],[4440,560],[4300,440],[4150,400],[3300,300],[1760,300],[1500,400],[1300,480]]
add('body',sh(body),'paint','side',10,bevel=5,cut=[{'x':FX,'z':R,'r':ARCH},{'x':RX,'z':R,'r':ARCH}])
# glass: windscreen seen edge-on, door window with its vent pane, rear quarter window
add('glass',[[1680,1415],[1720,1400],[1860,1745],[1825,1775]],'glass','side',12,clip='body')
add('glass2',[[1880,1385],[2650,1372],[2685,1405],[2685,1640],[2625,1690],[2070,1690],[1985,1650],[1850,1420]],'glass','side',12,clip='body')
add('glass3',[[2830,1405],[2870,1372],[3520,1372],[3560,1415],[3545,1490],[3420,1610],[3260,1675],[2875,1690],[2830,1650]],'glass','side',12,clip='body')
add('inside',sh([[2060,1380],[2105,1380],[2115,1690],[2070,1690]]),'paint','side',13,clip='glass2')
add('board',sh([[1790,290],[3310,290],[3310,385],[1790,385]]),'rubber','flat',19,slot='board',detail={'kind':'ribs','pitch':25})
add('apron',sh([[1790,250],[3310,250],[3310,292],[1790,292]]),'black','flat',18,slot='board')
ff=[[140,430],[138,560],[175,700],[250,830],[380,930],[560,990],[783,1005],[980,985],[1150,915],[1330,790],[1520,620],[1700,480],[1790,420],[1790,288],[1560,288],[1300,330],[330,380]]
add('fenderF',ff,'paint','fender',20,slot='fenderF',cut=[{'x':FX,'z':R,'r':ARCH-15}])
fr=[[3290,290],[3285,520],[3325,760],[3430,905],[3590,985],[3760,1005],[3920,960],[4080,850],[4230,690],[4370,520],[4455,430],[4440,362],[4150,352]]
add('fenderR',fr,'paint','fender',20,slot='fenderR',cut=[{'x':RX,'z':R,'r':ARCH-15}])
# bumpers on their irons
add('bumperIron',sh([[95,470],[300,470],[300,520],[95,520]]),'black','flat',24,slot='bumperF')
add('bumper',[[0,410],[20,392],[205,400],[205,505],[20,510],[0,495]],'chrome','side',25,slot='bumperF',bevel=3,detail={'kind':'bar'})
add('bumperGuard',[[30,343],[110,343],[118,600],[95,627],[40,627],[20,600]],'chrome','side',25.5,slot='bumperF',bevel=2)
add('bumperIron2',sh([[4390,440],[4570,440],[4570,490],[4390,490]]),'black','flat',24,slot='bumperR')
add('bumper2',[[4650,410],[4630,392],[4445,400],[4445,505],[4630,510],[4650,495]],'chrome','side',25,slot='bumperR',bevel=3,detail={'kind':'bar'})
add('bumperGuard2',[[4540,343],[4620,343],[4630,600],[4610,627],[4555,627],[4532,600]],'chrome','side',25.5,slot='bumperR',bevel=2)
# lamps: a bucket faired into the catwalk, a small stalk lamp at the tail
add('lampShell',ell(520,1010,110,90),'paint','fender',27,slot='lamp',rigid=True,bevel=6)
add('lampRim',ell(455,1010,50,95),'chrome','fender',27.5,slot='lamp',rigid=True,bevel=2)
add('lens',ell(447,1010,30,75),'lens','flat',28,slot='lamp',rigid=True,detail={'kind':'flutes','pitch':20})
add('tailStalk',sh([[4400,650],[4460,650],[4460,690],[4400,690]]),'black','flat',27,slot='tail',rigid=True)
add('bezel',ell(4462,690,34,62),'chrome','fender',28,slot='tail',rigid=True,bevel=2)
add('tailLens',ell(4470,690,20,46),'lensR','flat',28.5,slot='tail',rigid=True)
add('mascot',sh([[392,1323],[666,1335],[660,1372],[450,1365],[392,1345]]),'chrome','side',30,rigid=True,bevel=1.5)
F=[{'kind':'seam','pts':[[1615,560,1],[1640,1000,1],[1668,1398,1]]},                        # hood meets cowl
   {'kind':'seam','pts':[[330,1300,1],[900,1310,1],[1640,1300,1]]},                         # hood top hinge line
   {'kind':'seam','pts':[[1725,560,1],[1725,1330,1],[1800,1700,1]]},                        # door front
   {'kind':'seam','pts':[[1725,560,1],[2775,540,1]]},{'kind':'seam','pts':[[3960,1372,1],[4060,1180,1],[4140,1000,1],[4300,820,1]]},
   {'kind':'seam','pts':[[2775,540,1],[2775,1800,1]]},                                      # door rear
   {'kind':'seam','pts':[[1880,1810,1],[2200,1845,1],[3000,1855,1],[3440,1805,1],[3700,1650,1]],'lit':True},   # drip rail
   {'kind':'trim','pts':[[588,1186,1],[1640,1186,1],[2775,1190,1],[3700,1200,1],[4000,1215,1]],'width':1},
   {'kind':'trim','pts':[[1740,1262,1],[2775,1262,1],[3500,1270,1],[3900,1305,1]],'width':2},
   {'kind':'louvres','x0':745,'x1':1490,'z0':1000,'z1':1140,'n':18,'slant':0},
   {'kind':'trim','pts':[[745,1068,1],[1490,1068,1]],'width':1},{'kind':'trim','pts':[[1050,985,1],[1470,985,1]],'width':1},
   {'kind':'highlight','pts':[[600,1268,1],[1200,1272,1],[1600,1278,1]],'width':1},
   {'kind':'highlight','pts':[[330,800,1],[600,925,1],[900,985,1],[1200,890,1],[1480,700,1],[1690,470,1]],'width':3},
   {'kind':'highlight','pts':[[3330,700,1],[3450,880,1],[3620,975,1],[3800,985,1],[3980,925,1],[4180,780,1],[4380,560,1]],'width':3},
   {'kind':'highlight','pts':[[2000,1850,1],[2500,1878,1],[3200,1868,1],[3500,1820,1]],'width':1},
   {'kind':'interior','belt':1385,'seats':[2350,3150],'wheel':1960},
   {'kind':'handle','at':[2560,1135],'len':190},
   {'kind':'hinge','at':[1728,1250]},{'kind':'hinge','at':[1728,700]}]
W=[{'x':x,'r':R,'rim':0.56,'style':'disc','spokes':0,'rimMaterial':'paint','zOrder':5,'cap':0.56,'capRings':1} for x in (FX,RX)]
d={'id':'sedan36','name':'two-door sedan, 1936','year':1936,'length':4650,'height':1908,'paint':'#0f3322','paint2':'#0f3322','panels':P,'features':F,'wheels':W,'frame':'chrome',
   'marks':{'fx':FX,'rx':RX,'r':R,'gap':ARCH,'cowl':1668,'cab':3960,'belt':1262,'roof':1907}}
json.dump(d,open(sys.argv[1],'w'),indent=0); print(len(P),'panels',sum(len(p['pts']) for p in P),'points',len(F),'features')
