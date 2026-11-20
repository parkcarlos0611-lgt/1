"""Step 4 of review 29: each part takes the colour the sheet shows it in (the middle tone of its tile from
tools/ref/tiles.py, the side view first), instead of one paint colour and fixed ramps for the whole car. Chrome,
glass and lenses keep the material's own drawing.  python3 tools/ref/partcolours.py <model json> <tiles json>"""
import sys, json
n = 0
M = json.load(open(sys.argv[1])); T = json.load(open(sys.argv[2])); OWN = {'paint2', 'canvas', 'wood'}   # the body colour is the car's paint (measured once on the side view); parts in shadow or tiny parts give no reliable colour
for p in M['parts']:
    if p['material'] not in OWN: continue
    for key in ('side', 'front', 'rear', 'top'):
        t = T.get(f"{p['id']}.{key}")
        if not t or not t['colours'] or p.get('on'): continue
        # the middle tone of the part, not its commonest (on a shaded panel that is the shadow): the colour whose
        # lightness is the weighted median of the part's colours
        L = lambda c: 0.299 * int(c[1:3], 16) + 0.587 * int(c[3:5], 16) + 0.114 * int(c[5:7], 16)
        cs = sorted(t['colours'], key=lambda c: L(c[0])); acc = 0
        for c, f in cs:
            acc += f
            if acc >= 0.5: p['color'] = c; n += 1; break
        break
json.dump(M, open(sys.argv[1], 'w'), indent=0); print(n, 'parts take their colour from the sheet')
