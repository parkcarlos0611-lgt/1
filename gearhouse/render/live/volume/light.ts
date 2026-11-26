// The light's grid for the volumetric smoke (docs/systems/104 B-2 step 10): for each cell at half the resolution (2x2x2
// cells a sample), the share of the sunlight reaching it through the smoke, exp(-sigma x the density along the way to
// the sun, two cells a step); the reference's light() (race/volume/sim.ts). The drawing reads it for the sun's light on
// the smoke (draw.ts), the ground and the cars read it for the smoke's shadow (shadow.ts). Made every second frame.
// A pass of the simulation (simgpu.ts runs it); its own grid's size in uNL, uColsL; the sun in grid steps in uSunG.
export const LIGHT_FS = `uniform sampler2D uScal; uniform ivec3 uNL; uniform int uColsL; uniform vec3 uSunG; uniform float uSigma; out vec4 o;\n
void main() { ivec2 t = ivec2(gl_FragCoord.xy); int tx = t.x / uNL.x, ty = t.y / uNL.y; ivec3 c = ivec3(t.x - tx * uNL.x, t.y - ty * uNL.y, ty * uColsL + tx); if (c.z >= uNL.z) { o = vec4(1.); return; }
  vec3 p = vec3(c) * 2. + 1.; float tau = 0.; vec3 N = vec3(uN);
  for (int s = 0; s < 64; s++) { p += uSunG * 2.; if (p.x < 0. || p.y < 0. || p.x > N.x || p.y > N.y || p.z > N.z) break; vec4 a = tri(uScal, p, vec3(.5)); tau += uSigma * 2. * uH * (a.r + a.g); }
  o = vec4(exp(-tau), 0., 0., 1.); }`;
