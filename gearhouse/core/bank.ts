// The bank (plan 12, step 3): an account at one of the town's banks, loans, the yearly tax and the end of the road.
// Money kept at the bank earns a little and makes the banker lend; a bank that fails takes it along, and only the
// papers warn of that. Money in hand earns nothing and is always there. The slice keeps one purse for home and shop.
import { addDays, daysBetween, parts, type DateStr } from './calendar';
import { post } from './ledger';
import type { Api, Simulation, System } from './sim';
import type { GameState } from './state';

export interface Loan { id: number; bankId: string; principal: number; balance: number; /** yearly */ rate: number; /** monthly */ payment: number; taken: DateStr; months: number; missed: number }
export interface BankState { bankId?: string; since?: DateStr; deposit: number; loans: Loan[]; nextId: number;
  /** asked for and not yet answered */ asked?: { amount: number; months: number; due: DateStr };
  /** money locked in a bank that failed: part of it comes back much later, or none */ frozen: { bankId: string; amount: number; settles: DateStr; share: number }[];
  /** drawn out during a run, this week */ drawn?: { week: DateStr; amount: number };
  tax?: { year: number; amount: number; due: DateStr }; negativeDays: number; bankrupt?: DateStr }
export interface BankData { depositRate: number; loan: { rate: [number, number]; ofYearIncome: number; floor: number; terms: number[]; answerDays: [number, number]; missedLimit: number };
  run: { weeklyShare: number }; failure: { recover: [number, number]; months: [number, number] }; tax: { exemption: number; rate: number; dueMonth: number; dueDay: number }; bankruptcy: { days: number } }
export const newBank = (): BankState => ({ deposit: 0, loans: [], nextId: 1, frozen: [], negativeDays: 0 });
/** what a bank is to the town register */
export interface BankInfo { list(): { id: string; name: string }[]; status(id: string): string | undefined; name(id: string): string }
/** entries that are neither earnings nor costs of the trade */
const NOT_TRADE = ['to_bank', 'from_bank', 'loan', 'loan_payment', 'living', 'tax', 'bank_recovered'];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v)), cents = (v: number) => Math.round(v * 100) / 100;
/** money that can be reached today: in hand, and at a bank that still pays out */
export function reach(g: GameState): number { return g.ledger.cash + (g.bank?.bankId ? g.bank.deposit : 0); }
/** earnings less costs of the trade in a year (the owner's living is not a cost) */
export function profit(g: GameState, year: number): number { return cents(g.ledger.entries.filter(e => e.date.startsWith(String(year)) && !NOT_TRADE.includes(e.kind)).reduce((t, e) => t + e.amount, 0)); }

export class Bank {
  constructor(private sim: Simulation, private data: BankData, private info: BankInfo, private eco: (date: DateStr) => number) {
    sim.bus.on('register_changed', e => { if (e.kind === 'bank' && e.entityId === this.S.bankId && e.status === 'closed') this.closedToday = e.entityId; });
    sim.bus.on('month_closed', () => { this.monthDue = true; }); }
  /** heard during the day, dealt with in the bank's own turn of the same day (so what is raised stops the game) */
  private closedToday?: string; private monthDue = false;
  private get S() { return this.sim.g.bank; }
  banks() { return this.info.list(); }
  /** open an account (or move it); what was at the old bank comes along */
  open(bankId: string): void { const S = this.S; if (!this.info.list().some(b => b.id === bankId)) throw new Error('no such bank'); if (S.bankId === bankId) return; if (S.bankId && this.info.status(S.bankId) === 'run') throw new Error('the bank pays out only a little while the run lasts');
    S.bankId = bankId; S.since = this.sim.g.clock.date; }
  deposit(amount: number): void { const a = this.sim.api(), S = this.S; if (!S.bankId) throw new Error('no account at a bank'); if (!(amount > 0) || amount > a.g.ledger.cash) throw new Error('not that much in hand'); post(a, 'to_bank', -cents(amount), this.info.name(S.bankId)); S.deposit = cents(S.deposit + amount); }
  /** what can be drawn today: all of it, or a share a week while people queue at the door */
  drawable(): number { const S = this.S, g = this.sim.g; if (!S.bankId) return 0; if (this.info.status(S.bankId) !== 'run') return S.deposit;
    const week = addDays(g.clock.date, -6), used = S.drawn && S.drawn.week >= week ? S.drawn.amount : 0; return Math.max(0, cents(Math.min(S.deposit, S.deposit * this.data.run.weeklyShare + 25 - used))); }
  withdraw(amount: number): void { const a = this.sim.api(), S = this.S; if (!S.bankId) throw new Error('no account at a bank'); if (!(amount > 0) || amount > this.drawable() + 1e-9) throw new Error(amount > S.deposit ? 'not that much at the bank' : 'the bank pays out only a little while the run lasts');
    if (this.info.status(S.bankId) === 'run') S.drawn = { week: S.drawn && S.drawn.week >= addDays(a.date, -6) ? S.drawn.week : a.date, amount: (S.drawn && S.drawn.week >= addDays(a.date, -6) ? S.drawn.amount : 0) + amount };
    S.deposit = cents(S.deposit - amount); post(a, 'from_bank', cents(amount), this.info.name(S.bankId)); }

