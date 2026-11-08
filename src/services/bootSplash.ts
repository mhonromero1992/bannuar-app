import BootSplash from 'react-native-bootsplash';

let hidden = false;

/** Fades the native splash (the badge on night) once the first screen is drawn; only the first call acts. */
export function hideBootSplash(): void {
  if (hidden) {
    return;
  }
  hidden = true;
  BootSplash.hide({fade: true}).catch(() => undefined);
}
