import {useFocusEffect} from '@react-navigation/native';
import {useCallback} from 'react';
import {NativeModules, Platform} from 'react-native';
import {useUi} from '../store/ui';

/**
 * Pay and government numbers: on Android the screen gets FLAG_SECURE (no screenshots or recordings, blank
 * in recent apps; android/.../SecureWindowModule.kt). iOS has no such flag; there the app covers itself
 * whenever it leaves the foreground, so the app switcher never shows these screens.
 */
const native = NativeModules.BannuarSecureWindow as {setSecure?: (on: boolean) => void} | undefined;

export function setSecure(on: boolean): void {
  if (Platform.OS === 'android') {
    native?.setSecure?.(on);
  }
  useUi.getState().setSecureScreen(on);
}

export function useSecureScreen(): void {
  useFocusEffect(
    useCallback(() => {
      setSecure(true);
      return () => setSecure(false);
    }, []),
  );
}
