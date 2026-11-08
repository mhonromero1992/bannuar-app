import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React, {useState} from 'react';
import {Button, Field, Notice, Screen, SelectField, Txt} from '../../components/ui';
import {CONCERN_CATEGORY} from '../../config/labels';
import {errorText} from '../../lib/errors';
import type {RootStackParamList} from '../../navigations/types';
import {CONCERN_CATEGORIES, type ConcernCategory, reportConcern} from '../../services/payslips';
import {useSecureScreen} from '../../services/secureScreen';
import {KEYS} from '../../store/keys';
import {invalidate} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {toast} from '../../store/ui';

/** "My overtime is missing": goes to payroll, who answer in the app. */
export default function ReportConcern() {
  useSecureScreen();
  const payslipId = useRoute<RouteProp<RootStackParamList, 'ReportConcern'>>().params?.payslipId ?? null;
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const [category, setCategory] = useState<ConcernCategory | null>(null);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{category?: string; description?: string; form?: string}>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    if (!category) {
      next.category = 'Choose what the concern is about.';
    }
    if (!description.trim()) {
      next.description = 'Say what is wrong, for example the dates and hours missing.';
    }
    setErrors(next);
    if (next.category || next.description) {
      return;
    }
    setBusy(true);
    try {
      await reportConcern({employeeId, payslipId, category: category!, description});
      invalidate(KEYS.concerns, KEYS.home);
      toast('Sent to payroll. You will get their answer here.');
      nav.goBack();
    } catch (e) {
      setErrors({form: errorText(e)});
      setBusy(false);
    }
  };

  return (
    <Screen title="Report a concern" back keyboard footer={<Button title="Send to payroll" onPress={submit} busy={busy} testID="concern-submit" />}>
      <Txt color="muted">{payslipId ? 'About this payslip. Payroll reads it and answers in the app.' : 'Payroll reads it and answers in the app.'}</Txt>
      {errors.form ? <Notice tone="bad">{errors.form}</Notice> : null}
      <SelectField
        label="What is it about?"
        value={category}
        onChange={setCategory}
        options={CONCERN_CATEGORIES.map(c => ({value: c, label: CONCERN_CATEGORY[c]}))}
        error={errors.category}
      />
      <Field label="What is wrong?" value={description} onChangeText={setDescription} multiline maxLength={2000} error={errors.description} testID="concern-description" />
    </Screen>
  );
}
