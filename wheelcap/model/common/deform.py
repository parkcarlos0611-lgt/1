"""Wheelcap deformation: real proportions -> chibi proportions, from one table.

Rules (why: flat faces stay flat, straight lines stay straight, round parts stay round):
- x is mapped piecewise-linearly through four stations: front end, front axle, rear axle, rear end.
  Inside each segment the map is affine, so a flat panel stays flat (no smooth warp of space).
- y (width) is a plain factor.
- z is a plain factor below the beltline; the greenhouse above it gets an extra factor.
- wheel-arch lines (tag archF / archR) are wheel-relative: they keep their shape around the wheel centre and are
  scaled with the wheel, then placed at the deformed wheel centre. Arches never stretch.
"""

REAL = dict(overhang_f=1.0, wheelbase=1.0, overhang_r=1.0, width=1.0, height=1.0, greenhouse=1.0, wheel=1.0)

CHIBI = dict(
    overhang_f=0.78,   # front overhang length
    wheelbase=0.86,
    overhang_r=0.78,
    width=1.05,
    height=1.04,       # whole body
    greenhouse=1.05,   # extra, above the beltline only
    wheel=1.12,        # wheel and tyre diameter (arches follow)
)


class Deformer:
    def __init__(self, p, front_end, rear_end, wheelbase, wheels, beltline_z=880.0):
        self.p, self.beltline = p, beltline_z
        self.front_end, self.rear_end, self.wb = front_end, rear_end, wheelbase
        self.wheels = wheels  # {"F": (x, z, r), "R": (x, z, r)}

    def x(self, x):
        p = self.p
        if x < 0:
            return x * p["overhang_f"]
        if x <= self.wb:
            return x * p["wheelbase"]
        return self.wb * p["wheelbase"] + (x - self.wb) * p["overhang_r"]

    def z(self, z):
        p = self.p
        if z <= self.beltline:
            return z * p["height"]
        return self.beltline * p["height"] + (z - self.beltline) * p["height"] * p["greenhouse"]

    def wheel(self, key):
        x, z, r = self.wheels[key]
        rr = r * self.p["wheel"]
        return self.x(x), rr, rr  # centre sits at its new radius: the tyre still touches the ground

    def point(self, pt, tag="body"):
        x, y, z = pt
        y2 = y * self.p["width"]
        if tag in ("archF", "archR"):
            k = tag[-1]
            cx, cz, _ = self.wheels[k]
            ncx, ncz, _ = self.wheel(k)
            s = self.p["wheel"]
            return (ncx + (x - cx) * s, y2, ncz + (z - cz) * s)
        return (self.x(x), y2, self.z(z))
