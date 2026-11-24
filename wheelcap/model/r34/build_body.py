"""R34 body v3 in Blender (bpy): flat faces between the character lines, split into panels and parts.

usage: python build_body.py OUT_DIR            (python with the bpy module)
writes OUT_DIR/r34_<real|chibi>.glb, the check renders and the sheet r34_body_v3.png

Reference: the standard GT-R four-view drawing (2000x1125 px). Calibration:
  K = 4.563 mm/px (wheelbase 2665 mm = 584 px), side view: front axle px 1036, ground py 429
  front view: centre px 551.5, ground py 429; rear view: centre px 552.5, ground py 873
All points below are (side px, side py, half width mm) read from that drawing.

Topology (left half, mirrored), straight edges only:
  wall   4 rows (bottom, crease, upper flank, shoulder) x columns (3 front, side stations, 3 rear)
  cap    shoulder -> mid -> centre (bonnet, shelf under the cabin, boot lid)
  cabin  5 stations (cowl, roof front, roof mid, roof rear, rear glass base) x (centre, roof edge, belt)
Every panel is its own mesh (bumpers, wings, door, quarter, bonnet, boot, roof, glass ...), so panel gaps are
mesh borders, and every fitting (lamps, grille, wing, mirrors, wheels, seats) is a separate part.
"""
import bpy, bmesh, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "common"))
from deform import Deformer, REAL, CHIBI

K = 4.563
AX_F, AX_R, GROUND = 1036, 1620, 429
TYRE_R = 327.0
ARCH_R = 87 * K
LIP_Y = 892
TYRE_W = 245
PAINT = (0.05, 0.16, 0.55)


def X(px): return (px - AX_F) * K
def Z(py): return (GROUND - py) * K
def P(px, py, y): return (X(px), y, Z(py))


ROWS = {
    "shoulder": [(912, 266, 790), (980, 243, 825), (1060, 222, 835), (1150, 204, 835), (1200, 207, 830), (1360, 208, 830),
                 (1440, 206, 830), (1560, 204, 825), (1700, 202, 800), (1790, 204, 745)],
    "upper":    [(905, 300, 845), (949, 290, 880), (1036, 285, 892), (1123, 285, 885), (1150, 285, 870), (1470, 266, 870),
                 (1533, 262, 885), (1620, 255, 892), (1707, 252, 890), (1790, 275, 840)],
    "crease":   [(900, 306, 860), (949, 310, 885), (1036, 313, 892), (1123, 313, 885), (1150, 313, 872), (1500, 313, 872),
                 (1533, 313, 885), (1620, 313, 892), (1707, 315, 888), (1815, 322, 825)],
    "bottom":   [(870, 390, 800), (949, 388, 880), (1036, 388, 892), (1123, 388, 880), (1150, 388, 868), (1500, 388, 868),
                 (1533, 388, 880), (1620, 388, 892), (1707, 380, 885), (1800, 374, 790)],
}
ORDER = ["bottom", "crease", "upper", "shoulder"]
CENTRE = [(848, 274), (900, 256), (960, 240), (1040, 222), (1120, 206), (1155, 199), (1690, 198), (1790, 203), (1806, 205)]
FRONT = [  # columns: centre, mid, corner; rows bottom, crease, upper, shoulder
    [(834, 392, 0), (836, 335, 0), (837, 303, 0), (848, 274, 0)],
    [(836, 392, 400), (838, 335, 400), (840, 302, 400), (850, 273, 400)],
    [(870, 390, 800), (868, 330, 840), (858, 302, 830), (885, 268, 800)],
]
REAR = [   # columns: corner, mid, centre
    [(1800, 375, 790), (1818, 330, 830), (1812, 292, 830), (1795, 205, 745)],
    [(1828, 380, 380), (1842, 330, 380), (1832, 292, 380), (1806, 205, 380)],
    [(1830, 380, 0), (1842, 330, 0), (1832, 292, 0), (1808, 205, 0)],
]
DOOR_F, DOOR_R, COWL, GLASS_BASE = 1150, 1455, 1155, 1690
KEY_PX = [935, DOOR_F, 1200, 1360, DOOR_R, 1735]
CABIN = [  # station: centre, roof edge, belt
    [(1155, 199, 0), (1165, 201, 735), (1165, 201, 735)],
    [(1288, 134, 0), (1290, 137, 520), (1290, 208, 812)],
    [(1420, 131, 0), (1420, 134, 560), (1420, 208, 812)],
    [(1530, 140, 0), (1532, 143, 535), (1532, 205, 805)],
    [(1690, 198, 0), (1690, 198, 505), (1692, 202, 770)],
]
CABIN_TOP = ["glass_front", "roof", "roof", "glass_rear"]
CABIN_SIDE = ["glass_side", "glass_side", "glass_side", "roof"]

