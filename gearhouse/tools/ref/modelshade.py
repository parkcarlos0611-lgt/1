"""Improvement G (review 28): how light falls on each painted part, in each view, read off that view of the sheet and
kept with the part in the model (part.shade[view]). For every view: the view's design (from tools/ref/modelviews.ts)
is captured against the sheet (capture.py) and shade.py reads a grid of tone steps per painted panel.
  python3 tools/ref/modelshade.py <model json> <views dir> <modelviews out dir>"""
import sys, os, json, subprocess, cv2
M, V, D = sys.argv[1:4]; m = json.load(open(M)); here = os.path.dirname(__file__); tmp = os.path.join(D, '_shade'); os.makedirs(tmp, exist_ok=True)
for view, key, src in (('left', 'side', 'left'), ('front', 'front', 'front'), ('rear', 'rear', 'rear'), ('top', 'top', 'top')):
    dj = f'{D}/{m["id"]}_{view}.json'; d = json.load(open(dj))
    png = f'{tmp}/{view}.png'; cv2.imwrite(png, cv2.resize(cv2.imread(f'{V}/v_{src}.png', cv2.IMREAD_UNCHANGED), (round(d['length'] / 10), round(d['height'] / 10)), interpolation=cv2.INTER_AREA))
    roles = subprocess.run(['npx', 'tsx', f'{here}/roles.ts', dj], capture_output=True, text=True, check=True).stdout; open(f'{tmp}/{view}.roles.json', 'w').write(roles)
    subprocess.run(['python3', f'{here}/capture.py', png, f'{tmp}/{view}.roles.json', f'{tmp}/{view}.map.json'], check=True, capture_output=True)
    subprocess.run(['python3', f'{here}/shade.py', png, f'{tmp}/{view}.roles.json', f'{tmp}/{view}.map.json', dj], check=True, capture_output=True)
    got = {p['id'].rstrip('~'): p['shade'] for p in json.load(open(dj))['panels'] if 'shade' in p}
    for p in m['parts']:
        if p['id'] in got: p.setdefault('shade', {})[key] = got[p['id']]
    print(view, len(got), 'parts shaded')
json.dump(m, open(M, 'w'), indent=0)
