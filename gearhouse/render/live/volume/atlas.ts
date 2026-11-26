// The volume's 3D grid kept in a 2D texture (docs/systems/104 B-1): each horizontal slice (a z) a tile, the tiles laid
// in rows. A pass then draws the whole grid at once (one draw, not one per slice); a cell's neighbours above and below
// are in the next tiles. The same sums are written in GLSL below for the shaders (ATLAS_GLSL).
export interface Atlas { nx: number; ny: number; nz: number; /** tiles across and down */ cols: number; rows: number; /** the texture's size */ w: number; h: number }
/** the tiles' layout for a grid: no empty tile where it can be helped, then as square a texture as can be, within `max` wide */
export function atlasLayout(nx: number, ny: number, nz: number, max = 4096): Atlas { let best: Atlas | null = null, score = Infinity;
  for (let c = 1; c <= nz; c++) { if (c * nx > max) break; const r = Math.ceil(nz / c), waste = c * r - nz, s = waste * 1e6 + Math.abs(c * nx - r * ny);
    if (s < score) { score = s; best = { nx, ny, nz, cols: c, rows: r, w: c * nx, h: r * ny }; } }
  if (!best) throw new Error('volume grid too wide for the texture'); return best; }
/** the texel holding cell (i, j, k) */
export function atlasTexel(A: Atlas, i: number, j: number, k: number): [number, number] { return [(k % A.cols) * A.nx + i, Math.floor(k / A.cols) * A.ny + j]; }
/** the cell a texel holds (k past nz: an unused tile) */
export function atlasCell(A: Atlas, x: number, y: number): [number, number, number] { const tx = Math.floor(x / A.nx), ty = Math.floor(y / A.ny); return [x - tx * A.nx, y - ty * A.ny, ty * A.cols + tx]; }
/** the GLSL of the same: uniforms uN (the grid), uCols; cell of a fragment, texel of a cell, a fetch clamped to the grid */
export const ATLAS_GLSL = `
uniform ivec3 uN; uniform int uCols;
ivec3 cellOf(ivec2 t) { int tx = t.x / uN.x, ty = t.y / uN.y; return ivec3(t.x - tx * uN.x, t.y - ty * uN.y, ty * uCols + tx); }
ivec2 texOf(ivec3 c) { return ivec2((c.z % uCols) * uN.x + c.x, (c.z / uCols) * uN.y + c.y); }
ivec3 clampC(ivec3 c) { return clamp(c, ivec3(0), uN - 1); }
bool inside(ivec3 c) { return all(greaterThanEqual(c, ivec3(0))) && all(lessThan(c, uN)); }
vec4 at(sampler2D s, ivec3 c) { return texelFetch(s, texOf(clampC(c)), 0); }
/** trilinear of a field whose samples sit at (i, j, k) + off, at grid point p, clamped to the box's edge (the CPU's sample()) */
vec4 tri(sampler2D s, vec3 p, vec3 off) { vec3 f = clamp(p - off, vec3(0.), vec3(uN - 1)); ivec3 i0 = min(ivec3(floor(f)), uN - 2); vec3 a = f - vec3(i0);
  vec4 c000 = at(s, i0), c100 = at(s, i0 + ivec3(1, 0, 0)), c010 = at(s, i0 + ivec3(0, 1, 0)), c110 = at(s, i0 + ivec3(1, 1, 0));
  vec4 c001 = at(s, i0 + ivec3(0, 0, 1)), c101 = at(s, i0 + ivec3(1, 0, 1)), c011 = at(s, i0 + ivec3(0, 1, 1)), c111 = at(s, i0 + ivec3(1, 1, 1));
  return mix(mix(mix(c000, c100, a.x), mix(c010, c110, a.x), a.y), mix(mix(c001, c101, a.x), mix(c011, c111, a.x), a.y), a.z); }
`;
