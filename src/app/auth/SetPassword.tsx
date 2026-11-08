import React, {useState} from 'react';
import {Alert} from 'react-native';
import {Button, Notice, PasswordField} from '../../components/ui';
import {changePassword, passwordProblem} from '../../services/auth';
import {useSession} from '../../store/session';
import {AuthFrame} from './AuthFrame';

/**
 * HR's temporary password (must_change_password): nothing else opens until the guard sets their own.
 * auth.updateUser({password}), then mark_password_changed().
 */
export default function SetPassword() {
  const passwordChanged = useSession(s => s.passwordChanged);
  const signOut = useSession(s => s.signOut);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problem = passwordProblem(password, again);
    setError(problem);
    if (problem) {
      return;
    }
    setBusy(true);
    try {
      await changePassword(password);
      await passwordChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not save the new password.');
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Set a new password" intro="HR gave you a temporary password. Choose your own to continue; only you will know it.">
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <PasswordField label="New password" hint="At least 8 characters, with letters and numbers" value={password} onChangeText={setPassword} autoComplete="new-password" testID="set-password" />
      <PasswordField label="New password again" value={again} onChangeText={setAgain} autoComplete="new-password" onSubmitEditing={submit} testID="set-password-again" />
      <Button title="Save my new password" onPress={submit} busy={busy} testID="set-password-submit" />
      <Button
        title="Sign out"
        variant="ghost"
        onPress={() =>
          Alert.alert('Sign out?', 'You can sign in again with the temporary password.', [
            {text: 'Stay', style: 'cancel'},
            {text: 'Sign out', style: 'destructive', onPress: () => signOut()},
          ])
        }
      />
    </AuthFrame>
  );
}
