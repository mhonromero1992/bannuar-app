import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Badge, Button, Card, SectionLabel, Txt} from '../../components/ui';
import {label, LOCATION_CHECK, tone} from '../../config/labels';
import {manilaDay, todayManila} from '../../lib/format';
import {loadAttendance, nextKind} from '../../services/attendance';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';
import {whenText} from './words';

/** The first thing on Home: where today's attendance stands, and the button for the next log. */
export function AttendanceCard() {
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.attendance, () => loadAttendance(employeeId));
  useRefreshOnFocus(res);
  const logs = res.data;
  const next = nextKind(logs);
  const last = logs?.[0];
  const today = todayManila();
  const timedOutToday = last?.kind === 'time_out' && manilaDay(last.logged_at) === today;
  return (
    <Card highlight>
      <SectionLabel>Attendance</SectionLabel>
      {logs === undefined ? (
        <Txt color="muted">{res.status === 'error' ? 'Your last time in could not be loaded. You can still log.' : 'Checking your last time in…'}</Txt>
      ) : next === 'time_out' && last ? (
        <>
          <Txt variant="heading">{`Timed in ${whenText(last.logged_at, today)}`}</Txt>
          <Badge tone={tone(LOCATION_CHECK, last.location_check)}>{label(LOCATION_CHECK, last.location_check)}</Badge>
        </>
      ) : timedOutToday && last ? (
        <Txt variant="heading">{`Timed out ${whenText(last.logged_at, today)}`}</Txt>
      ) : (
        <Txt variant="heading">Not timed in today</Txt>
      )}
      <Button title={next === 'time_in' ? 'Time in' : 'Time out'} icon="clock" onPress={() => nav.navigate('LogAttendance', {kind: next})} testID="attendance-next" />
      <Button title="My attendance" variant="ghost" onPress={() => nav.navigate('Attendance')} />
    </Card>
  );
}
