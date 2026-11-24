"""R34 body shell v1 in Blender (bpy): flat faces between the character lines, real and chibi from one table.

usage: python build_body.py OUT_DIR            (python with the bpy module)
writes OUT_DIR/r34_<real|chibi>.glb and render PNGs, plus a combined sheet r34_body_v2.png

Topology (left half, mirrored):
  wall   4 rows (bottom, crease, upper flank, shoulder) x columns (3 front, side stations, 3 rear)
  cap    shoulder -> mid -> centre over the same side stations (bonnet, cabin floor line, deck)
  cabin  5 stations (cowl, roof front, roof mid, roof rear, rear glass base) x (centre, roof edge, belt)
Points between stations are joined by straight edges only. Wheel arches: rows below the arch are lifted
onto the arch circle at the arch stations, so the lip is a clean polygon around the wheel.
"""
import bpy, bmesh, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, "..", "common"))
import ref_lines as R
from deform import Deformer, REAL, CHIBI

SW = 1785 / 1834            # blueprint is the wide Z-tune body; base car is the standard GT-R
ARCH_R_PX = {"F": 92, "R": 95}
LIP_Y = 905
TYRE_W = 245


def P(px, py, y):
    return (R.sx(px), y * SW, R.sz(py))


# side rows, control points (side px, side py, half width mm)
ROWS = {
    "shoulder": [(556, 126, 760), (620, 114, 815), (700, 106, 830), (790, 104, 830), (840, 108, 822), (1000, 108, 822),
                 (1100, 104, 822), (1200, 92, 815), (1340, 88, 790), (1430, 90, 730)],
    "upper":    [(545, 160, 800), (588, 158, 880), (680, 150, 905), (772, 155, 890), (800, 158, 868), (1110, 150, 868),
                 (1175, 145, 890), (1270, 134, 905), (1365, 130, 895), (1440, 150, 800)],
    "crease":   [(505, 200, 800), (588, 196, 890), (680, 193, 905), (772, 193, 890), (800, 193, 872), (1110, 192, 872),
                 (1175, 192, 890), (1270, 192, 905), (1365, 198, 895), (1455, 205, 800)],
    "bottom":   [(500, 272, 760), (588, 274, 880), (680, 276, 905), (772, 276, 885), (800, 276, 865), (1150, 276, 865),
                 (1175, 276, 885), (1270, 276, 905), (1365, 274, 890), (1440, 272, 760)],
}
ORDER = ["bottom", "crease", "upper", "shoulder"]
CENTRE = [(490, 152), (520, 139), (556, 121), (600, 115), (660, 107), (720, 100), (764, 96), (790, 97), (1338, 84),
          (1400, 86), (1440, 90), (1460, 96)]
# front and rear faces: three columns each (centre, mid, corner), rows bottom..shoulder
FRONT = [
    [(482, 272, 0), (478, 205, 0), (479, 180, 0), (490, 152, 0)],
    [(484, 272, 390), (480, 205, 390), (481, 180, 390), (493, 151, 390)],
    [(500, 272, 760), (505, 200, 800), (522, 176, 780), (530, 138, 740)],
]
REAR = [
    [(1440, 272, 760), (1455, 205, 800), (1450, 160, 790), (1440, 92, 730)],
    [(1460, 272, 400), (1486, 205, 400), (1470, 162, 400), (1459, 96, 400)],
    [(1462, 272, 0), (1488, 205, 0), (1470, 162, 0), (1460, 96, 0)],
]
KEY_PX = [575, 790, 840, 1000, 1105, 1385]     # stations kept besides the arch stations
CABIN = [  # station: centre, roof edge, belt  (px, py, y)
    [(790, 97, 0), (800, 100, 720), (800, 100, 720)],
    [(916, 24, 0), (915, 25, 500), (915, 108, 797)],
    [(1060, 8, 0), (1060, 15, 555), (1060, 107, 797)],
    [(1176, 19, 0), (1178, 22, 555), (1178, 95, 790)],
    [(1338, 84, 0), (1338, 84, 546), (1340, 88, 765)],
]
CABIN_TOP = ["glass", "body", "body", "glass"]     # centre-edge strips
CABIN_SIDE = ["glass", "glass", "glass", "body"]   # edge-belt strips


