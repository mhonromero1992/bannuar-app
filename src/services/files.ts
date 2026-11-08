import {errorCodes, isErrorWithCode, pick, types} from '@react-native-documents/picker';
import {Platform} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {launchCamera, launchImageLibrary, type ImagePickerResponse} from 'react-native-image-picker';
import {supabase} from '../config/supabase';
import {randomId} from '../lib/ids';
import {withoutRelock} from './appLock';

/**
 * Files in and out of the private buckets.
 *
 * Opening a certificate PDF: react-native-blob-util downloads it from a one-minute signed link into
 * the app's own cache, then hands it to the phone's PDF viewer (a FileProvider link on Android, the
 * preview with its share button on iOS). One module does both the download and the hand-over; the
 * alternatives need two (react-native-fs with react-native-share or a file viewer). The copy stays in
 * the app's private cache and is deleted at sign-out.
 */
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size: number | null;
}

/** The employee-files bucket's limits (schema.sql, section 13). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export function fileProblem(f: PickedFile): string | null {
  if (!UPLOAD_TYPES[f.type]) {
    return 'Send a PDF or a photo (JPG or PNG).';
  }
  if (f.size !== null && f.size > MAX_UPLOAD_BYTES) {
    return 'That file is too big. Send one under 10 MB, or take a photo instead.';
  }
  return null;
}

function fromImagePicker(res: ImagePickerResponse): PickedFile | null {
  const a = res.assets?.[0];
  if (res.didCancel || !a?.uri) {
    return null;
  }
  if (res.errorCode) {
    throw new Error(res.errorCode === 'camera_unavailable' ? 'This phone has no camera the app can use.' : 'The photo could not be taken. Try again.');
  }
  return {uri: a.uri, name: a.fileName ?? 'photo.jpg', type: a.type ?? 'image/jpeg', size: a.fileSize ?? null};
}

// Photos are scaled down before they leave the phone: a readable document, a smaller upload on prepaid data.
const PHOTO = {mediaType: 'photo' as const, quality: 0.7 as const, maxWidth: 1800, maxHeight: 1800, includeBase64: false};

export async function takePhoto(): Promise<PickedFile | null> {
  return fromImagePicker(await withoutRelock(() => launchCamera({...PHOTO, saveToPhotos: false})));
}

export async function choosePhoto(): Promise<PickedFile | null> {
  return fromImagePicker(await withoutRelock(() => launchImageLibrary({...PHOTO, selectionLimit: 1})));
}

export async function chooseDocument(): Promise<PickedFile | null> {
  try {
    const [f] = await withoutRelock(() => pick({type: [types.pdf, types.images]}));
    return f ? {uri: f.uri, name: f.name ?? 'document', type: f.type ?? 'application/octet-stream', size: f.size ?? null} : null;
  } catch (e) {
    if (isErrorWithCode(e) && (e as {code?: string}).code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw e;
  }
}

/**
 * Uploads to employee-files/<employee id>/uploads/<random>.<ext>, the only folder the storage policy
 * lets an employee write to. Returns the path to store on the row.
 */
export async function uploadEmployeeFile(employeeId: string, file: PickedFile): Promise<string> {
  const problem = fileProblem(file);
  if (problem) {
    throw new Error(problem);
  }
  const path = `${employeeId}/uploads/${randomId()}.${UPLOAD_TYPES[file.type]}`;
  const form = new FormData();
  // React Native reads the file itself from its uri (content:// or file://) while sending
  form.append('', {uri: file.uri, name: file.name, type: file.type} as unknown as Blob);
  const {error} = await supabase.storage.from('employee-files').upload(path, form, {contentType: file.type, upsert: false});
  if (error) {
    throw error;
  }
  return path;
}

const CACHE_DIR = () => `${ReactNativeBlobUtil.fs.dirs.CacheDir}/bannuar-files`;
const MIME: Record<string, string> = {pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic'};

/** Downloads a private file through a one-minute signed link and opens it in the phone's viewer. */
export async function openPrivateFile(bucket: 'certificates' | 'employee-files', path: string, fileName: string): Promise<void> {
  const {data, error} = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    throw error ?? new Error('The file could not be opened.');
  }
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  const target = `${CACHE_DIR()}/${safe}`;
  const res = await ReactNativeBlobUtil.config({fileCache: true, path: target}).fetch('GET', data.signedUrl);
  const status = res.info().status;
  if (status < 200 || status >= 300) {
    throw new Error('The file could not be downloaded. Try again.');
  }
  const ext = (safe.split('.').pop() ?? '').toLowerCase();
  if (Platform.OS === 'android') {
    await ReactNativeBlobUtil.android.actionViewIntent(res.path(), MIME[ext] ?? 'application/pdf');
  } else {
    ReactNativeBlobUtil.ios.previewDocument(res.path());
  }
}

/** Deletes every downloaded file (sign-out). */
export async function clearDownloadedFiles(): Promise<void> {
  try {
    await ReactNativeBlobUtil.fs.unlink(CACHE_DIR());
  } catch {
    // nothing there
  }
}
