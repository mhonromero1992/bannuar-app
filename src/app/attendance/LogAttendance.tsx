import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {useTheme} from 'styled-components/native';
import {Badge, Button, Card, Icon, Notice, Screen, SectionLabel, Txt} from '../../components/ui';
import {label, LOCATION_CHECK, tone} from '../../config/labels';
import {errorText, isNetworkError} from '../../lib/errors';
import {fmtDistance, fmtLongDate, fmtTime} from '../../lib/format';
import type {RootStackParamList} from '../../navigations/types';
import {type AttendanceResult, discardPhoto, logAttendance, photoMustBeRetaken, takeSelfie, uploadSelfie} from '../../services/attendance';
import type {PickedFile} from '../../services/files';
import {askLocation, checkLocation, type Fix, getFix, LocationError, LOCATION_MESSAGES, type LocationProblem, openAppSettings, type Permission} from '../../services/location';
import {loadMe} from '../../services/profile';
import {KEYS} from '../../store/keys';
import {invalidate, useResource} from '../../store/resources';
import {useEmployeeId} from '../../store/session';
import {checkLine, flagged} from './words';

type Locating = {state: 'asking'} | {state: 'finding'} | {state: 'found'; fix: Fix; permission: Permission} | {state: 'failed'; problem: LocationProblem};

/**
 * Time in or time out: the phone's location (checked against the post as the database will), a
 * photo of the guard taken now, then the log. Nothing is refused for being away from the post; the
 * guard sees what HR will see before sending.
 */
