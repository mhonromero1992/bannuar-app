import {useNavigation} from '@react-navigation/native';
import React, {useMemo, useState} from 'react';
import {Button, Card, DateField, Field, Loading, Notice, Screen, SelectField, Txt} from '../../components/ui';
import {errorText} from '../../lib/errors';
import {fmtNumber} from '../../lib/format';
import {uploadMyFile, type PickedFile} from '../../services/files';
import {daysLeft, fileLeave, leaveDays, leaveFormProblem, leaveTypeNote, loadLeave, typesFor} from '../../services/leave';
import {loadMe} from '../../services/profile';
import {KEYS} from '../../store/keys';
import {invalidate, useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {toast} from '../../store/ui';
import {FilePicker} from '../shared/FilePicker';

/**
 * Files leave. The database counts the days, checks credits, overlaps and who may take which leave,
 * and sends it to the detachment commander (or HR when the post has none); its refusals are shown as
 * they are written.
 */
export default function FileLeave() {
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const leave = useResource(KEYS.leave, () => loadLeave(employeeId));
  const me = useResource(KEYS.me, () => loadMe(employeeId));
  const [typeId, setTypeId] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const types = useMemo(() => typesFor(leave.data?.types ?? [], me.data ?? null), [leave.data, me.data]);
  const type = types.find(t => t.id === typeId) ?? null;
  const balance = leave.data?.balances.find(b => b.leave_type_id === typeId);
  const left = balance ? daysLeft(balance) : null;
  const days = start && end && end >= start ? leaveDays(start, end) : null;

  const submit = async () => {
    const problem = leaveFormProblem({type, start, end, hasAttachment: Boolean(file)});
    setError(problem);
    if (problem) {
      return;
    }
    setBusy(true);
    try {
      const attachmentPath = file ? (await uploadMyFile('leave', file)).key : null;
      await fileLeave({employeeId, leaveTypeId: type!.id, startDate: start!, endDate: end!, reason, attachmentPath});
      invalidate(KEYS.leave, KEYS.home);
      toast('Leave filed. It goes to your commander, then HR.');
      nav.goBack();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  if (!leave.data) {
    return (
      <Screen title="File leave" back>
        {leave.status === 'error' ? <Notice tone="bad">{leave.error ?? 'Leave types did not load.'}</Notice> : <Loading />}
      </Screen>
    );
  }
  return (
    <Screen title="File leave" back keyboard footer={<Button title="File leave" onPress={submit} busy={busy} testID="file-leave-submit" />}>
      {leave.offline ? <Notice tone="warn">You are offline. Leave can be filed once the phone is connected.</Notice> : null}
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <SelectField
        label="Kind of leave"
        value={typeId}
        onChange={setTypeId}
        options={types.map(t => ({value: t.id, label: t.name, note: leaveTypeNote(t, me.data ?? null)}))}
      />
      {type ? (
        <Card>
          {type.description ? <Txt>{type.description}</Txt> : null}
          {left !== null ? <Txt variant="bodyStrong">{`${fmtNumber(left)} ${left === 1 ? 'day' : 'days'} left this year`}</Txt> : null}
          {leaveTypeNote(type, me.data ?? null) ? <Txt color="muted">{leaveTypeNote(type, me.data ?? null)}</Txt> : null}
        </Card>
      ) : null}
      <DateField label="First day" value={start} onChange={setStart} />
      <DateField label="Last day" value={end} onChange={setEnd} />
      {days ? <Txt variant="bodyStrong">{`${days} ${days === 1 ? 'day' : 'days'}, first and last day included`}</Txt> : null}
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} multiline maxLength={1000} />
      {type?.requires_attachment ? (
        <FilePicker label="Supporting document" file={file} onChange={setFile} />
      ) : (
        <FilePicker label="Supporting document (optional)" file={file} onChange={setFile} />
      )}
    </Screen>
  );
}
