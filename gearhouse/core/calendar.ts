// Dates for the simulation: plain 'YYYY-MM-DD' strings, real weekdays and leap years, holidays from data.
export type DateStr = string;
export interface HolidayData { fixed: { month: number; day: number; name: string }[]; floating: { month: number; weekday: number; nth: number; name: string }[] }

const utc = (d: DateStr) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y!, m! - 1, dd!)); };
const str = (t: Date): DateStr => t.toISOString().slice(0, 10);
export const addDays = (d: DateStr, n: number): DateStr => { const t = utc(d); t.setUTCDate(t.getUTCDate() + n); return str(t); };
/** 0 = Sunday ... 6 = Saturday */
export const weekday = (d: DateStr): number => utc(d).getUTCDay();
export const daysBetween = (a: DateStr, b: DateStr): number => Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000);
export const parts = (d: DateStr) => { const [year, month, day] = d.split('-').map(Number); return { year: year!, month: month!, day: day! }; };

/** the holiday's name on that date, or null */
export function holidayOn(d: DateStr, data: HolidayData): string | null {
  const { year, month, day } = parts(d);
  for (const f of data.fixed) if (f.month === month && f.day === day) return f.name;
  for (const f of data.floating) { if (f.month !== month || weekday(d) !== f.weekday) continue;
    const dim = new Date(Date.UTC(year, month, 0)).getUTCDate(), nth = f.nth > 0 ? Math.ceil(day / 7) === f.nth : day + 7 > dim;   // nth -1: the last such weekday of the month
    if (nth) return f.name; }
  return null;
}
