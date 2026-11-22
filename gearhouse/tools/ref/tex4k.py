"""The 4K PBR textures for the photo-mode prototype (review 114), fetched from Poly Haven (CC0) and saved as the page's
files: tex4k/<name>_alb.jpg and _nor.jpg at 4096 px, JPEG quality 84. Too large for the repository: run this, then publish
ui/photo.html with these files beside it.  python3 -I tools/ref/tex4k.py <out dir>"""
import json, os, sys, urllib.request, io
from PIL import Image
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'gearhouse-texture-fetch'}), timeout=120).read()
for src, name in [('brushed_concrete_03', 'concrete'), ('blue_metal_plate', 'metal'), ('brown_leather', 'leather'), ('waffle_pique_cotton', 'cotton')]:
    files = json.loads(get(f'https://api.polyhaven.com/files/{src}'))
    for key, tag in [('Diffuse', 'alb'), ('nor_gl', 'nor')]:
        im = Image.open(io.BytesIO(get(files[key]['4k']['jpg']['url']))).convert('RGB').resize((4096, 4096), Image.LANCZOS)
        im.save(f'{out}/{name}_{tag}.jpg', quality=84, optimize=True); print(name, tag)
