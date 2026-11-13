import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Badge, Button, Card, Empty, ResourceView, Row, Screen, SectionLabel, Txt} from '../../components/ui';
import {ATTENDANCE_KIND, ATTENDANCE_SOURCE, label, LOCATION_CHECK, tone} from '../../config/labels';
import {fmtTime, fullName, manilaDay} from '../../lib/format';
import type {RootStackParamList} from '../../navigations/types';
import {loadAttendance, nextKind} from '../../services/attendance';
import {loadPost} from '../../services/commander';
import {guardAttendanceKey, KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';
import {dayTitle} from '../attendance/words';

/**
 * A commander's view of one guard of their post: the guard's time in and out of the last few days,
 * and, when the guard has no phone with them, logging it for them (LogAttendance with guardId).
 * Row level security lets a commander read only the logs of their posts.
 */
export default function GuardAttendance() {
  const {guardId} = useRoute<RouteProp<RootStackParamList, 'GuardAttendance'>>().params;
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const post = useResource(KEYS.post, () => loadPost(employeeId));
  // another person's logs: read fresh, not kept on this phone
  const res = useResource(guardAttendanceKey(guardId), () => loadAttendance(guardId), {persist: false});
  useRefreshOnFocus(res);
  const guard = post.data?.guards.find(g => g.id === guardId);
  const name = guard ? fullName(guard) : 'Guard';
  const next = nextKind(res.data);
  const canLog = guard ? ['active', 'on_leave', 'suspended'].includes(guard.status) : false;
  return (
    <Screen title={name} back refreshing={res.refreshing} onRefresh={res.refresh}>
      {guard ? <Txt color="muted">{`${guard.employee_no} · ${guard.position}`}</Txt> : null}
      <Card>
        <SectionLabel>No phone with them?</SectionLabel>
        <Txt>Log their time in or out from your phone: your location and a photo of the guard, taken now. The guard is told in their app, and HR sees that you logged it.</Txt>
        <View style={styles.actions}>
          <Button
            title="Log time in for them"
            icon="clock"
            variant={next === 'time_in' ? 'primary' : 'secondary'}
            disabled={!canLog}
            onPress={() => nav.navigate('LogAttendance', {kind: 'time_in', guardId})}
            testID="guard-in"
          />
          <Button
            title="Log time out for them"
            icon="clock"
            variant={next === 'time_out' ? 'primary' : 'secondary'}
            disabled={!canLog}
            onPress={() => nav.navigate('LogAttendance', {kind: 'time_out', guardId})}
            testID="guard-out"
          />
        </View>
      </Card>
      <ResourceView resource={res} isEmpty={logs => logs.length === 0} empty={<Empty title="No time in yet" body="This guard's time in and out of the last 31 days show here." />}>
        {logs => {
          const recent = logs.filter(l => Date.now() - Date.parse(l.logged_at) < 3 * 86400000);
          const days = [...new Set(recent.map(l => manilaDay(l.logged_at)))];
          return days.length ? (
            days.map(day => {
              const rows = recent.filter(l => manilaDay(l.logged_at) === day);
              return (
                <View key={day} style={styles.section}>
                  <SectionLabel>{dayTitle(day)}</SectionLabel>
                  <Card>
                    {rows.map((r, i) => (
                      <Row
                        key={r.id}
                        title={`${ATTENDANCE_KIND[r.kind]} · ${fmtTime(r.logged_at)}`}
                        detail={r.source === 'self' ? undefined : label(ATTENDANCE_SOURCE, r.source)}
                        right={<Badge tone={tone(LOCATION_CHECK, r.location_check)}>{label(LOCATION_CHECK, r.location_check)}</Badge>}
                        last={i === rows.length - 1}
                      />
                    ))}
                  </Card>
                </View>
              );
            })
          ) : (
            <Card>
              <Txt color="muted">Nothing in the last three days.</Txt>
            </Card>
          );
        }}
      </ResourceView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {gap: 8},
  section: {gap: 8},
});
