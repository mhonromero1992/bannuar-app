import ReactNativeBlobUtil from 'react-native-blob-util';
import {launchCamera} from 'react-native-image-picker';
import {supabase} from '../config/supabase';
import {withoutRelock} from './appLock';
import {run} from './db';
import {type PickedFile, uploadMyFile} from './files';
import type {Fix, LocationCheck} from './location';

/**
 * Time in and time out. The guard takes a photo of themselves with the front camera; the app uploads
 * it to the private attendance-photos bucket (their own folder), then calls log_attendance with its
 * path and the location the phone read. The database stamps its own time and checks the location
 * against the post (schema.sql). The photo is deleted from the phone once it is sent.
 */
export type AttendanceKind = 'time_in' | 'time_out';

export interface AttendanceLog {
  id: string;
  kind: AttendanceKind;
  logged_at: string;
  location_check: LocationCheck;
  distance_m: number | null;
  accuracy_m: number | null;
  radius_m: number | null;
  mock_location: boolean | null;
  /** self: the guard's phone; commander: logged by the post's commander; manual: entered by HR. */
  source: AttendanceSource;
  manual_reason: string | null;
  site: {name: string} | null;
}

export type AttendanceSource = 'self' | 'commander' | 'manual';

/** log_attendance's answer. */
export interface AttendanceResult {
  id: string;
  kind: AttendanceKind;
  logged_at: string;
  location_check: LocationCheck;
  distance_m: number | null;
  accuracy_m: number | null;
  radius_m: number | null;
  site_name: string | null;
}

// no coordinates or photo paths: the phone keeps only what the list shows
export const ATTENDANCE_COLUMNS = 'id,kind,logged_at,location_check,distance_m,accuracy_m,radius_m,mock_location,source,manual_reason,site:sites(name)';

/** A guard's logs of the last 31 days, newest first: the guard's own, or a commander's guard's (row level security). */
export async function loadAttendance(employeeId: string, now: Date = new Date()): Promise<AttendanceLog[]> {
  const since = new Date(now.getTime() - 31 * 86400000).toISOString();
  const rows = await run(
    supabase.from('attendance_logs').select(ATTENDANCE_COLUMNS).eq('employee_id', employeeId).gte('logged_at', since).order('logged_at', {ascending: false}).limit(120),
  );
  return (rows ?? []) as unknown as AttendanceLog[];
}

/** A shift is at most this long: a time in older than this no longer waits for its time out. */
export const SHIFT_HOURS = 18;

/** What the guard most likely logs next: time out after a recent time in, otherwise time in. */
export function nextKind(logs: AttendanceLog[] | undefined, now: number = Date.now()): AttendanceKind {
  const last = logs?.[0];
  return last && last.kind === 'time_in' && now - Date.parse(last.logged_at) < SHIFT_HOURS * 3600000 ? 'time_out' : 'time_in';
}

/** What the files function takes for a selfie (schema.sql, upload_rule). */
export const MAX_SELFIE_BYTES = 3 * 1024 * 1024;
const SELFIE_TYPES: Record<string, string> = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic'};

/**
 * The front camera, through the phone's camera app. Some camera apps open the back camera anyway;
 * the screen says to switch. Never from the gallery: the photo is taken at the log.
 */
export async function takeSelfie(camera: 'front' | 'back' = 'front'): Promise<PickedFile | null> {
  const res = await withoutRelock(() =>
    launchCamera({mediaType: 'photo', cameraType: camera, quality: 0.6, maxWidth: 1080, maxHeight: 1080, saveToPhotos: false, includeBase64: false}),
  );
  const a = res.assets?.[0];
  if (res.didCancel || !a?.uri) {
    return null;
  }
  if (res.errorCode) {
    throw new Error(res.errorCode === 'camera_unavailable' ? 'This phone has no camera the app can use.' : 'The photo could not be taken. Try again.');
  }
  return {uri: a.uri, name: a.fileName ?? 'selfie.jpg', type: a.type ?? 'image/jpeg', size: a.fileSize ?? null};
}

/**
 * Sends the selfie to the guard's own S3 folder through the files Edge Function:
 * employees/<employee number>/attendance/<year>/<month>/<date>_<time>_<time-in|time-out>_<random>.jpg.
 * Returns the key for log_attendance, which accepts only the guard's own upload of the last 30 minutes.
 * A commander passes the guard's id: the photo goes to the guard's folder, for log_attendance_for.
 */
export async function uploadSelfie(kind: AttendanceKind, photo: PickedFile, guardId?: string): Promise<string> {
  if (!SELFIE_TYPES[photo.type]) {
    throw new Error('Take the photo with the camera, as a JPG.');
  }
  if (photo.size !== null && photo.size > MAX_SELFIE_BYTES) {
    throw new Error('The photo is too big to send. Take it again.');
  }
  return (await uploadMyFile('attendance', photo, guardId ? {kind, employeeId: guardId} : {kind})).key;
}

/** Writes the log. A retry with the same photo path returns the first log (log_attendance). */
export async function logAttendance(input: {kind: AttendanceKind; photoPath: string; fix: Fix | null}): Promise<AttendanceResult> {
  return run(
    supabase.rpc('log_attendance', {
      p_kind: input.kind,
      p_photo_path: input.photoPath,
      p_latitude: input.fix?.latitude ?? null,
      p_longitude: input.fix?.longitude ?? null,
      p_accuracy_m: input.fix ? Math.round(input.fix.accuracy * 10) / 10 : null,
      p_mock_location: input.fix?.mocked ?? null,
    }),
  ) as Promise<AttendanceResult>;
}

/**
 * The commander logs for a guard of their post who has no phone with them: the guard's photo, taken
 * by the commander now, and the commander's location. The database checks that the commander
 * supervises the guard's post, stamps its own time, marks the log "by the commander" and tells the guard.
 */
export async function logAttendanceFor(input: {guardId: string; kind: AttendanceKind; photoPath: string; fix: Fix | null}): Promise<AttendanceResult> {
  return run(
    supabase.rpc('log_attendance_for', {
      p_employee_id: input.guardId,
      p_kind: input.kind,
      p_photo_path: input.photoPath,
      p_latitude: input.fix?.latitude ?? null,
      p_longitude: input.fix?.longitude ?? null,
      p_accuracy_m: input.fix ? Math.round(input.fix.accuracy * 10) / 10 : null,
      p_mock_location: input.fix?.mocked ?? null,
    }),
  ) as Promise<AttendanceResult>;
}

/** Deletes the photo the camera left in the app's cache (sent, or not wanted). */
export async function discardPhoto(photo: PickedFile | null | undefined): Promise<void> {
  if (!photo?.uri.startsWith('file://')) {
    return;
  }
  try {
    await ReactNativeBlobUtil.fs.unlink(decodeURIComponent(photo.uri.slice('file://'.length)));
  } catch {
    // already gone
  }
}

/** The database's refusals that mean "take the photo again" (an old or missing upload). */
export function photoMustBeRetaken(message: string): boolean {
  return /did not arrive|Take your photo first/i.test(message);
}
