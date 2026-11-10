import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Image, StatusBar, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from 'styled-components/native';
import {Badge, Button, Card, Empty, HeaderButton, HiddenAmount, Notice, ResourceView, Row, Screen, SectionLabel, Txt} from '../../components/ui';
import {EMPLOYEE_STATUS, label, tone} from '../../config/labels';
import {fmtDate, fmtRelativeDay, fullName, greeting} from '../../lib/format';
import {type HomeData, loadHome} from '../../services/home';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId, useRoles, useSession} from '../../store/session';
import {useUi} from '../../store/ui';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';
import {AttendanceCard} from '../attendance/AttendanceCard';

const BADGE = require('../../assets/brand/badge.png');

export default function Home() {
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const roles = useRoles();
  const access = useSession(s => s.access);
  const unread = useUi(s => s.unread);
  const home = useResource(KEYS.home, () => loadHome(employeeId, roles));
  useRefreshOnFocus(home);

  return (
    <Screen
      header={<Band name={home.data ? fullName(home.data.me) : access?.employee?.full_name ?? ''} number={access?.employee?.employee_no ?? ''} position={access?.employee?.position ?? ''} unread={unread} onBell={() => nav.navigate('Notifications')} />}
      refreshing={home.refreshing}
      onRefresh={home.refresh}
      testID="home">
      <AttendanceCard />
      <ResourceView resource={home}>{data => <HomeBody data={data} />}</ResourceView>
    </Screen>
  );
}

function Band({name, number, position, unread, onBell}: {name: string; number: string; position: string; unread: number; onBell: () => void}) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.band, {backgroundColor: colors.band, paddingTop: insets.top + 8}]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.band} />
      <View style={styles.bandRow}>
        <Image source={BADGE} style={styles.badge} accessibilityIgnoresInvertColors accessibilityLabel="Bannuar badge" />
        <View style={styles.flex}>
          <Txt variant="small" color="onBandMuted">
            {greeting()}
          </Txt>
          <Txt variant="title" color="onBand" accessibilityRole="header">
            {name}
          </Txt>
          <Txt variant="small" color="onBandMuted">
            {[number, position].filter(Boolean).join(' · ')}
          </Txt>
        </View>
        <HeaderButton icon="bell" label="Notifications" count={unread} onPress={onBell} onBand />
      </View>
    </View>
  );
}

function HomeBody({data}: {data: HomeData}) {
  const nav = useNavigation();
  const {me} = data;
  return (
    <>
      <Card onPress={() => nav.navigate('Records')} accessibilityLabel="Your post. Opens your records.">
        <SectionLabel>Your post</SectionLabel>
        {me.status === 'floating' ? (
          <>
            <Txt variant="heading">{me.floating_since ? `Floating since ${fmtDate(me.floating_since)}` : 'Floating'}</Txt>
            <Txt color="muted">You get a notification when you are assigned to a post.</Txt>
          </>
        ) : me.site ? (
          <>
            <Txt variant="heading">{me.site.name}</Txt>
            {me.site.address || me.site.city ? <Txt color="muted">{[me.site.address, me.site.city, me.site.province].filter(Boolean).join(', ')}</Txt> : null}
          </>
        ) : (
          <Txt color="muted">No post on file yet.</Txt>
        )}
        {me.status !== 'active' && me.status !== 'floating' ? <Badge tone={tone(EMPLOYEE_STATUS, me.status)}>{label(EMPLOYEE_STATUS, me.status)}</Badge> : null}
      </Card>

      {data.toEndorse !== null ? (
        <Card onPress={() => nav.navigate('MyPost')} accessibilityLabel={`My post. ${data.toEndorse} leave requests to endorse.`}>
          <SectionLabel>My post</SectionLabel>
          <Txt variant="heading">{data.toEndorse === 0 ? 'No leave to endorse' : data.toEndorse === 1 ? '1 leave request to endorse' : `${data.toEndorse} leave requests to endorse`}</Txt>
          <Txt color="muted">Your guards, and the leave that waits for you</Txt>
        </Card>
      ) : null}

      {data.toAcknowledge.length ? (
        <View style={styles.section}>
          <SectionLabel>To acknowledge</SectionLabel>
          <Card>
            {data.toAcknowledge.slice(0, 3).map((a, i, list) => (
              <Row key={a.id} title={a.title} detail={a.published_at ? fmtDate(a.published_at) : null} right={a.priority === 'urgent' ? <Badge tone="bad">Urgent</Badge> : null} onPress={() => nav.navigate('AnnouncementDetail', {id: a.id})} last={i === list.length - 1} unread />
            ))}
            {data.toAcknowledge.length > 3 ? <Button title={`See all ${data.toAcknowledge.length}`} variant="ghost" onPress={() => nav.navigate('Announcements')} /> : null}
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionLabel>Latest payslip</SectionLabel>
        {data.latestPayslip ? (
          <Card>
            <Txt variant="heading">{data.latestPayslip.label}</Txt>
            <Txt color="muted">{`Pay date ${fmtDate(data.latestPayslip.payDate)}`}</Txt>
            <HiddenAmount label="Net pay" amount={data.latestPayslip.netPay} big />
            <Button title="Open the payslip" variant="secondary" onPress={() => nav.navigate('PayslipDetail', {id: data.latestPayslip!.id})} />
          </Card>
        ) : (
          <Card>
            <Txt color="muted">Your payslip shows here once payroll publishes the cutoff.</Txt>
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionLabel>Open requests</SectionLabel>
        <Card>
          {data.openRequests.length ? (
            data.openRequests.map((r, i, list) => (
              <Row
                key={r.key}
                title={r.title}
                detail={r.detail}
                right={<Badge tone={r.tone}>{r.status}</Badge>}
                last={i === list.length - 1}
                onPress={() =>
                  r.kind === 'leave'
                    ? nav.navigate('LeaveDetail', {id: r.id})
                    : r.kind === 'coe'
                    ? nav.navigate('Coe', {focusRequestId: r.id})
                    : r.kind === 'change'
                    ? nav.navigate('ChangeDetails')
                    : nav.navigate('Concerns', {focusId: r.id})
                }
              />
            ))
          ) : (
            <Txt color="muted">Nothing waiting. Your leave, certificate and other requests show here until they are decided.</Txt>
          )}
        </Card>
        <View style={styles.actions}>
          <Button title="File leave" onPress={() => nav.navigate('FileLeave')} />
          <Button title="Request a certificate" variant="secondary" onPress={() => nav.navigate('RequestCoe')} />
        </View>
      </View>

      {data.documentAlerts.length ? (
        <View style={styles.section}>
          <SectionLabel>Documents to renew</SectionLabel>
          {data.documentAlerts.map(d => (
            <Notice key={d.id} tone={d.state === 'expired' ? 'bad' : 'warn'} title={d.type_name}>
              {d.state === 'expired' ? `Expired ${fmtDate(d.expires_on)}. Renew it and upload the new copy.` : `Expires ${fmtRelativeDay(d.expires_on)}, on ${fmtDate(d.expires_on)}.`}
            </Notice>
          ))}
          <Button title="Upload a renewal" variant="secondary" icon="upload" onPress={() => nav.navigate('Documents')} />
        </View>
      ) : null}

      {!data.toAcknowledge.length && !data.openRequests.length && !data.documentAlerts.length ? (
        <Empty title="All caught up" body="No announcements to acknowledge and no documents to renew." />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  band: {paddingHorizontal: 16, paddingBottom: 18},
  bandRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  badge: {width: 52, height: 52},
  flex: {flex: 1},
  section: {gap: 8},
  actions: {gap: 8},
});
