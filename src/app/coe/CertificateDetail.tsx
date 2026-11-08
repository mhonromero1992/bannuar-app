import {type RouteProp, useRoute} from '@react-navigation/native';
import React, {useState} from 'react';
import {Linking, StyleSheet, View} from 'react-native';
import {useTheme} from 'styled-components/native';
import {Badge, Button, Card, Empty, KeyValue, Loading, Notice, Screen, Txt} from '../../components/ui';
import {COE_PURPOSE, label} from '../../config/labels';
import {errorText} from '../../lib/errors';
import {fmtDate} from '../../lib/format';
import type {RootStackParamList} from '../../navigations/types';
import {loadCoe, openCertificate, verifyUrl} from '../../services/coe';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';

/** An issued certificate: its number, the code anyone can check on the website, and the PDF. */
export default function CertificateDetail() {
  const {id} = useRoute<RouteProp<RootStackParamList, 'CertificateDetail'>>().params;
  const {colors} = useTheme();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.coe, () => loadCoe(employeeId));
  const c = res.data?.certificates.find(x => x.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    if (!c) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await openCertificate(c, employeeId);
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };

  if (!c) {
    return (
      <Screen title="Certificate" back>
        {res.status === 'loading' ? <Loading /> : <Empty title="Certificate not found" />}
      </Screen>
    );
  }
  const site = verifyUrl().replace(/^https?:\/\//, '');
  return (
    <Screen title="Certificate" back>
      {c.revoked_at ? <Badge tone="bad">Withdrawn</Badge> : <Badge tone="ok">Valid</Badge>}
      <Txt variant="display" accessibilityRole="header">
        {c.certificate_no}
      </Txt>
      {c.revoked_at ? <Notice tone="bad" title={`Withdrawn on ${fmtDate(c.revoked_at)}`}>{c.revoked_reason ?? 'Ask HR for a new certificate.'}</Notice> : null}
      <Card>
        <Txt variant="label" color="muted">
          Verification code
        </Txt>
        <View style={[styles.code, {backgroundColor: colors.panel2}]}>
          <Txt variant="figure" selectable accessibilityLabel={`Verification code ${c.verification_code.split('').join(' ')}`}>
            {c.verification_code}
          </Txt>
        </View>
        <Txt>{`Anyone holding the certificate, such as a bank or an employer, can check this code on ${site}. It shows whether the certificate is genuine or withdrawn.`}</Txt>
        <Button title="Open the check page" variant="ghost" onPress={() => Linking.openURL(verifyUrl())} />
      </Card>
      <Card>
        <KeyValue label="Issued" value={fmtDate(c.issued_at)} />
        {c.purpose ? <KeyValue label="Purpose" value={label(COE_PURPOSE, c.purpose)} /> : null}
        <KeyValue label="Compensation" value={c.include_compensation ? 'Included' : 'Not included'} />
      </Card>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {c.file_path ? (
        <Button title="Open the PDF" icon="file" onPress={open} busy={busy} accessibilityHint="Downloads the certificate and opens it in your PDF viewer, where you can share or print it" />
      ) : (
        <Notice tone="info">HR has not attached the PDF yet. Ask HR for the printed copy.</Notice>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({code: {borderRadius: 10, paddingVertical: 14, alignItems: 'center'}});
