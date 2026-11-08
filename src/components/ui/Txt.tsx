import React from 'react';
import {Text, type TextProps} from 'react-native';
import {useTheme} from 'styled-components/native';
import type {Tone} from '../../config/labels';
import type {Palette, type as typeScale} from '../../config/theme';

export type TextVariant = keyof typeof typeScale;
export type TextColor = 'text' | 'muted' | 'onBand' | 'onBandMuted' | 'beacon' | 'link' | 'onPrimary' | Tone;

export function colorOf(p: Palette, c: TextColor): string {
  switch (c) {
    case 'text':
      return p.text;
    case 'muted':
      return p.textMuted;
    case 'onBand':
      return p.onBand;
    case 'onBandMuted':
      return p.onBandMuted;
    case 'beacon':
      return p.beaconText;
    case 'link':
      return p.link;
    case 'onPrimary':
      return p.onPrimary;
    default:
      return p.tones[c].text;
  }
}

/** Text in Archivo, sized by the theme's scale and the phone's font size setting. */
export function Txt({variant = 'body', color = 'text', style, ...rest}: TextProps & {variant?: TextVariant; color?: TextColor}) {
  const t = useTheme();
  return <Text {...rest} style={[t.type[variant], {color: colorOf(t.colors, color)}, style]} />;
}