def interp(ctrl, x):
    if x <= ctrl[0][0]: return ctrl[0][1:]
    if x >= ctrl[-1][0]: return ctrl[-1][1:]
    for a, b in zip(ctrl, ctrl[1:]):
        if a[0] <= x <= b[0]:
            t = (x - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 0
            return tuple(a[i] + (b[i] - a[i]) * t for i in range(1, len(a)))


def build(name, params):
    d = Deformer(params, R.FRONT_END, R.REAR_END, R.WHEELBASE, dict(R.WHEELS))
    rows = {k: sorted(d.point(P(*c)) for c in v) for k, v in ROWS.items()}
    centre = sorted((d.x(R.sx(px)), d.z(R.sz(py))) for px, py in CENTRE)
    arches = {}
    for k in "FR":
        cx, cz, _ = d.wheel(k)
        arches[k] = (cx, cz, ARCH_R_PX[k] * R.K * params["wheel"])
    st = [d.x(R.sx(px)) for px in KEY_PX]
    for cx, cz, ra in arches.values():
        st += [cx + f * ra for f in (-1.03, -1.0, -0.87, -0.5, 0, 0.5, 0.87, 1.0, 1.03)]
    st.sort()
    stations = []
    for x in st:
        if not stations or x - stations[-1] > 25: stations.append(x)
    lip_y = LIP_Y * SW * params["width"]

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

    cols = [[d.point(P(*p)) for p in c] for c in FRONT] + [wall_col(x) for x in stations] + [[d.point(P(*p)) for p in c] for c in REAR]
    nF = len(FRONT)

    bm = bmesh.new()
    cache = {}

    def V(p):
        key = tuple(round(c, 1) for c in p)
        if key not in cache: cache[key] = bm.verts.new((p[0] / 1000, p[1] / 1000, p[2] / 1000))
        return cache[key]

    def F(pts, mat):
        vs = []
        for p in pts:
            v = V(p)
            if v not in vs: vs.append(v)
        if len(vs) >= 3:
            try:
                f = bm.faces.new(vs); f.material_index = mat
            except ValueError:
                pass

    BODY, GLASS, DARK = 0, 1, 2
    for a, b in zip(cols, cols[1:]):
        for i in range(3):
            F([a[i], b[i], b[i + 1], a[i + 1]], BODY)

    def cap_col(x, sh):
        zc = interp(centre, x)[0]
        f = 0.55
        return [sh, (x, sh[1] * f, sh[2] + (zc - sh[2]) * (1 - f * f)), (x, 0, zc)]

    cap = [[cols[2][3], cols[1][3], cols[0][3]]]
    cap += [cap_col(c[3][0], c[3]) for c in cols[nF:len(cols) - 3]]
    cap += [[cols[-3][3], cols[-2][3], cols[-1][3]]]
    for a, b in zip(cap, cap[1:]):
        for i in range(2):
            F([a[i], a[i + 1], b[i + 1], b[i]], BODY)

    cab = [[d.point(P(*p), "glass") for p in s] for s in CABIN]
    for i, (a, b) in enumerate(zip(cab, cab[1:])):
        F([a[0], b[0], b[1], a[1]], GLASS if CABIN_TOP[i] == "glass" else BODY)
        F([a[1], b[1], b[2], a[2]], GLASS if CABIN_SIDE[i] == "glass" else BODY)

    bmesh.ops.mirror(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], axis="Y", merge_dist=0.0005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name + "_body"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name + "_body", me); bpy.context.collection.objects.link(ob)
    for m in (mat("paint", (0.05, 0.16, 0.55)), mat("glass", (0.03, 0.04, 0.06)), mat("dark", (0.02, 0.02, 0.02))): me.materials.append(m)
    objs = [ob] + fittings(name, d, cols, params)

    # dark block inside, so the arches do not show the far wall
    x0, x1 = arches["F"][0] - arches["F"][2], arches["R"][0] + arches["R"][2]
    objs.append(box(name + "_inner", (x0, -lip_y + 300, 190 * params["height"]), (x1, lip_y - 300, 560 * params["height"]), "dark"))
    for k in "FR":
        cx, cz, r = d.wheel(k)
        for s in (1, -1):
            w = TYRE_W * params["width"]
            y = s * (lip_y - w / 2 + 5)
            objs.append(cyl(f"{name}_tyre_{k}{s}", cx, y, cz, r, w, 20, "tyre", (0.03, 0.03, 0.035)))
            objs.append(cyl(f"{name}_rim_{k}{s}", cx, y + s * 6, cz, r * 0.66, w, 10, "rim", (0.55, 0.56, 0.6)))
    return objs, len(me.polygons)


