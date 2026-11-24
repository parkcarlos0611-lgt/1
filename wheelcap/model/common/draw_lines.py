"""Line drawings of a car's character lines: orthographic side / front / rear / top and a 3/4 perspective."""
import math
from PIL import Image, ImageDraw

INK = (25, 25, 35)
GLASS = (40, 110, 190)
ARCH = (200, 70, 40)
WHEEL = (150, 150, 150)
GRID = (225, 228, 235)


def colour(tag):
    return GLASS if tag == "glass" else ARCH if tag.startswith("arch") else INK


def mirrored(lines):
    out = []
    for name, tag, pts in lines:
        out.append((name, tag, pts))
        if any(abs(p[1]) > 1e-6 for p in pts):
            out.append((name + "_R", tag, [(x, -y, z) for x, y, z in pts]))
    return out


def project(view, p, cam=None):
    x, y, z = p
    if view == "side":
        return x, -z
    if view == "front":   # looking at the nose: the car's left is on the right of the picture
        return y, -z
    if view == "rear":
        return -y, -z
    if view == "top":
        return x, -y
    if view == "persp":   # look-at pinhole camera; cam = (azimuth, elevation, distance, target)
        az, el, dist, t = cam
        cp = (t[0] + dist * math.cos(el) * math.cos(az), t[1] + dist * math.cos(el) * math.sin(az), t[2] + dist * math.sin(el))
        f = [t[i] - cp[i] for i in range(3)]; n = math.sqrt(sum(v * v for v in f)); f = [v / n for v in f]
        r = [f[1], -f[0], 0.0]; n = math.hypot(r[0], r[1]); r = [v / n for v in r]
        u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]
        v = [x - cp[0], y - cp[1], z - cp[2]]
        dep = sum(v[i] * f[i] for i in range(3))
        return sum(v[i] * r[i] for i in range(3)) * dist / dep, -sum(v[i] * u[i] for i in range(3)) * dist / dep
    raise ValueError(view)


def render(views, size=(1600, 1000), title=""):
    """views: list of (label, view, lines, wheels, box) where box = (x0, y0, x1, y1) in pixels.
    wheels: list of (x, y, z, r) circles drawn in the side / perspective views as grey rings."""
    im = Image.new("RGB", size, (250, 250, 252))
    d = ImageDraw.Draw(im)
    if title:
        d.text((16, 10), title, fill=INK)
    for label, view, lines, wheels, box, cam, scale in views:
        x0, y0, x1, y1 = box
        d.rectangle(box, outline=GRID)
        d.text((x0 + 6, y0 + 4), label, fill=(90, 90, 110))
        xs = [p[0] for _, _, ps in lines for p in ps]
        split = (min(xs) + max(xs)) / 2
        ml = mirrored(lines) if view in ("front", "rear", "top", "persp") else lines
        pts2 = [project(view, p, cam) for _, _, ps in ml for p in ps]
        minx, maxx = min(p[0] for p in pts2), max(p[0] for p in pts2)
        miny, maxy = min(p[1] for p in pts2), max(p[1] for p in pts2)
        cxp, cyp = (x0 + x1) / 2, (y0 + y1) / 2 + 8
        mx, my = (minx + maxx) / 2, (miny + maxy) / 2
        if view in ("side", "front", "rear"):
            my = miny / 2  # ground (screen y 0) and the top share the box evenly
        to = lambda q: (cxp + (q[0] - mx) * scale, cyp + (q[1] - my) * scale)
        if view in ("side", "front", "rear"):
            gy = to((0, 0))[1]
            d.line([(x0 + 4, gy), (x1 - 4, gy)], fill=GRID, width=1)
        for (wx, wy, wz, r) in wheels:
            if view == "side":
                c = to((wx, -wz)); rr = r * scale
                d.ellipse([c[0] - rr, c[1] - rr, c[0] + rr, c[1] + rr], outline=WHEEL, width=2)
            elif view == "persp":
                for sgn in (1, -1):
                    ring = [to(project(view, (wx + r * math.cos(t / 12 * math.pi), sgn * wy, wz + r * math.sin(t / 12 * math.pi)), cam)) for t in range(25)]
                    d.line(ring, fill=WHEEL, width=2)
        for name, tag, ps in ml:
            for a, b in zip(ps, ps[1:]):
                mid = (a[0] + b[0]) / 2
                if (view == "front" and mid > split) or (view == "rear" and mid < split):
                    continue
                d.line([to(project(view, a, cam)), to(project(view, b, cam))], fill=colour(tag), width=2)
            for p in ps:
                if (view == "front" and p[0] > split) or (view == "rear" and p[0] < split):
                    continue
                c = to(project(view, p, cam))
                d.ellipse([c[0] - 2, c[1] - 2, c[0] + 2, c[1] + 2], fill=colour(tag))
    return im
