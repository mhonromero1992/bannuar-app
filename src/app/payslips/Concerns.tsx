import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React from 'react';
import {Badge, Button, Card, Empty, KeyValue, ResourceView, Screen, Txt} from '../../components/ui';
import {CONCERN_CATEGORY, CONCERN_STATUS, label, tone} from '../../config/labels';
import {fmtDate} from '../../lib/format';
import type {RootStackParamList} from '../../navigations/types';
import {loadConcerns} from '../../services/payslips';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';

/** Payroll concerns with their status and payroll's answer. */
export default function Concerns() {
  const focusId = useRoute<RouteProp<RootStackParamList, 'Concerns'>>().params?.focusId;
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.concerns, () => loadConcerns(employeeId));
  useRefreshOnFocus(res);
  return (
    <Screen title="Payroll concerns" back refreshing={res.refreshing} onRefresh={res.refresh}>
      <ResourceView
        resource={res}
        isEmpty={d => d.length === 0}
        empty={<Empty title="No concerns" body="If something on a payslip looks wrong, open the payslip and report a concern." />}>
        {list =>
          list.map(c => (
            <Card key={c.id} highlight={c.id === focusId}>
              <Badge tone={tone(CONCERN_STATUS, c.status)}>{label(CONCERN_STATUS, c.status)}</Badge>
              <Txt variant="heading">{label(CONCERN_CATEGORY, c.category)}</Txt>
              <Txt>{c.description}</Txt>
              <Txt variant="small" color="muted">{`Sent ${fmtDate(c.created_at)}`}</Txt>
              {c.resolution ? <KeyValue label={c.resolved_at ? `Payroll's answer, ${fmtDate(c.resolved_at)}` : "Payroll's answer"} value={c.resolution} /> : null}
            </Card>
          ))
        }
      </ResourceView>
      <Button title="Report a concern" variant="secondary" onPress={() => nav.navigate('ReportConcern')} />
    </Screen>
  );
}
