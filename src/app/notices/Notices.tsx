import {useNavigation} from '@react-navigation/native';
import React, {useState} from 'react';
import {Badge, Button, Card, Empty, ResourceView, Row, Screen, Txt} from '../../components/ui';
import {CASE_DECISION, CASE_STATUS, label, tone} from '../../config/labels';
import {errorText} from '../../lib/errors';
import {fmtDate} from '../../lib/format';
import {activeCode} from '../../services/discipline';
import {openPrivateFile} from '../../services/files';
import {toast} from '../../store/ui';
import {loadNotices, noticeAction} from '../../services/discipline';
import {useSecureScreen} from '../../services/secureScreen';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';

export const ACTION_TEXT = {
  acknowledge: 'Open it and say you received it',
  explain: 'Write your explanation',
  hearing: 'A meeting is set',
  read_decision: 'Read the decision',
} as const;

/** Notices to explain and decisions HR issued to the guard. Not kept on the phone. */
export default function Notices() {
  useSecureScreen();
  const nav = useNavigation();
  const res = useResource(KEYS.notices, loadNotices, {persist: false});
  useRefreshOnFocus(res);
  const [opening, setOpening] = useState(false);
  const openCode = async () => {
    setOpening(true);
    try {
      const code = await activeCode();
      if (!code) {
        toast('HR has not put a Code of Discipline in the app yet. Ask HR for a copy.');
      } else {
        await openPrivateFile('employee-files', code.file_key, 'code-of-discipline.pdf');
      }
    } catch (e) {
      toast(errorText(e), 'bad');
    } finally {
      setOpening(false);
    }
  };
  return (
    <Screen title="Notices from HR" back refreshing={res.refreshing} onRefresh={res.refresh}>
      <ResourceView resource={res} isEmpty={d => d.length === 0} empty={<Empty title="No notices" body="A notice to explain from HR shows here, with the time you have to answer." />}>
        {notices => (
          <Card>
            {notices.map((n, i) => {
              const action = noticeAction(n);
              return (
                <Row
                  key={n.id}
                  title={n.rule ? `${n.rule.ref} ${n.rule.title}`.trim() : n.case_no}
                  detail={action ? ACTION_TEXT[action] : `${n.case_no} · ${fmtDate(n.nte_issued_at)}`}
                  right={
                    n.decision ? (
                      <Badge tone={tone(CASE_DECISION, n.decision)}>{label(CASE_DECISION, n.decision)}</Badge>
                    ) : (
                      <Badge tone={tone(CASE_STATUS, n.status)}>{label(CASE_STATUS, n.status)}</Badge>
                    )
                  }
                  unread={action !== null}
                  onPress={() => nav.navigate('NoticeDetail', {id: n.id})}
                  testID={`notice-${n.id}`}
                  last={i === notices.length - 1}
                />
              );
            })}
          </Card>
        )}
      </ResourceView>
      <Button title="Read the Code of Discipline" icon="file" variant="secondary" onPress={openCode} busy={opening} testID="read-code" />
      <Txt variant="small" color="muted">
        You have the right to explain in writing, to ask for a meeting, and to bring a representative. A notice is not a finding against you.
      </Txt>
    </Screen>
  );
}
