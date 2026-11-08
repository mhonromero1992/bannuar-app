import {supabase} from '../config/supabase';
import type {Announcement, Receipt} from '../types/db';
import {exec, run} from './db';

/**
 * The "read announcements" policy already limits a guard to published, unexpired announcements for
 * everyone, their area or their post. Pinned first, then urgent, important, normal, then newest.
 */
export const ANNOUNCEMENT_COLUMNS = 'id,title,body,category,priority,requires_ack,pinned,published_at,expires_at';
const PRIORITY_RANK: Record<string, number> = {urgent: 0, important: 1, normal: 2};

export function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) ||
      (b.published_at ?? '').localeCompare(a.published_at ?? ''),
  );
}

export interface AnnouncementsData {
  items: Announcement[];
  receipts: Record<string, Receipt>;
}

export async function loadAnnouncements(employeeId: string): Promise<AnnouncementsData> {
  const [items, receipts] = await Promise.all([
    run(supabase.from('announcements').select(ANNOUNCEMENT_COLUMNS).order('published_at', {ascending: false}).limit(50)),
    run(supabase.from('announcement_receipts').select('announcement_id,read_at,acknowledged_at').eq('employee_id', employeeId)),
  ]);
  const byId: Record<string, Receipt> = {};
  for (const r of (receipts ?? []) as Receipt[]) {
    byId[r.announcement_id] = r;
  }
  return {items: sortAnnouncements((items ?? []) as Announcement[]), receipts: byId};
}

/** Announcements that ask for an acknowledgment the guard has not given yet. */
export function waitingForAck(data: AnnouncementsData): Announcement[] {
  return data.items.filter(a => a.requires_ack && !data.receipts[a.id]?.acknowledged_at);
}

/** Opening an announcement records the read; "I acknowledge" records the acknowledgment too. */
export async function markAnnouncementRead(id: string, acknowledge = false): Promise<void> {
  await exec(
    acknowledge
      ? supabase.rpc('mark_announcement_read', {p_announcement_id: id, p_acknowledge: true})
      : supabase.rpc('mark_announcement_read', {p_announcement_id: id}),
  );
}

/**
 * Pictures for an announcement live in the private announcement-media bucket under
 * <announcement id>/; the app shows them through signed links that last ten minutes.
 */
export async function announcementImages(id: string): Promise<string[]> {
  const bucket = supabase.storage.from('announcement-media');
  const {data, error} = await bucket.list(id, {limit: 6, sortBy: {column: 'name', order: 'asc'}});
  if (error || !data?.length) {
    return [];
  }
  const paths = data.filter(f => /\.(jpe?g|png|webp)$/i.test(f.name)).map(f => `${id}/${f.name}`);
  if (!paths.length) {
    return [];
  }
  const signed = await bucket.createSignedUrls(paths, 600);
  return (signed.data ?? []).map(s => s.signedUrl).filter((u): u is string => Boolean(u));
}
