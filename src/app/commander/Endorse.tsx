import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React, {useState} from 'react';
import {Alert} from 'react-native';
import {Button, Card, Empty, Field, KeyValue, Loading, Notice, Screen, SelectField, Txt} from '../../components/ui';
import {errorText} from '../../lib/errors';
import {fmtDateRange, fmtDateTime, fmtNumber, fullName} from '../../lib/format';
import type {RootStackParamList} from '../../navigations/types';
import {decideLeave, loadPost, relieverCandidates} from '../../services/commander';
import {KEYS} from '../../store/keys';
import {invalidate, useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {toast} from '../../store/ui';

/**
 * Endorse a guard's leave to HR with a reliever, or decline it, through decide_leave_request. The
 * database checks that this commander supervises the guard (supervises()).
 */
export default function Endorse() {
  const {id} = useRoute<RouteProp<RootStackParamList, 'Endorse'>>().params;
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.post, () => loadPost(employeeId));
  const r = res.data?.pending.find(x => x.id === id);
  const [reliever, setReliever] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);

  if (!r) {
    return (
      <Screen title="Endorse leave" back>
        {res.status === 'loading' ? <Loading /> : <Empty title="Nothing to decide here" body="This request was already decided or is not at your post." />}
      </Screen>
    );
  }
  const candidates = relieverCandidates(res.data!, r, employeeId);

  const decide = async (approve: boolean) => {
    if (!approve && !note.trim()) {
      setError('Say why, so the guard knows. It goes with the decision.');
      return;
    }
    setBusy(approve ? 'yes' : 'no');
    setError(null);
    try {
      await decideLeave({requestId: r.id, approve, note, relieverId: approve ? reliever : null});
      invalidate(KEYS.post, KEYS.home);
      toast(approve ? 'Endorsed to HR.' : 'Leave not endorsed. The guard is told.');
      nav.goBack();
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  };

  return (
    <Screen title="Endorse leave" back keyboard>
      <Txt variant="display" accessibilityRole="header">
        {r.employee ? fullName(r.employee) : 'Guard'}
      </Txt>
      <Card>
        <KeyValue label="Leave" value={r.type?.name} />
        <KeyValue label="Dates" value={`${fmtDateRange(r.start_date, r.end_date)} (${fmtNumber(r.days)} ${Number(r.days) === 1 ? 'day' : 'days'})`} />
        {r.reason ? <KeyValue label="Reason" value={r.reason} /> : null}
        <KeyValue label="Filed" value={fmtDateTime(r.created_at)} />
      </Card>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <SelectField
        label="Reliever"
        hint="Who covers the post while they are away"
        value={reliever}
        onChange={setReliever}
        placeholder="Choose a guard"
        options={candidates.map(g => ({value: g.id, label: fullName(g), note: `${g.employee_no} · ${g.position}`}))}
      />
      <Field label="Note (needed to decline)" value={note} onChangeText={setNote} multiline maxLength={500} />
      <Button title="Endorse to HR" onPress={() => decide(true)} busy={busy === 'yes'} disabled={busy === 'no'} testID="endorse-yes" />
      <Button
        title="Do not endorse"
        variant="secondary"
        busy={busy === 'no'}
        disabled={busy === 'yes'}
        onPress={() =>
          Alert.alert('Decline this leave?', 'The guard is told, with your note.', [
            {text: 'Back', style: 'cancel'},
            {text: 'Decline', style: 'destructive', onPress: () => decide(false)},
          ])
        }
      />
    </Screen>
  );
}
