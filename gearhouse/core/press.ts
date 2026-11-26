// The newspaper's staff (review 10). Each publication has seats: ten named seats, each owning one of the ten
// voices for good, and four unnamed seats whose voice changes with whoever sits there for a while.
// When a named reporter retires, a new name takes the seat and writes in the same voice from the next issue.
import { addDays, parts, type DateStr } from './calendar';
import type { Rng } from './rng';
import type { NewsItem } from './news';
import { makeName, type NameData } from './people';
import type { Voice } from './newsBody';

export interface Seat { id: string; publication: string; named: boolean; voice: string; name?: string; born?: number; retireAge?: number; since: DateStr; until?: DateStr;
  /** a successor's own small habits on top of the seat's voice */ quirk?: { word?: string; short?: boolean } }
export interface PressState { seats: Seat[]; past: { seat: string; name: string; from: DateStr; to: DateStr }[] }
export const newPress = (): PressState => ({ seats: [], past: [] });
const QUIRK_WORDS = ['실로', '과연', '어쨌든', '듣자니', '따지고 보면', '모름지기', '아닌 게 아니라', '요컨대'];
const person = (rng: Rng, names: NameData) => { const n = makeName(rng, names, rng.float() < 0.85 ? 'm' : 'f'); return `${n.given} ${n.initial ? n.initial + '. ' : ''}${n.family}`; };

export class Press {
  constructor(private S: PressState, private voices: Voice[], private names: NameData) {}
  seats(publication: string): Seat[] { return this.S.seats.filter(s => s.publication === publication); }
  /** staff a publication when it first prints: names and ages are drawn once, a few old hands near retirement */
  staff(rng: Rng, publication: string, date: DateStr, unnamed = 4): void { if (this.seats(publication).length) return; const year = parts(date).year;
    this.voices.forEach((v, i) => { const age = i % 4 === 1 ? rng.int(58, 64) : rng.int(26, 55); this.S.seats.push({ id: `${publication}:${v.id}`, publication, named: true, voice: v.id, name: person(rng, this.names), born: year - age, retireAge: Math.max(age + 1, rng.int(62, 70)), since: date }); });
    for (let k = 0; k < unnamed; k++) this.S.seats.push({ id: `${publication}:staff${k}`, publication, named: false, voice: this.staffVoice(rng), since: date, until: addDays(date, rng.int(180, 900)) }); }
  private staffVoice(rng: Rng): string { return this.voices[rng.int(0, this.voices.length - 1)]!.id; }
  /** before an issue: reporters who have reached their age retire, unnamed staff move on; returns the paper's own notices */
  turnover(rng: Rng, publication: string, date: DateStr): NewsItem[] { const out: NewsItem[] = [], year = parts(date).year;
    for (const s of this.seats(publication)) {
      if (s.named && year - s.born! >= s.retireAge!) { const years = Math.max(1, parts(date).year - parts(s.since).year), old = s.name!; this.S.past.push({ seat: s.id, name: old, from: s.since, to: date });
        const age = rng.int(24, 35); s.name = person(rng, this.names); s.born = year - age; s.retireAge = rng.int(62, 70); s.since = date; s.quirk = { word: QUIRK_WORDS[rng.int(0, QUIRK_WORDS.length - 1)], short: rng.float() < 0.4 };
        out.push({ origin: 'fictional', id: 'press_retire', relation: 'unrelated', slant: 'neutral', importance: 2, weight: 2.2, headline: `본지 ${old} 기자 붓 놓는다… ${years >= 2 ? years + '년' : '여러 해'} 지면 지켜` });
        out.push({ origin: 'fictional', id: 'press_join', relation: 'unrelated', slant: 'good', importance: 1, weight: 1.2, headline: `본지 새 얼굴: ${s.name} 기자, 이번 호부터` }); }
      if (!s.named && s.until && s.until <= date) { s.voice = this.staffVoice(rng); s.since = date; s.until = addDays(date, rng.int(180, 900)); } }
    return out; }
  /** who writes an item: a named reporter whose voice suits it from importance 3, the unnamed staff below that */
  assign(rng: Rng, publication: string, item: NewsItem): void { if (item.origin !== 'fictional' || item.importance == null) return; const imp = item.importance, slant = item.slant ?? 'neutral';
    const suits = (voiceId: string) => { const v = this.voices.find(x => x.id === voiceId); return !!v && v.beats.includes(item.relation) && v.slants.includes(slant) && imp >= v.importance[0] && imp <= v.importance[1]; };
    const mine = this.seats(publication).filter(s => s.named === (imp >= 3)), pool = mine.filter(s => suits(s.voice)), seat = pool.length ? pool[rng.int(0, pool.length - 1)]! : imp >= 3 ? mine.find(s => s.voice === 'wire') ?? mine[0] : mine[rng.int(0, Math.max(0, mine.length - 1))];
    if (!seat) return; item.voice = suits(seat.voice) ? seat.voice : seat.named ? 'wire' : 'brief'; item.byline = seat.named ? seat.name : undefined; item.quirk = seat.quirk; }
}
