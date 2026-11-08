import {brand, dark, light, type Palette} from '../src/config/theme';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe.each([
  ['light', light],
  ['dark', dark],
] as Array<[string, Palette]>)('%s palette: WCAG AA contrast', (_name, p) => {
  const grounds = [p.ground, p.panel, p.panel2];
  it('body and secondary text reach 4.5:1 on every ground', () => {
    for (const g of grounds) {
      expect(ratio(p.text, g)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.textMuted, g)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.link, g)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.beaconText, g)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('status tones reach 4.5:1 on their tint and on panels', () => {
    for (const t of Object.values(p.tones)) {
      expect(ratio(t.text, t.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.text, p.panel)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('the red button label and the night band text reach 4.5:1', () => {
    expect(ratio(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p.onPrimary, p.primaryPressed)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p.onBand, p.band)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p.onBandMuted, p.band)).toBeGreaterThanOrEqual(4.5);
  });
  it('control borders reach 3:1 (non-text)', () => {
    expect(ratio(p.lineStrong, p.panel)).toBeGreaterThanOrEqual(3);
  });
});

describe('the brand rules', () => {
  it('never red text on night (3:1)', () => {
    expect(ratio(brand.red, brand.night)).toBeLessThan(4.5);
    expect(dark.link).not.toBe(brand.red);
    expect(dark.link).not.toBe(brand.redPress);
  });
  it('the portal\'s faint grey is not used for text on light grounds', () => {
    expect(ratio(brand.faint, brand.ground)).toBeLessThan(4.5);
    expect(Object.values(light)).not.toContain(brand.faint);
  });
});
