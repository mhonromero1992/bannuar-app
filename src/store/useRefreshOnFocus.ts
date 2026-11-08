import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useRef} from 'react';
import type {Resource} from './resources';

/** Reloads a screen's data when the guard comes back to it and it is more than a minute old. */
export function useRefreshOnFocus(resource: Pick<Resource<unknown>, 'refresh' | 'updatedAt'>, maxAgeMs = 60_000): void {
  const ref = useRef(resource);
  ref.current = resource;
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      const at = ref.current.updatedAt ?? 0;
      if (Date.now() - at > maxAgeMs) {
        ref.current.refresh().catch(() => undefined);
      }
    }, [maxAgeMs]),
  );
}
