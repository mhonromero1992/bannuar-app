import {DarkTheme, DefaultTheme, type Theme as NavTheme} from '@react-navigation/native';
import type {TextStyle} from 'react-native';

/**
 * Bannuar's palette, from the portal (src/styles.css) and the website (DESIGN.md): night, khaki
 * ground, the gold beacon, one red accent. Light and dark are both planned; every text colour below is
 * checked against its grounds to WCAG AA (4.5:1) in __tests__/theme.test.ts. Red never carries text on
 * night (3.0:1): on dark grounds it stays a shape, like the primary button.
 */
export const brand = {
  night: '#0b1626',
  night2: '#13253d',
  night3: '#1b3150',
  ground: '#f6f3ec',
  panel: '#ffffff',
  panel2: '#f1ede3',
  ink: '#0d1a2b',
  muted: '#4f5b6b',
  /** Decorative only: 4.15:1 on the light ground, so never small text. */
  faint: '#6b7686',
  sun: '#f2c230',
  sunInk: '#7a5900',
  red: '#c4161c',
  redHi: '#d9262c',
  redPress: '#a51117',
  pale: '#aebccf',
  onNight: '#eef2f7',
  white: '#ffffff',
};

export interface Palette {
  scheme: 'light' | 'dark';
  /** Screen background. */
  ground: string;
  /** Cards and sheets. */
  panel: string;
  /** Inputs, insets, pressed rows. */
  panel2: string;
  text: string;
  textMuted: string;
  line: string;
  /** Input borders and other controls that need 3:1 against their surface. */
  lineStrong: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** The beacon: active tab, unread dots, empty states. */
  beacon: string;
  /** Gold as text, where gold must be read. */
  beaconText: string;
  /** Night band (headers): the same in both schemes. */
  band: string;
  onBand: string;
  onBandMuted: string;
  link: string;
  focus: string;
  scrim: string;
  tones: Record<'ok' | 'warn' | 'bad' | 'info' | 'neutral', {text: string; bg: string}>;
}

export const light: Palette = {
  scheme: 'light',
  ground: brand.ground,
  panel: brand.panel,
  panel2: brand.panel2,
  text: brand.ink,
  textMuted: brand.muted,
  line: 'rgba(13, 26, 43, 0.12)',
  lineStrong: '#8a93a0',
  primary: brand.red,
  primaryPressed: brand.redPress,
  onPrimary: brand.white,
  beacon: brand.sun,
  beaconText: brand.sunInk,
  band: brand.night,
  onBand: brand.onNight,
  onBandMuted: brand.pale,
  link: brand.redPress,
  focus: brand.red,
  scrim: 'rgba(5, 10, 20, 0.5)',
  tones: {
    ok: {text: '#24592f', bg: '#e3efe3'},
    warn: {text: '#7a5900', bg: '#fbf0cf'},
    bad: {text: '#a51117', bg: '#f9e3e1'},
    info: {text: '#1f4e8c', bg: '#e3ecf8'},
    neutral: {text: '#4f5b6b', bg: '#ebe8e0'},
  },
};

export const dark: Palette = {
  scheme: 'dark',
  ground: brand.night,
  panel: brand.night2,
  panel2: brand.night3,
  text: brand.onNight,
  textMuted: brand.pale,
  line: 'rgba(238, 242, 247, 0.14)',
  lineStrong: '#5d7290',
  primary: brand.red,
  primaryPressed: brand.redPress,
  onPrimary: brand.white,
  beacon: brand.sun,
  beaconText: brand.sun,
  band: '#081120',
  onBand: brand.onNight,
  onBandMuted: brand.pale,
  // red text on night reads at 3:1: links on dark grounds are gold
  link: brand.sun,
  focus: brand.sun,
  scrim: 'rgba(0, 0, 0, 0.6)',
  tones: {
    ok: {text: '#9fdcab', bg: '#173322'},
    warn: {text: '#f2c230', bg: '#33290a'},
    bad: {text: '#ffb4ae', bg: '#3f1619'},
    info: {text: '#a9c9f5', bg: '#16294a'},
    neutral: {text: '#c3cddb', bg: '#22324a'},
  },
};

/**
 * Archivo, the website's and portal's font, in five static cuts (src/assets/fonts, scripts/make-fonts.py).
 * Each file is named after its PostScript name, so one fontFamily works on Android and iOS. Never set
 * fontWeight with these: the weight is in the file.
 */
export const fonts = {
  regular: 'Archivo-Regular',
  semibold: 'Archivo-SemiBold',
  bold: 'Archivo-Bold',
  /** Headings: wide like the lettering on a badge (website: width 118%, weight 760). */
  display: 'ArchivoExpanded-Bold',
  /** Labels: narrow like a name tape (website: width 72%, weight 640, capitals). */
  label: 'ArchivoCondensed-SemiBold',
};

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/** 16sp body that follows the phone's font size; nothing smaller than 14sp carries information. */
export const type = {
  display: {fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.3},
  title: {fontFamily: fonts.display, fontSize: 21, lineHeight: 27},
  heading: {fontFamily: fonts.bold, fontSize: 18, lineHeight: 24},
  body: {fontFamily: fonts.regular, fontSize: 16, lineHeight: 24},
  bodyStrong: {fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24},
  small: {fontFamily: fonts.regular, fontSize: 14, lineHeight: 20},
  label: {fontFamily: fonts.label, fontSize: 14, lineHeight: 18, letterSpacing: 0.8, textTransform: 'uppercase'},
  button: {fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22},
  figure: {fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, fontVariant: tabular},
  amount: {fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, fontVariant: tabular},
} satisfies Record<string, TextStyle>;

export const space = {xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, gutter: 16};
export const radii = {control: 8, card: 14, pill: 999};
/** Every control is at least this tall (48dp, Android's and WCAG's touch target). */
export const TOUCH = 48;

export interface AppTheme {
  colors: Palette;
  fonts: typeof fonts;
  type: typeof type;
  space: typeof space;
  radii: typeof radii;
}

export const makeTheme = (scheme: 'light' | 'dark' | null | undefined): AppTheme => ({
  colors: scheme === 'dark' ? dark : light,
  fonts,
  type,
  space,
  radii,
});

export function navTheme(p: Palette): NavTheme {
  const base = p.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: p.ground,
      card: p.panel,
      border: p.line,
      notification: p.primary,
      primary: p.primary,
      text: p.text,
    },
  };
}
