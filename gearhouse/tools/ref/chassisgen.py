"""The frame and drive-line generator (review 64). A car's running gear is not drawn by hand: it is built from the car's
specification (data/cars/specs.json: engine kind, layout, bore and stroke; drive; springs; wheelbase) and its layout as
the sheet's under view shows it (data/cars/layout.json: where the rails run and how wide, where the cross members sit,
where the engine's sump starts and ends, as distances from the front axle in mm). The frame is shared by the exterior
and the chassis views (one source); engine, drive line and differential are the chassis layer.

  - frame: a pair of channel rails, narrow at the front, widening behind the engine, kicked up over the rear axle;
    cross members where the under view shows them. Plan, side, front and rear outlines all from the same numbers.
  - engine (a volume for now; its drawing waits for the reference pictures): length from the cylinders and bore
    (cylinder pitch = bore + web), height and width from the stroke and the valve gear, standing on the frame behind the
    radiator; gearbox kept as figures only (not drawn).
  - drive line: torque tube or open shaft from the gearbox's end to the differential; the differential on the rear
    axle.

  python3 tools/ref/chassisgen.py <model json> <car id> <out json>
"""
import sys, os, json, math, copy
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SPECS = json.load(open(os.path.join(ROOT, 'data/cars/specs.json')))['cars']
LAYOUT = json.load(open(os.path.join(ROOT, 'data/cars/layout.json')))['cars']
CYL = {'I4': 4, 'I6': 6, 'I8': 8}
RAIL_W, RAIL_D = 60, 120            # channel width (plan) and depth (side), mm


