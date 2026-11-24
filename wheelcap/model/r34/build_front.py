"""R34 front third, quality test: a coarse quad cage with edge creases, subdivided once or twice.

usage: python build_front.py OUT_DIR [levels]      (python with the bpy module)

Why: v3 (flat faces, ~1500 triangles) read as a box. Here the cage is still small enough to place by hand
(about 130 quads per side), the character lines carry creases so they stay sharp, and subdivision gives the
panels between them a clean curved surface. Normals are smooth inside a panel and split only on marked lines.

Cage (left half, mirrored), points read from the standard four-view drawing (see build_body.py for calibration):
  wall  columns c0..c7 (nose, centre to corner), A (ahead of the arch), E (door front), rows r0..r6 (bottom to bonnet edge)
  arch  a 16-point ring joined to the 16 cage points around it, so the lip is a true circle of quads
  cap   bonnet lines L0..L4 from the centre to the shut line, then the wing top out to the shoulder S
Openings (grille, lower intake, brake duct) are inset and pushed in; the lamp is an inset face with a dark bezel.
"""
import bpy, bmesh, math, os, sys

K, AX_F, GROUND = 4.563, 1036, 429
def P(px, py, y): return ((px - AX_F) * K, y, (GROUND - py) * K)

# nose columns c0..c5: half width, and how far the plan sweeps back (px) at that width
COL_Y = [0, 190, 372, 420, 620, 790]
SWEEP = [0, 2, 8, 11, 27, 48]
ROW_PX = [833, 835, 836, 836, 837, 841, 848]            # r0..r6 at the centre line
ROW_PY = [392, 368, 342, 322, 303, 288, 274]
R6_PY = [274, 274, 273, 272, 269, 267]                  # bonnet edge / lamp top rises to the corner
C5 = [(881, 392, 770), (883, 368, 785), (884, 342, 790), (884, 322, 790), (886, 304, 790), (890, 288, 780), (897, 267, 765)]
C6 = [(900, 390, 835), (904, 368, 848), (904, 342, 850), (904, 322, 850), (906, 305, 850), (910, 287, 838), (915, 265, 800)]
C7 = [(922, 390, 860), (922, 368, 872), (922, 342, 872), (922, 322, 872), (922, 306, 872), (922, 287, 868), (930, 261, 803)]
CA = [(940, 390, 880), (940, 368, 885), (940, 342, 888), (940, 322, 888), (940, 306, 888), (940, 286, 880), (940, 257, 806)]
CB = [(1136, 388, 880), (1136, 368, 884), (1136, 342, 886), (1136, 322, 886), (1136, 313, 885), (1136, 286, 874), (1136, 207, 835)]
CE = [(1165, 388, 868), (1165, 368, 870), (1165, 342, 872), (1165, 322, 872), (1165, 313, 872), (1165, 285, 866), (1165, 204, 835)]
TOPS = [  # stations over the arch: upper-flank point (r5) and shoulder (r6)
    [(976, 262, 890), (976, 244, 823)], [(1016, 250, 893), (1016, 233, 829)],
    [(1056, 250, 893), (1056, 223, 834)], [(1096, 262, 890), (1096, 215, 835)],
]
ARCH_C, ARCH_R, ARCH_Y = (1036, 357), 87, 892
CENTRE = [(848, 274), (900, 256), (960, 240), (1040, 222), (1120, 206), (1165, 198)]
FRAC0 = [0, 0.248, 0.486, 0.549, 0.81]                  # bonnet lines at the nose (the column widths)
FRAC1 = [0, 0.25, 0.47, 0.62, 0.90]                     # and further back: L4 becomes the shut line

BUMPER, WING, BONNET, LAMP, TRIM, DARK, T_GRILLE, T_INTAKE, T_DUCT, T_LAMP = range(10)
COLOURS = {"paint": (0.04, 0.13, 0.42), "lamp": (0.86, 0.88, 0.9), "trim": (0.03, 0.03, 0.035), "dark": (0.012, 0.012, 0.014),
           "tyre": (0.025, 0.025, 0.03), "rim": (0.55, 0.56, 0.6)}


def material(name, key, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*COLOURS[key], 1); b.inputs["Roughness"].default_value = rough
    return m


