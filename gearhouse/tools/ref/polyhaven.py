# The ground's photographed materials (review 124): CC0 PBR sets from Poly Haven, fetched at 1K and packed for the live
# renderer: per material an albedo (sRGB JPEG), a normal (OpenGL convention), and one picture holding the ambient
# occlusion (red), the roughness (green) and the height (blue). Writes assets/textures/ground/<layer>_{alb,nor,pack}.jpg
# and ground.json (the layers in order, each its source, its size on the ground in metres, its authors; CC0).
#   python3 tools/ref/polyhaven.py
import json, io, urllib.request, os
from PIL import Image
LAYERS = [('slab', 'granular_concrete'), ('slab2', 'gravel_concrete'), ('cracks', 'cracked_concrete'), ('tar', 'tarred_gravel'), ('rubber', 'asphalt_track'), ('moss', 'concrete_moss'), ('paint', 'rough_concrete'), ('verge', 'grass_path_3'), ('grass', 'grass_ground')]
OUT, RES = 'assets/textures/ground', 1024
os.makedirs(OUT, exist_ok=True)
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'gearhouse-texture-fetch/1.0'}), timeout=60).read()
meta = []
for layer, pid in LAYERS:
    files, info = json.loads(get(f'https://api.polyhaven.com/files/{pid}')), json.loads(get(f'https://api.polyhaven.com/info/{pid}'))
    def img(key, mode):
        f = files[key]['1k']; url = (f.get('jpg') or f.get('png'))['url']; return Image.open(io.BytesIO(get(url))).convert(mode).resize((RES, RES), Image.LANCZOS)
    alb, nor, rough = img('Diffuse', 'RGB'), img('nor_gl', 'RGB'), img('Rough', 'L')
    ao = img('AO', 'L') if 'AO' in files else Image.new('L', (RES, RES), 255)
    disp = img('Displacement', 'L') if 'Displacement' in files else Image.new('L', (RES, RES), 128)
    alb.save(f'{OUT}/{layer}_alb.jpg', quality=86); nor.save(f'{OUT}/{layer}_nor.jpg', quality=90)
    Image.merge('RGB', (ao, rough, disp)).save(f'{OUT}/{layer}_pack.jpg', quality=90)
    meta.append({'layer': layer, 'source': f'https://polyhaven.com/a/{pid}', 'size': round(info['dimensions'][0] / 1000, 2), 'authors': list(info['authors'].keys()), 'license': 'CC0'})
    print(layer, pid, meta[-1]['size'], 'm')
json.dump({'about': 'Poly Haven CC0 materials for the concrete (review 124), 1K, packed: alb, nor (GL), pack (R ao, G rough, B height)', 'res': RES, 'layers': meta}, open(f'{OUT}/ground.json', 'w'), indent=1)
