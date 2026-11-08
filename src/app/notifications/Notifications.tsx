import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Button, Card, Empty, ResourceView, Row, Screen} from '../../components/ui';
import {fmtDateTime} from '../../lib/format';
import {routeForLink} from '../../navigations/linking';
import {loadNotifications, markAllNotificationsRead, markNotificationRead} from '../../services/notifications';
import {setBadge} from '../../services/push';
import {KEYS} from '../../store/keys';
import {mutateResource, useResource} from '../../store/resources';
import {useUi} from '../../store/ui';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';
import type {AppNotification} from '../../types/db';

/** The guard's own notifications; tapping one marks it read and opens its screen. */
export default function Notifications() {
  const nav = useNavigation();
  const res = useResource(KEYS.notifications, loadNotifications);
  useRefreshOnFocus(res, 15_000);
  const setUnread = useUi(s => s.setUnread);

  const markLocal = (pred: (n: AppNotification) => boolean) => {
    const now = new Date().toISOString();
    mutateResource<AppNotification[]>(KEYS.notifications, list => list.map(n => (pred(n) && !n.read_at ? {...n, read_at: now} : n)));
    const unread = ((res.data ?? []) as AppNotification[]).filter(n => !n.read_at && !pred(n)).length;
    setUnread(unread);
    setBadge(unread).catch(() => undefined);
  };

  const open = (n: AppNotification) => {
    if (!n.read_at) {
      markNotificationRead(n.id).catch(() => undefined);
      markLocal(x => x.id === n.id);
    }
    const route = routeForLink(n.link);
    if (route.name !== 'Notifications') {
      (nav.navigate as (name: string, params?: object) => void)(route.name, route.params);
    }
  };

  const unread = (res.data ?? []).some(n => !n.read_at);
  return (
    <Screen title="Notifications" back refreshing={res.refreshing} onRefresh={res.refresh}>
      <ResourceView resource={res} isEmpty={d => d.length === 0} empty={<Empty title="No notifications" body="Payslips, approvals, announcements and reminders show here." />}>
        {list => (
          <>
            {unread ? (
              <Button
                title="Mark all as read"
                variant="secondary"
                icon="check"
                onPress={() => {
                  markAllNotificationsRead().catch(() => undefined);
                  markLocal(() => true);
                }}
              />
            ) : null}
            <Card>
              {list.map((n, i) => (
                <Row key={n.id} title={n.title} detail={[n.body, fmtDateTime(n.created_at)].filter(Boolean).join('\n')} unread={!n.read_at} onPress={() => open(n)} last={i === list.length - 1} />
              ))}
            </Card>
          </>
        )}
      </ResourceView>
    </Screen>
  );
}