_mats = {}
def mat(name, rgb, alpha=1.0, rough=0.6):
    if name not in _mats:
        m = bpy.data.materials.new(name); m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
        b.inputs["Alpha"].default_value = alpha
        if alpha < 1: m.surface_render_method = "BLENDED"
        _mats[name] = m
    return _mats[name]

MATS = {
    "paint": (PAINT, 1), "glass": ((0.06, 0.09, 0.12), 0.45), "dark": ((0.02, 0.02, 0.02), 1), "lamp": ((0.85, 0.87, 0.9), 1),
    "tail": ((0.5, 0.03, 0.03), 1), "tailcore": ((0.9, 0.35, 0.2), 1), "tyre": ((0.03, 0.03, 0.035), 1),
    "rim": ((0.6, 0.61, 0.65), 1), "trim": ((0.08, 0.08, 0.09), 1), "seat": ((0.1, 0.1, 0.11), 1),
}


def interp(ctrl, x):
    if x <= ctrl[0][0]: return ctrl[0][1:]
    if x >= ctrl[-1][0]: return ctrl[-1][1:]
    for a, b in zip(ctrl, ctrl[1:]):
        if a[0] <= x <= b[0]:
            t = (x - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 0
            return tuple(a[i] + (b[i] - a[i]) * t for i in range(1, len(a)))


def make(name, faces, m, mirror=True):
    """One part mesh from explicit polygons in mm."""
    bm = bmesh.new(); cache = {}
    for pts in faces:
        vs = []
        for p in pts:
            key = tuple(round(c, 1) for c in p)
            if key not in cache: cache[key] = bm.verts.new((p[0] / 1000, p[1] / 1000, p[2] / 1000))
            if cache[key] not in vs: vs.append(cache[key])
        if len(vs) >= 3:
            try: bm.faces.new(vs)
            except ValueError: pass
    if mirror:
        bmesh.ops.mirror(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], axis="Y", merge_dist=0.0005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    rgb, alpha = MATS[m]; me.materials.append(mat(m, rgb, alpha))
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    return ob


def boxf(a, b):
    x0, y0, z0 = a; x1, y1, z1 = b
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    return [[v[i] for i in f] for f in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7))]


def shrink(quad, ky, kz, out, keep_centre=False):
    """A quad shrunk in y and z about its centre (the centre-line edge stays if keep_centre) and pushed `out` mm in x."""
    cy = sum(p[1] for p in quad) / 4; cz = sum(p[2] for p in quad) / 4
    r = []
    for x, y, z in quad:
        ny = y if (keep_centre and abs(y) < 1) else cy + (y - cy) * ky
        r.append((x + out, ny, cz + (z - cz) * kz))
    return r


