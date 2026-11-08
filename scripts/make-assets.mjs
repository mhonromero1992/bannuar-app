/**
 * App icons from Bannuar's badge (src/assets/brand/badge.png, the portal's public/badge.png), placed
 * as it is on the night ground: never redrawn. When Bannuar sends the vector original, export it as a
 * 1024 px PNG over src/assets/brand/badge.png and run `npm run assets` again.
 *
 * Android: legacy and round icons (48 dp) and the adaptive icon's foreground (108 dp, badge inside
 * the 66 dp safe circle). iOS: one 1024 px icon (Xcode makes the other sizes).
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const BADGE = 'src/assets/brand/badge.png';
const NIGHT = { r: 11, g: 22, b: 38, alpha: 1 };
const RES = 'android/app/src/main/res';
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function onNight(size, badgeShare, round = false) {
  const badge = await sharp(BADGE).resize(Math.round(size * badgeShare), Math.round(size * badgeShare), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  let img = sharp({ create: { width: size, height: size, channels: 4, background: NIGHT } }).composite([{ input: badge, gravity: 'center' }]);
  if (round) {
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);
    img = sharp(await img.png().toBuffer()).composite([{ input: mask, blend: 'dest-in' }]);
  }
  return img.png({ compressionLevel: 9, palette: true, quality: 95 }).toBuffer();
}

async function transparent(size, badgeShare) {
  const badge = await sharp(BADGE).resize(Math.round(size * badgeShare), Math.round(size * badgeShare), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: badge, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true, quality: 95 })
    .toBuffer();
}

for (const [name, scale] of Object.entries(densities)) {
  const dir = `${RES}/mipmap-${name}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/ic_launcher.png`, await onNight(Math.round(48 * scale), 0.78));
  writeFileSync(`${dir}/ic_launcher_round.png`, await onNight(Math.round(48 * scale), 0.72, true));
  // adaptive foreground: 108 dp canvas, the badge within the 66 dp circle that every mask shows
  writeFileSync(`${dir}/ic_launcher_foreground.png`, await transparent(Math.round(108 * scale), 0.58));
}
mkdirSync(`${RES}/mipmap-anydpi-v26`, { recursive: true });
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`, adaptive);
writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher_round.xml`, adaptive);

const ios = 'ios/Bannuar/Images.xcassets/AppIcon.appiconset';
mkdirSync(ios, { recursive: true });
// iOS icons have no transparency: flatten on night
writeFileSync(`${ios}/AppIcon-1024.png`, await sharp(await onNight(1024, 0.74)).flatten({ background: NIGHT }).removeAlpha().png().toBuffer());
writeFileSync(`${ios}/Contents.json`, `${JSON.stringify({
  images: [{ filename: 'AppIcon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
  info: { author: 'xcode', version: 1 },
}, null, 2)}\n`);
// the splash logos react-native-bootsplash made, with the same palette compression
for (const name of Object.keys(densities)) {
  const file = `${RES}/drawable-${name}/bootsplash_logo.png`;
  writeFileSync(file, await sharp(file).png({ compressionLevel: 9, palette: true, quality: 95 }).toBuffer());
}
console.log('icons written');
