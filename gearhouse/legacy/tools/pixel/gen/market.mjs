// E1 market link: buyer segments score each assembled car (0..100). Simple, data-driven weights.
export const SEGMENTS = {
  economy: { w: { price: 0.45, modern: 0.15, design: 0.10, prestige: 0.00, practical: 0.30 }, likes: ['economy', 'box'] },
  family:  { w: { price: 0.25, modern: 0.20, design: 0.15, prestige: 0.10, practical: 0.30 }, likes: ['family', 'stream'] },
  luxury:  { w: { price: 0.00, modern: 0.15, design: 0.30, prestige: 0.45, practical: 0.10 }, likes: ['luxury'] },
  sport:   { w: { price: 0.10, modern: 0.25, design: 0.40, prestige: 0.20, practical: 0.05 }, likes: ['sport', 'stream'] },
};
export function marketScores(r) {
  const price = Math.max(0, 1 - (r.cost - 10) / 25), prestige = Math.min(1, r.prestige / 22), design = r.score / 100;
  const modern = r.parts.era, practical = (r.type === 'sedan4d' ? 0.8 : 0.45) + (r.picks.trunk && r.picks.trunk !== 'tr_none' ? 0.15 : 0);
  const out = {};
  for (const [k, s] of Object.entries(SEGMENTS)) { const st = { price, modern, design, prestige, practical };
    let v = Object.entries(s.w).reduce((a, [m, w]) => a + w * st[m], 0);
    if (s.likes.includes(r.character)) v += 0.08; if (s.likes.includes(r.style)) v += 0.05;
    out[k] = Math.round(Math.min(1, v) * 100); }
  return out;
}
