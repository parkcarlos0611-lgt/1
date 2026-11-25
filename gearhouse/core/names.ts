// The names the player reads. No real maker, model or engine maker is named on any screen: the cars the game's bodies
// were drawn from keep their real names only in the code (ids such as 'p959', 'nsx', comments, file names, docs and
// tests). Every body the screens name is named here; the banned list below is what tests/names.test.ts scans the
// game's name tables and texts for.
import type { BodyBase } from './design';

/** the game's own make (its badge's lettering is the Latin spelling) */
export const MAKE = '포스터', MAKE_LATIN = 'Phorster';
/** the 959's name in the game */
export const CAR_599 = `${MAKE} 599`;
/** each body as the screens name it: the old kit bases by a letter, the model-built body by its make and number */
export const BODY_NAME: Record<BodyBase, string> = { nsx: '옛 바탕 A', f355: '옛 바탕 B', eb110: '옛 바탕 C', p959: CAR_599 };

/** real makers, models and engine makers (Latin and Korean spellings) that must not reach a screen */
export const BANNED: readonly string[] = [
  'Porsche', '포르쉐', 'Honda', '혼다', 'Acura', '어큐라', 'NSX', 'Ferrari', '페라리', 'F355', 'Bugatti', '부가티', 'EB110', 'Lamborghini', '람보르기니',
  'Diablo', '디아블로', 'Miura', '미우라', 'Countach', '쿤타치', 'Jaguar', '재규어', 'XJ220', 'McLaren', '맥라렌', 'Mercedes', '메르세데스', '벤츠',
  'Auburn', '오번', 'Duesenberg', '듀센버그', 'Napier', '네이피어', 'Railton', 'Ford', '포드', 'Chevrolet', '쉐보레', 'Plymouth', 'Pontiac', 'Dodge',
  'Willys', 'Buick', 'Bentley', '벤틀리', 'Rolls', '롤스', 'BMW', 'Peugeot', '푸조', 'Yamaha', '야마하', 'VTEC', 'C30A', 'Oldsmobile', 'Lotus',
  'Cosworth', 'Lancia', 'Maserati', 'Aston', 'Toyota', 'Nissan', 'Mazda', 'Subaru', 'Audi', 'Volkswagen', 'Fiat', 'Alfa Romeo'];
/** the banned names a text holds (none: an empty list); Latin names are matched as whole words in their own letter case
 *  (so the code's lower-case ids, 'nsx' or 'f355', are not names on a screen) */
export function bannedIn(text: string): string[] {
  return BANNED.filter(w => /^[\x20-\x7e]+$/.test(w) ? new RegExp(`(^|[^A-Za-z0-9_])${w.replace(/ /g, '\\s+')}($|[^A-Za-z0-9_])`).test(text) : text.includes(w)); }