def part(name, faces, m, rgb, mirror=True):
    """A separate part mesh from explicit polygons (mm), mirrored across the centre plane."""
    bm = bmesh.new()
    for pts in faces:
        bm.faces.new([bm.verts.new((p[0] / 1000, p[1] / 1000, p[2] / 1000)) for p in pts])
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0005)
    if mirror:
        bmesh.ops.mirror(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], axis="Y", merge_dist=0.0005)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat(m, rgb))
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    return ob


def inset(quad, k, out):
    """The quad shrunk towards its centre by k and pushed `out` mm along +/-x (front faces negative x)."""
    c = [sum(p[i] for p in quad) / len(quad) for i in range(3)]
    return [(c[0] + (p[0] - c[0]) * k + out, c[1] + (p[1] - c[1]) * k, c[2] + (p[2] - c[2]) * k) for p in quad]


def boxf(a, b):
    x0, y0, z0 = a; x1, y1, z1 = b
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    return [[v[i] for i in f] for f in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7))]


def fittings(name, d, cols, params):
    """Face parts as their own meshes: lamps, grille, intake, tail lamps, wing, mirrors."""
    o = []
    f0, f1, f2 = cols[0], cols[1], cols[2]            # front columns: centre, mid, corner (rows bottom..shoulder)
    o.append(part(name + "_headlight", [inset([f1[2], f2[2], f2[3], f1[3]], 0.86, -8)], "lamp", (0.85, 0.87, 0.9)))
    g = [f0[2], (f1[2][0], f1[2][1] * 0.8, f1[2][2]), (f1[3][0], f1[3][1] * 0.8, f1[3][2]), f0[3]]
    o.append(part(name + "_grille", [inset(g, 0.9, -8)], "dark", (0.02, 0.02, 0.02)))
    lo = [f0[0], f1[0], f1[1], f0[1]]
    o.append(part(name + "_intake", [inset(lo, 0.8, -8)], "dark", (0.02, 0.02, 0.02)))
    r0 = cols[-1]
    for nm, y, py, r in (("outer", 678, 118, 95), ("inner", 420, 121, 86)):
        px = 1466 - max(y - 400, 0) / 390 * 20
        cx, cy, cz = d.point((R.sx(px) + 12, y * SW, R.sz(py)))
        rr = r * params["width"]
        ring = [(cx, cy + rr * math.cos(i * math.pi / 6), cz + rr * math.sin(i * math.pi / 6)) for i in range(12)]
        core = [(cx + 6, cy + 0.5 * rr * math.cos(i * math.pi / 6), cz + 0.5 * rr * math.sin(i * math.pi / 6)) for i in range(12)]
        o.append(part(f"{name}_tail_{nm}", [ring], "tail", (0.5, 0.03, 0.03)))
        o.append(part(f"{name}_tail_{nm}_core", [core], "tailcore", (0.9, 0.35, 0.2)))
    a = d.point((R.sx(1392), 0, R.sz(52)), "glass"); b = d.point((R.sx(1462), 770 * SW, R.sz(44)), "glass")
    o.append(part(name + "_wing", boxf((a[0], 0, a[2]), (b[0], b[1], b[2])), "paint", (0.05, 0.16, 0.55)))
    s0 = d.point((R.sx(1405), 560 * SW, R.sz(88)), "glass"); s1 = d.point((R.sx(1440), 600 * SW, R.sz(52)), "glass")
    o.append(part(name + "_wing_stand", boxf(s0, s1), "paint", (0.05, 0.16, 0.55)))
    m0 = d.point((R.sx(835), 835 * SW, R.sz(104)), "glass"); m1 = d.point((R.sx(868), 960 * SW, R.sz(84)), "glass")
    o.append(part(name + "_mirror", boxf(m0, m1), "paint", (0.05, 0.16, 0.55)))
    return o


