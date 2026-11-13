import {errorCodes, isErrorWithCode, pick, types} from '@react-native-documents/picker';
import {Platform} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {launchCamera, launchImageLibrary, type ImagePickerResponse} from 'react-native-image-picker';
import {env} from '../config/env';
import {SUPABASE_URL, supabase} from '../config/supabase';
import {withoutRelock} from './appLock';

/**
 * Files in and out of Amazon S3.
 *
 * Uploads go to the files Edge Function, which holds the AWS keys and asks the database whether this
 * employee may store the file and under which key: their own folder,
 * employees/<employee number>/<201-file | work-requirements | lesp | attendance | leave>/. Nothing about
 * AWS is in the app. Files stored before the switch to S3 are still in Supabase Storage and still open
 * (their paths do not start with employees/).
 *
 * Opening a file: react-native-blob-util downloads it from a short-lived link (or, for a payslip, from
 * the payslip-pdf function, which makes the PDF on the spot) into the app's own cache, then hands it to
 * the phone's viewer (a FileProvider link on Android, the preview with its share button on iOS). The
 * copy stays in the app's private cache and is deleted at sign-out.
 */
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size: number | null;
}

/** What the files function takes for documents and leave attachments (schema.sql, upload_rule). */
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

/** Files kept in Amazon S3 have keys like employees/G-002/lesp/...; older ones are in Supabase Storage. */
export const isS3Key = (path: string | null | undefined): path is string => Boolean(path && path.startsWith('employees/'));

export type UploadPurpose = 'document' | 'leave' | 'attendance';
export interface StoredFile {
  id: string;
  key: string;
  name: string;
  content_type: string;
  size_bytes: number;
}

/** The signed-in guard's own token and the public key, for the Edge Functions. */
export async function functionHeaders(): Promise<Record<string, string>> {
  const {data} = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Your sign-in has expired. Sign in again.');
  }
  return {Authorization: `Bearer ${token}`, apikey: env.supabaseKey};
}

async function failure(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as {message?: string} | null;
  return new Error(body?.message || fallback);
}

/**
 * Sends a file to the employee's own S3 folder through the files Edge Function (or, for a commander
 * logging a guard who has no phone, to that guard's attendance folder). The database picks
 * the folder (the document type's: 201-file, work-requirements or lesp; or leave, or
 * attendance/<year>/<month>) and the name. Returns what was stored, with the key to save on the row.
 */
export async function uploadMyFile(
  purpose: UploadPurpose,
  file: PickedFile,
  extra: {documentTypeId?: string; kind?: 'time_in' | 'time_out'; employeeId?: string} = {},
): Promise<StoredFile> {
  const problem = fileProblem(file);
  if (problem) {
    throw new Error(problem);
  }
  const form = new FormData();
  form.append('purpose', purpose);
  if (extra.documentTypeId) {
    form.append('document_type_id', extra.documentTypeId);
  }
  if (extra.kind) {
    form.append('kind', extra.kind);
  }
  if (extra.employeeId) {
    // only for a commander's photo of a guard of their post at time in or out (begin_file_upload)
    form.append('employee_id', extra.employeeId);
  }
  // React Native reads the file itself from its uri (content:// or file://) while sending
  form.append('file', {uri: file.uri, name: file.name, type: file.type} as unknown as Blob);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/files`, {method: 'POST', headers: await functionHeaders(), body: form});
  if (!res.ok) {
    throw await failure(res, 'The file could not be sent. Try again.');
  }
  return (await res.json()) as StoredFile;
}

/** A five-minute link to one of the employee's S3 files, made by the files function. */
async function s3Link(key: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/files`, {
    method: 'POST',
    headers: {...(await functionHeaders()), 'Content-Type': 'application/json'},
    body: JSON.stringify({action: 'sign', keys: [key], download: true}),
  });
  if (!res.ok) {
    throw await failure(res, 'The file could not be opened. Try again.');
  }
  const link = ((await res.json()) as {urls?: Record<string, string>}).urls?.[key];
  if (!link) {
    throw new Error('This file is not available to you.');
  }
  return link;
}

const CACHE_DIR = () => `${ReactNativeBlobUtil.fs.dirs.CacheDir}/bannuar-files`;
const MIME: Record<string, string> = {pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic'};

/**
 * Downloads a file into the app's cache and opens it in the phone's viewer. The request is a GET of a
 * signed link, or a POST to an Edge Function (the payslip PDF).
 */
export async function downloadAndOpen(
  request: {method: 'GET' | 'POST'; url: string; headers?: Record<string, string>; body?: string},
  fileName: string,
): Promise<void> {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, '_');
  const target = `${CACHE_DIR()}/${safe}`;
  const res = await ReactNativeBlobUtil.config({fileCache: true, path: target}).fetch(request.method, request.url, request.headers, request.body);
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

/**
 * Opens one of the employee's files: from S3 through a five-minute link, or (files from before the
 * switch) from Supabase Storage through a one-minute link.
 */
export async function openPrivateFile(bucket: 'certificates' | 'employee-files', path: string, fileName: string): Promise<void> {
  let link: string;
  if (isS3Key(path)) {
    link = await s3Link(path);
  } else {
    const {data, error} = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      throw error ?? new Error('The file could not be opened.');
    }
    link = data.signedUrl;
  }
  await downloadAndOpen({method: 'GET', url: link}, fileName);
}

/** Deletes every downloaded file (sign-out). */
export async function clearDownloadedFiles(): Promise<void> {
  try {
    await ReactNativeBlobUtil.fs.unlink(CACHE_DIR());
  } catch {
    // nothing there
  }
}
