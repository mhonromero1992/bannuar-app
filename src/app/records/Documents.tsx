import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Badge, Button, Card, Empty, Notice, ResourceView, Screen, Txt} from '../../components/ui';
import {DOC_STATUS, label, tone} from '../../config/labels';
import {errorText} from '../../lib/errors';
import {fmtDate, fmtRelativeDay, todayManila} from '../../lib/format';
import type {RootStackParamList} from '../../navigations/types';
import {openPrivateFile} from '../../services/files';
import {loadDocuments} from '../../services/records';
import {KEYS} from '../../store/keys';
import {useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {useRefreshOnFocus} from '../../store/useRefreshOnFocus';

/** Licenses, clearances and other documents HR keeps, with status and expiry; renewals go to HR to check. */
export default function Documents() {
  const focusId = useRoute<RouteProp<RootStackParamList, 'Documents'>>().params?.focusId;
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.documents, () => loadDocuments(employeeId));
  useRefreshOnFocus(res);
  const [error, setError] = useState<string | null>(null);
  const today = todayManila();
  return (
    <Screen
      title="Licenses and documents"
      back
      refreshing={res.refreshing}
      onRefresh={res.refresh}
      footer={res.data?.types.some(t => t.employee_can_upload) ? <Button title="Upload a renewal" icon="upload" onPress={() => nav.navigate('UploadDocument')} /> : undefined}>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <ResourceView
        resource={res}
        isEmpty={d => d.documents.length === 0}
        empty={<Empty title="No documents on file" body="When HR records your license, clearances and other papers, they show here with their expiry." />}>
        {data =>
          data.documents.map(d => {
            const expired = d.expires_on ? d.expires_on < today : false;
            return (
              <Card key={d.id} highlight={d.id === focusId}>
                <View style={styles.badges}>
                  <Badge tone={tone(DOC_STATUS, d.status)}>{label(DOC_STATUS, d.status)}</Badge>
                  {expired ? <Badge tone="bad">Expired</Badge> : null}
                </View>
                <Txt variant="heading">{d.type?.name ?? 'Document'}</Txt>
                {d.document_no ? <Txt variant="amount">{d.document_no}</Txt> : null}
                <Txt color="muted">
                  {[d.issued_on ? `Issued ${fmtDate(d.issued_on)}` : null, d.expires_on ? `${expired ? 'Expired' : 'Expires'} ${fmtDate(d.expires_on)} (${fmtRelativeDay(d.expires_on, today)})` : null]
                    .filter(Boolean)
                    .join(' · ') || 'No expiry'}
                </Txt>
                {d.status === 'rejected' && d.review_note ? <Notice tone="bad" title="HR's note">{d.review_note}</Notice> : null}
                {d.status === 'pending_review' ? <Txt color="muted">HR will check it. It shows as Verified when done.</Txt> : null}
                {d.file_path ? (
                  <Button
                    title="Open the file"
                    variant="ghost"
                    onPress={() => openPrivateFile('employee-files', d.file_path!, d.file_path!.split('/').pop() ?? 'document').catch(e => setError(errorText(e)))}
                  />
                ) : null}
                {d.type?.employee_can_upload && (expired || d.status === 'rejected') ? (
                  <Button title="Upload a renewal" variant="secondary" onPress={() => nav.navigate('UploadDocument', {documentTypeId: d.document_type_id})} />
                ) : null}
              </Card>
            );
          })
        }
      </ResourceView>
    </Screen>
  );
}

const styles = StyleSheet.create({badges: {flexDirection: 'row', gap: 8, flexWrap: 'wrap'}});
