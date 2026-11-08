/**
 * Adds the bundled fonts to the iOS project (Resources build phase) and copies them to Android's
 * assets/fonts, where React Native finds them by file name. Run after changing src/assets/fonts:
 *   node scripts/link-fonts.cjs
 * Info.plist lists the same files under UIAppFonts.
 */
const fs = require('fs');
const path = require('path');
const xcode = require('xcode');

const root = path.join(__dirname, '..');
const fonts = fs.readdirSync(path.join(root, 'src/assets/fonts')).filter(f => f.endsWith('.ttf'));

const androidDir = path.join(root, 'android/app/src/main/assets/fonts');
fs.mkdirSync(androidDir, {recursive: true});
for (const f of fonts) fs.copyFileSync(path.join(root, 'src/assets/fonts', f), path.join(androidDir, f));

const pbx = path.join(root, 'ios/Bannuar.xcodeproj/project.pbxproj');
const project = xcode.project(pbx).parseSync();
// the xcode library files resources under a group named Resources: make it once, like react-native-asset
if (!project.pbxGroupByName('Resources')) {
  const key = project.pbxCreateGroup('Resources', '""');
  project.addToPbxGroup(key, project.getFirstProject().firstProject.mainGroup);
}
const groupKey = project.findPBXGroupKey({name: 'Resources'});
const target = project.getFirstTarget().uuid;
let added = 0;
for (const f of fonts) {
  if (project.addResourceFile(`../src/assets/fonts/${f}`, {target}, groupKey)) added++;
}
// what Xcode itself writes for a font file (the library leaves "undefined" placeholders)
const text = project
  .writeSync()
  .replace(/(\.ttf"; sourceTree = "<group>"; )fileEncoding = undefined; lastKnownFileType = unknown; explicitFileType = undefined; includeInIndex = 0; /g, '$1lastKnownFileType = file; ');
fs.writeFileSync(pbx, text);
console.log(`fonts: ${fonts.length} in Android assets, ${added} newly added to the iOS project`);
