/** Names of the kept data (store/resources.ts), one per screen area. */
export const KEYS = {
  home: 'home',
  announcements: 'announcements',
  payslips: 'payslips',
  concerns: 'concerns',
  leave: 'leave',
  coe: 'coe',
  me: 'me',
  documents: 'documents',
  changes: 'changes',
  notifications: 'notifications',
  post: 'post',
  attendance: 'attendance',
  notices: 'notices',
} as const;

/** A commander's view of one guard's time in and out (not kept on the phone). */
export const guardAttendanceKey = (guardId: string) => `guard-attendance:${guardId}`;