def interp(ctrl, x):
    if x <= ctrl[0][0]: return ctrl[0][1]
    for a, b in zip(ctrl, ctrl[1:]):
        if x <= b[0]: return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])
    return ctrl[-1][1]


def cage():
    bm = bmesh.new()
    cr = bm.edges.layers.float.new("crease_edge")
    V = lambda p: bm.verts.new((p[0] / 1000, p[1] / 1000, p[2] / 1000))

    def face(vs, tag):
        f = bm.faces.new(vs); f.material_index = tag; return f

    def crease(a, b, val):
        e = bm.edges.get((a, b))
        if e: e[cr] = max(e[cr], val)

    # wall columns, each a list of 7 verts r0..r6
    cols = []
    for c in range(5):
        cols.append([V(P(ROW_PX[r] + SWEEP[c], R6_PY[c] if r == 6 else ROW_PY[r], COL_Y[c])) for r in range(7)])
    for data in (C5, C6, C7, CA):
        cols.append([V(P(*p)) for p in data])
    colB, colE = [V(P(*p)) for p in CB], [V(P(*p)) for p in CE]
    tops = [[V(P(*p)) for p in t] for t in TOPS]

    for c in range(8):                                   # c0..c7 -> A
        a, b = cols[c], cols[c + 1]
        for r in range(6):
            if r >= 4:
                tag = T_GRILLE if c < 2 else BUMPER if c == 2 else T_LAMP if c < 6 else WING
            elif c >= 7: tag = WING
            elif r in (1, 2) and c < 2: tag = T_INTAKE
            elif r == 1 and c in (3, 4): tag = T_DUCT
            else: tag = BUMPER
            face([a[r], b[r], b[r + 1], a[r + 1]], tag)
    A = cols[8]
    upper = [A] + [[None] * 5 + t for t in tops] + [colB]     # r5, r6 across the top of the arch
    for a, b in zip(upper, upper[1:]):
        face([a[5], b[5], b[6], a[6]], WING)
    for r in range(6):
        face([colB[r], colE[r], colE[r + 1], colB[r + 1]], WING)

    # wheel arch: ring of 16 joined to the 16 cage points around the opening, then a return inwards
    outer = A[0:6] + [t[0] for t in tops] + colB[5::-1]
    ring, ring2 = [], []
    for i in range(16):
        a = math.radians(-20 + i * 220 / 15)
        px, py = ARCH_C[0] - ARCH_R * math.cos(a), ARCH_C[1] - ARCH_R * math.sin(a)
        ring.append(V(P(px, py, ARCH_Y)))
        px2, py2 = ARCH_C[0] - (ARCH_R - 5) * math.cos(a), ARCH_C[1] - (ARCH_R - 5) * math.sin(a)
        ring2.append(V(P(px2, py2, ARCH_Y - 70)))
    for i in range(15):
        face([outer[i], outer[i + 1], ring[i + 1], ring[i]], WING)
        face([ring[i], ring[i + 1], ring2[i + 1], ring2[i]], DARK)
        crease(ring[i], ring[i + 1], 1.0)

    # bonnet and wing top
    def cap_row(station_px, shoulder_v, t):
        sx, sy, sz = shoulder_v.co.x * 1000, shoulder_v.co.y * 1000, shoulder_v.co.z * 1000
        zc = (GROUND - interp(CENTRE, station_px)) * K
        row = []
        for k in range(5):
            f = FRAC0[k] + (FRAC1[k] - FRAC0[k]) * t
            row.append(V((sx, sy * f, sz + (zc - sz) * (1 - f ** 2.2))))
        return row + [shoulder_v]

    rows = [[cols[c][6] for c in range(6)]]              # the bonnet's front edge is the nose's top row
    stations = [(915, cols[6][6]), (930, cols[7][6]), (940, A[6])] + [(TOPS[i][1][0], tops[i][1]) for i in range(4)] + [(1136, colB[6]), (1165, colE[6])]
    for n, (px, sv) in enumerate(stations):
        rows.append(cap_row(px, sv, min(1, (n + 1) / 3)))
    for a, b in zip(rows, rows[1:]):
        for k in range(5):
            face([a[k], a[k + 1], b[k + 1], b[k]], BONNET if k < 4 else WING)

    # creases on the cage's character lines
    for c in range(8):
        crease(cols[c][4], cols[c + 1][4], 0.75)         # bumper top line
        crease(cols[c][1], cols[c + 1][1], 0.5)          # lip
    for c in range(5):
        crease(cols[c][6], cols[c + 1][6], 0.55)         # bonnet leading edge
    for a, b in zip(upper, upper[1:]):
        crease(a[6], b[6], 0.25)                         # shoulder: soft
    crease(colB[6], colE[6], 0.25)
    for r in range(6):
        crease(colB[r], colB[r + 1], 0.0)

    bmesh.ops.mirror(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], axis="Y", merge_dist=0.0005)
    bm.faces.ensure_lookup_table()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])     # before the insets: their depth follows the normals

    def recess(tag, thickness, depth, inner, rim):
        fs = [f for f in bm.faces if f.material_index == tag]
        r = bmesh.ops.inset_region(bm, faces=fs, thickness=thickness, depth=depth, use_even_offset=True, use_boundary=True)
        for f in fs: f.material_index = inner
        for f in r["faces"]: f.material_index = rim

    recess(T_GRILLE, 0.012, -0.045, DARK, DARK)
    recess(T_INTAKE, 0.014, -0.07, DARK, DARK)
    recess(T_DUCT, 0.012, -0.06, DARK, DARK)
    recess(T_LAMP, 0.016, -0.004, LAMP, TRIM)
    for e in bm.edges:
        if len(e.link_faces) == 2:
            a, b = (f.material_index for f in e.link_faces)
            if a != b and (a >= LAMP or b >= LAMP): e[cr] = 1.0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def finish(ob, levels):
    """Subdivide, then smooth normals inside panels and split them on sharp lines and panel borders."""
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    m = ob.modifiers.new("subd", "SUBSURF"); m.levels = levels; m.render_levels = levels
    bpy.ops.object.modifier_apply(modifier="subd")
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    sharp = set()
    for e in bm.edges:
        if len(e.link_faces) != 2: continue
        a, b = e.link_faces
        if a.material_index != b.material_index or e.calc_face_angle(0) > math.radians(30): sharp.add(e.index)
    for f in bm.faces: f.smooth = True
    for e in bm.edges: e.smooth = e.index not in sharp
    bm.to_mesh(me); bm.free()
    fs = me.attributes.new("freestyle_edge", "BOOLEAN", "EDGE")
    for i in sharp: fs.data[i].value = True
    return sum(len(p.vertices) - 2 for p in me.polygons)


