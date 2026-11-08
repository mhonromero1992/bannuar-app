import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Badge, Button, Card, Empty, ResourceView, Row, Screen, SectionLabel, Txt} from '../../components/ui';
import {LEAVE_STATUS, label, tone} from '../../config/labels';
import {fmtDateRange, fmtNumber} from '../../lib/format';
import {daysLeft, loadLeave} from '../../services/leave';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';

/** Credits left this year (the leave_balances view), then every request with its status. */
export default function Leave() {
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.leave, () => loadLeave(employeeId));
  useRefreshOnFocus(res);
  return (
    <Screen title="Leave" refreshing={res.refreshing} onRefresh={res.refresh} footer={<Button title="File leave" onPress={() => nav.navigate('FileLeave')} testID="file-leave" />}>
      <ResourceView resource={res}>
        {data => (
          <>
            <View style={styles.section}>
              <SectionLabel>{`Credits for ${new Date().getFullYear()}`}</SectionLabel>
              {data.balances.length ? (
                data.balances.map(b => {
                  const left = daysLeft(b);
                  return (
                    <Card key={b.leave_type_id}>
                      <Txt variant="heading">{b.name}</Txt>
                      <Txt variant="figure">{left === null ? 'No yearly credits' : `${fmtNumber(left)} ${left === 1 ? 'day' : 'days'} left`}</Txt>
                      <Txt color="muted">{`${fmtNumber(b.credits)} a year · ${fmtNumber(b.used)} used · ${fmtNumber(b.pending)} waiting for approval`}</Txt>
                    </Card>
                  );
                })
              ) : (
                <Card>
                  <Txt color="muted">No yearly leave credits on file yet.</Txt>
                </Card>
              )}
            </View>
            <View style={styles.section}>
              <SectionLabel>My requests</SectionLabel>
              {data.requests.length ? (
                <Card>
                  {data.requests.map((r, i) => (
                    <Row
                      key={r.id}
                      title={r.type?.name ?? 'Leave'}
                      detail={`${fmtDateRange(r.start_date, r.end_date)} · ${fmtNumber(r.days)} ${Number(r.days) === 1 ? 'day' : 'days'}`}
                      right={<Badge tone={tone(LEAVE_STATUS, r.status)}>{label(LEAVE_STATUS, r.status)}</Badge>}
                      onPress={() => nav.navigate('LeaveDetail', {id: r.id})}
                      last={i === data.requests.length - 1}
                    />
                  ))}
                </Card>
              ) : (
                <Empty title="No leave filed" body="Leave you file goes to your detachment commander, then to HR." />
              )}
            </View>
          </>
        )}
      </ResourceView>
    </Screen>
  );
}

const styles = StyleSheet.create({section: {gap: 8}});
