import {useNavigation} from '@react-navigation/native';
import React, {useState} from 'react';
import {StyleSheet, Switch, View} from 'react-native';
import {useTheme} from 'styled-components/native';
import {Button, Field, Notice, Screen, SelectField, Txt} from '../../components/ui';
import {COE_PURPOSE} from '../../config/labels';
import {errorText} from '../../lib/errors';
import {COE_PURPOSES, type CoePurpose, requestCoe} from '../../services/coe';
import {KEYS} from '../../store/keys';
import {invalidate} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {toast} from '../../store/ui';

/** A request for a certificate of employment. The database sets the due date: three days (DOLE LA 06-20). */
export default function RequestCoe() {
  const nav = useNavigation();
  const {colors} = useTheme();
  const employeeId = useEmployeeId();
  const [purpose, setPurpose] = useState<CoePurpose | null>(null);
  const [details, setDetails] = useState('');
  const [addressee, setAddressee] = useState('');
  const [withPay, setWithPay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!purpose) {
      setError('Choose what the certificate is for.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestCoe({employeeId, purpose, purposeDetails: details, includeCompensation: withPay, addressee});
      invalidate(KEYS.coe, KEYS.home);
      toast('Request sent. HR issues it within three days.');
      nav.goBack();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Screen title="Request a certificate" back keyboard footer={<Button title="Request a certificate" onPress={submit} busy={busy} testID="coe-submit" />}>
      <Txt color="muted">A certificate of employment states your position and dates of employment. HR issues it within three days of your request, as DOLE Labor Advisory 06-20 requires.</Txt>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <SelectField label="What is it for?" value={purpose} onChange={setPurpose} options={COE_PURPOSES.map(p => ({value: p, label: COE_PURPOSE[p]}))} />
      <Field label="Details (optional)" hint="For example: housing loan at a bank" value={details} onChangeText={setDetails} maxLength={300} />
      <Field label="Addressed to (optional)" hint="Who will receive it, for example the bank. HR sees it with your request." value={addressee} onChangeText={setAddressee} maxLength={200} />
      <View style={[styles.switchRow, {borderColor: colors.line}]}>
        <View style={styles.flex}>
          <Txt variant="bodyStrong">Include my pay</Txt>
          <Txt variant="small" color="muted">
            HR writes your pay on the certificate.
          </Txt>
        </View>
        <Switch
          value={withPay}
          onValueChange={setWithPay}
          accessibilityLabel="Include my pay on the certificate"
          trackColor={{true: colors.primary, false: colors.lineStrong}}
          thumbColor="#ffffff"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth},
  flex: {flex: 1},
});
