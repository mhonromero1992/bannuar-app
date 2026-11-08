import React, {useState} from 'react';
import {Pressable, StyleSheet, TextInput, type TextInputProps, View} from 'react-native';
import {useTheme} from 'styled-components/native';
import {TOUCH} from '../../config/theme';
import {Icon} from './Icon';
import {Txt} from './Txt';

export interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
  right?: React.ReactNode;
}

/** A labelled input: the label always visible above, the hint under it, the error under the field. */
export function Field({label, hint, error, right, style, multiline, ...rest}: FieldProps) {
  const {colors, type} = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Txt variant="bodyStrong" nativeID={`label-${label}`}>
        {label}
      </Txt>
      {hint ? (
        <Txt variant="small" color="muted">
          {hint}
        </Txt>
      ) : null}
      <View
        style={[
          styles.box,
          focused || error ? styles.thick : styles.thin,
          {backgroundColor: colors.panel, borderColor: error ? colors.tones.bad.text : focused ? colors.focus : colors.lineStrong},
        ]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.focus}
          {...rest}
          multiline={multiline}
          onFocus={e => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[type.body, styles.input, multiline && styles.multi, {color: colors.text}, style]}
        />
        {right}
      </View>
      {error ? (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Icon name="alert" size={18} color={colors.tones.bad.text} />
          <Txt variant="small" color="bad" style={styles.flex}>
            {error}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

/** A password with a button that shows or hides it. */
export function PasswordField(props: Omit<FieldProps, 'secureTextEntry' | 'right'>) {
  const {colors} = useTheme();
  const [shown, setShown] = useState(false);
  return (
    <Field
      {...props}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Hide the password' : 'Show the password'}
          onPress={() => setShown(s => !s)}
          style={styles.eye}>
          <Icon name={shown ? 'eyeOff' : 'eye'} size={22} color={colors.textMuted} />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 6},
  box: {flexDirection: 'row', alignItems: 'center', borderRadius: 8, minHeight: TOUCH + 4},
  thin: {borderWidth: 1.5},
  thick: {borderWidth: 2},
  input: {flex: 1, paddingHorizontal: 14, paddingVertical: 12, minHeight: TOUCH + 2},
  multi: {minHeight: 112, textAlignVertical: 'top'},
  eye: {width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center'},
  error: {flexDirection: 'row', gap: 6, alignItems: 'flex-start'},
  flex: {flex: 1},
});