_mats = {}
def mat(name, rgb):
    if name not in _mats:
        m = bpy.data.materials.new(name); m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = 0.6
        _mats[name] = m
    return _mats[name]


def box(name, a, b, m):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object; o.name = name
    o.scale = ((b[0] - a[0]) / 1000, (b[1] - a[1]) / 1000, (b[2] - a[2]) / 1000)
    o.location = ((a[0] + b[0]) / 2000, (a[1] + b[1]) / 2000, (a[2] + b[2]) / 2000)
    o.data.materials.append(mat(m, (0.02, 0.02, 0.02)))
    return o


def cyl(name, x, y, z, r, w, n, m, rgb):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r / 1000, depth=w / 1000, location=(x / 1000, y / 1000, z / 1000), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object; o.name = name; o.data.materials.append(mat(m, rgb))
    return o


def look_at(cam, target):
    from mathutils import Vector
    v = Vector(target) - cam.location
    cam.rotation_euler = v.to_track_quat("-Z", "Y").to_euler()


def render(out, name, objs, mid):
    sc = bpy.context.scene
    views = {
        "side": ((mid, 9.0, 0.65), (mid, 0, 0.65), True, 5.4),
        "front34": ((mid - 6.5, 5.5, 2.6), (mid, 0, 0.55), False, 0),
        "rear34": ((mid + 6.5, 5.5, 2.6), (mid, 0, 0.55), False, 0),
        "top": ((mid, 0, 9.0), (mid, 0, 0), True, 5.4),
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
        files.append(sc.render.filepath)
        bpy.data.objects.remove(cam)
    return files


def main(out):
    os.makedirs(out, exist_ok=True)
    sheets = {}
    for name, params in (("real", REAL), ("chibi", CHIBI)):
        bpy.ops.wm.read_factory_settings(use_empty=True); _mats.clear()
        sc = bpy.context.scene
        objs, nf = build("r34_" + name, params)
        tris = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
        print("parts:", len(objs))
        print(name, "body faces", nf, "total tris", tris)
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.export_scene.gltf(filepath=os.path.join(out, f"r34_{name}.glb"), use_selection=True)
        # studio for the check renders
        bpy.ops.mesh.primitive_plane_add(size=60, location=(1.3, 0, 0)); bpy.context.object.data.materials.append(mat("floor", (0.75, 0.76, 0.78)))
        bpy.ops.object.light_add(type="SUN", location=(0, 5, 8)); s = bpy.context.object; s.data.energy = 3.0; s.rotation_euler = (math.radians(50), 0, math.radians(-35)); s.data.angle = 0.2
        w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.82, 0.86, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.9
        sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 24; sc.cycles.use_denoising = False
        sc.render.resolution_x, sc.render.resolution_y = 900, 520
        sc.view_settings.view_transform = "Standard"
        sc.render.use_freestyle = True; sc.render.line_thickness = 1.3
        vl = sc.view_layers[0]; ls = vl.freestyle_settings.linesets.new("l")
        ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True; ls.select_edge_mark = False
        vl.freestyle_settings.crease_angle = math.radians(150)
        d = Deformer(params, R.FRONT_END, R.REAR_END, R.WHEELBASE, dict(R.WHEELS))
        mid = (d.x(R.FRONT_END) + d.x(R.REAR_END)) / 2000
        sheets[name] = (render(out, name, objs, mid), tris)
    from PIL import Image, ImageDraw
    W, H = 900, 520
    im = Image.new("RGB", (W * 2, H * 4 + 30), (255, 255, 255)); dr = ImageDraw.Draw(im)
    for i, name in enumerate(("real", "chibi")):
        files, tris = sheets[name]
        dr.text((i * W + 10, 8), f"R34 body v2 - {name.upper()}  ({tris} triangles incl. wheels)", fill=(0, 0, 0))
        for j, f in enumerate(files): im.paste(Image.open(f).convert("RGB"), (i * W, 30 + j * H))
    im.save(os.path.join(out, "r34_body_v2.png"))


if __name__ == "__main__":
    main(sys.argv[-1])
