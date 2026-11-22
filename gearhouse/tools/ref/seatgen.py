"""Seats for an open car (review 69): the tops of the seats seen in the cockpit, made from the car's own cockpit part
(its place and size in each view) by one procedure, in the car's own leather colour. Nothing else inside is drawn (no
steering wheel, dashboard or levers). The seats are drawn only where the cockpit shows (clip), so they never stand
outside the opening the sheet gives.

  python3 tools/ref/seatgen.py <model json> [--style bucket|bench] [--color #8a4a26] [--out <json>]

bucket: two separate seats, a gap between them (sports cars); bench: one seat across (roadsters, tourers)."""
import sys, json, argparse
ap = argparse.ArgumentParser(); ap.add_argument('model'); ap.add_argument('--style', default='bucket'); ap.add_argument('--color', default='#8a4a26'); ap.add_argument('--out')
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
rows = ([('seatL', 0.53, 0.94), ('seatR', 0.06, 0.47)] if a.style == 'bucket' else [('seat', 0.06, 0.94)])
for sid, v0, v1 in rows:
    top = rrect(0.28, 0.96, v0, v1, 0.22)
    pleats = [{'kind': 'seam', 'pts': [[0.36, v0 + (v1 - v0) * f], [0.74, v0 + (v1 - v0) * f]]} for f in ((0.25, 0.5, 0.75) if a.style == 'bucket' else (0.15, 0.3, 0.45, 0.55, 0.7, 0.85))]
    feats = {'top': [{'kind': 'seam', 'pts': [[0.76, v0 + 0.02], [0.76, v1 - 0.02]]}, *pleats, {'kind': 'highlight', 'pts': [[0.86, v0 + 0.04], [0.86, v1 - 0.04]], 'width': 1}],
             'side': [{'kind': 'highlight', 'pts': [[0.74, 0.9], [0.86, 0.97]], 'width': 1}, {'kind': 'seam', 'pts': [[0.36, 0.33], [0.62, 0.35]]}]}
    outl = {'top': top}; sheet = {'top': ck['sheet']['top']}
    if sid != 'seatR' and 'side' in ck['sheet']: outl['side'] = back_side(); sheet['side'] = ck['sheet']['side']
    if 'rear' in ck['sheet']:   # from behind: the back's rolled top over the tail, in its half
        outl['rear'] = rrect(1 - v1, 1 - v0, 0.0, 1.0, 0.3); sheet['rear'] = ck['sheet']['rear']
    # the back's rolled top seen from above: the same leather a shade darker, across the rear of the seat
    dark = '#%02x%02x%02x' % tuple(max(0, int(int(a.color[i:i + 2], 16) * 0.72)) for i in (1, 3, 5))
    seats.append({'id': sid + 'Back', 'element': 'seat', 'material': 'wood', 'surface': 'fender', 'box': json.loads(json.dumps(ck['box'])), 'sheet': {'top': ck['sheet']['top']}, 'pair': False,
                  'outlines': {'top': rrect(0.78, 0.96, v0 + 0.01, v1 - 0.01, 0.4)}, 'on': sid, 'lift': 2, 'clip': sid, 'color': dark})
    seats.append({'id': sid, 'element': 'seat', 'material': 'wood', 'surface': 'fender', 'box': json.loads(json.dumps(ck['box'])), 'sheet': sheet, 'pair': False,
                  'outlines': outl, 'features': feats, 'on': ck['id'], 'lift': 1, 'clip': ck['id'], 'color': a.color})
seats.sort(key=lambda q: q['id'].endswith('Back')); m['parts'] += seats
json.dump(m, open(a.out or a.model, 'w'), indent=1); print(len(seats), 'seats on', ck['id'], a.style, a.color)
