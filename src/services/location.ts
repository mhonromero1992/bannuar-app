import Geolocation, {type GeolocationError, type GeolocationResponse} from '@react-native-community/geolocation';
import {Linking, PermissionsAndroid, Platform, type PermissionStatus} from 'react-native';
import {withoutRelock} from './appLock';

/**
 * The phone's location for time in and out, read once while the guard logs: never in the
 * background, never kept on the phone. @react-native-community/geolocation reads it (Google Play
 * services' fused location on most Android phones, Android's own location service where Play
 * services are missing, Core Location on iOS); it goes only to Bannuar's database, with the log.
 *
 * GPS is a hint, not proof: indoors and between tall buildings it can be off by hundreds of metres,
 * and apps can fake it. So the database keeps every log with its check and the photo for HR, and
 * notes when Android says a mock location app supplied the position.
 */
export interface Fix {
  latitude: number;
  longitude: number;
  /** The phone's own estimate of its error, in metres. */
  accuracy: number;
  /** Android: the position came from a mock location app. null where the phone does not say (iOS). */
  mocked: boolean | null;
}

/** precise, or approximate only (Android 12+ and iOS let people share an area of a few km instead). */
export type Permission = 'precise' | 'approximate' | 'denied' | 'blocked';
export type LocationProblem = 'denied' | 'blocked' | 'unavailable' | 'timeout';

export const LOCATION_MESSAGES: Record<LocationProblem, string> = {
  denied: 'Bannuar is not allowed to use your location, so it cannot check that you are at your post.',
  blocked: 'Location is turned off for Bannuar. Open Settings, then allow Location for Bannuar.',
  unavailable: 'Your phone gave no location. Check that Location is on, then try again.',
  timeout: 'Your phone could not find its location in time. Step outside or near a window, then try again.',
};

export class LocationError extends Error {
  constructor(public problem: LocationProblem) {
    super(LOCATION_MESSAGES[problem]);
    this.name = 'LocationError';
  }
}

/** How long to wait for a position before telling the guard. */
export const FIX_TIMEOUT_MS = 25000;

let configured = false;
function configure(): void {
  if (!configured) {
    // the app asks for permission itself (below); no background updates
    Geolocation.setRNConfiguration({skipPermissionRequests: true, authorizationLevel: 'whenInUse', locationProvider: 'auto', enableBackgroundLocationUpdates: false});
    configured = true;
  }
}

/** Android's answers to the location question, as one of ours. */
export function permissionFrom(results: Record<string, PermissionStatus>): Permission {
  const fine = results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const coarse = results[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
  if (fine === PermissionsAndroid.RESULTS.GRANTED) {
    return 'precise';
  }
  if (coarse === PermissionsAndroid.RESULTS.GRANTED) {
    return 'approximate';
  }
  return fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN || coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
}

/** Asks once for "while using the app" location (the system shows its own question). */
export async function askLocation(): Promise<Permission> {
  configure();
  return withoutRelock(async () => {
    if (Platform.OS === 'android') {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);
      return permissionFrom(results);
    }
    // iOS asks only the first time; after a "Don't Allow" only Settings can change it
    return new Promise<Permission>(resolve => Geolocation.requestAuthorization(() => resolve('precise'), () => resolve('blocked')));
  });
}

export function toFix(p: GeolocationResponse): Fix {
  const mocked = (p as GeolocationResponse & {mocked?: unknown}).mocked;
  return {
    latitude: p.coords.latitude,
    longitude: p.coords.longitude,
    accuracy: Math.max(0, Number(p.coords.accuracy) || 0),
    mocked: typeof mocked === 'boolean' ? mocked : null,
  };
}

/**
 * One fresh position (at most 5 seconds old), as precise as the phone can. The library's Play
 * services path has no time limit of its own, so the app keeps one.
 */
export function getFix(timeoutMs = FIX_TIMEOUT_MS): Promise<Fix> {
  configure();
  return new Promise<Fix>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new LocationError('timeout'));
      }
    }, timeoutMs);
    Geolocation.getCurrentPosition(
      p => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(toFix(p));
        }
      },
      (e: GeolocationError) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new LocationError(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable'));
        }
      },
      {enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 5000},
    );
  });
}

export function openAppSettings(): void {
  Linking.openSettings().catch(() => undefined);
}

// ---------------------------------------------------------------- the check, as the database does it

/** The post's point and allowed distance (sites.latitude, longitude, geofence_radius_m). */
export interface PostPlace {
  name?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  geofence_radius_m?: number | null;
}

export type LocationCheck = 'at_post' | 'unsure' | 'away' | 'no_location' | 'post_not_set' | 'no_post' | 'manual';

/** Metres between two points (haversine, the earth's mean radius), like public.geo_distance_m. */
export function distanceM(a: {latitude: number; longitude: number}, b: {latitude: number; longitude: number}): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * What log_attendance will decide for this position (schema.sql): the app shows it before the guard
 * sends, so they can move or wait for a better signal. The database decides again on its own.
 */
export function checkLocation(fix: Fix | null, post: PostPlace | null | undefined): {check: LocationCheck; distance: number | null; radius: number | null} {
  if (!fix) {
    return {check: 'no_location', distance: null, radius: null};
  }
  if (!post) {
    return {check: 'no_post', distance: null, radius: null};
  }
  if (post.latitude === null || post.latitude === undefined || post.longitude === null || post.longitude === undefined) {
    return {check: 'post_not_set', distance: null, radius: null};
  }
  const radius = post.geofence_radius_m ?? 150;
  const distance = Math.round(distanceM(fix, {latitude: Number(post.latitude), longitude: Number(post.longitude)}));
  const accuracy = Math.ceil(fix.accuracy);
  const check: LocationCheck = distance <= radius && accuracy <= radius ? 'at_post' : distance - accuracy > radius ? 'away' : 'unsure';
  return {check, distance, radius};
}
