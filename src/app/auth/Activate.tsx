import React, {useState} from 'react';
import {Button, DateField, Field, Notice, PasswordField} from '../../components/ui';
import {isPhMobile, todayManila} from '../../lib/format';
import {ActivationError, passwordProblem} from '../../services/auth';
import {useSession} from '../../store/session';
import {AuthFrame} from './AuthFrame';

type Errors = Partial<Record<'no' | 'birthdate' | 'mobile' | 'password' | 'form', string>>;

/**
 * First time: employee number, birthdate and the mobile number on file, then a password of the guard's
 * own. The activate-employee Edge Function checks the three facts against the 201 file and makes the
 * login; any mismatch gets the same message, so nobody learns which fact was wrong.
 */
export default function Activate() {
  const activateAndSignIn = useSession(s => s.activateAndSignIn);
  const [employeeNo, setEmployeeNo] = useState('');
  const [birthdate, setBirthdate] = useState<string | null>(null);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: Errors = {};
    if (!employeeNo.trim()) {
      next.no = 'Enter your employee number.';
    }
    if (!birthdate) {
      next.birthdate = 'Enter your birthdate: day, month and year.';
    } else if (birthdate >= todayManila() || birthdate < '1930-01-01') {
      next.birthdate = 'Check the year of your birthdate.';
    }
    if (!isPhMobile(mobile)) {
      next.mobile = 'Enter a mobile number like 0917 123 4567.';
    }
    const pw = passwordProblem(password, again);
    if (pw) {
      next.password = pw;
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    try {
      await activateAndSignIn({employeeNo, birthdate: birthdate!, mobile, password});
    } catch (e) {
      setErrors({form: e instanceof ActivationError || e instanceof Error ? e.message : 'We could not activate your account.'});
      setBusy(false);
    }
  };

  return (
    <AuthFrame title="Activate your account" intro="Use the details in your 201 file at Bannuar. You do this once; after that you sign in with your employee number and password." back>
      {errors.form ? (
        <Notice tone="bad" title="Not activated">
          {errors.form}
        </Notice>
      ) : null}
      <Field label="Employee number" value={employeeNo} onChangeText={setEmployeeNo} autoCapitalize="characters" autoCorrect={false} error={errors.no} testID="activate-employee-no" />
      <DateField label="Birthdate" value={birthdate} onChange={setBirthdate} error={errors.birthdate} />
      <Field
        label="Mobile number"
        hint="The number HR has on file, like 0917 123 4567"
        value={mobile}
        onChangeText={setMobile}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        error={errors.mobile}
        testID="activate-mobile"
      />
      <PasswordField label="New password" hint="At least 8 characters, with letters and numbers" value={password} onChangeText={setPassword} autoComplete="new-password" error={errors.password} testID="activate-password" />
      <PasswordField label="New password again" value={again} onChangeText={setAgain} autoComplete="new-password" testID="activate-password-again" />
      <Button title="Activate" onPress={submit} busy={busy} testID="activate-submit" />
    </AuthFrame>
  );
}
