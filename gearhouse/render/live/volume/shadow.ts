// The smoke's shadow on the ground and the cars (docs/systems/104 B-1, step V5). The light's grid (light.ts) already
// holds, for every point of the box, the share of the sun that comes through the smoke; a lit surface there gets only
// that share of its sunlight. Read in the smoke's own upsample pass (draw.ts) at each pixel's surface, rebuilt from the
// scene's depth, so the renderer's ground and car shaders are left as they are: the pixel's colour is darkened by
// k x (1 - the share) (the sky's light, which the smoke hides less, keeps the rest). Needs COMMON's sunAt and grid.
export const SHADOW_GLSL = `
float smokeShadow(vec3 p, float k) { vec3 g = grid(p + uSun * uH * 0.6), N = vec3(uN); if (any(lessThan(g, vec3(0.))) || any(greaterThan(g, N))) return 1.;
  float e = clamp(min(min(min(g.x, g.y), min(N.x - g.x, N.y - g.y)), N.z - g.z) / 3., 0., 1.); return mix(1., sunAt(p + uSun * uH * 0.6), k * e); }
`;