def build(name, params):
    wheels = {"F": (0.0, TYRE_R, TYRE_R), "R": (X(AX_R), TYRE_R, TYRE_R)}
    d = Deformer(params, X(834), X(1842), X(AX_R), wheels, beltline_z=Z(206))
    D = lambda p, tag="body": d.point(P(*p), tag)
    rows = {k: sorted(D(c) for c in v) for k, v in ROWS.items()}
    centre = sorted((d.x(X(px)), d.z(Z(py))) for px, py in CENTRE)
    arches = {}
    for k in "FR":
        cx, cz, _ = d.wheel(k)
        arches[k] = (cx, cz, ARCH_R * params["wheel"])
    st = [d.x(X(px)) for px in KEY_PX]
    for cx, cz, ra in arches.values():
        st += [cx + f * ra for f in (-1.03, -1.0, -0.87, -0.5, 0, 0.5, 0.87, 1.0, 1.03)]
    st.sort()
    stations = []
    for x in st:
        if not stations or x - stations[-1] > 25: stations.append(x)

    def wall_col(x):
        col = []
        for r in ORDER:
            y, z = interp(rows[r], x)
            if r != "shoulder":
                for cx, cz, ra in arches.values():
                    if abs(x - cx) <= ra + 1e-6:
                        za = cz + math.sqrt(max(ra * ra - (x - cx) ** 2, 0))
                        if z < za: z = za
            col.append((x, y, z))
        return col

    cols = [[D(p) for p in c] for c in FRONT] + [wall_col(x) for x in stations] + [[D(p) for p in c] for c in REAR]
    nF = 3
    xa0 = arches["F"][0] - arches["F"][2]; xa1 = arches["R"][0] + arches["R"][2]
    xdf, xdr, xcowl, xgb = (d.x(X(v)) for v in (DOOR_F, DOOR_R, COWL, GLASS_BASE))
    panels = {}
    add = lambda pn, pts: panels.setdefault(pn, []).append(pts)

    for j, (a, b) in enumerate(zip(cols, cols[1:])):
        xm = (a[3][0] + b[3][0]) / 2
        for i in range(3):
            xr = (a[i][0] + b[i][0] + a[i + 1][0] + b[i + 1][0]) / 4
            if j < nF or (xr < xa0 and i < 2): pn = "bumper_front" if i < 2 else "nose"
            elif j >= len(cols) - 4 or (xr > xa1 and i < 2): pn = "bumper_rear" if i < 2 else "tail_panel"
            elif xm < xdf: pn = "wing_front"
            elif xm < xdr: pn = "door"
            else: pn = "quarter"
            add(pn, [a[i], b[i], b[i + 1], a[i + 1]])

    def cap_col(x, sh):
        zc = interp(centre, x)[0]; f = 0.55
        return [sh, (x, sh[1] * f, sh[2] + (zc - sh[2]) * (1 - f * f)), (x, 0, zc)]

    cap = [[cols[2][3], cols[1][3], cols[0][3]]] + [cap_col(c[3][0], c[3]) for c in cols[nF:len(cols) - 3]] + [[cols[-3][3], cols[-2][3], cols[-1][3]]]
    for a, b in zip(cap, cap[1:]):
        xm = (a[0][0] + b[0][0]) / 2
        pn = "bonnet" if xm < xcowl else "shelf" if xm < xgb else "boot_lid"
        for i in range(2): add(pn, [a[i], a[i + 1], b[i + 1], b[i]])

    cab = [[D(p, "glass") for p in s] for s in CABIN]
    for i, (a, b) in enumerate(zip(cab, cab[1:])):
        add(CABIN_TOP[i], [a[0], b[0], b[1], a[1]])
        add(CABIN_SIDE[i], [a[1], b[1], b[2], a[2]])

    objs = []
    for pn, faces in panels.items():
        if pn == "shelf": continue      # the cabin is open to the interior
        objs.append(make(f"{name}_{pn}", faces, "glass" if pn.startswith("glass") else "paint"))

    # wheel wells: the arch lip carried inwards, dark
    for k, (cx, cz, ra) in arches.items():
        ring = []
        for c in cols[nF:len(cols) - 3]:
            x = c[0][0]
            if abs(x - cx) <= ra + 1e-6: ring.append((x, c[0][1], cz + math.sqrt(max(ra * ra - (x - cx) ** 2, 0))))
        well = [[a, b, (b[0], b[1] - 420, b[2]), (a[0], a[1] - 420, a[2])] for a, b in zip(ring, ring[1:])]
        objs.append(make(f"{name}_well_{k}", well, "dark"))

    # --- fittings: each its own part -------------------------------------------------------------
    f0, f1, f2 = cols[0], cols[1], cols[2]
    objs.append(make(name + "_headlight", [shrink([f1[2], f2[2], f2[3], f1[3]], 0.9, 0.82, -8)], "lamp"))
    g = [f0[2], (f1[2][0], f1[2][1] * 0.93, f1[2][2]), (f1[3][0], f1[3][1] * 0.93, f1[3][2]), f0[3]]
    objs.append(make(name + "_grille", [shrink(g, 1.0, 0.8, -8, True)], "dark"))
    lo = [D((834, 362, 0)), D((836, 362, 372)), D((837, 322, 372)), D((835, 322, 0))]
    objs.append(make(name + "_intake", [[(p[0] - 8, p[1], p[2]) for p in lo]], "dark"))
    du = [D((842, 358, 400)), D((860, 358, 690)), D((860, 338, 690)), D((842, 338, 400))]
    objs.append(make(name + "_brake_duct", [[(p[0] - 10, p[1], p[2]) for p in du]], "dark"))
    for nm, y, py, r in (("outer", 659, 236, 100), ("inner", 468, 239, 78)):
        px = 1815 - (y - 380) / 450 * 14
        cx, cy, cz = D((px, py, y)); cx += 38; rr = r * params["width"]
        ring = [(cx, cy + rr * math.cos(i * math.pi / 6), cz + rr * math.sin(i * math.pi / 6)) for i in range(12)]
        core = [(cx + 6, cy + 0.5 * rr * math.cos(i * math.pi / 6), cz + 0.5 * rr * math.sin(i * math.pi / 6)) for i in range(12)]
        objs.append(make(f"{name}_tail_{nm}", [ring], "tail")); objs.append(make(f"{name}_tail_{nm}_core", [core], "tailcore"))
    a = D((1758, 172, 0), "glass"); b = D((1815, 164, 690), "glass")
    objs.append(make(name + "_wing", boxf((a[0], 0, a[2]), b), "paint"))
    s0 = D((1762, 203, 425), "glass"); s1 = D((1790, 172, 465), "glass")
    objs.append(make(name + "_wing_stand", boxf(s0, s1), "paint"))
    m0 = D((1178, 212, 850), "glass"); m1 = D((1212, 190, 985), "glass")
    objs.append(make(name + "_mirror", boxf(m0, m1), "paint"))

    # --- interior, stage 1: floor block, dashboard, two seats, steering wheel -----------------------
    belt = cab[2][2]
    floor_z = belt[2] - 260 * params["height"]
    x0, x1 = cab[0][0][0] + 40, cab[4][0][0] - 40
    objs.append(make(name + "_cabin_floor", boxf((xa0, -belt[1] + 60, 200 * params["height"]), (xa1, belt[1] - 60, floor_z)), "dark", False))
    objs.append(make(name + "_dash", boxf((x0, -belt[1] + 80, floor_z), (x0 + 330 * params["wheelbase"], belt[1] - 80, belt[2] + 10)), "trim", False))
    sx0 = x0 + 560 * params["wheelbase"]
    for s in (1, -1):
        y0, y1 = sorted((s * 170, s * 600 * params["width"]))
        objs.append(make(f"{name}_seat_{'L' if s > 0 else 'R'}", boxf((sx0, y0, floor_z), (sx0 + 520 * params["wheelbase"], y1, floor_z + 130))
                         + boxf((sx0 + 400 * params["wheelbase"], y0, floor_z + 130), (sx0 + 560 * params["wheelbase"], y1, belt[2] + 330 * params["greenhouse"])), "seat", False))
    wx, wy, wz, wr = x0 + 380 * params["wheelbase"], -385 * params["width"], belt[2] + 40, 170
    rim = []
    for i in range(10):
        a0, a1 = i * math.pi / 5, (i + 1) * math.pi / 5
        o0 = (wx, wy + wr * math.cos(a0), wz + wr * math.sin(a0)); o1 = (wx, wy + wr * math.cos(a1), wz + wr * math.sin(a1))
        i0 = (wx, wy + 0.78 * wr * math.cos(a0), wz + 0.78 * wr * math.sin(a0)); i1 = (wx, wy + 0.78 * wr * math.cos(a1), wz + 0.78 * wr * math.sin(a1))
        rim.append([o0, o1, i1, i0])
    objs.append(make(name + "_steering", rim, "trim", False))

    # --- wheels: tyre, barrel, six spokes -----------------------------------------------------------
    lip = LIP_Y * params["width"]
    for k in "FR":
        cx, cz, r = d.wheel(k)
        w = TYRE_W * params["width"]
        for s in (1, -1):
            yo = s * (lip + 4); yi = yo - s * w
            tag = f"{k}{'L' if s > 0 else 'R'}"
            n = 20; faces = []
            pt = lambda rad, ang, y: (cx + rad * math.cos(ang), y, cz + rad * math.sin(ang))
            for i in range(n):
                a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
                faces.append([pt(r, a0, yo), pt(r, a1, yo), pt(r, a1, yi), pt(r, a0, yi)])                 # tread
                faces.append([pt(r, a0, yo), pt(r, a1, yo), pt(0.7 * r, a1, yo), pt(0.7 * r, a0, yo)])     # outer wall
                faces.append([pt(r, a0, yi), pt(r, a1, yi), pt(0.7 * r, a1, yi), pt(0.7 * r, a0, yi)])     # inner wall
            objs.append(make(f"{name}_tyre_{tag}", faces, "tyre", False))
            yd = yo - s * 55
            barrel = []
            for i in range(n):
                a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
                barrel.append([pt(0.7 * r, a0, yo), pt(0.7 * r, a1, yo), pt(0.66 * r, a1, yd), pt(0.66 * r, a0, yd)])
            barrel.append([pt(0.66 * r, 2 * math.pi * i / n, yd) for i in range(n)])
            objs.append(make(f"{name}_barrel_{tag}", barrel, "dark", False))
            sp = []; ys = yo - s * 12
            for i in range(6):
                a = 2 * math.pi * i / 6 + 0.26
                sp.append([pt(0.16 * r, a - 0.5, ys), pt(0.16 * r, a + 0.5, ys), pt(0.69 * r, a + 0.07, ys), pt(0.69 * r, a - 0.07, ys)])
            sp.append([pt(0.19 * r, 2 * math.pi * i / 12, ys - s * 3) for i in range(12)])
            objs.append(make(f"{name}_spokes_{tag}", sp, "rim", False))
    return objs, d


