/**
 * Formats shared with the portal's words: ₱1,234.56, "8 Nov 2026", "0917 123 4567". Written out by
 * hand rather than with Intl, so every Android version prints the same thing (Hermes' Intl follows
 * the phone's Java locale data). Times are Manila time (UTC+8, no daylight saving).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MANILA_MS = 8 * 3600 * 1000;

type Parts = {y: number; m: number; d: number; h: number; min: number; wd: number};

/** A calendar day stored as YYYY-MM-DD stays that day; a timestamp is read in Manila time. */
function parts(v: string | Date): Parts | null {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return {y, m: m - 1, d, h: 0, min: 0, wd};
  }
  const t = typeof v === 'string' ? Date.parse(v) : v.getTime();
  if (Number.isNaN(t)) {
    return null;
  }
  const z = new Date(t + MANILA_MS);
  return {y: z.getUTCFullYear(), m: z.getUTCMonth(), d: z.getUTCDate(), h: z.getUTCHours(), min: z.getUTCMinutes(), wd: z.getUTCDay()};
}

/** "8 Nov 2026" */
export function fmtDate(v?: string | Date | null): string {
  const p = v ? parts(v) : null;
  return p ? `${p.d} ${MONTHS[p.m]} ${p.y}` : '';
}

/** "8 Nov 2026, 2:05 PM" */
export function fmtDateTime(v?: string | Date | null): string {
  const p = v ? parts(v) : null;
  if (!p) {
    return '';
  }
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${p.d} ${MONTHS[p.m]} ${p.y}, ${h12}:${String(p.min).padStart(2, '0')} ${p.h < 12 ? 'AM' : 'PM'}`;
}

/** "Friday, 20 Nov 2026" */
export function fmtLongDate(v?: string | Date | null): string {
  const p = v ? parts(v) : null;
  return p ? `${DAYS[p.wd]}, ${p.d} ${MONTHS[p.m]} ${p.y}` : '';
}

/** "20 Nov 2026", "20 to 21 Nov 2026", "28 Nov to 2 Dec 2026", "28 Dec 2026 to 2 Jan 2027" */
export function fmtDateRange(a?: string | null, b?: string | null): string {
  const p = a ? parts(a) : null;
  const q = b ? parts(b) : null;
  if (!p) {
    return '';
  }
  if (!q || (p.y === q.y && p.m === q.m && p.d === q.d)) {
    return fmtDate(a);
  }
  if (p.y === q.y && p.m === q.m) {
    return `${p.d} to ${q.d} ${MONTHS[q.m]} ${q.y}`;
  }
  if (p.y === q.y) {
    return `${p.d} ${MONTHS[p.m]} to ${q.d} ${MONTHS[q.m]} ${q.y}`;
  }
  return `${fmtDate(a)} to ${fmtDate(b)}`;
}

/** "₱1,234.56"; "" for nothing. */
export function fmtPeso(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') {
    return '';
  }
  const n = Number(v);
  if (!Number.isFinite(n)) {
    return '';
  }
  const [whole, cents] = Math.abs(n).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}₱${grouped}.${cents}`;
}

/** 13 -> "13", 2.5 -> "2.5", 104.00 -> "104" */
export function fmtNumber(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') {
    return '';
  }
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '';
}

/** The last ten digits of a Philippine mobile number, as the database reads it (normalize_ph_mobile). */
export function mobileDigits(v?: string | null): string {
  return (v ?? '').replace(/\D/g, '').slice(-10);
}

/** True for 09xx, +639xx and 9xx numbers with ten digits after the 0. */
export function isPhMobile(v?: string | null): boolean {
  const all = (v ?? '').replace(/\D/g, '');
  const ok = all.length === 10 || (all.length === 11 && all.startsWith('0')) || (all.length === 12 && all.startsWith('63'));
  return ok && /^9\d{9}$/.test(mobileDigits(v));
}

/** "0917 123 4567" */
export function fmtMobile(v?: string | null): string {
  if (!v) {
    return '';
  }
  if (!isPhMobile(v)) {
    return v;
  }
  const d = mobileDigits(v);
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Today in Manila as YYYY-MM-DD. */
export function todayManila(now: Date = new Date()): string {
  return new Date(now.getTime() + MANILA_MS).toISOString().slice(0, 10);
}

/** Whole days from a to b (calendar days). */
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((t(b) - t(a)) / 86400000);
}

/** "today", "tomorrow", "in 7 days", "yesterday", "3 days ago" */
export function fmtRelativeDay(day: string, today: string = todayManila()): string {
  const n = daysBetween(today, day);
  if (n === 0) {
    return 'today';
  }
  if (n === 1) {
    return 'tomorrow';
  }
  if (n === -1) {
    return 'yesterday';
  }
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** "Juan P. Dela Cruz Jr.", like the database's full_name(). */
export function fullName(e?: {first_name?: string | null; middle_name?: string | null; last_name?: string | null; suffix?: string | null} | null): string {
  if (!e) {
    return '';
  }
  const mi = e.middle_name?.trim() ? `${e.middle_name.trim()[0]}.` : '';
  return [e.first_name, mi, e.last_name, e.suffix?.trim()].filter(Boolean).join(' ');
}

/** Hides all but the last characters: "••••••78-9". */
export function mask(v?: string | null, keep = 4): string {
  if (!v) {
    return '';
  }
  return `${'•'.repeat(Math.max(4, v.length - keep))}${v.slice(-keep)}`;
}

/** "Good morning" until noon, "Good afternoon" until 6 PM, then "Good evening" (Manila time). */
export function greeting(now: Date = new Date()): string {
  const h = new Date(now.getTime() + MANILA_MS).getUTCHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
