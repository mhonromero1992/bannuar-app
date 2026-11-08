import {getMessaging, setBackgroundMessageHandler} from '@react-native-firebase/messaging';
import {pushAvailable} from './push';

/**
 * Pushes from send-push carry a notification, which Android and iOS show themselves while the app is
 * in the background; this handler only has to exist so Firebase does not warn. Nothing is stored.
 */
export function registerBackgroundPush(): void {
  try {
    if (pushAvailable()) {
      setBackgroundMessageHandler(getMessaging(), async () => undefined);
    }
  } catch {
    // Firebase not set up: push stays off
  }
}
