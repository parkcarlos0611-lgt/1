// The ground's photographed materials (review 124): Poly Haven CC0 sets fetched by tools/ref/polyhaven.py, their
// pictures as files beside the page (a several-file page), loaded once the page is up, then handed to the renderer.
import meta from '../../assets/textures/ground/ground.json';
import slabA from '../../assets/textures/ground/slab_alb.jpg'; import slabN from '../../assets/textures/ground/slab_nor.jpg'; import slabP from '../../assets/textures/ground/slab_pack.jpg';
import slab2A from '../../assets/textures/ground/slab2_alb.jpg'; import slab2N from '../../assets/textures/ground/slab2_nor.jpg'; import slab2P from '../../assets/textures/ground/slab2_pack.jpg';
import crackA from '../../assets/textures/ground/cracks_alb.jpg'; import crackN from '../../assets/textures/ground/cracks_nor.jpg'; import crackP from '../../assets/textures/ground/cracks_pack.jpg';
import tarA from '../../assets/textures/ground/tar_alb.jpg'; import tarN from '../../assets/textures/ground/tar_nor.jpg'; import tarP from '../../assets/textures/ground/tar_pack.jpg';
import rubA from '../../assets/textures/ground/rubber_alb.jpg'; import rubN from '../../assets/textures/ground/rubber_nor.jpg'; import rubP from '../../assets/textures/ground/rubber_pack.jpg';
import mossA from '../../assets/textures/ground/moss_alb.jpg'; import mossN from '../../assets/textures/ground/moss_nor.jpg'; import mossP from '../../assets/textures/ground/moss_pack.jpg';
import paintA from '../../assets/textures/ground/paint_alb.jpg'; import paintN from '../../assets/textures/ground/paint_nor.jpg'; import paintP from '../../assets/textures/ground/paint_pack.jpg';
import vergeA from '../../assets/textures/ground/verge_alb.jpg'; import vergeN from '../../assets/textures/ground/verge_nor.jpg'; import vergeP from '../../assets/textures/ground/verge_pack.jpg';
import grassA from '../../assets/textures/ground/grass_alb.jpg'; import grassN from '../../assets/textures/ground/grass_nor.jpg'; import grassP from '../../assets/textures/ground/grass_pack.jpg';
import type { LiveRenderer } from './renderer';
const URLS = [[slabA, slabN, slabP], [slab2A, slab2N, slab2P], [crackA, crackN, crackP], [tarA, tarN, tarP], [rubA, rubN, rubP], [mossA, mossN, mossP], [paintA, paintN, paintP], [vergeA, vergeN, vergeP], [grassA, grassN, grassP]];
/** load the nine materials (each three pictures) at `res` (1024 full; 512 on small devices) and give them to the renderer */
export async function loadGround(L: LiveRenderer, res = (meta as { res: number }).res): Promise<void> {
  const bm = async (u: string) => { const b = await (await fetch(u)).blob(); return createImageBitmap(b, { resizeWidth: res, resizeHeight: res, colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); };
  const layers = await Promise.all(URLS.map(async ([a, n, p]) => { const [alb, nor, pack] = await Promise.all([bm(a!), bm(n!), bm(p!)]); return { alb, nor, pack }; }));
  L.setGroundMaterials(layers, (meta as { layers: { size: number }[] }).layers.map(l => l.size), res); }
import bMeta from '../../assets/textures/buildings/buildings.json';
import brickA from '../../assets/textures/buildings/brick_alb.jpg'; import brickN from '../../assets/textures/buildings/brick_nor.jpg'; import brickP from '../../assets/textures/buildings/brick_pack.jpg';
import boardsA from '../../assets/textures/buildings/boards_alb.jpg'; import boardsN from '../../assets/textures/buildings/boards_nor.jpg'; import boardsP from '../../assets/textures/buildings/boards_pack.jpg';
import timberA from '../../assets/textures/buildings/timber_alb.jpg'; import timberN from '../../assets/textures/buildings/timber_nor.jpg'; import timberP from '../../assets/textures/buildings/timber_pack.jpg';
import corrA from '../../assets/textures/buildings/corrugated_alb.jpg'; import corrN from '../../assets/textures/buildings/corrugated_nor.jpg'; import corrP from '../../assets/textures/buildings/corrugated_pack.jpg';
import tileA from '../../assets/textures/buildings/tile_alb.jpg'; import tileN from '../../assets/textures/buildings/tile_nor.jpg'; import tileP from '../../assets/textures/buildings/tile_pack.jpg';
import slateA from '../../assets/textures/buildings/slate_alb.jpg'; import slateN from '../../assets/textures/buildings/slate_nor.jpg'; import slateP from '../../assets/textures/buildings/slate_pack.jpg';
import renderA from '../../assets/textures/buildings/render_alb.jpg'; import renderN from '../../assets/textures/buildings/render_nor.jpg'; import renderP from '../../assets/textures/buildings/render_pack.jpg';
import concA from '../../assets/textures/buildings/concrete_alb.jpg'; import concN from '../../assets/textures/buildings/concrete_nor.jpg'; import concP from '../../assets/textures/buildings/concrete_pack.jpg';
import sheetA from '../../assets/textures/buildings/sheet_alb.jpg'; import sheetN from '../../assets/textures/buildings/sheet_nor.jpg'; import sheetP from '../../assets/textures/buildings/sheet_pack.jpg';
const B_URLS = [[brickA, brickN, brickP], [boardsA, boardsN, boardsP], [timberA, timberN, timberP], [corrA, corrN, corrP], [tileA, tileN, tileP], [slateA, slateN, slateP], [renderA, renderN, renderP], [concA, concN, concP], [sheetA, sheetN, sheetP]];
/** the buildings' photographed materials (review 126; Poly Haven CC0, fetched by tools/ref/polyhaven_buildings.py): nine
 *  layers in the order of the building kinds (render/car/mesh.ts KINDS from 'brick'), each three pictures at 512 */
export async function loadBuildings(L: LiveRenderer): Promise<void> { const m = bMeta as { res: number; layers: { size: number; mean: number[] }[] }, res = m.res;
  const bm = async (u: string) => createImageBitmap(await (await fetch(u)).blob(), { resizeWidth: res, resizeHeight: res, colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const layers = await Promise.all(B_URLS.map(async ([a, n, p]) => { const [alb, nor, pack] = await Promise.all([bm(a!), bm(n!), bm(p!)]); return { alb, nor, pack }; }));
  L.setBuildingMaterials(layers, m.layers.map(l => l.size), m.layers.map(l => l.mean), res); }
import skyPng from '../../assets/textures/sky/sky.png';
import skyMeta from '../../assets/textures/sky/sky.json';
/** the photographed sky (review 124) */
export async function loadSky(L: LiveRenderer): Promise<void> { const b = await (await fetch(skyPng)).blob(), bm = await createImageBitmap(b, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const m = skyMeta as { range: number; sh: number[][] }; L.setSky(bm, m.range, m.sh); }
import { PROP_MODELS } from './propmodels';
import { readGltf, materialUris } from './gltf';
import { paddockProps, propMatrices } from './paddock';
import type { Track } from '../../race/track';
/** the photographed props (review 125): each model's glTF, buffer and pictures loaded, then its copies placed */
export async function loadProps(L: LiveRenderer, T: Track): Promise<void> { const base: Record<string, { min: number[]; max: number[] }> = {};
  await Promise.all(Object.entries(PROP_MODELS).map(async ([id, m]) => { const g = m.gltf, bin = await (await fetch(m.files[g.buffers[0]!.uri]!)).arrayBuffer(), geo = readGltf(g, bin), u = materialUris(g);
    const pic = async (uri?: string) => createImageBitmap(await (await fetch(m.files[uri!]!)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const [alb, nor, arm] = await Promise.all([pic(u.alb), pic(u.nor), pic(u.arm)]); L.addPropModel(id, geo, { alb, nor, arm }); base[id] = { min: geo.min, max: geo.max }; }));
  let n = 0; for (const [id, mats] of propMatrices(T, paddockProps(), base)) { L.setPropInstances(id, mats); n += mats.length / 16; } console.info('props placed', n); }
