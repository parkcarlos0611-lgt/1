"""One command to add a fighter's face from a full-body flat illustration:
  python3 tools/add_fighter.py "<exact name in the game>" <key> <image.png> [skin #hex]
Builds assets/cutout/<key>/{head.png,neck.png,head2.json} (head + bending neck, blink / hit-mouth / bruise / blood geometry, lid colour),
registers the fighter in src/Cutout.js (CURATED) and renders the check sheet docs/face_check_<key>.png (needs the dev server on :8765)."""
import sys,os,subprocess,re
name,key,img=sys.argv[1:4];root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out=os.path.join(root,'assets/cutout',key);os.makedirs(out,exist_ok=True)
subprocess.check_call([sys.executable,os.path.join(root,'tools/build_head2.py'),key,img,out])
cj=os.path.join(root,'src/Cutout.js');s=open(cj).read()
if "'%s':{cutout:'%s'"%(name,key) not in s:
    skin=sys.argv[4] if len(sys.argv)>4 else '#c98c57'
    ent="  '%s':{cutout:'%s',skin:'%s',shorts:'#1b1b1e',glove:'#17171a',headK:.132,headDown:.014,tat:''},\n"%(name,key,skin)
    i=s.index("if(typeof lookFor==='function'){");s=s[:i].rstrip()
    assert s.endswith("};");s=s[:-2].rstrip()+",\n"+ent.rstrip().rstrip(',')+"};\n"+open(cj).read()[i:]
    open(cj,'w').write(s)
print('done; check:',"node tools/face_check.js http://localhost:8765/index.html docs/face_check_%s.png '%s'"%(key,name))
