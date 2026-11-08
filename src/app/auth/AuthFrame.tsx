import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from 'styled-components/native';
import {Icon, Txt} from '../../components/ui';
import {TOUCH} from '../../config/theme';

const BADGE = require('../../assets/brand/badge.png');

/**
 * The signed-out screens: Bannuar's badge on the night band (the badge's night, a guard on duty), then
 * the form on the ground. The one atmospheric moment of the app, as on the portal's sign-in.
 */
export function AuthFrame({title, intro, children, back}: {title: string; intro?: string; children: React.ReactNode; back?: boolean}) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  return (
    <View style={[styles.root, {backgroundColor: colors.ground}]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.band} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom: insets.bottom + 32}}>
          <View style={[styles.band, {backgroundColor: colors.band, paddingTop: insets.top + 12}]}>
            {back ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => nav.goBack()} style={styles.back}>
                <Icon name="back" color={colors.onBand} />
              </Pressable>
            ) : null}
            <Image source={BADGE} style={styles.badge} accessibilityIgnoresInvertColors accessibilityLabel="Bannuar Security Agency badge" />
            <Txt variant="label" color="onBandMuted" style={styles.center}>
              Bannuar Security Agency
            </Txt>
            <Txt variant="display" color="onBand" accessibilityRole="header" style={styles.center}>
              {title}
            </Txt>
          </View>
          <View style={styles.body}>
            {intro ? <Txt color="muted">{intro}</Txt> : null}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  band: {alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 28},
  back: {position: 'absolute', left: 4, width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', top: 0},
  badge: {width: 104, height: 104, marginBottom: 4},
  center: {textAlign: 'center'},
  body: {padding: 16, gap: 18},
});