  /** the most the banker would talk about, and what it would cost */
  terms(amount: number, months: number): { limit: number; rate: number; payment: number } { const g = this.sim.g, L = this.data.loan, from = addDays(g.clock.date, -365), income = g.ledger.entries.filter(e => e.date >= from && e.amount > 0 && !NOT_TRADE.includes(e.kind)).reduce((t, e) => t + e.amount, 0);
    const owed = this.S.loans.reduce((t, l) => t + l.balance, 0), limit = Math.max(0, Math.round((Math.max(L.floor, income * L.ofYearIncome) - owed) / 10) * 10), rate = cents(L.rate[0] + (L.rate[1] - L.rate[0]) * (1 - this.eco(g.clock.date)) * 2.5 > L.rate[1] ? L.rate[1] : L.rate[0] + (L.rate[1] - L.rate[0]) * (1 - this.eco(g.clock.date)) * 2.5), m = rate / 12;
    return { limit, rate, payment: cents(amount * m / (1 - Math.pow(1 + m, -months))) }; }
  /** ask for a loan; the answer comes in some days */
  ask(amount: number, months: number): void { const S = this.S, a = this.sim.api(), L = this.data.loan; if (!S.bankId) throw new Error('no account at a bank'); if (S.asked) throw new Error('the banker has not answered the last request yet');
    if (!L.terms.includes(months)) throw new Error('the bank lends for ' + L.terms.join(', ') + ' months'); if (!(amount >= 50) || amount > this.terms(amount, months).limit) throw new Error('the banker will not talk about that much');
    S.asked = { amount, months, due: addDays(a.date, a.rng.int(L.answerDays[0], L.answerDays[1])) }; }
  private chance(amount: number): number { const g = this.sim.g, S = this.S, status = this.info.status(S.bankId!), from = addDays(g.clock.date, -90), income = g.ledger.entries.filter(e => e.date >= from && e.amount > 0 && !NOT_TRADE.includes(e.kind)).reduce((t, e) => t + e.amount, 0);
    if (status === 'run' || status === 'closed') return 0; const owed = S.loans.reduce((t, l) => t + l.balance, 0), missed = S.loans.reduce((t, l) => t + l.missed, 0);
    return clamp(0.3 + g.market.reputation.trust / 200 + Math.min(0.2, daysBetween(S.since ?? g.clock.date, g.clock.date) / 30 * 0.02) + Math.min(0.2, S.deposit / amount * 0.2) + Math.min(0.3, income / amount * 0.15) - owed / amount * 0.2 - missed * 0.15 - (status === 'uneasy' ? 0.3 : 0) - (1 - this.eco(g.clock.date)) * 0.4, 0.02, 0.95); }

