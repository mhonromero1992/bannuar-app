import React, {useEffect, useState} from 'react';
import {StyleSheet, TextInput, View} from 'react-native';
import {useTheme} from 'styled-components/native';
import {TOUCH} from '../../config/theme';
import {fmtLongDate} from '../../lib/format';
import {SelectField} from './SelectField';
import {Txt} from './Txt';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "YYYY-MM-DD" when day, month and year make a real date; null otherwise. */
export function composeDate(day: string, month: string, year: string): string | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!/^\d{1,2}$/.test(day) || !m || !/^\d{4}$/.test(year)) {
    return null;
  }
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? iso : null;
}

/**
 * A date as three plain parts: day, month by name, year. No calendar to scroll back forty years for a
 * birthdate, nothing to misread between 08/11 and 11/08, and every part works with a screen reader.
 */
export function DateField({
  label,
  value,
  onChange,
  hint,
  error,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  hint?: string;
  error?: string | null;
}) {
  const {colors, type} = useTheme();
  const [day, setDay] = useState(value ? String(Number(value.slice(8, 10))) : '');
  const [month, setMonth] = useState(value ? String(Number(value.slice(5, 7))) : '');
  const [year, setYear] = useState(value ? value.slice(0, 4) : '');

  useEffect(() => {
    const next = composeDate(day, month, year);
    if (next !== value) {
      onChange(next);
    }
    // only the parts drive the value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, month, year]);

  const box = (focused: boolean) => [
    styles.input,
    type.body,
    {color: colors.text, backgroundColor: colors.panel, borderColor: error ? colors.tones.bad.text : colors.lineStrong, borderWidth: focused || error ? 2 : 1.5},
  ];
  const [focus, setFocus] = useState<'d' | 'y' | null>(null);
  const valid = composeDate(day, month, year);
  return (
    <View style={styles.wrap} accessibilityLabel={label}>
      <Txt variant="bodyStrong">{label}</Txt>
      {hint ? (
        <Txt variant="small" color="muted">
          {hint}
        </Txt>
      ) : null}
      <View style={styles.row}>
        <View style={styles.day}>
          <Txt variant="small" color="muted">
            Day
          </Txt>
          <TextInput
            accessibilityLabel={`${label}, day`}
            value={day}
            onChangeText={v => setDay(v.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="DD"
            placeholderTextColor={colors.textMuted}
            onFocus={() => setFocus('d')}
            onBlur={() => setFocus(null)}
            style={box(focus === 'd')}
          />
        </View>
        <View style={styles.month}>
          <SelectField
            small
            label="Month"
            value={month || null}
            onChange={v => setMonth(v)}
            placeholder="Month"
            options={MONTHS.map((name, i) => ({value: String(i + 1), label: name}))}
          />
        </View>
        <View style={styles.year}>
          <Txt variant="small" color="muted">
            Year
          </Txt>
          <TextInput
            accessibilityLabel={`${label}, year`}
            value={year}
            onChangeText={v => setYear(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="YYYY"
            placeholderTextColor={colors.textMuted}
            onFocus={() => setFocus('y')}
            onBlur={() => setFocus(null)}
            style={box(focus === 'y')}
          />
        </View>
      </View>
      {valid ? (
        <Txt variant="small" color="muted">
          {fmtLongDate(valid)}
        </Txt>
      ) : null}
      {error ? (
        <Txt variant="small" color="bad" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 6},
  row: {flexDirection: 'row', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap'},
  day: {width: 76, gap: 4},
  month: {flexGrow: 1, flexBasis: 140},
  year: {width: 96, gap: 4},
  input: {minHeight: TOUCH + 4, borderRadius: 8, paddingHorizontal: 12, textAlign: 'center'},
});
