import { describe, expect, it } from 'vitest';
import { DATA, newWorld, openWorld } from '../core/world';
import { runBot } from '../core/bot';
import { load, save } from '../core/state';
import { carSheet, profit, reach } from '../core/bank';
import { post } from '../core/ledger';

const FOUNDER = { background: 'coachbuilder', age: 31, given: 'Walter', family: 'Hoffman' }, B = DATA.bank;
type W = ReturnType<typeof newWorld>;
const days = (w: W, n: number) => { for (let i = 0; i < n; i++) w.sim.stepDay(); };
const start = (seed = 1) => { const w = newWorld(seed, FOUNDER); days(w, 3); /* the town's banks are in the register from the first paper */ const bank = w.bank.banks()[0]!; w.bank.open(bank.id); return { w, g: w.sim.g, bank, reg: w.media.register }; };

describe('the bank', () => {
  it('keeps money that earns a little, and pays what the hand lacks', () => { const { w, g } = start(); expect(w.bank.banks().length).toBe(6); w.bank.deposit(1000); expect(g.ledger.cash).toBe(800); expect(g.bank.deposit).toBe(1000); expect(reach(g)).toBe(1800);
    expect(() => w.bank.deposit(5000)).toThrow(/in hand/); w.bank.withdraw(100); expect(g.ledger.cash).toBe(900); days(w, 35); expect(g.bank.deposit).toBeCloseTo(900 * (1 + B.depositRate / 12), 1);
    post(w.sim.api(), 'materials', -g.ledger.cash - 300, 'test'); expect(g.ledger.cash).toBe(-300); const before = g.bank.deposit; days(w, 1); expect(g.ledger.cash).toBeGreaterThanOrEqual(-40); expect(g.bank.deposit).toBeLessThan(before - 250); });
  it('lends by what it knows of the shop, and takes the payments month by month', () => { let granted = 0, refused = 0;
    for (let seed = 1; seed <= 20; seed++) { const { w, g } = start(seed); w.bank.deposit(600); expect(() => w.bank.ask(5000, 12)).toThrow(/that much/); expect(() => w.bank.ask(300, 7)).toThrow(/months/); const t = w.bank.terms(300, 12); expect(t.limit).toBeGreaterThanOrEqual(B.loan.floor); expect(t.payment).toBeGreaterThan(25); expect(t.payment).toBeLessThan(28);
      w.bank.ask(300, 12); expect(() => w.bank.ask(100, 12)).toThrow(/not answered/); const cash = g.ledger.cash; days(w, 9); const ans = g.incidents.find(i => i.kind === 'loan_answer')!; expect(ans).toBeDefined();
      if (ans.payload.granted) { granted++; expect(g.ledger.entries.some(e => e.kind === 'loan' && e.amount === 300)).toBe(true); expect(g.ledger.cash).toBeGreaterThan(cash + 200); days(w, 70); const l = g.bank.loans[0]!; expect(g.ledger.entries.filter(e => e.kind === 'loan_payment').length).toBe(2); expect(l.balance).toBeLessThan(300); expect(l.balance).toBeGreaterThan(245); }
      else { refused++; expect(g.bank.loans.length).toBe(0); } }
    expect(granted).toBeGreaterThan(5); expect(refused).toBeGreaterThan(1); });
  it('a missed payment is told, and the third ends the business', () => { const { w, g } = start(4); g.bank.loans.push({ id: 1, bankId: g.bank.bankId!, principal: 5000, balance: 5000, rate: 0.08, payment: 2400, taken: g.clock.date, months: 12, missed: 0 }); days(w, 125);
    expect(g.incidents.filter(i => i.kind === 'loan_missed').length).toBeGreaterThanOrEqual(3); expect(g.bank.bankrupt).toBeDefined(); expect(g.incidents.filter(i => i.kind === 'bankruptcy').length).toBe(1); });
  it('a run lets only a little out, and a failed bank locks the rest away for months', () => { const { w, g, bank, reg } = start(2); w.bank.deposit(1000); const e = reg.get(bank.id)!; e.status = 'run';
    expect(w.bank.drawable()).toBeCloseTo(1000 * B.run.weeklyShare + 25); expect(() => w.bank.withdraw(900)).toThrow(/little/); w.bank.withdraw(225); expect(w.bank.drawable()).toBe(0); expect(() => w.bank.open(w.bank.banks()[1]!.id)).toThrow(/run/);
    e.status = 'closed'; w.sim.bus.emit('register_changed', { entityId: e.id, kind: 'bank', status: 'closed', name: e.name }); expect(w.sim.stepDay().stops.some(i => i.kind === 'bank_closed')).toBe(true); expect(g.bank.deposit).toBe(0); expect(g.bank.bankId).toBeUndefined(); expect(g.bank.frozen[0]!.amount).toBe(775); expect(g.incidents.some(i => i.kind === 'bank_closed')).toBe(true);
    const share = g.bank.frozen[0]!.share; days(w, 19 * 30); expect(g.bank.frozen.length).toBe(0); const back = g.ledger.entries.filter(x => x.kind === 'bank_recovered').reduce((t, x) => t + x.amount, 0); expect(back).toBeCloseTo(775 * share, 1); expect(share).toBeLessThanOrEqual(B.failure.recover[1]); });
  it('the papers warn before a bank closes, and some shops lose money there in five years', () => { let closedWithWarning = 0, closed = 0, lost = 0;
    for (let seed = 1; seed <= 12; seed++) { const w = newWorld(seed, FOUNDER), log = runBot(w, 1826, { bank: 0.5 }); if (log.lostAtBank) lost++; const reg = w.media.register;
      for (const b of reg.byKind('bank')) if (b.status === 'closed') { closed++; const h = reg.history(b.id), end = h.find(r => r.to === 'closed')!; if (h.some(r => r.date < end.date && (r.to === 'uneasy' || r.to === 'run'))) closedWithWarning++; } }
    expect(closed).toBeGreaterThan(5); expect(closedWithWarning).toBe(closed); expect(lost).toBeGreaterThanOrEqual(1); });
  it('the yearly tax is told in January and paid in March', () => { const { w, g } = start(5); post(w.sim.api(), 'balance', 6000, 'order 99'); days(w, 370); const n = g.incidents.find(i => i.kind === 'tax_notice')!; expect(n.date).toBe('1931-01-02'); const p = profit(g, 1930); expect(n.payload.profit).toBe(p);
    const due = Math.round((p - B.tax.exemption) * B.tax.rate); expect(n.payload.amount).toBe(due); expect(due).toBeGreaterThan(100); days(w, 80); expect(g.ledger.entries.filter(e => e.kind === 'tax').map(e => e.amount)).toEqual([-due]); expect(profit(g, 1931)).toBeGreaterThan(-400); /* the tax itself is not a cost of the trade */ });
  it('a sheet says what one car brought and cost, and all of it survives a save', () => { const w = newWorld(3, FOUNDER), g = w.sim.g; runBot(w, 500, { bank: 0.4 }); const o = g.market.orders.find(x => x.state === 'delivered' && !!x.carId)!, s = carSheet(g, o.id)!; expect(s.paid).toBeGreaterThan(o.deposit); expect(s.left).toBeCloseTo(s.paid - s.materialsAndWages, 1); expect(s.ownHours).toBeGreaterThan(50);
    const again = openWorld(load(save(g))); expect(again.sim.g.bank).toEqual(g.bank); for (let i = 0; i < 40; i++) { w.sim.stepDay(); again.sim.stepDay(); } expect(again.sim.g.bank).toEqual(g.bank); expect(again.sim.g.ledger.cash).toBe(g.ledger.cash); });
});
