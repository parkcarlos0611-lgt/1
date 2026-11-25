// What every screen of the game page is given (ui/shell/main.ts makes it): the router, the shared renderer's stage and
// the backdrop, the browser's storage, the settings, the layers the screens go in, the loading cover, and the last
// place played (for 이어하기).
import type { Router } from './router';
import type { Stage, Backdrop } from './stage';
import type { Settings, ListStore } from './settings';
import type { Design } from '../../core/design';

/** where play was left: the screen and the design on the bench (the track, when it was the drive) */
export interface Last { screen: 'garage' | 'builder' | 'drive'; design?: string; track?: string }
export interface ShellCtx {
  router: Router; stage: Stage; backdrop: Backdrop; store: ListStore | null;
  settings: Settings; /** the settings changed: kept, and put to work (the theme, the sounds, the drive's own fields) */ changed(): void;
  /** the screens' own layer (menus) and the pages' (builder, drive); the layer over both (a pause menu) */ layer: HTMLElement; pages: HTMLElement; over: HTMLElement;
  /** the loading cover: on with a line and a share done (0..1), or off */ loading(on: boolean, text?: string, done?: number): void;
  last(): Last | null; keepLast(l: Last): void;
  /** the design to show and to go on with: the one on the bench, else the last saved, else the stock 959 (enabled bodies only, core/bodies.ts) */ recent(): Design;
}
