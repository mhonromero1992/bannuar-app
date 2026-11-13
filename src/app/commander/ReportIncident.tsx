import {useNavigation} from '@react-navigation/native';
import React, {useState} from 'react';
import {Button, DateField, Field, Notice, ResourceView, Screen, SelectField, Txt} from '../../components/ui';
import {errorText} from '../../lib/errors';
import {fullName, todayManila} from '../../lib/format';
import {loadPost} from '../../services/commander';
import {fileIncidentReport} from '../../services/discipline';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {toast} from '../../store/ui';

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const nowHHMM = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(11, 16);

/**
 * A commander reports an incident at their post, about a guard or not (file_incident_report checks the
 * post is theirs). HR reviews it on the portal's Discipline page and decides whether to open a case;
 * the guard is not told until HR issues a notice.
 */
export default function ReportIncident() {
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const post = useResource(KEYS.post, () => loadPost(employeeId));
  const [site, setSite] = useState<string | null>(null);
  const [guard, setGuard] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(todayManila());
  const [time, setTime] = useState(nowHHMM());
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const sites = post.data?.sites ?? [];
    const siteId = site ?? (sites.length === 1 ? sites[0].id : null);
    if (!siteId) {
      setError('Choose the post.');
      return;
    }
    if (!day || !HHMM.test(time.trim())) {
      setError('Give the date and the time, like 02:30 or 14:05.');
      return;
    }
    const [h, m] = time.trim().split(':');
    const occurredAt = new Date(`${day}T${h.padStart(2, '0')}:${m}:00+08:00`).toISOString();
    setBusy(true);
    setError(null);
    try {
      const r = await fileIncidentReport({siteId, guardId: guard, occurredAt, title, details});
      toast(`Report ${r.report_no} sent to HR.`);
      nav.goBack();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Screen title="Report an incident" back keyboard footer={<Button title="Send to HR" onPress={submit} busy={busy} testID="incident-send" />}>
      <ResourceView resource={post} isEmpty={d => d.sites.length === 0}>
        {data => {
          const siteId = site ?? (data.sites.length === 1 ? data.sites[0].id : null);
          const guards = data.guards.filter(g => g.id !== employeeId && (!siteId || g.site_id === siteId));
          return (
            <>
              <Txt color="muted">For a violation, an accident or anything HR should know. HR decides whether a case follows; the guard is told only then.</Txt>
              {error ? <Notice tone="bad">{error}</Notice> : null}
              {data.sites.length > 1 ? <SelectField label="Post" value={site} onChange={setSite} options={data.sites.map(s => ({value: s.id, label: s.name}))} /> : null}
              <SelectField label="Guard involved (optional)" value={guard} onChange={setGuard} options={guards.map(g => ({value: g.id, label: `${fullName(g)} · ${g.employee_no}`}))} />
              <DateField label="Date" value={day} onChange={setDay} />
              <Field label="Time" hint="24-hour, like 02:30" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} testID="incident-time" />
              <Field label="Title" hint="For example: asleep on post" value={title} onChangeText={setTitle} maxLength={200} testID="incident-title" />
              <Field label="What happened" hint="What you saw, when and where, and who else saw it" value={details} onChangeText={setDetails} multiline maxLength={5000} testID="incident-details" />
            </>
          );
        }}
      </ResourceView>
    </Screen>
  );
}
