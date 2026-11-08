import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React, {useState} from 'react';
import {Button, DateField, Field, Loading, Notice, Screen, SelectField, Txt} from '../../components/ui';
import {errorText} from '../../lib/errors';
import type {PickedFile} from '../../services/files';
import {loadDocuments, uploadRenewal} from '../../services/records';
import type {RootStackParamList} from '../../navigations/types';
import {KEYS} from '../../store/keys';
import {invalidate, useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {toast} from '../../store/ui';
import {FilePicker} from '../shared/FilePicker';

/** A renewed license or clearance from the phone. HR checks it in the portal before it counts. */
export default function UploadDocument() {
  const preset = useRoute<RouteProp<RootStackParamList, 'UploadDocument'>>().params?.documentTypeId ?? null;
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.documents, () => loadDocuments(employeeId));
  const types = (res.data?.types ?? []).filter(t => t.employee_can_upload);
  const [typeId, setTypeId] = useState<string | null>(preset);
  const [number, setNumber] = useState('');
  const [issued, setIssued] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const type = types.find(t => t.id === typeId);

  const submit = async () => {
    const problem = !type
      ? 'Choose the document.'
      : !file
      ? 'Attach a photo or PDF of the document.'
      : type.has_expiry && !expires
      ? 'Enter the date it expires.'
      : issued && expires && expires < issued
      ? 'The expiry date is before the issue date.'
      : null;
    setError(problem);
    if (problem) {
      return;
    }
    setBusy(true);
    try {
      await uploadRenewal({employeeId, documentTypeId: type!.id, documentNo: number, issuedOn: issued, expiresOn: type!.has_expiry ? expires : null, file: file!});
      invalidate(KEYS.documents, KEYS.home);
      toast('Sent to HR. It shows as Verified once HR checks it.');
      nav.goBack();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  if (!res.data) {
    return (
      <Screen title="Upload a renewal" back>
        <Loading />
      </Screen>
    );
  }
  return (
    <Screen title="Upload a renewal" back keyboard footer={<Button title="Send to HR" onPress={submit} busy={busy} testID="upload-submit" />}>
      <Txt color="muted">Take a clear photo of the whole document, or attach the PDF. HR checks it against the original.</Txt>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <SelectField label="Document" value={typeId} onChange={setTypeId} options={types.map(t => ({value: t.id, label: t.name}))} />
      <Field label="Document number (optional)" value={number} onChangeText={setNumber} autoCapitalize="characters" maxLength={80} />
      <DateField label="Issued on (optional)" value={issued} onChange={setIssued} />
      {type?.has_expiry ? <DateField label="Expires on" value={expires} onChange={setExpires} /> : null}
      <FilePicker label="The document" file={file} onChange={setFile} />
    </Screen>
  );
}
