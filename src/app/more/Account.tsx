import {useNavigation} from '@react-navigation/native';
import React, {useEffect, useState} from 'react';
import {Alert, Linking, StyleSheet, Switch, View} from 'react-native';
import {useTheme} from 'styled-components/native';
import {Button, Card, KeyValue, Notice, Row, Screen, SectionLabel, Txt} from '../../components/ui';
import {env} from '../../config/env';
import {isLockOn, lockSupported, turnLockOff, turnLockOn} from '../../services/appLock';
import {APP_VERSION} from '../../services/version';
import {useSession} from '../../store/session';

/** Password, app lock, the privacy notice, the app version and sign-out. */
export default function Account() {
  const nav = useNavigation();
  const {colors} = useTheme();
  const access = useSession(s => s.access);
  const signOut = useSession(s => s.signOut);
  const [lock, setLock] = useState(false);
  const [lockNote, setLockNote] = useState<string | null>(null);

  useEffect(() => {
    isLockOn().then(setLock);
  }, []);

  const toggleLock = async (on: boolean) => {
    setLockNote(null);
    if (on) {
      if (!(await lockSupported())) {
        setLockNote('Set a screen lock (PIN, pattern, fingerprint or face) on your phone first, then turn this on.');
        return;
      }
      const ok = await turnLockOn();
      setLock(ok);
      if (!ok) {
        setLockNote('The app lock was not turned on. Try again.');
      }
    } else {
      await turnLockOff();
      setLock(false);
    }
  };

  return (
    <Screen title="Account" back>
      <Card>
        <KeyValue label="Signed in as" value={access?.employee?.full_name} />
        <KeyValue label="Employee number" value={access?.employee?.employee_no} mono />
      </Card>
      <Card>
        <Row icon="lock" title="Change my password" onPress={() => nav.navigate('ChangePassword')} last />
      </Card>
      <Card>
        <SectionLabel>App lock</SectionLabel>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Txt variant="bodyStrong">Lock the app</Txt>
            <Txt variant="small" color="muted">
              Ask for your fingerprint, face or phone PIN when the app opens. Useful if others use this phone.
            </Txt>
          </View>
          <Switch value={lock} onValueChange={toggleLock} accessibilityLabel="Lock the app" trackColor={{true: colors.primary, false: colors.lineStrong}} thumbColor="#ffffff" />
        </View>
        {lockNote ? <Notice tone="warn">{lockNote}</Notice> : null}
      </Card>
      <Card>
        <Row icon="shield" title="Privacy notice" detail="How Bannuar uses your details (Data Privacy Act)" onPress={() => Linking.openURL(`${env.websiteUrl}/privacy`)} last />
      </Card>
      <Txt variant="small" color="muted">{`Bannuar app ${APP_VERSION}`}</Txt>
      <Button
        title="Sign out"
        variant="secondary"
        icon="logout"
        onPress={() =>
          Alert.alert('Sign out?', 'Your payslips and records saved on this phone are deleted. You need your employee number and password to sign in again.', [
            {text: 'Stay', style: 'cancel'},
            {text: 'Sign out', style: 'destructive', onPress: () => signOut()},
          ])
        }
        testID="sign-out"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56},
  flex: {flex: 1},
});
