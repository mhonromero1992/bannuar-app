import {useNavigation} from '@react-navigation/native';
import React, {useState} from 'react';
import {Button, Notice, PasswordField, Screen} from '../../components/ui';
import {changePassword, passwordProblem} from '../../services/auth';
import {useSession} from '../../store/session';
import {toast} from '../../store/ui';

/** A new password, after the current one is checked again (someone holding an unlocked phone cannot). */
export default function ChangePassword() {
  const nav = useNavigation();
  const employeeNo = useSession(s => s.access?.employee?.employee_no ?? '');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problem = !current ? 'Enter your current password.' : passwordProblem(password, again);
    setError(problem);
    if (problem) {
      return;
    }
    setBusy(true);
    try {
      await changePassword(password, {current, employeeNo});
      toast('Password changed.');
      nav.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not change the password.');
      setBusy(false);
    }
  };

  return (
    <Screen title="Change my password" back keyboard footer={<Button title="Save the new password" onPress={submit} busy={busy} />}>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <PasswordField label="Current password" value={current} onChangeText={setCurrent} autoComplete="current-password" />
      <PasswordField label="New password" hint="At least 8 characters, with letters and numbers" value={password} onChangeText={setPassword} autoComplete="new-password" />
      <PasswordField label="New password again" value={again} onChangeText={setAgain} autoComplete="new-password" />
    </Screen>
  );
}
