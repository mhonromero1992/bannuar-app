import ReactNativeBlobUtil from 'react-native-blob-util';
import {launchCamera} from 'react-native-image-picker';
import {PermissionsAndroid} from 'react-native';
import {checkLine, dayTitle, flagged, whenText} from '../src/app/attendance/words';
import {fmtDistance, fmtTime, manilaDay} from '../src/lib/format';
import {discardPhoto, loadAttendance, logAttendance, nextKind, photoMustBeRetaken, takeSelfie, uploadSelfie, type AttendanceLog} from '../src/services/attendance';
import {askLocation, checkLocation, distanceM, getFix, LocationError, permissionFrom, toFix} from '../src/services/location';
import {EMPLOYEE_ID, formFields, installMockApi, type MockApi} from './support/mockApi';
import {signIn} from '../src/services/auth';

type Geo = {fix: unknown; error: number | null; silent: boolean; authorized: boolean};
const geo = () => (global as unknown as {__geo: Geo}).__geo;
const POST = {name: 'Post A', latitude: 14.5547, longitude: 121.0244, geofence_radius_m: 150};
const at = (latitude: number, accuracy: number, mocked: boolean | null = false) => ({latitude, longitude: 121.0244, accuracy, mocked});

let api: MockApi;
beforeEach(() => {
  api = installMockApi();
  geo().fix = {coords: {latitude: 14.5552, longitude: 121.0244, accuracy: 12}, mocked: false, timestamp: 0};
  geo().error = null;
  geo().silent = false;
  geo().authorized = true;
});

describe('the location check matches log_attendance (supabase/tests/run-tests.sh uses the same points)', () => {
  it('measures like public.geo_distance_m', () => {
    expect(Math.round(distanceM(at(14.5552, 0), POST))).toBe(56);
    expect(Math.round(distanceM(at(14.5565, 0), POST))).toBe(200);
    expect(Math.round(distanceM(at(14.5647, 0), POST))).toBe(1112);
  });
  it.each([
    ['56 m away, GPS to 12 m', at(14.5552, 12), 'at_post', 56],
    ['a kilometre away, GPS to 20 m', at(14.5647, 20), 'away', 1112],
    ['56 m away, GPS only to 300 m', at(14.5552, 300), 'unsure', 56],
    ['200 m away, GPS to 80 m (could be inside)', at(14.5565, 80), 'unsure', 200],
    ['200 m away, GPS to 40 m', at(14.5565, 40), 'away', 200],
  ])('%s', (_name, fix, check, distance) => {
    expect(checkLocation(fix, POST)).toEqual({check, distance, radius: 150});
  });
  it('no fix, no post, or a post without a location', () => {
    expect(checkLocation(null, POST).check).toBe('no_location');
    expect(checkLocation(at(14.5552, 5), null).check).toBe('no_post');
    expect(checkLocation(at(14.5552, 5), {name: 'Post B', latitude: null, longitude: null}).check).toBe('post_not_set');
  });
  it('reads the numbers PostgREST sends for numeric columns', () => {
    expect(checkLocation(at(14.5552, 12), {latitude: '14.554700', longitude: '121.024400', geofence_radius_m: 150}).check).toBe('at_post');
  });
});

