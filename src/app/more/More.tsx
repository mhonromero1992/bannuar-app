import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Card, Row, Screen} from '../../components/ui';
import {useIsCommander} from '../../store/useIsCommander';
import {useUi} from '../../store/ui';

/** Everything that is not a tab. */
export default function More() {
  const nav = useNavigation();
  const commander = useIsCommander();
  const unread = useUi(s => s.unread);
  return (
    <Screen title="More">
      {commander ? (
        <Card>
          <Row icon="post" title="My post" detail="Your guards and their leave to endorse" onPress={() => nav.navigate('MyPost')} last />
        </Card>
      ) : null}
      <Card>
        <Row icon="clock" title="Attendance" detail="Your time in and time out" onPress={() => nav.navigate('Attendance')} />
        <Row icon="megaphone" title="Announcements" onPress={() => nav.navigate('Announcements')} />
        <Row icon="bell" title="Notifications" detail={unread ? `${unread} unread` : null} onPress={() => nav.navigate('Notifications')} />
        <Row icon="certificate" title="Certificates of employment" onPress={() => nav.navigate('Coe')} />
        <Row icon="pay" title="Payroll concerns" onPress={() => nav.navigate('Concerns')} last />
      </Card>
      <Card>
        <Row icon="user" title="My records" detail="Your 201 file, read-only" onPress={() => nav.navigate('Records')} />
        <Row icon="file" title="Licenses and documents" onPress={() => nav.navigate('Documents')} />
        <Row icon="shield" title="Government numbers" onPress={() => nav.navigate('GovernmentIds')} />
        <Row icon="edit" title="Change my details" onPress={() => nav.navigate('ChangeDetails')} last />
      </Card>
      <Card>
        <Row icon="lock" title="Account" detail="Password, app lock, privacy, sign out" onPress={() => nav.navigate('Account')} last />
      </Card>
    </Screen>
  );
}