def look_at(cam, target):
    from mathutils import Vector
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()


def render(out, name, mid):
    sc = bpy.context.scene
    views = {
        "side": ((mid, -9.0, 0.65), (mid, 0, 0.65), True, 5.4),
        "front34": ((mid - 6.5, -5.5, 2.6), (mid, 0, 0.55), False, 0),
        "rear34": ((mid + 6.5, -5.5, 2.6), (mid, 0, 0.55), False, 0),
        "front": ((mid - 9, 0, 0.7), (mid, 0, 0.7), True, 3.4),
        "rear": ((mid + 9, 0, 0.7), (mid, 0, 0.7), True, 3.4),
    }
    files = []
    for vn, (loc, tgt, ortho, scale) in views.items():
        cd = bpy.data.cameras.new(vn); cam = bpy.data.objects.new(vn, cd); sc.collection.objects.link(cam)
        cam.location = loc; look_at(cam, tgt)
        if ortho: cd.type = "ORTHO"; cd.ortho_scale = scale
        else: cd.lens = 70
        sc.camera = cam
        sc.render.filepath = os.path.join(out, f"{name}_{vn}.png")
        bpy.ops.render.render(write_still=True)
        files.append(sc.render.filepath); bpy.data.objects.remove(cam)
    return files


def main(out):
    os.makedirs(out, exist_ok=True)
    sheets = {}
    for name, params in (("real", REAL), ("chibi", CHIBI)):
        bpy.ops.wm.read_factory_settings(use_empty=True); _mats.clear()
        sc = bpy.context.scene
        objs, d = build("r34", params)
        tris = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
        print(name, "parts", len(objs), "tris", tris)
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.export_scene.gltf(filepath=os.path.join(out, f"r34_{name}.glb"), use_selection=True)
        bpy.ops.mesh.primitive_plane_add(size=60, location=(1.3, 0, 0)); bpy.context.object.data.materials.append(mat("floor", (0.75, 0.76, 0.78)))
        bpy.ops.object.light_add(type="SUN", location=(0, -5, 8)); s = bpy.context.object; s.data.energy = 3.0; s.rotation_euler = (math.radians(50), 0, math.radians(35)); s.data.angle = 0.2
        w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
        w.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.82, 0.86, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.9
        sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 24; sc.cycles.use_denoising = False
        sc.render.resolution_x, sc.render.resolution_y = 900, 520
        sc.view_settings.view_transform = "Standard"
        sc.render.use_freestyle = True; sc.render.line_thickness = 1.3
        vl = sc.view_layers[0]; ls = vl.freestyle_settings.linesets.new("l")
        ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True
        vl.freestyle_settings.crease_angle = math.radians(150)
        mid = (d.x(X(834)) + d.x(X(1842))) / 2000
        sheets[name] = (render(out, name, mid), tris, len(objs))
    from PIL import Image, ImageDraw
    W, H = 900, 520
    im = Image.new("RGB", (W * 2, H * 5 + 30), (255, 255, 255)); dr = ImageDraw.Draw(im)
    for i, name in enumerate(("real", "chibi")):
        files, tris, n = sheets[name]
        dr.text((i * W + 10, 8), f"R34 body v3 - {name.upper()}  ({n} parts, {tris} triangles)", fill=(0, 0, 0))
        for j, f in enumerate(files): im.paste(Image.open(f).convert("RGB"), (i * W, 30 + j * H))
    im.save(os.path.join(out, "r34_body_v3.png"))


if __name__ == "__main__":
    main(sys.argv[-1])
