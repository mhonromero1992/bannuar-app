import {type RouteProp, useRoute} from '@react-navigation/native';
import React, {useEffect, useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {Badge, Button, Empty, Loading, Notice, Screen, Txt} from '../../components/ui';
import {ANN_CATEGORY, ANN_PRIORITY, label, tone} from '../../config/labels';
import {errorText} from '../../lib/errors';
import {fmtDateTime} from '../../lib/format';
import type {RootStackParamList} from '../../navigations/types';
import {announcementImages, loadAnnouncements, markAnnouncementRead} from '../../services/announcements';
import {KEYS} from '../../store/keys';
import {invalidate, mutateResource, useResource} from '../../store/resources';
import type {AnnouncementsData} from '../../services/announcements';
import {useEmployeeId} from '../../store/session';

/** Opening records the read (mark_announcement_read); "I acknowledge" records the acknowledgment. */
export default function AnnouncementDetail() {
  const {id} = useRoute<RouteProp<RootStackParamList, 'AnnouncementDetail'>>().params;
  const employeeId = useEmployeeId();
  const res = useResource(KEYS.announcements, () => loadAnnouncements(employeeId));
  const a = res.data?.items.find(x => x.id === id);
  const receipt = res.data?.receipts[id];
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!a) {
      return;
    }
    if (!receipt) {
      markAnnouncementRead(id)
        .then(() => {
          const now = new Date().toISOString();
          mutateResource<AnnouncementsData>(KEYS.announcements, d => ({...d, receipts: {...d.receipts, [id]: {announcement_id: id, read_at: now, acknowledged_at: null}}}));
        })
        .catch(() => undefined);
    }
    announcementImages(id).then(setImages).catch(() => setImages([]));
    // once per announcement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, Boolean(a)]);

  const acknowledge = async () => {
    setBusy(true);
    setError(null);
    try {
      await markAnnouncementRead(id, true);
      const now = new Date().toISOString();
      mutateResource<AnnouncementsData>(KEYS.announcements, d => ({...d, receipts: {...d.receipts, [id]: {announcement_id: id, read_at: d.receipts[id]?.read_at ?? now, acknowledged_at: now}}}));
      invalidate(KEYS.home);
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };

  return (
    <Screen title="Announcement" back>
      {!a ? (
        res.status === 'loading' ? <Loading /> : <Empty title="Announcement not found" body="It may have expired or been taken down." />
      ) : (
        <>
          <View style={styles.meta}>
            {a.priority !== 'normal' ? <Badge tone={tone(ANN_PRIORITY, a.priority)}>{label(ANN_PRIORITY, a.priority)}</Badge> : null}
            <Badge tone="neutral">{label(ANN_CATEGORY, a.category)}</Badge>
          </View>
          <Txt variant="display" accessibilityRole="header">
            {a.title}
          </Txt>
          {a.published_at ? <Txt color="muted">{`Published ${fmtDateTime(a.published_at)}`}</Txt> : null}
          <Txt selectable>{a.body}</Txt>
          {images.map(uri => (
            <Image key={uri} source={{uri}} style={styles.image} resizeMode="contain" accessibilityLabel="Picture attached to the announcement" />
          ))}
          {error ? <Notice tone="bad">{error}</Notice> : null}
          {a.requires_ack ? (
            receipt?.acknowledged_at ? (
              <Notice tone="ok">{`You acknowledged this on ${fmtDateTime(receipt.acknowledged_at)}.`}</Notice>
            ) : (
              <>
                <Notice tone="warn">HR asks you to confirm you have read this.</Notice>
                <Button title="I acknowledge" onPress={acknowledge} busy={busy} testID="acknowledge" />
              </>
            )
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {flexDirection: 'row', gap: 8, flexWrap: 'wrap'},
  image: {width: '100%', aspectRatio: 4 / 3, borderRadius: 10},
});
