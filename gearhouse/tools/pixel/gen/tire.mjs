// Bias-ply tyre code "W-D" (inches) -> dimensions in mm.
export function tire(code) {
  const [w, d] = code.split('-').map(Number);
  const od = (d + 2 * 0.98 * w) * 25.4, rim = d * 25.4 + 24, section = w * 25.4;
  return { code, od, rim, section, r: od / 2, frac: (od - rim) / od };
}
