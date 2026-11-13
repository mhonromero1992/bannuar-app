import {fmtDate, fmtDistance, fmtTime, manilaDay, todayManila} from '../../lib/format';
import type {LocationCheck} from '../../services/location';

/** "at 7:58 AM", "yesterday at 7:02 PM", "on 8 Nov 2026 at 7:02 PM" */
export function whenText(iso: string, today: string = todayManila()): string {
  const day = manilaDay(iso);
  const time = fmtTime(iso);
  if (day === today) {
    return `at ${time}`;
  }
  const yesterday = manilaDay(new Date(Date.parse(`${today}T12:00:00+08:00`) - 86400000));
  return day === yesterday ? `yesterday at ${time}` : `on ${fmtDate(day)} at ${time}`;
}

/** "Today", "Yesterday", or "8 Nov 2026", for the list's day headings. */
export function dayTitle(day: string, today: string = todayManila()): string {
  if (day === today) {
    return 'Today';
  }
  const yesterday = manilaDay(new Date(Date.parse(`${today}T12:00:00+08:00`) - 86400000));
  return day === yesterday ? 'Yesterday' : fmtDate(day);
}

/** The line under a log's check, for the guard. */
export function checkLine(check: LocationCheck, distance: number | null, accuracy: number | null, post?: string | null): string {
  const from = post ? `from ${post}` : 'from your post';
  switch (check) {
    case 'at_post':
    case 'away':
      return distance !== null ? `About ${fmtDistance(distance)} ${from}` : '';
    case 'unsure':
      return accuracy !== null ? `The GPS was accurate only to ${fmtDistance(accuracy)}` : 'The GPS was too rough to tell';
    case 'no_location':
      return 'Your phone gave no location';
    case 'post_not_set':
      return "Your post's location is not set yet";
    case 'no_post':
      return 'You had no post on file';
    case 'manual':
      return 'Entered by HR';
    default:
      return '';
  }
}

/** Logs HR will look at more closely. */
export function flagged(check: LocationCheck, mocked: boolean | null | undefined): boolean {
  return check === 'away' || check === 'unsure' || check === 'no_location' || mocked === true;
}

/** Who logged it, when not the guard's own phone: "Logged by your commander", "Entered by HR: <reason>". */
export function sourceLine(source: string | null | undefined, reason?: string | null): string {
  if (source === 'commander') {
    return 'Logged by your commander';
  }
  if (source === 'manual') {
    return reason ? `Entered by HR: ${reason}` : 'Entered by HR';
  }
  return '';
}
