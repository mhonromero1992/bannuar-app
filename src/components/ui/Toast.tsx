import React, {useEffect} from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from 'styled-components/native';
import {useUi} from '../../store/ui';
import {Icon} from './Icon';
import {Txt} from './Txt';

/** A short message at the top: what just happened ("Leave filed"), gone after five seconds or a tap. */
export function Toast() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useUi(s => s.toast);
  const hide = useUi(s => s.hideToast);
  useEffect(() => {
    if (!toast) {
      return;
    }
    const t = setTimeout(hide, 5000);
    return () => clearTimeout(t);
  }, [toast, hide]);
  if (!toast) {
    return null;
  }
  const tone = colors.tones[toast.tone];
  return (
    <Pressable
      accessibilityRole={toast.onPress ? 'button' : 'alert'}
      accessibilityLiveRegion="polite"
      onPress={() => {
        hide();
        toast.onPress?.();
      }}
      style={[styles.toast, {top: insets.top + 8, backgroundColor: tone.bg, borderColor: colors.line}]}>
      <Icon name={toast.tone === 'ok' ? 'check' : toast.tone === 'info' ? 'bell' : 'alert'} size={22} color={tone.text} />
      <Txt color={toast.tone} style={styles.flex}>
        {toast.message}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, elevation: 6, zIndex: 10},
  flex: {flex: 1},
});
