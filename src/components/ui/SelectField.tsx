import React, {useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from 'styled-components/native';
import {TOUCH} from '../../config/theme';
import {Icon} from './Icon';
import {Txt} from './Txt';

export interface Option<V extends string> {
  value: V;
  label: string;
  note?: string | null;
}

/** A choice from a short list, in a sheet with one large row per option. */
export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  hint,
  error,
  small,
}: {
  label: string;
  /** A small grey label, for a part of a larger field (the month of a date). */
  small?: boolean;
  value: V | null;
  options: Option<V>[];
  onChange: (v: V) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
}) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  return (
    <View style={[styles.wrap, small && styles.wrapSmall]}>
      <Txt variant={small ? 'small' : 'bodyStrong'} color={small ? 'muted' : 'text'}>
        {label}
      </Txt>
      {hint ? (
        <Txt variant="small" color="muted">
          {hint}
        </Txt>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'not chosen'}`}
        accessibilityHint="Opens the list of choices"
        onPress={() => setOpen(true)}
        style={({pressed}) => [
          styles.box,
          {
            backgroundColor: pressed ? colors.panel2 : colors.panel,
            borderColor: error ? colors.tones.bad.text : colors.lineStrong,
            borderWidth: error ? 2 : 1.5,
          },
        ]}>
        <Txt color={current ? 'text' : 'muted'} style={styles.flex}>
          {current?.label ?? placeholder}
        </Txt>
        <Icon name="chevron" size={20} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <Txt variant="small" color="bad" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.scrim, {backgroundColor: colors.scrim}]} onPress={() => setOpen(false)} accessibilityLabel="Close the list" />
        <View style={[styles.sheet, {backgroundColor: colors.panel, paddingBottom: insets.bottom + 12}]} accessibilityViewIsModal>
          <View style={styles.sheetHead}>
            <Txt variant="title" accessibilityRole="header" style={styles.flex}>
              {label}
            </Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(false)} style={styles.close}>
              <Icon name="close" color={colors.text} />
            </Pressable>
          </View>
          <ScrollView>
            {options.map(o => {
              const selected = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{checked: selected}}
                  accessibilityLabel={o.note ? `${o.label}. ${o.note}` : o.label}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={({pressed}) => [styles.option, {borderColor: colors.line, backgroundColor: pressed ? colors.panel2 : 'transparent'}]}>
                  <View style={[styles.radio, {borderColor: selected ? colors.primary : colors.lineStrong}]}>
                    {selected ? <View style={[styles.dot, {backgroundColor: colors.primary}]} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Txt variant={selected ? 'bodyStrong' : 'body'}>{o.label}</Txt>
                    {o.note ? (
                      <Txt variant="small" color="muted">
                        {o.note}
                      </Txt>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 6},
  wrapSmall: {gap: 4},
  box: {flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, minHeight: TOUCH + 4, paddingHorizontal: 14, paddingVertical: 12},
  flex: {flex: 1},
  scrim: {flex: 1},
  sheet: {maxHeight: '80%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8},
  sheetHead: {flexDirection: 'row', alignItems: 'center', paddingLeft: 16},
  close: {width: TOUCH + 8, height: TOUCH + 8, alignItems: 'center', justifyContent: 'center'},
  option: {flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: TOUCH + 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth},
  radio: {width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  dot: {width: 10, height: 10, borderRadius: 5},
});
