"""Build the R34 character-line review sheets: real proportions vs chibi, plus an overlay on the blueprint.

usage: python3 build_lines.py OUT_DIR [BLUEPRINT.gif]
The blueprint is a third-party drawing: it is read from outside the repository and the overlay is written only to OUT_DIR.
"""
import json, math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "common"))
import ref_lines as R
from deform import Deformer, REAL, CHIBI
from draw_lines import render, INK, GLASS, ARCH

STANDARD_WIDTH = 1785 / 1834   # the drawing is the wider Z-tune body; the base car is the standard GT-R


def build(params):
    wheels = {k: v for k, v in R.WHEELS.items()}
    d = Deformer(params, R.FRONT_END, R.REAR_END, R.WHEELBASE, wheels)
    lines = []
    for name, tag, pts in R.LINES:
        std = [(x, y * STANDARD_WIDTH, z) for x, y, z in pts]
        lines.append((name, tag, [d.point(p, tag) for p in std]))
    wl = []
    for k in ("F", "R"):
        cx, cz, r = d.wheel(k)
        wl.append((cx, R.TRACK_HALF * params["width"], cz, r))
    return lines, wl


def sheet(out):
    views = []
    cols = [("REAL", REAL), ("CHIBI", CHIBI)]
    W, H = 1700, 1400
    for i, (label, p) in enumerate(cols):
        lines, wl = build(p)
        x0 = 10 + i * (W // 2)
        x1 = x0 + W // 2 - 20
        cam = (math.radians(145), math.radians(20), 16000, (1100 * (0.86 if label == "CHIBI" else 1), 0, 500))
        views += [
            (f"{label}  side", "side", lines, wl, (x0, 30, x1, 330), None, 0.15),
            (f"{label}  front", "front", lines, wl, (x0, 340, (x0 + x1) // 2 - 5, 640), None, 0.15),
            (f"{label}  rear", "rear", lines, wl, ((x0 + x1) // 2 + 5, 340, x1, 640), None, 0.15),
            (f"{label}  top", "top", lines, wl, (x0, 650, x1, 960), None, 0.15),
            (f"{label}  3/4", "persp", lines, wl, (x0, 970, x1, 1390), cam, 0.16),
        ]
    im = render(views, (W, H), "R34 character lines v1 - left: real proportions (standard width), right: chibi  |  black body, blue greenhouse, red wheel arches")
    im.save(os.path.join(out, "r34_lines_v1.png"))


def overlay(out, bp):
    from PIL import Image, ImageDraw
    im = Image.open(bp).convert("RGB")
    im = im.resize((im.width * 2, im.height * 2))
    d = ImageDraw.Draw(im)
    K = R.K
    def side(p): return (2 * (R.AXLE_F_PX + p[0] / K), 2 * (R.GROUND_SIDE - p[2] / K))
    def plan(p, s): return (2 * (R.AXLE_F_PX + p[0] / K), 2 * (536 - s * p[1] / K))
    def front(p, s): return (2 * (220 - s * p[1] / K), 2 * (307 - p[2] / K))
    def rear(p, s): return (2 * (220 + s * p[1] / K), 2 * (683 - p[2] / K))
    for name, tag, pts in R.LINES:
        c = GLASS if tag == "glass" else ARCH if tag.startswith("arch") else (230, 0, 120)
        d.line([side(p) for p in pts], fill=c, width=3)
        for s in (1, -1):
            d.line([plan(p, s) for p in pts], fill=c, width=3)
            front_pts = [p for p in pts if p[0] < 600]
            rear_pts = [p for p in pts if p[0] > 2000]
            if len(front_pts) > 1: d.line([front(p, s) for p in front_pts], fill=c, width=3)
            if len(rear_pts) > 1: d.line([rear(p, s) for p in rear_pts], fill=c, width=3)
    im.save(os.path.join(out, "r34_overlay_v1.png"))


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    sheet(out)
    if len(sys.argv) > 2:
        overlay(out, sys.argv[2])
    json.dump({"real": build(REAL)[0], "chibi": build(CHIBI)[0]}, open(os.path.join(out, "r34_lines.json"), "w"))
