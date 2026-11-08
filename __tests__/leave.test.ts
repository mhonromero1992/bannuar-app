import {canCancel, daysLeft, leaveDays, leaveFormProblem, leaveTypeNote, typesFor} from '../src/services/leave';
import type {LeaveType} from '../src/types/db';

const type = (over: Partial<LeaveType> = {}): LeaveType => ({
  id: 'lt1',
  code: 'SIL',
  name: 'Service incentive leave',
  description: null,
  days_per_year: 5,
  max_days_per_request: null,
  is_paid: true,
  requires_attachment: false,
  applies_to_sex: null,
  min_service_months: 12,
  sort_order: 10,
  ...over,
});

describe('leave days: first and last day included, as leave_requests_before_insert counts', () => {
  it('counts calendar days', () => {
    expect(leaveDays('2026-11-20', '2026-11-20')).toBe(1);
    expect(leaveDays('2026-11-20', '2026-11-22')).toBe(3);
    expect(leaveDays('2026-12-30', '2027-01-02')).toBe(4);
    expect(leaveDays('2028-02-28', '2028-03-01')).toBe(3);
  });
});

describe('who is offered which leave', () => {
  const types = [type(), type({id: 'm', code: 'MATERNITY', applies_to_sex: 'female'}), type({id: 'p', code: 'PATERNITY', applies_to_sex: 'male'})];
  it('maternity is not offered to a male guard, paternity not to a female guard', () => {
    expect(typesFor(types, {sex: 'male'}).map(t => t.code)).toEqual(['SIL', 'PATERNITY']);
    expect(typesFor(types, {sex: 'female'}).map(t => t.code)).toEqual(['SIL', 'MATERNITY']);
    expect(typesFor(types, {sex: null}).length).toBe(3);
  });
  it('explains service months, limits, attachments and unpaid leave', () => {
    expect(leaveTypeNote(type(), {date_hired: '2026-08-01'}, '2026-11-08')).toBe('Available after 12 months of service.');
    expect(leaveTypeNote(type(), {date_hired: '2020-01-01'}, '2026-11-08')).toBeNull();
    expect(leaveTypeNote(type({min_service_months: 0, max_days_per_request: 7, requires_attachment: true, is_paid: false}), null)).toBe(
      'Up to 7 days per request. Attach a supporting document. Without pay.',
    );
  });
});

describe('the form checks what it can before sending', () => {
  const today = '2026-11-08';
  it('asks for every part', () => {
    expect(leaveFormProblem({type: null, start: null, end: null, hasAttachment: false}, today)).toBe('Choose the kind of leave.');
    expect(leaveFormProblem({type: type(), start: '2026-11-20', end: null, hasAttachment: false}, today)).toBe('Enter the first and last day.');
    expect(leaveFormProblem({type: type(), start: '2026-11-20', end: '2026-11-19', hasAttachment: false}, today)).toBe('The last day is before the first day.');
    expect(leaveFormProblem({type: type(), start: '2026-11-01', end: '2026-11-02', hasAttachment: false}, today)).toMatch(/has passed/);
    expect(leaveFormProblem({type: type({max_days_per_request: 7}), start: '2026-11-20', end: '2026-11-30', hasAttachment: false}, today)).toMatch(/up to 7 days/);
    expect(leaveFormProblem({type: type({requires_attachment: true}), start: '2026-11-20', end: '2026-11-20', hasAttachment: false}, today)).toBe('Attach the supporting document.');
    expect(leaveFormProblem({type: type(), start: '2026-11-20', end: '2026-11-21', hasAttachment: false}, today)).toBeNull();
  });
  it('cancel: pending, or approved and not started', () => {
    expect(canCancel({status: 'pending_supervisor', start_date: '2026-11-01'}, today)).toBe(true);
    expect(canCancel({status: 'pending_hr', start_date: '2026-11-01'}, today)).toBe(true);
    expect(canCancel({status: 'approved', start_date: '2026-11-09'}, today)).toBe(true);
    expect(canCancel({status: 'approved', start_date: '2026-11-08'}, today)).toBe(false);
    expect(canCancel({status: 'rejected', start_date: '2026-12-01'}, today)).toBe(false);
  });
  it('days left this year', () => {
    expect(daysLeft({leave_type_id: 'x', code: 'SIL', name: 'SIL', year: 2026, credits: '5.0', used: '2.0', pending: 1})).toBe(2);
    expect(daysLeft({leave_type_id: 'x', code: 'SIL', name: 'SIL', year: 2026, credits: 5, used: 6, pending: 0})).toBe(0);
    expect(daysLeft({leave_type_id: 'x', code: 'LWOP', name: 'LWOP', year: 2026, credits: null, used: 0, pending: 0})).toBeNull();
  });
});
