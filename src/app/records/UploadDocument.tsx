import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React, {useRef, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {Badge, Button, Card, DateField, Field, KeyValue, Loading, Notice, Screen, SectionLabel, SelectField, Txt} from '../../components/ui';
import {errorText} from '../../lib/errors';
import {fmtDate} from '../../lib/format';
import type {PickedFile} from '../../services/files';
import {type CheckAnswer, checkDocument, type DocumentCheck, loadDocuments, uploadDocumentFile, uploadRenewal} from '../../services/records';
import type {RootStackParamList} from '../../navigations/types';
import {KEYS} from '../../store/keys';
import {invalidate, useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {toast} from '../../store/ui';
import {FilePicker} from '../shared/FilePicker';

/**
 * A renewed license or clearance from the phone. HR checks it in the portal before it counts. For the
 * types Claude reads (the LESP to start with), the photo is sent as soon as it is chosen and the
 * document-ai function reads it: the number and dates fill the form, and an expired license or a name
 * that is not the guard's is pointed out before it goes to HR.
 */
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
  const [uploaded, setUploaded] = useState<{key: string; typeId: string} | null>(null);
  const [reading, setReading] = useState(false);
  const [check, setCheck] = useState<CheckAnswer | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const attempt = useRef(0);
  const type = types.find(t => t.id === typeId);

  /** Claude reads it: upload now, check, and fill in what is still empty. */
  const read = async (f: PickedFile, docTypeId: string) => {
    const mine = ++attempt.current;
    setReading(true);
    setCheck(null);
    setCheckError(null);
    try {
      const key = await uploadDocumentFile(docTypeId, f);
      if (mine !== attempt.current) {
        return;
      }
      setUploaded({key, typeId: docTypeId});
      const answer = await checkDocument(key);
      if (mine !== attempt.current) {
        return;
      }
      setCheck(answer);
      if (answer.status === 'checked') {
        setNumber(n => n || answer.document_no);
        setIssued(d => d ?? (answer.issued_on || null));
        setExpires(d => d ?? (answer.expires_on || null));
      }
    } catch (e) {
      if (mine === attempt.current) {
        setCheckError(errorText(e));
      }
    } finally {
      if (mine === attempt.current) {
        setReading(false);
      }
    }
  };
  const chooseFile = (f: PickedFile | null) => {
    setFile(f);
    setUploaded(null);
    setCheck(null);
    setCheckError(null);
    attempt.current++;
    setReading(false);
    if (f && type?.ai_check) {
      read(f, type.id);
    }
  };
  const chooseType = (id: string | null) => {
    setTypeId(id);
    // a file sent for another type sits in that type's folder: send it again for this one
    if (uploaded && uploaded.typeId !== id) {
      setUploaded(null);
      setCheck(null);
      const next = types.find(t => t.id === id);
      if (file && next?.ai_check) {
        read(file, next.id);
      }
    }
  };
  const checked = check?.status === 'checked' ? check : null;

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
      await uploadRenewal({
        employeeId,
        documentTypeId: type!.id,
        documentNo: number,
        issuedOn: issued,
        expiresOn: type!.has_expiry ? expires : null,
        file: file!,
        uploadedKey: uploaded?.typeId === type!.id ? uploaded.key : null,
      });
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
    <Screen
      title="Upload a renewal"
      back
      keyboard
      footer={
        <Button
          title={checked?.expiry === 'expired' ? 'Send to HR anyway' : 'Send to HR'}
          variant={checked?.expiry === 'expired' ? 'secondary' : 'primary'}
          onPress={submit}
          busy={busy}
          disabled={reading}
          testID="upload-submit"
        />
      }>
      <Txt color="muted">
        {type?.ai_check
          ? 'Take a clear photo of the whole license. Claude reads it as soon as you choose it and fills in the number and dates; HR still checks it against the original.'
          : 'Take a clear photo of the whole document, or attach the PDF. HR checks it against the original.'}
      </Txt>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <SelectField label="Document" value={typeId} onChange={chooseType} options={types.map(t => ({value: t.id, label: t.name}))} />
      <FilePicker label="The document" file={file} onChange={chooseFile} />
      {reading ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Claude is reading the document">
          <ActivityIndicator />
          <Txt color="muted">Claude is reading the document…</Txt>
        </View>
      ) : null}
      {checked ? <CheckCard c={checked} /> : null}
      {check?.status === 'unsupported' ? <Notice tone="info">{check.message}</Notice> : null}
      {checkError ? <Notice tone="info">{`${checkError} You can still send it.`}</Notice> : null}
      <Field label="Document number (optional)" value={number} onChangeText={setNumber} autoCapitalize="characters" maxLength={80} />
      <DateField label="Issued on (optional)" value={issued} onChange={setIssued} />
      {type?.has_expiry ? <DateField label="Expires on" value={expires} onChange={setExpires} /> : null}
    </Screen>
  );
}

const EXPIRY: Record<DocumentCheck['expiry'], [string, 'ok' | 'warn' | 'bad' | 'neutral']> = {
  valid: ['Valid', 'ok'],
  expiring: ['Expires soon', 'warn'],
  expired: ['Expired', 'bad'],
  unknown: ['Expiry not readable', 'warn'],
  none: ['No expiry', 'neutral'],
};

/** What Claude read, and what to do about it. */
function CheckCard({c}: {c: DocumentCheck}) {
  const [label, tone] = EXPIRY[c.expiry];
  return (
    <Card>
      <SectionLabel>What Claude read</SectionLabel>
      <Badge tone={tone}>{label}</Badge>
      {c.document_no ? <KeyValue label="Number" value={c.document_no} /> : null}
      {c.expires_on ? <KeyValue label="Expires" value={fmtDate(c.expires_on)} /> : null}
      {c.holder_name ? <KeyValue label="Name on it" value={c.holder_name} /> : null}
      {c.expiry === 'expired' ? (
        <Notice tone="bad" title="This license has expired">
          {`It expired on ${fmtDate(c.expires_on)}. Renew it with the PNP SOSIA, then upload the new one. If Claude misread the date, correct it below and send it anyway.`}
        </Notice>
      ) : c.expiry === 'expiring' ? (
        <Notice tone="warn">{`It expires on ${fmtDate(c.expires_on)}. Start the renewal now.`}</Notice>
      ) : null}
      {!c.type_ok ? <Notice tone="warn">This does not look like the document you chose. Check the photo.</Notice> : null}
      {c.name_match === 'mismatch' || c.name_match === 'partial' ? <Notice tone="warn">The name on it does not match your record. HR will check.</Notice> : null}
      {c.legibility !== 'clear' ? <Notice tone="warn">Parts of it are hard to read. Take the photo again in good light, flat and without glare.</Notice> : null}
      {c.concerns.length ? <Txt variant="small" color="muted">{c.concerns.join(' ')}</Txt> : null}
      <Txt variant="small" color="muted">Claude fills in what it read; check it against your license. HR verifies it before it counts.</Txt>
    </Card>
  );
}
