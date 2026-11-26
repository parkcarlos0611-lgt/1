// The design system's style sheet as a page of its own (docs/systems/110 G2): ui/kit/sheet.ts on ui/uikit.page.html.
// ?kit=toolbox (or concrete) opens it in another palette.
import { buildSheet } from './kit/sheet';
import { setPalette } from './kit/style';
import { paletteOf } from './kit/tokens';
const q = new URLSearchParams(location.search);
setPalette(paletteOf(q.get('kit')));
buildSheet(document.getElementById('kit')!);
document.body.dataset.ready = '1';
