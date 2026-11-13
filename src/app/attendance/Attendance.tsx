import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Badge, Button, Card, Empty, ResourceView, Row, Screen, SectionLabel, Txt} from '../../components/ui';
import {ATTENDANCE_KIND, label, LOCATION_CHECK, tone} from '../../config/labels';
import {fmtTime, manilaDay} from '../../lib/format';
import {type AttendanceLog, loadAttendance, nextKind} from '../../services/attendance';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';
import {checkLine, dayTitle, sourceLine} from './words';

/** The guard's time in and time out of the last 31 days, by day, with how each was checked. */
export default function Attendance() {
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.attendance, () => loadAttendance(employeeId));
  useRefreshOnFocus(res);
  const next = nextKind(res.data);
  return (
    <Screen title="Attendance" back refreshing={res.refreshing} onRefresh={res.refresh}>
      <View style={styles.actions}>
        <Button title="Time in" icon="clock" variant={next === 'time_in' ? 'primary' : 'secondary'} onPress={() => nav.navigate('LogAttendance', {kind: 'time_in'})} testID="attendance-in" />
        <Button title="Time out" icon="clock" variant={next === 'time_out' ? 'primary' : 'secondary'} onPress={() => nav.navigate('LogAttendance', {kind: 'time_out'})} testID="attendance-out" />
      </View>
      <ResourceView
        resource={res}
        isEmpty={logs => logs.length === 0}
        empty={<Empty title="No time in yet" body="Your time in and time out of the last 31 days show here." />}>
        {logs => byDay(logs).map(([day, rows]) => (
          <View key={day} style={styles.section}>
            <SectionLabel>{dayTitle(day)}</SectionLabel>
            <Card>
              {rows.map((r, i) => (
                <Row
                  key={r.id}
                  title={`${ATTENDANCE_KIND[r.kind]} · ${fmtTime(r.logged_at)}`}
                  detail={[r.source === 'manual' ? '' : checkLine(r.location_check, r.distance_m, r.accuracy_m, r.site?.name), sourceLine(r.source, r.manual_reason), r.mock_location ? 'A mock location app was on' : ''].filter(Boolean).join('. ')}
                  right={<Badge tone={tone(LOCATION_CHECK, r.location_check)}>{label(LOCATION_CHECK, r.location_check)}</Badge>}
                  last={i === rows.length - 1}
                />
              ))}
            </Card>
          </View>
        ))}
      </ResourceView>
      <Txt variant="small" color="muted">
        HR sees each log with its photo and the time the server recorded. If one is marked away from the post while you were there, tell your detachment commander.
      </Txt>
    </Screen>
  );
}

function byDay(logs: AttendanceLog[]): Array<[string, AttendanceLog[]]> {
  const days = new Map<string, AttendanceLog[]>();
  for (const l of logs) {
    const d = manilaDay(l.logged_at);
    days.set(d, [...(days.get(d) ?? []), l]);
  }
  return [...days.entries()];
}

const styles = StyleSheet.create({
  actions: {gap: 8},
  section: {gap: 8},
});
