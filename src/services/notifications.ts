import type {RealtimeChannel} from '@supabase/supabase-js';
import {supabase} from '../config/supabase';
import type {AppNotification} from '../types/db';
import {exec, run} from './db';

/** A guard reads, marks and clears only their own notifications (policies on public.notifications). */
export const NOTIFICATION_COLUMNS = 'id,title,body,kind,link,read_at,created_at';

export async function loadNotifications(): Promise<AppNotification[]> {
  return ((await run(
    supabase.from('notifications').select(NOTIFICATION_COLUMNS).order('created_at', {ascending: false}).limit(50),
  )) ?? []) as AppNotification[];
}

export async function unreadCount(): Promise<number> {
  const {count, error} = await supabase.from('notifications').select('id', {count: 'exact', head: true}).is('read_at', null);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function markNotificationRead(id: string, at: Date = new Date()): Promise<void> {
  await exec(supabase.from('notifications').update({read_at: at.toISOString()}).eq('id', id).is('read_at', null));
}

export async function markAllNotificationsRead(at: Date = new Date()): Promise<void> {
  await exec(supabase.from('notifications').update({read_at: at.toISOString()}).is('read_at', null));
}

/** New notifications arrive live while the app is open (Supabase Realtime, filtered to this user). */
export function subscribeToNotifications(userId: string, onInsert: (n: AppNotification) => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`}, payload =>
      onInsert(payload.new as AppNotification),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
