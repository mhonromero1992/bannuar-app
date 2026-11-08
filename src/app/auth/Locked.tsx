import React, {useCallback, useEffect, useState} from 'react';
import {Alert} from 'react-native';
import {Button, Notice, Txt} from '../../components/ui';
import {unlock} from '../../services/appLock';
import {useSession} from '../../store/session';
import {AuthFrame} from './AuthFrame';

/** The app lock: the phone's own fingerprint, face or screen-lock PIN. */
export default function Locked() {
  const unlocked = useSession(s => s.unlocked);
  const signOut = useSession(s => s.signOut);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const tryUnlock = useCallback(async () => {
    setBusy(true);
    const ok = await unlock();
    setBusy(false);
    if (ok) {
      unlocked();
    } else {
      setFailed(true);
    }
  }, [unlocked]);

  useEffect(() => {
    tryUnlock();
  }, [tryUnlock]);

  return (
    <AuthFrame title="Bannuar is locked">
      <Txt color="muted">Use your fingerprint, face or your phone's screen lock to open the app.</Txt>
      {failed ? <Notice tone="warn">Not unlocked. Try again.</Notice> : null}
      <Button title="Unlock" icon="lock" onPress={tryUnlock} busy={busy} testID="unlock" />
      <Button
        title="Sign out instead"
        variant="ghost"
        onPress={() =>
          Alert.alert('Sign out?', 'You will need your employee number and password to sign in again.', [
            {text: 'Stay', style: 'cancel'},
            {text: 'Sign out', style: 'destructive', onPress: () => signOut()},
          ])
        }
      />
    </AuthFrame>
  );
}
