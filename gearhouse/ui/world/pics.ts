// Pictures decoded once into RGBA pixels (the place pictures are inlined in the page as data URLs). Returns null until
// the browser has decoded the picture; callers draw a plain screen meanwhile.
const cache = new Map<string, Uint8ClampedArray | null>();
export function pixels(url: string, w = 480, h = 270): Uint8ClampedArray | null {
  if (cache.has(url)) return cache.get(url)!; cache.set(url, null);
  const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true })!; x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, w, h); cache.set(url, x.getImageData(0, 0, w, h).data); }; im.src = url; return null; }