def unit(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; b = [min(xs), max(xs), min(ys), max(ys)]
    return b, [[round((x - b[0]) / max(1, b[1] - b[0]), 4), round((y - b[2]) / max(1, b[3] - b[2]), 4), 1] for x, y in pts]


def part(pid, element, material, views, *, layer=None, pair=False, surface='flat', y=None, feats=None):
    """views: {view: [[a, b], ...] in that view's axes (side x,z; front/rear y,z; top x,y)}"""
    p = {'id': pid, 'element': element, 'material': material, 'surface': surface, 'pair': pair, 'outlines': {}, 'sheet': {}}
    if layer: p['layer'] = layer
    AX = {'side': ('x', 'z'), 'front': ('y', 'z'), 'rear': ('y', 'z'), 'top': ('x', 'y')}; got = {}
    for v, pts in views.items():
        b, o = unit(pts); p['outlines'][v] = o; p['sheet'][v] = [round(t) for t in b]
        nu = lambda q: [round((q[0] - b[0]) / max(1, b[1] - b[0]), 4), round((q[1] - b[2]) / max(1, b[3] - b[2]), 4)]
        for f in (feats or {}).get(v, []):
            g = dict(f)
            if 'pts' in g: g['pts'] = [nu(q) for q in g['pts']]
            if 'at' in g: g['at'] = nu(g['at'])
            p.setdefault('features', {}).setdefault(v, []).append(g)
        a1, a2 = AX[v]; got.setdefault(a1, []).append(b[0:2]); got.setdefault(a2, []).append(b[2:4])
    box = {}
    for ax in 'xyz':
        if ax in got: g = got[ax]; box[ax] = [round(sum(t[0] for t in g) / len(g)), round(sum(t[1] for t in g) / len(g))]
    if 'y' not in box or y is not None: box['y'] = y or [-100, 100]
    if pair: box['y'] = [abs(box['y'][0]), abs(box['y'][1])] if box['y'][0] >= 0 else [0, max(abs(box['y'][0]), abs(box['y'][1]))]
    p['box'] = box; return p


def engine_size(e):
    """outside dimensions of a side-valve, overhead-valve or sleeve-valve inline engine, mm (block with head, sump and
    bell housing; a period engine's proportions)"""
    n = CYL[e['layout']]; pitch = e['bore'] + 24; length = n * pitch + 170
    height = e['stroke'] * 2.6 + (230 if e['kind'] == 'ohv' else 170 if e['kind'] == 'sleeve' else 120)
    width = e['bore'] * 2.2 + 120
    return length, height, width


def build(m, cid):
    s, L = SPECS[cid], LAYOUT[cid]
    FX, RX = m['wheels'][0]['x'], m['wheels'][1]['x']; R = m['wheels'][0]['r']
    X = lambda d: FX + d                                     # layout distances are from the front axle
    zr = L.get('railZ', R + 60)                              # the rails' underside over the axles' height
    kick = L.get('kickup', 110) if s['springs'] == 'semi' else L.get('kickup', 40)
    keep = [p for p in m['parts'] if p.get('layer') != 'chassis' and p['element'] != 'frame' and p['id'] not in ('leafF', 'leafR')]   # what this generator makes is made again
    out = []
    # ---- the frame: one rail (mirrored), its plan line through the layout's half-widths
    xs = [X(L['front']), X(L['narrowEnd']), X(L['wideFrom']), X(L['rear'])]; hw = [L['hwFront'], L['hwFront'], L['hwMid'], L['hwRear']]
    top = [[x, h + RAIL_W / 2] for x, h in zip(xs, hw)] + [[x, h - RAIL_W / 2] for x, h in reversed(list(zip(xs, hw)))]
    # side: straight, a gentle horn at the front, kicked up over the rear axle
    kx0, kx1 = RX - 520, RX + 160
    prof = [(xs[0], zr + 30), (X(0) + 250, zr), (kx0, zr), (kx0 + 200, zr + kick), (kx1, zr + kick), (xs[3], zr + kick)]
    side = [[x, z] for x, z in prof] + [[x, z + RAIL_D] for x, z in reversed(prof)]
    sec = lambda h: [[h - RAIL_W / 2, zr], [h + RAIL_W / 2, zr], [h + RAIL_W / 2, zr + RAIL_D], [h - RAIL_W / 2, zr + RAIL_D]]
    edge = [[x, h + RAIL_W / 2 - 8] for x, h in zip(xs, hw)]; inner = [[x, h - RAIL_W / 2 + 6] for x, h in zip(xs, hw)]
    hwAt = lambda x: float(__import__('numpy').interp(x, xs, hw))
    rivT = [{'kind': 'bolt', 'at': [x, hwAt(x)]} for x in range(int(xs[0]) + 120, int(xs[3]) - 60, 240)]
    zAt = lambda x: float(__import__('numpy').interp(x, [q[0] for q in prof], [q[1] for q in prof]))
    rivS = [{'kind': 'bolt', 'at': [x, zAt(x) + RAIL_D / 2]} for x in range(int(xs[0]) + 120, int(xs[3]) - 60, 240)]
    out.append(part('frame', 'frame', 'iron', {'top': top, 'side': side, 'front': sec(hw[0]), 'rear': sec(hw[3])}, pair=True,
                    feats={'top': [{'kind': 'highlight', 'pts': edge, 'width': 1}, {'kind': 'seam', 'pts': inner}] + rivT,
                           'side': [{'kind': 'highlight', 'pts': [[x, z + RAIL_D - 10] for x, z in prof], 'width': 1}, {'kind': 'seam', 'pts': [[x, z + 12] for x, z in prof]}] + rivS}))
    # ---- cross members where the under view shows them
    for k, (cx, cw) in enumerate(L['cross']):
        x0, x1 = X(cx) - cw / 2, X(cx) + cw / 2; h = min(hw[0] if X(cx) < xs[1] else hw[2] if X(cx) < kx0 else hw[3], 900)
        z0 = zr + (kick if X(cx) > kx0 + 100 else 0) + 20
        out.append(part(f'cross{k}', 'frame', 'iron', feats={'top': [{'kind': 'highlight', 'pts': [[x0 + 10, -h + 20], [x0 + 10, h - 20]], 'width': 1}]}, views={'top': [[x0, -h], [x1, -h], [x1, h], [x0, h]], 'side': [[x0, z0], [x1, z0], [x1, z0 + 80], [x0, z0 + 80]],
                                                        **({'front': [[-h, z0], [h, z0], [h, z0 + 80], [-h, z0 + 80]]} if k == 0 else {}), **({'rear': [[-h, z0], [h, z0], [h, z0 + 80], [-h, z0 + 80]]} if k == len(L['cross']) - 1 else {})}))
    # ---- the engine (a volume): from the sump's front as the under view shows it
    el, eh, ew = engine_size(s['engine']); ex0 = X(L['engineFrom']); ez0 = zr - 60
    out.append(part('engine', 'engine', 'iron', {'side': [[ex0, ez0], [ex0 + el, ez0], [ex0 + el, ez0 + eh], [ex0, ez0 + eh]], 'top': [[ex0, -ew / 2], [ex0 + el, -ew / 2], [ex0 + el, ew / 2], [ex0, ew / 2]],
                                                  'front': [[-ew / 2, ez0], [ew / 2, ez0], [ew / 2, ez0 + eh], [-ew / 2, ez0 + eh]]}, layer='chassis'))
    gear_end = ex0 + el + (0 if s['gears'] == 2 else 380)       # the gearbox behind the bell housing: figures only
    # ---- the drive line and the differential
    dz = R; dr = 150 if s['engine']['layout'] == 'I4' else 170
    tw = 90 if s['drive'] == 'torque' else 60
    out.append(part('driveline', 'driveline', 'iron', {'side': [[gear_end, zr + 40], [RX - dr, dz + tw / 2], [RX - dr, dz - tw / 2], [gear_end, zr + 40 - tw]], 'top': [[gear_end, -tw / 2], [RX - dr, -tw / 2], [RX - dr, tw / 2], [gear_end, tw / 2]]}, layer='chassis'))
    circ = lambda cx, cz, r, n=20: [[cx + math.cos(t * 2 * math.pi / n) * r, cz + math.sin(t * 2 * math.pi / n) * r] for t in range(n)]
    out.append(part('rearDiff', 'axle', 'iron', {'side': circ(RX, dz, dr), 'top': [[RX - dr, -dr], [RX + dr * 0.7, -dr], [RX + dr * 0.7, dr], [RX - dr, dr]], 'rear': circ(0, dz, dr)}, layer='chassis'))
    # ---- the axles seen from above (their front and rear outlines are the sheet's, kept on the car's own parts)
    tr = s['track'] / 2
    for pid, ax, w_ in (('axleF', FX, 70), ('axleR', RX, 90)):
        for p in keep:
            if p['id'] == pid:
                b, o = unit([[ax - w_ / 2, -tr], [ax + w_ / 2, -tr], [ax + w_ / 2, tr], [ax - w_ / 2, tr]]); p['outlines']['top'] = o; p.setdefault('sheet', {})['top'] = [round(t) for t in b]
    # ---- the springs: semi-elliptic leaves under each rail (side: a shallow arc of leaves), or one transverse leaf per axle
    leaf = lambda x0, x1, z, sag, n=12: [[x0 + (x1 - x0) * k / n, z - sag * (1 - (2 * k / n - 1) ** 2)] for k in range(n + 1)]
    if s['springs'] == 'semi':
        for nm, cx, ln, h in (('leafF', FX, 900, hw[0]), ('leafR', RX, 1350, hw[3])):
            a = leaf(cx - ln / 2, cx + ln / 2, zr - 10, 70); bot = [[x, z - 45] for x, z in reversed(a)]
            out.append(part(nm, 'spring', 'iron', {'side': a + bot, 'top': [[cx - ln / 2, h - 28], [cx + ln / 2, h - 28], [cx + ln / 2, h + 28], [cx - ln / 2, h + 28]]}, pair=True,
                            feats={'side': [{'kind': 'seam', 'pts': [[x, z - 15] for x, z in a]}, {'kind': 'seam', 'pts': [[x, z - 30] for x, z in a[2:-2]]}]}))
    else:
        for nm, cx in (('leafF', FX), ('leafR', RX)):
            out.append(part(nm, 'spring', 'iron', {'top': [[cx - 30, -hw[0]], [cx + 30, -hw[0]], [cx + 30, hw[0]], [cx - 30, hw[0]]], 'side': [[cx - 30, zr + 10], [cx + 30, zr + 10], [cx + 30, zr + 60], [cx - 30, zr + 60]]}))
    # ---- exhaust down the right side to a silencer, out at the back; the fuel tank behind the rear axle (or under the seat)
    ey = 230; px = ex0 + el * 0.6
    out.append(part('exhaust', 'exhaust', 'iron', {'side': [[px, zr + 120], [px + 120, zr - 20], [RX - 700, zr - 20], [RX - 700, zr - 70], [px + 90, zr - 70], [px - 40, zr + 120]], 'top': [[px, ey - 25], [RX - 700, ey - 25], [RX - 700, ey + 25], [px, ey + 25]]}, layer='chassis'))
    mx0, mx1 = RX - 1300, RX - 650
    out.append(part('muffler', 'exhaust', 'iron', {'side': [[mx0, zr - 110], [mx1, zr - 110], [mx1, zr + 20], [mx0, zr + 20]], 'top': [[mx0, ey - 70], [mx1, ey - 70], [mx1, ey + 70], [mx0, ey + 70]]}, layer='chassis',
                         feats={'top': [{'kind': 'highlight', 'pts': [[mx0 + 30, ey - 40], [mx1 - 30, ey - 40]], 'width': 1}]}))
    out.append(part('tailpipe', 'exhaust', 'iron', {'side': [[mx1, zr - 60], [xs[3] + 60, zr + kick - 40], [xs[3] + 60, zr + kick - 10], [mx1, zr - 30]], 'top': [[mx1, ey - 18], [xs[3] + 60, ey - 18], [xs[3] + 60, ey + 18], [mx1, ey + 18]]}, layer='chassis'))
    if L.get('tank', 'rear') == 'rear':
        tx0, tx1 = RX + 250, min(xs[3] - 40, RX + 700); th = hw[3] - 60
        out.append(part('tank', 'tank', 'iron', {'side': [[tx0, zr + kick - 140], [tx1, zr + kick - 140], [tx1, zr + kick + 140], [tx0, zr + kick + 140]], 'top': [[tx0, -th], [tx1, -th], [tx1, th], [tx0, th]], 'rear': [[-th, zr + kick - 140], [th, zr + kick - 140], [th, zr + kick + 140], [-th, zr + kick + 140]]}, layer='chassis'))
    m = copy.deepcopy(m); m['parts'] = keep + out
    m['running'] = {'engine': {**s['engine'], 'length': round(el), 'height': round(eh), 'width': round(ew), 'cc': round(math.pi / 4 * s['engine']['bore'] ** 2 * s['engine']['stroke'] * CYL[s['engine']['layout']] / 1000)},
                    'gearbox': {'gears': s['gears'], 'end': round(gear_end)}, 'drive': s['drive'], 'springs': s['springs']}
    return m


if __name__ == '__main__':
    m = json.load(open(sys.argv[1])); out = build(m, sys.argv[2]); json.dump(out, open(sys.argv[3], 'w')); print(sys.argv[2], len(out['parts']), out['running'])
