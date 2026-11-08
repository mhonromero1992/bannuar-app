import {useNavigation} from '@react-navigation/native';
import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Badge, Button, Card, Field, Loading, Notice, Screen, SectionLabel, SelectField, Txt} from '../../components/ui';
import {CIVIL_STATUS, label, options, REQUEST_STATUS, tone} from '../../config/labels';
import {errorText} from '../../lib/errors';
import {fmtDate} from '../../lib/format';
import {CHANGE_FIELDS, type ChangeField, changedFields, changeProblem, currentValues, FIELD_LABEL, loadChanges, requestChange} from '../../services/changes';
import {loadMe} from '../../services/profile';
import {KEYS} from '../../store/keys';
import {invalidate, useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {toast} from '../../store/ui';

/** Contact details the guard may ask HR to change; HR applies or declines them in the portal. */
export default function ChangeDetails() {
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const me = useResource(KEYS.me, () => loadMe(employeeId));
  const history = useResource(KEYS.changes, () => loadChanges(employeeId));
  const [form, setForm] = useState<Partial<Record<ChangeField, string>> | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me.data && !form) {
      setForm(currentValues(me.data));
    }
  }, [me.data, form]);

  const submit = async () => {
    if (!me.data || !form) {
      return;
    }
    const changes = changedFields(currentValues(me.data), form);
    const problem = changeProblem(changes);
    setError(problem);
    if (problem) {
      return;
    }
    setBusy(true);
    try {
      await requestChange({employeeId, changes, reason});
      invalidate(KEYS.changes, KEYS.home);
      toast('Sent to HR. Your record changes once HR applies it.');
      nav.goBack();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  if (!form) {
    return (
      <Screen title="Change my details" back>
        {me.status === 'error' ? <Notice tone="bad">{me.error ?? 'Your details did not load.'}</Notice> : <Loading />}
      </Screen>
    );
  }
  const pending = (history.data ?? []).some(h => h.status === 'pending');
  const set = (k: ChangeField) => (v: string) => setForm(f => ({...f, [k]: v}));
  return (
    <Screen title="Change my details" back keyboard footer={<Button title="Send to HR" onPress={submit} busy={busy} testID="change-submit" />}>
      <Txt color="muted">Change what is new, then send it. HR checks it and updates your 201 file. To change anything else, such as your name or birthdate, bring the document to the HR office.</Txt>
      {pending ? <Notice tone="warn">You already have a request waiting for HR. This one is sent as a separate request.</Notice> : null}
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {CHANGE_FIELDS.map(k =>
        k === 'civil_status' ? (
          <SelectField key={k} label={FIELD_LABEL[k]} value={(form[k] || null) as string | null} onChange={set(k)} options={options(CIVIL_STATUS)} />
        ) : (
          <Field
            key={k}
            label={FIELD_LABEL[k]}
            value={form[k] ?? ''}
            onChangeText={set(k)}
            keyboardType={k === 'mobile_no' || k === 'emergency_contact_phone' ? 'phone-pad' : k === 'email' ? 'email-address' : 'default'}
            autoCapitalize={k === 'email' ? 'none' : 'sentences'}
            multiline={k.endsWith('address')}
            maxLength={300}
          />
        ),
      )}
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} maxLength={500} />
      {history.data?.length ? (
        <View style={styles.section}>
          <SectionLabel>Earlier requests</SectionLabel>
          {history.data.map(h => (
            <Card key={h.id}>
              <Badge tone={tone(REQUEST_STATUS, h.status)}>{label(REQUEST_STATUS, h.status)}</Badge>
              <Txt>{Object.keys(h.changes).map(k => FIELD_LABEL[k as ChangeField] ?? k).join(', ')}</Txt>
              <Txt variant="small" color="muted">{`Sent ${fmtDate(h.created_at)}`}</Txt>
              {h.decision_note ? <Txt>{`HR: ${h.decision_note}`}</Txt> : null}
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({section: {gap: 8}});
