// A small glTF 2.0 reader (review 125) for the circuit's props: every mesh of the default scene with its nodes'
// transforms baked in, turned from glTF's Y-up to the game's Z-up (x, y, z) -> (x, -z, y), metres; positions, normals,
// texture coordinates and indices; the first material's three pictures (base colour, normal, ao-rough-metal).
export interface Gltf { scenes?: { nodes: number[] }[]; scene?: number; nodes: { mesh?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] }[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; material?: number }[] }[]; accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[]; buffers: { uri: string }[]; images?: { uri: string }[]; textures?: { source: number }[];
  materials?: { normalTexture?: { index: number }; pbrMetallicRoughness?: { baseColorTexture?: { index: number }; metallicRoughnessTexture?: { index: number } } }[] }
export interface PropGeo { pos: Float32Array; nor: Float32Array; uv: Float32Array; idx: Uint32Array; /** its footprint and height (m) */ min: number[]; max: number[] }
type M4 = number[];
const mulM = (a: M4, b: M4): M4 => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r]! * b[c * 4 + k]!; return o; };
function local(n: Gltf['nodes'][number]): M4 { if (n.matrix) return n.matrix.slice(); const T = n.translation ?? [0, 0, 0], R = n.rotation ?? [0, 0, 0, 1], S = n.scale ?? [1, 1, 1], tx = T[0]!, ty = T[1]!, tz = T[2]!, x = R[0]!, y = R[1]!, z = R[2]!, w = R[3]!, sx = S[0]!, sy = S[1]!, sz = S[2]!;
  return [(1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0, (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
    (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1]; }
/** the geometry from the parsed .gltf and its buffer */
export function readGltf(g: Gltf, bin: ArrayBuffer): PropGeo {
  const read = (ai: number): { a: Float32Array | Uint32Array; n: number } => { const A = g.accessors[ai]!, V = g.bufferViews[A.bufferView]!, n = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[A.type]!, off = (V.byteOffset ?? 0) + (A.byteOffset ?? 0), dv = new DataView(bin);
    const size = A.componentType === 5126 || A.componentType === 5125 ? 4 : A.componentType === 5123 ? 2 : 1, stride = V.byteStride ?? size * n, out = A.componentType === 5126 ? new Float32Array(A.count * n) : new Uint32Array(A.count * n);
    for (let i = 0; i < A.count; i++) for (let k = 0; k < n; k++) { const p = off + i * stride + k * size; out[i * n + k] = A.componentType === 5126 ? dv.getFloat32(p, true) : A.componentType === 5125 ? dv.getUint32(p, true) : A.componentType === 5123 ? dv.getUint16(p, true) : dv.getUint8(p); }
    return { a: out, n }; };
  const P: number[] = [], N: number[] = [], U: number[] = [], I: number[] = [];
  const visit = (ni: number, parent: M4) => { const node = g.nodes[ni]!, M = mulM(parent, local(node));
    if (node.mesh !== undefined) for (const pr of g.meshes[node.mesh]!.primitives) { const base = P.length / 3, pos = read(pr.attributes.POSITION!).a as Float32Array, nor = pr.attributes.NORMAL !== undefined ? read(pr.attributes.NORMAL).a as Float32Array : null, uv = pr.attributes.TEXCOORD_0 !== undefined ? read(pr.attributes.TEXCOORD_0).a as Float32Array : null;
      for (let i = 0; i < pos.length / 3; i++) { const x = pos[i * 3]!, y = pos[i * 3 + 1]!, z = pos[i * 3 + 2]!, wx = M[0]! * x + M[4]! * y + M[8]! * z + M[12]!, wy = M[1]! * x + M[5]! * y + M[9]! * z + M[13]!, wz = M[2]! * x + M[6]! * y + M[10]! * z + M[14]!;
        P.push(wx, -wz, wy); if (nor) { const a = nor[i * 3]!, b = nor[i * 3 + 1]!, c = nor[i * 3 + 2]!, nx = M[0]! * a + M[4]! * b + M[8]! * c, ny = M[1]! * a + M[5]! * b + M[9]! * c, nz = M[2]! * a + M[6]! * b + M[10]! * c, l = Math.hypot(nx, ny, nz) || 1; N.push(nx / l, -nz / l, ny / l); } else N.push(0, 0, 1);
        U.push(uv ? uv[i * 2]! : 0, uv ? uv[i * 2 + 1]! : 0); }
      if (pr.indices !== undefined) for (const k of read(pr.indices).a) I.push(base + k); else for (let i = 0; i < pos.length / 3; i++) I.push(base + i); }
    for (const c of node.children ?? []) visit(c, M); };
  for (const r of g.scenes?.[g.scene ?? 0]?.nodes ?? g.nodes.map((_, i) => i)) visit(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < P.length; i++) { min[i % 3] = Math.min(min[i % 3]!, P[i]!); max[i % 3] = Math.max(max[i % 3]!, P[i]!); }
  return { pos: new Float32Array(P), nor: new Float32Array(N), uv: new Float32Array(U), idx: new Uint32Array(I), min, max }; }
/** the uris of the first material's base colour, normal and ao-rough-metal pictures */
export function materialUris(g: Gltf): { alb?: string; nor?: string; arm?: string } { const m = g.materials?.[0], uri = (t?: { index: number }) => t ? g.images?.[g.textures?.[t.index]?.source ?? -1]?.uri : undefined;
  return { alb: uri(m?.pbrMetallicRoughness?.baseColorTexture), nor: uri(m?.normalTexture), arm: uri(m?.pbrMetallicRoughness?.metallicRoughnessTexture) }; }