def wheel():
    cx, cz, r, yo, w = 0.0, 0.327, 0.327, 0.896, 0.245
    bm = bmesh.new(); n = 24
    pt = lambda rad, a, y: bm.verts.new((cx + rad * math.cos(a), y, cz + rad * math.sin(a)))
    prof = [(0.70, yo - 0.02), (0.93, yo), (1.0, yo - 0.03), (1.0, yo - w + 0.03), (0.93, yo - w), (0.70, yo - w)]
    rings = [[pt(r * k, 2 * math.pi * i / n, y) for i in range(n)] for k, y in prof]
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new([a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]]).material_index = 0
    barrel = [pt(r * 0.66, 2 * math.pi * i / n, yo - 0.07) for i in range(n)]
    for i in range(n):
        bm.faces.new([rings[0][i], rings[0][(i + 1) % n], barrel[(i + 1) % n], barrel[i]]).material_index = 1
    bm.faces.new(barrel).material_index = 2
    ys = yo - 0.03
    for i in range(6):
        a = 2 * math.pi * i / 6 + 0.26
        bm.faces.new([pt(0.16 * r, a - 0.5, ys), pt(0.16 * r, a + 0.5, ys), pt(0.69 * r, a + 0.07, ys - 0.012), pt(0.69 * r, a - 0.07, ys - 0.012)]).material_index = 1
    bm.faces.new([pt(0.2 * r, 2 * math.pi * i / 12, ys + 0.004) for i in range(12)]).material_index = 1
    bmesh.ops.mirror(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], axis="Y", merge_dist=0.0001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new("wheel"); bm.to_mesh(me); bm.free()
    for nm, key, ro in (("tyre", "tyre", 0.8), ("rim", "rim", 0.35), ("barrel", "dark", 0.8)): me.materials.append(material(nm, key, ro))
    ob = bpy.data.objects.new("wheel_front", me); bpy.context.collection.objects.link(ob)
    return ob


