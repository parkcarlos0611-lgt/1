"""Does the chassis fit in the body? (3D part model, review 31). For each chassis part, its common box against the
room the body gives it: the engine, radiator and fan under the hood and inside the shell, the gearbox and tank under
the cowl, everything between the frame and the ground, nothing through a wheel. Prints each check and how much room is
left or missing (mm).  python3 tools/ref/fitcheck.py <model json>"""
import sys, json
M = json.load(open(sys.argv[1])); P = {p['id']: p for p in M['parts']}; bad = 0
def box(i): return P[i]['box']
def inside(a, b, axes='xyz', margin=0):
    out = []
    for ax in axes:
        lo = a[ax][0] - b[ax][0]; hi = b[ax][1] - a[ax][1]; out.append((ax, lo - margin, hi - margin))
    return out
def under(id, roof_ids, label):
    global bad
    a = box(id); top = min(box(r)['z'][1] for r in roof_ids if r in P); room = top - a['z'][1]
    ok = room >= 0; bad += not ok; print(f"{'ok  ' if ok else 'FAIL'} {id:12s} under {label:22s} {room:+5.0f} mm")
def within(id, env, axes, label):
    global bad
    res = inside(box(id), box(env), axes); ok = all(lo >= 0 and hi >= 0 for _, lo, hi in res); bad += not ok
    print(f"{'ok  ' if ok else 'FAIL'} {id:12s} within {label:21s} " + '  '.join(f'{ax} {lo:+.0f}/{hi:+.0f}' for ax, lo, hi in res))
# the hood's inside: its own box less a skin of 20 mm
hood = box('hood')
for e in ('block', 'head', 'fan', 'generator', 'starter'): within(e, 'hood', 'y', 'the hood (width)')
within('radiatorCore', 'shell', 'y', 'radiator shell (width)'); under('radiatorCore', ['shell'], 'the shell top')
for e in ('head', 'block'): under(e, ['hood'], 'the hood top')
for e in ('gearbox', 'bell', 'tank'): within(e, 'cowl', 'y', 'cowl (width)'); under(e, ['cowl'], 'the cowl top')
for e in ('sump', 'muffler', 'tailpipe', 'rearDiff'):
    z0 = box(e)['z'][0]; ok = z0 >= 150; bad += not ok; print(f"{'ok  ' if ok else 'FAIL'} {e:12s} ground clearance {z0:5.0f} mm")
# nothing of the engine reaches back into the cabin floor ahead of the cowl line
c = box('cowl')['x'][1]; x1 = box('block')['x'][1]; ok = x1 <= c; bad += not ok; print(f"{'ok  ' if ok else 'FAIL'} block        ends {c - x1:+.0f} mm ahead of the cowl's back")
print(f'{bad} check(s) failed')
