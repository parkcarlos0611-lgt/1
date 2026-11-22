"""Seats for an open car (review 69): the tops of the seats seen in the cockpit, made from the car's own cockpit part
(its place and size in each view) by one procedure, in the car's own leather colour. Nothing else inside is drawn (no
steering wheel, dashboard or levers). The seats are drawn only where the cockpit shows (clip), so they never stand
outside the opening the sheet gives.

  python3 tools/ref/seatgen.py <model json> [--style bucket|bench] [--color #8a4a26] [--out <json>]

bucket: two separate seats, a gap between them (sports cars); bench: one seat across (roadsters, tourers)."""
import sys, json, argparse
ap = argparse.ArgumentParser(); ap.add_argument('model'); ap.add_argument('--style', default='bucket'); ap.add_argument('--color', default='#7a4426'); ap.add_argument('--out')
a = ap.parse_args(); m = json.load(open(a.model))
ck = next((p for p in m['parts'] if p['element'] == 'cockpit' and p['id'] == 'cockpit'), None) or next(p for p in m['parts'] if p['element'] == 'cockpit')
m['parts'] = [p for p in m['parts'] if p['element'] != 'seat']

def rrect(u0, u1, v0, v1, r=0.18, n=4):
    """a rectangle with rounded corners in the unit box; r as a share of the shorter side"""
    import math; ru = (u1 - u0) * r if (u1 - u0) < (v1 - v0) else (v1 - v0) * r; rv = ru
    out = []
    for cx, cy, a0 in ((u1 - ru, v1 - rv, 0), (u0 + ru, v1 - rv, 90), (u0 + ru, v0 + rv, 180), (u1 - ru, v0 + rv, 270)):
        for k in range(n + 1): t = math.radians(a0 + 90 * k / n); out.append([round(cx + math.cos(t) * ru, 4), round(cy + math.sin(t) * rv, 4), 0])
    return out
def back_side():
    """the seat seen from the side, the front of the car to the left (u 0): a low cushion and a back leaning rearward with a rolled top"""
    return [[0.30, 0.0, 1], [0.30, 0.28, 0], [0.36, 0.34, 0], [0.60, 0.36, 0], [0.66, 0.55, 0], [0.70, 0.80, 0], [0.74, 0.94, 0], [0.80, 1.0, 0],
            [0.88, 0.99, 0], [0.93, 0.92, 0], [0.92, 0.60, 0], [0.90, 0.0, 1]]
seats = []
# each seat as the period sheets draw it from above: a square cushion with fore-and-aft pleats (a dark tuck with a lit
# edge beside it), and behind it the back as its own rounded bolster, the two parted by a dark line; from the side the
# back stands up with its rolled top lit; from behind, the backs' rolled tops show over the tail
rows = ([('seatL', 0.515, 0.975), ('seatR', 0.025, 0.485)] if a.style == 'bucket' else [('seat', 0.03, 0.97)])
npl = 6 if a.style == 'bucket' else 10
def part(id, outl, sheet, feats, surface, on, lift, color):
    return {'id': id, 'element': 'seat', 'material': 'wood', 'surface': surface, 'box': json.loads(json.dumps(ck['box'])), 'sheet': sheet, 'pair': False,
            'outlines': outl, 'features': feats, 'on': on, 'lift': lift, 'clip': ck['id'], 'color': color}
light = '#%02x%02x%02x' % tuple(min(255, int(int(a.color[i:i + 2], 16) * 1.12 + 8)) for i in (1, 3, 5))
for sid, v0, v1 in rows:
    dv = v1 - v0
    cush = rrect(0.20, 0.77, v0 + dv * 0.04, v1 - dv * 0.04, 0.2)
    pleats = []
    for k in range(1, npl):
        v = v0 + dv * (0.04 + 0.92 * k / npl)
        pleats.append({'kind': 'seam', 'pts': [[0.23, v], [0.75, v]], 'lit': True})
        vm = v - dv * 0.46 / npl; pleats.append({'kind': 'highlight', 'pts': [[0.26, vm], [0.72, vm]], 'width': 1})   # each roll lit along its crown
    cf = {'top': pleats + [{'kind': 'highlight', 'pts': [[0.215, v0 + dv * 0.08], [0.215, v1 - dv * 0.08]], 'width': 1}]}
    seats.append(part(sid, {'top': cush}, {'top': ck['sheet']['top']}, cf, 'side', ck['id'], 1, a.color))
    back = rrect(0.75, 0.985, v0, v1, 0.45)
    bf = {'top': [{'kind': 'highlight', 'pts': [[0.80, v0 + dv * 0.12], [0.80, v1 - dv * 0.12]], 'width': 1}]}
    outl = {'top': back}; sheet = {'top': ck['sheet']['top']}
    if sid != 'seatR' and 'side' in ck['sheet']:
        outl['side'] = back_side(); sheet['side'] = ck['sheet']['side']
        bf['side'] = [{'kind': 'highlight', 'pts': [[0.74, 0.9], [0.80, 0.98], [0.88, 0.97]], 'width': 1}, {'kind': 'seam', 'pts': [[0.36, 0.33], [0.62, 0.35]], 'lit': True}]
    if 'rear' in ck['sheet']:
        outl['rear'] = rrect(1 - v1, 1 - v0, 0.0, 1.0, 0.35); sheet['rear'] = ck['sheet']['rear']
        bf['rear'] = [{'kind': 'highlight', 'pts': [[1 - v1 + dv * 0.15, 0.8], [1 - v0 - dv * 0.15, 0.8]], 'width': 1}]
    seats.append(part(sid + 'Back', outl, sheet, bf, 'fender', sid, 2, light))
m['parts'] += seats
json.dump(m, open(a.out or a.model, 'w'), indent=1); print(len(seats), 'seats on', ck['id'], a.style, a.color)