def look_at(cam, target):
    from mathutils import Vector
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()


def main(out, levels):
    os.makedirs(out, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    bm = cage(); cage_quads = len(bm.faces)
    me = bpy.data.meshes.new("r34_front"); bm.to_mesh(me); bm.free()
    slots = [("paint_bumper", "paint", 0.32), ("paint_wing", "paint", 0.32), ("paint_bonnet", "paint", 0.32), ("lamp", "lamp", 0.2),
             ("trim", "trim", 0.5), ("dark", "dark", 0.9)]
    for nm, key, ro in slots: me.materials.append(material(nm, key, ro))
    ob = bpy.data.objects.new("r34_front", me); sc.collection.objects.link(ob)
    tris = finish(ob, levels)
    w = wheel()
    print(f"cage faces {cage_quads}, level {levels}: {tris} triangles (front third, both sides)")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, "r34_front.glb"), use_selection=True)

    # studio
    bpy.ops.mesh.primitive_cube_add(size=1); blk = bpy.context.object; blk.scale = (1.3, 1.5, 0.5); blk.location = (0.15, 0, 0.5)
    blk.data.materials.append(material("block", "dark", 0.9))
    bpy.ops.mesh.primitive_plane_add(size=60); bpy.context.object.data.materials.append(material("floor", "lamp", 0.7))
    bpy.ops.object.light_add(type="SUN"); s = bpy.context.object; s.data.energy = 1.8; s.rotation_euler = (math.radians(48), 0, math.radians(-130)); s.data.angle = 0.25
    bpy.ops.object.light_add(type="AREA", location=(-3.5, 0, 3.2)); a = bpy.context.object; a.data.energy = 250; a.data.size = 5; look_at(a, (-0.5, 0, 0.5))
    wd = bpy.data.worlds.new("w"); sc.world = wd; wd.use_nodes = True
    wd.node_tree.nodes["Background"].inputs[0].default_value = (0.78, 0.8, 0.84, 1); wd.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 48; sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = 1000, 620
    sc.view_settings.view_transform = "Standard"
    sc.render.use_freestyle = True; sc.render.line_thickness = 1.4
    vl = sc.view_layers[0]; ls = vl.freestyle_settings.linesets.new("l")
    ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False; ls.select_edge_mark = True
    views = {
        "front34": ((-4.9, 3.6, 1.25), (0.0, 0, 0.55), False, 62),
        "front": ((-9, 0, 0.6), (0, 0, 0.6), True, 2.9),
        "side": ((-0.25, 9, 0.6), (-0.25, 0, 0.6), True, 2.9),
        "high34": ((-4.2, 2.6, 3.4), (0.1, 0, 0.5), False, 55),
    }
    files = []
    for vn, (loc, tgt, ortho, val) in views.items():
        cd = bpy.data.cameras.new(vn); cam = bpy.data.objects.new(vn, cd); sc.collection.objects.link(cam)
        cam.location = loc; look_at(cam, tgt)
        if ortho: cd.type = "ORTHO"; cd.ortho_scale = val
        else: cd.lens = val
        sc.camera = cam; sc.render.filepath = os.path.join(out, f"front_{vn}.png")
        bpy.ops.render.render(write_still=True); files.append(sc.render.filepath)
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (2000, 1270), (255, 255, 255)); d = ImageDraw.Draw(im)
    d.text((10, 8), f"R34 front third - subdivision cage test: {cage_quads} cage faces, level {levels}, {tris} triangles", fill=(0, 0, 0))
    for i, f in enumerate(files): im.paste(Image.open(f).convert("RGB"), ((i % 2) * 1000, 30 + (i // 2) * 620))
    im.save(os.path.join(out, f"r34_front_test_L{levels}.png"))


if __name__ == "__main__":
    args = sys.argv[1:]
    main(args[0], int(args[1]) if len(args) > 1 else 2)
