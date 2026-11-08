import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Badge, Card, Empty, ResourceView, Row, Screen} from '../../components/ui';
import {ANN_PRIORITY, label, tone} from '../../config/labels';
import {fmtDate} from '../../lib/format';
import {loadAnnouncements} from '../../services/announcements';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';

/** Published announcements for everyone, the guard's area or post: pinned first, then by priority. */
export default function Announcements() {
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.announcements, () => loadAnnouncements(employeeId));
  useRefreshOnFocus(res);
  return (
    <Screen title="Announcements" back refreshing={res.refreshing} onRefresh={res.refresh}>
      <ResourceView resource={res} isEmpty={d => d.items.length === 0} empty={<Empty title="No announcements" body="Announcements from HR and operations show here." />}>
        {data => (
          <Card>
            {data.items.map((a, i) => {
              const r = data.receipts[a.id];
              const needsAck = a.requires_ack && !r?.acknowledged_at;
              const detail = [a.pinned ? 'Pinned' : null, a.published_at ? fmtDate(a.published_at) : null, needsAck ? 'Needs your acknowledgment' : null].filter(Boolean).join(' · ');
              return (
                <Row
                  key={a.id}
                  title={a.title}
                  detail={detail}
                  unread={!r}
                  right={a.priority !== 'normal' ? <Badge tone={tone(ANN_PRIORITY, a.priority)}>{label(ANN_PRIORITY, a.priority)}</Badge> : null}
                  onPress={() => nav.navigate('AnnouncementDetail', {id: a.id})}
                  last={i === data.items.length - 1}
                />
              );
            })}
          </Card>
        )}
      </ResourceView>
    </Screen>
  );
}
