import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React, {useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import {Badge, Button, Card, Empty, Notice, ResourceView, Row, Screen, SectionLabel, Txt} from '../../components/ui';
import {COE_PURPOSE, COE_STATUS, label, tone} from '../../config/labels';
import {errorText} from '../../lib/errors';
import {fmtDate} from '../../lib/format';
import type {RootStackParamList} from '../../navigations/types';
import {cancelCoe, isOverdue, loadCoe} from '../../services/coe';
import {KEYS} from '../../store/keys';
import {invalidate, useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {toast} from '../../store/ui';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';

/** Certificate of employment requests (due in three days) and the certificates already issued. */
export default function Coe() {
  const focus = useRoute<RouteProp<RootStackParamList, 'Coe'>>().params?.focusRequestId;
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.coe, () => loadCoe(employeeId));
  useRefreshOnFocus(res);
  const [error, setError] = useState<string | null>(null);

  const cancel = (id: string) =>
    Alert.alert('Cancel this request?', 'HR will stop working on it.', [
      {text: 'Keep it', style: 'cancel'},
      {
        text: 'Cancel the request',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelCoe(id);
            invalidate(KEYS.coe, KEYS.home);
            toast('Request cancelled.');
          } catch (e) {
            setError(errorText(e));
          }
        },
      },
    ]);

  return (
    <Screen title="Certificates of employment" back refreshing={res.refreshing} onRefresh={res.refresh} footer={<Button title="Request a certificate" onPress={() => nav.navigate('RequestCoe')} />}>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <ResourceView
        resource={res}
        isEmpty={d => d.requests.length === 0 && d.certificates.length === 0}
        empty={<Empty title="No certificates yet" body="Ask for a certificate of employment here. HR issues it within three days of your request." />}>
        {data => (
          <>
            {data.certificates.length ? (
              <View style={styles.section}>
                <SectionLabel>Issued</SectionLabel>
                <Card>
                  {data.certificates.map((c, i) => (
                    <Row
                      key={c.id}
                      title={c.certificate_no}
                      detail={`${c.purpose ? `${label(COE_PURPOSE, c.purpose)} · ` : ''}issued ${fmtDate(c.issued_at)}`}
                      right={c.revoked_at ? <Badge tone="bad">Withdrawn</Badge> : <Badge tone="ok">Valid</Badge>}
                      onPress={() => nav.navigate('CertificateDetail', {id: c.id})}
                      last={i === data.certificates.length - 1}
                    />
                  ))}
                </Card>
              </View>
            ) : null}
            {data.requests.length ? (
              <View style={styles.section}>
                <SectionLabel>Requests</SectionLabel>
                {data.requests.map(r => (
                  <Card key={r.id} highlight={r.id === focus}>
                    <View style={styles.badges}>
                      <Badge tone={tone(COE_STATUS, r.status)}>{label(COE_STATUS, r.status)}</Badge>
                      {isOverdue(r) ? <Badge tone="bad">Past the three days</Badge> : null}
                    </View>
                    <Txt variant="heading">{label(COE_PURPOSE, r.purpose)}</Txt>
                    {r.purpose_details ? <Txt>{r.purpose_details}</Txt> : null}
                    <Txt color="muted">
                      {[`Requested ${fmtDate(r.created_at)}`, r.status === 'pending' ? `due ${fmtDate(r.due_at)}` : null, r.include_compensation ? 'with compensation' : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Txt>
                    {r.decision_note ? <Txt>{`HR: ${r.decision_note}`}</Txt> : null}
                    {r.certificate ? <Button title="Open the certificate" variant="secondary" onPress={() => nav.navigate('CertificateDetail', {id: r.certificate!.id})} /> : null}
                    {r.status === 'pending' ? <Button title="Cancel this request" variant="ghost" onPress={() => cancel(r.id)} /> : null}
                  </Card>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ResourceView>
    </Screen>
  );
}

const styles = StyleSheet.create({section: {gap: 8}, badges: {flexDirection: 'row', gap: 8, flexWrap: 'wrap'}});
