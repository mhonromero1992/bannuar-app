import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Badge, Button, Card, Empty, ResourceView, Row, Screen, SectionLabel, Txt} from '../../components/ui';
import {EMPLOYEE_STATUS, label, tone} from '../../config/labels';
import {fmtDateRange, fmtNumber, fullName} from '../../lib/format';
import {loadPost} from '../../services/commander';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';

/** For detachment commanders and inspectors: leave waiting for endorsement, and the guards of their posts. */
export default function MyPost() {
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.post, () => loadPost(employeeId));
  useRefreshOnFocus(res, 15_000);
  return (
    <Screen title="My post" back refreshing={res.refreshing} onRefresh={res.refresh}>
      <ResourceView resource={res} isEmpty={d => d.sites.length === 0} empty={<Empty title="No posts assigned" body="Operations names the commanders of each post in the portal." />}>
        {data => (
          <>
            <Txt color="muted">{data.sites.map(s => s.name).join(' · ')}</Txt>
            <Button title="Report an incident" icon="alert" variant="secondary" onPress={() => nav.navigate('ReportIncident')} testID="report-incident" />
            <View style={styles.section}>
              <SectionLabel>Leave to endorse</SectionLabel>
              {data.pending.length ? (
                <Card>
                  {data.pending.map((r, i) => (
                    <Row
                      key={r.id}
                      title={r.employee ? fullName(r.employee) : 'Guard'}
                      detail={`${r.type?.name ?? 'Leave'} · ${fmtDateRange(r.start_date, r.end_date)} · ${fmtNumber(r.days)} ${Number(r.days) === 1 ? 'day' : 'days'}`}
                      onPress={() => nav.navigate('Endorse', {id: r.id})}
                      last={i === data.pending.length - 1}
                    />
                  ))}
                </Card>
              ) : (
                <Card>
                  <Txt color="muted">Nothing to endorse. New leave from your guards shows here and in your notifications.</Txt>
                </Card>
              )}
            </View>
            <View style={styles.section}>
              <SectionLabel>{`Guards (${data.guards.length})`}</SectionLabel>
              <Txt variant="small" color="muted">
                Tap a guard to see their time in and out, or to log it for them when they have no phone with them.
              </Txt>
              <Card>
                {data.guards.map((g, i) => (
                  <Row
                    key={g.id}
                    title={fullName(g)}
                    detail={`${g.employee_no} · ${g.position}${data.sites.length > 1 ? ` · ${data.sites.find(s => s.id === g.site_id)?.name ?? ''}` : ''}`}
                    right={g.status !== 'active' ? <Badge tone={tone(EMPLOYEE_STATUS, g.status)}>{label(EMPLOYEE_STATUS, g.status)}</Badge> : null}
                    onPress={g.id === employeeId ? undefined : () => nav.navigate('GuardAttendance', {guardId: g.id})}
                    testID={`guard-${g.id}`}
                    last={i === data.guards.length - 1}
                  />
                ))}
              </Card>
            </View>
          </>
        )}
      </ResourceView>
    </Screen>
  );
}

const styles = StyleSheet.create({section: {gap: 8}});
