# The buildings' photographed materials (review 148): CC0 PBR sets from Poly Haven, fetched at 1K and packed at 512 for
# the live renderer, as tools/ref/polyhaven.py does for the ground: per material an albedo (sRGB JPEG), a normal (OpenGL
# convention) and one picture holding the ambient occlusion (red) and the roughness (green). Writes
# assets/textures/buildings/<layer>_{alb,nor,pack}.jpg and buildings.json (the layers in the order of the building
# kinds in render/car/mesh.ts, each its source, its size on the wall in metres, its mean colour, its authors; CC0).
#   python3 tools/ref/polyhaven_buildings.py
import json, io, urllib.request, os
from PIL import Image, ImageStat
LAYERS = [('brick', 'red_brick'), ('boards', 'white_planks_clean'), ('timber', 'weathered_planks'), ('corrugated', 'corrugated_iron_03'), ('tile', 'clay_roof_tiles_03'),
          ('slate', 'roof_slates_03'), ('render', 'painted_plaster_wall'), ('concrete', 'concrete_wall_008'), ('sheet', 'green_metal_rust')]
OUT, RES = 'assets/textures/buildings', 512
os.makedirs(OUT, exist_ok=True)
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'gearhouse-texture-fetch/1.0'}), timeout=90).read()
meta = []
for layer, pid in LAYERS:
    files, info = json.loads(get(f'https://api.polyhaven.com/files/{pid}')), json.loads(get(f'https://api.polyhaven.com/info/{pid}'))
    def img(key, mode):
        f = files[key]['1k']; url = (f.get('jpg') or f.get('png'))['url']; return Image.open(io.BytesIO(get(url))).convert(mode).resize((RES, RES), Image.LANCZOS)
    alb, nor, rough = img('Diffuse', 'RGB'), img('nor_gl', 'RGB'), img('Rough', 'L')
    ao = img('AO', 'L') if 'AO' in files else Image.new('L', (RES, RES), 255)
    alb.save(f'{OUT}/{layer}_alb.jpg', quality=88); nor.save(f'{OUT}/{layer}_nor.jpg', quality=88)
    Image.merge('RGB', (ao, rough, Image.new('L', (RES, RES), 128))).save(f'{OUT}/{layer}_pack.jpg', quality=88)
    mean = [round(v) for v in ImageStat.Stat(alb).mean]
    meta.append({'layer': layer, 'source': f'https://polyhaven.com/a/{pid}', 'size': round(info['dimensions'][0] / 1000, 2), 'mean': mean, 'rough': round(ImageStat.Stat(rough).mean[0] / 255, 3), 'authors': list(info['authors'].keys()), 'license': 'CC0'})
    print(layer, pid, meta[-1]['size'], 'm', '#%02x%02x%02x' % tuple(mean), meta[-1]['rough'])
json.dump({'about': 'Poly Haven CC0 materials for the buildings (review 148), packed at 512: alb, nor (GL), pack (R ao, G rough)', 'res': RES, 'layers': meta}, open(f'{OUT}/buildings.json', 'w'), indent=1)