export default function LogAttendance() {
  const {kind} = useRoute<RouteProp<RootStackParamList, 'LogAttendance'>>().params;
  const nav = useNavigation();
  const employeeId = useEmployeeId();
  const me = useResource(KEYS.me, () => loadMe(employeeId));
  const words = kind === 'time_in' ? 'time in' : 'time out';
  const [loc, setLoc] = useState<Locating>({state: 'asking'});
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<AttendanceResult | null>(null);
  const live = useRef(true);
  const photoRef = useRef<PickedFile | null>(null);
  photoRef.current = done ? null : photo;

  const locate = useCallback(async () => {
    setLoc({state: 'asking'});
    const permission = await askLocation().catch(() => 'denied' as const);
    if (permission === 'denied' || permission === 'blocked') {
      if (live.current) {
        setLoc({state: 'failed', problem: permission});
      }
      return;
    }
    if (live.current) {
      setLoc({state: 'finding'});
    }
    try {
      const fix = await getFix();
      if (live.current) {
        setLoc({state: 'found', fix, permission});
      }
    } catch (e) {
      if (live.current) {
        setLoc({state: 'failed', problem: e instanceof LocationError ? e.problem : 'unavailable'});
      }
    }
  }, []);

  useEffect(() => {
    live.current = true;
    locate();
    return () => {
      live.current = false;
      // a photo taken but not sent does not stay on the phone
      discardPhoto(photoRef.current).catch(() => undefined);
    };
  }, [locate]);

  const take = async () => {
    setError(null);
    try {
      const p = await takeSelfie();
      if (p) {
        await discardPhoto(photo);
        setPhoto(p);
        setUploadedPath(null);
      }
    } catch (e) {
      setError(errorText(e));
    }
  };

  const send = async () => {
    if (!photo) {
      setError('Take your photo first.');
      return;
    }
    setBusy(true);
    setError(null);
    let path = uploadedPath;
    try {
      if (!path) {
        path = await uploadSelfie(kind, photo);
        setUploadedPath(path);
      }
      const result = await logAttendance({kind, photoPath: path, fix: loc.state === 'found' ? loc.fix : null});
      await discardPhoto(photo);
      invalidate(KEYS.attendance);
      setDone(result);
    } catch (e) {
      const message = errorText(e);
      if (photoMustBeRetaken(message)) {
        await discardPhoto(photo);
        setPhoto(null);
        setUploadedPath(null);
        setError('Your photo did not reach the server. Take it again, then send.');
      } else {
        setError(isNetworkError(e) ? `No connection, so your ${words} is not logged yet. Try again when you have signal.` : message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen title={kind === 'time_in' ? 'Time in' : 'Time out'} footer={<Button title="Done" onPress={() => nav.goBack()} testID="attendance-done" />}>
        <Done result={done} />
      </Screen>
    );
  }

  const site = me.data?.site ?? null;
  const settled = loc.state === 'found' || loc.state === 'failed';
  return (
    <Screen
      title={kind === 'time_in' ? 'Time in' : 'Time out'}
      back
      footer={
        <>
          {photo && !settled ? (
            <Txt variant="small" color="muted">
              Waiting for your location…
            </Txt>
          ) : null}
          <Button title={kind === 'time_in' ? 'Log time in' : 'Log time out'} onPress={send} busy={busy} disabled={!photo || !settled} testID="attendance-send" />
        </>
      }>
      <Card>
        <SectionLabel>1. Your location</SectionLabel>
        <Where loc={loc} site={site} hasMe={me.data !== undefined} onRetry={locate} />
      </Card>
      <Card>
        <SectionLabel>2. Your photo</SectionLabel>
        {photo ? (
          <Image source={{uri: photo.uri}} style={styles.photo} accessibilityLabel="The photo you took" />
        ) : (
          <Txt>Take a photo of yourself at your post. If the back camera opens, switch to the front camera.</Txt>
        )}
        <Button title={photo ? 'Take it again' : 'Take my photo'} icon="camera" variant={photo ? 'secondary' : 'primary'} onPress={take} testID="attendance-photo" />
      </Card>
      {error ? (
        <Notice tone="bad" title="Not logged yet">
          {error}
        </Notice>
      ) : null}
      <Txt variant="small" color="muted">
        Your photo, the time and your location go to Bannuar HR with this log. The app reads your location only while you log, never in the background.
      </Txt>
    </Screen>
  );
}

function Where({loc, site, hasMe, onRetry}: {loc: Locating; site: {name: string; latitude?: number | null; longitude?: number | null; geofence_radius_m?: number | null} | null; hasMe: boolean; onRetry: () => void}) {
  if (loc.state === 'asking' || loc.state === 'finding') {
    return <Txt color="muted">{loc.state === 'asking' ? 'Asking to use your location…' : 'Finding your location. This can take a few seconds…'}</Txt>;
  }
  if (loc.state === 'failed') {
    return (
      <>
        <Notice tone="warn">{LOCATION_MESSAGES[loc.problem]}</Notice>
        <Txt color="muted">You can still log without it. HR will see that the log has no location.</Txt>
        {loc.problem === 'blocked' ? (
          <Button title="Open Settings" variant="secondary" onPress={openAppSettings} />
        ) : (
          <Button title={loc.problem === 'denied' ? 'Allow location' : 'Try again'} variant="secondary" icon="refresh" onPress={onRetry} />
        )}
      </>
    );
  }
  const {fix, permission} = loc;
  const preview = hasMe ? checkLocation(fix, site) : null;
  return (
    <>
      {preview ? (
        <>
          <Badge tone={tone(LOCATION_CHECK, preview.check)}>{label(LOCATION_CHECK, preview.check)}</Badge>
          <Txt>{previewLine(preview.check, preview.distance, fix.accuracy, site?.name)}</Txt>
        </>
      ) : (
        <Txt>{`Found, accurate to ${fmtDistance(fix.accuracy)}.`}</Txt>
      )}
      {permission === 'approximate' ? (
        <Notice tone="warn">Bannuar has only your approximate location. Turn on precise location for Bannuar in Settings, then try again.</Notice>
      ) : null}
      {fix.mocked ? (
        <Notice tone="bad" title="A mock location app is on">
          HR will see that this location may be made up. Turn off mock locations in your phone's developer options.
        </Notice>
      ) : null}
      {preview && (preview.check === 'away' || preview.check === 'unsure') ? <Button title="Find my location again" variant="secondary" icon="refresh" onPress={onRetry} /> : null}
    </>
  );
}

function previewLine(check: string, distance: number | null, accuracy: number, post?: string | null): string {
  switch (check) {
    case 'at_post':
      return `${checkLine('at_post', distance, accuracy, post)}. GPS accurate to ${fmtDistance(accuracy)}.`;
    case 'away':
      return `${checkLine('away', distance, accuracy, post)}. If you are at your post, wait a moment and find your location again. You can still log.`;
    case 'unsure':
      return `Accurate only to ${fmtDistance(accuracy)}, too rough to tell. Step outside or near a window, then find your location again.`;
    case 'post_not_set':
      return "Your post's location is not set yet, so the app cannot check it. Your log still counts.";
    default:
      return 'You have no post on file. Your log is still kept.';
  }
}

function Done({result}: {result: AttendanceResult}) {
  const {colors} = useTheme();
  const look = flagged(result.location_check, false);
  return (
    <>
      <Card highlight>
        <View style={styles.doneHead}>
          <Icon name="check" size={28} color={colors.tones.ok.text} />
          <Txt variant="title" accessibilityRole="header">
            {result.kind === 'time_in' ? 'Time in logged' : 'Time out logged'}
          </Txt>
        </View>
        <Txt variant="figure">{fmtTime(result.logged_at)}</Txt>
        <Txt color="muted">{fmtLongDate(result.logged_at)}</Txt>
        {result.site_name ? <Txt color="muted">{result.site_name}</Txt> : null}
        <Badge tone={tone(LOCATION_CHECK, result.location_check)}>{label(LOCATION_CHECK, result.location_check)}</Badge>
        <Txt color="muted">{checkLine(result.location_check, result.distance_m, result.accuracy_m, result.site_name)}</Txt>
      </Card>
      {look ? (
        <Notice tone="warn" title="HR will look at this log">
          If you were at your post, tell your detachment commander. Your photo shows where you were.
        </Notice>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  photo: {width: '100%', aspectRatio: 1, borderRadius: 10},
  doneHead: {flexDirection: 'row', alignItems: 'center', gap: 10},
});
