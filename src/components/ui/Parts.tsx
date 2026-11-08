import React, {useState} from 'react';
import {Pressable, StyleSheet, View, type ViewStyle} from 'react-native';
import {useTheme} from 'styled-components/native';
import type {Tone} from '../../config/labels';
import {TOUCH} from '../../config/theme';
import {fmtPeso} from '../../lib/format';
import {Icon, type IconName} from './Icon';
import {Txt} from './Txt';

/** A panel on the ground. Pressable when it has onPress. */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  style,
  highlight,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
  /** The item a notification opened: outlined in the beacon's gold. */
  highlight?: boolean;
}) {
  const {colors} = useTheme();
  const base = [styles.card, {backgroundColor: colors.panel, borderColor: colors.line}, highlight && {borderWidth: 2, borderColor: colors.beacon}, style];
  if (!onPress) {
    return <View style={base}>{children}</View>;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({pressed}) => [base, pressed && {backgroundColor: colors.panel2}]}>
      {children}
    </Pressable>
  );
}

/** A section heading in condensed capitals, like a name tape. */
export function SectionLabel({children}: {children: string}) {
  return (
    <Txt variant="label" color="muted" accessibilityRole="header">
      {children}
    </Txt>
  );
}

export function Badge({tone = 'neutral', children}: {tone?: Tone; children: string}) {
  const {colors} = useTheme();
  return (
    <View style={[styles.badge, {backgroundColor: colors.tones[tone].bg}]}>
      <Txt variant="small" color={tone} style={styles.badgeText} maxFontSizeMultiplier={1.6}>
        {children}
      </Txt>
    </View>
  );
}

/** One line of a list: title, detail under it, a status or value on the right, a chevron when it opens. */
export function Row({
  title,
  detail,
  right,
  icon,
  onPress,
  unread,
  last,
  testID,
}: {
  title: string;
  detail?: string | null;
  right?: React.ReactNode;
  icon?: IconName;
  onPress?: () => void;
  unread?: boolean;
  last?: boolean;
  testID?: string;
}) {
  const {colors} = useTheme();
  const content = (
    <>
      {unread ? <View style={[styles.unread, {backgroundColor: colors.beacon}]} accessibilityLabel="Unread" /> : null}
      {icon ? <Icon name={icon} color={colors.textMuted} /> : null}
      <View style={styles.rowText}>
        <Txt variant="bodyStrong">{title}</Txt>
        {detail ? (
          <Txt variant="small" color="muted">
            {detail}
          </Txt>
        ) : null}
      </View>
      {right}
      {onPress ? <Icon name="chevron" size={20} color={colors.textMuted} /> : null}
    </>
  );
  const style = [styles.row, !last && {borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line}];
  if (!onPress) {
    return (
      <View style={style} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({pressed}) => [style, pressed && {backgroundColor: colors.panel2}]}>
      {content}
    </Pressable>
  );
}

/** A label above its value: reads well at any font size. */
export function KeyValue({label, value, mono}: {label: string; value?: string | null; mono?: boolean}) {
  return (
    <View style={styles.kv}>
      <Txt variant="small" color="muted">
        {label}
      </Txt>
      <Txt variant={mono ? 'amount' : 'body'} selectable>
        {value || 'Not on file'}
      </Txt>
    </View>
  );
}

/** A note in its tone's colours: ok, waiting, needs action, information. */
export function Notice({tone = 'info', title, children, icon}: {tone?: Tone; title?: string; children?: React.ReactNode; icon?: IconName}) {
  const {colors} = useTheme();
  const t = colors.tones[tone];
  return (
    <View style={[styles.notice, {backgroundColor: t.bg}]} accessibilityRole={tone === 'bad' ? 'alert' : undefined}>
      <Icon name={icon ?? (tone === 'bad' || tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'info')} size={22} color={t.text} />
      <View style={styles.flex}>
        {title ? (
          <Txt variant="bodyStrong" color={tone}>
            {title}
          </Txt>
        ) : null}
        {typeof children === 'string' ? <Txt color={tone}>{children}</Txt> : children}
      </View>
    </View>
  );
}

/** An amount that stays hidden until tapped: payslips are read in public places. */
export function HiddenAmount({label, amount, big}: {label: string; amount: number | string; big?: boolean}) {
  const [shown, setShown] = useState(false);
  const text = fmtPeso(amount);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown ? `${label}, ${text}. Double tap to hide.` : `${label}, hidden. Double tap to show.`}
      onPress={() => setShown(s => !s)}
      style={styles.hidden}>
      <Txt variant="small" color="muted">
        {label}
      </Txt>
      <Txt variant={big ? 'figure' : 'amount'}>{shown ? text : '₱ ••••••'}</Txt>
      <Txt variant="small" color="link">
        {shown ? 'Tap to hide' : 'Tap to show'}
      </Txt>
    </Pressable>
  );
}

/** Label and amount on one line, for payslip tables. */
export function AmountLine({label, amount, strong}: {label: string; amount: number | string; strong?: boolean}) {
  return (
    <View style={styles.amountLine}>
      <Txt variant={strong ? 'bodyStrong' : 'body'} style={styles.flex}>
        {label}
      </Txt>
      <Txt variant={strong ? 'bodyStrong' : 'amount'} style={styles.amount}>
        {fmtPeso(amount)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {borderRadius: 14, padding: 16, gap: 12, borderWidth: StyleSheet.hairlineWidth},
  badge: {alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, minHeight: 26, justifyContent: 'center'},
  badgeText: {fontFamily: 'Archivo-SemiBold'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TOUCH + 8, paddingVertical: 10},
  rowText: {flex: 1, gap: 2},
  unread: {width: 10, height: 10, borderRadius: 5},
  kv: {gap: 2},
  notice: {flexDirection: 'row', gap: 10, padding: 14, borderRadius: 10},
  flex: {flex: 1},
  hidden: {gap: 2, minHeight: TOUCH, justifyContent: 'center'},
  amountLine: {flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6},
  amount: {textAlign: 'right'},
});
