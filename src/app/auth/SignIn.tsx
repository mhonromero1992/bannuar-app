import {useNavigation} from '@react-navigation/native';
import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Field, Notice, PasswordField} from '../../components/ui';
import {useSession} from '../../store/session';
import {AuthFrame} from './AuthFrame';

/** Employee number and password. The app turns the number into the login email (services/loginEmail.ts). */
export default function SignIn() {
  const nav = useNavigation();
  const signIn = useSession(s => s.signIn);
  const notice = useSession(s => s.notice);
  const clearNotice = useSession(s => s.clearNotice);
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{no?: string; pw?: string; form?: string}>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    if (!employeeNo.trim()) {
      next.no = 'Enter your employee number.';
    }
    if (!password) {
      next.pw = 'Enter your password.';
    }
    setErrors(next);
    if (next.no || next.pw) {
      return;
    }
    setBusy(true);
    clearNotice();
    try {
      await signIn(employeeNo, password);
    } catch (e) {
      setErrors({form: e instanceof Error ? e.message : 'We could not sign you in.'});
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Sign in">
      {notice ? <Notice tone="warn">{notice}</Notice> : null}
      {errors.form ? <Notice tone="bad">{errors.form}</Notice> : null}
      <Field
        label="Employee number"
        value={employeeNo}
        onChangeText={setEmployeeNo}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        error={errors.no}
        testID="signin-employee-no"
      />
      <PasswordField label="Password" value={password} onChangeText={setPassword} error={errors.pw} onSubmitEditing={submit} autoComplete="current-password" testID="signin-password" />
      <Button title="Sign in" onPress={submit} busy={busy} testID="signin-submit" />
      <View style={styles.links}>
        <Button title="First time? Activate your account" variant="ghost" onPress={() => nav.navigate('Activate')} />
        <Button title="Forgot your password?" variant="ghost" onPress={() => nav.navigate('ForgotPassword')} />
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({links: {gap: 4}});
