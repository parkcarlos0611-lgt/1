// Prototype C (review 33): the consultation at the kitchen table. A plain 1930s kitchen: wallpaper over beadboard, the
// window over the sink showing the weather and the hour outside, the range with its kettle, a hanging lamp lit when it
// gets dark, a checked cloth on the table. The customer sits across the table, facing you. Each question costs one of
// the few the customer has patience for; serving tea or coffee (a fade, then steaming cups on the table) buys three more,
// twice at most, and only while the pantry has some. Small talk spends a question but warms the customer (a warmer
// customer names a looser budget). When nothing is left the customer takes their leave. Time stands still meanwhile.
// What was learnt goes on the notepad; in the game it becomes the drawing board's checklist.
import type { App, Scene } from '../shell/app';
import { split, COL, rnd, mix, type Rect } from '../pixel/kit';
import { hex, type RGB } from '../pixel/screen';
import { pantry } from './pantry';

const W = 480, H = 270;
interface Topic { id: string; ask: string; answer: (warm: number) => string; note?: (warm: number) => string; warmth?: number }
/** the doctor of the demo order: what they will say, how much depends on how warm the talk has got */
const TOPICS: Topic[] = [
  { id: 'car', ask: '어떤 차를 생각하고 계십니까?', answer: () => '문 넷 달린 세단이면 좋겠습니다. 다만 제가 키가 커서, 모자를 쓰고 앉아도 천장에 닿지 않아야 합니다.', note: () => '4도어 세단 · 머리 공간 (전고 1850 이상)' },
  { id: 'use', ask: '주로 어디를 다니십니까?', answer: () => '왕진이 많습니다. 읍내를 벗어나면 길이 엉망이지요. 진흙탕에 바닥이 걸리지 않았으면 합니다. 그리고 왕진 가방을 실을 곳이 있어야 해요.', note: () => '시골길: 지상고 310 이상 · 왕진 가방 짐받이' },
  { id: 'family', ask: '함께 타실 분이 계십니까?', answer: () => '아내와 아이 둘입니다. 뒷자리가 넉넉해야 일요일 교회에 다녀오지요.', note: () => '뒷좌석 넓게: 축간 2700 이상' },
  { id: 'budget', ask: '예산은 어느 정도로 보십니까?', answer: w => (w >= 2 ? '솔직히 말씀드리면 1,250달러까지는 생각하고 있습니다. 좋은 차라면요.' : w >= 1 ? '1,200달러 정도면 좋겠습니다.' : '글쎄요... 너무 비싸지만 않으면 됩니다.'), note: w => (w >= 2 ? '예산 1,250달러까지' : w >= 1 ? '예산 1,200달러 안팎' : '예산: 말을 아낌') },
  { id: 'when', ask: '언제까지 필요하십니까?', answer: () => '두 달 안이면 좋겠습니다. 봄 진창이 오기 전에요.', note: () => '두 달 안에 (60일)' },
  { id: 'must', ask: '꼭 있어야 할 것이 있습니까?', answer: w => (w >= 1 ? '색은 짙은 색으로 해 주십시오. 의사가 요란한 색 차를 타면 사람들이 수군거립니다.' : '음... 생각나는 대로 말씀드리지요.'), note: w => (w >= 1 ? '짙은 색' : '') },
  { id: 'weather', ask: '(날씨 이야기를 한다)', answer: () => '요즘 날씨가 변덕이지요. 지난주엔 다리 건너 농가에 갔다가 바퀴가 빠져서 혼났습니다. 하하.', warmth: 1 },
  { id: 'town', ask: '(동네 이야기를 한다)', answer: () => '이 동네 분들은 다 좋으세요. 이 공방 이야기도 약국 주인에게서 들었습니다. 솜씨가 좋다고요.', warmth: 1 } ];

export interface KitchenOpts { hour: number; sky: '맑음' | '흐림' | '비' | '눈'; who?: string; done?: (notes: string[]) => void }

