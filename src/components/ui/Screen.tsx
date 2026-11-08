import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from 'styled-components/native';
import {TOUCH} from '../../config/theme';
import {Icon} from './Icon';
import {Txt} from './Txt';

export interface ScreenProps {
  title?: string;
  /** Show a Back button (stack screens). */
  back?: boolean;
  /** A button on the right of the title. */
  right?: React.ReactNode;
  /** Replaces the plain header (Home's night band). */
  header?: React.ReactNode;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Forms: keep the focused field above the keyboard (iOS; Android resizes the window). */
  keyboard?: boolean;
  /** Pinned under the content (a form's main button). */
  footer?: React.ReactNode;
  testID?: string;
}

/** Every screen: safe-area header with its title, a scrolling body with pull-to-refresh. */
export function Screen({title, back, right, header, children, refreshing, onRefresh, keyboard, footer, testID}: ScreenProps) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const bottom = {paddingBottom: footer ? 16 : insets.bottom + 32};
  const body = (
    <ScrollView
      testID={testID}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, bottom]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.text} colors={[colors.primary]} progressBackgroundColor={colors.panel} />
        ) : undefined
      }>
      {children}
    </ScrollView>
  );
  return (
    <View style={[styles.root, {backgroundColor: colors.ground}]}>
      <StatusBar barStyle={header || colors.scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={header ? colors.band : colors.ground} />
      {header ?? (
        <View style={[styles.head, {paddingTop: insets.top + 4, borderBottomColor: colors.line}]}>
          {back ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => nav.goBack()} style={styles.icon} hitSlop={4}>
              <Icon name="back" color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.pad} />
          )}
          <Txt variant="title" accessibilityRole="header" style={styles.title} numberOfLines={2}>
            {title}
          </Txt>
          {right ?? <View style={styles.pad} />}
        </View>
      )}
      {keyboard ? (
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
          {footer ? <View style={[styles.footer, {paddingBottom: insets.bottom + 12, borderTopColor: colors.line, backgroundColor: colors.ground}]}>{footer}</View> : null}
        </KeyboardAvoidingView>
      ) : (
        <>
          {body}
          {footer ? <View style={[styles.footer, {paddingBottom: insets.bottom + 12, borderTopColor: colors.line, backgroundColor: colors.ground}]}>{footer}</View> : null}
        </>
      )}
    </View>
  );
}

/** A round icon button for a header (the bell). */
export function HeaderButton({icon, label, onPress, count, onBand}: {icon: 'bell' | 'plus' | 'refresh'; label: string; onPress: () => void; count?: number; onBand?: boolean}) {
  const {colors} = useTheme();
  const shown = count && count > 0 ? (count > 99 ? '99+' : String(count)) : null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={shown ? `${label}, ${shown} unread` : label} onPress={onPress} style={styles.icon} hitSlop={4}>
      <Icon name={icon} color={onBand ? colors.onBand : colors.text} />
      {shown ? (
        <View style={[styles.count, {backgroundColor: colors.primary}]}>
          <Txt variant="small" style={styles.countText} maxFontSizeMultiplier={1.3}>
            {shown}
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  head: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth},
  title: {flex: 1, paddingHorizontal: 4},
  icon: {width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center'},
  pad: {width: 12},
  content: {padding: 16, gap: 16},
  footer: {paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8},
  count: {position: 'absolute', top: 4, right: 2, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center'},
  countText: {color: '#ffffff', fontSize: 12, lineHeight: 16, fontFamily: 'Archivo-Bold'},
});
