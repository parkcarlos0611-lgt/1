import { describe, it, expect } from 'vitest';
import { Screen } from '../ui/pixel/screen';
import { UI, split } from '../ui/pixel/kit';

describe('pixel kit', () => {
  it('splits a rectangle into fixed and shared parts', () => {
    const [a, b, c] = split({ x: 10, y: 0, w: 100, h: 10 }, [20, '*', 30], 2);
    expect([a!.x, a!.w, b!.x, b!.w, c!.x, c!.w]).toEqual([10, 20, 32, 46, 80, 30]);
  });
  it('marks text that runs over its box and keeps text that fits', () => {
    const ui = new UI(new Screen(480, 270)); ui.begin();
    ui.label({ x: 0, y: 0, w: 200, h: 10 }, '짧은 글'); ui.label({ x: 0, y: 20, w: 20, h: 10 }, '아주 긴 글자는 넘친다');
    ui.end(); const labels = ui.recs.filter(r => r.kind === 'label');
    expect(labels.map(r => r.over)).toEqual([false, true]);
  });
  it('a click goes to the widget under it, once', () => {
    const ui = new UI(new Screen(480, 270)); ui.down(15, 5); ui.begin();
    const a = ui.button('a', { x: 0, y: 0, w: 30, h: 12 }, 'A'), b = ui.button('b', { x: 40, y: 0, w: 30, h: 12 }, 'B'); ui.end();
    expect([a, b]).toEqual([true, false]);
  });
});