export function kitchenScene(app: App, o: KitchenOpts): Scene {
  const ui = app.ui, S = app.S, P = pantry();
  let questions = 3, refills = 0, warm = 0, said = '반갑습니다. 하워드라고 합니다. 차를 한 대 맞추고 싶어서 왔습니다.', shown = 0, talkT = 0, fade = 0, serving: '' | 'tea' | 'coffee' = '', cups: '' | 'tea' | 'coffee' = '', ended = false, sipT = 0, t = 0;
  const asked = new Set<string>(), notes: string[] = [];
  const vn = (x: number, y: number, s: number) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), r = (a: number, b: number) => rnd(((a * 73856093) ^ (b * 19349663) ^ (s * 83492791)) >>> 0);
    return (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) + (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v; };
  const daylight = () => { const h = o.hour, L = Math.min(1, Math.max(0, (h - 5) / 2), Math.max(0, (20 - h) / 2)); return L * (o.sky === '맑음' ? 1 : o.sky === '흐림' ? 0.75 : 0.6); };
  const say = (s: string) => { said = s; shown = 0; };
  // ---------------- the room, drawn once ----------------
  const room: RGB[] = new Array(W * H);
  { const set = (x: number, y: number, c: RGB) => { if (x >= 0 && y >= 0 && x < W && y < H) room[y * W + x] = c; };
    const rect = (x: number, y: number, w: number, h: number, c: RGB | ((x: number, y: number) => RGB)) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, typeof c === 'function' ? c(x + i, y + j) : c); };
    // wallpaper (small sprigs on pale yellow) above a beadboard wainscot, a picture rail
    rect(0, 0, W, 150, (x, y) => { const sp = (x + (Math.floor(y / 12) % 2) * 6) % 12, sy = y % 12; return sp === 6 && sy === 5 ? hex('#a8b47a') : (sp === 5 || sp === 7) && sy === 6 ? hex('#c49a8a') : vn(x / 30, y / 30, 1) > 0.7 ? hex('#e8dcb0') : hex('#efe4bc'); });
    rect(0, 12, W, 3, (x, y) => (y === 12 ? hex('#8a6a46') : hex('#6e5236')));
    rect(0, 150, W, 50, (x, y) => (x % 7 === 0 ? hex('#8aa088') : x % 7 === 1 ? hex('#b6ccb2') : y === 150 ? hex('#7a907a') : hex('#a4bca0')));
    rect(0, 148, W, 3, hex('#6e5236'));
    // the floor: worn linoleum in squares
    rect(0, 200, W, 70, (x, y) => { const q = (Math.floor(x / 14) + Math.floor((y - 200) / 7)) % 2, n = vn(x / 9, y / 4, 3); return mix(q ? hex('#8a2e28') : hex('#d8ccb0'), hex('#5a4a3a'), n > 0.75 ? 0.25 : 0.06); });
    // the window over the sink: frame, sash bars; the outside is drawn every frame
    rect(36, 34, 92, 86, hex('#f2ecd8')); rect(40, 38, 84, 78, hex('#000000'));
    // curtains, café style
    rect(36, 34, 92, 12, (x, y) => ((x + y) % 4 < 2 ? hex('#d86a5a') : hex('#f2e8d8')));
    rect(36, 80, 14, 40, (x, y) => ((x + y) % 4 < 2 ? hex('#d86a5a') : hex('#f2e8d8'))); rect(114, 80, 14, 40, (x, y) => ((x + y) % 4 < 2 ? hex('#d86a5a') : hex('#f2e8d8')));
    // sink and drainboard
    rect(24, 128, 116, 6, hex('#e8e8e2')); rect(24, 134, 116, 30, (x, y) => (y === 134 ? hex('#ffffff') : hex('#dcdcd4'))); rect(60, 136, 50, 20, hex('#b8bcbc')); rect(82, 118, 4, 12, hex('#9a9ea2')); rect(78, 118, 12, 3, hex('#9a9ea2'));
    rect(24, 164, 116, 36, (x, y) => (x % 38 === 24 % 38 || y === 164 ? hex('#6e8a6a') : hex('#8aa686')));
    // the range: cream enamel, black top and trim, oven door, a kettle on the hob
    rect(330, 96, 96, 104, (x, y) => (x === 330 || x === 425 ? hex('#3a3a3a') : y < 104 ? hex('#2a2a2c') : y > 192 ? hex('#2a2a2c') : (x > 344 && x < 412 && y > 134 && y < 184) ? (x === 345 || x === 411 || y === 135 || y === 183 ? hex('#3a3a3a') : hex('#e6e0c8')) : hex('#f0ead2')));
    rect(338, 86, 80, 10, hex('#2a2a2c')); rect(372, 156, 12, 3, hex('#9a9a9a')); for (const bx of [344, 362, 380, 398]) rect(bx, 112, 10, 6, hex('#3a3a3a'));
    rect(346, 64, 22, 22, (x, y) => (Math.hypot(x - 357, y - 76) < 11 ? (x < 352 ? hex('#c8ccd0') : hex('#9aa0a6')) : room[y * W + x]!)); rect(366, 68, 8, 3, hex('#9aa0a6')); rect(352, 60, 10, 4, hex('#2a2a2c'));
    // the cupboard (a kitchen cabinet with glass doors and crockery)
    rect(432, 40, 46, 160, (x, y) => (x === 432 || y === 40 || y === 110 || y === 199 ? hex('#5e8058') : hex('#7aa074')));
    rect(436, 46, 38, 58, (x, y) => ((y - 46) % 18 === 17 ? hex('#5e4a32') : hex('#c8d0c4')));
    for (const [cx, cy, c] of [[442, 58, '#e8e4d8'], [454, 58, '#c86a5a'], [466, 58, '#e8e4d8'], [446, 76, '#7a9ab8'], [462, 76, '#e8e4d8'], [450, 94, '#e8d8a0']] as const) rect(cx - 4, cy, 8, 8, hex(c));
    // the lamp cord and shade
    rect(239, 0, 2, 26, hex('#2a2a2a')); for (let y = 26; y < 36; y++) rect(240 - (y - 26), y, (y - 26) * 2 + 2, 1, y === 35 ? hex('#b8a060') : hex('#e8d8a0'));
  }
  // ---------------- people and things ----------------
  const SKIN = hex('#e2b48e'), SKIN2 = hex('#c0906c'), HAIR = hex('#3a2a20'), SUIT = hex('#3a3e4a'), SUIT2 = hex('#2c2f38'), SHIRT = hex('#f0ece0'), TIE = hex('#7a2a2a'), OUT = hex('#16141a');
  function customer(talking: boolean) { const cx = 214, top = 112, blink = (Math.floor(t * 0.7) % 7 === 0 && (t * 0.7) % 1 < 0.12), mouth = talking && Math.floor(t * 9) % 2 === 0, lean = Math.round(Math.sin(t * 0.8) * 0.6);
    const px = (x: number, y: number, c: RGB) => S.px(cx + x + lean, top + y, c), rect = (x: number, y: number, w: number, h: number, c: RGB) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
    // shoulders and jacket down to the table, lapels, collar and tie
    for (let y = 30; y < 80; y++) { const half = y < 36 ? 16 + (y - 30) : 22; for (let x = -half; x < half; x++) px(x, y, Math.abs(x) > half - 3 ? SUIT2 : SUIT); }
    for (let y = 30; y < 52; y++) { const wv = Math.max(0, 6 - (y - 30) / 4); for (let x = -Math.round(wv); x < Math.round(wv); x++) px(x, y, SHIRT); } rect(-2, 32, 4, 20, TIE); rect(-3, 32, 6, 3, mix(TIE, OUT, 0.3));
    for (let y = 32; y < 56; y++) { px(-7 - Math.floor((y - 32) / 6), y, SUIT2); px(6 + Math.floor((y - 32) / 6), y, SUIT2); }
    // head: hair parted, ears, eyes, a moustache, a mouth that moves when talking
    rect(-9, 6, 18, 22, SKIN); rect(-10, 12, 1, 8, SKIN2); rect(9, 12, 1, 8, SKIN2); rect(-9, 4, 18, 6, HAIR); rect(-9, 6, 3, 8, HAIR); rect(6, 6, 3, 5, HAIR); rect(-2, 4, 1, 3, mix(HAIR, SKIN, 0.4));
    rect(-6, 12, 4, 1, HAIR); rect(2, 12, 4, 1, HAIR); if (blink) { rect(-5, 15, 3, 1, OUT); rect(2, 15, 3, 1, OUT); } else { rect(-5, 14, 3, 2, hex('#ffffff')); rect(2, 14, 3, 2, hex('#ffffff')); px(-4, 15, OUT); px(3, 15, OUT); }
    rect(-1, 16, 2, 4, SKIN2); rect(-4, 21, 8, 2, HAIR); if (mouth) rect(-2, 24, 4, 2, hex('#6a2a2a')); else rect(-2, 24, 4, 1, SKIN2); rect(-9, 27, 18, 2, SKIN2); rect(-3, 28, 6, 3, SKIN2);
    // arms on the table, hands together (or one lifting the cup)
    const sip = cups && sipT > 0 && sipT < 1.6, lift = sip ? Math.round(Math.sin(sipT / 1.6 * Math.PI) * 26) : 0;
    rect(-24, 62, 10, 18, SUIT2); rect(14, 62, 10, 18, SUIT2); rect(-16, 74, 14, 6, SUIT); rect(2, 74, 14, 6, SUIT);
    rect(-6, 74, 8, 6, SKIN); if (sip) { rect(16, 74 - lift, 7, 6, SKIN); rect(18, 70 - lift, 6, 5, hex('#f4f0e6')); } else rect(2, 74, 8, 6, SKIN);
    for (let y = 0; y < 80; y++) for (let x = -26; x < 26; x++) { const i = (top + y) * W + cx + x + lean; void i; }
  }
  function table() { const y0 = 190; for (let y = y0; y < y0 + 12; y++) for (let x = 110; x < 370; x++) { const ck = (Math.floor((x - 110) / 10) + Math.floor((y - y0) / 4)) % 2; S.px(x, y, y === y0 ? hex('#f8f4ec') : ck ? hex('#c8463c') : hex('#f2ece0')); }
    for (let x = 110; x < 370; x++) for (let k = 0; k < 14; k++) { const fold = (x % 20) < 2; S.px(x, y0 + 12 + k, fold ? hex('#b03c34') : (Math.floor((x - 110) / 10) % 2) ? hex('#c8463c') : hex('#e8e0d0')); }
    for (const lx of [124, 350]) for (let y = y0 + 26; y < 262; y++) { S.px(lx, y, hex('#5a3a24')); S.px(lx + 1, y, hex('#6e4a30')); S.px(lx + 2, y, hex('#5a3a24')); }
    if (o.who !== 'nohat') { for (let y = 182; y < 190; y++) for (let x = 138; x < 162; x++) if (Math.hypot((x - 150) / 12, (y - 189) / 4) < 1 || (y < 186 && Math.abs(x - 150) < 6)) S.px(x, y, y === 185 ? hex('#6a4a32') : hex('#2c2a30')); }   // his hat on the table
  }
  function cup(cx: number, kind: 'tea' | 'coffee', mine: boolean) { const y = 184; for (let x = cx - 9; x <= cx + 9; x++) { S.px(x, y + 6, hex('#e8e4da')); S.px(x, y + 7, hex('#c8c4b8')); }   // saucer
    for (let j = 0; j < 6; j++) for (let i = -5; i <= 5; i++) S.px(cx + i, y + j, i === -5 || i === 5 ? hex('#d8d4ca') : hex('#f6f2e8')); for (let i = -4; i <= 4; i++) S.px(cx + i, y, kind === 'tea' ? hex('#9a5a2a') : hex('#3a2416')); S.px(cx + 6, y + 2, hex('#e8e4da')); S.px(cx + 7, y + 3, hex('#e8e4da')); S.px(cx + 6, y + 4, hex('#e8e4da'));
    // steam: three wisps curling up, thinning and fading
    for (let w = 0; w < 3; w++) { const ph = w * 2.1 + (mine ? 0.7 : 0); for (let k = 0; k < 26; k++) { const yy = y - 2 - k, xx = cx - 2 + w * 2 + Math.sin(t * 1.7 + ph + k * 0.22) * (1 + k * 0.12) + vn(k / 6, t * 0.6 + w, 9 + w) * 2 - 1, a = (1 - k / 26) * 0.42 * (0.6 + 0.4 * Math.sin(t * 2.3 + ph + k * 0.4)); if (a > 0.04) S.px(xx, yy, hex('#ffffff'), a); } } }
  function outside() { const L = daylight(), hr = o.hour;
    for (let y = 38; y < 116; y++) for (let x = 40; x < 124; x++) { const k = (y - 38) / 78; let c = mix(mix(hex('#0a1020'), hex('#1e2a44'), k), mix(hex('#5a8ac8'), hex('#b8d4ec'), k), L); if (o.sky !== '맑음') c = mix(c, mix(hex('#3a3e46'), hex('#a8acb2'), L), 0.6);
      if (y > 92) c = mix(c, L > 0.3 ? hex('#5e7a44') : hex('#1a2418'), 0.85);                                                          // the yard beyond
      if (y > 70 && y < 94 && x > 92 && x < 118) c = mix(c, L > 0.3 ? hex('#c8bca0') : hex('#3a3428'), 0.9); if (y > 76 && y < 82 && x > 98 && x < 104 && L < 0.5) c = hex('#f0c070');   // the neighbour's house, a lit window at night
      if (o.sky === '비' && ((x * 7 + Math.floor(y + t * 60)) % 23 === 0)) c = mix(c, hex('#d8e4f0'), 0.5); if (o.sky === '눈' && rnd(((x * 13 + Math.floor(y - t * 12) * 7) >>> 0)) < 0.025) c = hex('#ffffff');
      S.px(x, y, c); }
    for (let y = 38; y < 116; y++) { S.px(81, y, hex('#f2ecd8')); S.px(82, y, hex('#d8d0b8')); } for (let x = 40; x < 124; x++) { S.px(x, 76, hex('#f2ecd8')); S.px(x, 77, hex('#d8d0b8')); }
    if (o.sky === '비') for (let k = 0; k < 14; k++) { const dx = 42 + rnd(k * 31) * 80, dy = (38 + rnd(k * 17) * 70 + t * (6 + k % 4)) % 78 + 38; S.px(dx, dy, hex('#e8f0f8'), 0.7); S.px(dx, dy + 1, hex('#a8b8c8'), 0.5); }   // drops running down the glass
    void hr; }
  function light() { const L = daylight(), dark = 1 - L; // the room darkens with the day; the lamp warms it when lit
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (x >= 40 && x < 124 && y >= 38 && y < 116) continue; const c = S.get(x, y), lampL = dark > 0.35 ? Math.max(0, 1 - Math.hypot(x - 240, (y - 36) * 1.3) / 260) : 0, win = Math.max(0, 1 - Math.hypot(x - 82, y - 120) / 220) * L;
      let k = mix([14, 12, 20], c, 0.35 + 0.45 * L + win * 0.25 + lampL * 0.55); if (lampL > 0) k = mix(k, [Math.min(255, k[0] * 1.12), Math.min(255, k[1] * 1.04), k[2] * 0.86] as RGB, lampL * 0.6); S.px(x, y, k); }
    if (dark > 0.35) for (let y = 30; y < 36; y++) for (let x = 236; x < 245; x++) S.px(x, y, hex('#fff2c0'), 0.9); }

  const choices = () => { if (ended) return []; const left = TOPICS.filter(tp => !asked.has(tp.id)), info = left.filter(tp => !tp.warmth).slice(0, 3), talk = left.find(tp => tp.warmth); return questions > 0 ? [...info, ...(talk ? [talk] : [])] : []; };   // three questions and one bit of small talk on offer
  function ask(tp: Topic) { asked.add(tp.id); questions--; if (tp.warmth) warm += tp.warmth; say(tp.answer(warm)); const n = tp.note?.(warm); if (n) { const k = notes.findIndex(x => x.startsWith(n.slice(0, 4))); if (k >= 0) notes[k] = n; else notes.push(n); }
    if (tp.id === 'budget' && warm < 2) asked.delete('budget'); }               // he can be asked again once warmer
  function serve(kind: 'tea' | 'coffee') { if (P[kind] <= 0 || refills >= 2) return; serving = kind; fade = 0.001; }

  return { id: 'kitchen',
    frame(_a, dt) { t += dt; sipT = cups ? (sipT + dt) % 9 : 0;
      // the room, the window, the range's kettle steaming, the table, the customer, cups
      for (let i = 0; i < W * H; i++) { const c = room[i]; if (c) S.px(i % W, (i / W) | 0, c); }
      outside();
      for (let w = 0; w < 2; w++) for (let k = 0; k < 18; k++) { const a = (1 - k / 18) * 0.35; S.px(370 + k * 0.6 + Math.sin(t * 2 + k * 0.3 + w) * 1.5, 66 - k + w, hex('#ffffff'), a); }
      const talking = shown < said.length; customer(talking); table(); if (cups) { cup(196, cups, false); cup(282, cups, true); for (let y = 176; y < 190; y++) for (let x = 236; x < 252; x++) if (Math.hypot((x - 244) / 8, (y - 184) / 7) < 1) S.px(x, y, x < 240 ? hex('#f6f2e8') : hex('#e2dccc')); }   // the pot
      light();
      // the words appear a few letters at a time, with a murmur
      if (shown < said.length) { talkT += dt; while (talkT > 0.03 && shown < said.length) { talkT -= 0.03; shown++; if (shown % 3 === 0 && said[shown - 1] !== ' ') app.sound.once('blip', { pitch: 0.85 }); } }
      // the notepad
      const pad: Rect = { x: 368, y: 6, w: 106, h: 92 }; ui.panel(pad, 'card'); ui.label({ x: pad.x + 6, y: pad.y + 3, w: 94, h: 9 }, '메모', COL.ink); S.hline(pad.x + 4, pad.x + pad.w - 4, pad.y + 13, COL.card2);
      let ny = pad.y + 16; for (const n of notes) { for (const line of ui.wrap('· ' + n, pad.w - 10)) { if (ny < pad.y + pad.h - 9) ui.label({ x: pad.x + 5, y: ny, w: pad.w - 10, h: 8 }, line, COL.inkSoft); ny += 8; } }
      // the talk
      const box: Rect = { x: 8, y: 204, w: 464, h: 62 }; ui.panel(box, 'card');
      ui.paragraph({ x: box.x + 8, y: box.y + 13, w: box.w - 16, h: 20 }, said.slice(0, shown), COL.ink, 10);
      ui.label({ x: box.x + 8, y: box.y + 3, w: 26, h: 9 }, '질문', COL.inkSoft); for (let k = 0; k < Math.max(3, questions); k++) { const cx = box.x + 36 + k * 8, cy = box.y + 7, on = k < questions; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= 5 && (on || i * i + j * j >= 3)) S.px(cx + i, cy + j, on ? hex('#c89a3a') : COL.card2); } ui.label({ x: box.x + 90, y: box.y + 3, w: 360, h: 9 }, `차 ${P.tea} · 커피 ${P.coffee} · 내온 횟수 ${refills}/2 · 상담 중 시간 멈춤`, COL.inkSoft, 'r');
      const cs = choices(), grid = split({ x: box.x + 8, y: box.y + 34, w: box.w - 16, h: 26 }, ['*', '*'], 4), cells = grid.flatMap(g => split(g, [12, 12], 2, 'v'));
      if (!talking && !fade) {
        if (cs.length) cs.forEach((tp, k) => { if (ui.button('q-' + tp.id, cells[k]!, tp.ask)) ask(tp); });
        else if (!ended && refills < 2 && (P.tea > 0 || P.coffee > 0)) { if (ui.button('serve-tea', cells[0]!, `차를 내온다 (${P.tea})`, { disabled: P.tea <= 0 })) serve('tea'); if (ui.button('serve-coffee', cells[1]!, `커피를 내온다 (${P.coffee})`, { disabled: P.coffee <= 0 })) serve('coffee'); if (ui.button('end-now', cells[2]!, '이만 마친다')) { ended = true; say('네, 오늘 이야기 즐거웠습니다. 이만 가 보겠습니다.'); } }
        else if (!ended) { ended = true; say(refills >= 2 ? '차 잘 마셨습니다. 이제 정말 가 봐야겠군요. 견적 기다리겠습니다.' : '이런, 시간이 벌써 이렇게 됐군요. 이제 가 봐야겠습니다.'); }
        else if (ui.button('bye', cells[0]!, '배웅한다')) { o.done?.(notes.slice()); } }
      // serving: the screen fades, the kettle is poured, cups come to the table
      if (fade > 0) { fade += dt; const a = fade < 0.8 ? fade / 0.8 : fade < 1.8 ? 1 : Math.max(0, 1 - (fade - 1.8) / 0.8);
        if (fade - dt < 0.9 && fade >= 0.9) { app.sound.once('pour'); } if (fade - dt < 1.6 && fade >= 1.6) { app.sound.once('clink'); cups = serving as 'tea' | 'coffee'; P[serving as 'tea' | 'coffee']--; pantry(P); refills++; questions += 3; say(serving === 'tea' ? '아, 고맙습니다. 향이 좋군요.' : '커피 좋지요. 고맙습니다.'); }
        for (let i = 0; i < W * H; i++) S.px(i % W, (i / W) | 0, [0, 0, 0], a); if (fade > 2.6) { fade = 0; serving = ''; } }
    } };
}
