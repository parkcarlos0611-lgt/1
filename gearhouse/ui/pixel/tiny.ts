// A 3x5 pixel face for small print (the telephone directory, labels on things): capitals, figures and a little
// punctuation, four pixels a letter with the gap. Lower case is printed as capitals.
const G: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100110101010', '7': '111001010010010', '8': '010101010101010', '9': '010101011001110',
  '.': '000000000000010', ',': '000000000010100', '-': '000000111000000', '&': '010101010101011', "'": '010010000000000', '/': '001001010100100',
  '(': '010100100100010', ')': '010001001001010', ':': '000010000010000', '#': '101111101111101', '$': '011110010011110', '!': '010010010000010', ' ': '000000000000000' };
export const tinyWidth = (s: string, scale = 1) => Math.max(0, s.length * 4 * scale - scale);
/** set the pixels of a string with `put(x, y)` (scale 2 for headlines) */
export function tiny(s: string, x: number, y: number, put: (x: number, y: number) => void, scale = 1): number {
  let cx = Math.round(x); for (const ch of s.toUpperCase()) { const g = G[ch] ?? G[' ']!;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r * 3 + c] === '1') for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) put(cx + c * scale + i, Math.round(y) + r * scale + j);
    cx += 4 * scale; } return cx; }
