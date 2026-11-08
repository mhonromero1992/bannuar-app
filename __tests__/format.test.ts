import {
  daysBetween,
  fmtDate,
  fmtDateRange,
  fmtDateTime,
  fmtLongDate,
  fmtMobile,
  fmtNumber,
  fmtPeso,
  fmtRelativeDay,
  fullName,
  greeting,
  isPhMobile,
  mask,
  todayManila,
} from '../src/lib/format';

describe('peso, as the prompt and the portal write it', () => {
  it('₱1,234.56', () => {
    expect(fmtPeso(1234.56)).toBe('₱1,234.56');
    expect(fmtPeso('9530')).toBe('₱9,530.00');
    expect(fmtPeso(1234567.891)).toBe('₱1,234,567.89');
    expect(fmtPeso(0)).toBe('₱0.00');
    expect(fmtPeso(-200)).toBe('-₱200.00');
  });
  it('nothing for nothing', () => {
    expect(fmtPeso(null)).toBe('');
    expect(fmtPeso('')).toBe('');
    expect(fmtPeso('abc')).toBe('');
  });
});

describe('dates: "8 Nov 2026", in Manila time', () => {
  it('calendar days stay the same day', () => {
    expect(fmtDate('2026-11-08')).toBe('8 Nov 2026');
    expect(fmtDate('2026-01-31')).toBe('31 Jan 2026');
  });
  it('timestamps are read in Manila (UTC+8)', () => {
    // 16:30 UTC on the 7th is 00:30 on the 8th in Manila
    expect(fmtDate('2026-11-07T16:30:00Z')).toBe('8 Nov 2026');
    expect(fmtDateTime('2026-11-08T06:05:00Z')).toBe('8 Nov 2026, 2:05 PM');
    expect(fmtDateTime('2026-11-07T16:00:00Z')).toBe('8 Nov 2026, 12:00 AM');
    expect(fmtDateTime('2026-11-08T04:00:00Z')).toBe('8 Nov 2026, 12:00 PM');
  });
  it('long dates and ranges', () => {
    expect(fmtLongDate('2026-11-20')).toBe('Friday, 20 Nov 2026');
    expect(fmtDateRange('2026-11-20', '2026-11-20')).toBe('20 Nov 2026');
    expect(fmtDateRange('2026-11-20', '2026-11-21')).toBe('20 to 21 Nov 2026');
    expect(fmtDateRange('2026-11-28', '2026-12-02')).toBe('28 Nov to 2 Dec 2026');
    expect(fmtDateRange('2026-12-28', '2027-01-02')).toBe('28 Dec 2026 to 2 Jan 2027');
  });
  it('today in Manila, and day arithmetic', () => {
    expect(todayManila(new Date('2026-11-07T15:59:00Z'))).toBe('2026-11-07');
    expect(todayManila(new Date('2026-11-07T16:00:00Z'))).toBe('2026-11-08');
    expect(daysBetween('2026-11-08', '2026-11-15')).toBe(7);
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2);
    expect(fmtRelativeDay('2026-11-15', '2026-11-08')).toBe('in 7 days');
    expect(fmtRelativeDay('2026-11-08', '2026-11-08')).toBe('today');
    expect(fmtRelativeDay('2026-11-09', '2026-11-08')).toBe('tomorrow');
    expect(fmtRelativeDay('2026-11-05', '2026-11-08')).toBe('3 days ago');
  });
  it('a greeting by the Manila clock', () => {
    expect(greeting(new Date('2026-11-08T00:00:00Z'))).toBe('Good morning');
    expect(greeting(new Date('2026-11-08T06:00:00Z'))).toBe('Good afternoon');
    expect(greeting(new Date('2026-11-08T12:00:00Z'))).toBe('Good evening');
  });
});

describe('mobile numbers: "0917 123 4567"', () => {
  it('formats any Philippine way of writing it', () => {
    expect(fmtMobile('09171234567')).toBe('0917 123 4567');
    expect(fmtMobile('+63 917 123 4567')).toBe('0917 123 4567');
    expect(fmtMobile('9171234567')).toBe('0917 123 4567');
    expect(fmtMobile('0917-123-4567')).toBe('0917 123 4567');
  });
  it('leaves other numbers as they are and tells mobiles apart', () => {
    expect(fmtMobile('(072) 555 0101')).toBe('(072) 555 0101');
    expect(isPhMobile('0917 123 4567')).toBe(true);
    expect(isPhMobile('+639171234567')).toBe(true);
    expect(isPhMobile('0817 123 4567')).toBe(false);
    expect(isPhMobile('0917 123 456')).toBe(false);
    expect(isPhMobile('')).toBe(false);
  });
});

describe('names, numbers, masks', () => {
  it('full name like the database', () => {
    expect(fullName({first_name: 'Juan', middle_name: 'Pedro', last_name: 'Dela Cruz', suffix: 'Jr.'})).toBe('Juan P. Dela Cruz Jr.');
    expect(fullName({first_name: 'Bea', middle_name: null, last_name: 'Lim'})).toBe('Bea Lim');
  });
  it('numbers and masks', () => {
    expect(fmtNumber('104.00')).toBe('104');
    expect(fmtNumber(2.5)).toBe('2.5');
    expect(mask('02-2345678-9', 3)).toBe('•••••••••8-9');
    expect(mask('1234')).toBe('••••1234');
  });
});
