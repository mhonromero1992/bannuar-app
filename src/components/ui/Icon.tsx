import React from 'react';
import Svg, {Circle, Path} from 'react-native-svg';

/**
 * Line icons drawn for the app (24 px grid, 2 px stroke). Plain shapes only; Bannuar's badge is always
 * its own image file, never redrawn.
 */
const PATHS: Record<string, string[]> = {
  home: ['M3 11.5 12 4l9 7.5', 'M5.5 9.5V20h13V9.5', 'M10 20v-5.5h4V20'],
  pay: ['M3 6.5h18v11H3z', 'M3 10h18', 'M7 14.5h3'],
  leave: ['M4 6h16v14H4z', 'M4 10h16', 'M8.5 3.5v4', 'M15.5 3.5v4', 'M8 14h3'],
  more: ['M5 6h14', 'M5 12h14', 'M5 18h14'],
  bell: ['M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z', 'M10 20.5a2 2 0 0 0 4 0'],
  back: ['M15 5l-7 7 7 7'],
  chevron: ['M9 5l7 7-7 7'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  alert: ['M12 4 2.8 19.5h18.4z', 'M12 10v4.5', 'M12 17.2v.3'],
  info: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z', 'M12 11v5.5', 'M12 7.8v.3'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  eyeOff: ['M3 3l18 18', 'M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.7', 'M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
  file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  camera: ['M3.5 7.5h4l1.5-2.5h6l1.5 2.5h4V19h-17z', 'M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'],
  image: ['M3.5 5h17v14h-17z', 'M3.5 16l5-5 4 4 2.5-2.5 5.5 5', 'M15.5 8.5h.1'],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 15v5h16v-5'],
  lock: ['M6 11h12v9.5H6z', 'M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11'],
  user: ['M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4.5 20.5c1-3.5 4-5.5 7.5-5.5s6.5 2 7.5 5.5'],
  shield: ['M12 3 5 6v5.5c0 4.2 3 7.7 7 9.5 4-1.8 7-5.3 7-9.5V6z'],
  pin: ['M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z', 'M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  megaphone: ['M4 10v4h3l7 4V6l-7 4z', 'M17 9.5a3.5 3.5 0 0 1 0 5', 'M7 14l1.5 5'],
  certificate: ['M5 4h14v11H5z', 'M8 8h8', 'M8 11h5', 'M10 15l-1.5 5 3.5-2 3.5 2-1.5-5'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  wifiOff: ['M3 3l18 18', 'M8.5 16.5a5 5 0 0 1 7 0', 'M5 12.5a10 10 0 0 1 4.5-2.4', 'M14.5 10.1A10 10 0 0 1 19 12.5', 'M2 9a15 15 0 0 1 5-3', 'M11 5.1A15 15 0 0 1 22 9', 'M12 20h.1'],
  refresh: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4v4.5h-4.5'],
  post: ['M4 21V8l8-5 8 5v13', 'M9 21v-6h6v6', 'M9 11h.1M15 11h.1'],
  logout: ['M10 4H5v16h5', 'M14 8l4 4-4 4', 'M18 12H9'],
  plus: ['M12 5v14', 'M5 12h14'],
};

export type IconName = keyof typeof PATHS;

export function Icon({name, size = 24, color, strokeWidth = 2}: {name: IconName; size?: number; color: string; strokeWidth?: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {PATHS[name].map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

/** The identity motif: one gold light, one guard on duty (website DESIGN.md, section 5). */
export function Beacon({size = 10, color}: {size?: number; color: string}) {
  return (
    <Svg width={size * 2.4} height={size * 2.4} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={12} cy={12} r={11} fill={color} opacity={0.18} />
      <Circle cx={12} cy={12} r={5} fill={color} />
    </Svg>
  );
}
