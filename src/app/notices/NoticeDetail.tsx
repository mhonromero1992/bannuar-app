import {type RouteProp, useRoute} from '@react-navigation/native';
import React, {useState} from 'react';
import {Alert, StyleSheet, Switch, View} from 'react-native';
import {useTheme} from 'styled-components/native';
import {Badge, Button, Card, Empty, Field, KeyValue, Loading, Notice as NoticeBox, Screen, SectionLabel, Txt} from '../../components/ui';
import {CASE_DECISION, CASE_STATUS, label, tone} from '../../config/labels';
import {errorText} from '../../lib/errors';
import {fmtDate, fmtDateTime} from '../../lib/format';
import type {RootStackParamList} from '../../navigations/types';
import {acknowledgeNotice, loadNotices, type Notice, noticeAction, submitExplanation} from '../../services/discipline';
import {useSecureScreen} from '../../services/secureScreen';
import {KEYS} from '../../store/keys';
import {invalidate, useResource} from '../../store/resources';
import {toast} from '../../store/ui';

const DECISION_WORDS: Record<string, string> = {
  no_violation: 'HR found no violation. Nothing goes on your record for this.',
  warning: 'A written warning.',
  reprimand: 'A reprimand.',
  suspension: 'A suspension without pay.',
  dismissal: 'Dismissal from employment.',
};

/**
 * One notice: what HR says happened and the rule, the deadline, the guard's explanation (with a meeting
 * if they want one), the meeting, and the decision. Screenshots are blocked on this screen.
 */
export default function NoticeDetail() {
  useSecureScreen();
  const {id} = useRoute<RouteProp<RootStackParamList, 'NoticeDetail'>>().params;
  const res = useResource(KEYS.notices, loadNotices, {persist: false});
  const n = res.data?.find(x => x.id === id);
  if (!n) {
    return (
      <Screen title="Notice" back>
        {res.status === 'loading' ? <Loading /> : <Empty title="Notice not found" body="It may have been withdrawn. Pull down on the list to refresh." />}
      </Screen>
    );
  }
  return <Detail n={n} refresh={res.refresh} />;
}