describe('reading the phone\'s location', () => {
  it('Android: precise, approximate only, refused, or refused for good', () => {
    const {ACCESS_FINE_LOCATION: F, ACCESS_COARSE_LOCATION: C} = PermissionsAndroid.PERMISSIONS;
    const {GRANTED, DENIED, NEVER_ASK_AGAIN} = PermissionsAndroid.RESULTS;
    expect(permissionFrom({[F]: GRANTED, [C]: GRANTED})).toBe('precise');
    expect(permissionFrom({[F]: DENIED, [C]: GRANTED})).toBe('approximate');
    expect(permissionFrom({[F]: DENIED, [C]: DENIED})).toBe('denied');
    expect(permissionFrom({[F]: NEVER_ASK_AGAIN, [C]: NEVER_ASK_AGAIN})).toBe('blocked');
  });
  it('iOS: asks through Core Location', async () => {
    expect(await askLocation()).toBe('precise');
    geo().authorized = false;
    expect(await askLocation()).toBe('blocked');
  });
  it('a fresh, precise position, with Android\'s mock location flag', async () => {
    geo().fix = {coords: {latitude: 14.5552, longitude: 121.0244, accuracy: 12.5}, mocked: true, timestamp: 0};
    expect(await getFix()).toEqual({latitude: 14.5552, longitude: 121.0244, accuracy: 12.5, mocked: true});
    const Geolocation = require('@react-native-community/geolocation').default;
    expect(Geolocation.getCurrentPosition.mock.calls.at(-1)[2]).toEqual({enableHighAccuracy: true, timeout: 25000, maximumAge: 5000});
    expect(Geolocation.setRNConfiguration).toHaveBeenCalledWith(expect.objectContaining({skipPermissionRequests: true, enableBackgroundLocationUpdates: false}));
  });
  it('iOS does not say whether a position is mocked', () => {
    expect(toFix({coords: {latitude: 1, longitude: 2, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: null, speed: null}, timestamp: 0}).mocked).toBeNull();
  });
  it('each failure has its own plain message', async () => {
    geo().error = 1;
    expect((await getFix().catch(e => e)).problem).toBe('denied');
    geo().error = 2;
    const off = await getFix().catch(e => e);
    expect(off).toBeInstanceOf(LocationError);
    expect(off.problem).toBe('unavailable');
    expect(off.message).toMatch(/Location is on/);
    geo().error = 3;
    expect((await getFix().catch(e => e)).problem).toBe('timeout');
  });
  it('gives up after its own time limit when the phone never answers', async () => {
    geo().silent = true;
    jest.useFakeTimers();
    const pending = getFix(1000).catch(e => e);
    jest.advanceTimersByTime(1001);
    jest.useRealTimers();
    expect((await pending).problem).toBe('timeout');
  });
});

