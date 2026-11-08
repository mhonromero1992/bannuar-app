import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import {useTheme} from 'styled-components/native';
import {TOUCH} from '../../config/theme';
import {Icon, type IconName} from './Icon';
import {Txt} from './Txt';

export interface ButtonProps {
  /** Names the action: "File leave", "Request a certificate". */
  title: string;
  onPress: () => void;
  /** primary: the one red action of a screen. secondary: outlined. ghost: text only. */
  variant?: 'primary' | 'secondary' | 'ghost';
  busy?: boolean;
  disabled?: boolean;
  icon?: IconName;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({title, onPress, variant = 'primary', busy, disabled, icon, accessibilityHint, testID}: ButtonProps) {
  const {colors} = useTheme();
  const off = Boolean(disabled || busy);
  const fg = variant === 'primary' ? (disabled ? colors.textMuted : colors.onPrimary) : variant === 'ghost' ? colors.link : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{disabled: off, busy: Boolean(busy)}}
      disabled={off}
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        variant === 'primary' && {backgroundColor: disabled ? colors.panel2 : pressed ? colors.primaryPressed : colors.primary},
        variant === 'secondary' && {
          borderWidth: 1.5,
          borderColor: colors.lineStrong,
          backgroundColor: pressed ? colors.panel2 : 'transparent',
        },
        variant === 'ghost' && {backgroundColor: pressed ? colors.panel2 : 'transparent', paddingHorizontal: 12},
      ]}>
      <View style={styles.inner}>
        {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
        <Txt variant="button" style={[styles.label, {color: fg}]}>
          {title}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {minHeight: TOUCH + 4, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'center'},
  inner: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap'},
  label: {textAlign: 'center'},
});