function Detail({n, refresh}: {n: Notice; refresh: () => Promise<void>}) {
  const {colors} = useTheme();
  const action = noticeAction(n);
  const [text, setText] = useState('');
  const [hearing, setHearing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const late = Date.parse(n.explain_by) < Date.now();

  const ack = async (which: 'nte' | 'decision') => {
    setBusy(which);
    setError(null);
    try {
      await acknowledgeNotice(n.id, which);
      await refresh();
      invalidate(KEYS.home);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const send = () => {
    if (text.trim().length < 10) {
      setError('Write your explanation: what happened, in your own words.');
      return;
    }
    Alert.alert('Send your explanation?', 'HR receives it as written. You cannot change it after sending.', [
      {text: 'Not yet', style: 'cancel'},
      {
        text: 'Send',
        onPress: async () => {
          setBusy('explain');
          setError(null);
          try {
            await submitExplanation(n.id, text, hearing);
            toast('Explanation sent to HR.');
            await refresh();
            invalidate(KEYS.home);
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <Screen title={n.case_no} back keyboard>
      <Badge tone={tone(CASE_STATUS, n.status)}>{label(CASE_STATUS, n.status)}</Badge>
      {error ? <NoticeBox tone="bad">{error}</NoticeBox> : null}
      {n.preventive_from ? (
        <NoticeBox tone="warn" title="Preventive suspension">
          {`From ${fmtDate(n.preventive_from)} to ${fmtDate(n.preventive_to)}. ${n.preventive_reason ?? ''} It is not a penalty, and it lasts at most 30 days.`}
        </NoticeBox>
      ) : null}

      <Card>
        <SectionLabel>Notice to explain</SectionLabel>
        {n.rule ? <KeyValue label="Rule" value={`${n.rule.ref} ${n.rule.title}`.trim()} /> : null}
        <Txt selectable>{n.nte_text}</Txt>
        <KeyValue label="Issued" value={fmtDateTime(n.nte_issued_at)} />
        <KeyValue label="Answer by" value={fmtDateTime(n.explain_by)} />
        {action === 'acknowledge' ? (
          <Button title="I received this notice" onPress={() => ack('nte')} busy={busy === 'nte'} testID="notice-ack" />
        ) : n.nte_received_at ? (
          <Txt variant="small" color="muted">{`You said you received it ${fmtDateTime(n.nte_received_at)}.`}</Txt>
        ) : null}
      </Card>

      {n.status === 'withdrawn' ? (
        <NoticeBox tone="info" title="Withdrawn">
          {n.withdrawn_reason ?? 'HR withdrew this notice.'}
        </NoticeBox>
      ) : n.explanation ? (
        <Card>
          <SectionLabel>Your explanation</SectionLabel>
          <Txt selectable>{n.explanation}</Txt>
          <Txt variant="small" color="muted">{`Received by HR ${fmtDateTime(n.explained_at)}${n.wants_hearing ? '. You asked for a meeting.' : '.'}`}</Txt>
        </Card>
      ) : n.status === 'nte_issued' ? (
        <Card>
          <SectionLabel>Your explanation</SectionLabel>
          <Txt color="muted">
            {late
              ? 'The time to answer has passed, but HR still reads your explanation until it decides. Send it now.'
              : `Explain in writing until ${fmtDateTime(n.explain_by)}. You may also hand it to HR on paper.`}
          </Txt>
          <Field label="What happened, in your words" value={text} onChangeText={setText} multiline maxLength={10000} testID="notice-explanation" />
          <View style={[styles.switchRow, {borderColor: colors.line}]}>
            <View style={styles.flex}>
              <Txt variant="bodyStrong">I want a meeting with HR</Txt>
              <Txt variant="small" color="muted">
                To explain in person. You may bring a representative.
              </Txt>
            </View>
            <Switch
              value={hearing}
              onValueChange={setHearing}
              accessibilityLabel="I want a meeting with HR"
              trackColor={{true: colors.primary, false: colors.lineStrong}}
              thumbColor="#ffffff"
              testID="notice-hearing"
            />
          </View>
          <Button title="Send my explanation" onPress={send} busy={busy === 'explain'} testID="notice-send" />
        </Card>
      ) : null}

      {n.hearing_at ? (
        <Card>
          <SectionLabel>Meeting</SectionLabel>
          <KeyValue label="When" value={fmtDateTime(n.hearing_at)} />
          <KeyValue label="Where" value={n.hearing_place} />
          <Txt variant="small" color="muted">{n.hearing_held_at ? 'The meeting took place.' : 'You may bring a representative. If you cannot come, tell HR before then.'}</Txt>
        </Card>
      ) : null}

      {n.decision ? (
        <Card>
          <SectionLabel>Decision</SectionLabel>
          <Badge tone={tone(CASE_DECISION, n.decision)}>{label(CASE_DECISION, n.decision)}</Badge>
          <Txt>{n.decision === 'suspension' && n.suspension_days ? `A suspension without pay of ${n.suspension_days} ${n.suspension_days === 1 ? 'day' : 'days'}, from ${fmtDate(n.suspension_from)}.` : DECISION_WORDS[n.decision]}</Txt>
          {n.decision_text ? <Txt selectable>{n.decision_text}</Txt> : null}
          <KeyValue label="Decided" value={fmtDateTime(n.decided_at)} />
          {action === 'read_decision' ? (
            <Button title="I received the decision" onPress={() => ack('decision')} busy={busy === 'decision'} testID="decision-ack" />
          ) : n.decision_received_at ? (
            <Txt variant="small" color="muted">{`You said you received it ${fmtDateTime(n.decision_received_at)}.`}</Txt>
          ) : null}
          <Txt variant="small" color="muted">If you disagree, talk to HR. You may also seek advice from DOLE or a lawyer.</Txt>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth},
  flex: {flex: 1},
});
