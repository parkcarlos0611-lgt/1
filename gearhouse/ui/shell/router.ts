// The game page's screens and the way between them (docs/systems/101 part 3): each screen is entered and left; a
// stack of the screens passed through, so going back (Esc, the phone's back button) retraces the way; a short fade
// over each change. The browser's history holds one extra entry while there is somewhere to go back to, so the phone's
// back button comes here (and pressed on the first screen, leaves the page as usual). Pure of the page: the history and
// the fade are passed in (a fake history and no fade in the tests).

/** a screen: what it does when it comes on and goes off; `back` may take the back press itself (a menu open on it) */
export interface Screen<P = unknown> { enter(params: P, how: Move): void | Promise<void>; leave(how: Move): void; back?(): boolean }
export type Move = 'push' | 'back' | 'replace' | 'reset';
/** what the router needs of the browser's history */
export interface HistoryLike { pushState(data: unknown, unused: string): void; back(): void }
export interface Step { id: string; params: unknown }

export class Router {
  readonly stack: Step[] = [];
  private guarded = false; private skipPop = 0; private busy: Promise<void> = Promise.resolve();
  /** called after each change, with the screen now on (for the last screen kept, the page's title) */
  onChange: ((s: Step) => void) | null = null;
  constructor(private screens: Record<string, Screen<never>>, private o: { history?: HistoryLike | null; fade?: (swap: () => Promise<void>) => Promise<void> } = {}) {}
  get current(): Step | null { return this.stack[this.stack.length - 1] ?? null; }
  get depth(): number { return this.stack.length; }
  /** on to a screen (it goes on the stack) */
  go(id: string, params?: unknown): Promise<void> { return this.move('push', () => { this.stack.push({ id, params }); }); }
  /** the screen now replaced by another (the stack no deeper) */
  replace(id: string, params?: unknown): Promise<void> { return this.move('replace', () => { this.stack.pop(); this.stack.push({ id, params }); }); }
  /** the stack started again from one screen (the title, say) */
  reset(id: string, params?: unknown): Promise<void> { return this.move('reset', () => { this.stack.length = 0; this.stack.push({ id, params }); }); }
  /** the back press: the screen's own first (a menu on it closed), then the screen before; false on the first screen */
  back(): boolean { const cur = this.current; if (cur && (this.screens[cur.id]?.back?.() ?? false)) return true;
    if (this.stack.length < 2) return false; void this.move('back', () => { this.stack.pop(); }); return true; }
  /** back to a screen further down the stack (false when it is not on it) */
  backTo(id: string): boolean { const i = this.stack.map(s => s.id).lastIndexOf(id); if (i < 0 || i === this.stack.length - 1) return false;
    void this.move('back', () => { this.stack.length = i + 1; }); return true; }
  /** the browser's back (popstate): the extra history entry spent; going back as the back press does */
  popped(): void { if (this.skipPop > 0) { this.skipPop--; return; } this.guarded = false; if (!this.back()) this.sync(); }
  /** changes one at a time: a second press during a fade waits for the first */
  private move(how: Move, change: () => void): Promise<void> {
    const run = async () => { const was = this.current; change(); const now = this.current!;
      const swap = async () => { if (was) this.screens[was.id]?.leave(how); await this.screens[now.id]?.enter(now.params as never, how); };
      if (this.o.fade && was) await this.o.fade(swap); else await swap();
      this.sync(); this.onChange?.(now); };
    this.busy = this.busy.then(run, run); return this.busy; }
  /** the history's extra entry there while the stack is deeper than one screen, gone when it is not */
  private sync() { const h = this.o.history; if (!h) return;
    if (this.stack.length > 1 && !this.guarded) { h.pushState({ gearhouse: 1 }, ''); this.guarded = true; }
    else if (this.stack.length <= 1 && this.guarded) { this.guarded = false; this.skipPop++; h.back(); } }
}