  system(): System { return { id: 'bank', morning: a => this.morning(a), evening: a => this.evening(a) }; }
  private morning(a: Api): void { const S = this.S, T = this.data.tax, { year, month, day } = parts(a.date);
    if (this.closedToday) { this.failed(a, this.closedToday); this.closedToday = undefined; }
    if (S.asked && S.asked.due <= a.date) { const q = S.asked; delete S.asked; if (S.bankId && a.rng.float() < this.chance(q.amount)) { const t = this.terms(q.amount, q.months), loan: Loan = { id: S.nextId++, bankId: S.bankId, principal: q.amount, balance: q.amount, rate: t.rate, payment: t.payment, taken: a.date, months: q.months, missed: 0 };
        S.loans.push(loan); post(a, 'loan', q.amount, this.info.name(S.bankId)); a.bus.emit('loan_taken', { loanId: loan.id, amount: q.amount }); a.raise('loan_answer', 'notice', { granted: true, amount: q.amount, months: q.months, rate: t.rate, payment: t.payment }); }
      else a.raise('loan_answer', 'notice', { granted: false, amount: q.amount }); }
    for (const f of S.frozen.filter(x => x.settles <= a.date)) { const back = cents(f.amount * f.share); if (back > 0) post(a, 'bank_recovered', back, this.info.name(f.bankId)); a.raise('bank_settled', 'notice', { bank: this.info.name(f.bankId), lost: cents(f.amount - back), back }); }
    S.frozen = S.frozen.filter(x => x.settles > a.date);
    if (month === 1 && day === 2 && S.tax?.year !== year - 1 && a.g.clock.started < `${year}-01-01`) { const p = profit(a.g, year - 1), amount = Math.max(0, Math.round((p - T.exemption) * T.rate)); S.tax = { year: year - 1, amount, due: `${year}-${String(T.dueMonth).padStart(2, '0')}-${String(T.dueDay).padStart(2, '0')}` };
      a.raise('tax_notice', 'notice', { year: year - 1, profit: p, amount, due: S.tax.due }); }
    if (S.tax && S.tax.amount > 0 && S.tax.due <= a.date) { this.draw(a, S.tax.amount); post(a, 'tax', -S.tax.amount, String(S.tax.year)); S.tax.amount = 0; } }
  /** take from the bank what the hand lacks */
  private draw(a: Api, need: number): void { const short = need - a.g.ledger.cash; if (short > 0 && this.S.bankId) { const x = Math.min(short, this.drawable()); if (x > 0) this.withdraw(x); } }
  private evening(a: Api): void { const S = this.S, g = a.g; if (this.closedToday) { this.failed(a, this.closedToday); this.closedToday = undefined; } if (this.monthDue) { this.monthDue = false; this.monthEnd(a); }
    if (g.ledger.cash < 0) this.draw(a, 0);                                           // what was paid beyond the cash in hand goes by cheque
    S.negativeDays = reach(g) < 0 ? S.negativeDays + 1 : 0;
    if (!S.bankrupt && (S.negativeDays >= this.data.bankruptcy.days || S.loans.some(l => l.missed >= this.data.loan.missedLimit))) { S.bankrupt = a.date; a.bus.emit('bankrupt', { date: a.date }); a.raise('bankruptcy', 'decision', { owed: cents(S.loans.reduce((t, l) => t + l.balance, 0)), cash: reach(g) }); } }
  private monthEnd(a: Api): void { const S = this.S;
    if (S.bankId && S.deposit > 0) S.deposit = cents(S.deposit * (1 + this.data.depositRate / 12));
    for (const l of S.loans) { const interest = cents(l.balance * l.rate / 12), pay = Math.min(l.payment, cents(l.balance + interest));
      if (reach(a.g) >= pay) { this.draw(a, pay); post(a, 'loan_payment', -pay, `loan ${l.id}`); l.balance = cents(l.balance + interest - pay); }
      else { l.missed++; l.balance = cents(l.balance + interest); a.raise('loan_missed', 'decision', { loanId: l.id, payment: pay, missed: l.missed, limit: this.data.loan.missedLimit }, 20); } }
    S.loans = S.loans.filter(l => l.balance > 0.5); }
  private failed(a: Api, bankId: string): void { const S = this.S, F = this.data.failure, amount = S.deposit, share = a.rng.float() < 0.35 ? 0 : cents(F.recover[0] + (F.recover[1] - F.recover[0]) * a.rng.float());
    if (amount > 0) S.frozen.push({ bankId, amount, share, settles: addDays(a.date, a.rng.int(F.months[0], F.months[1]) * 30) }); S.deposit = 0; delete S.bankId; delete S.since;
    a.bus.emit('bank_failed', { bankId, lost: amount }); a.raise('bank_closed', 'decision', { bank: this.info.name(bankId), locked: amount }); }
}
/** what one order brought and cost */
export function carSheet(g: GameState, orderId: number): { price: number; paid: number; materialsAndWages: number; ownHours: number; left: number } | null { const o = g.market.orders.find(x => x.id === orderId), car = o && g.shop.cars.find(c => c.id === o.carId); if (!o || !car) return null;
  const paid = g.ledger.entries.filter(e => e.note === 'order ' + o.id && e.amount > 0).reduce((t, e) => t + e.amount, 0); return { price: o.price, paid: cents(paid), materialsAndWages: car.cost, ownHours: car.ownHours, left: cents(paid - car.cost) }; }
