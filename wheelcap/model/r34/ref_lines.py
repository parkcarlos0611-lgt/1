"""R34 reference character lines, read by hand from the 4-view blueprint (Z-tune drawing, 1500x756 px).

Blueprint calibration (measured, see docs/01_r34_lines.md):
  scale K        = 4.517 mm/px (wheelbase 2665 mm = 590 px)
  side view      front axle at px 680, ground at py 303  (car faces left)
  plan view      centreline at py 536
  front view     centreline at px 220, ground at py 307
  rear view      centreline at px 220, ground at py 683

Car coordinates (mm): x from the front axle, positive rearwards; y to the car's left; z up from the ground.
Only the left half is stored; the right half is the mirror.

Each line: name, tag, points. A point is (side_px_x, side_py_z, y_mm) unless the line says otherwise.
Tags drive the deformation: 'body' (default), 'archF' / 'archR' (wheel-relative), 'glass' (greenhouse).
"""
import math

K = 4.517
AXLE_F_PX, GROUND_SIDE = 680, 303
AXLE_R_PX = 1270
WHEEL_R_PX = 74          # tyre radius in the drawing
WHEELBASE = (AXLE_R_PX - AXLE_F_PX) * K


def sx(px):
    return (px - AXLE_F_PX) * K


def sz(py):
    return (GROUND_SIDE - py) * K


def side(pts):
    """(px, py, y_mm) -> (x, y, z) mm"""
    return [(sx(px), y, sz(py)) for px, py, y in pts]


def arch(cx_px, r_px, y, a0, a1, n=9):
    """Wheel-arch lip as a polyline: angle 0 = front of the wheel, 90 = top (degrees)."""
    pts = []
    for i in range(n):
        a = math.radians(a0 + (a1 - a0) * i / (n - 1))
        pts.append((sx(cx_px - r_px * math.cos(a)), y, sz(GROUND_SIDE - WHEEL_R_PX - r_px * math.sin(a))))
    return pts


def circle_yz(x, yc, zc, r, n=12):
    return [(x, yc + r * math.cos(2 * math.pi * i / n), zc + r * math.sin(2 * math.pi * i / n)) for i in range(n + 1)]


LINES = [
    # --- silhouette and top surfaces -------------------------------------------------------------
    ("centre_profile", "body", side([
        (482, 272, 0), (478, 240, 0), (478, 200, 0), (481, 170, 0), (490, 152, 0), (520, 139, 0), (556, 121, 0),
        (600, 115, 0), (660, 107, 0), (720, 100, 0), (764, 96, 0), (790, 97, 0)])),
    ("roof_centre", "glass", side([
        (790, 97, 0), (916, 24, 0), (960, 15, 0), (1020, 9, 0), (1060, 8, 0), (1100, 9, 0), (1140, 13, 0),
        (1176, 19, 0), (1250, 48, 0), (1338, 84, 0)])),
    ("deck_centre", "body", side([
        (1338, 84, 0), (1400, 86, 0), (1440, 90, 0), (1460, 96, 0), (1468, 120, 0), (1472, 150, 0),
        (1484, 172, 0), (1488, 205, 0), (1480, 235, 0), (1470, 262, 0), (1462, 272, 0)])),
    # the crease where the top surfaces turn down into the flank: fender top, door top, quarter, tail corner
    ("shoulder", "body", side([
        (494, 152, 470), (520, 142, 640), (556, 126, 760), (620, 114, 815), (700, 106, 830), (790, 104, 830),
        (840, 108, 822), (1000, 108, 822), (1100, 104, 822), (1200, 92, 815), (1340, 88, 790),
        (1430, 90, 730), (1458, 98, 620)])),
    # --- flank -----------------------------------------------------------------------------------
    ("side_crease", "body", side([(780, 193, 885), (900, 193, 872), (1050, 192, 872), (1160, 191, 885)])),
    ("rear_blister_top", "body", side([(1110, 150, 845), (1250, 134, 880), (1380, 126, 880), (1440, 124, 860)])),
    ("rocker", "body", side([(760, 276, 870), (900, 277, 865), (1050, 277, 865), (1180, 276, 870)])),
    ("front_lower", "body", side([(482, 272, 0), (484, 272, 500), (500, 272, 760), (560, 272, 880), (600, 272, 905)])),
    ("rear_lower", "body", side([(1462, 272, 0), (1460, 272, 500), (1440, 272, 760), (1380, 272, 870), (1350, 272, 900)])),
    ("arch_front", "archF", arch(AXLE_F_PX, 92, 905, -12, 192)),
    ("arch_rear", "archR", arch(AXLE_R_PX, 95, 905, -12, 192)),
    # --- greenhouse ------------------------------------------------------------------------------
    ("cowl", "glass", side([(790, 97, 0), (794, 98, 400), (800, 100, 720)])),
    ("a_pillar", "glass", side([(800, 100, 720), (860, 58, 610), (915, 25, 500)])),
    ("roof_edge", "glass", side([(915, 25, 500), (1000, 14, 540), (1100, 16, 560), (1178, 22, 555)])),
    ("c_pillar", "glass", side([(1178, 22, 555), (1260, 52, 560), (1338, 84, 546)])),
    ("rear_glass_base", "glass", side([(1338, 84, 546), (1338, 84, 300), (1338, 84, 0)])),
    ("side_glass", "glass", side([
        (845, 106, 790), (915, 32, 545), (1068, 28, 560), (1105, 100, 775), (845, 106, 790)])),
    ("quarter_glass", "glass", side([(1112, 97, 775), (1100, 32, 560), (1150, 35, 570), (1205, 82, 700), (1112, 97, 775)])),
    # --- lamps and openings (front / rear faces) ---------------------------------------------------
    ("headlight", "body", [(sx(482), 385, 583), (sx(485), 380, 735), (sx(545), 760, 745), (sx(520), 770, 600), (sx(482), 385, 583)]),
    ("grille", "body", [(sx(479), 0, 664), (sx(480), 316, 664), (sx(481), 316, 560), (sx(479), 0, 560)]),
    ("bumper_top", "body", side([(482, 182, 0), (484, 182, 420), (490, 181, 720), (560, 178, 860), (600, 175, 900)])),
    ("tail_lamp_outer", "body", circle_yz(sx(1462), 678, 840, 95)),
    ("tail_lamp_inner", "body", circle_yz(sx(1466), 420, 827, 86)),
    ("rear_bumper_top", "body", side([(1468, 162, 0), (1466, 162, 600), (1450, 160, 790), (1400, 158, 870)])),
]

WHEELS = {  # centre (x, z) and radius in mm, from the drawing
    "F": (sx(AXLE_F_PX), WHEEL_R_PX * K, WHEEL_R_PX * K),
    "R": (sx(AXLE_R_PX), WHEEL_R_PX * K, WHEEL_R_PX * K),
}
FRONT_END, REAR_END = sx(478), sx(1489)
TRACK_HALF = 760   # wheel centre plane, approx. (standard GT-R track 1480/1490)
