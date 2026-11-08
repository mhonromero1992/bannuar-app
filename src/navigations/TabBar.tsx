import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from 'styled-components/native';
import {Icon, type IconName} from '../components/ui/Icon';
import {Txt} from '../components/ui/Txt';
import {TOUCH} from '../config/theme';

const ICONS: Record<string, IconName> = {Home: 'home', Payslips: 'pay', Leave: 'leave', More: 'more'};

/**
 * The bottom bar: @react-navigation/bottom-tabs with this bar drawn by the app. Four tabs of at least
 * 48dp, a label under every icon, the active tab marked by the gold beacon and bolder text.
 */
export function TabBar({state, descriptors, navigation}: BottomTabBarProps) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, {backgroundColor: colors.panel, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 6)}]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const title = (descriptors[route.key].options.title ?? route.name) as string;
        const marker = focused ? colors.beacon : colors.panel;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{selected: focused}}
            accessibilityLabel={title}
            testID={`tab-${route.name}`}
            onPress={() => {
              const event = navigation.emit({type: 'tabPress', target: route.key, canPreventDefault: true});
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={({pressed}) => [styles.tab, pressed && {backgroundColor: colors.panel2}]}>
            <View style={[styles.marker, {backgroundColor: marker}]} />
            <Icon name={ICONS[route.name] ?? 'more'} color={focused ? colors.text : colors.textMuted} strokeWidth={focused ? 2.4 : 2} />
            <Txt variant={focused ? 'bodyStrong' : 'body'} color={focused ? 'text' : 'muted'} style={styles.label} maxFontSizeMultiplier={1.35} numberOfLines={1}>
              {title}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 2},
  tab: {flex: 1, minHeight: TOUCH + 12, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4},
  marker: {width: 24, height: 3, borderRadius: 2, marginBottom: 2},
  label: {fontSize: 13, lineHeight: 17},
});