describe('the selfie and the log', () => {
  it('the front camera, never the gallery, scaled down for prepaid data', async () => {
    (launchCamera as jest.Mock).mockResolvedValueOnce({assets: [{uri: 'file:///cache/rn_image_picker_lib_temp_1.jpg', fileName: 'x.jpg', type: 'image/jpeg', fileSize: 190000}]});
    const p = await takeSelfie();
    expect(p).toEqual({uri: 'file:///cache/rn_image_picker_lib_temp_1.jpg', name: 'x.jpg', type: 'image/jpeg', size: 190000});
    expect((launchCamera as jest.Mock).mock.calls.at(-1)[0]).toMatchObject({cameraType: 'front', mediaType: 'photo', saveToPhotos: false, maxWidth: 1080});
  });
  it('goes to the guard\'s own S3 attendance folder through the files function, with the kind', async () => {
    await signIn('G-002', api.password); // the files functions take the guard's own token
    const key = await uploadSelfie('time_in', {uri: 'file:///cache/a.jpg', name: 'a.jpg', type: 'image/jpeg', size: 200000});
    expect(key).toMatch(/^employees\/G-002\/attendance\/2026\/11\/2026-11-11_0802_time-in_mock\d+\.jpg$/);
    const up = api.requests.find(r => r.path === '/functions/v1/files');
    expect(up?.method).toBe('POST');
    expect(formFields(up?.body)).toEqual({purpose: 'attendance', kind: 'time_in', file: '[file]'});
    expect(api.requests.some(r => r.path.startsWith('/storage/v1/'))).toBe(false);
  });
  it('refuses what the files function would refuse', async () => {
    await expect(uploadSelfie('time_in', {uri: 'file:///a.gif', name: 'a.gif', type: 'image/gif', size: 10})).rejects.toThrow(/JPG/);
    await expect(uploadSelfie('time_in', {uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg', size: 4 * 1024 * 1024})).rejects.toThrow(/too big/);
    expect(api.requests.length).toBe(0);
  });
  it('the log carries the photo and the position; the server sets the time', async () => {
    const r = await logAttendance({kind: 'time_in', photoPath: `${EMPLOYEE_ID}/x.jpg`, fix: {latitude: 14.5552, longitude: 121.0244, accuracy: 12.44, mocked: false}});
    expect(api.rpcCalls('log_attendance')[0].body).toEqual({
      p_kind: 'time_in',
      p_photo_path: `${EMPLOYEE_ID}/x.jpg`,
      p_latitude: 14.5552,
      p_longitude: 121.0244,
      p_accuracy_m: 12.4,
      p_mock_location: false,
    });
    expect(JSON.stringify(api.rpcCalls('log_attendance')[0].body)).not.toMatch(/logged_at|time"/);
    expect(r.location_check).toBe('at_post');
  });
  it('without a location, the log says so', async () => {
    await logAttendance({kind: 'time_out', photoPath: `${EMPLOYEE_ID}/y.jpg`, fix: null});
    expect(api.rpcCalls('log_attendance')[0].body).toMatchObject({p_latitude: null, p_longitude: null, p_accuracy_m: null, p_mock_location: null});
  });
  it('the photo is deleted from the phone after sending', async () => {
    await discardPhoto({uri: 'file:///cache/rn_image_picker_lib_temp_1.jpg', name: 'x', type: 'image/jpeg', size: 1});
    expect(ReactNativeBlobUtil.fs.unlink).toHaveBeenCalledWith('/cache/rn_image_picker_lib_temp_1.jpg');
  });
  it('knows which refusals mean "take the photo again"', () => {
    expect(photoMustBeRetaken('Your photo did not arrive. Take it again.')).toBe(true);
    expect(photoMustBeRetaken('Only employees log attendance')).toBe(false);
  });
  it('the list asks for the guard\'s own last 31 days, newest first, without coordinates', async () => {
    await loadAttendance(EMPLOYEE_ID, new Date('2026-11-11T00:00:00Z'));
    const q = api.rest('GET', 'attendance_logs')[0].query;
    expect(q.get('employee_id')).toBe(`eq.${EMPLOYEE_ID}`);
    expect(q.get('logged_at')).toBe('gte.2026-10-11T00:00:00.000Z');
    expect(q.get('order')).toBe('logged_at.desc');
    expect(q.get('select')).not.toMatch(/latitude|longitude|photo_path/);
  });
});

describe('what to log next, and the words', () => {
  const log = (kind: 'time_in' | 'time_out', loggedAt: string): AttendanceLog => ({id: loggedAt, kind, logged_at: loggedAt, location_check: 'at_post', distance_m: 40, accuracy_m: 10, radius_m: 150, mock_location: false, site: {name: 'Post A'}});
  const now = Date.parse('2026-11-11T04:00:00Z'); // 12:00 noon in Manila
  it('time out after a time in of the last 18 hours, otherwise time in', () => {
    expect(nextKind([], now)).toBe('time_in');
    expect(nextKind([log('time_in', '2026-11-10T23:00:00Z')], now)).toBe('time_out');
    expect(nextKind([log('time_in', '2026-11-10T10:00:00Z')], now)).toBe('time_in');
    expect(nextKind([log('time_out', '2026-11-11T03:00:00Z'), log('time_in', '2026-11-10T23:00:00Z')], now)).toBe('time_in');
  });
  it('a night shift reads "yesterday"', () => {
    expect(whenText('2026-11-10T23:58:00Z', '2026-11-11')).toBe('at 7:58 AM');
    expect(whenText('2026-11-10T11:02:00Z', '2026-11-11')).toBe('yesterday at 7:02 PM');
    expect(whenText('2026-11-08T11:02:00Z', '2026-11-11')).toBe('on 8 Nov 2026 at 7:02 PM');
    expect(dayTitle('2026-11-11', '2026-11-11')).toBe('Today');
    expect(dayTitle('2026-11-10', '2026-11-11')).toBe('Yesterday');
    expect(dayTitle('2026-11-01', '2026-11-11')).toBe('1 Nov 2026');
  });
  it('Manila times and distances', () => {
    expect(fmtTime('2026-11-11T04:05:00Z')).toBe('12:05 PM');
    expect(manilaDay('2026-11-10T16:30:00Z')).toBe('2026-11-11');
    expect([fmtDistance(56), fmtDistance(1112), fmtDistance(12345)]).toEqual(['56 m', '1.1 km', '12 km']);
  });
  it('lines and flags', () => {
    expect(checkLine('at_post', 56, 12, 'Post A')).toBe('About 56 m from Post A');
    expect(checkLine('unsure', 56, 300, 'Post A')).toBe('The GPS was accurate only to 300 m');
    expect(checkLine('no_location', null, null)).toBe('Your phone gave no location');
    expect(flagged('at_post', false)).toBe(false);
    expect(flagged('at_post', true)).toBe(true);
    expect(flagged('away', false)).toBe(true);
    expect(flagged('post_not_set', false)).toBe(false);
  });
});
