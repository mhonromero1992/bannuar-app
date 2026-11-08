import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React, {useEffect, useState} from 'react';
import {Alert} from 'react-native';
import {Badge, Button, Card, Empty, ErrorState, KeyValue, Loading, Notice, Screen, Txt} from '../../components/ui';
import {LEAVE_STATUS, label, tone} from '../../config/labels';
import {errorText} from '../../lib/errors';
import {fmtDateRange, fmtDateTime, fmtNumber, fullName} from '../../lib/format';
import type {RootStackParamList} from '../../navigations/types';
import {isCommander} from '../../services/commander';
import {openPrivateFile} from '../../services/files';
import {canCancel, cancelLeave, loadLeaveRequest} from '../../services/leave';
import {KEYS} from '../../store/keys';
import {invalidate} from '../../store/resources';
import {useEmployeeId, useRoles} from '../../store/session';
import {toast} from '../../store/ui';
import type {LeaveRequest} from '../../types/db';

/**
 * One leave request. The guard's own: its steps and Cancel. Someone else's: as their reliever, or as
 * their commander (who endorses it from here).
 */
export default function LeaveDetail() {
  const {id} = useRoute<RouteProp<RootStackParamList, 'LeaveDetail'>>().params;
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const roles = useRoles();
  const [r, setR] = useState<LeaveRequest | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    loadLeaveRequest(id)
      .then(setR)
      .catch(e => setError(errorText(e)));
  };
  useEffect(load, [id]);

  const cancel = () =>
    Alert.alert('Cancel this leave?', 'Your commander and HR will see it as cancelled.', [
      {text: 'Keep it', style: 'cancel'},
      {
        text: 'Cancel the leave',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await cancelLeave(id);
            invalidate(KEYS.leave, KEYS.home);
            toast('Leave cancelled.');
            load();
          } catch (e) {
            setError(errorText(e));
          }
          setBusy(false);
        },
      },
    ]);

  if (r === undefined) {
    return <Screen title="Leave request" back>{error ? <ErrorState message={error} onRetry={load} /> : <Loading />}</Screen>;
  }
  if (r === null) {
    return (
      <Screen title="Leave request" back>
        <Empty title="Leave request not found" />
      </Screen>
    );
  }
  const mine = r.employee_id === employeeId;
  const toEndorse = !mine && r.status === 'pending_supervisor' && isCommander(roles);
  return (
    <Screen title="Leave request" back>
      <Badge tone={tone(LEAVE_STATUS, r.status)}>{label(LEAVE_STATUS, r.status)}</Badge>
      <Txt variant="display" accessibilityRole="header">
        {r.type?.name ?? 'Leave'}
      </Txt>
      {!mine && r.employee ? <Txt variant="heading">{fullName(r.employee)}</Txt> : null}
      {!mine && r.reliever_employee_id === employeeId ? <Notice tone="info">You are the reliever for this leave.</Notice> : null}
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Card>
        <KeyValue label="Dates" value={fmtDateRange(r.start_date, r.end_date)} />
        <KeyValue label="Days" value={fmtNumber(r.days)} />
        {r.reason ? <KeyValue label="Reason" value={r.reason} /> : null}
        <KeyValue label="Filed" value={fmtDateTime(r.created_at)} />
      </Card>
      <Card>
        <Txt variant="heading">Steps</Txt>
        <Step done title="Filed" detail={fmtDateTime(r.created_at)} />
        {r.supervisor_decided_at || r.status === 'pending_supervisor' ? (
          <Step
            done={Boolean(r.supervisor_decided_at)}
            title={r.supervisor_decided_at ? (r.status === 'rejected' && !r.hr_decided_at ? 'Not endorsed by the commander' : 'Endorsed by the commander') : 'With the commander'}
            detail={[r.supervisor_decided_at ? fmtDateTime(r.supervisor_decided_at) : null, r.supervisor_note].filter(Boolean).join(' · ') || null}
          />
        ) : null}
        {r.status === 'cancelled' ? (
          <Step done title="Cancelled" detail={null} />
        ) : r.status === 'rejected' && !r.hr_decided_at ? null : (
          <Step
            done={Boolean(r.hr_decided_at)}
            title={r.hr_decided_at ? (r.status === 'approved' ? 'Approved by HR' : 'Not approved by HR') : 'HR decides'}
            detail={[r.hr_decided_at ? fmtDateTime(r.hr_decided_at) : null, r.hr_note].filter(Boolean).join(' · ') || null}
          />
        )}
        {r.reliever_employee_id ? <KeyValue label="Reliever" value={r.reliever ? fullName(r.reliever) : 'Assigned'} /> : null}
      </Card>
      {mine && r.attachment_path ? (
        <Button
          title="Open the attachment"
          variant="secondary"
          icon="file"
          onPress={() => openPrivateFile('employee-files', r.attachment_path!, r.attachment_path!.split('/').pop() ?? 'attachment').catch(e => setError(errorText(e)))}
        />
      ) : null}
      {toEndorse ? <Button title="Endorse or decline" onPress={() => nav.navigate('Endorse', {id: r.id})} /> : null}
      {mine && canCancel(r) ? <Button title="Cancel this leave" variant="secondary" onPress={cancel} busy={busy} /> : null}
    </Screen>
  );
}

function Step({done, title, detail}: {done: boolean; title: string; detail: string | null}) {
  return (
    <Notice tone={done ? 'ok' : 'neutral'} icon={done ? 'check' : 'info'} title={title}>
      {detail ?? undefined}
    </Notice>
  );
}
